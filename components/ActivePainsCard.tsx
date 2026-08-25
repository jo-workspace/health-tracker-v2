'use client';
import { useState } from 'react';
import {
  Flame,
  Plus,
  Clock,
  History,
  CheckCircle2,
  Edit2,
  ChevronDown,
  ChevronUp,
  Smile,
  Activity
} from 'lucide-react';
import type { PainLog, PainHistoryEntry, SyncPayload } from '@/lib/types';
import PainFormModal from '@/components/forms/PainFormModal';
import PainCheckinModal from '@/components/forms/PainCheckinModal';
import PainTimelineModal from '@/components/forms/PainTimelineModal';
import {
  getPainLevel,
  getDurationDays,
  formatDate,
  ensurePainLogHistory
} from '@/lib/pain';

interface Props {
  data?: PainLog[];
  updateData: (payload: SyncPayload) => void;
}

export default function ActivePainsCard({ data = [], updateData }: Props) {
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false);
  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false);
  const [selectedPain, setSelectedPain] = useState<PainLog | null>(null);
  const [showRecovered, setShowRecovered] = useState(false);

  const activePains = data
    .filter(log => log.status === 'active')
    .sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));

  const recoveredPains = data
    .filter(log => log.status === 'recovered')
    .sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));

  // 標記康復
  const handleMarkRecovered = (pain: PainLog) => {
    const today = new Date().toLocaleDateString('en-CA');
    const existingHistory = ensurePainLogHistory(pain);
    const recoveredEntry: PainHistoryEntry = {
      id: crypto.randomUUID(),
      date: today,
      level: 0,
      levelLabel: '已無痛',
      treatments: pain.treatments || [],
      notes: '已康復結案',
      timestamp: Date.now()
    };

    const updatedLogs = data.map(log => {
      if (log.id === pain.id) {
        return {
          ...log,
          status: 'recovered' as const,
          level: 0,
          intensity: 0,
          recoveredDate: today,
          history: [...existingHistory, recoveredEntry],
          lastUpdated: Date.now()
        };
      }
      return log;
    });

    updateData({ painLogs: updatedLogs, clientTimestamp: Date.now() });
  };

  // 儲存/新增痛點基本資訊
  const handleSavePain = (logData: Partial<PainLog>) => {
    let updatedLogs = [...data];
    const existingIndex = updatedLogs.findIndex(l => l.id === logData.id);
    if (existingIndex >= 0) {
      updatedLogs[existingIndex] = {
        ...updatedLogs[existingIndex],
        ...logData
      } as PainLog;
    } else {
      updatedLogs.push(logData as PainLog);
    }
    updateData({ painLogs: updatedLogs, clientTimestamp: Date.now() });
  };

  // 每日打卡更新
  const handleSaveCheckin = (
    painId: string,
    entry: PainHistoryEntry,
    currentLevel: number,
    treatments: string[],
    notes: string
  ) => {
    const updatedLogs = data.map(log => {
      if (log.id === painId) {
        const existingHistory = ensurePainLogHistory(log);
        return {
          ...log,
          level: currentLevel,
          intensity: currentLevel,
          treatments,
          notes: notes || log.notes,
          history: [...existingHistory, entry],
          lastUpdated: Date.now()
        };
      }
      return log;
    });
    updateData({ painLogs: updatedLogs, clientTimestamp: Date.now() });
  };

  // 刪除紀錄
  const handleDeletePain = (id: string) => {
    const updatedLogs = data.map(log => {
      if (log.id === id) {
        return { ...log, status: 'deleted' as const, lastUpdated: Date.now() };
      }
      return log;
    });
    updateData({ painLogs: updatedLogs, clientTimestamp: Date.now() });
  };

  // 刪除單筆歷程節點
  const handleDeleteHistoryEntry = (painId: string, entryId: string) => {
    const updatedLogs = data.map(log => {
      if (log.id === painId) {
        const currentHist = ensurePainLogHistory(log);
        const newHist = currentHist.filter(h => h.id !== entryId);
        const lastEntry = newHist[newHist.length - 1];
        return {
          ...log,
          level: lastEntry ? lastEntry.level : log.level,
          intensity: lastEntry ? lastEntry.level : log.intensity,
          treatments: lastEntry?.treatments || log.treatments,
          history: newHist,
          lastUpdated: Date.now()
        };
      }
      return log;
    });
    updateData({ painLogs: updatedLogs, clientTimestamp: Date.now() });
  };

  return (
    <div className="w-full max-w-md mx-auto mb-8">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-stone-700 font-bold flex items-center gap-2 text-base">
          <Flame size={18} className="text-stone-600" />
          活躍痛點
          {activePains.length > 0 && (
            <span className="text-xs bg-stone-200/70 text-stone-600 px-2 py-0.5 rounded-full font-bold">
              {activePains.length}
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => {
            setSelectedPain(null);
            setIsFormModalOpen(true);
          }}
          className="text-xs text-stone-600 hover:text-stone-900 font-bold flex items-center gap-1 bg-white border border-stone-200 px-2.5 py-1 rounded-lg shadow-2xs transition-colors"
        >
          <Plus size={14} /> 記錄痛點
        </button>
      </div>

      {/* Active Pains List */}
      <div className="flex flex-col gap-3">
        {activePains.length === 0 ? (
          <div className="bg-stone-50 rounded-xl py-5 flex items-center justify-center gap-2 text-stone-500 border border-stone-100">
            <Smile size={18} className="text-stone-400" />
            <span className="font-bold text-stone-600 text-xs">目前無活躍痛點</span>
          </div>
        ) : (
          activePains.map(pain => {
            const startDate = pain.startDate || pain.date || '';
            const durationDays = getDurationDays(startDate);
            const lvlObj = getPainLevel(pain.level ?? pain.intensity);

            return (
              <div
                key={pain.id}
                className="bg-white border border-stone-200 rounded-xl p-3.5 shadow-2xs transition-all hover:border-stone-300"
              >
                {/* Top Row: Location, Trigger, Duration, Level Badge */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-black text-stone-800 text-sm">{pain.location}</h3>
                      {pain.trigger && (
                        <span className="text-[11px] font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded">
                          {pain.trigger}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
                      <Clock size={12} />
                      <span>持續 {durationDays} 天</span>
                      <span>·</span>
                      <span>{formatDate(startDate)} 起</span>
                    </div>
                  </div>

                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg border shrink-0 flex items-center gap-1.5 ${lvlObj.badgeClass}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${lvlObj.dotClass}`} />
                    {lvlObj.label}
                  </span>
                </div>

                {/* Middle: Treatments & Notes */}
                {(pain.treatments?.length || pain.notes) && (
                  <div className="bg-stone-50/70 rounded-lg p-2.5 my-2 flex flex-col gap-1.5">
                    {pain.treatments && pain.treatments.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {pain.treatments.map((t, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-medium text-stone-600 bg-white border border-stone-200 px-1.5 py-0.5 rounded"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {pain.notes && (
                      <p className="text-[11px] text-stone-600 leading-snug whitespace-pre-wrap">
                        {pain.notes}
                      </p>
                    )}
                  </div>
                )}

                {/* Bottom Row Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-stone-100 mt-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPain(pain);
                        setIsCheckinModalOpen(true);
                      }}
                      className="px-2.5 py-1 bg-stone-800 text-white hover:bg-stone-900 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors"
                    >
                      <Activity size={12} />
                      打卡
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPain(pain);
                        setIsTimelineModalOpen(true);
                      }}
                      className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg font-medium text-xs flex items-center gap-1 transition-colors"
                    >
                      <History size={12} />
                      歷程
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPain(pain);
                        setIsFormModalOpen(true);
                      }}
                      className="p-1 hover:bg-stone-100 text-stone-400 hover:text-stone-600 rounded transition-colors"
                      title="編輯基本資料"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMarkRecovered(pain)}
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors"
                    >
                      <CheckCircle2 size={12} />
                      康復
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Recovered History Collapsible Section */}
      {recoveredPains.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowRecovered(prev => !prev)}
            className="w-full flex items-center justify-between px-3 py-2 bg-stone-50 hover:bg-stone-100 rounded-xl text-xs font-bold text-stone-600 transition-colors border border-stone-200/60"
          >
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-stone-500" />
              <span>已康復紀錄 ({recoveredPains.length})</span>
            </div>
            {showRecovered ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showRecovered && (
            <div className="flex flex-col gap-2 mt-2">
              {recoveredPains.map(pain => {
                const startDate = pain.startDate || pain.date || '';
                const totalDays = getDurationDays(startDate, pain.recoveredDate);

                return (
                  <div
                    key={pain.id}
                    className="bg-white border border-stone-200 rounded-xl p-3 shadow-2xs flex items-center justify-between text-xs"
                  >
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-800">{pain.location}</span>
                        {pain.trigger && (
                          <span className="text-[10px] text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">
                            {pain.trigger}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-stone-400">
                        {formatDate(startDate)} ~ {formatDate(pain.recoveredDate || '')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-stone-600 bg-stone-100 px-2 py-0.5 rounded-full">
                        耗時 {totalDays} 天
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPain(pain);
                          setIsTimelineModalOpen(true);
                        }}
                        className="p-1 hover:bg-stone-100 text-stone-500 rounded transition-colors"
                        title="查看歷程"
                      >
                        <History size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <PainFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSave={handleSavePain}
        onDelete={handleDeletePain}
        initialData={selectedPain}
      />

      <PainCheckinModal
        isOpen={isCheckinModalOpen}
        onClose={() => setIsCheckinModalOpen(false)}
        painLog={selectedPain}
        onSaveCheckin={handleSaveCheckin}
      />

      <PainTimelineModal
        isOpen={isTimelineModalOpen}
        onClose={() => setIsTimelineModalOpen(false)}
        painLog={selectedPain}
        onDeleteHistoryEntry={handleDeleteHistoryEntry}
      />
    </div>
  );
}

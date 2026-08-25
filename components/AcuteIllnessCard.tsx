'use client';
import { useState } from 'react';
import {
  Thermometer,
  Plus,
  Clock,
  History,
  CheckCircle2,
  Edit2,
  ChevronDown,
  ChevronUp,
  Pill,
  ShieldCheck,
  Activity
} from 'lucide-react';
import type { IllnessLog, IllnessHistoryEntry, SyncPayload } from '@/lib/types';
import IllnessFormModal from '@/components/forms/IllnessFormModal';
import IllnessCheckinModal from '@/components/forms/IllnessCheckinModal';
import IllnessTimelineModal from '@/components/forms/IllnessTimelineModal';
import {
  getCategoryOption,
  getSeverityOption,
  getIllnessDurationDays,
  formatDate,
  ensureIllnessLogHistory
} from '@/lib/illness';

interface Props {
  data?: IllnessLog[];
  updateData: (payload: SyncPayload) => void;
}

export default function AcuteIllnessCard({ data = [], updateData }: Props) {
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false);
  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false);
  const [selectedIllness, setSelectedIllness] = useState<IllnessLog | null>(null);
  const [showRecovered, setShowRecovered] = useState(false);

  const getLatestEntry = (log: IllnessLog) => {
    const hist = ensureIllnessLogHistory(log);
    return hist[hist.length - 1];
  };

  const activeIllnesses = data
    .filter(log => log.status === 'active')
    .sort((a, b) => {
      const aLatest = getLatestEntry(a);
      const bLatest = getLatestEntry(b);
      const aDate = aLatest?.date || a.startDate || '';
      const bDate = bLatest?.date || b.startDate || '';
      const dateDiff = new Date(bDate).getTime() - new Date(aDate).getTime();
      if (dateDiff !== 0) return dateDiff;
      return (b.lastUpdated || 0) - (a.lastUpdated || 0);
    });

  const recoveredIllnesses = data
    .filter(log => log.status === 'recovered')
    .sort((a, b) => {
      const aDate = a.recoveredDate || a.startDate || '';
      const bDate = b.recoveredDate || b.startDate || '';
      const dateDiff = new Date(bDate).getTime() - new Date(aDate).getTime();
      if (dateDiff !== 0) return dateDiff;
      return (b.lastUpdated || 0) - (a.lastUpdated || 0);
    });

  // 標記康復
  const handleMarkRecovered = (illness: IllnessLog) => {
    const today = new Date().toLocaleDateString('en-CA');
    const existingHistory = ensureIllnessLogHistory(illness);
    const recoveredEntry: IllnessHistoryEntry = {
      id: crypto.randomUUID(),
      date: today,
      symptoms: ['已痊癒'],
      severity: 1,
      temperature: '',
      medicationsTaken: [],
      medicationCourseProgress: '已停藥',
      notes: '已康復結案',
      timestamp: Date.now()
    };

    const newHistory = [...existingHistory, recoveredEntry].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const updatedLogs = data.map(log => {
      if (log.id === illness.id) {
        return {
          ...log,
          status: 'recovered' as const,
          recoveredDate: today,
          symptoms: ['已痊癒'],
          history: newHistory,
          lastUpdated: Date.now()
        };
      }
      return log;
    });

    updateData({ illnessLogs: updatedLogs, clientTimestamp: Date.now() });
  };

  // 儲存/新增病症基本資訊
  const handleSaveIllness = (logData: Partial<IllnessLog>) => {
    let updatedLogs = [...data];
    const existingIndex = updatedLogs.findIndex(l => l.id === logData.id);
    if (existingIndex >= 0) {
      updatedLogs[existingIndex] = {
        ...updatedLogs[existingIndex],
        ...logData
      } as IllnessLog;
    } else {
      updatedLogs.push(logData as IllnessLog);
    }
    updateData({ illnessLogs: updatedLogs, clientTimestamp: Date.now() });
  };

  // 每日打卡更新
  const handleSaveCheckin = (
    illnessId: string,
    entry: IllnessHistoryEntry,
    currentSeverity: number,
    currentSymptoms: string[],
    currentTemperature: string,
    medicationsTaken: string[],
    notes: string
  ) => {
    const updatedLogs = data.map(log => {
      if (log.id === illnessId) {
        const existingHistory = ensureIllnessLogHistory(log);
        const mergedHistory = [...existingHistory.filter(h => h.id !== entry.id), entry].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        const latestEntry = mergedHistory[mergedHistory.length - 1];
        return {
          ...log,
          severity: latestEntry.severity,
          symptoms: latestEntry.symptoms || currentSymptoms,
          temperature: latestEntry.temperature ?? currentTemperature,
          medicationsTaken: latestEntry.medicationsTaken || medicationsTaken,
          notes: latestEntry.notes || notes,
          history: mergedHistory,
          lastUpdated: Date.now()
        };
      }
      return log;
    });
    updateData({ illnessLogs: updatedLogs, clientTimestamp: Date.now() });
  };

  // 刪除紀錄
  const handleDeleteIllness = (id: string) => {
    const updatedLogs = data.map(log => {
      if (log.id === id) {
        return { ...log, status: 'deleted' as const, lastUpdated: Date.now() };
      }
      return log;
    });
    updateData({ illnessLogs: updatedLogs, clientTimestamp: Date.now() });
  };

  // 刪除歷程節點
  const handleDeleteHistoryEntry = (illnessId: string, entryId: string) => {
    const updatedLogs = data.map(log => {
      if (log.id === illnessId) {
        const existingHistory = ensureIllnessLogHistory(log);
        const filteredHistory = existingHistory.filter(h => h.id !== entryId);
        const latestEntry = filteredHistory[filteredHistory.length - 1] || null;

        return {
          ...log,
          severity: latestEntry ? latestEntry.severity : log.severity,
          symptoms: latestEntry ? latestEntry.symptoms : log.symptoms,
          temperature: latestEntry ? latestEntry.temperature : log.temperature,
          medicationsTaken: latestEntry ? latestEntry.medicationsTaken : log.medicationsTaken,
          notes: latestEntry ? latestEntry.notes : log.notes,
          history: filteredHistory,
          lastUpdated: Date.now()
        };
      }
      return log;
    });
    updateData({ illnessLogs: updatedLogs, clientTimestamp: Date.now() });
  };

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-2xs border border-stone-200/80">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-stone-100 rounded-lg text-stone-600">
            <Thermometer size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-stone-800 flex items-center gap-2">
              短期病症
              {activeIllnesses.length > 0 && (
                <span className="text-[11px] font-bold px-1.5 py-0.2 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                  {activeIllnesses.length}
                </span>
              )}
            </h2>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setSelectedIllness(null);
            setIsFormModalOpen(true);
          }}
          className="flex items-center gap-1 text-xs font-bold text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-2.5 py-1.5 rounded-lg transition-colors"
        >
          <Plus size={14} />
          紀錄
        </button>
      </div>

      {/* Active Illnesses List */}
      {activeIllnesses.length === 0 ? (
        <div className="py-4 text-center flex flex-col items-center justify-center gap-1.5 text-stone-400 bg-stone-50/60 rounded-xl border border-dashed border-stone-200">
          <ShieldCheck size={22} className="text-stone-400" />
          <span className="text-xs font-medium text-stone-500">狀態良好</span>
        </div>
      ) : (
        <div className="space-y-3">
          {activeIllnesses.map(illness => {
            const latestEntry = getLatestEntry(illness);
            const displaySeverity = latestEntry ? latestEntry.severity : illness.severity;
            const displaySymptoms = latestEntry?.symptoms?.length ? latestEntry.symptoms : illness.symptoms;
            const displayTemp = latestEntry?.temperature ?? illness.temperature;
            const displayMeds = latestEntry?.medicationsTaken || illness.medicationsTaken || illness.prescribedMedications;
            const sevObj = getSeverityOption(displaySeverity);
            const catObj = getCategoryOption(illness.category);
            const durationDays = getIllnessDurationDays(illness.startDate);

            return (
              <div
                key={illness.id}
                className="bg-[#fafafa] border border-stone-200 rounded-xl p-3.5 flex flex-col gap-2.5 transition-all hover:border-stone-300"
              >
                {/* Top Row: Name, Category, Days, Severity, Temperature */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-stone-800">
                      {illness.name}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${catObj.badgeClass}`}>
                      {catObj.label}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md border bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1">
                      <Clock size={11} />
                      持續 {durationDays} 天
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {displayTemp && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-red-50 text-red-600 border border-red-200 flex items-center gap-0.5">
                        <Thermometer size={10} />
                        {displayTemp}°C
                      </span>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${sevObj.badgeClass}`}>
                      {sevObj.label}
                    </span>
                  </div>
                </div>

                {/* Symptoms tags */}
                {displaySymptoms && displaySymptoms.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {displaySymptoms.map(sym => (
                      <span
                        key={sym}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 font-medium"
                      >
                        {sym}
                      </span>
                    ))}
                  </div>
                )}

                {/* Medication course info */}
                {displayMeds && displayMeds.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap text-xs text-emerald-800 bg-emerald-50/80 px-2 py-1 rounded-lg border border-emerald-100">
                    <Pill size={13} className="text-emerald-600 shrink-0" />
                    <span className="font-medium text-[11px]">
                      {displayMeds.join('、')}
                    </span>
                    {latestEntry?.medicationCourseProgress && (
                      <span className="text-[10px] text-emerald-600 font-bold ml-auto">
                        {latestEntry.medicationCourseProgress}
                      </span>
                    )}
                  </div>
                )}

                {/* Latest notes if any */}
                {latestEntry?.notes && (
                  <p className="text-xs text-stone-500 bg-white border border-stone-100 rounded-md p-1.5 leading-relaxed">
                    {latestEntry.notes}
                  </p>
                )}

                {/* Action Buttons: 打卡, 已康復, 歷程, 編輯 */}
                <div className="flex items-center justify-between pt-2 border-t border-stone-200/60 mt-0.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIllness(illness);
                        setIsCheckinModalOpen(true);
                      }}
                      className="px-2.5 py-1 bg-stone-800 hover:bg-stone-900 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-2xs"
                    >
                      <Activity size={12} />
                      打卡
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMarkRecovered(illness)}
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                    >
                      <CheckCircle2 size={12} />
                      已康復
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIllness(illness);
                        setIsTimelineModalOpen(true);
                      }}
                      className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-md transition-colors flex items-center gap-1 text-xs"
                      title="歷程"
                    >
                      <History size={14} />
                      <span className="text-xs">歷程</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIllness(illness);
                        setIsFormModalOpen(true);
                      }}
                      className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-md transition-colors"
                      title="編輯"
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recovered Section Toggle */}
      {recoveredIllnesses.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-stone-100">
          <button
            type="button"
            onClick={() => setShowRecovered(prev => !prev)}
            className="w-full flex items-center justify-between text-xs text-stone-500 hover:text-stone-700 py-1 transition-colors"
          >
            <span className="font-medium flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-emerald-600" />
              已康復病症 ({recoveredIllnesses.length})
            </span>
            {showRecovered ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showRecovered && (
            <div className="mt-2 space-y-2">
              {recoveredIllnesses.map(illness => {
                const durationDays = getIllnessDurationDays(
                  illness.startDate,
                  illness.recoveredDate
                );
                const catObj = getCategoryOption(illness.category);

                return (
                  <div
                    key={illness.id}
                    className="p-2.5 bg-stone-50/70 border border-stone-200/70 rounded-lg flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-700">
                        {illness.name}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded border ${catObj.badgeClass}`}>
                        {catObj.label}
                      </span>
                      <span className="text-[10px] text-stone-400">
                        {formatDate(illness.startDate)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        {durationDays} 天康復
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedIllness(illness);
                          setIsTimelineModalOpen(true);
                        }}
                        className="text-stone-400 hover:text-stone-600 p-1"
                        title="歷程"
                      >
                        <History size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedIllness(illness);
                          setIsFormModalOpen(true);
                        }}
                        className="text-stone-400 hover:text-stone-600 p-1"
                        title="編輯"
                      >
                        <Edit2 size={13} />
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
      <IllnessFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSave={handleSaveIllness}
        onDelete={handleDeleteIllness}
        initialData={selectedIllness}
      />

      <IllnessCheckinModal
        isOpen={isCheckinModalOpen}
        onClose={() => setIsCheckinModalOpen(false)}
        illnessLog={selectedIllness}
        onSaveCheckin={handleSaveCheckin}
      />

      <IllnessTimelineModal
        isOpen={isTimelineModalOpen}
        onClose={() => setIsTimelineModalOpen(false)}
        illnessLog={selectedIllness}
        onDeleteHistoryEntry={handleDeleteHistoryEntry}
      />
    </div>
  );
}

'use client';
import { useState } from 'react';
import { Activity, Smile, CheckCircle, Sliders, Flame } from 'lucide-react';
import type { PainLog, SyncPayload } from '@/lib/types';
import PainFormModal from '@/components/forms/PainFormModal';

interface Props {
  data?: PainLog[];
  updateData: (payload: SyncPayload) => void;
}

export default function ActivePainsCard({ data = [], updateData }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<PainLog | null>(null);

  const activePains = data.filter(log => log.status === 'active').sort((a, b) => b.lastUpdated - a.lastUpdated);

  const getRelativeTimeStr = (timestamp: number) => {
    const daysAgo = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
    if (daysAgo === 0) return '今天';
    return `${daysAgo} 天前`;
  };

  const getIntensityColor = (intensity: number) => {
    if (intensity <= 3) return 'bg-[#e2e7e1] text-[#6b7767]';
    if (intensity <= 6) return 'bg-[#fef3c7] text-[#d97706]';
    if (intensity <= 8) return 'bg-[#ffedd5] text-[#ea580c]';
    return 'bg-[#fef2f2] text-[#dc2626]';
  };

  const markRecovered = (id: string) => {
    const updatedLogs = data.map(log => {
      if (log.id === id) {
        return { ...log, status: 'recovered' as const, lastUpdated: Date.now() };
      }
      return log;
    });
    updateData({ painLogs: updatedLogs, clientTimestamp: Date.now() });
  };

  const handleSave = (logData: Partial<PainLog>) => {
    let updatedLogs = [...data];
    const existingIndex = updatedLogs.findIndex(l => l.id === logData.id);
    if (existingIndex >= 0) {
      updatedLogs[existingIndex] = { ...updatedLogs[existingIndex], ...logData } as PainLog;
    } else {
      updatedLogs.push(logData as PainLog);
    }
    updateData({ painLogs: updatedLogs, clientTimestamp: Date.now() });
  };

  const openNewModal = () => {
    setEditingLog(null);
    setIsModalOpen(true);
  };

  const openEditModal = (log: PainLog) => {
    setEditingLog(log);
    setIsModalOpen(true);
  };

  return (
    <div className="w-full max-w-md mx-auto mb-8">
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-stone-700 font-bold flex items-center gap-2">
          <Flame size={18} className="text-stone-600" />
          活躍中的疼痛部位
        </h2>
        <button 
          onClick={openNewModal}
          className="text-xs text-stone-500 hover:text-stone-700 font-bold flex items-center gap-1"
        >
          + 記錄疼痛
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {activePains.length === 0 ? (
          <div className="bg-stone-50 rounded-xl py-4 flex items-center justify-center gap-2 text-stone-500 border border-stone-100">
            <Smile size={18} className="text-stone-400" />
            <span className="font-bold text-stone-600 text-sm">無活躍痛點</span>
          </div>
        ) : (
          activePains.map(pain => (
            <div 
              key={pain.id} 
              className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow group"
              onClick={() => openEditModal(pain)}
            >
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-black text-stone-700 text-base">{pain.location}</h3>
                  {pain.trigger && (
                    <span className="text-[11px] font-medium text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">
                      {pain.trigger}
                    </span>
                  )}
                  <span className="text-[10px] text-stone-400 ml-1">
                    更新於 {getRelativeTimeStr(pain.lastUpdated)}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button 
                    onClick={(e) => { e.stopPropagation(); markRecovered(pain.id); }}
                    className="flex items-center gap-1 px-2 py-1 bg-[#e2e7e1] text-[#5b6657] hover:bg-[#d4dbd3] rounded text-[10px] font-bold transition-colors"
                  >
                    <CheckCircle size={12} /> 已康復
                  </button>
                  <span className={`px-2 py-0.5 rounded font-black text-sm flex items-center justify-center min-w-[28px] ${getIntensityColor(pain.intensity)}`}>
                    {pain.intensity}
                  </span>
                </div>
              </div>
              
              {pain.notes && (
                <div className="text-[12px] text-stone-600 bg-stone-50 p-2.5 rounded mt-2">
                  {pain.notes}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <PainFormModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        initialData={editingLog}
      />
    </div>
  );
}

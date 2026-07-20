'use client';
import { X, Activity } from 'lucide-react';
import type { TmySymptomLog } from '@/lib/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  logs: TmySymptomLog[];
}

export default function TmySummaryModal({ isOpen, onClose, logs }: Props) {
  if (!isOpen) return null;

  const activeLogs = logs.filter(l => l.status !== 'deleted').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const PRESET_MEDS_MAP: Record<string, string> = {
    "muscle_relaxant": "肌肉鬆弛劑",
    "painkiller": "止痛藥",
    "anti_inflammatory": "消炎藥"
  };

  const PRESET_SYMPTOMS_MAP: Record<string, string> = {
    "pain_chewing": "咀嚼痛",
    "pain_open": "開口痛",
    "click": "關節喀喀聲",
    "misalignment": "咬合跑位",
    "limited_open": "張口受限",
    "tinnitus": "耳鳴/耳悶",
    "headache": "頭痛/肩頸痛"
  };

  const formatList = (raw: string, map: Record<string, string>) => {
    if (!raw) return '';
    return raw.split(',').map(s => map[s.trim()] || s.trim()).join('、');
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-CA');
      }
    } catch (e) {}
    return dateStr.split('T')[0];
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-[#fcfcfc] w-full sm:w-[400px] sm:rounded-2xl rounded-t-2xl shadow-xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-4 duration-300"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-stone-100 shrink-0">
          <h2 className="text-lg font-bold text-stone-800 flex items-center gap-2">
            顳顎症狀發作摘要
          </h2>
          <button onClick={onClose} className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-500 rounded-full transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-3">
          {activeLogs.length === 0 ? (
             <div className="text-center text-stone-400 py-8 text-sm">目前沒有任何發作紀錄</div>
          ) : (
            activeLogs.map(log => (
              <div key={log.id} className="bg-white border border-stone-200 rounded-lg p-3 shadow-sm flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-stone-700">{formatDate(log.date)}</span>
                </div>
                <div className="text-sm text-stone-600">
                  <span className="font-medium text-stone-500">症狀：</span>{formatList(log.symptoms, PRESET_SYMPTOMS_MAP) || '無'}
                </div>
                {log.medication && (
                  <div className="text-sm text-stone-600">
                    <span className="font-medium text-stone-500">用藥：</span>{formatList(log.medication, PRESET_MEDS_MAP)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

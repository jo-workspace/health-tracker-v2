'use client';
import { X } from 'lucide-react';
import type { AllergyLog } from '@/lib/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  logs: AllergyLog[];
}

const PRESET_MEDS_MAP: Record<string, string> = {
  "antihistamine": "抗組織胺",
  "steroid_cream": "類固醇藥膏"
};

export default function AllergySummaryModal({ isOpen, onClose, logs }: Props) {
  if (!isOpen) return null;

  const activeLogs = logs.filter(l => l.status !== 'deleted').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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

  const getSeverityColor = (val: number) => {
    if (val <= 3) return 'bg-[#e2e7e1] text-[#5b6657]';
    if (val <= 6) return 'bg-[#fef3c7] text-[#d97706]';
    if (val <= 8) return 'bg-[#ffedd5] text-[#ea580c]';
    return 'bg-[#fef2f2] text-[#dc2626]';
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="bg-[#fcfcfc] w-full sm:w-[440px] sm:rounded-2xl rounded-t-2xl shadow-xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-4 duration-300"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-stone-100 shrink-0">
          <h2 className="text-lg font-bold text-stone-800 flex items-center gap-2">
            過敏發作摘要
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
                  <span className={`px-2 py-0.5 rounded font-black text-xs ${getSeverityColor(log.severity)}`}>
                    嚴重度 {log.severity}
                  </span>
                </div>
                <div className="text-sm text-stone-600">
                  <span className="font-medium text-stone-500">部位：</span>{log.locations || '無'}
                </div>
                {log.trigger && (
                  <div className="text-sm text-stone-600">
                    <span className="font-medium text-stone-500">觸發原因：</span>{log.trigger}
                  </div>
                )}
                {log.medication && (
                  <div className="text-sm text-stone-600">
                    <span className="font-medium text-stone-500">用藥：</span>{formatList(log.medication, PRESET_MEDS_MAP)}
                  </div>
                )}
                {log.notes && (
                  <div className="text-sm text-stone-600 whitespace-pre-wrap">
                    <span className="font-medium text-stone-500">備註：</span>{log.notes}
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

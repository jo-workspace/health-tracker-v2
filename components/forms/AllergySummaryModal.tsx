'use client';
import { X, Pencil, Trash2, Moon, Clock } from 'lucide-react';
import type { AllergyLog } from '@/lib/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  logs: AllergyLog[];
  onEdit: (log: AllergyLog) => void;
  onDelete: (id: string) => void;
}

const PRESET_MEDS_MAP: Record<string, string> = {
  "antihistamine": "抗組織胺",
  "steroid_cream": "類固醇藥膏"
};

export default function AllergySummaryModal({ isOpen, onClose, logs, onEdit, onDelete }: Props) {
  if (!isOpen) return null;

  const activeLogs = logs
    .filter(l => l.status !== 'deleted')
    .sort((a, b) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      if (b.time && a.time) return b.time.localeCompare(a.time);
      return (b.lastUpdated || 0) - (a.lastUpdated || 0);
    });

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

  const getSeverityLabel = (val: number) => {
    if (val <= 3) return '輕微';
    if (val <= 6) return '中度';
    if (val <= 8) return '嚴重';
    return '劇烈';
  };

  const SLEEP_IMPACT_LABELS: Record<string, string> = { mild: '輕微', severe: '嚴重' };

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
              <div key={log.id} className="bg-white border border-stone-200 rounded-lg p-3 shadow-xs flex flex-col gap-2">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-stone-800 text-sm">{formatDate(log.date)}</span>
                    {log.timeSlot && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-stone-100 text-stone-700 border border-stone-200">
                        {log.timeSlot}
                      </span>
                    )}
                    {log.time && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-500">
                        <Clock size={12} className="text-stone-400" />
                        {log.time}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`px-2 py-0.5 rounded font-black text-xs ${getSeverityColor(log.severity)}`}>
                      嚴重度 {log.severity}（{getSeverityLabel(log.severity)}）
                    </span>
                    <button
                      type="button"
                      onClick={() => onEdit(log)}
                      className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded transition-colors"
                      title="編輯紀錄"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(log.id)}
                      className="p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="刪除紀錄"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
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
                {log.sleepImpact && log.sleepImpact !== 'none' && (
                  <div className="text-xs text-stone-600 flex items-center gap-1">
                    <Moon size={13} className="text-[#6f7f99]" />
                    <span className="font-medium text-stone-500">影響睡眠：</span>
                    <span>{SLEEP_IMPACT_LABELS[log.sleepImpact]}</span>
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

'use client';
import { createPortal } from 'react-dom';
import { X, History, Calendar, CheckCircle2, Clock, Trash2, Pill, Thermometer } from 'lucide-react';
import type { IllnessLog, IllnessHistoryEntry } from '@/lib/types';
import {
  getSeverityOption,
  getIllnessDurationDays,
  formatDate,
  ensureIllnessLogHistory,
  getCategoryOption
} from '@/lib/illness';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  illnessLog: IllnessLog | null;
  onDeleteHistoryEntry?: (illnessId: string, entryId: string) => void;
}

export default function IllnessTimelineModal({
  isOpen,
  onClose,
  illnessLog,
  onDeleteHistoryEntry
}: Props) {
  if (!isOpen || !illnessLog) return null;

  const history = ensureIllnessLogHistory(illnessLog);
  const startDate = illnessLog.startDate || history[0]?.date || '';
  const isRecovered = illnessLog.status === 'recovered';
  const durationDays = getIllnessDurationDays(
    startDate,
    isRecovered ? illnessLog.recoveredDate : undefined
  );
  const catConfig = getCategoryOption(illnessLog.category);

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className="absolute bottom-0 left-0 w-full sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-[460px] bg-[#fcfcfc] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-full duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-stone-100 shrink-0">
          <div className="flex items-center gap-2">
            <History size={18} className="text-stone-600" />
            <div>
              <h2 className="text-base font-bold text-stone-800">歷程</h2>
              <span className="text-xs text-stone-500 font-medium">
                {illnessLog.name} ({catConfig.label})
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-500 rounded-full transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Summary Banner */}
        <div className="px-4 py-3 bg-stone-50/90 border-b border-stone-100 flex items-center justify-between text-xs text-stone-600 shrink-0">
          <div className="flex items-center gap-1.5">
            <Calendar size={14} className="text-stone-400" />
            <span>起始：{formatDate(startDate)}</span>
          </div>
          <div>
            {isRecovered ? (
              <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                <CheckCircle2 size={12} />
                耗時 {durationDays} 天康復
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                <Clock size={12} />
                持續 {durationDays} 天
              </span>
            )}
          </div>
        </div>

        {/* Timeline list */}
        <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-3">
          {history.length === 0 ? (
            <div className="text-center text-xs text-stone-400 py-8">尚無打卡歷程</div>
          ) : (
            <div className="relative pl-5 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[1.5px] before:bg-stone-200">
              {history.map((entry, idx) => {
                const sevObj = getSeverityOption(entry.severity);
                const isLatest = idx === history.length - 1;
                const entryDay = getIllnessDurationDays(startDate, entry.date);

                return (
                  <div key={entry.id || idx} className="relative group">
                    {/* Dot on timeline line */}
                    <div
                      className={`absolute -left-5 top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                        sevObj.dotClass
                      } ${isLatest ? 'ring-2 ring-stone-300' : ''}`}
                    />

                    <div className="bg-white border border-stone-200 rounded-xl p-3 shadow-2xs flex flex-col gap-2">
                      {/* Entry Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-stone-800">
                            {formatDate(entry.date)}
                          </span>
                          <span className="text-[11px] text-stone-400 font-medium">
                            第 {entryDay} 天
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${sevObj.badgeClass}`}
                          >
                            {sevObj.label}
                          </span>
                          {entry.temperature && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-red-50 text-red-600 border border-red-200 flex items-center gap-0.5">
                              <Thermometer size={10} />
                              {entry.temperature}°C
                            </span>
                          )}
                        </div>

                        {onDeleteHistoryEntry && history.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm('確定要刪除這筆打卡節點嗎？')) {
                                onDeleteHistoryEntry(illnessLog.id, entry.id);
                              }
                            }}
                            className="text-stone-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>

                      {/* Symptoms tags */}
                      {entry.symptoms && entry.symptoms.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {entry.symptoms.map(s => (
                            <span
                              key={s}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 font-medium"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Medications Taken */}
                      {entry.medicationsTaken && entry.medicationsTaken.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-emerald-800 bg-emerald-50/70 px-2 py-1 rounded-md border border-emerald-100">
                          <Pill size={12} className="text-emerald-600 shrink-0" />
                          <span className="font-medium">
                            {entry.medicationsTaken.join('、')}
                          </span>
                          {entry.medicationCourseProgress && (
                            <span className="text-[10px] text-emerald-600 ml-auto">
                              ({entry.medicationCourseProgress})
                            </span>
                          )}
                        </div>
                      )}

                      {/* Notes */}
                      {entry.notes && (
                        <p className="text-xs text-stone-600 bg-stone-50/60 rounded-md p-1.5 font-normal leading-relaxed">
                          {entry.notes}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-stone-100 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg text-xs font-medium transition-colors"
          >
            關閉
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
}

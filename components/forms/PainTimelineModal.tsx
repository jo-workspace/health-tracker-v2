'use client';
import { createPortal } from 'react-dom';
import { X, History, Calendar, CheckCircle2, Clock, Trash2 } from 'lucide-react';
import type { PainLog, PainHistoryEntry } from '@/lib/types';
import { getPainLevel, getDurationDays, formatDate, ensurePainLogHistory } from '@/lib/pain';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  painLog: PainLog | null;
  onDeleteHistoryEntry?: (painId: string, entryId: string) => void;
}

export default function PainTimelineModal({ isOpen, onClose, painLog, onDeleteHistoryEntry }: Props) {
  if (!isOpen || !painLog) return null;

  const history = ensurePainLogHistory(painLog);
  const startDate = painLog.startDate || painLog.date || history[0]?.date || '';
  const isRecovered = painLog.status === 'recovered';
  const durationDays = getDurationDays(startDate, isRecovered ? painLog.recoveredDate : undefined);

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
              <h2 className="text-base font-bold text-stone-800">修復歷程</h2>
              <span className="text-xs text-stone-500 font-medium">{painLog.location}</span>
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

        {/* Summary Card */}
        <div className="px-4 py-3 bg-stone-50/80 border-b border-stone-100 flex items-center justify-between text-xs text-stone-600 shrink-0">
          <div className="flex items-center gap-1.5">
            <Calendar size={14} className="text-stone-400" />
            <span>起始：{formatDate(startDate)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {isRecovered ? (
              <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <CheckCircle2 size={12} />
                耗時 {durationDays} 天康復
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
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
                const lvlObj = getPainLevel(entry.level);
                const isLatest = idx === history.length - 1;

                return (
                  <div key={entry.id || idx} className="relative group">
                    {/* Dot on timeline line */}
                    <div
                      className={`absolute -left-5 top-1 w-2.5 h-2.5 rounded-full border-2 border-white ${
                        lvlObj.dotClass
                      } ${isLatest ? 'ring-2 ring-stone-300' : ''}`}
                    />

                    <div className="bg-white border border-stone-200 rounded-xl p-3 shadow-2xs flex flex-col gap-1.5">
                      {/* Entry Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-stone-700">
                            {formatDate(entry.date)}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${lvlObj.badgeClass}`}
                          >
                            {lvlObj.label}
                          </span>
                        </div>

                        {onDeleteHistoryEntry && history.length > 1 && (
                          <button
                            type="button"
                            onClick={() => onDeleteHistoryEntry(painLog.id, entry.id)}
                            className="text-stone-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                            title="刪除此筆"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>

                      {/* Treatments */}
                      {entry.treatments && entry.treatments.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {entry.treatments.map((t, tIdx) => (
                            <span
                              key={tIdx}
                              className="text-[10px] text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Notes */}
                      {entry.notes && (
                        <p className="text-xs text-stone-600 bg-stone-50/60 p-2 rounded-lg mt-0.5 whitespace-pre-wrap leading-relaxed">
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
            className="w-full py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors"
          >
            關閉
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
}

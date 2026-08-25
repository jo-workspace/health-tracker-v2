'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Activity, Plus, Check } from 'lucide-react';
import type { PainLog, PainHistoryEntry } from '@/lib/types';
import { PAIN_LEVELS, PRESET_TREATMENTS, getPainLevel } from '@/lib/pain';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  painLog: PainLog | null;
  onSaveCheckin: (painId: string, entry: PainHistoryEntry, currentLevel: number, treatments: string[], notes: string) => void;
}

export default function PainCheckinModal({ isOpen, onClose, painLog, onSaveCheckin }: Props) {
  const [date, setDate] = useState('');
  const [selectedLevel, setSelectedLevel] = useState(3);
  const [selectedTreatments, setSelectedTreatments] = useState<string[]>([]);
  const [customTreatment, setCustomTreatment] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen && painLog) {
      setDate(new Date().toLocaleDateString('en-CA'));
      const initialLvl = painLog.level ?? painLog.intensity ?? 3;
      setSelectedLevel(getPainLevel(initialLvl).level);
      setSelectedTreatments(painLog.treatments || []);
      setCustomTreatment('');
      setNotes('');
    }
  }, [isOpen, painLog]);

  if (!isOpen || !painLog) return null;

  const toggleTreatment = (item: string) => {
    setSelectedTreatments(prev =>
      prev.includes(item) ? prev.filter(t => t !== item) : [...prev, item]
    );
  };

  const addCustomTreatment = () => {
    const trimmed = customTreatment.trim();
    if (trimmed && !selectedTreatments.includes(trimmed)) {
      setSelectedTreatments(prev => [...prev, trimmed]);
      setCustomTreatment('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lvlObj = getPainLevel(selectedLevel);
    const newEntry: PainHistoryEntry = {
      id: crypto.randomUUID(),
      date,
      level: selectedLevel,
      levelLabel: lvlObj.label,
      treatments: selectedTreatments,
      notes: notes.trim(),
      timestamp: Date.now()
    };

    onSaveCheckin(painLog.id, newEntry, selectedLevel, selectedTreatments, notes.trim());
    onClose();
  };

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className="absolute bottom-0 left-0 w-full sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-[440px] bg-[#fcfcfc] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-full duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-stone-100 shrink-0">
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-stone-600" />
            <div>
              <h2 className="text-base font-bold text-stone-800">更新狀況</h2>
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

        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto flex-1 flex flex-col gap-4">
          {/* Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-stone-700">記錄日期</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:ring-1 focus:ring-stone-400"
              required
            />
          </div>

          {/* Functional Level Selection */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-stone-700">功能疼痛程度</label>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold border ${getPainLevel(selectedLevel).badgeClass}`}>
                {getPainLevel(selectedLevel).label}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PAIN_LEVELS.map(lvl => {
                const isSelected = selectedLevel === lvl.level;
                return (
                  <button
                    key={lvl.level}
                    type="button"
                    onClick={() => setSelectedLevel(lvl.level)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? `${lvl.badgeClass} ring-1 ring-stone-400 font-bold shadow-xs`
                        : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${lvl.dotClass}`} />
                      <span className="text-xs">{lvl.label}</span>
                    </div>
                    {isSelected && <Check size={14} className="shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Treatments Selection */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-stone-700">今日處置</label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_TREATMENTS.map(item => {
                const active = selectedTreatments.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleTreatment(item)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      active
                        ? 'bg-stone-800 text-white border-stone-800'
                        : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>

            {/* Custom treatment input */}
            <div className="flex gap-1.5 mt-1">
              <input
                type="text"
                value={customTreatment}
                onChange={e => setCustomTreatment(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomTreatment();
                  }
                }}
                placeholder="自訂其他處置..."
                className="flex-1 px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-stone-700 focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
              <button
                type="button"
                onClick={addCustomTreatment}
                className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
              >
                <Plus size={12} /> 加入
              </button>
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-stone-700">今日筆記</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="症狀感受、活動後反應..."
              className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs text-stone-700 focus:outline-none focus:ring-1 focus:ring-stone-400 resize-none h-20"
            />
          </div>

          {/* Submit */}
          <div className="mt-2 pt-3 border-t border-stone-100 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl text-xs font-bold transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-stone-800 hover:bg-stone-900 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              儲存打卡
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  ) : null;
}

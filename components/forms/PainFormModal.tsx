'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Flame, Trash2, Check, Plus } from 'lucide-react';
import type { PainLog, PainHistoryEntry } from '@/lib/types';
import {
  PAIN_LEVELS,
  COMMON_LOCATIONS,
  PRESET_TRIGGERS,
  PRESET_TREATMENTS,
  getPainLevel,
  ensurePainLogHistory
} from '@/lib/pain';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (log: Partial<PainLog>) => void;
  onDelete?: (id: string) => void;
  initialData?: PainLog | null;
}

export default function PainFormModal({ isOpen, onClose, onSave, onDelete, initialData }: Props) {
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [trigger, setTrigger] = useState('');
  const [selectedLevel, setSelectedLevel] = useState(3);
  const [selectedTreatments, setSelectedTreatments] = useState<string[]>([]);
  const [customTreatment, setCustomTreatment] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setLocation(initialData.location || '');
        setStartDate(initialData.startDate || initialData.date || new Date().toLocaleDateString('en-CA'));
        setTrigger(initialData.trigger || '');
        const initialLvl = initialData.level ?? initialData.intensity ?? 3;
        setSelectedLevel(getPainLevel(initialLvl).level);
        setSelectedTreatments(initialData.treatments || []);
        setNotes(initialData.notes || '');
      } else {
        setLocation('');
        setStartDate(new Date().toLocaleDateString('en-CA'));
        setTrigger('');
        setSelectedLevel(3); // 預設跑步痛
        setSelectedTreatments([]);
        setNotes('');
      }
      setCustomTreatment('');
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

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
    if (!location.trim()) return;

    const lvlObj = getPainLevel(selectedLevel);
    const existingHistory = initialData ? ensurePainLogHistory(initialData) : [];

    let history: PainHistoryEntry[];
    if (initialData && existingHistory.length > 0) {
      // 編輯基本資料時更新或保持現有歷程
      history = existingHistory;
    } else {
      // 全新記錄，建立初始歷程節點
      history = [
        {
          id: crypto.randomUUID(),
          date: startDate,
          level: selectedLevel,
          levelLabel: lvlObj.label,
          treatments: selectedTreatments,
          notes: notes.trim(),
          timestamp: Date.now()
        }
      ];
    }

    onSave({
      id: initialData?.id || crypto.randomUUID(),
      date: startDate,
      startDate,
      recoveredDate: initialData?.recoveredDate,
      location: location.trim(),
      trigger: trigger.trim(),
      intensity: selectedLevel,
      level: selectedLevel,
      treatments: selectedTreatments,
      notes: notes.trim(),
      history,
      status: initialData?.status || 'active',
      lastUpdated: Date.now()
    });
    onClose();
  };

  const handleDelete = () => {
    if (!initialData?.id || !onDelete) return;
    if (!window.confirm('確定要刪除這筆疼痛紀錄嗎？此操作無法復原。')) return;
    onDelete(initialData.id);
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
            <Flame size={18} className="text-stone-600" />
            <h2 className="text-base font-bold text-stone-800">
              {initialData ? '編輯疼痛項目' : '記錄新痛點'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-500 rounded-full transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto flex-1 flex flex-col gap-4">
          {/* Location */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-stone-700">部位</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              list="pain-common-locations"
              placeholder="例如：右膝外側、足底筋膜"
              className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:ring-1 focus:ring-stone-400"
              required
            />
            <datalist id="pain-common-locations">
              {COMMON_LOCATIONS.map(loc => (
                <option key={loc} value={loc} />
              ))}
            </datalist>
          </div>

          {/* Start Date */}
          <div className="flex flex-col gap-1.5 min-w-0">
            <label className="text-xs font-bold text-stone-700">發生日期</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-date-and-time-value]:text-left [&::-webkit-date-and-time-value]:min-h-[1.5em] w-full min-w-0 px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:ring-1 focus:ring-stone-400 min-h-[38px]"
              required
            />
          </div>

          {/* Trigger */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-stone-700">誘發活動</label>
            <div className="flex flex-wrap gap-1.5 mb-1">
              {PRESET_TRIGGERS.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTrigger(t)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    trigger === t
                      ? 'bg-stone-800 text-white border-stone-800'
                      : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={trigger}
              onChange={e => setTrigger(e.target.value)}
              placeholder="或輸入其他原因..."
              className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs text-stone-700 focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
          </div>

          {/* Initial Pain Level */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-stone-700">疼痛程度</label>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-bold border ${
                  getPainLevel(selectedLevel).badgeClass
                }`}
              >
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

          {/* Treatments */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-stone-700">採取的處置</label>
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
            <label className="text-xs font-bold text-stone-700">備註</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="疼痛感受、特定受限動作..."
              className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs text-stone-700 focus:outline-none focus:ring-1 focus:ring-stone-400 resize-none h-20"
            />
          </div>

          {/* Buttons */}
          <div className="mt-2 pt-3 border-t border-stone-100 flex gap-2">
            {initialData && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="py-2.5 px-3 bg-white border border-stone-200 hover:border-red-200 hover:bg-red-50 text-stone-500 hover:text-red-600 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1"
              >
                <Trash2 size={14} /> 刪除
              </button>
            )}
            <button
              type="submit"
              className="flex-1 py-2.5 bg-stone-800 hover:bg-stone-900 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              {initialData ? '儲存變更' : '建立痛點紀錄'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  ) : null;
}

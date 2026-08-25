'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Activity, Plus, Check } from 'lucide-react';
import type { IllnessLog, IllnessHistoryEntry } from '@/lib/types';
import {
  SEVERITY_LEVELS,
  getIllnessDurationDays,
  getCategoryOption
} from '@/lib/illness';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  illnessLog: IllnessLog | null;
  onSaveCheckin: (
    illnessId: string,
    entry: IllnessHistoryEntry,
    currentSeverity: number,
    currentSymptoms: string[],
    currentTemperature: string,
    medicationsTaken: string[],
    notes: string
  ) => void;
}

export default function IllnessCheckinModal({ isOpen, onClose, illnessLog, onSaveCheckin }: Props) {
  const [date, setDate] = useState('');
  const [severity, setSeverity] = useState(1);
  const [temperature, setTemperature] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [customSymptom, setCustomSymptom] = useState('');
  const [medsTaken, setMedsTaken] = useState<string[]>([]);
  const [courseDayStr, setCourseDayStr] = useState('');
  const [notes, setNotes] = useState('');

  const catConfig = getCategoryOption(illnessLog?.category);

  useEffect(() => {
    if (isOpen && illnessLog) {
      const today = new Date().toLocaleDateString('en-CA');
      setDate(today);
      setSeverity(illnessLog.severity || 1);
      setTemperature(illnessLog.temperature || '');
      setSymptoms(illnessLog.symptoms || []);
      // 預設將已開立之藥物帶入（若使用者今天只吃特定藥，可自行點擊取消）
      setMedsTaken(illnessLog.medicationsTaken || illnessLog.prescribedMedications || []);
      
      const dayNum = getIllnessDurationDays(illnessLog.startDate, today);
      const total = illnessLog.medicationDaysTotal;
      setCourseDayStr(total ? `第 ${dayNum}/${total} 天` : `第 ${dayNum} 天`);
      setNotes('');
      setCustomSymptom('');
    }
  }, [isOpen, illnessLog]);

  if (!isOpen || !illnessLog) return null;

  const toggleSymptom = (item: string) => {
    setSymptoms(prev =>
      prev.includes(item) ? prev.filter(s => s !== item) : [...prev, item]
    );
  };

  const addCustomSymptom = () => {
    const trimmed = customSymptom.trim();
    if (trimmed && !symptoms.includes(trimmed)) {
      setSymptoms(prev => [...prev, trimmed]);
      setCustomSymptom('');
    }
  };

  const toggleMedTaken = (med: string) => {
    setMedsTaken(prev =>
      prev.includes(med) ? prev.filter(m => m !== med) : [...prev, med]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newEntry: IllnessHistoryEntry = {
      id: crypto.randomUUID(),
      date,
      symptoms,
      severity,
      temperature: temperature.trim(),
      medicationsTaken: medsTaken,
      medicationCourseProgress: courseDayStr.trim(),
      notes: notes.trim(),
      timestamp: Date.now()
    };

    onSaveCheckin(
      illnessLog.id,
      newEntry,
      severity,
      symptoms,
      temperature.trim(),
      medsTaken,
      notes.trim()
    );
    onClose();
  };

  const availableMeds = Array.from(
    new Set([...(illnessLog.prescribedMedications || []), ...(illnessLog.medicationsTaken || [])])
  );

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
              <h2 className="text-base font-bold text-stone-800">打卡</h2>
              <span className="text-xs text-stone-500 font-medium">{illnessLog.name} ({courseDayStr})</span>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto flex-1 flex flex-col gap-4">
          {/* Date & Temperature */}
          <div className="grid grid-cols-2 gap-3">
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
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-stone-700">
                今日體溫 <span className="text-stone-400 font-normal">(選填 °C)</span>
              </label>
              <input
                type="text"
                value={temperature}
                onChange={e => setTemperature(e.target.value)}
                placeholder="例如 37.1"
                className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
            </div>
          </div>

          {/* Severity */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-stone-700">今日嚴重度</label>
            <div className="grid grid-cols-3 gap-2">
              {SEVERITY_LEVELS.map(lvl => {
                const isSelected = severity === lvl.level;
                return (
                  <button
                    key={lvl.level}
                    type="button"
                    onClick={() => setSeverity(lvl.level)}
                    className={`py-2 px-2 rounded-lg text-xs font-medium border flex items-center justify-center gap-1.5 transition-all ${
                      isSelected
                        ? 'bg-stone-800 text-white border-stone-800 shadow-2xs font-bold'
                        : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : lvl.dotClass}`} />
                    {lvl.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Symptoms today */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-stone-700">今日症狀 (點選以更新)</label>
            <div className="flex flex-wrap gap-1.5">
              {catConfig.presetSymptoms.map(item => {
                const isSelected = symptoms.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleSymptom(item)}
                    className={`text-xs px-2.5 py-1 rounded-md border transition-all flex items-center gap-1 ${
                      isSelected
                        ? 'bg-stone-700 text-white border-stone-700 font-bold'
                        : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    {isSelected && <Check size={12} />}
                    {item}
                  </button>
                );
              })}
              {symptoms
                .filter(s => !catConfig.presetSymptoms.includes(s))
                .map(item => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleSymptom(item)}
                    className="text-xs px-2.5 py-1 rounded-md border bg-stone-700 text-white border-stone-700 font-bold flex items-center gap-1"
                  >
                    <Check size={12} />
                    {item}
                  </button>
                ))}
            </div>
            <div className="flex gap-2 mt-1">
              <input
                type="text"
                value={customSymptom}
                onChange={e => setCustomSymptom(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomSymptom();
                  }
                }}
                placeholder="自訂其他症狀..."
                className="flex-1 px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-stone-700 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
              <button
                type="button"
                onClick={addCustomSymptom}
                className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
              >
                <Plus size={14} />
                加入
              </button>
            </div>
          </div>

          {/* Meds taken today */}
          {availableMeds.length > 0 && (
            <div className="flex flex-col gap-1.5 pt-2 border-t border-stone-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-700">今日實際服藥</label>
                <span className="text-[11px] text-stone-400">點選以勾選今日服用項目</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {availableMeds.map(med => {
                  const isTaken = medsTaken.includes(med);
                  return (
                    <button
                      key={med}
                      type="button"
                      onClick={() => toggleMedTaken(med)}
                      className={`text-xs px-2.5 py-1 rounded-md border transition-all flex items-center gap-1 ${
                        isTaken
                          ? 'bg-emerald-700 text-white border-emerald-700 font-bold'
                          : 'bg-stone-50 text-stone-400 border-stone-200 line-through'
                      }`}
                    >
                      {isTaken && <Check size={12} />}
                      {med}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-stone-700">今日感受 / 筆記</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="例如：燒退了，剩乾咳，精神好轉..."
              rows={2}
              className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400 resize-none"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg text-xs font-medium transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-stone-800 hover:bg-stone-900 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
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

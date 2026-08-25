'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Thermometer, Trash2, Plus, Check } from 'lucide-react';
import type { IllnessLog, IllnessCategory, IllnessHistoryEntry } from '@/lib/types';
import {
  ILLNESS_CATEGORIES,
  SEVERITY_LEVELS,
  MEDICAL_CARE_OPTIONS,
  getCategoryOption,
  getSeverityOption,
  ensureIllnessLogHistory
} from '@/lib/illness';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (log: Partial<IllnessLog>) => void;
  onDelete?: (id: string) => void;
  initialData?: IllnessLog | null;
}

export default function IllnessFormModal({ isOpen, onClose, onSave, onDelete, initialData }: Props) {
  const [category, setCategory] = useState<IllnessCategory>('respiratory');
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [severity, setSeverity] = useState(1);
  const [temperature, setTemperature] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [customSymptom, setCustomSymptom] = useState('');
  const [medicalCare, setMedicalCare] = useState<'home' | 'clinic' | 'hospital' | 'other' | ''>('clinic');
  const [prescribedMeds, setPrescribedMeds] = useState<string[]>([]);
  const [customMed, setCustomMed] = useState('');
  const [medicationDaysTotal, setMedicationDaysTotal] = useState<string>('3');
  const [notes, setNotes] = useState('');

  const currentCategoryConfig = getCategoryOption(category);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setCategory(initialData.category || 'respiratory');
        setName(initialData.name || '');
        setStartDate(initialData.startDate || new Date().toLocaleDateString('en-CA'));
        setSeverity(initialData.severity || 1);
        setTemperature(initialData.temperature || '');
        setSymptoms(initialData.symptoms || []);
        setMedicalCare(initialData.medicalCare || 'clinic');
        setPrescribedMeds(initialData.prescribedMedications || []);
        setMedicationDaysTotal(initialData.medicationDaysTotal ? String(initialData.medicationDaysTotal) : '3');
        setNotes(initialData.notes || '');
      } else {
        setCategory('respiratory');
        setName('感冒');
        setStartDate(new Date().toLocaleDateString('en-CA'));
        setSeverity(1);
        setTemperature('');
        setSymptoms(['喉嚨痛', '流鼻水']);
        setMedicalCare('clinic');
        setPrescribedMeds(['診所藥包']);
        setMedicationDaysTotal('3');
        setNotes('');
      }
      setCustomSymptom('');
      setCustomMed('');
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleCategoryChange = (newCat: IllnessCategory) => {
    setCategory(newCat);
    const cfg = getCategoryOption(newCat);
    if (!initialData) {
      if (cfg.presetNames.length > 0) {
        setName(cfg.presetNames[0]);
      }
      if (cfg.presetSymptoms.length > 0) {
        setSymptoms(cfg.presetSymptoms.slice(0, 2));
      } else {
        setSymptoms([]);
      }
      if (cfg.presetMeds.length > 0) {
        setPrescribedMeds([cfg.presetMeds[0]]);
      } else {
        setPrescribedMeds([]);
      }
    }
  };

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

  const toggleMed = (item: string) => {
    setPrescribedMeds(prev =>
      prev.includes(item) ? prev.filter(m => m !== item) : [...prev, item]
    );
  };

  const addCustomMed = () => {
    const trimmed = customMed.trim();
    if (trimmed && !prescribedMeds.includes(trimmed)) {
      setPrescribedMeds(prev => [...prev, trimmed]);
      setCustomMed('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = name.trim();
    if (!finalName) return;

    const existingHistory = initialData ? ensureIllnessLogHistory(initialData) : [];
    let history: IllnessHistoryEntry[];

    if (initialData && existingHistory.length > 0) {
      history = existingHistory;
    } else {
      const daysTotalNum = parseInt(medicationDaysTotal, 10);
      history = [
        {
          id: crypto.randomUUID(),
          date: startDate,
          symptoms,
          severity,
          temperature: temperature.trim(),
          medicationsTaken: prescribedMeds,
          medicationCourseProgress: daysTotalNum ? `第 1/${daysTotalNum} 天` : '第 1 天',
          notes: notes.trim(),
          timestamp: Date.now()
        }
      ];
    }

    onSave({
      id: initialData?.id || crypto.randomUUID(),
      name: finalName,
      category,
      startDate,
      recoveredDate: initialData?.recoveredDate,
      symptoms,
      severity,
      temperature: temperature.trim(),
      medicalCare,
      prescribedMedications: prescribedMeds,
      medicationDaysTotal: medicationDaysTotal ? parseInt(medicationDaysTotal, 10) : undefined,
      medicationsTaken: prescribedMeds,
      notes: notes.trim(),
      history,
      status: initialData?.status || 'active',
      lastUpdated: Date.now()
    });
    onClose();
  };

  const handleDelete = () => {
    if (!initialData?.id || !onDelete) return;
    if (!window.confirm('確定要刪除這筆病症紀錄嗎？此操作無法復原。')) return;
    onDelete(initialData.id);
    onClose();
  };

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className="absolute bottom-0 left-0 w-full sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-[460px] bg-[#fcfcfc] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-full duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-stone-100 shrink-0">
          <div className="flex items-center gap-2">
            <Thermometer size={18} className="text-stone-600" />
            <h2 className="text-base font-bold text-stone-800">
              {initialData ? '編輯病症' : '紀錄新病症'}
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
          {/* 1. Category tabs */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-stone-700">病症類別</label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {ILLNESS_CATEGORIES.map(cat => {
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategoryChange(cat.id)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors text-center ${
                      isSelected
                        ? 'bg-stone-800 text-white border-stone-800 shadow-2xs'
                        : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Illness Name (Presets + Input) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-stone-700">病症名稱</label>
            {currentCategoryConfig.presetNames.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-1">
                {currentCategoryConfig.presetNames.map(pName => {
                  const isSelected = name === pName;
                  return (
                    <button
                      key={pName}
                      type="button"
                      onClick={() => setName(pName)}
                      className={`text-xs px-2.5 py-1 rounded-md border transition-all ${
                        isSelected
                          ? 'bg-stone-700 text-white border-stone-700 font-bold'
                          : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      {pName}
                    </button>
                  );
                })}
              </div>
            )}
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="輸入或選取病症名稱..."
              className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"
              required
            />
          </div>

          {/* 3. Start Date & Temperature */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-stone-700">發病起始日</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:ring-1 focus:ring-stone-400"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-stone-700">
                體溫 <span className="text-stone-400 font-normal">(選填 °C)</span>
              </label>
              <input
                type="text"
                value={temperature}
                onChange={e => setTemperature(e.target.value)}
                placeholder="例如 38.2"
                className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
            </div>
          </div>

          {/* 4. Severity Level */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-stone-700">目前嚴重度</label>
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

          {/* 5. Dynamic Symptoms Tags */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-stone-700">主要症狀 (可複選)</label>
            <div className="flex flex-wrap gap-1.5">
              {currentCategoryConfig.presetSymptoms.map(item => {
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
                .filter(s => !currentCategoryConfig.presetSymptoms.includes(s))
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
            {/* Custom symptom input */}
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

          {/* 6. Medical Care & Prescribed Meds */}
          <div className="flex flex-col gap-2 pt-2 border-t border-stone-100">
            <label className="text-xs font-bold text-stone-700">就醫處置與處方藥物</label>
            <div className="grid grid-cols-4 gap-1.5">
              {MEDICAL_CARE_OPTIONS.map(opt => {
                const isSelected = medicalCare === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setMedicalCare(opt.id)}
                    className={`py-1.5 px-1 rounded-lg text-xs border text-center transition-colors ${
                      isSelected
                        ? 'bg-stone-800 text-white border-stone-800 font-bold'
                        : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Prescribed Meds selection */}
            <div className="flex flex-wrap gap-1.5 mt-1">
              {currentCategoryConfig.presetMeds.map(med => {
                const isSelected = prescribedMeds.includes(med);
                return (
                  <button
                    key={med}
                    type="button"
                    onClick={() => toggleMed(med)}
                    className={`text-xs px-2.5 py-1 rounded-md border transition-all flex items-center gap-1 ${
                      isSelected
                        ? 'bg-stone-700 text-white border-stone-700 font-bold'
                        : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    {isSelected && <Check size={12} />}
                    {med}
                  </button>
                );
              })}
              {prescribedMeds
                .filter(m => !currentCategoryConfig.presetMeds.includes(m))
                .map(med => (
                  <button
                    key={med}
                    type="button"
                    onClick={() => toggleMed(med)}
                    className="text-xs px-2.5 py-1 rounded-md border bg-stone-700 text-white border-stone-700 font-bold flex items-center gap-1"
                  >
                    <Check size={12} />
                    {med}
                  </button>
                ))}
            </div>

            {/* Custom Med input & prescription days */}
            <div className="grid grid-cols-3 gap-2 mt-1">
              <div className="col-span-2 flex gap-1.5">
                <input
                  type="text"
                  value={customMed}
                  onChange={e => setCustomMed(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomMed();
                    }
                  }}
                  placeholder="自訂藥物名稱..."
                  className="flex-1 px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-stone-700 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"
                />
                <button
                  type="button"
                  onClick={addCustomMed}
                  className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-medium shrink-0 transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
              <div>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={medicationDaysTotal}
                  onChange={e => setMedicationDaysTotal(e.target.value)}
                  placeholder="處方天數 (例: 3)"
                  className="w-full px-2 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-stone-700 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"
                />
              </div>
            </div>
          </div>

          {/* 7. Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-stone-700">筆記 / 醫囑備註</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="診所醫囑、特殊禁忌或過敏備註..."
              rows={2}
              className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400 resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-stone-100 mt-2 shrink-0">
            {initialData?.id && onDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium"
              >
                <Trash2 size={15} />
                刪除
              </button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
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
                儲存
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  ) : null;
}

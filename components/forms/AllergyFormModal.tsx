'use client';
import { useState, useEffect } from 'react';
import { X, Sparkles } from 'lucide-react';
import type { AllergyLog } from '@/lib/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (log: Partial<AllergyLog>) => void;
  initialData?: AllergyLog | null;
}

const PRESET_LOCATIONS = ["鼻子", "皮膚", "眼睛"];
const PRESET_TRIGGERS = ["花粉", "灰塵", "食物", "鬆緊帶摩擦", "不明", "其他"];
const PRESET_MEDS = [
  { id: "antihistamine", label: "抗組織胺" },
  { id: "steroid_cream", label: "類固醇藥膏" }
];
const TIME_SLOTS = ["早", "中", "晚", "睡前"];
const SLEEP_IMPACT_OPTIONS: { id: 'none' | 'mild' | 'severe'; label: string }[] = [
  { id: 'none', label: '無' },
  { id: 'mild', label: '輕微' },
  { id: 'severe', label: '嚴重' }
];

const getDefaultTimeSlot = () => {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return '早';
  if (h >= 12 && h < 18) return '中';
  if (h >= 18 && h < 22) return '晚';
  return '睡前';
};

export default function AllergyFormModal({ isOpen, onClose, onSave, initialData }: Props) {
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [timeSlot, setTimeSlot] = useState(getDefaultTimeSlot());
  const [time, setTime] = useState('');
  const [locations, setLocations] = useState<string[]>([]);
  const [severity, setSeverity] = useState(4);
  const [trigger, setTrigger] = useState('');
  const [meds, setMeds] = useState<string[]>([]);
  const [sleepImpact, setSleepImpact] = useState<'none' | 'mild' | 'severe'>('none');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setDate(initialData.date || new Date().toLocaleDateString('en-CA'));
        setTimeSlot(initialData.timeSlot || getDefaultTimeSlot());
        setTime(initialData.time || '');
        setLocations(initialData.locations ? initialData.locations.split(',').map(s => s.trim()).filter(Boolean) : []);
        setSeverity(initialData.severity ?? 4);
        setTrigger(initialData.trigger || '');
        setMeds(initialData.medication ? initialData.medication.split(',').map(s => s.trim()).filter(Boolean) : []);
        setSleepImpact(initialData.sleepImpact || 'none');
        setNotes(initialData.notes || '');
      } else {
        setDate(new Date().toLocaleDateString('en-CA'));
        setTimeSlot(getDefaultTimeSlot());
        setTime('');
        setLocations([]);
        setSeverity(4);
        setTrigger('');
        setMeds([]);
        setSleepImpact('none');
        setNotes('');
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const toggleLocation = (l: string) => {
    setLocations(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]);
  };

  const toggleMed = (m: string) => {
    setMeds(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  };

  const getSeverityColor = (val: number) => {
    if (val <= 3) return 'bg-[#e2e7e1] text-[#5b6657] border-[#c0cfbe]';
    if (val <= 6) return 'bg-[#fef3c7] text-[#d97706] border-[#fde68a]';
    if (val <= 8) return 'bg-[#ffedd5] text-[#ea580c] border-[#fed7aa]';
    return 'bg-[#fef2f2] text-[#dc2626] border-[#fecaca]';
  };

  const getSeverityDesc = (val: number) => {
    if (val <= 3) return '輕微（有點癢/紅，不太影響生活）';
    if (val <= 6) return '中度（明顯不適，需要吃藥緩解）';
    if (val <= 8) return '嚴重（大範圍發作，影響日常活動）';
    return '劇烈（難以忍受，可能需要就醫）';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (locations.length === 0) return;

    onSave({
      id: initialData?.id || crypto.randomUUID(),
      date,
      timeSlot,
      time: time || undefined,
      locations: locations.join(', '),
      severity,
      trigger: trigger.trim() || undefined,
      medication: meds.join(', '),
      sleepImpact,
      notes: notes.trim() || undefined,
      status: 'active',
      lastUpdated: Date.now()
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="bg-[#fcfcfc] w-full sm:w-[440px] sm:rounded-2xl rounded-t-2xl shadow-xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-4 duration-300"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-stone-100 shrink-0">
          <h2 className="text-lg font-bold text-stone-800 flex items-center gap-2">
            <Sparkles size={20} className="text-[#c084a1]" />
            {initialData ? '編輯過敏紀錄' : '紀錄過敏發作'}
          </h2>
          <button type="button" onClick={onClose} className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-500 rounded-full transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1 flex flex-col gap-5">
          {/* 日期與精確時間 */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1.5 min-w-0">
              <label className="text-xs font-bold text-stone-700">發作日期</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-date-and-time-value]:text-left [&::-webkit-date-and-time-value]:min-h-[1.5em] w-full min-w-0 px-2.5 sm:px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:ring-1 focus:ring-stone-400 min-h-[38px]"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5 min-w-0">
              <label className="text-xs font-bold text-stone-700">時間 (選填)</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-date-and-time-value]:text-left [&::-webkit-date-and-time-value]:min-h-[1.5em] w-full min-w-0 px-2.5 sm:px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:ring-1 focus:ring-stone-400 min-h-[38px]"
              />
            </div>
          </div>

          {/* 時段單選膠囊 */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-stone-700">發作時段</label>
            <div className="grid grid-cols-4 gap-2">
              {TIME_SLOTS.map(slot => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setTimeSlot(slot)}
                  className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                    timeSlot === slot
                      ? 'bg-stone-800 text-white border-stone-800 shadow-xs'
                      : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-sm font-bold text-stone-700">部位 (可複選)</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_LOCATIONS.map(l => (
                <button
                  key={l}
                  type="button"
                  onClick={() => toggleLocation(l)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                    locations.includes(l)
                    ? 'bg-[#c084a1] text-white border-[#c084a1]'
                    : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-bold text-stone-700">嚴重度</label>
              <span className={`px-2 py-0.5 rounded-md font-black text-sm border ${getSeverityColor(severity)}`}>
                {severity}
              </span>
            </div>
            <input
              type="range"
              min="1" max="10"
              value={severity}
              onChange={e => setSeverity(Number(e.target.value))}
              className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer mt-2"
            />
            <div className="text-xs font-medium text-stone-500 text-center mt-1">
              {getSeverityDesc(severity)}
            </div>
            <div className="flex justify-between text-[10px] text-stone-400 font-bold px-1 mt-1">
              <span>輕微 (1)</span>
              <span>中度 (5)</span>
              <span>劇烈 (10)</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-sm font-bold text-stone-700">觸發原因</label>
            <div className="flex flex-wrap gap-2 mb-1">
              {PRESET_TRIGGERS.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTrigger(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
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
              className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent text-[15px]"
            />
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-sm font-bold text-stone-700">用藥 (可複選)</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_MEDS.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleMed(m.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                    meds.includes(m.id)
                    ? 'bg-stone-700 text-white border-stone-700'
                    : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-sm font-bold text-stone-700">是否影響睡眠</label>
            <div className="flex flex-wrap gap-2">
              {SLEEP_IMPACT_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSleepImpact(opt.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                    sleepImpact === opt.id
                    ? 'bg-[#6f7f99] text-white border-[#6f7f99]'
                    : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-stone-700">詳細備註 (選填)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="例如：頭皮/耳朵偏內因性發作，或腰間鬆緊帶接觸型蕁麻疹..."
              className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent text-[15px] resize-none h-20"
            />
          </div>

          <div className="mt-2 pt-4 border-t border-stone-100">
            <button
              type="submit"
              className="w-full py-3.5 bg-[#444] text-white rounded-xl font-bold text-[15px] shadow-sm hover:bg-[#333] transition-colors"
            >
              {initialData ? '儲存變更' : '儲存紀錄'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

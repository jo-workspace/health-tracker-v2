'use client';
import { useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import type { AllergyLog } from '@/lib/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (log: Partial<AllergyLog>) => void;
}

const PRESET_LOCATIONS = ["鼻子", "皮膚", "眼睛"];
const PRESET_TRIGGERS = ["花粉", "灰塵", "食物", "鬆緊帶摩擦", "不明", "其他"];
const PRESET_MEDS = [
  { id: "antihistamine", label: "抗組織胺" },
  { id: "steroid_cream", label: "類固醇藥膏" }
];

export default function AllergyFormModal({ isOpen, onClose, onSave }: Props) {
  const [locations, setLocations] = useState<string[]>([]);
  const [severity, setSeverity] = useState(4);
  const [trigger, setTrigger] = useState('');
  const [meds, setMeds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (locations.length === 0) return;

    onSave({
      id: crypto.randomUUID(),
      date: new Date().toLocaleDateString('en-CA'),
      locations: locations.join(', '),
      severity,
      trigger,
      medication: meds.join(', '),
      notes,
      status: 'active',
      lastUpdated: Date.now()
    });
    setLocations([]);
    setSeverity(4);
    setTrigger('');
    setMeds([]);
    setNotes('');
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
            紀錄過敏發作
          </h2>
          <button onClick={onClose} className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-500 rounded-full transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1 flex flex-col gap-6">
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
              儲存紀錄
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

'use client';
import { useState } from 'react';
import { X, Activity } from 'lucide-react';
import type { TmySymptomLog } from '@/lib/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (log: Partial<TmySymptomLog>) => void;
}

const PRESET_SYMPTOMS = ["關節喀喀聲", "咀嚼無力", "張口受限", "單側疼痛", "雙側疼痛", "肩頸痠痛", "頭痛"];
const PRESET_MEDS = [
  { id: "muscle_relaxant", label: "肌肉鬆弛劑" },
  { id: "painkiller", label: "止痛藥" },
  { id: "anti_inflammatory", label: "消炎藥" }
];

export default function TmySymptomFormModal({ isOpen, onClose, onSave }: Props) {
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [meds, setMeds] = useState<string[]>([]);

  if (!isOpen) return null;

  const toggleSymptom = (s: string) => {
    setSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const toggleMed = (m: string) => {
    setMeds(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: crypto.randomUUID(),
      date: new Date().toLocaleDateString('en-CA'),
      symptoms: symptoms.join(', '),
      medication: meds.join(', '),
      status: 'active',
      lastUpdated: Date.now()
    });
    setSymptoms([]);
    setMeds([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-[#fcfcfc] w-full sm:w-[400px] sm:rounded-2xl rounded-t-2xl shadow-xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-4 duration-300"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-stone-100 shrink-0">
          <h2 className="text-lg font-bold text-stone-800 flex items-center gap-2">
            <Activity size={20} className="text-[#e28e94]" />
            紀錄顳顎症狀發作
          </h2>
          <button onClick={onClose} className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-500 rounded-full transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1 flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <label className="text-sm font-bold text-stone-700">主要症狀 (可複選)</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_SYMPTOMS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSymptom(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                    symptoms.includes(s) 
                    ? 'bg-[#e28e94] text-white border-[#e28e94]' 
                    : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-sm font-bold text-stone-700">服用藥物 (可複選)</label>
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

          <div className="mt-4 pt-4 border-t border-stone-100">
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

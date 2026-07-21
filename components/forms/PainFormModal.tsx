'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Flame } from 'lucide-react';
import type { PainLog } from '@/lib/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (log: Partial<PainLog>) => void;
  initialData?: PainLog | null;
}

const COMMON_LOCATIONS = [
  "右膝外側", "右膝蓋", "左膝蓋", "右踝", "左踝", "足底筋膜",
  "下背部", "右肩膀", "左肩膀", "小腿肌", "右臀肌", "左臀肌"
];

const PRESET_TRIGGERS = ["慢跑", "間歇跑", "重訓", "久坐", "不明", "其他"];

export default function PainFormModal({ isOpen, onClose, onSave, initialData }: Props) {
  const [location, setLocation] = useState('');
  const [trigger, setTrigger] = useState('');
  const [intensity, setIntensity] = useState(4);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setLocation(initialData.location || '');
        setTrigger(initialData.trigger || '');
        setIntensity(initialData.intensity || 4);
        setNotes(initialData.notes || '');
      } else {
        setLocation('');
        setTrigger('');
        setIntensity(4);
        setNotes('');
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!location.trim()) return;

    onSave({
      id: initialData?.id || crypto.randomUUID(),
      date: initialData?.date || new Date().toLocaleDateString('en-CA'),
      location,
      trigger,
      intensity,
      notes,
      status: initialData?.status || 'active',
      lastUpdated: Date.now()
    });
    onClose();
  };

  const getIntensityDesc = (val: number) => {
    if (val <= 3) return '輕微（微酸、緊繃，不影響活動）';
    if (val <= 6) return '中度（有感疼痛，某些動作會受限）';
    if (val <= 8) return '嚴重（持續性疼痛，嚴重影響活動）';
    return '劇烈（無法忍受，需要立刻就醫或休息）';
  };

  const getIntensityColor = (val: number) => {
    if (val <= 3) return 'bg-[#e2e7e1] text-[#5b6657] border-[#c0cfbe]';
    if (val <= 6) return 'bg-[#fef3c7] text-[#d97706] border-[#fde68a]';
    if (val <= 8) return 'bg-[#ffedd5] text-[#ea580c] border-[#fed7aa]';
    return 'bg-[#fef2f2] text-[#dc2626] border-[#fecaca]';
  };

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />
      <div 
        className="absolute bottom-0 left-0 w-full sm:left-1/2 sm:-translate-x-1/2 sm:max-w-[440px] bg-[#fcfcfc] rounded-t-2xl shadow-xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-full duration-300"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-stone-100 shrink-0">
          <h2 className="text-lg font-bold text-stone-800 flex items-center gap-2">
            <Flame size={20} className="text-[#ea580c]" />
            {initialData ? '更新疼痛紀錄' : '新增疼痛紀錄'}
          </h2>
          <button onClick={onClose} className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-500 rounded-full transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1 flex flex-col gap-5">
          
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-stone-700">疼痛部位</label>
            <input 
              type="text" 
              value={location}
              onChange={e => setLocation(e.target.value)}
              list="common-locations"
              placeholder="例如：右膝外側、左腳踝"
              className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent text-[15px]"
              required
            />
            <datalist id="common-locations">
              {COMMON_LOCATIONS.map(loc => <option key={loc} value={loc} />)}
            </datalist>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-bold text-stone-700">疼痛指數</label>
              <span className={`px-2 py-0.5 rounded-md font-black text-sm border ${getIntensityColor(intensity)}`}>
                {intensity}
              </span>
            </div>
            <input 
              type="range" 
              min="1" max="10" 
              value={intensity}
              onChange={e => setIntensity(Number(e.target.value))}
              className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer mt-2"
            />
            <div className="text-xs font-medium text-stone-500 text-center mt-1">
              {getIntensityDesc(intensity)}
            </div>
            <div className="flex justify-between text-[10px] text-stone-400 font-bold px-1 mt-1">
              <span>輕微 (1)</span>
              <span>中度 (5)</span>
              <span>劇烈 (10)</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-stone-700">觸發原因/活動</label>
            <div className="flex flex-wrap gap-2 mb-2">
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

          <div className="flex flex-col gap-2 mb-4">
            <label className="text-sm font-bold text-stone-700">詳細備註 (選填)</label>
            <textarea 
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="疼痛的感覺？服用的藥物？..."
              className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent text-[15px] resize-none h-24"
            />
          </div>

          <div className="mt-auto pt-4 border-t border-stone-100">
            <button 
              type="submit" 
              className="w-full py-3.5 bg-[#444] text-white rounded-xl font-bold text-[15px] shadow-sm hover:bg-[#333] transition-colors"
            >
              儲存紀錄
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  ) : null;
}

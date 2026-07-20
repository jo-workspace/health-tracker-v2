'use client';
import { useState, useEffect } from 'react';
import { X, ClipboardList } from 'lucide-react';
import type { LongTermLog } from '@/lib/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (log: Partial<LongTermLog>) => void;
  initialData?: LongTermLog | null;
}

const COMMON_ITEMS = [
  "乳房腺瘤", "甲狀腺結節", "膽囊小息肉", "顳顎關節", 
  "近視追蹤", "牙科回診", "洗牙", "腹部超音波"
];

export default function LongTermFormModal({ isOpen, onClose, onSave, initialData }: Props) {
  const [itemName, setItemName] = useState('');
  const [date, setDate] = useState('');
  const [hospital, setHospital] = useState('');
  const [doctor, setDoctor] = useState('');
  const [sizeWidth, setSizeWidth] = useState('');
  const [sizeHeight, setSizeHeight] = useState('');
  const [sizeDepth, setSizeDepth] = useState('');
  const [nextCheckupDate, setNextCheckupDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const formatForDateInput = (dateStr?: string, defaultToToday = false) => {
      if (!dateStr) return defaultToToday ? new Date().toLocaleDateString('en-CA') : '';
      try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
      } catch (e) {}
      return dateStr.substring(0, 10).replace(/\//g, '-');
    };

    if (isOpen) {
      if (initialData) {
        setItemName(initialData.itemName || '');
        setDate(formatForDateInput(initialData.date, true));
        setHospital(initialData.hospital || '');
        setDoctor(initialData.doctor || '');
        setSizeWidth(initialData.sizeWidth || '');
        setSizeHeight(initialData.sizeHeight || '');
        setSizeDepth(initialData.sizeDepth || '');
        setNextCheckupDate(formatForDateInput(initialData.nextCheckupDate, false));
        setNotes(initialData.notes || '');
      } else {
        setItemName('');
        setDate(new Date().toLocaleDateString('en-CA'));
        setHospital('');
        setDoctor('');
        setSizeWidth('');
        setSizeHeight('');
        setSizeDepth('');
        setNextCheckupDate('');
        setNotes('');
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !date.trim()) return;

    onSave({
      id: initialData?.id || crypto.randomUUID(),
      itemName,
      date,
      hospital,
      doctor,
      sizeWidth,
      sizeHeight,
      sizeDepth,
      nextCheckupDate,
      notes,
      status: initialData?.status || 'active',
      lastUpdated: Date.now()
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-[#fcfcfc] w-full sm:w-[480px] sm:rounded-2xl rounded-t-2xl shadow-xl flex flex-col max-h-[95vh] animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-4 duration-300"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-stone-100 shrink-0">
          <h2 className="text-lg font-bold text-stone-800 flex items-center gap-2">
            <ClipboardList size={20} className="text-stone-600" />
            {initialData ? '更新追蹤項目' : '新增長期健康追蹤'}
          </h2>
          <button onClick={onClose} className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-500 rounded-full transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1 flex flex-col gap-5">
          
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2 col-span-2">
              <label className="text-sm font-bold text-stone-700">追蹤項目名稱</label>
              <input 
                type="text" 
                value={itemName}
                onChange={e => setItemName(e.target.value)}
                list="common-lt-items"
                placeholder="例如：乳房腺瘤"
                className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent text-[15px]"
                required
              />
              <datalist id="common-lt-items">
                {COMMON_ITEMS.map(item => <option key={item} value={item} />)}
              </datalist>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-stone-700">此次檢查日期</label>
              <input 
                type="date" 
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent text-[15px]"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-stone-700">下次回診日期 (選填)</label>
              <input 
                type="date" 
                value={nextCheckupDate}
                onChange={e => setNextCheckupDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent text-[15px]"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-stone-700">醫院 / 診所 (選填)</label>
              <input 
                type="text" 
                value={hospital}
                onChange={e => setHospital(e.target.value)}
                placeholder="例如：台大醫院"
                className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent text-[15px]"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-stone-700">醫師姓名 (選填)</label>
              <input 
                type="text" 
                value={doctor}
                onChange={e => setDoctor(e.target.value)}
                placeholder="例如：王小明 醫師"
                className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent text-[15px]"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-stone-700">尺寸測量 (選填, mm)</label>
            <div className="grid grid-cols-3 gap-3">
              <input 
                type="number" 
                step="0.1"
                value={sizeWidth}
                onChange={e => setSizeWidth(e.target.value)}
                placeholder="寬 (W)"
                className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent text-[15px]"
              />
              <input 
                type="number" 
                step="0.1"
                value={sizeHeight}
                onChange={e => setSizeHeight(e.target.value)}
                placeholder="高 (H)"
                className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent text-[15px]"
              />
              <input 
                type="number" 
                step="0.1"
                value={sizeDepth}
                onChange={e => setSizeDepth(e.target.value)}
                placeholder="深 (D)"
                className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent text-[15px]"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 mb-4">
            <label className="text-sm font-bold text-stone-700">詳細備註 (選填)</label>
            <textarea 
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="醫生的建議？..."
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
    </div>
  );
}

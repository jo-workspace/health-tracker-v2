'use client';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Moon, Wand2, Loader2, Calendar, Check } from 'lucide-react';
import type { SleepLog } from '@/lib/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (log: Partial<SleepLog>) => void;
  initialData?: SleepLog | null;
  defaultDate?: string;
  defaultType?: 'night' | 'nap';
}

const FEELINGS = [
  { id: 'excellent', emoji: '🤩', label: '神清氣爽' },
  { id: 'normal', emoji: '🙂', label: '精神OK' },
  { id: 'tired', emoji: '🥱', label: '昏沉想睡' },
  { id: 'sore', emoji: '🥵', label: '痠痛緊繃' },
  { id: 'poor', emoji: '🤢', label: '疲憊極差' }
];

export default function SleepFormModal({ isOpen, onClose, onSave, initialData, defaultDate, defaultType = 'night' }: Props) {
  const [date, setDate] = useState('');
  const [type, setType] = useState<'night' | 'nap'>('night');
  const [bedTime, setBedTime] = useState('');
  const [wakeTime, setWakeTime] = useState('');
  const [sleepDuration, setSleepDuration] = useState('');
  const [hrv, setHrv] = useState('');
  const [restingHeartRate, setRestingHeartRate] = useState('');
  const [deepSleep, setDeepSleep] = useState('');
  const [remSleep, setRemSleep] = useState('');
  const [stress, setStress] = useState('');
  const [feeling, setFeeling] = useState('normal');
  const [notes, setNotes] = useState('');
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setDate(initialData.date || '');
        setType((initialData.type as 'night' | 'nap') || 'night');
        setBedTime(initialData.bedtime || '');
        setWakeTime(initialData.wakeupTime || '');
        setSleepDuration(initialData.sleepDuration || '');
        setHrv(initialData.hrv || '');
        setRestingHeartRate(initialData.restingHeartRate || '');
        setDeepSleep(initialData.deepSleep || '');
        setRemSleep(initialData.remSleep || '');
        setStress(initialData.stress || '');
        setFeeling(initialData.feeling || 'normal');
        setNotes(initialData.notes || '');
      } else {
        setDate(defaultDate || new Date().toLocaleDateString('en-CA'));
        setType(defaultType);
        setBedTime('');
        setWakeTime('');
        setSleepDuration('');
        setHrv('');
        setRestingHeartRate('');
        setDeepSleep('');
        setRemSleep('');
        setStress('');
        setFeeling('normal');
        setNotes('');
      }
    }
  }, [isOpen, initialData, defaultDate]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = event.target?.result as string;
        
        try {
          const res = await fetch('/api/analyze-sleep', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              image: base64Data,
              mimeType: file.type 
            })
          });

          if (!res.ok) throw new Error('API request failed');
          
          const data = await res.json();
          
          if (data.bedTime) setBedTime(data.bedTime);
          if (data.wakeTime) setWakeTime(data.wakeTime);
          if (data.totalSleep) setSleepDuration(String(data.totalSleep));
          if (data.deepSleep) setDeepSleep(String(data.deepSleep));
          if (data.remSleep) setRemSleep(String(data.remSleep));
          if (data.hrv) setHrv(String(data.hrv));
          if (data.restingHeartRate) setRestingHeartRate(String(data.restingHeartRate));
          if (data.stress) setStress(String(data.stress));
          
        } catch (error) {
          console.error('Error analyzing image:', error);
          alert('解析截圖失敗，請稍後再試。');
        } finally {
          setIsAnalyzing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error(error);
      setIsAnalyzing(false);
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: initialData?.id || crypto.randomUUID(),
      date,
      type,
      bedtime: bedTime,
      wakeupTime: wakeTime,
      sleepDuration,
      hrv,
      restingHeartRate,
      deepSleep,
      remSleep,
      stress,
      feeling,
      notes,
      status: 'active',
      lastUpdated: Date.now().toString()
    });
    onClose();
  };

  if (!isOpen) return null;

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />
      <div 
        className="absolute bottom-0 left-0 w-full sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-[420px] bg-[#fcfcfc] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-full duration-300 overflow-x-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-stone-100 shrink-0 bg-white sm:rounded-t-2xl rounded-t-2xl">
          <h2 className="text-lg font-bold text-stone-800 flex items-center gap-2">
            <Moon size={20} className="text-stone-600" />
            {initialData ? '編輯紀錄' : '新增紀錄'}
          </h2>
          
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isAnalyzing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f0ecfc] hover:bg-[#e4dcf9] text-[#7148e5] text-xs font-bold rounded-full transition-colors"
            >
              {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              {isAnalyzing ? '解析中...' : 'AI 截圖解析'}
            </button>
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
            
            <button onClick={onClose} className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-500 rounded-full transition-colors ml-1">
              <X size={18} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto w-full flex-1 flex flex-col gap-4 overflow-x-hidden">
          {/* 紀錄類型 */}
          <div className="flex bg-stone-100 p-1 rounded-lg">
            <button 
              type="button" 
              onClick={() => setType('night')}
              className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-colors ${type === 'night' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500 hover:text-stone-700'}`}
            >
              🌙 主睡眠
            </button>
            <button 
              type="button" 
              onClick={() => setType('nap')}
              className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-colors ${type === 'nap' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500 hover:text-stone-700'}`}
            >
              💤 小睡
            </button>
          </div>

          {/* 日期與時間 */}
          {type === 'night' ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-[5fr_3fr] gap-2">
                <div className="flex flex-col gap-1 min-w-0">
                  <label className="text-[11px] font-bold text-stone-500">起床日期</label>
                  <input 
                    type="date" 
                    value={date} 
                    onChange={e => setDate(e.target.value)}
                    className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-date-and-time-value]:text-left w-full min-w-0 p-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400"
                    required 
                  />
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <label className="text-[11px] font-bold text-stone-500">睡眠時數</label>
                  <div className="relative">
                    <input 
                      type="text" inputMode="decimal"
                      value={sleepDuration} 
                      onChange={e => setSleepDuration(e.target.value)}
                      className="w-full min-w-0 p-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400" 
                      placeholder="6.5"
                      required
                    />
                    <span className="absolute right-2 top-2 text-sm text-stone-400">h</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1 min-w-0">
                  <label className="text-[11px] font-bold text-stone-500">上床時間</label>
                  <input 
                    type="time" 
                    value={bedTime} 
                    onChange={e => setBedTime(e.target.value)}
                    className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-date-and-time-value]:text-left w-full min-w-0 p-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400"
                  />
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <label className="text-[11px] font-bold text-stone-500">起床時間</label>
                  <input 
                    type="time" 
                    value={wakeTime} 
                    onChange={e => setWakeTime(e.target.value)}
                    className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-date-and-time-value]:text-left w-full min-w-0 p-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-[5fr_3fr] gap-2">
              <div className="flex flex-col gap-1 min-w-0">
                <label className="text-[11px] font-bold text-stone-500">小睡日期</label>
                <input 
                  type="date" 
                  value={date} 
                  onChange={e => setDate(e.target.value)}
                  className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-date-and-time-value]:text-left w-full min-w-0 p-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400"
                  required 
                />
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <label className="text-[11px] font-bold text-stone-500">小睡 (分鐘)</label>
                <div className="relative">
                  <input 
                    type="text" inputMode="decimal"
                    value={sleepDuration ? Math.round(Number(sleepDuration) * 60) : ''} 
                    onChange={e => {
                      const mins = e.target.value;
                      setSleepDuration(mins ? String(+(Number(mins) / 60).toFixed(2)) : '');
                    }}
                    className="w-full min-w-0 p-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400" 
                    placeholder="30"
                    required
                  />
                  <span className="absolute right-2 top-2 text-xs text-stone-400">min</span>
                </div>
              </div>
            </div>
          )}

          {/* 心率與壓力資料 */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-stone-100">
            <div className="flex flex-col gap-1 min-w-0">
              <label className="text-[10px] font-bold text-stone-500 whitespace-nowrap overflow-hidden text-ellipsis">HRV(ms)</label>
              <input 
                type="text" inputMode="decimal"
                value={hrv} 
                onChange={e => setHrv(e.target.value)}
                className="w-full min-w-0 p-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400"
              />
            </div>
            <div className="flex flex-col gap-1 min-w-0">
              <label className="text-[10px] font-bold text-stone-500 whitespace-nowrap overflow-hidden text-ellipsis">心率(bpm)</label>
              <input 
                type="text" inputMode="decimal"
                value={restingHeartRate} 
                onChange={e => setRestingHeartRate(e.target.value)}
                className="w-full min-w-0 p-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400"
              />
            </div>
            <div className="flex flex-col gap-1 min-w-0">
              <label className="text-[10px] font-bold text-stone-500 whitespace-nowrap overflow-hidden text-ellipsis">壓力分數</label>
              <input 
                type="text" inputMode="decimal"
                value={stress} 
                onChange={e => setStress(e.target.value)}
                className="w-full min-w-0 p-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400"
              />
            </div>
          </div>

          {/* 睡眠階段 */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1 min-w-0">
              <label className="text-[10px] font-bold text-stone-500">深層睡眠 (h)</label>
              <input 
                type="text" inputMode="decimal"
                value={deepSleep} 
                onChange={e => setDeepSleep(e.target.value)}
                className="w-full min-w-0 p-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400"
              />
            </div>
            <div className="flex flex-col gap-1 min-w-0">
              <label className="text-[10px] font-bold text-stone-500">REM (h)</label>
              <input 
                type="text" inputMode="decimal"
                value={remSleep} 
                onChange={e => setRemSleep(e.target.value)}
                className="w-full min-w-0 p-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400"
              />
            </div>
          </div>

          {/* 醒來感受 */}
          <div className="flex flex-col gap-1.5 pt-3 border-t border-stone-100">
            <label className="text-xs font-bold text-stone-500">醒來感受</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setFeeling('great')} className={`flex-1 py-1.5 rounded-lg border text-sm transition-colors ${feeling === 'great' ? 'bg-[#f0ecfc] border-[#d8ccf5] text-[#7148e5] font-bold' : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'}`}>很好</button>
              <button type="button" onClick={() => setFeeling('normal')} className={`flex-1 py-1.5 rounded-lg border text-sm transition-colors ${feeling === 'normal' ? 'bg-[#f0ecfc] border-[#d8ccf5] text-[#7148e5] font-bold' : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'}`}>普通</button>
              <button type="button" onClick={() => setFeeling('bad')} className={`flex-1 py-1.5 rounded-lg border text-sm transition-colors ${feeling === 'bad' ? 'bg-[#f0ecfc] border-[#d8ccf5] text-[#7148e5] font-bold' : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'}`}>差</button>
            </div>
          </div>

          {/* 備註 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-stone-500">備註</label>
            <textarea 
              value={notes} 
              onChange={e => setNotes(e.target.value)}
              className="w-full p-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400 min-h-[60px]"
              placeholder="例如：睡前喝了酒、太熱醒來..."
            />
          </div>
          
          <button 
            type="submit" 
            className="w-full py-2.5 mt-1 bg-[#7148e5] hover:bg-[#5b36c2] text-white font-bold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            <Check size={18} />
            {initialData ? '更新紀錄' : '儲存紀錄'}
          </button>
        </form>
      </div>
    </div>,
    document.body
  ) : null;
}

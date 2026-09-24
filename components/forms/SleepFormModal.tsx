'use client';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Moon, Check, Laugh, Smile, Frown, Pill } from 'lucide-react';
import type { SleepLog, BiteSplintLog, SupplementLog } from '@/lib/types';

const getPrevDateStr = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - 1);
  return date.toLocaleDateString('en-CA');
};

const parseDurationToHoursAndMinutes = (dur: string) => {
  if (!dur || isNaN(Number(dur))) return { hours: '', mins: '' };
  const total = Number(dur);
  const h = Math.floor(total);
  const m = Math.round((total - h) * 60);
  return {
    hours: h > 0 || m > 0 ? String(h) : '',
    mins: m > 0 ? String(m) : ''
  };
};

const ToothIcon = ({ size = 14 }: { size?: number }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M7 3C4.23858 3 2 5.23858 2 8C2 10.5 3.5 12.5 5.5 13.5V19C5.5 20.1046 6.39543 21 7.5 21H8.5C9.60457 21 10.5 20.1046 10.5 19V14H13.5V19C13.5 20.1046 14.3954 21 15.5 21H16.5C17.6046 21 18.5 20.1046 18.5 19V13.5C20.5 12.5 22 10.5 22 8C22 5.23858 19.7614 3 17 3H7Z" />
  </svg>
);

const FEELING_OPTIONS = [
  { id: 'great', label: '很好', icon: Laugh },
  { id: 'normal', label: '普通', icon: Smile },
  { id: 'bad', label: '差', icon: Frown }
] as const;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (log: Partial<SleepLog>, hasBiteSplint?: boolean, hasBedtimeSupplements?: boolean) => void;
  initialData?: SleepLog | null;
  splintLogs?: BiteSplintLog[];
  supplementLogs?: SupplementLog[];
  sleepLogs?: SleepLog[];
  defaultDate?: string;
  defaultType?: 'night' | 'nap';
}

export default function SleepFormModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  splintLogs = [],
  supplementLogs = [],
  sleepLogs = [],
  defaultDate,
  defaultType = 'night'
}: Props) {
  const [date, setDate] = useState('');
  const [type, setType] = useState<'night' | 'nap'>('night');
  const [bedTime, setBedTime] = useState('');
  const [durationHours, setDurationHours] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [napMinutes, setNapMinutes] = useState('');
  const [feeling, setFeeling] = useState('normal');
  const [hasBiteSplint, setHasBiteSplint] = useState(false);
  const [hasBedtimeSupplements, setHasBedtimeSupplements] = useState(false);

  const bedTimeInputRef = useRef<HTMLInputElement>(null);
  const hoursInputRef = useRef<HTMLInputElement>(null);
  const minutesInputRef = useRef<HTMLInputElement>(null);
  const napMinutesInputRef = useRef<HTMLInputElement>(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      isInitializedRef.current = false;
      return;
    }

    if (isInitializedRef.current) {
      return;
    }

    isInitializedRef.current = true;
    const targetDate = initialData?.date || defaultDate || new Date().toLocaleDateString('en-CA');
    const targetType = (initialData?.type as 'night' | 'nap') || defaultType;
    const prevDate = getPrevDateStr(targetDate);
    const isSplintRecorded = splintLogs.some(
      l => (l.date === prevDate || l.date === targetDate) && l.status !== 'deleted'
    );

    // 檢查前一晚 (入睡時) 或當日是否有服用睡前保健品
    const prevSuppLog = (supplementLogs || []).find(l => l.date === prevDate && l.status !== 'deleted')
      || (supplementLogs || []).find(l => l.date === targetDate && l.status !== 'deleted');
    let isBedtimeRecorded = false;
    if (prevSuppLog && prevSuppLog.items) {
      try {
        const parsed = JSON.parse(prevSuppLog.items);
        if (Array.isArray(parsed)) {
          isBedtimeRecorded = parsed.some((p: any) => 
            p.taken && (p.name?.includes('鎂') || p.name?.toLowerCase().includes('magnesium') || p.time?.includes('睡前'))
          );
        }
      } catch {}
    }

    setDate(targetDate);
    setType(targetType);
    setHasBiteSplint(isSplintRecorded);
    setHasBedtimeSupplements(isBedtimeRecorded);

    if (initialData) {
      setBedTime(initialData.bedtime || '');
      const parsed = parseDurationToHoursAndMinutes(initialData.sleepDuration || '');
      setDurationHours(parsed.hours);
      setDurationMinutes(parsed.mins);
      setNapMinutes(initialData.sleepDuration ? String(Math.round(Number(initialData.sleepDuration) * 60)) : '');
      setFeeling(initialData.feeling || 'normal');
    } else {
      const existingLog = targetType === 'night' 
        ? sleepLogs.find(l => l.date === targetDate && l.type === 'night' && l.status !== 'deleted')
        : null;

      if (existingLog) {
        setBedTime(existingLog.bedtime || '');
        const parsed = parseDurationToHoursAndMinutes(existingLog.sleepDuration || '');
        setDurationHours(parsed.hours);
        setDurationMinutes(parsed.mins);
        setFeeling(existingLog.feeling || 'normal');
      } else {
        setBedTime('');
        setDurationHours('');
        setDurationMinutes('');
        setNapMinutes('');
        setFeeling('normal');
      }
    }
  }, [isOpen, initialData, defaultDate, defaultType, splintLogs, sleepLogs, supplementLogs]);

  // 開啟表單或切換類型時，自動將游標聚焦在核心輸入框 (主睡眠為上床時間，小睡為分鐘數)
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        if (type === 'night') {
          bedTimeInputRef.current?.focus();
          bedTimeInputRef.current?.select();
        } else {
          napMinutesInputRef.current?.focus();
          napMinutesInputRef.current?.select();
        }
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isOpen, type]);

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    if (type === 'night') {
      const matchingLog = sleepLogs.find(l => l.date === newDate && l.type === 'night' && l.status !== 'deleted');
      if (matchingLog) {
        setBedTime(matchingLog.bedtime || '');
        const parsed = parseDurationToHoursAndMinutes(matchingLog.sleepDuration || '');
        setDurationHours(parsed.hours);
        setDurationMinutes(parsed.mins);
        setFeeling(matchingLog.feeling || 'normal');
      } else {
        setBedTime('');
        setDurationHours('');
        setDurationMinutes('');
        setFeeling('normal');
      }
    }
    const prevDate = getPrevDateStr(newDate);
    const isSplintRecorded = splintLogs.some(
      l => (l.date === prevDate || l.date === newDate) && l.status !== 'deleted'
    );
    setHasBiteSplint(isSplintRecorded);

    const prevSuppLog = (supplementLogs || []).find(l => l.date === prevDate && l.status !== 'deleted')
      || (supplementLogs || []).find(l => l.date === newDate && l.status !== 'deleted');
    let isBedtimeRecorded = false;
    if (prevSuppLog && prevSuppLog.items) {
      try {
        const parsed = JSON.parse(prevSuppLog.items);
        if (Array.isArray(parsed)) {
          isBedtimeRecorded = parsed.some((p: any) => 
            p.taken && (p.name?.includes('鎂') || p.name?.toLowerCase().includes('magnesium') || p.time?.includes('睡前'))
          );
        }
      } catch {}
    }
    setHasBedtimeSupplements(isBedtimeRecorded);
  };

  const handleTypeChange = (newType: 'night' | 'nap') => {
    setType(newType);
    if (newType === 'night') {
      const matchingLog = sleepLogs.find(l => l.date === date && l.type === 'night' && l.status !== 'deleted');
      if (matchingLog) {
        setBedTime(matchingLog.bedtime || '');
        const parsed = parseDurationToHoursAndMinutes(matchingLog.sleepDuration || '');
        setDurationHours(parsed.hours);
        setDurationMinutes(parsed.mins);
        setFeeling(matchingLog.feeling || 'normal');
      } else {
        setBedTime('');
        setDurationHours('');
        setDurationMinutes('');
        setFeeling('normal');
      }
      const prevDate = getPrevDateStr(date);
      const isSplintRecorded = splintLogs.some(
        l => (l.date === prevDate || l.date === date) && l.status !== 'deleted'
      );
      setHasBiteSplint(isSplintRecorded);

      const prevSuppLog = (supplementLogs || []).find(l => l.date === prevDate && l.status !== 'deleted')
        || (supplementLogs || []).find(l => l.date === date && l.status !== 'deleted');
      let isBedtimeRecorded = false;
      if (prevSuppLog && prevSuppLog.items) {
        try {
          const parsed = JSON.parse(prevSuppLog.items);
          if (Array.isArray(parsed)) {
            isBedtimeRecorded = parsed.some((p: any) => 
              p.taken && (p.name?.includes('鎂') || p.name?.toLowerCase().includes('magnesium') || p.time?.includes('睡前'))
            );
          }
        } catch {}
      }
      setHasBedtimeSupplements(isBedtimeRecorded);
    } else {
      setNapMinutes('');
    }
  };

  const handleBedTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (!raw) {
      setBedTime('');
      return;
    }

    const digits = raw.replace(/\D/g, '').slice(0, 4);
    if (!digits) {
      setBedTime('');
      return;
    }

    let formatted = digits;
    if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}:${digits.slice(2)}`;
    }
    setBedTime(formatted);

    // 輸入滿 4 碼合法時間 (00:00 - 23:59) 自動跳下一格 (小時)
    if (digits.length === 4) {
      const h = parseInt(digits.slice(0, 2), 10);
      const m = parseInt(digits.slice(2, 4), 10);
      if (h < 24 && m < 60) {
        setTimeout(() => {
          hoursInputRef.current?.focus();
          hoursInputRef.current?.select();
        }, 120);
      }
    }
  };

  const handleBedTimeBlur = () => {
    if (!bedTime) return;
    const digits = bedTime.replace(/\D/g, '');
    if (digits.length === 4) {
      const h = parseInt(digits.slice(0, 2), 10);
      const m = parseInt(digits.slice(2, 4), 10);
      if (h < 24 && m < 60) {
        setBedTime(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    } else if (digits.length === 3) {
      // 3 碼容錯，如 118 -> 01:18, 930 -> 09:30
      const h = parseInt(digits.slice(0, 1), 10);
      const m = parseInt(digits.slice(1, 3), 10);
      if (m < 60) {
        setBedTime(`0${h}:${String(m).padStart(2, '0')}`);
      }
    } else if (digits.length === 1 || digits.length === 2) {
      const h = parseInt(digits, 10);
      if (h < 24) {
        setBedTime(`${String(h).padStart(2, '0')}:00`);
      }
    }
  };

  const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 2);
    setDurationHours(digits);

    if (!digits) return;

    const num = parseInt(digits, 10);
    // 若首碼為 2~9，判定為單碼睡眠小時 (2~9小時)，直接跳至分鐘
    if (/^[2-9]$/.test(digits)) {
      setTimeout(() => {
        minutesInputRef.current?.focus();
        minutesInputRef.current?.select();
      }, 120);
    } else if (digits.length === 2 && num <= 24) {
      setTimeout(() => {
        minutesInputRef.current?.focus();
        minutesInputRef.current?.select();
      }, 120);
    }
  };

  const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 2);
    setDurationMinutes(digits);

    // 分鐘滿 2 碼且合法，自動收起鍵盤
    if (digits.length === 2) {
      const num = parseInt(digits, 10);
      if (num < 60) {
        setTimeout(() => {
          minutesInputRef.current?.blur();
        }, 120);
      }
    }
  };

  const existingLogForSelection = type === 'night'
    ? sleepLogs.find(l => l.date === date && l.type === 'night' && l.status !== 'deleted')
    : (initialData && initialData.date === date && initialData.type === 'nap' ? initialData : null);

  const isEditing = !!existingLogForSelection;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isNap = type === 'nap';

    let finalSleepDuration = '';
    if (isNap) {
      const mins = Number(napMinutes) || 0;
      finalSleepDuration = mins > 0 ? String(+(mins / 60).toFixed(2)) : '';
    } else {
      const h = Number(durationHours) || 0;
      const m = Number(durationMinutes) || 0;
      const totalDur = +(h + m / 60).toFixed(2);
      finalSleepDuration = totalDur > 0 ? String(totalDur) : '';
    }

    onSave({
      id: existingLogForSelection?.id || crypto.randomUUID(),
      date,
      type,
      bedtime: isNap ? '' : bedTime,
      wakeupTime: existingLogForSelection?.wakeupTime || '',
      sleepDuration: finalSleepDuration,
      hrv: existingLogForSelection?.hrv || '',
      restingHeartRate: existingLogForSelection?.restingHeartRate || '',
      deepSleep: existingLogForSelection?.deepSleep || '',
      remSleep: existingLogForSelection?.remSleep || '',
      stress: existingLogForSelection?.stress || '',
      feeling: isNap ? '' : feeling,
      notes: existingLogForSelection?.notes || '',
      status: 'active',
      lastUpdated: Date.now().toString()
    }, isNap ? false : hasBiteSplint, isNap ? false : hasBedtimeSupplements);
    onClose();
  };

  if (!isOpen) return null;

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />
      <div 
        className="absolute bottom-0 left-0 w-full sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-[400px] bg-[#fcfcfc] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-full duration-300 overflow-x-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-stone-100 shrink-0 bg-white sm:rounded-t-2xl rounded-t-2xl">
          <h2 className="text-base font-bold text-stone-800 flex items-center gap-2">
            <Moon size={18} className="text-stone-600" />
            {isEditing ? '編輯睡眠紀錄' : '新增睡眠紀錄'}
          </h2>
          
          <div className="flex items-center gap-1.5">
            {type === 'night' && (
              <>
                <button 
                  type="button" 
                  onClick={() => setHasBedtimeSupplements(!hasBedtimeSupplements)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-full transition-colors ${
                    hasBedtimeSupplements 
                      ? 'bg-[#eaf5ef] text-[#3e7256] font-bold' 
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-500'
                  }`}
                  title="紀錄昨晚是否有吃睡前保健品"
                >
                  <Pill size={13} />
                  <span>睡前保健品</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => setHasBiteSplint(!hasBiteSplint)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-full transition-colors ${
                    hasBiteSplint 
                      ? 'bg-[#e6f0fa] text-[#4a6b82] font-bold' 
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-500'
                  }`}
                  title="紀錄昨晚是否有佩戴咬合板"
                >
                  <ToothIcon size={13} />
                  <span>咬合板</span>
                </button>
              </>
            )}
            
            <button 
              type="button" 
              onClick={onClose} 
              className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-500 rounded-full transition-colors ml-1"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto w-full flex-1 flex flex-col gap-4 overflow-x-hidden">
          {/* 紀錄類型 */}
          <div className="flex bg-stone-100 p-1 rounded-lg">
            <button 
              type="button" 
              onClick={() => handleTypeChange('night')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${type === 'night' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500 hover:text-stone-700'}`}
            >
              主睡眠
            </button>
            <button 
              type="button" 
              onClick={() => handleTypeChange('nap')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${type === 'nap' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500 hover:text-stone-700'}`}
            >
              小睡
            </button>
          </div>

          {type === 'night' ? (
            <>
              {/* 起床日期 */}
              <div className="flex flex-col gap-1 min-w-0">
                <label className="text-[11px] font-bold text-stone-500">起床日期</label>
                <input 
                  type="date" 
                  value={date} 
                  onChange={e => handleDateChange(e.target.value)}
                  className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-date-and-time-value]:text-left w-full min-w-0 p-2.5 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400"
                  required 
                />
              </div>

              {/* 上床時間 */}
              <div className="flex flex-col gap-1 min-w-0">
                <label className="text-[11px] font-bold text-stone-500">上床時間 (24小時制)</label>
                <input 
                  ref={bedTimeInputRef}
                  type="text" 
                  inputMode="numeric"
                  enterKeyHint="next"
                  maxLength={5}
                  value={bedTime} 
                  onChange={handleBedTimeChange}
                  onBlur={handleBedTimeBlur}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      hoursInputRef.current?.focus();
                    }
                  }}
                  placeholder="例 2342 或 0018"
                  className="w-full min-w-0 p-2.5 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400 placeholder:text-stone-300"
                />
              </div>

              {/* 睡眠長度 (小時 / 分鐘) */}
              <div className="flex flex-col gap-1 min-w-0">
                <label className="text-[11px] font-bold text-stone-500">睡眠長度</label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <input 
                      ref={hoursInputRef}
                      type="text" 
                      inputMode="numeric"
                      enterKeyHint="next"
                      maxLength={2}
                      value={durationHours} 
                      onChange={handleHoursChange}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          minutesInputRef.current?.focus();
                        }
                      }}
                      className="w-full min-w-0 p-2.5 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400 pr-11 placeholder:text-stone-300" 
                      placeholder="7"
                      required={!durationMinutes}
                    />
                    <span className="absolute right-2.5 top-2.5 text-xs text-stone-400 pointer-events-none">小時</span>
                  </div>
                  <div className="relative">
                    <input 
                      ref={minutesInputRef}
                      type="text" 
                      inputMode="numeric"
                      enterKeyHint="done"
                      maxLength={2}
                      value={durationMinutes} 
                      onChange={handleMinutesChange}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          minutesInputRef.current?.blur();
                        }
                      }}
                      className="w-full min-w-0 p-2.5 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400 pr-11 placeholder:text-stone-300" 
                      placeholder="30"
                    />
                    <span className="absolute right-2.5 top-2.5 text-xs text-stone-400 pointer-events-none">分鐘</span>
                  </div>
                </div>
              </div>

              {/* 起床感受 */}
              <div className="flex flex-col gap-1.5 pt-2 border-t border-stone-100">
                <label className="text-[11px] font-bold text-stone-500">起床感受</label>
                <div className="grid grid-cols-3 gap-2">
                  {FEELING_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    const isSelected = feeling === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFeeling(opt.id)}
                        className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${
                          isSelected 
                            ? 'bg-[#f0ecfc] border-[#d8ccf5] text-[#7148e5] font-bold shadow-2xs' 
                            : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'
                        }`}
                      >
                        <Icon size={15} />
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-[5fr_3fr] gap-2">
              <div className="flex flex-col gap-1 min-w-0">
                <label className="text-[11px] font-bold text-stone-500">小睡日期</label>
                <input 
                  type="date" 
                  value={date} 
                  onChange={e => handleDateChange(e.target.value)}
                  className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-date-and-time-value]:text-left w-full min-w-0 p-2.5 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400"
                  required 
                />
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <label className="text-[11px] font-bold text-stone-500">小睡 (分鐘)</label>
                <div className="relative">
                  <input 
                    ref={napMinutesInputRef}
                    type="text" 
                    inputMode="numeric"
                    enterKeyHint="done"
                    maxLength={3}
                    value={napMinutes} 
                    onChange={e => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 3);
                      setNapMinutes(digits);
                    }}
                    className="w-full min-w-0 p-2.5 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400 pr-10 placeholder:text-stone-300" 
                    placeholder="30"
                    required
                  />
                  <span className="absolute right-2.5 top-2.5 text-xs text-stone-400 pointer-events-none">分</span>
                </div>
              </div>
            </div>
          )}
          
          <button 
            type="submit" 
            className="w-full py-2.5 mt-2 bg-[#7148e5] hover:bg-[#5b36c2] text-white text-xs font-bold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            <Check size={16} />
            {isEditing ? '更新紀錄' : '儲存紀錄'}
          </button>
        </form>
      </div>
    </div>,
    document.body
  ) : null;
}

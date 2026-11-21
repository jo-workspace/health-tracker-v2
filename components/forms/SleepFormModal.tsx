'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Moon, Check, Laugh, Smile, Frown, Pill, RefreshCw, Watch } from 'lucide-react';
import type { SleepLog, BiteSplintLog, SupplementLog, GarminSleepData } from '@/lib/types';
import { parseBedtimeParts } from '@/lib/sleep';
import { fetchGarminSleep } from '@/lib/api';

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

const parseBedtimeTo12h = (raw?: string): { time: string; period: 'AM' | 'PM' } => {
  if (!raw || !raw.trim()) return { time: '', period: 'PM' };
  const parsed = parseBedtimeParts(raw);
  if (!parsed) return { time: raw.trim(), period: 'PM' };
  return {
    time: `${String(parsed.hour12).padStart(2, '0')}:${String(parsed.minute).padStart(2, '0')}`,
    period: parsed.period
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
  garminSleepMap?: Record<string, GarminSleepData>;
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
  defaultType = 'night',
  garminSleepMap = {}
}: Props) {
  const [date, setDate] = useState('');
  const [type, setType] = useState<'night' | 'nap'>('night');
  const [bedTime, setBedTime] = useState('');
  const [bedTimePeriod, setBedTimePeriod] = useState<'AM' | 'PM'>('PM');
  const [durationHours, setDurationHours] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [napMinutes, setNapMinutes] = useState('');
  const [feeling, setFeeling] = useState('normal');
  const [hasBiteSplint, setHasBiteSplint] = useState(false);
  const [hasBedtimeSupplements, setHasBedtimeSupplements] = useState(false);

  // Garmin objective metrics state
  const [sleepScore, setSleepScore] = useState('');
  const [hrv, setHrv] = useState('');
  const [restingHeartRate, setRestingHeartRate] = useState('');
  const [deepSleep, setDeepSleep] = useState('');
  const [remSleep, setRemSleep] = useState('');
  const [stress, setStress] = useState('');
  const [wakeupTime, setWakeupTime] = useState('');
  const [garminFetching, setGarminFetching] = useState(false);
  const [garminSyncedBadge, setGarminSyncedBadge] = useState(false);

  const bedTimeInputRef = useRef<HTMLInputElement>(null);
  const hoursInputRef = useRef<HTMLInputElement>(null);
  const minutesInputRef = useRef<HTMLInputElement>(null);
  const napMinutesInputRef = useRef<HTMLInputElement>(null);
  const isInitializedRef = useRef(false);

  const applyGarminSleepToFields = useCallback(
    (g: GarminSleepData, overwriteBedtimeAndDuration: boolean) => {
      if (overwriteBedtimeAndDuration) {
        if (g.bedtimeTime) {
          setBedTime(g.bedtimeTime);
          setBedTimePeriod(g.bedtimePeriod);
        }
        if (g.durationHoursPart > 0 || g.durationMinutesPart > 0) {
          setDurationHours(String(g.durationHoursPart));
          setDurationMinutes(g.durationMinutesPart > 0 ? String(g.durationMinutesPart) : '0');
        }
      }
      if (g.sleepScore !== undefined) setSleepScore(String(g.sleepScore));
      if (g.hrv !== undefined) setHrv(String(g.hrv));
      if (g.restingHeartRate !== undefined) setRestingHeartRate(String(g.restingHeartRate));
      if (g.deepSleepHours > 0) setDeepSleep(String(g.deepSleepHours));
      if (g.remSleepHours > 0) setRemSleep(String(g.remSleepHours));
      if (g.sleepStress !== undefined) setStress(String(g.sleepStress));
      if (g.wakeupTime24h) setWakeupTime(g.wakeupTime24h);
      setGarminSyncedBadge(true);
    },
    []
  );

  const loadGarminForDate = useCallback(
    async (targetDate: string, overwriteBedtimeAndDuration: boolean, forceApi = false) => {
      // First check if already in garminSleepMap
      const cached = garminSleepMap[targetDate];
      if (cached && !forceApi) {
        applyGarminSleepToFields(cached, overwriteBedtimeAndDuration);
        return;
      }

      setGarminFetching(true);
      try {
        const res = await fetchGarminSleep(targetDate, forceApi);
        if (res.sleep) {
          applyGarminSleepToFields(res.sleep, overwriteBedtimeAndDuration);
        }
      } catch (err) {
        console.warn('[SleepFormModal] Garmin prefill skipped:', err);
      } finally {
        setGarminFetching(false);
      }
    },
    [garminSleepMap, applyGarminSleepToFields]
  );

  const populateFromExistingOrGarmin = useCallback(
    (targetDate: string, targetType: 'night' | 'nap', existingLog?: SleepLog | null) => {
      setGarminSyncedBadge(false);
      if (existingLog) {
        const parsedBedtime = parseBedtimeTo12h(existingLog.bedtime);
        setBedTime(parsedBedtime.time);
        setBedTimePeriod(parsedBedtime.period);
        const parsed = parseDurationToHoursAndMinutes(existingLog.sleepDuration || '');
        setDurationHours(parsed.hours);
        setDurationMinutes(parsed.mins);
        setNapMinutes(
          existingLog.sleepDuration ? String(Math.round(Number(existingLog.sleepDuration) * 60)) : ''
        );
        setFeeling(existingLog.feeling || 'normal');
        setSleepScore(existingLog.sleepScore || '');
        setHrv(existingLog.hrv || '');
        setRestingHeartRate(existingLog.restingHeartRate || '');
        setDeepSleep(existingLog.deepSleep || '');
        setRemSleep(existingLog.remSleep || '');
        setStress(existingLog.stress || '');
        setWakeupTime(existingLog.wakeupTime || '');

        // If existing log lacks Garmin objective metrics (e.g. sleepScore or hrv), backfill them quietly without overwriting user's manual bedtime/duration
        if (targetType === 'night' && (!existingLog.sleepScore || !existingLog.hrv)) {
          loadGarminForDate(targetDate, false, false);
        }
      } else {
        setBedTime('');
        setBedTimePeriod('PM');
        setDurationHours('');
        setDurationMinutes('');
        setNapMinutes('');
        setFeeling('normal');
        setSleepScore('');
        setHrv('');
        setRestingHeartRate('');
        setDeepSleep('');
        setRemSleep('');
        setStress('');
        setWakeupTime('');

        if (targetType === 'night') {
          loadGarminForDate(targetDate, true, false);
        } else if (targetType === 'nap') {
          const cached = garminSleepMap[targetDate];
          if (cached && cached.napMinutes > 0) {
            setNapMinutes(String(cached.napMinutes));
            setGarminSyncedBadge(true);
          }
        }
      }
    },
    [loadGarminForDate, garminSleepMap]
  );

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

    const prevSuppLog =
      (supplementLogs || []).find(l => l.date === prevDate && l.status !== 'deleted') ||
      (supplementLogs || []).find(l => l.date === targetDate && l.status !== 'deleted');
    let isBedtimeRecorded = false;
    if (prevSuppLog && prevSuppLog.items) {
      try {
        const parsed = JSON.parse(prevSuppLog.items);
        if (Array.isArray(parsed)) {
          isBedtimeRecorded = parsed.some(
            (p: any) =>
              p.taken &&
              (p.name?.includes('鎂') ||
                p.name?.toLowerCase().includes('magnesium') ||
                p.time?.includes('睡前'))
          );
        }
      } catch {}
    }

    setDate(targetDate);
    setType(targetType);
    setHasBiteSplint(isSplintRecorded);
    setHasBedtimeSupplements(isBedtimeRecorded);

    const existingLog =
      initialData ||
      (targetType === 'night'
        ? sleepLogs.find(l => l.date === targetDate && l.type === 'night' && l.status !== 'deleted')
        : null);

    populateFromExistingOrGarmin(targetDate, targetType, existingLog);
  }, [
    isOpen,
    initialData,
    defaultDate,
    defaultType,
    splintLogs,
    sleepLogs,
    supplementLogs,
    populateFromExistingOrGarmin
  ]);

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    const matchingLog =
      type === 'night'
        ? sleepLogs.find(l => l.date === newDate && l.type === 'night' && l.status !== 'deleted')
        : null;
    populateFromExistingOrGarmin(newDate, type, matchingLog);

    const prevDate = getPrevDateStr(newDate);
    const isSplintRecorded = splintLogs.some(
      l => (l.date === prevDate || l.date === newDate) && l.status !== 'deleted'
    );
    setHasBiteSplint(isSplintRecorded);

    const prevSuppLog =
      (supplementLogs || []).find(l => l.date === prevDate && l.status !== 'deleted') ||
      (supplementLogs || []).find(l => l.date === newDate && l.status !== 'deleted');
    let isBedtimeRecorded = false;
    if (prevSuppLog && prevSuppLog.items) {
      try {
        const parsed = JSON.parse(prevSuppLog.items);
        if (Array.isArray(parsed)) {
          isBedtimeRecorded = parsed.some(
            (p: any) =>
              p.taken &&
              (p.name?.includes('鎂') ||
                p.name?.toLowerCase().includes('magnesium') ||
                p.time?.includes('睡前'))
          );
        }
      } catch {}
    }
    setHasBedtimeSupplements(isBedtimeRecorded);
  };

  const handleTypeChange = (newType: 'night' | 'nap') => {
    setType(newType);
    if (newType === 'night') {
      const matchingLog = sleepLogs.find(
        l => l.date === date && l.type === 'night' && l.status !== 'deleted'
      );
      populateFromExistingOrGarmin(date, 'night', matchingLog);

      const prevDate = getPrevDateStr(date);
      const isSplintRecorded = splintLogs.some(
        l => (l.date === prevDate || l.date === date) && l.status !== 'deleted'
      );
      setHasBiteSplint(isSplintRecorded);

      const prevSuppLog =
        (supplementLogs || []).find(l => l.date === prevDate && l.status !== 'deleted') ||
        (supplementLogs || []).find(l => l.date === date && l.status !== 'deleted');
      let isBedtimeRecorded = false;
      if (prevSuppLog && prevSuppLog.items) {
        try {
          const parsed = JSON.parse(prevSuppLog.items);
          if (Array.isArray(parsed)) {
            isBedtimeRecorded = parsed.some(
              (p: any) =>
                p.taken &&
                (p.name?.includes('鎂') ||
                  p.name?.toLowerCase().includes('magnesium') ||
                  p.time?.includes('睡前'))
            );
          }
        } catch {}
      }
      setHasBedtimeSupplements(isBedtimeRecorded);
    } else {
      populateFromExistingOrGarmin(date, 'nap', null);
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

    if (digits.length === 4) {
      const h = parseInt(digits.slice(0, 2), 10);
      const m = parseInt(digits.slice(2, 4), 10);
      if (h >= 13 && h < 24 && m < 60) {
        const h12 = h - 12;
        setBedTime(`${String(h12).padStart(2, '0')}:${digits.slice(2, 4)}`);
        setBedTimePeriod('PM');
        setTimeout(() => {
          hoursInputRef.current?.focus();
          hoursInputRef.current?.select();
        }, 120);
        return;
      } else if (h === 0 && m < 60) {
        setBedTime(`12:${digits.slice(2, 4)}`);
        setBedTimePeriod('AM');
        setTimeout(() => {
          hoursInputRef.current?.focus();
          hoursInputRef.current?.select();
        }, 120);
        return;
      } else if (h >= 1 && h <= 6 && m < 60) {
        setBedTime(`${String(h).padStart(2, '0')}:${digits.slice(2, 4)}`);
        setBedTimePeriod('AM');
        setTimeout(() => {
          hoursInputRef.current?.focus();
          hoursInputRef.current?.select();
        }, 120);
        return;
      }
    }

    let formatted = digits;
    if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}:${digits.slice(2)}`;
    }
    setBedTime(formatted);

    if (digits.length === 4) {
      const h = parseInt(digits.slice(0, 2), 10);
      const m = parseInt(digits.slice(2, 4), 10);
      if (h >= 1 && h <= 12 && m < 60) {
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
      if (h >= 1 && h <= 12 && m < 60) {
        setBedTime(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    } else if (digits.length === 3) {
      const h = parseInt(digits.slice(0, 1), 10);
      const m = parseInt(digits.slice(1, 3), 10);
      if (h >= 1 && h <= 12 && m < 60) {
        setBedTime(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    } else if (digits.length === 1 || digits.length === 2) {
      const h = parseInt(digits, 10);
      if (h >= 1 && h <= 12) {
        setBedTime(`${String(h).padStart(2, '0')}:00`);
      }
    }
  };

  const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 2);
    setDurationHours(digits);

    if (!digits) return;

    const num = parseInt(digits, 10);
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

    if (digits.length === 2) {
      const num = parseInt(digits, 10);
      if (num < 60) {
        setTimeout(() => {
          minutesInputRef.current?.blur();
        }, 120);
      }
    }
  };

  const existingLogForSelection =
    type === 'night'
      ? sleepLogs.find(l => l.date === date && l.type === 'night' && l.status !== 'deleted')
      : initialData && initialData.date === date && initialData.type === 'nap'
      ? initialData
      : null;

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

    const finalBedtime = !isNap && bedTime.trim() ? `${bedTime.trim()} ${bedTimePeriod}` : '';

    onSave(
      {
        ...(existingLogForSelection || {}),
        id: existingLogForSelection?.id || crypto.randomUUID(),
        date,
        type,
        bedtime: finalBedtime,
        fallAsleepTime: finalBedtime,
        wakeupTime: isNap ? '' : wakeupTime || existingLogForSelection?.wakeupTime || '',
        sleepDuration: finalSleepDuration,
        hrv: isNap ? '' : hrv || existingLogForSelection?.hrv || '',
        restingHeartRate:
          isNap ? '' : restingHeartRate || existingLogForSelection?.restingHeartRate || '',
        deepSleep: isNap ? '' : deepSleep || existingLogForSelection?.deepSleep || '',
        remSleep: isNap ? '' : remSleep || existingLogForSelection?.remSleep || '',
        stress: isNap ? '' : stress || existingLogForSelection?.stress || '',
        sleepScore: isNap ? '' : sleepScore || existingLogForSelection?.sleepScore || '',
        feeling: isNap ? '' : feeling,
        notes: existingLogForSelection?.notes || '',
        status: 'active',
        lastUpdated: Date.now().toString()
      },
      isNap ? false : hasBiteSplint,
      isNap ? false : hasBedtimeSupplements
    );
    onClose();
  };

  if (!isOpen) return null;

  const hasGarminMetrics = Boolean(
    sleepScore || hrv || restingHeartRate || deepSleep || remSleep || stress
  );

  return typeof document !== 'undefined'
    ? createPortal(
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

            <form
              onSubmit={handleSubmit}
              className="p-4 overflow-y-auto w-full flex-1 flex flex-col gap-4 overflow-x-hidden"
            >
              {/* 紀錄類型 */}
              <div className="flex bg-stone-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => handleTypeChange('night')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
                    type === 'night'
                      ? 'bg-white shadow-sm text-stone-800'
                      : 'text-stone-500 hover:text-stone-700'
                  }`}
                >
                  主睡眠
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('nap')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
                    type === 'nap'
                      ? 'bg-white shadow-sm text-stone-800'
                      : 'text-stone-500 hover:text-stone-700'
                  }`}
                >
                  小睡
                </button>
              </div>

              {type === 'night' ? (
                <>
                  {/* 起床日期 & Garmin 同步列 */}
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-stone-500">起床日期</label>
                      <button
                        type="button"
                        onClick={() => loadGarminForDate(date, true, true)}
                        disabled={garminFetching}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#52806b] hover:text-[#3e7256] transition-colors disabled:opacity-50"
                      >
                        <RefreshCw size={11} className={garminFetching ? 'animate-spin' : ''} />
                        <span>{garminFetching ? 'Garmin 載入中...' : '同步 Garmin'}</span>
                      </button>
                    </div>
                    <input
                      type="date"
                      value={date}
                      onChange={e => handleDateChange(e.target.value)}
                      className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-date-and-time-value]:text-left w-full min-w-0 p-2.5 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400"
                      required
                    />
                  </div>

                  {/* Garmin 自動帶入之客觀生理指標預覽 */}
                  {(hasGarminMetrics || garminFetching) && (
                    <div className="bg-[#f7faf8] border border-[#dcece3] rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-1.5 text-[11px] text-stone-600">
                      <div className="flex items-center gap-1.5 font-bold text-[#3e7256]">
                        <Watch size={13} />
                        <span>{garminFetching ? '同步手錶數據...' : 'Garmin 數據'}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium">
                        {sleepScore && (
                          <span className="px-1.5 py-0.5 rounded bg-white border border-[#d8ece1] text-[#3e7256] font-bold">
                            {sleepScore} 分
                          </span>
                        )}
                        {hrv && (
                          <span className="px-1.5 py-0.5 rounded bg-white border border-stone-200 text-stone-600">
                            HRV {hrv}
                          </span>
                        )}
                        {restingHeartRate && (
                          <span className="px-1.5 py-0.5 rounded bg-white border border-stone-200 text-stone-600">
                            RHR {restingHeartRate}
                          </span>
                        )}
                        {deepSleep && (
                          <span className="px-1.5 py-0.5 rounded bg-white border border-stone-200 text-stone-500">
                            深眠 {Number(deepSleep).toFixed(1)}h
                          </span>
                        )}
                        {remSleep && (
                          <span className="px-1.5 py-0.5 rounded bg-white border border-stone-200 text-stone-500">
                            REM {Number(remSleep).toFixed(1)}h
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 入睡時間 */}
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-stone-500">
                        入睡時間 (12小時制)
                      </label>
                      {wakeupTime && (
                        <span className="text-[10px] text-stone-400 font-medium">
                          起床 {wakeupTime}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 items-center">
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
                        placeholder="例 10:34 或 11:30"
                        className="flex-1 min-w-0 p-2.5 bg-white border border-stone-200 rounded-lg text-sm text-stone-700 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400 placeholder:text-stone-300"
                      />
                      <div className="flex bg-stone-100 p-1 rounded-lg shrink-0 border border-stone-200/50">
                        <button
                          type="button"
                          onClick={() => setBedTimePeriod('PM')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                            bedTimePeriod === 'PM'
                              ? 'bg-white shadow-xs text-stone-800'
                              : 'text-stone-400 hover:text-stone-600'
                          }`}
                        >
                          PM
                        </button>
                        <button
                          type="button"
                          onClick={() => setBedTimePeriod('AM')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                            bedTimePeriod === 'AM'
                              ? 'bg-white shadow-xs text-stone-800'
                              : 'text-stone-400 hover:text-stone-600'
                          }`}
                        >
                          AM
                        </button>
                      </div>
                    </div>
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
                        <span className="absolute right-2.5 top-2.5 text-xs text-stone-400 pointer-events-none">
                          小時
                        </span>
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
                        <span className="absolute right-2.5 top-2.5 text-xs text-stone-400 pointer-events-none">
                          分鐘
                        </span>
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
                      <span className="absolute right-2.5 top-2.5 text-xs text-stone-400 pointer-events-none">
                        分
                      </span>
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
      )
    : null;
}

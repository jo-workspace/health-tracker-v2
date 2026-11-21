'use client';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Moon, Plus, PenLine, Laugh, Smile, Frown, Coffee, Pill, Watch } from 'lucide-react';
import type {
  SleepLog,
  AllergyLog,
  SupplementLog,
  BiteSplintLog,
  SyncPayload,
  SupplementSetting,
  GarminSleepData,
  GarminRunningActivity,
  GarminMenstrualCycle,
} from '@/lib/types';
import { isBedtimeSupplement, isScheduledDay, PREDEFINED_SUPPLEMENTS } from '@/lib/supplements';
import SleepDetailModal from './SleepDetailModal';
import SleepFormModal from './forms/SleepFormModal';

import { formatTo12Hour, isBefore1030PM } from '@/lib/sleep';

const ToothIcon = ({ size = 13 }: { size?: number }) => (
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

const FEELING_CHOICES = [
  { id: 'great', label: '很好', icon: Laugh, activeColor: 'hover:bg-[#eaf5ef] hover:border-[#b8dfc8] hover:text-[#3e7256]' },
  { id: 'normal', label: '普通', icon: Smile, activeColor: 'hover:bg-stone-100 hover:border-stone-300 hover:text-stone-700' },
  { id: 'bad', label: '差', icon: Frown, activeColor: 'hover:bg-[#f9f1f1] hover:border-[#e6cece] hover:text-[#a06d6e]' },
] as const;

function getHrvStatus(
  hrvVal?: number | string,
  rawStatus?: string
): {
  label: string;
  pillColor: string;
  detail: string;
} | null {
  if (hrvVal === undefined || hrvVal === null || hrvVal === '') return null;
  const num = Number(hrvVal);
  if (isNaN(num) || num <= 0) return null;

  const status = (rawStatus || '').trim().toUpperCase();

  if (status === 'BALANCED') {
    return {
      label: 'HRV 平衡',
      pillColor: 'bg-[#eaf5ef] text-[#3e7256] border-[#d8ece1]',
      detail: `HRV ${num} · 自律神經平衡`,
    };
  }
  if (status === 'UNBALANCED') {
    return {
      label: 'HRV 不平衡',
      pillColor: 'bg-amber-50 text-amber-800 border-amber-200',
      detail: `HRV ${num} · 偏離常態`,
    };
  }
  if (status === 'LOW') {
    return {
      label: 'HRV 偏低',
      pillColor: 'bg-[#fdf2f2] text-[#9b4a4a] border-[#f5d0d0]',
      detail: `HRV ${num} · 疲勞累積需多休息`,
    };
  }
  if (status === 'POOR') {
    return {
      label: 'HRV 不良',
      pillColor: 'bg-[#fdf2f2] text-[#9b4a4a] border-[#f5d0d0]',
      detail: `HRV ${num} · 自律神經顯著低落`,
    };
  }
  if (status === 'NONE') {
    return {
      label: 'HRV 基準建立中',
      pillColor: 'bg-stone-100 text-stone-600 border-stone-200',
      detail: `HRV ${num} · 尚在建立基準線`,
    };
  }

  // 若無 Garmin status，純客觀呈現數值，不作任何主觀好壞推估
  return {
    label: `HRV ${num}`,
    pillColor: 'bg-stone-100 text-stone-600 border-stone-200',
    detail: `HRV ${num}`,
  };
}

function getRecoveryStatusBadges(params: {
  deepHours?: number | string;
  remHours?: number | string;
  rhr?: number | string;
}): {
  items: { text: string; title: string; color: string }[];
} {
  const { deepHours, remHours, rhr } = params;
  const items: { text: string; title: string; color: string }[] = [];

  const d = deepHours !== undefined && deepHours !== '' ? Number(deepHours) : NaN;
  if (!isNaN(d) && d > 0) {
    if (d >= 1.5) {
      items.push({
        text: '深眠充足',
        title: `深層睡眠 ${d.toFixed(1)}h · 肌肉組織修復佳`,
        color: 'text-[#3e7256] font-bold',
      });
    } else if (d >= 1.0) {
      items.push({
        text: '深眠適中',
        title: `深層睡眠 ${d.toFixed(1)}h · 肌肉修復正常`,
        color: 'text-stone-600 font-medium',
      });
    } else {
      items.push({
        text: '深眠偏少',
        title: `深層睡眠 ${d.toFixed(1)}h · 肌肉易感疲倦`,
        color: 'text-amber-700 font-medium',
      });
    }
  }

  const r = remHours !== undefined && remHours !== '' ? Number(remHours) : NaN;
  if (!isNaN(r) && r > 0) {
    if (r >= 1.2) {
      items.push({
        text: '腦力修復佳',
        title: `快速動眼期 REM ${r.toFixed(1)}h · 思緒清晰`,
        color: 'text-[#3e7256] font-bold',
      });
    } else if (r >= 0.8) {
      items.push({
        text: '腦力修復正常',
        title: `快速動眼期 REM ${r.toFixed(1)}h`,
        color: 'text-stone-600 font-medium',
      });
    } else {
      items.push({
        text: 'REM 偏少',
        title: `快速動眼期 REM ${r.toFixed(1)}h · 易感昏沉`,
        color: 'text-stone-400 font-normal',
      });
    }
  }

  const hr = rhr !== undefined && rhr !== '' ? Number(rhr) : NaN;
  if (!isNaN(hr) && hr > 0) {
    if (hr <= 50) {
      items.push({
        text: '心率平穩',
        title: `夜間靜止心率 ${hr} bpm · 心血管恢復極佳`,
        color: 'text-stone-500 font-medium',
      });
    } else if (hr <= 60) {
      items.push({
        text: `靜心 ${hr}`,
        title: `夜間靜止心率 ${hr} bpm`,
        color: 'text-stone-500 font-normal',
      });
    } else {
      items.push({
        text: `靜心偏高 (${hr})`,
        title: `夜間靜止心率 ${hr} bpm · 可能微發炎或代謝活躍`,
        color: 'text-amber-700 font-medium',
      });
    }
  }

  return { items };
}

interface Props {
  data?: SleepLog[];
  allergyLogs?: AllergyLog[];
  supplementLogs?: SupplementLog[];
  supplementSettings?: SupplementSetting[];
  splintLogs?: BiteSplintLog[];
  garminSleepMap?: Record<string, GarminSleepData>;
  runningActivities?: GarminRunningActivity[];
  cycle?: GarminMenstrualCycle | null;
  garminLoading?: boolean;
  updateData: (payload: SyncPayload) => void;
  forceSync?: () => Promise<void>;
  initialSynced?: boolean;
  syncing?: boolean;
}

export default function SleepCard({
  data = [],
  allergyLogs = [],
  supplementLogs = [],
  supplementSettings = [],
  splintLogs = [],
  garminSleepMap = {},
  runningActivities = [],
  cycle = null,
  garminLoading = false,
  updateData,
  forceSync,
  initialSynced = false,
  syncing = false,
}: Props) {
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<SleepLog | null>(null);
  const [defaultDate, setDefaultDate] = useState('');
  const [defaultType, setDefaultType] = useState<'night' | 'nap'>('night');

  const [isAutoPromptOpen, setIsAutoPromptOpen] = useState(false);
  const [promptSplint, setPromptSplint] = useState(false);
  const [promptBedtimeSupp, setPromptBedtimeSupp] = useState(false);

  const [todayStr, setTodayStr] = useState(() => new Date().toLocaleDateString('en-CA'));
  const hasCheckedAutoPromptRef = useRef<string>('');

  const openForm = (dateStr: string, typeVal: 'night' | 'nap', logToEdit?: SleepLog | null) => {
    setEditingLog(logToEdit || null);
    setDefaultDate(dateStr);
    setDefaultType(typeVal);
    setIsFormModalOpen(true);
  };

  const activeLogs = useMemo(() => data.filter(log => log.status !== 'deleted'), [data]);

  const getPrevDateStr = useCallback((dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d - 1);
    return dt.toLocaleDateString('en-CA');
  }, []);

  // 監聽喚醒與跨日，自動更新 todayStr
  useEffect(() => {
    const checkDate = () => {
      const current = new Date().toLocaleDateString('en-CA');
      setTodayStr(prev => (prev !== current ? current : prev));
    };
    window.addEventListener('focus', checkDate);
    document.addEventListener('visibilitychange', checkDate);
    return () => {
      window.removeEventListener('focus', checkDate);
      document.removeEventListener('visibilitychange', checkDate);
    };
  }, []);

  const dismissPrompt = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`dismissed_sleep_prompt_${todayStr}`, 'true');
    }
    setIsAutoPromptOpen(false);
  };

  // 共用儲存處理器（支援 SleepFormModal 與一鍵起床感受彈窗）
  const commitSleepSave = useCallback(
    (
      logData: Partial<SleepLog>,
      hasBiteSplint?: boolean,
      hasBedtimeSupplements?: boolean
    ) => {
      const newLogs = [...data];

      if (logData.type === 'night') {
        const existingIndex = newLogs.findIndex(
          l => l.date === logData.date && l.type === 'night' && l.status !== 'deleted'
        );
        if (existingIndex >= 0) {
          newLogs[existingIndex] = {
            ...newLogs[existingIndex],
            ...logData,
            status: 'active',
            lastUpdated: Date.now().toString(),
          };
        } else {
          newLogs.push({
            ...logData,
            id: logData.id || crypto.randomUUID(),
            status: 'active',
            lastUpdated: Date.now().toString(),
          } as SleepLog);
        }
      } else {
        const existingIndex = logData.id ? newLogs.findIndex(l => l.id === logData.id) : -1;
        if (existingIndex >= 0) {
          newLogs[existingIndex] = {
            ...newLogs[existingIndex],
            ...logData,
            status: 'active',
            lastUpdated: Date.now().toString(),
          };
        } else {
          newLogs.push({
            ...logData,
            id: logData.id || crypto.randomUUID(),
            status: 'active',
            lastUpdated: Date.now().toString(),
          } as SleepLog);
        }
      }

      let updatedSplintLogs = [...splintLogs];
      if (hasBiteSplint !== undefined && logData.date && logData.type === 'night') {
        const prevDate = getPrevDateStr(logData.date);

        const existingSplintIndex = updatedSplintLogs.findIndex(
          l => (l.date === prevDate || l.date === logData.date) && l.status !== 'deleted'
        );
        if (hasBiteSplint) {
          if (existingSplintIndex >= 0) {
            updatedSplintLogs[existingSplintIndex] = {
              ...updatedSplintLogs[existingSplintIndex],
              status: 'active',
              lastUpdated: Date.now(),
            };
          } else {
            updatedSplintLogs.push({
              id: crypto.randomUUID(),
              date: prevDate,
              status: 'active',
              lastUpdated: Date.now(),
            });
          }
        } else {
          updatedSplintLogs = updatedSplintLogs.map(l => {
            if ((l.date === prevDate || l.date === logData.date) && l.status !== 'deleted') {
              return { ...l, status: 'deleted', lastUpdated: Date.now() };
            }
            return l;
          });
        }
      }

      let deltaSuppLogs: any[] | undefined = undefined;
      if (hasBedtimeSupplements !== undefined && logData.date && logData.type === 'night') {
        const prevDate = getPrevDateStr(logData.date);

        const activeSettings =
          supplementSettings && supplementSettings.length > 0
            ? supplementSettings.filter(s => s.status !== 'deleted' && s.status !== 'paused')
            : PREDEFINED_SUPPLEMENTS.filter(s => s.id !== '11').map(s => ({
                ...s,
                targetAmount: '1',
                status: 'active',
              }));

        const bedtimeSettings = activeSettings.filter(s => isBedtimeSupplement(s.time, s.name));

        const existingSuppLog = (supplementLogs || []).find(
          l => (l.date === prevDate || l.date === logData.date) && l.status !== 'deleted'
        );
        const targetDate = existingSuppLog ? existingSuppLog.date : prevDate;

        let currentItems: any[] = [];
        if (existingSuppLog && existingSuppLog.items) {
          try {
            currentItems = JSON.parse(existingSuppLog.items);
          } catch {
            currentItems = [];
          }
        } else {
          const [ty, tm, td] = targetDate.split('-').map(Number);
          const targetDateObj = new Date(ty, tm - 1, td);
          currentItems = activeSettings.map(s => ({
            id: s.id,
            name: s.name === '鎂' ? '甘胺酸鎂' : s.name,
            time: s.time,
            taken: false,
            amount: 0,
            targetAmount: parseInt(s.targetAmount, 10) || 1,
            ignored: !isScheduledDay(s.time, targetDateObj),
          }));
        }

        const updatedItems = currentItems.map(item => {
          if (isBedtimeSupplement(item.time, item.name)) {
            const target = item.targetAmount || 1;
            return {
              ...item,
              taken: hasBedtimeSupplements,
              amount: hasBedtimeSupplements ? target : 0,
              ignored: false,
            };
          }
          return item;
        });

        bedtimeSettings.forEach(b => {
          const bName = b.name === '鎂' ? '甘胺酸鎂' : b.name;
          const exists = updatedItems.some(item => item.id === b.id || item.name === bName);
          if (!exists && hasBedtimeSupplements) {
            const targetAmt = parseInt(b.targetAmount, 10) || 1;
            updatedItems.push({
              id: b.id,
              name: bName,
              time: b.time,
              taken: true,
              amount: targetAmt,
              targetAmount: targetAmt,
              ignored: false,
            });
          }
        });

        const targetId = existingSuppLog ? existingSuppLog.id : `supp-${prevDate}`;

        deltaSuppLogs = [
          {
            id: targetId,
            date: targetDate,
            items: JSON.stringify(updatedItems),
            status: 'active',
            lastUpdated: Date.now().toString(),
          },
        ];
      }

      const syncPayload: SyncPayload = {
        sleepLogs: newLogs,
        biteSplintLogs: updatedSplintLogs,
        clientTimestamp: Date.now(),
      };
      if (deltaSuppLogs) {
        syncPayload.supplementLogs = deltaSuppLogs;
      }

      updateData(syncPayload);
    },
    [data, splintLogs, supplementLogs, supplementSettings, updateData, getPrevDateStr]
  );

  const todayNightLog = useMemo(
    () => activeLogs.find(log => log.date === todayStr && log.type === 'night'),
    [activeLogs, todayStr]
  );
  const todayGarminSleep = garminSleepMap[todayStr];

  // 雲端同步與 Garmin 預載感知之睡眠提醒判斷
  useEffect(() => {
    // 若今日已有主睡眠且「已填寫起床感受 (feeling)」，或明確標記為無紀錄 (sleepDuration === '0')，則視為今日已完成打卡
    const isTodayCompleted = Boolean(
      todayNightLog &&
        (Boolean(todayNightLog.feeling && todayNightLog.feeling.trim()) ||
          todayNightLog.sleepDuration === '0')
    );

    if (isTodayCompleted) {
      setIsAutoPromptOpen(false);
      hasCheckedAutoPromptRef.current = todayStr;
      return;
    }

    // 等待首次 Google Sheets 同步與 Garmin 資料載入完畢後再彈出，確保彈窗能直接顯示 Garmin 昨晚睡眠數據
    if (!initialSynced || syncing || garminLoading) {
      return;
    }

    if (hasCheckedAutoPromptRef.current === todayStr) {
      return;
    }

    const isDismissed =
      typeof window !== 'undefined' &&
      sessionStorage.getItem(`dismissed_sleep_prompt_${todayStr}`);

    if (!isDismissed) {
      // 初始化睡前保健品與咬合板狀態
      const prevDate = getPrevDateStr(todayStr);
      const isSplintRecorded = splintLogs.some(
        l => (l.date === prevDate || l.date === todayStr) && l.status !== 'deleted'
      );
      const prevSuppLog =
        (supplementLogs || []).find(l => l.date === prevDate && l.status !== 'deleted') ||
        (supplementLogs || []).find(l => l.date === todayStr && l.status !== 'deleted');
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
      setPromptSplint(isSplintRecorded);
      setPromptBedtimeSupp(isBedtimeRecorded);
      setIsAutoPromptOpen(true);
    }
    hasCheckedAutoPromptRef.current = todayStr;
  }, [
    todayNightLog,
    todayStr,
    initialSynced,
    syncing,
    garminLoading,
    splintLogs,
    supplementLogs,
    getPrevDateStr,
  ]);

  // 一鍵點選起床感受即完成儲存
  const handleOneTapFeelingSelect = (selectedFeeling: string) => {
    dismissPrompt();

    const g = todayGarminSleep;
    const mergedLog: Partial<SleepLog> = {
      id: todayNightLog?.id || `sleep-garmin-${todayStr}`,
      date: todayStr,
      type: 'night',
      bedtime: todayNightLog?.bedtime || g?.bedtime12h || '',
      fallAsleepTime: todayNightLog?.fallAsleepTime || g?.bedtime12h || '',
      wakeupTime: todayNightLog?.wakeupTime || g?.wakeupTime24h || '',
      sleepDuration:
        todayNightLog?.sleepDuration ||
        (g?.sleepDurationHours ? String(g.sleepDurationHours) : ''),
      deepSleep:
        todayNightLog?.deepSleep || (g?.deepSleepHours ? String(g.deepSleepHours) : ''),
      remSleep: todayNightLog?.remSleep || (g?.remSleepHours ? String(g.remSleepHours) : ''),
      stress:
        todayNightLog?.stress || (g?.sleepStress !== undefined ? String(g.sleepStress) : ''),
      hrv: todayNightLog?.hrv || (g?.hrv !== undefined ? String(g.hrv) : ''),
      restingHeartRate:
        todayNightLog?.restingHeartRate ||
        (g?.restingHeartRate !== undefined ? String(g.restingHeartRate) : ''),
      sleepScore:
        todayNightLog?.sleepScore ||
        (g?.sleepScore !== undefined ? String(g.sleepScore) : ''),
      feeling: selectedFeeling,
      notes: todayNightLog?.notes || '',
      status: 'active',
      lastUpdated: Date.now().toString(),
    };

    commitSleepSave(mergedLog, promptSplint, promptBedtimeSupp);
  };

  const renderFeelingIcon = (key: string) => {
    if (['great', 'excellent', 'good'].includes(key)) {
      return (
        <span title="很好" className="inline-flex items-center">
          <Laugh size={18} className="text-[#3e7256]" />
        </span>
      );
    }
    if (['bad', 'poor', 'tired', 'sore'].includes(key)) {
      return (
        <span title="差" className="inline-flex items-center">
          <Frown size={18} className="text-[#a07d7e]" />
        </span>
      );
    }
    return (
      <span title="普通" className="inline-flex items-center">
        <Smile size={18} className="text-[#5c697b]" />
      </span>
    );
  };

  const sortedNightLogs = activeLogs
    .filter(log => log.type === 'night')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latestNightSleep = sortedNightLogs[0];
  const latestGarminSleep = latestNightSleep
    ? garminSleepMap[latestNightSleep.date]
    : garminSleepMap[todayStr];

  const sleepHours = latestNightSleep
    ? Number(latestNightSleep.sleepDuration)
    : latestGarminSleep?.sleepDurationHours || 0;
  const feelingKey = latestNightSleep?.feeling || 'normal';

  const latestBedtime = latestNightSleep?.bedtime || latestGarminSleep?.bedtime12h;
  const latestSleepScore =
    latestNightSleep?.sleepScore ||
    (latestGarminSleep?.sleepScore !== undefined ? String(latestGarminSleep.sleepScore) : '');
  const latestHrv =
    latestNightSleep?.hrv ||
    (latestGarminSleep?.hrv !== undefined ? String(latestGarminSleep.hrv) : '');
  const latestRhr =
    latestNightSleep?.restingHeartRate ||
    (latestGarminSleep?.restingHeartRate !== undefined
      ? String(latestGarminSleep.restingHeartRate)
      : '');
  const latestDeep =
    latestNightSleep?.deepSleep ||
    (latestGarminSleep?.deepSleepHours ? String(latestGarminSleep.deepSleepHours) : '');
  const latestRem =
    latestNightSleep?.remSleep ||
    (latestGarminSleep?.remSleepHours ? String(latestGarminSleep.remSleepHours) : '');

  // 小睡統計 (計算今天的)
  const todayNaps = activeLogs.filter(log => log.date === todayStr && log.type === 'nap');
  const separateNapHours = todayNaps.reduce((sum, n) => sum + Number(n.sleepDuration), 0);
  const embeddedNapHours = Number(latestNightSleep?.napMinutes || latestGarminSleep?.napMinutes || 0) / 60;
  const napHours = separateNapHours > 0 ? separateNapHours : embeddedNapHours;

  const displayTotalHours = sleepHours + napHours;

  // 7 天雙核心指標：7h 達標 & 10:30 前入睡
  const stats = useMemo(() => {
    const today = new Date();
    const dates7: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      dates7.push(d.toLocaleDateString('en-CA'));
    }

    let achieved7h = 0;
    let achievedEarly7 = 0;

    dates7.forEach(dateStr => {
      const dayLogs = activeLogs.filter(l => l.date === dateStr);
      const gSleep = garminSleepMap[dateStr];
      const dayTotal =
        dayLogs.length > 0
          ? dayLogs.reduce((sum, l) => sum + (Number(l.sleepDuration) || 0), 0)
          : gSleep?.sleepDurationHours || 0;
      if (dayTotal >= 7) achieved7h++;

      const nightLog = dayLogs.find(l => l.type === 'night');
      const bedtimeToCheck = nightLog?.bedtime || gSleep?.bedtime12h;
      if (bedtimeToCheck && isBefore1030PM(bedtimeToCheck)) {
        achievedEarly7++;
      }
    });

    const p7h = Math.min(100, Math.round((achieved7h / 7) * 100));
    const pEarly7 = Math.min(100, Math.round((achievedEarly7 / 7) * 100));

    return { achieved7h, p7h, achievedEarly7, pEarly7 };
  }, [activeLogs, garminSleepMap]);

  // 供一鍵彈窗顯示的昨晚睡眠預覽數據
  const promptDurationHours =
    (todayNightLog?.sleepDuration ? Number(todayNightLog.sleepDuration) : 0) ||
    todayGarminSleep?.sleepDurationHours ||
    0;
  const promptBedtime = todayNightLog?.bedtime || todayGarminSleep?.bedtime12h || '';
  const promptScore =
    todayNightLog?.sleepScore ||
    (todayGarminSleep?.sleepScore !== undefined ? String(todayGarminSleep.sleepScore) : '');
  const promptHrv =
    todayNightLog?.hrv ||
    (todayGarminSleep?.hrv !== undefined ? String(todayGarminSleep.hrv) : '');
  const hasPreloadedSleepData = promptDurationHours > 0;

  return (
    <>
      <div
        onClick={() => setIsDetailModalOpen(true)}
        className="w-full max-w-md mx-auto bg-[#fdfdfc] rounded-lg shadow-sm border border-stone-200 mb-4 transition-all hover:shadow-md cursor-pointer group relative"
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-[#5c697b] flex-wrap">
              <Moon size={18} strokeWidth={2.5} />
              <h3 className="font-bold text-stone-700 text-base">睡眠追蹤</h3>

              <div className="flex items-center gap-1 flex-wrap">
                {displayTotalHours >= 7 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-[#eaf5ef] text-[#3e7256] border border-[#d8ece1]">
                    達標 7h
                  </span>
                )}
                {latestSleepScore && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-stone-100 text-stone-600 border border-stone-200">
                    {latestSleepScore} 分
                  </span>
                )}
                {latestHrv && (() => {
                  const hrvInfo = getHrvStatus(latestHrv, latestGarminSleep?.hrvStatus);
                  if (!hrvInfo) return null;
                  return (
                    <span
                      title={hrvInfo.detail}
                      className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${hrvInfo.pillColor}`}
                    >
                      {hrvInfo.label}
                    </span>
                  );
                })()}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-[#444]">
                  {displayTotalHours > 0 ? displayTotalHours.toFixed(1) : '-'}
                </span>
                <span className="text-stone-400 font-medium text-xs">h</span>
              </div>
              <div className="flex items-center">{renderFeelingIcon(feelingKey)}</div>
            </div>
          </div>

          {/* 7天雙核心指標：7h 達標 & 10:30 入睡 */}
          <div className="bg-[#fffdf7] border border-[#f2ebe1] rounded-lg p-2.5 mb-3 space-y-2">
            {/* 7h 達標 */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-[#8a6d4d]">
                  7h 達標：{stats.achieved7h} / 7 天
                </span>
                <span className="text-[11px] text-stone-400 font-medium">
                  近 7 天 · {stats.p7h}%
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full overflow-hidden bg-stone-100">
                <div
                  className="h-full bg-[#8a6d4d] transition-all duration-500 rounded-full"
                  style={{ width: `${stats.p7h}%` }}
                />
              </div>
            </div>

            {/* 10:30 前入睡 */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-[#8a6d4d]">
                  10:30 前入睡：{stats.achievedEarly7} / 7 天
                </span>
                <span className="text-[11px] text-stone-400 font-medium">
                  近 7 天 · {stats.pEarly7}%
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full overflow-hidden bg-stone-100">
                <div
                  className="h-full bg-[#5c697b] transition-all duration-500 rounded-full"
                  style={{ width: `${stats.pEarly7}%` }}
                />
              </div>
            </div>
          </div>

          {/* 底部數據與恢復狀態解讀 */}
          {(() => {
            const recovery = getRecoveryStatusBadges({
              deepHours: latestDeep,
              remHours: latestRem,
              rhr: latestRhr,
            });

            return (
              <div className="flex justify-between items-center text-xs text-stone-500 font-medium border-t border-stone-100 pt-2 flex-wrap gap-y-1">
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  <span className="shrink-0">入睡 {formatTo12Hour(latestBedtime)}</span>
                  {recovery.items.length > 0 && (
                    <>
                      <span className="text-stone-300">·</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {recovery.items.map((item, idx) => (
                          <span
                            key={idx}
                            title={item.title}
                            className={`text-[11px] ${item.color}`}
                          >
                            {item.text}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <div className="shrink-0">小睡：{napHours > 0 ? `${napHours.toFixed(1)}h` : '無'}</div>
              </div>
            );
          })()}
        </div>

        {/* 浮動新增按鈕組 (小睡 & 主睡眠) */}
        <div className="absolute -top-3 -right-1.5 flex items-center gap-1.5 z-10">
          <button
            onClick={e => {
              e.stopPropagation();
              openForm(new Date().toLocaleDateString('en-CA'), 'nap');
            }}
            className="w-7 h-7 bg-white border border-stone-200 rounded-full flex items-center justify-center text-stone-500 hover:bg-stone-50 hover:text-stone-800 shadow-sm transition-colors"
            title="新增小睡"
          >
            <Coffee size={12} />
          </button>
          <button
            onClick={e => {
              e.stopPropagation();
              const currDate = new Date().toLocaleDateString('en-CA');
              const existingLog = activeLogs.find(
                l => l.date === currDate && l.type === 'night'
              );
              openForm(currDate, 'night', existingLog || null);
            }}
            className="w-8 h-8 bg-white border border-stone-200 rounded-full flex items-center justify-center text-stone-500 hover:bg-stone-50 hover:text-stone-800 shadow-sm transition-colors"
            title={
              activeLogs.some(
                l => l.date === new Date().toLocaleDateString('en-CA') && l.type === 'night'
              )
                ? '編輯今日睡眠紀錄'
                : '新增睡眠紀錄'
            }
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* 睡眠詳情與趨勢圖表 */}
      <SleepDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        sleepLogs={activeLogs}
        allergyLogs={allergyLogs}
        supplementLogs={supplementLogs}
        splintLogs={splintLogs}
        garminSleepMap={garminSleepMap}
        runningActivities={runningActivities}
        cycle={cycle}
        onEditDay={dateStr => {
          setIsDetailModalOpen(false);
          const existing = activeLogs.find(l => l.date === dateStr && l.type === 'night');
          openForm(dateStr, 'night', existing || null);
        }}
      />

      {/* 一鍵起床感受打卡彈窗 (睡眠數據已預先由 Garmin 自動載入) */}
      {isAutoPromptOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={dismissPrompt}
          >
            <div
              className="relative bg-[#fdfdfc] w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center animate-in zoom-in-95 duration-200 border border-stone-200"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-11 h-11 bg-[#f0f6f2] text-[#3e7256] rounded-full flex items-center justify-center mx-auto mb-3 border border-[#d8ece1]">
                <Moon size={20} />
              </div>

              <h3 className="text-base font-bold text-stone-800 mb-1">今天起床感受如何？</h3>

              {hasPreloadedSleepData ? (
                <div className="inline-flex flex-wrap items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-50 border border-stone-200/80 text-xs text-stone-600 font-medium mt-1 mb-4">
                  <Watch size={12} className="text-[#3e7256]" />
                  <span>
                    {[
                      promptBedtime ? `${formatTo12Hour(promptBedtime)} 入睡` : '',
                      `${promptDurationHours.toFixed(1)}h`,
                      promptScore ? `${promptScore} 分` : '',
                      promptHrv
                        ? (() => {
                            const info = getHrvStatus(promptHrv, todayGarminSleep?.hrvStatus);
                            return info ? info.label : `HRV ${promptHrv}`;
                          })()
                        : '',
                      todayGarminSleep?.deepSleepHours && todayGarminSleep.deepSleepHours >= 1.5 ? '深眠充足' : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-stone-500 mb-4 leading-relaxed">
                  尚未偵測到 {todayStr} 手錶睡眠數據
                </p>
              )}

              {/* 睡前保健品與咬合板快速確認膠囊 */}
              <div className="flex items-center justify-center gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setPromptBedtimeSupp(!promptBedtimeSupp)}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full transition-colors border ${
                    promptBedtimeSupp
                      ? 'bg-[#eaf5ef] border-[#cce6d8] text-[#3e7256] font-bold'
                      : 'bg-stone-50 border-stone-200 hover:bg-stone-100 text-stone-500'
                  }`}
                >
                  <Pill size={13} />
                  <span>睡前保健品</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPromptSplint(!promptSplint)}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full transition-colors border ${
                    promptSplint
                      ? 'bg-[#e6f0fa] border-[#c8ddf2] text-[#4a6b82] font-bold'
                      : 'bg-stone-50 border-stone-200 hover:bg-stone-100 text-stone-500'
                  }`}
                >
                  <ToothIcon size={13} />
                  <span>咬合板</span>
                </button>
              </div>

              {hasPreloadedSleepData ? (
                <>
                  {/* 一鍵選擇起床感受，按完即結束 */}
                  <div className="grid grid-cols-3 gap-2.5 mb-3">
                    {FEELING_CHOICES.map(opt => {
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleOneTapFeelingSelect(opt.id)}
                          className={`flex flex-col items-center justify-center gap-1.5 py-3.5 px-2 rounded-xl border border-stone-200 bg-white text-stone-700 font-bold text-xs shadow-2xs transition-all active:scale-95 ${opt.activeColor}`}
                        >
                          <Icon size={22} />
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-[11px] text-stone-400">
                    <button
                      type="button"
                      onClick={() => {
                        dismissPrompt();
                        openForm(todayStr, 'night', todayNightLog || null);
                      }}
                      className="hover:text-stone-600 transition-colors flex items-center gap-1"
                    >
                      <PenLine size={11} />
                      <span>微調時間</span>
                    </button>
                    <button
                      type="button"
                      onClick={dismissPrompt}
                      className="hover:text-stone-600 transition-colors"
                    >
                      稍後再說
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      dismissPrompt();
                      openForm(todayStr, 'night');
                    }}
                    className="w-full py-2.5 bg-[#6ba388] text-white text-xs font-bold rounded-xl hover:bg-[#5b8c74] transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <PenLine size={14} /> 手動填寫
                  </button>
                  <button
                    onClick={dismissPrompt}
                    className="w-full py-2 text-stone-400 text-xs font-medium hover:text-stone-600 transition-colors"
                  >
                    稍後再說
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}

      {/* 新增/編輯睡眠表單 */}
      {isFormModalOpen && (
        <SleepFormModal
          isOpen={isFormModalOpen}
          onClose={() => setIsFormModalOpen(false)}
          initialData={editingLog}
          splintLogs={splintLogs}
          supplementLogs={supplementLogs}
          sleepLogs={activeLogs}
          defaultDate={defaultDate}
          defaultType={defaultType}
          garminSleepMap={garminSleepMap}
          onSave={commitSleepSave}
        />
      )}
    </>
  );
}

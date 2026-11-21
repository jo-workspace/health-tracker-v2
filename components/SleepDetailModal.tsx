'use client';
import { X, Moon, Pill, Activity, Footprints, Heart } from 'lucide-react';
import { createPortal } from 'react-dom';
import type {
  SleepLog,
  AllergyLog,
  SupplementLog,
  BiteSplintLog,
  GarminSleepData,
  GarminRunningActivity,
  GarminMenstrualCycle,
} from '@/lib/types';

import { formatTo12Hour, isBefore1030PM } from '@/lib/sleep';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sleepLogs: SleepLog[];
  allergyLogs?: AllergyLog[];
  supplementLogs?: SupplementLog[];
  splintLogs?: BiteSplintLog[];
  garminSleepMap?: Record<string, GarminSleepData>;
  runningActivities?: GarminRunningActivity[];
  cycle?: GarminMenstrualCycle | null;
  onEditDay?: (dateStr: string) => void;
}

const SLEEP_IMPACT_RANK: Record<string, number> = { none: 0, mild: 1, severe: 2 };

const ToothIcon = ({ size = 11, className = '' }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M7 3C4.23858 3 2 5.23858 2 8C2 10.5 3.5 12.5 5.5 13.5V19C5.5 20.1046 6.39543 21 7.5 21H8.5C9.60457 21 10.5 20.1046 10.5 19V14H13.5V19C13.5 20.1046 14.3954 21 15.5 21H16.5C17.6046 21 18.5 20.1046 18.5 19V13.5C20.5 12.5 22 10.5 22 8C22 5.23858 19.7614 3 17 3H7Z" />
  </svg>
);

export default function SleepDetailModal({
  isOpen,
  onClose,
  sleepLogs,
  allergyLogs = [],
  supplementLogs = [],
  splintLogs = [],
  garminSleepMap = {},
  runningActivities = [],
  cycle = null,
  onEditDay,
}: Props) {
  if (!isOpen) return null;

  const activeAllergyLogs = allergyLogs.filter(l => l.status !== 'deleted');

  const getPrevDateStr = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('en-CA');
  };

  const getMagnesiumInfo = (wakeUpDateStr: string) => {
    if (!supplementLogs || supplementLogs.length === 0) return { taken: false, name: '' };
    const prevDateStr = getPrevDateStr(wakeUpDateStr);

    const targetLog =
      supplementLogs.find(log => log.date === prevDateStr && log.status !== 'deleted') ||
      supplementLogs.find(log => log.date === wakeUpDateStr && log.status !== 'deleted');

    if (!targetLog || !targetLog.items) return { taken: false, name: '' };
    try {
      const items = JSON.parse(targetLog.items);
      if (Array.isArray(items)) {
        const magItem = items.find(
          (item: any) =>
            (item.name?.includes('鎂') || item.name?.toLowerCase().includes('magnesium')) &&
            item.taken
        );
        if (magItem) {
          return { taken: true, name: magItem.name || '鎂' };
        }
      }
      return { taken: false, name: '' };
    } catch {
      return { taken: false, name: '' };
    }
  };

  // 取得近 7 天的日期字串 (YYYY-MM-DD)
  const last7Days: string[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    last7Days.push(d.toLocaleDateString('en-CA'));
  }

  const activeLogs = sleepLogs.filter(log => log.status !== 'deleted');

  // 計算每日數據
  const dailyData = last7Days.map(dateStr => {
    const dayLogs = activeLogs.filter(log => log.date === dateStr);
    const nightLog = dayLogs.find(log => log.type === 'night');
    const dayNaps = dayLogs.filter(log => log.type === 'nap');
    const garminSleep = garminSleepMap[dateStr];

    const nightHours = nightLog
      ? Number(nightLog.sleepDuration)
      : garminSleep?.sleepDurationHours || 0;
    const separateNapHours = dayNaps.reduce((sum, n) => sum + Number(n.sleepDuration), 0);
    const embeddedNapHours = Number(nightLog?.napMinutes ?? garminSleep?.napMinutes ?? 0) / 60;
    const napHours = separateNapHours > 0 ? separateNapHours : embeddedNapHours;
    const totalHours = nightHours + napHours;
    const bedtime = nightLog?.bedtime || garminSleep?.bedtime12h || '';

    const sleepScore =
      nightLog?.sleepScore ||
      (garminSleep?.sleepScore !== undefined ? String(garminSleep.sleepScore) : '');
    const hrv =
      nightLog?.hrv || (garminSleep?.hrv !== undefined ? String(garminSleep.hrv) : '');
    const hrvStatus = garminSleep?.hrvStatus || nightLog?.hrvStatus || '';

    const nightColor = nightHours > 0 ? '#5c697b' : '#e5e7eb';

    const dayAllergyLogs = activeAllergyLogs.filter(l => l.date === dateStr);
    const worstAllergyImpact = dayAllergyLogs.reduce((worst, l) => {
      const impact = l.sleepImpact || 'none';
      return SLEEP_IMPACT_RANK[impact] > SLEEP_IMPACT_RANK[worst] ? impact : worst;
    }, 'none');

    const magInfo = getMagnesiumInfo(dateStr);
    const hasMagnesium = magInfo.taken;
    const magnesiumName = magInfo.name;
    const prevDateStr = getPrevDateStr(dateStr);
    const hasSplint = splintLogs.some(
      l => (l.date === dateStr || l.date === prevDateStr) && l.status !== 'deleted'
    );

    // 檢查當日（或昨晚入睡前當日）是否有跑步課表
    const dayRuns = runningActivities.filter(a => a.date === dateStr);
    const hasRun = dayRuns.length > 0;
    const runSummary = hasRun
      ? dayRuns.map(r => `${r.cleanName} (${r.distanceKm}km)`).join('、')
      : '';

    return {
      dateStr,
      nightHours,
      napHours,
      totalHours,
      nightColor,
      bedtime,
      sleepScore,
      hrv,
      hrvStatus,
      allergyImpact: worstAllergyImpact,
      hasMagnesium,
      magnesiumName,
      hasSplint,
      hasRun,
      runSummary,
    };
  });

  // 動態計算 Chart Y 軸最大值 (最高時數 + 1，最少 10)
  const maxDataVal = Math.max(...dailyData.map(d => d.totalHours), 0);
  const maxChartVal = Math.max(10, Math.ceil(maxDataVal + 1));

  // 取得近 30 天日期
  const last30Days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    last30Days.push(d.toLocaleDateString('en-CA'));
  }

  // 7 天達標統計 (7h 達標 & 10:30 前入睡)
  let goal7hDays = 0;
  let goalEarly7Days = 0;
  last7Days.forEach(dateStr => {
    const dayLogs = activeLogs.filter(l => l.date === dateStr);
    const dayTotal = dayLogs.reduce((sum, l) => sum + (Number(l.sleepDuration) || 0), 0);
    if (dayTotal >= 7) goal7hDays++;

    const nightLog = dayLogs.find(l => l.type === 'night');
    if (nightLog && isBefore1030PM(nightLog.bedtime)) {
      goalEarly7Days++;
    }
  });
  const p7h = Math.round((goal7hDays / 7) * 100);
  const pEarly7 = Math.round((goalEarly7Days / 7) * 100);

  // 30 天達標統計 (7h 達標 & 10:30 前入睡)
  let goal30hDays = 0;
  let goalEarly30Days = 0;
  last30Days.forEach(dateStr => {
    const dayLogs = activeLogs.filter(l => l.date === dateStr);
    const dayTotal = dayLogs.reduce((sum, l) => sum + (Number(l.sleepDuration) || 0), 0);
    if (dayTotal >= 7) goal30hDays++;

    const nightLog = dayLogs.find(l => l.type === 'night');
    if (nightLog && isBefore1030PM(nightLog.bedtime)) {
      goalEarly30Days++;
    }
  });
  const p30h = Math.round((goal30hDays / 30) * 100);
  const pEarly30 = Math.round((goalEarly30Days / 30) * 100);

  return typeof document !== 'undefined'
    ? createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm transition-opacity">
          <div className="absolute inset-0" onClick={onClose} />

          <div className="relative bg-[#fcfcfc] w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-stone-100 shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <Moon size={18} className="text-stone-700" />
                <h2 className="text-base font-bold text-stone-800">睡眠趨勢</h2>
                {cycle && (() => {
                  let nextPeriodDisplay = '';
                  if (cycle.predictedNextPeriodDate) {
                    const parts = cycle.predictedNextPeriodDate.split('-');
                    if (parts.length === 3) {
                      nextPeriodDisplay = `${Number(parts[1])}/${Number(parts[2])}`;
                    }
                  } else if (cycle.startDate && cycle.predictedCycleLength > 0) {
                    const [y, m, d] = cycle.startDate.split('-').map(Number);
                    const dt = new Date(Date.UTC(y, m - 1, d + cycle.predictedCycleLength));
                    nextPeriodDisplay = `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}`;
                  }

                  return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f6f1f1] text-[#8c5e60] border border-[#eadede]">
                      <Heart size={10} />
                      <span>
                        週期 D{cycle.dayInCycle} · {cycle.phaseName}
                        {nextPeriodDisplay ? ` · 預計月經 ${nextPeriodDisplay}` : ''}
                      </span>
                    </span>
                  );
                })()}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-stone-50 text-stone-400 hover:bg-stone-200 hover:text-stone-600 transition-colors ml-1"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto custom-scrollbar flex flex-col gap-4">
              {/* 目標區塊 (近 7 天 & 近 30 天) */}
              <div className="bg-[#fffdf7] border border-[#f2ebe1] rounded-xl p-3.5 shadow-2xs space-y-3">
                {/* 近 7 天 */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-stone-400 block tracking-wide">
                    近 7 天目標
                  </span>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-[#8a6d4d]">
                        7h 達標：{goal7hDays} / 7 天
                      </span>
                      <span className="text-xs font-semibold text-stone-500">{p7h}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full overflow-hidden bg-stone-100">
                      <div
                        className="h-full bg-[#8a6d4d] rounded-full transition-all duration-500"
                        style={{ width: `${p7h}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-[#8a6d4d]">
                        10:30 前入睡：{goalEarly7Days} / 7 天
                      </span>
                      <span className="text-xs font-semibold text-stone-500">{pEarly7}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full overflow-hidden bg-stone-100">
                      <div
                        className="h-full bg-[#5c697b] rounded-full transition-all duration-500"
                        style={{ width: `${pEarly7}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* 近 30 天 */}
                <div className="space-y-1.5 pt-2.5 border-t border-[#f2ebe1]">
                  <span className="text-[10px] font-bold text-stone-400 block tracking-wide">
                    近 30 天目標
                  </span>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-[#8a6d4d]">
                        7h 達標：{goal30hDays} / 30 天
                      </span>
                      <span className="text-xs font-semibold text-stone-500">{p30h}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full overflow-hidden bg-stone-100">
                      <div
                        className="h-full bg-[#8a6d4d] rounded-full transition-all duration-500"
                        style={{ width: `${p30h}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-[#8a6d4d]">
                        10:30 前入睡：{goalEarly30Days} / 30 天
                      </span>
                      <span className="text-xs font-semibold text-stone-500">{pEarly30}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full overflow-hidden bg-stone-100">
                      <div
                        className="h-full bg-[#5c697b] rounded-full transition-all duration-500"
                        style={{ width: `${pEarly30}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 圖表 */}
              <div className="flex justify-between items-end h-32 px-2 border-b border-stone-200 relative pt-4 mt-2">
                {/* Y軸標線 */}
                <div className="absolute top-0 left-0 w-full border-t border-dashed border-stone-200" />
                <div className="absolute top-1/2 left-0 w-full border-t border-dashed border-stone-200" />

                {dailyData.map((d, i) => {
                  const nightPct = Math.min(100, (d.nightHours / maxChartVal) * 100);
                  const napPct = Math.min(100, (d.napHours / maxChartVal) * 100);

                  const dateObj = new Date(d.dateStr);
                  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

                  return (
                    <div
                      key={i}
                      onClick={() => onEditDay && onEditDay(d.dateStr)}
                      className={`flex flex-col items-center w-8 z-10 group relative h-full justify-end ${
                        onEditDay ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''
                      }`}
                      title={onEditDay ? `點擊編輯或補填 ${d.dateStr} 睡眠紀錄` : undefined}
                    >
                      {/* Hover Tooltip (The Bar Background) */}
                      <div
                        className="w-4 bg-stone-100/50 rounded-t flex flex-col justify-end overflow-hidden relative group-hover:bg-stone-200/50 transition-colors"
                        style={{ height: '100%' }}
                      >
                        <div
                          className="w-full transition-all duration-500 rounded-t-xs"
                          style={{ height: `${napPct}%`, backgroundColor: '#9ca896' }}
                          title={`小睡: ${Math.round(d.napHours * 60)}分`}
                        />
                        <div
                          className="w-full transition-all duration-500"
                          style={{ height: `${nightPct}%`, backgroundColor: d.nightColor }}
                          title={`主睡眠: ${d.nightHours.toFixed(1)}h`}
                        />
                      </div>

                      {/* Labels positioned directly below the flex container's baseline */}
                      <div className="absolute top-full mt-1.5 flex flex-col items-center leading-none gap-0.5 w-12 text-center group-hover:scale-105 transition-transform">
                        <span className="text-[10px] font-bold text-stone-600">
                          {d.totalHours > 0 ? d.totalHours.toFixed(1) + 'h' : ''}
                        </span>
                        {d.sleepScore ? (
                          <span
                            className="text-[9px] font-bold text-[#3e7256] mt-0.5"
                            title={
                              d.hrv
                                ? `睡眠分數 ${d.sleepScore} · HRV ${d.hrv}${
                                    d.hrvStatus
                                      ? ` (${
                                          d.hrvStatus === 'BALANCED'
                                            ? '平衡'
                                            : d.hrvStatus === 'UNBALANCED'
                                            ? '不平衡'
                                            : d.hrvStatus === 'LOW'
                                            ? '偏低'
                                            : d.hrvStatus === 'POOR'
                                            ? '不良'
                                            : d.hrvStatus === 'NONE'
                                            ? '基準建立中'
                                            : d.hrvStatus
                                        })`
                                      : ''
                                  }`
                                : `睡眠分數 ${d.sleepScore}`
                            }
                          >
                            {d.sleepScore}分
                          </span>
                        ) : (
                          <span className="text-[9px] text-transparent mt-0.5">-</span>
                        )}
                        <span className="text-[9px] text-stone-400 mt-0.5">
                          {d.dateStr.substring(8, 10)}
                        </span>
                        <span className="text-[8px] text-stone-400">
                          ({weekdays[dateObj.getDay()]})
                        </span>
                        {d.bedtime && (
                          <span
                            className="text-[8px] font-medium text-stone-400 tracking-tight mt-0.5"
                            title={`入睡時間：${formatTo12Hour(d.bedtime)}`}
                          >
                            {formatTo12Hour(d.bedtime).replace(' ', '')}
                          </span>
                        )}
                        <div className="flex items-center gap-1 mt-0.5 text-stone-400">
                          {d.hasRun && (
                            <span title={`當日跑步：${d.runSummary}`}>
                              <Footprints size={10} className="text-[#8a6d4d]" />
                            </span>
                          )}
                          {d.allergyImpact !== 'none' && (
                            <span
                              title={`過敏影響睡眠：${
                                d.allergyImpact === 'severe' ? '嚴重' : '輕微'
                              }`}
                            >
                              <Activity
                                size={10}
                                className={
                                  d.allergyImpact === 'severe'
                                    ? 'text-amber-600'
                                    : 'text-stone-400'
                                }
                              />
                            </span>
                          )}
                          {d.hasMagnesium && (
                            <span title={`當天有補充 ${d.magnesiumName || '鎂'}`}>
                              <Pill size={10} className="text-[#3e7256]" />
                            </span>
                          )}
                          {d.hasSplint && (
                            <span title="當天有佩戴咬合板">
                              <ToothIcon size={10} className="text-[#4a6b82]" />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Spacer for bottom labels */}
              <div className="h-16"></div>

              {/* 圖例 */}
              <div className="flex flex-wrap gap-3 text-[10px] text-stone-500 justify-center mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#5c697b]"></span> 主睡眠
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#9ca896]"></span> 小睡
                </div>
                <div className="flex items-center gap-1">
                  <Footprints size={11} className="text-[#8a6d4d]" /> 跑步日
                </div>
                <div className="flex items-center gap-1">
                  <Pill size={11} className="text-[#3e7256]" /> 睡前鎂
                </div>
                <div className="flex items-center gap-1">
                  <ToothIcon size={11} className="text-[#4a6b82]" /> 咬合板
                </div>
              </div>

              <p className="text-[10px] text-stone-400 text-center">
                點擊各日期直條可直接補填或編輯該日睡眠
              </p>
            </div>
          </div>

          <style
            dangerouslySetInnerHTML={{
              __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 4px; }
      `,
            }}
          />
        </div>,
        document.body
      )
    : null;
}

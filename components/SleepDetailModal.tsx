'use client';
import { X, Moon, Pill, Activity } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { SleepLog, AllergyLog, SupplementLog, BiteSplintLog } from '@/lib/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sleepLogs: SleepLog[];
  allergyLogs?: AllergyLog[];
  supplementLogs?: SupplementLog[];
  splintLogs?: BiteSplintLog[];
  onEditDay?: (dateStr: string) => void;
}

const SLEEP_IMPACT_RANK: Record<string, number> = { none: 0, mild: 1, severe: 2 };

const ToothIcon = ({ size = 11, className = "" }: { size?: number; className?: string }) => (
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
  onEditDay
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
    
    const targetLog = supplementLogs.find(log => log.date === prevDateStr && log.status !== 'deleted')
      || supplementLogs.find(log => log.date === wakeUpDateStr && log.status !== 'deleted');

    if (!targetLog || !targetLog.items) return { taken: false, name: '' };
    try {
      const items = JSON.parse(targetLog.items);
      if (Array.isArray(items)) {
        const magItem = items.find((item: any) =>
          (item.name?.includes('鎂') || item.name?.toLowerCase().includes('magnesium')) && item.taken
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
    
    const nightHours = nightLog ? Number(nightLog.sleepDuration) : 0;
    const napHours = dayNaps.reduce((sum, n) => sum + Number(n.sleepDuration), 0);
    const totalHours = nightHours + napHours;
    
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

    return {
      dateStr,
      nightHours,
      napHours,
      totalHours,
      nightColor,
      allergyImpact: worstAllergyImpact,
      hasMagnesium,
      magnesiumName,
      hasSplint
    };
  });

  // 計算平均數據 (只有當天有夜間睡眠才計入分母)
  const daysWithNightSleep = dailyData.filter(d => d.nightHours > 0);
  const totalNightHours = daysWithNightSleep.reduce((sum, d) => sum + d.nightHours, 0);
  const avgNightHours = daysWithNightSleep.length > 0 ? (totalNightHours / daysWithNightSleep.length).toFixed(1) : '-';

  const daysWithNap = dailyData.filter(d => d.napHours > 0);
  const totalNapHours = dailyData.reduce((sum, d) => sum + d.napHours, 0);
  const avgNapMins = daysWithNap.length > 0 ? Math.round((totalNapHours / daysWithNap.length) * 60) : 0;

  const totalSleepAll = dailyData.reduce((sum, d) => sum + d.totalHours, 0);
  const daysWithAnySleep = dailyData.filter(d => d.totalHours > 0);
  const avgTotalHours = daysWithAnySleep.length > 0 ? (totalSleepAll / daysWithAnySleep.length).toFixed(1) : '-';

  // 動態計算 Chart Y 軸最大值 (最高時數 + 1，最少 10)
  const maxDataVal = Math.max(...dailyData.map(d => d.totalHours), 0);
  const maxChartVal = Math.max(10, Math.ceil(maxDataVal + 1)); 

  // 目標計算
  const goalDays = daysWithNightSleep.filter(d => d.nightHours >= 7).length;

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm transition-opacity">
      <div className="absolute inset-0" onClick={onClose} />
      
      <div className="relative bg-[#fcfcfc] w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-stone-100 shrink-0 bg-white">
          <h2 className="text-base font-bold text-stone-800 flex items-center gap-2">
            <Moon size={18} className="text-stone-700" />
            <span>睡眠趨勢</span>
          </h2>
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
          
          {/* 目標區塊 */}
          <div className="bg-[#fffdf7] border border-[#f2ebe1] rounded-xl p-3 shadow-2xs">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-[#8a6d4d]">7h 達標：{goalDays} / {daysWithNightSleep.length} 天</span>
              <span className="text-[11px] text-stone-400">每日目標 7 小時</span>
            </div>
          </div>

          {/* 數據快照 */}
          <div className="grid grid-cols-3 gap-2 bg-stone-50 p-3 rounded-xl border border-stone-100 text-center">
            <div className="flex flex-col items-center justify-center border-r border-stone-200/60 pr-1">
              <span className="text-lg font-black text-stone-700">{avgNightHours}<span className="text-xs font-medium ml-0.5">h</span></span>
              <span className="text-[11px] text-stone-500 font-medium mt-0.5">主睡眠均值</span>
            </div>
            <div className="flex flex-col items-center justify-center border-r border-stone-200/60 px-1">
              <span className="text-lg font-black text-stone-700">{avgNapMins}<span className="text-xs font-medium ml-0.5">m</span></span>
              <span className="text-[11px] text-stone-500 font-medium mt-0.5">小睡均值</span>
            </div>
            <div className="flex flex-col items-center justify-center pl-1">
              <span className="text-lg font-black text-stone-700">{avgTotalHours}<span className="text-xs font-medium ml-0.5">h</span></span>
              <span className="text-[11px] text-stone-500 font-medium mt-0.5">總睡眠均值</span>
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
              const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
              
              return (
                <div 
                  key={i} 
                  onClick={() => onEditDay && onEditDay(d.dateStr)}
                  className={`flex flex-col items-center w-8 z-10 group relative h-full justify-end ${onEditDay ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                  title={onEditDay ? `點擊編輯或補填 ${d.dateStr} 睡眠紀錄` : undefined}
                >
                  {/* Hover Tooltip (The Bar Background) */}
                  <div className="w-4 bg-stone-100/50 rounded-t flex flex-col justify-end overflow-hidden relative group-hover:bg-stone-200/50 transition-colors" style={{ height: '100%' }}>
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
                    <span className="text-[10px] font-bold text-stone-600">{d.totalHours > 0 ? d.totalHours.toFixed(1) + 'h' : ''}</span>
                    <span className="text-[9px] text-stone-400 mt-1">{d.dateStr.substring(8, 10)}</span>
                    <span className="text-[8px] text-stone-400">({weekdays[dateObj.getDay()]})</span>
                    <div className="flex items-center gap-1 mt-0.5 text-stone-400">
                      {d.allergyImpact !== 'none' && (
                        <span title={`過敏影響睡眠：${d.allergyImpact === 'severe' ? '嚴重' : '輕微'}`}>
                          <Activity size={10} className={d.allergyImpact === 'severe' ? 'text-amber-600' : 'text-stone-400'} />
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
          <div className="h-12"></div>

          {/* 圖例 */}
          <div className="flex gap-4 text-[10px] text-stone-500 justify-center mb-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#5c697b]"></span> 主睡眠
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#9ca896]"></span> 小睡
            </div>
          </div>
          
          <p className="text-[10px] text-stone-400 text-center">
            點擊各日期直條可直接補填或編輯該日睡眠
          </p>
          
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 4px; }
      `}} />
    </div>,
    document.body
  ) : null;
}

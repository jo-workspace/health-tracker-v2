import { X, Moon, Info } from 'lucide-react';
import type { SleepLog } from '@/lib/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sleepLogs: SleepLog[];
}

export default function SleepDetailModal({ isOpen, onClose, sleepLogs }: Props) {
  if (!isOpen) return null;

  // 取得近 7 天的日期字串 (YYYY-MM-DD)
  const last7Days: string[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    last7Days.push(d.toLocaleDateString('en-CA')); // local time string
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
    
    let nightColor = '#e5e7eb'; // default grey if no data
    if (nightLog && nightLog.stress) {
      const stress = Number(nightLog.stress);
      if (stress <= 15) nightColor = '#3d5a80';      // 低壓力
      else if (stress <= 30) nightColor = '#90b3c4'; // 普通壓力
      else nightColor = '#b0c2cc';                   // 高壓力
    } else if (nightLog) {
      nightColor = '#6f7f99'; // 預設藍
    }

    return {
      dateStr,
      nightHours,
      napHours,
      totalHours,
      nightColor,
      stress: nightLog?.stress ? Number(nightLog.stress) : null
    };
  });

  // 計算平均數據 (只有當天有夜間睡眠才計入分母)
  const daysWithNightSleep = dailyData.filter(d => d.nightHours > 0);
  const totalNightHours = daysWithNightSleep.reduce((sum, d) => sum + d.nightHours, 0);
  const avgNightHours = daysWithNightSleep.length > 0 ? (totalNightHours / daysWithNightSleep.length).toFixed(1) : '-';

  const daysWithNap = dailyData.filter(d => d.napHours > 0);
  const totalNapHours = dailyData.reduce((sum, d) => sum + d.napHours, 0); // 總小睡除以7? 還是除以有小睡的天數? 舊版是所有天數平均嗎? 假設只算有小睡的
  const avgNapMins = daysWithNap.length > 0 ? Math.round((totalNapHours / daysWithNap.length) * 60) : 0;

  const totalSleepAll = dailyData.reduce((sum, d) => sum + d.totalHours, 0);
  const daysWithAnySleep = dailyData.filter(d => d.totalHours > 0);
  const avgTotalHours = daysWithAnySleep.length > 0 ? (totalSleepAll / daysWithAnySleep.length).toFixed(1) : '-';

  const daysWithStress = dailyData.filter(d => d.stress !== null);
  const totalStress = daysWithStress.reduce((sum, d) => sum + (d.stress || 0), 0);
  const avgStress = daysWithStress.length > 0 ? Math.round(totalStress / daysWithStress.length) : '-';

  // 動態計算 Chart Y 軸最大值 (最高時數 + 1，最少 10)
  const maxDataVal = Math.max(...dailyData.map(d => d.totalHours), 0);
  const maxChartVal = Math.max(10, Math.ceil(maxDataVal + 1)); 

  // 目標計算
  const goalDays = daysWithNightSleep.filter(d => d.nightHours >= 7).length; // 暫時寫死 7h 為達標
  const stressGoalDays = daysWithStress.filter(d => (d.stress || 0) <= 15).length;
  
  // 計算深眠比例 (深眠 / 總夜間時數)
  let totalDeep = 0;
  let nightHoursForDeep = 0;
  daysWithNightSleep.forEach(d => {
    const log = activeLogs.find(l => l.date === d.dateStr && l.type === 'night');
    if (log && log.deepSleep) {
      totalDeep += Number(log.deepSleep);
      nightHoursForDeep += Number(log.sleepDuration);
    }
  });
  const deepRatio = nightHoursForDeep > 0 ? Math.round((totalDeep / nightHoursForDeep) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative bg-[#fdfdfc] w-full max-w-md rounded-2xl shadow-2xl border border-stone-200 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-stone-100 shrink-0">
          <h2 className="text-lg font-bold text-stone-800 flex items-center gap-2">
            <Moon size={20} className="text-stone-700" /> 睡眠趨勢
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-stone-50 text-stone-400 hover:bg-stone-200 hover:text-stone-600 transition-colors ml-1">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto custom-scrollbar flex flex-col gap-4">
          
          {/* 目標區塊 (移除大標題，更緊湊) */}
          <div className="bg-[#fffdf7] border border-[#f2ebe1] rounded-xl p-3 shadow-sm">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center pb-2 border-b border-stone-100/60 dashed-border">
                <span className="font-medium text-[#aa9275]">🔥 7h 達標：{goalDays} / {daysWithNightSleep.length} 天</span>
                <span className="text-[11px] text-stone-400">每日目標：7 小時</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-stone-100/60 dashed-border">
                <span className="font-medium text-[#aa9275]">🧬 深眠達標：{deepRatio}%</span>
                <span className="text-[11px] text-stone-400">深眠目標：&gt;20%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium text-[#aa9275]">🧘 低壓力達標：{stressGoalDays} / {daysWithStress.length} 天</span>
                <span className="text-[11px] text-stone-400">壓力目標：&le; 15</span>
              </div>
            </div>
          </div>

          {/* 數據快照 (更緊湊) */}
          <div className="grid grid-cols-2 gap-2 bg-stone-50 p-3 rounded-xl border border-stone-100">
            <div className="flex flex-col items-center justify-center border-r border-stone-200/60 pr-2">
              <span className="text-xl font-black text-stone-700">{avgNightHours}<span className="text-sm font-medium ml-0.5">小時</span></span>
              <span className="text-xs text-stone-500 font-medium mt-0.5">主睡眠日平均</span>
            </div>
            <div className="flex flex-col items-center justify-center pl-2">
              <span className="text-xl font-black text-stone-700">{avgNapMins}<span className="text-sm font-medium ml-0.5">分鐘</span></span>
              <span className="text-xs text-stone-500 font-medium mt-0.5">小睡日平均</span>
            </div>
            <div className="col-span-2 border-t border-stone-200/60 pt-3 mt-1 grid grid-cols-2">
              <div className="flex flex-col items-center justify-center border-r border-stone-200/60 pr-2">
                <span className="text-xl font-black text-stone-700">{avgTotalHours}<span className="text-sm font-medium ml-0.5">小時</span></span>
                <span className="text-xs text-stone-500 font-medium mt-0.5">睡眠總日平均</span>
              </div>
              <div className="flex flex-col items-center justify-center pl-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xl font-black text-stone-700">{avgStress}</span>
                  {typeof avgStress === 'number' && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${avgStress <= 15 ? 'bg-green-100 text-green-700' : avgStress <= 30 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                      {avgStress <= 15 ? '理想' : avgStress <= 30 ? '普通' : '偏高'}
                    </span>
                  )}
                </div>
                <span className="text-xs text-stone-500 font-medium mt-0.5">平均睡眠壓力</span>
              </div>
            </div>
          </div>

          {/* 圖表 */}
          <div className="flex justify-between items-end h-32 px-2 border-b border-stone-200 relative pt-4 mt-4">
            {/* Y軸標線 */}
            <div className="absolute top-0 left-0 w-full border-t border-dashed border-stone-200" />
            <div className="absolute top-1/2 left-0 w-full border-t border-dashed border-stone-200" />
            
            {dailyData.map((d, i) => {
              const nightPct = Math.min(100, (d.nightHours / maxChartVal) * 100);
              const napPct = Math.min(100, (d.napHours / maxChartVal) * 100);
              
              const dateObj = new Date(d.dateStr);
              const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
              
              return (
                <div key={i} className="flex flex-col items-center w-8 z-10 group relative h-full justify-end">
                  {/* Hover Tooltip (The Bar Background) */}
                  <div className="w-4 bg-stone-100/50 rounded-t flex flex-col justify-end overflow-hidden relative" style={{ height: '100%' }}>
                    <div 
                      className="w-full transition-all duration-500 rounded-t-sm"
                      style={{ height: `${napPct}%`, backgroundColor: '#9ca896' }} 
                      title={`小睡: ${Math.round(d.napHours * 60)}分`}
                    />
                    <div 
                      className="w-full transition-all duration-500"
                      style={{ height: `${nightPct}%`, backgroundColor: d.nightColor }}
                      title={`主睡眠: ${d.nightHours.toFixed(1)}h (壓力: ${d.stress || '-'})`}
                    />
                  </div>
                  
                  {/* Labels positioned directly below the flex container's baseline */}
                  <div className="absolute top-full mt-1.5 flex flex-col items-center leading-none gap-0.5 w-12 text-center">
                    <span className="text-[10px] font-bold text-stone-600">{d.totalHours > 0 ? d.totalHours.toFixed(1) + 'h' : ''}</span>
                    <span className="text-[9px] text-stone-400 mt-1">{d.dateStr.substring(8, 10)}</span>
                    <span className="text-[8px] text-stone-400">({weekdays[dateObj.getDay()]})</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Spacer for the labels that overflowed below */}
          <div className="h-10"></div>

          <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] text-stone-500 justify-center mt-2 mb-2">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#3d5a80]"></span> 低壓力 (&le;15)
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#90b3c4]"></span> 普通壓力 (16-30)
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#b0c2cc]"></span> 高壓力 (&gt;30)
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#9ca896]"></span> 小睡
            </div>
          </div>
          
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .dashed-border { border-bottom-style: dashed; border-color: rgba(0,0,0,0.06); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 4px; }
      `}} />
    </div>
  );
}

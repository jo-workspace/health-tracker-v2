import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Activity, X, Info } from 'lucide-react';
import type { SleepLog } from '@/lib/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sleepLogs: SleepLog[];
}

export default function HRVDetailModal({ isOpen, onClose, sleepLogs }: Props) {
  if (!isOpen) return null;

  const activeLogs = sleepLogs.filter(log => log.status !== 'deleted' && log.type === 'night' && log.hrv);

  // 取得近 28 天的日期字串
  const last28Days: string[] = [];
  const today = new Date();
  for (let i = 27; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    last28Days.push(d.toLocaleDateString('en-CA'));
  }

  // 💡 計算過去 7 天的 HRV 平均值
  const calculateSevenDayHrvAvg = (targetDateStr: string) => {
    const targetDateObj = new Date(targetDateStr);
    const startTime = new Date(targetDateObj);
    startTime.setDate(targetDateObj.getDate() - 6);
    
    const windowLogs = activeLogs.filter(log => {
      const logTime = new Date(log.date).getTime();
      return logTime >= startTime.getTime() && logTime <= targetDateObj.getTime();
    });
    
    if (windowLogs.length === 0) return null;
    const sum = windowLogs.reduce((acc, log) => acc + Number(log.hrv), 0);
    return Math.round(sum / windowLogs.length);
  };

  // 💡 HRV 個人基準線計算：取得目標日期往前的 90 天主睡眠 HRV 滾動平均值 ± 1 標準差 (±1 SD)
  const calculateRollingHrvBaseline = (targetDateStr: string) => {
    const targetDateObj = new Date(targetDateStr);
    const startTime = new Date(targetDateObj);
    startTime.setDate(targetDateObj.getDate() - 89);
    
    const windowLogs = activeLogs.filter(log => {
      const logTime = new Date(log.date).getTime();
      return logTime >= startTime.getTime() && logTime <= targetDateObj.getTime();
    });
    
    if (windowLogs.length === 0) return null;
    
    const hrvValues = windowLogs.map(l => Number(l.hrv));
    const n = hrvValues.length;
    const mean = hrvValues.reduce((sum, v) => sum + v, 0) / n;
    
    let stdDev = 0;
    if (n > 1) {
      const variance = hrvValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (n - 1);
      stdDev = Math.sqrt(variance);
    } else {
      stdDev = mean * 0.1;
    }
    
    stdDev = Math.max(3, stdDev);
    
    return {
      mean,
      stdDev,
      min: mean - stdDev,
      max: mean + stdDev,
      loggedDays: n
    };
  };

  const chartData = last28Days.map(dateStr => {
    const sevenDayAvg = calculateSevenDayHrvAvg(dateStr);
    let baseline = calculateRollingHrvBaseline(dateStr);
    
    // Fallback: 如果當天算不出基準線，但整體有資料，用整體資料做個預設包絡線防呆
    if (!baseline && activeLogs.length > 0) {
      const hrvVals = activeLogs.map(l => Number(l.hrv));
      const mean = hrvVals.reduce((sum, v) => sum + v, 0) / hrvVals.length;
      let std = 0;
      if (hrvVals.length > 1) {
        const variance = hrvVals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (hrvVals.length - 1);
        std = Math.sqrt(variance);
      } else {
        std = mean * 0.1;
      }
      std = Math.max(3, std);
      baseline = { mean, stdDev: std, min: mean - std, max: mean + std, loggedDays: hrvVals.length };
    }
    
    return { dateStr, sevenDayAvg, baseline };
  });

  const yValues: number[] = [];
  chartData.forEach(d => {
    if (d.sevenDayAvg !== null) yValues.push(d.sevenDayAvg);
    if (d.baseline) {
      yValues.push(d.baseline.min);
      yValues.push(d.baseline.max);
    }
  });

  const svgWidth = 420;
  const svgHeight = 140;
  const paddingX = 35;
  const paddingY = 22;

  let hasData = yValues.length > 0;
  const minVal = hasData ? Math.min(...yValues) : 0;
  const maxVal = hasData ? Math.max(...yValues) : 100;
  
  const chartMin = Math.max(0, Math.floor(minVal - 2));
  const chartMax = Math.ceil(maxVal + 2);
  
  const totalPoints = chartData.length;
  const getX = (idx: number) => paddingX + (idx / (totalPoints - 1)) * (svgWidth - 2 * paddingX);
  const getY = (val: number) => {
    if (chartMax === chartMin) return svgHeight / 2;
    return paddingY + (1 - (val - chartMin) / (chartMax - chartMin)) * (svgHeight - 2 * paddingY);
  };

  const topPoints: string[] = [];
  const bottomPoints: string[] = [];
  chartData.forEach((d, idx) => {
    if (d.baseline) {
      const x = getX(idx);
      topPoints.push(`${x},${getY(d.baseline.max)}`);
      bottomPoints.unshift(`${x},${getY(d.baseline.min)}`);
    }
  });

  const polygonPoints = [...topPoints, ...bottomPoints].join(" ");
  const topPath = "M " + topPoints.map(p => p.replace(",", " ")).join(" L ");
  const bottomPath = "M " + bottomPoints.reverse().map(p => p.replace(",", " ")).join(" L ");

  const todayStr = new Date().toLocaleDateString('en-CA');
  const todayLog = activeLogs.find(l => l.date === todayStr);
  const todayHrv = todayLog?.hrv ? Number(todayLog.hrv) : null;
  const latestBaseline = chartData[chartData.length - 1]?.baseline;

  let statusText = '無資料';
  let statusColorClass = 'bg-stone-100 text-stone-500';
  let explanation = '資料量不足。請持續記錄 HRV 以便計算 7 天平均與 21 天個人基準線，為您解析生理狀態。';

  const current7DayAvg = chartData[chartData.length - 1]?.sevenDayAvg;
  if (current7DayAvg !== null && latestBaseline) {
    if (current7DayAvg < latestBaseline.min) {
      statusText = '較差';
      statusColorClass = 'bg-[#d4a373]/20 text-[#d4a373]';
      explanation = '過去 7 天的平均 HRV 顯著偏低。可能與長期疲勞累積、持續壓力、或身體正在對抗疾病有關，建議安排額外的休息與恢復。';
    } else if (current7DayAvg > latestBaseline.max) {
      statusText = '極佳';
      statusColorClass = 'bg-blue-100 text-blue-600'; // 舊版沒定這顏色，抓個藍色
      explanation = '過去 7 天的平均 HRV 高於您的個人基線。這通常代表您的身體正在對新壓力產生代償反應，也可能是準備進入更佳狀態的徵兆。';
    } else {
      statusText = '平衡';
      statusColorClass = 'bg-[#7f8e81]/20 text-[#7f8e81]';
      explanation = '過去 7 天的平均 HRV 落在您的個人基線內。這代表您的自主神經系統平衡穩定，身體正在有效平衡訓練與生活壓力。';
    }
  }

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm transition-opacity">
      <div className="absolute inset-0" onClick={onClose} />
      
      <div className="relative bg-[#fdfdfc] w-full max-w-md rounded-2xl shadow-2xl border border-stone-200 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        <div className="flex items-center justify-between p-4 border-b border-stone-100 shrink-0">
          <h2 className="text-lg font-bold text-stone-800 flex items-center gap-2">
            <Activity size={20} className="text-stone-700" /> HRV 趨勢與統計
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-stone-50 text-stone-400 hover:bg-stone-200 hover:text-stone-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto custom-scrollbar flex flex-col gap-4">
          
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-2 bg-stone-50 p-4 rounded-xl border border-stone-100">
            <div className="flex flex-col items-center justify-center border-r border-stone-200/60 pr-2">
              <span className="text-xl font-black text-stone-700">{todayHrv || '-'}<span className="text-xs font-medium ml-1">ms</span></span>
              <span className="text-[11px] text-stone-500 font-medium mt-1">今日 HRV</span>
            </div>
            <div className="flex flex-col items-center justify-center border-r border-stone-200/60 px-2 text-center">
              <span className="text-[15px] font-black text-stone-700">
                {latestBaseline ? `${Math.round(latestBaseline.min)} - ${Math.round(latestBaseline.max)}` : '-'}
              </span>
              <span className="text-[10px] text-stone-500 font-medium mt-1 leading-tight">個人基準線<br/>(±1 SD)</span>
            </div>
            <div className="flex flex-col items-center justify-center pl-2">
              <span className={`text-sm font-bold px-2 py-1 rounded-full flex items-center gap-1.5 ${statusColorClass}`}>
                <span className="w-2 h-2 rounded-full bg-current"></span> {statusText}
              </span>
            </div>
          </div>

          <div className="bg-[#fffdf7] border-l-4 border-[#d4a373]/30 rounded-r-xl p-3 text-[13px] text-stone-600 leading-relaxed">
            {explanation}
          </div>

          <h4 className="font-bold text-stone-700 text-sm mt-2">近 28 天 HRV 趨勢與基準線</h4>
          
          {/* SVG Chart */}
          <div className="w-full relative bg-white border border-stone-100 rounded-xl overflow-hidden mt-1 shadow-sm">
            {!hasData ? (
              <div className="h-[180px] flex items-center justify-center text-sm text-stone-400">
                尚無充足 HRV 數據紀錄
              </div>
            ) : (
              <div className="w-full aspect-[3/1] min-h-[160px]">
                <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} width="100%" height="100%" style={{ overflow: 'visible' }}>
                  {topPoints.length > 0 && (
                    <>
                      <polygon points={polygonPoints} fill="rgba(120, 120, 120, 0.08)" stroke="none" />
                      <path d={topPath} fill="none" stroke="rgba(120, 120, 120, 0.28)" strokeWidth="1" strokeDasharray="3,3" />
                      <path d={bottomPath} fill="none" stroke="rgba(120, 120, 120, 0.28)" strokeWidth="1" strokeDasharray="3,3" />
                    </>
                  )}

                  {chartData.map((d, idx) => {
                    const x = getX(idx);
                    const isLabelNode = idx % 7 === 6 || idx === totalPoints - 1 || idx === 0;
                    
                    const labels = [];
                    if (isLabelNode) {
                      const dateObj = new Date(d.dateStr);
                      const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
                      labels.push(
                        <text key={`d-${idx}`} x={x} y="125" textAnchor="middle" fontSize="9" fill="#a8a29e" fontWeight="500">
                          {d.dateStr.substring(8, 10)}
                        </text>
                      );
                      labels.push(
                        <text key={`w-${idx}`} x={x} y="136" textAnchor="middle" fontSize="8" fill="#d6d3d1">
                          ({weekdays[dateObj.getDay()]})
                        </text>
                      );
                    }

                    if (d.sevenDayAvg !== null) {
                      const y = getY(d.sevenDayAvg);
                      let isBalanced = true;
                      let color = "#7f8e81";
                      if (d.baseline && (d.sevenDayAvg < d.baseline.min || d.sevenDayAvg > d.baseline.max)) {
                        isBalanced = false;
                        color = "#d4a373";
                      }

                      const node = isBalanced ? (
                        <circle key={`c-${idx}`} cx={x} cy={y} r="3.5" fill={color} stroke="#ffffff" strokeWidth="1.5" style={{ filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.1))' }} />
                      ) : (
                        <rect key={`r-${idx}`} x={x - 3.5} y={y - 3.5} width="7" height="7" fill={color} stroke="#ffffff" strokeWidth="1.5" rx="1.5" style={{ filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.1))' }} />
                      );

                      const valLabel = idx === totalPoints - 1 ? (
                        <text key={`v-${idx}`} x={x} y={y - 10} textAnchor="middle" fontSize="9" fill="#57534e" fontWeight="bold">
                          {d.sevenDayAvg}
                        </text>
                      ) : null;

                      return <g key={`g-${idx}`}>{labels}{node}{valLabel}</g>;
                    } else {
                      // 無資料輔助點
                      return (
                        <g key={`g-${idx}`}>
                          {labels}
                          <circle cx={x} cy={getY(chartMin + (chartMax - chartMin) / 2)} r="1.5" fill="rgba(150,150,150,0.15)" />
                        </g>
                      );
                    }
                  })}
                </svg>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-stone-500 justify-center mt-1 pb-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#7f8e81]"></span> 平衡
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-[#d4a373]"></span> 較差 / 極佳
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 bg-stone-200/50 border-y border-dashed border-stone-300"></div> 基準線範圍 (±1 SD)
            </div>
          </div>
          
        </div>
      </div>
    </div>,
    document.body
  ) : null;
}

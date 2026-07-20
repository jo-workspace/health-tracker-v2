'use client';
import { useState } from 'react';
import { Activity } from 'lucide-react';
import type { SleepLog, SyncPayload } from '@/lib/types';
import HRVDetailModal from './HRVDetailModal';

interface Props {
  data?: SleepLog[];
  updateData: (payload: SyncPayload) => void;
}

export default function HRVCard({ data = [], updateData }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const activeLogs = data.filter(log => log.status !== 'deleted' && log.type === 'night' && log.hrv);

  const todayStr = new Date().toLocaleDateString('en-CA');
  const todayLog = activeLogs.find(log => log.date === todayStr);
  const todayHrv = todayLog?.hrv ? Number(todayLog.hrv) : null;

  // 💡 HRV 個人基準線計算
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

  let baseline = calculateRollingHrvBaseline(todayStr);
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

  const current7DayAvg = calculateSevenDayHrvAvg(todayStr);

  let statusText = '';
  let statusColorClass = '';
  
  if (current7DayAvg !== null && baseline) {
    if (current7DayAvg < baseline.min) {
      statusText = '較差';
      statusColorClass = 'bg-[#d4a373]/20 text-[#d4a373]';
    } else if (current7DayAvg > baseline.max) {
      statusText = '極佳';
      statusColorClass = 'bg-blue-100 text-blue-600';
    } else {
      statusText = '平衡';
      statusColorClass = 'bg-[#7f8e81]/20 text-[#7f8e81]';
    }
  }

  return (
    <>
      <div onClick={() => setIsModalOpen(true)} className="w-full max-w-md mx-auto bg-[#fdfdfc] rounded-lg shadow-sm border border-stone-200 transition-all hover:shadow-md cursor-pointer group">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-[#5c697b]">
                <Activity size={18} strokeWidth={2.5} className="text-[#7f8e81]" />
                <h3 className="font-bold text-stone-700 text-base">HRV</h3>
              </div>
              <div>
                {statusText && (
                  <span className={`px-2 py-1 text-[11px] font-bold rounded-md flex items-center gap-1.5 ${statusColorClass}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current"></span> {statusText}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-baseline gap-1">
              <span className="text-[22px] font-extrabold text-[#444] leading-none">{todayHrv || '-'}</span>
              <span className="text-stone-400 font-medium text-xs">ms</span>
            </div>
          </div>
        </div>
      </div>

      <HRVDetailModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        sleepLogs={data} 
      />
    </>
  );
}

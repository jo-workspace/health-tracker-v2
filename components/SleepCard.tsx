'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Moon, Plus } from 'lucide-react';
import type { SleepLog, SyncPayload } from '@/lib/types';
import SleepDetailModal from './SleepDetailModal';
import SleepFormModal from './forms/SleepFormModal';

interface Props {
  data?: SleepLog[];
  updateData: (payload: SyncPayload) => void;
  forceSync?: () => Promise<void>;
}
export default function SleepCard({ data = [], updateData, forceSync }: Props) {
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<SleepLog | null>(null);
  const [defaultDate, setDefaultDate] = useState('');
  const [defaultType, setDefaultType] = useState<'night' | 'nap'>('night');
  
  const [isAutoPromptOpen, setIsAutoPromptOpen] = useState(false);
  const [hasCheckedAutoPrompt, setHasCheckedAutoPrompt] = useState(false);

  const openFormWithSync = (dateStr: string, typeVal: 'night' | 'nap', logToEdit?: SleepLog | null) => {
    forceSync?.();
    setEditingLog(logToEdit || null);
    setDefaultDate(dateStr);
    setDefaultType(typeVal);
    setIsFormModalOpen(true);
  };

  const activeLogs = data.filter(log => log.status !== 'deleted');

  // 取得今天與昨天的日期字串
  const todayStr = new Date().toLocaleDateString('en-CA');
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toLocaleDateString('en-CA');

  const dismissPrompt = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`dismissed_sleep_prompt_${todayStr}`, 'true');
    }
    setIsAutoPromptOpen(false);
  };

  // 自動偵測今天/昨天是否有主睡眠紀錄
  useEffect(() => {
    if (activeLogs.length > 0 && !hasCheckedAutoPrompt) {
      const isDismissed = typeof window !== 'undefined' && sessionStorage.getItem(`dismissed_sleep_prompt_${todayStr}`);
      if (!isDismissed) {
        // 檢查「今天」或「昨天」是否有主睡眠紀錄
        const hasRecentNightSleep = activeLogs.some(
          log => (log.date === todayStr || log.date === yesterdayStr) && log.type === 'night'
        );
        if (!hasRecentNightSleep) {
          setIsAutoPromptOpen(true);
        }
      }
      setHasCheckedAutoPrompt(true);
    }
  }, [activeLogs, todayStr, yesterdayStr, hasCheckedAutoPrompt]);

  // 找出今天最近的一筆主睡眠 (通常記在今天，但代表昨晚) 
  // 或是最後一筆有效的主睡眠來顯示
  const FEELING_MAP: Record<string, string> = {
    "excellent": "🤩",
    "normal": "🙂",
    "tired": "🥱",
    "sore": "🥵",
    "poor": "🤢"
  };

  const todayNightSleep = activeLogs.find(log => log.date === todayStr && log.type === 'night');
  const latestNightSleep = todayNightSleep || [...activeLogs].reverse().find(log => log.type === 'night');

  const sleepHours = latestNightSleep ? Number(latestNightSleep.sleepDuration) : 0;
  const deepSleepHours = latestNightSleep?.deepSleep ? Number(latestNightSleep.deepSleep) : 0;
  const remSleepHours = latestNightSleep?.remSleep ? Number(latestNightSleep.remSleep) : 0;
  const restingHeartRate = latestNightSleep?.restingHeartRate || 0;
  const feelingKey = latestNightSleep?.feeling || 'normal';
  const feeling = FEELING_MAP[feelingKey] || feelingKey;

  // 小睡統計 (計算今天的)
  const todayNaps = activeLogs.filter(log => log.date === todayStr && log.type === 'nap');
  const napHours = todayNaps.reduce((sum, n) => sum + Number(n.sleepDuration), 0);

  const displayTotalHours = sleepHours + napHours;

  const total = deepSleepHours + remSleepHours + Math.max(0, sleepHours - deepSleepHours - remSleepHours);
  const lightSleepHours = Math.max(0, sleepHours - deepSleepHours - remSleepHours);
  
  const pDeep = total > 0 ? (deepSleepHours / total) * 100 : 0;
  const pRem = total > 0 ? (remSleepHours / total) * 100 : 0;
  const pLight = total > 0 ? (lightSleepHours / total) * 100 : 0;

  return (
    <>
      <div 
        onClick={() => {
          forceSync?.();
          setIsDetailModalOpen(true);
        }} 
        className="w-full max-w-md mx-auto bg-[#fdfdfc] rounded-lg shadow-sm border border-stone-200 mb-4 transition-all hover:shadow-md cursor-pointer group relative"
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-[#5c697b] flex-wrap">
              <Moon size={18} strokeWidth={2.5} />
              <h3 className="font-bold text-stone-700 text-base">睡眠追蹤</h3>
              
              <div className="flex gap-1">
                {deepSleepHours >= 1.5 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-[#f0f4f8] text-[#5b7391] border border-[#e2e8f0]">
                    🧬 深度修復
                  </span>
                )}
                {displayTotalHours >= 7 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-[#fcf5f5] text-[#a07d7e] border border-[#f5e6e7]">
                    🔋 滿電
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-baseline gap-1 shrink-0">
              <span className="text-2xl font-extrabold text-[#444]">{displayTotalHours > 0 ? displayTotalHours.toFixed(1) : '-'}</span>
              <span className="text-stone-400 font-medium text-xs">h</span>
              <span className="text-xl ml-1">{feeling}</span>
            </div>
          </div>

          <div className="space-y-2 mb-3">
            <div className="flex w-full h-2.5 rounded-full overflow-hidden bg-stone-100">
              <div className="bg-[#70819c] transition-all duration-500" style={{ width: `${pDeep}%` }} title="深眠" />
              <div className="bg-[#b99e9f] transition-all duration-500" style={{ width: `${pRem}%` }} title="REM" />
              <div className="bg-[#bac5bc] transition-all duration-500" style={{ width: `${pLight}%` }} title="淺眠" />
            </div>
            <div className="flex justify-between text-xs text-stone-500 font-medium">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#70819c]"></span> 深眠 {deepSleepHours.toFixed(1)}h
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#b99e9f]"></span> REM {remSleepHours.toFixed(1)}h
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center text-sm text-stone-500 font-medium border-t border-stone-100 pt-2">
            <div>
              小睡：{napHours > 0 ? `${napHours.toFixed(1)}h` : '無'}
            </div>
            <div>
              靜心：{restingHeartRate || '-'}
            </div>
          </div>
        </div>

        {/* 浮動新增按鈕組 (小睡 & 主睡眠) */}
        <div className="absolute -top-3 -right-1.5 flex items-center gap-1.5 z-10">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              openFormWithSync(new Date().toLocaleDateString('en-CA'), 'nap');
            }}
            className="w-7 h-7 bg-white border border-stone-200 rounded-full flex items-center justify-center text-stone-500 hover:bg-stone-50 hover:text-stone-800 shadow-sm transition-colors"
            title="新增小睡"
          >
            <span className="text-[11px]">💤</span>
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              openFormWithSync(new Date().toLocaleDateString('en-CA'), 'night');
            }}
            className="w-8 h-8 bg-white border border-stone-200 rounded-full flex items-center justify-center text-stone-500 hover:bg-stone-50 hover:text-stone-800 shadow-sm transition-colors"
            title="新增睡眠紀錄"
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
      />

      {/* 自動偵測提醒 */}
      {isAutoPromptOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={dismissPrompt} />
          <div className="relative bg-[#fdfdfc] w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Moon size={24} />
            </div>
            <h3 className="text-lg font-bold text-stone-800 mb-2">🔔 睡眠紀錄提醒</h3>
            <p className="text-sm text-stone-500 mb-6 leading-relaxed">
              偵測到您昨天（{yesterdayStr}）尚未填寫夜間主睡眠紀錄。健康的睡眠是活力的基石，建議立即花費 30 秒登錄昨晚狀況！
            </p>
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => {
                  dismissPrompt();
                  openFormWithSync(yesterdayStr, 'night');
                }}
                className="w-full py-2.5 bg-[#6ba388] text-white font-bold rounded-xl hover:bg-[#5b8c74] transition-colors"
              >
                📝 立即填寫
              </button>
              <button 
                onClick={() => {
                  dismissPrompt();
                  const emptyLog = {
                    id: `sleep-${Date.now()}`,
                    date: yesterdayStr,
                    type: 'night',
                    sleepDuration: '0',
                    lastUpdated: Date.now().toString()
                  } as SleepLog;
                  updateData({ sleepLogs: [emptyLog], clientTimestamp: Date.now() });
                }}
                className="w-full py-2.5 bg-stone-100 text-stone-600 font-bold rounded-xl hover:bg-stone-200 transition-colors"
              >
                當日無紀錄
              </button>
              <button 
                onClick={dismissPrompt}
                className="w-full py-2.5 text-stone-400 text-sm font-medium hover:text-stone-600 transition-colors"
              >
                稍後再說
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 新增/編輯睡眠表單 */}
      <SleepFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        initialData={editingLog}
        defaultDate={defaultDate}
        defaultType={defaultType}
        onSave={(logData) => {
          const newLogs = [...activeLogs.filter(l => l.id !== logData.id), logData as SleepLog];
          updateData({ sleepLogs: newLogs, clientTimestamp: Date.now() });
        }}
      />
    </>
  );
}

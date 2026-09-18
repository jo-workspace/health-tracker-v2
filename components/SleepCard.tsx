'use client';
import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Moon, Plus, PenLine, Smile, Meh, Frown, Coffee } from 'lucide-react';
import type { SleepLog, AllergyLog, SupplementLog, BiteSplintLog, SyncPayload, SupplementSetting } from '@/lib/types';
import { isBedtimeSupplement, PREDEFINED_SUPPLEMENTS } from '@/lib/supplements';
import SleepDetailModal from './SleepDetailModal';
import SleepFormModal from './forms/SleepFormModal';

interface Props {
  data?: SleepLog[];
  allergyLogs?: AllergyLog[];
  supplementLogs?: SupplementLog[];
  supplementSettings?: SupplementSetting[];
  splintLogs?: BiteSplintLog[];
  updateData: (payload: SyncPayload) => void;
  forceSync?: () => Promise<void>;
  initialSynced?: boolean;
}
export default function SleepCard({ data = [], allergyLogs = [], supplementLogs = [], supplementSettings = [], splintLogs = [], updateData, forceSync, initialSynced = false }: Props) {
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<SleepLog | null>(null);
  const [defaultDate, setDefaultDate] = useState('');
  const [defaultType, setDefaultType] = useState<'night' | 'nap'>('night');
  
  const [isAutoPromptOpen, setIsAutoPromptOpen] = useState(false);
  const [hasTimeoutFired, setHasTimeoutFired] = useState(false);
  const [todayStr, setTodayStr] = useState(() => new Date().toLocaleDateString('en-CA'));
  const hasCheckedAutoPromptRef = useState<{ date: string }>({ date: '' })[0];

  const openForm = (dateStr: string, typeVal: 'night' | 'nap', logToEdit?: SleepLog | null) => {
    setEditingLog(logToEdit || null);
    setDefaultDate(dateStr);
    setDefaultType(typeVal);
    setIsFormModalOpen(true);
  };

  const activeLogs = useMemo(() => data.filter(log => log.status !== 'deleted'), [data]);

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

  // 雲端同步感知之睡眠提醒判斷
  useEffect(() => {
    // 檢查今天是否有主睡眠紀錄
    const hasTodayNightSleep = activeLogs.some(
      log => log.date === todayStr && log.type === 'night'
    );

    // 若已存在今天紀錄，立即關閉提醒
    if (hasTodayNightSleep) {
      setIsAutoPromptOpen(false);
      return;
    }

    // 尚未完成首次雲端同步時不急著彈窗（避免 B 裝置拿舊快取誤跳）
    // 但設定 2.5 秒超時保護以防離線
    if (!initialSynced && !hasTimeoutFired) {
      const timer = setTimeout(() => {
        setHasTimeoutFired(true);
      }, 2500);
      return () => clearTimeout(timer);
    }

    // 當日若已檢查過則不重複觸發
    if (hasCheckedAutoPromptRef.date === todayStr) {
      return;
    }

    const isDismissed =
      typeof window !== 'undefined' &&
      sessionStorage.getItem(`dismissed_sleep_prompt_${todayStr}`);

    if (!isDismissed && !hasTodayNightSleep) {
      setIsAutoPromptOpen(true);
    }
    hasCheckedAutoPromptRef.date = todayStr;
  }, [activeLogs, todayStr, initialSynced, hasTimeoutFired, hasCheckedAutoPromptRef]);

  const renderFeelingIcon = (key: string) => {
    if (['great', 'excellent', 'good'].includes(key)) {
      return (
        <span title="良好" className="inline-flex items-center">
          <Smile size={18} className="text-[#3e7256]" />
        </span>
      );
    }
    if (['bad', 'poor', 'tired', 'sore'].includes(key)) {
      return (
        <span title="疲憊" className="inline-flex items-center">
          <Frown size={18} className="text-[#a07d7e]" />
        </span>
      );
    }
    return (
      <span title="普通" className="inline-flex items-center">
        <Meh size={18} className="text-[#788896]" />
      </span>
    );
  };

  const sortedNightLogs = activeLogs
    .filter(log => log.type === 'night')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latestNightSleep = sortedNightLogs[0];

  const sleepHours = latestNightSleep ? Number(latestNightSleep.sleepDuration) : 0;
  const feelingKey = latestNightSleep?.feeling || 'normal';

  // 小睡統計 (計算今天的)
  const todayNaps = activeLogs.filter(log => log.date === todayStr && log.type === 'nap');
  const napHours = todayNaps.reduce((sum, n) => sum + Number(n.sleepDuration), 0);

  const displayTotalHours = sleepHours + napHours;
  const pGoal = Math.min(100, Math.round((displayTotalHours / 7) * 100));

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
              
              <div className="flex gap-1">
                {displayTotalHours >= 7 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-[#eaf5ef] text-[#3e7256] border border-[#d8ece1]">
                    達標 7h
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-[#444]">{displayTotalHours > 0 ? displayTotalHours.toFixed(1) : '-'}</span>
                <span className="text-stone-400 font-medium text-xs">h</span>
              </div>
              <div className="flex items-center">
                {renderFeelingIcon(feelingKey)}
              </div>
            </div>
          </div>

          <div className="space-y-1.5 mb-3">
            <div className="flex justify-between text-[11px] text-stone-500 font-medium">
              <span>目標 7 小時</span>
              <span>{pGoal}%</span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden bg-stone-100">
              <div 
                className="h-full bg-[#5c697b] transition-all duration-500 rounded-full" 
                style={{ width: `${pGoal}%` }} 
              />
            </div>
          </div>

          <div className="flex justify-between items-center text-xs text-stone-500 font-medium border-t border-stone-100 pt-2">
            <div>
              上床：{latestNightSleep?.bedtime || '-'}
            </div>
            <div>
              小睡：{napHours > 0 ? `${napHours.toFixed(1)}h` : '無'}
            </div>
          </div>
        </div>

        {/* 浮動新增按鈕組 (小睡 & 主睡眠) */}
        <div className="absolute -top-3 -right-1.5 flex items-center gap-1.5 z-10">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              openForm(new Date().toLocaleDateString('en-CA'), 'nap');
            }}
            className="w-7 h-7 bg-white border border-stone-200 rounded-full flex items-center justify-center text-stone-500 hover:bg-stone-50 hover:text-stone-800 shadow-sm transition-colors"
            title="新增小睡"
          >
            <Coffee size={12} />
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              const todayStr = new Date().toLocaleDateString('en-CA');
              const existingLog = activeLogs.find(l => l.date === todayStr && l.type === 'night');
              openForm(todayStr, 'night', existingLog || null);
            }}
            className="w-8 h-8 bg-white border border-stone-200 rounded-full flex items-center justify-center text-stone-500 hover:bg-stone-50 hover:text-stone-800 shadow-sm transition-colors"
            title={activeLogs.some(l => l.date === new Date().toLocaleDateString('en-CA') && l.type === 'night') ? "編輯今日睡眠紀錄" : "新增睡眠紀錄"}
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
        onEditDay={(dateStr) => {
          setIsDetailModalOpen(false);
          const existing = activeLogs.find(l => l.date === dateStr && l.type === 'night');
          openForm(dateStr, 'night', existing || null);
        }}
      />

      {/* 自動偵測提醒 */}
      {isAutoPromptOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={dismissPrompt} />
          <div className="relative bg-[#fdfdfc] w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center animate-in zoom-in-95 duration-200 border border-stone-200">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-200">
              <Moon size={22} />
            </div>
            <h3 className="text-base font-bold text-stone-800 mb-1.5">睡眠紀錄提醒</h3>
            <p className="text-xs text-stone-500 mb-5 leading-relaxed">
              尚未登錄 {todayStr} 昨晚的主睡眠紀錄。
            </p>
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => {
                  dismissPrompt();
                  openForm(todayStr, 'night');
                }}
                className="w-full py-2.5 bg-[#6ba388] text-white text-xs font-bold rounded-xl hover:bg-[#5b8c74] transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <PenLine size={14} /> 立即填寫
              </button>
              <button 
                onClick={() => {
                  dismissPrompt();
                  const emptyLog = {
                    id: `sleep-${Date.now()}`,
                    date: todayStr,
                    type: 'night',
                    sleepDuration: '0',
                    lastUpdated: Date.now().toString()
                  } as SleepLog;
                  updateData({ sleepLogs: [emptyLog], clientTimestamp: Date.now() });
                }}
                className="w-full py-2.5 bg-stone-100 text-stone-600 text-xs font-bold rounded-xl hover:bg-stone-200 transition-colors"
              >
                當日無紀錄
              </button>
              <button 
                onClick={dismissPrompt}
                className="w-full py-2 text-stone-400 text-xs font-medium hover:text-stone-600 transition-colors"
              >
                稍後再說
              </button>
            </div>
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
        onSave={(logData, hasBiteSplint, hasBedtimeSupplements) => {
          let newLogs = [...data];

          if (logData.type === 'night') {
            const existingIndex = newLogs.findIndex(
              l => l.date === logData.date && l.type === 'night' && l.status !== 'deleted'
            );
            if (existingIndex >= 0) {
              newLogs[existingIndex] = {
                ...newLogs[existingIndex],
                ...logData,
                status: 'active',
                lastUpdated: Date.now().toString()
              };
            } else {
              newLogs.push({
                ...logData,
                id: logData.id || crypto.randomUUID(),
                status: 'active',
                lastUpdated: Date.now().toString()
              } as SleepLog);
            }
          } else {
            const existingIndex = logData.id ? newLogs.findIndex(l => l.id === logData.id) : -1;
            if (existingIndex >= 0) {
              newLogs[existingIndex] = {
                ...newLogs[existingIndex],
                ...logData,
                status: 'active',
                lastUpdated: Date.now().toString()
              };
            } else {
              newLogs.push({
                ...logData,
                id: logData.id || crypto.randomUUID(),
                status: 'active',
                lastUpdated: Date.now().toString()
              } as SleepLog);
            }
          }

          let updatedSplintLogs = [...splintLogs];
          if (hasBiteSplint !== undefined && logData.date && logData.type === 'night') {
            const [y, m, d] = logData.date.split('-').map(Number);
            const prevDateObj = new Date(y, m - 1, d - 1);
            const prevDate = prevDateObj.toLocaleDateString('en-CA');

            // 尋找昨晚睡前 (prevDate) 或當天 (logData.date) 已存在的有效紀錄
            const existingSplintIndex = updatedSplintLogs.findIndex(
              l => (l.date === prevDate || l.date === logData.date) && l.status !== 'deleted'
            );
            if (hasBiteSplint) {
              if (existingSplintIndex >= 0) {
                updatedSplintLogs[existingSplintIndex] = {
                  ...updatedSplintLogs[existingSplintIndex],
                  status: 'active',
                  lastUpdated: Date.now()
                };
              } else {
                // 咬合板是在昨晚睡前配戴，以 prevDate 記錄
                updatedSplintLogs.push({
                  id: crypto.randomUUID(),
                  date: prevDate,
                  status: 'active',
                  lastUpdated: Date.now()
                });
              }
            } else {
              // 若取消勾選，把符合 prevDate 或 logData.date 的紀錄都設為 deleted
              updatedSplintLogs = updatedSplintLogs.map(l => {
                if ((l.date === prevDate || l.date === logData.date) && l.status !== 'deleted') {
                  return { ...l, status: 'deleted', lastUpdated: Date.now() };
                }
                return l;
              });
            }
          }

          let updatedSuppLogs = [...supplementLogs];
          if (hasBedtimeSupplements !== undefined && logData.date && logData.type === 'night') {
            const [y, m, d] = logData.date.split('-').map(Number);
            const prevDateObj = new Date(y, m - 1, d - 1);
            const prevDate = prevDateObj.toLocaleDateString('en-CA');

            const activeSettings = supplementSettings && supplementSettings.length > 0
              ? supplementSettings.filter(s => s.status !== 'deleted' && s.status !== 'paused')
              : PREDEFINED_SUPPLEMENTS.filter(s => s.id !== '11').map(s => ({ ...s, targetAmount: '1', status: 'active' }));

            const bedtimeSettings = activeSettings.filter(s => isBedtimeSupplement(s.time, s.name));

            const existingSuppIndex = updatedSuppLogs.findIndex(
              l => l.date === prevDate && l.status !== 'deleted'
            );

            let currentItems: any[] = [];
            if (existingSuppIndex >= 0 && updatedSuppLogs[existingSuppIndex].items) {
              try {
                currentItems = JSON.parse(updatedSuppLogs[existingSuppIndex].items);
              } catch {
                currentItems = [];
              }
            } else {
              currentItems = activeSettings.map(s => ({
                id: s.id,
                name: s.name === '鎂' ? '甘胺酸鎂' : s.name,
                time: s.time,
                taken: false,
                amount: 0,
                targetAmount: parseInt(s.targetAmount, 10) || 1,
                ignored: false
              }));
            }

            // 更新或標記睡前項目
            const updatedItems = currentItems.map(item => {
              if (isBedtimeSupplement(item.time, item.name)) {
                const target = item.targetAmount || 1;
                return {
                  ...item,
                  taken: hasBedtimeSupplements,
                  amount: hasBedtimeSupplements ? target : 0,
                  ignored: false
                };
              }
              return item;
            });

            // 若原本缺少設定中啟用的睡前品項，補上
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
                  ignored: false
                });
              }
            });

            if (existingSuppIndex >= 0) {
              updatedSuppLogs[existingSuppIndex] = {
                ...updatedSuppLogs[existingSuppIndex],
                items: JSON.stringify(updatedItems),
                status: 'active',
                lastUpdated: Date.now().toString()
              };
            } else {
              updatedSuppLogs.push({
                id: `supp-${prevDate}`,
                date: prevDate,
                items: JSON.stringify(updatedItems),
                status: 'active',
                lastUpdated: Date.now().toString()
              });
            }
          }

          updateData({
            sleepLogs: newLogs,
            biteSplintLogs: updatedSplintLogs,
            supplementLogs: updatedSuppLogs,
            clientTimestamp: Date.now()
          });
        }}
        />
      )}
    </>
  );
}

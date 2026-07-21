'use client';
import { useState, useEffect, useRef } from 'react';
import { Pill, Check, Plus, Minus, Clock, ChevronRight, X, Ban } from 'lucide-react';
import type { SupplementLog, SupplementSetting, SyncPayload } from '@/lib/types';

interface Supplement {
  id: string;
  name: string;
  time: string;
  taken: boolean;
  amount?: number;
  targetAmount?: number;
  ignored?: boolean;
  isCustom?: boolean;
}

interface Props {
  data?: SupplementLog[];
  settings?: SupplementSetting[];
  updateData: (payload: SyncPayload) => void;
}

const PREDEFINED_SUPPLEMENTS: Supplement[] = [
  { id: '1', name: 'Avamys', time: '早上起床', taken: false, ignored: false },
  { id: '2', name: 'D3 (2000 IU)', time: '隨餐', taken: false, ignored: false },
  { id: '3', name: '鋅', time: '隨餐', taken: false, ignored: false },
  { id: '4', name: '鐵', time: '隨餐', taken: false, ignored: false },
  { id: '5', name: 'Q10', time: '隨餐', taken: false, ignored: false },
  { id: '6', name: 'PQQ', time: '隨餐', taken: false, ignored: false },
  { id: '7', name: '魚油', time: '周一~五', taken: false, ignored: false },
  { id: '8', name: '葉黃素', time: '周一~五', taken: false, ignored: false },
  { id: '9', name: '鎂', time: '晚餐時', taken: false, ignored: false },
  { id: '10', name: '維他命 C', time: '晚餐時', taken: false, ignored: false },
];

export default function SupplementTracker({ data, settings, updateData }: Props) {
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitializedSettings = useRef(false);
  
  const todayStr = new Date().toLocaleDateString('en-CA');
  const todayLog = data?.find(log => log.date === todayStr);

  // 初始化 SupplementSettings (如果雲端是空的)
  useEffect(() => {
    if (settings && settings.length === 0 && !hasInitializedSettings.current) {
      hasInitializedSettings.current = true;
      const defaultSettings = PREDEFINED_SUPPLEMENTS.map(s => ({
        id: s.id,
        name: s.name,
        time: s.time,
        targetAmount: '1',
        status: 'active',
        lastUpdated: Date.now().toString()
      }));
      updateData({ supplementSettings: defaultSettings, clientTimestamp: Date.now() });
    }
  }, [settings, updateData]);

  // 基底名單：優先使用 Google Sheets 的設定，若無則用預設
  const baseSupplements: Supplement[] = settings && settings.length > 0
    ? settings.filter(s => s.status !== 'deleted').map(s => ({
        id: s.id,
        name: s.name,
        time: s.time,
        taken: false,
        amount: 0,
        ignored: false,
        targetAmount: parseInt(s.targetAmount, 10) || 1
      }))
    : PREDEFINED_SUPPLEMENTS.map(s => ({ ...s, targetAmount: 1 }));

  useEffect(() => {
    if (todayLog && todayLog.items) {
      try {
        const parsed: Supplement[] = JSON.parse(todayLog.items);
        const merged = baseSupplements.map(base => {
          const logged = parsed.find(p => p.id === base.id);
          if (logged) {
            return { ...base, taken: logged.taken, amount: logged.amount, ignored: logged.ignored };
          }
          
          let autoIgnored = false;
          const day = new Date().getDay();
          const isWeekend = day === 0 || day === 6;
          if ((base.time.includes('周一~五') || base.time.includes('一~五') || base.time.includes('平日')) && isWeekend) {
            autoIgnored = true;
          }
          if ((base.time.includes('週末') || base.time.includes('假日') || base.time.includes('六日')) && !isWeekend) {
            autoIgnored = true;
          }
          
          return { ...base, ignored: autoIgnored };
        });
        const customLogs = parsed.filter(p => p.isCustom);
        setSupplements([...merged, ...customLogs]);
      } catch (e) {
        setSupplements(baseSupplements.map(s => {
          let autoIgnored = false;
          const day = new Date().getDay();
          const isWeekend = day === 0 || day === 6;
          if ((s.time.includes('周一~五') || s.time.includes('一~五') || s.time.includes('平日')) && isWeekend) autoIgnored = true;
          if ((s.time.includes('週末') || s.time.includes('假日') || s.time.includes('六日')) && !isWeekend) autoIgnored = true;
          return { ...s, ignored: autoIgnored };
        }));
      }
    } else {
      setSupplements(baseSupplements.map(s => {
        let autoIgnored = false;
        const day = new Date().getDay();
        const isWeekend = day === 0 || day === 6;
        if ((s.time.includes('周一~五') || s.time.includes('一~五') || s.time.includes('平日')) && isWeekend) autoIgnored = true;
        if ((s.time.includes('週末') || s.time.includes('假日') || s.time.includes('六日')) && !isWeekend) autoIgnored = true;
        return { ...s, ignored: autoIgnored };
      }));
    }
  }, [todayLog, settings]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const saveToCloud = (newState: Supplement[]) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    
    saveTimeoutRef.current = setTimeout(() => {
      updateData({
        supplementLogs: [{
          id: todayLog?.id || `supp-${todayStr}`,
          date: todayStr,
          items: JSON.stringify(newState),
          status: 'active',
          lastUpdated: Date.now().toString()
        }],
        clientTimestamp: Date.now()
      });
    }, 1000);
  };

  const hour = currentTime.getHours();
  const day = currentTime.getDay();
  const isWeekend = day === 0 || day === 6;
  const isMorning = hour >= 4 && hour < 12;
  const isEvening = hour >= 17 || hour < 4;

  const relevantSupps = supplements;

  const isFulfilled = (s: Supplement) => (s.amount || (s.taken ? 1 : 0)) >= (s.targetAmount || 1);

  const totalCount = relevantSupps.length;
  const takenCount = relevantSupps.filter(s => s.taken && isFulfilled(s)).length;
  const ignoredCount = relevantSupps.filter(s => s.ignored).length;
  
  const pTaken = totalCount === 0 ? 100 : (takenCount / totalCount) * 100;
  const pIgnored = totalCount === 0 ? 0 : (ignoredCount / totalCount) * 100;
  const progressText = totalCount === 0 ? 100 : Math.round(pTaken);
  
  const pending = relevantSupps.filter(s => !s.taken && !s.ignored || (s.taken && !isFulfilled(s)));
  
  const suggestedNow = pending.filter(s => {
    if (s.time === '早上起床') return isMorning;
    if (s.time === '晚餐時') return isEvening;
    return true; 
  });

  const toggleTaken = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSupplements(prev => {
      const newState = prev.map(s => {
        if (s.id === id) {
          const newTaken = !s.taken;
          return { 
            ...s, 
            taken: newTaken, 
            ignored: false,
            amount: newTaken ? (s.targetAmount || 1) : 0 // 直接預設加到目標數量
          };
        }
        return s;
      });
      saveToCloud(newState);
      return newState;
    });
  };

  const updateAmount = (id: string, delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSupplements(prev => {
      const newState = prev.map(s => {
        if (s.id === id) {
          const currentAmt = s.amount || 1;
          const newAmt = Math.max(1, currentAmt + delta);
          return { ...s, amount: newAmt };
        }
        return s;
      });
      saveToCloud(newState);
      return newState;
    });
  };

  const toggleIgnored = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSupplements(prev => {
      const newState = prev.map(s => s.id === id ? { ...s, ignored: !s.ignored, taken: false, amount: 0 } : s);
      saveToCloud(newState);
      return newState;
    });
  };

  const addCustomSupplement = () => {
    const name = prompt('請輸入今日額外補充的保健品名稱：');
    if (!name?.trim()) return;
    setSupplements(prev => {
      const newSupp: Supplement = {
        id: `custom-${Date.now()}`,
        name: name.trim(),
        time: '額外補充',
        taken: true,
        amount: 1,
        targetAmount: 1,
        ignored: false,
        isCustom: true
      };
      const newState = [...prev, newSupp];
      saveToCloud(newState);
      return newState;
    });
  };

  useEffect(() => {
    if (isModalOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isModalOpen]);

  const activeSupps = relevantSupps.filter(s => !s.ignored);
  const ignoredSupps = relevantSupps.filter(s => s.ignored);

  const renderSuppCard = (item: Supplement) => {
    const targetAmt = item.targetAmount || 1;
    const currentAmt = item.amount || 0;
    const full = item.taken && currentAmt >= targetAmt;
    const partial = item.taken && currentAmt > 0 && currentAmt < targetAmt;

    return (
      <div
        key={item.id}
        role="button"
        tabIndex={0}
        onClick={(e) => toggleTaken(item.id, e)}
        className={`cursor-pointer relative flex flex-col items-start p-3 rounded-lg border text-left transition-all ${
          full 
            ? 'bg-[#f4f7f4] border-[#d5e0d7] shadow-sm opacity-100' 
            : partial
              ? 'bg-[#fcf8f2] border-[#f2e6d5] shadow-sm opacity-100'
              : item.ignored 
                ? 'bg-stone-50 border-stone-200 opacity-50 grayscale'
                : 'bg-white border-stone-200 hover:border-stone-300'
        }`}
      >
        <div className={`absolute top-2 right-2 w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
          full ? 'bg-[#6ba388] border-[#6ba388]' 
          : partial ? 'bg-[#e5a045] border-[#e5a045]'
          : 'border-stone-300 bg-white'
        }`}>
          {(full || partial) && <Check size={14} className="text-white stroke-[3]" />}
        </div>
        
        <div className={`font-semibold text-sm pr-7 leading-tight mb-1.5 flex flex-wrap items-center gap-1 ${
          full ? 'text-[#3e5f4f]' 
          : partial ? 'text-[#8a5d21]'
          : item.ignored ? 'text-stone-400 line-through' 
          : 'text-stone-700'
        }`}>
          {item.name}
          {item.taken && currentAmt > 1 && (
            <span className={`text-[10px] font-black px-1 rounded-sm border ${
              full ? 'text-[#6ba388] border-[#6ba388] bg-white' : 'text-[#e5a045] border-[#e5a045] bg-white'
            }`}>
              x{currentAmt}
            </span>
          )}
          {targetAmt > 1 && !full && (
            <span className="text-[10px] font-medium text-stone-400">
              (目標: {targetAmt})
            </span>
          )}
        </div>
        
        <div className="flex items-center justify-between w-full mt-auto min-h-[24px]">
          <div className="flex items-center gap-1 text-[10px] text-stone-400 font-medium whitespace-nowrap"><Clock size={10} /> {item.time}</div>
          
          {item.taken ? (
            <div className={`flex items-center gap-2 bg-white border rounded-full px-1.5 py-0.5 z-10 ${
              full ? 'text-stone-600 border-[#d5e0d7]' : 'text-stone-600 border-[#f2e6d5]'
            }`} onClick={e => e.stopPropagation()}>
              <button onClick={(e) => updateAmount(item.id, -1, e)} className="hover:text-stone-800 disabled:opacity-30" disabled={currentAmt <= 1}>
                <Minus size={12} />
              </button>
              <span className="text-[10px] font-bold min-w-[8px] text-center">{currentAmt}</span>
              <button onClick={(e) => updateAmount(item.id, 1, e)} className="hover:text-stone-800">
                <Plus size={12} />
              </button>
            </div>
          ) : (
            !item.ignored && (
              <div onClick={(e) => toggleIgnored(item.id, e)} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-400 hover:bg-stone-200 hover:text-stone-600 transition-colors z-10">
                <Ban size={10} /> 略過
              </div>
            )
          )}
          {item.ignored && !item.taken && (
            <div onClick={(e) => toggleIgnored(item.id, e)} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-stone-200 text-stone-500 hover:bg-stone-300 hover:text-stone-700 transition-colors z-10">
              恢復
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div onClick={() => setIsModalOpen(true)} className="w-full max-w-md mx-auto bg-[#fdfdfc] rounded-lg shadow-sm border border-stone-200 mb-4 transition-all hover:shadow-md cursor-pointer group">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-[#6ba388]">
              <Pill size={18} strokeWidth={2.5} />
              <h3 className="font-bold text-stone-700 text-base">保健食品</h3>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-stone-400 font-medium">進度</span>
              <span className="text-lg font-bold text-[#6ba388]">{progressText}%</span>
            </div>
          </div>

          <div className="flex w-full h-1.5 rounded-full overflow-hidden bg-stone-100 mb-4">
            <div className="bg-[#6ba388] transition-all duration-700" style={{ width: `${pTaken}%` }} title="已服用" />
            <div className="bg-stone-300 transition-all duration-700" style={{ width: `${pIgnored}%` }} title="已略過" />
          </div>

          <div className="bg-stone-50 rounded p-3 flex items-center justify-between">
            <div className="flex-1 overflow-hidden">
              <div className="text-xs text-stone-500 font-medium mb-1">
                {suggestedNow.length > 0 ? '目前時段建議：' : (pending.length === 0 ? '🎉 今日目標已達成！' : `預告 (${pending[0]?.time || '稍後'})：`)}
              </div>
              <div className="text-sm font-semibold text-stone-700 truncate pr-4">
                {suggestedNow.length > 0 
                  ? suggestedNow.map(s => {
                      const targetStr = (s.targetAmount || 1) > 1 ? ` (x${s.targetAmount})` : '';
                      return s.name + targetStr;
                    }).join('、')
                  : pending.length > 0 
                    ? pending.filter(s => s.time === pending[0].time).map(s => {
                        const targetStr = (s.targetAmount || 1) > 1 ? ` (x${s.targetAmount})` : '';
                        return s.name + targetStr;
                      }).join('、') 
                    : '好好休息吧！'}
              </div>
            </div>
            <ChevronRight size={18} className="text-stone-300 group-hover:text-stone-500 transition-colors shrink-0" />
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-[#fdfdfc] w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)] sm:shadow-2xl border-t sm:border border-stone-200 flex flex-col max-h-[90vh] mb-0 animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-10 duration-300">
            <div className="flex items-center justify-between p-4 border-b border-stone-100 shrink-0">
              <div className="w-8 h-8" />
              <div className="w-12 h-1.5 bg-stone-200 rounded-full sm:hidden" />
              <div className="hidden sm:block text-sm font-bold text-stone-400">紀錄面板</div>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="p-4 shrink-0 flex justify-between items-end">
              <div>
                <h2 className="text-xl font-bold text-stone-800">今日紀錄</h2>
                <p className="text-xs text-stone-500 mt-1">您可以前往 Google Sheets 設定「目標數量」。</p>
              </div>
            </div>

            <div className="p-4 pt-0 overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <div className="grid grid-cols-2 gap-3 pb-4">
                {activeSupps.map(renderSuppCard)}
                
                <button onClick={addCustomSupplement} className="flex flex-col items-center justify-center p-3 rounded-lg border border-dashed border-stone-300 bg-stone-50 text-stone-500 hover:bg-stone-100 transition-colors min-h-[80px]">
                  <Plus size={16} className="mb-1 text-stone-400" />
                  <span className="text-xs font-medium">新增其他</span>
                </button>
              </div>

              {ignoredSupps.length > 0 && (
                <>
                  <div className="flex items-center gap-3 my-2 mb-4">
                    <div className="h-px bg-stone-200 flex-1" />
                    <span className="text-[10px] font-bold text-stone-400 tracking-wider">已略過 / 非今日</span>
                    <div className="h-px bg-stone-200 flex-1" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 pb-8">
                    {ignoredSupps.map(renderSuppCard)}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

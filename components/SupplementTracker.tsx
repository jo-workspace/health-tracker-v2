'use client';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Pill, Check, Plus, Minus, Clock, ChevronRight, X, Ban, History } from 'lucide-react';
import type { SupplementLog, SupplementSetting, SyncPayload } from '@/lib/types';
import { type Supplement, isScheduledDay, PREDEFINED_SUPPLEMENTS } from '@/lib/supplements';
import SupplementHistoryModal from './forms/SupplementHistoryModal';
import BatchCheckinModal from './forms/BatchCheckinModal';

interface Props {
  data?: SupplementLog[];
  settings?: SupplementSetting[];
  updateData: (payload: SyncPayload) => void;
}

export default function SupplementTracker({ data, settings, updateData }: Props) {
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchSlotName, setBatchSlotName] = useState('');
  const [isCustomPickerOpen, setIsCustomPickerOpen] = useState(false);
  const [customNameInput, setCustomNameInput] = useState('');
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
        lastUpdated: Date.now().toString(),
        category: s.category
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
    const applyAutoIgnore = (s: Supplement) => ({ ...s, ignored: !isScheduledDay(s.time, new Date()) });

    if (todayLog && todayLog.items) {
      try {
        const parsed: Supplement[] = JSON.parse(todayLog.items);
        const merged = baseSupplements.map(base => {
          const logged = parsed.find(p => p.id === base.id);
          if (logged) {
            return { ...base, taken: logged.taken, amount: logged.amount, ignored: logged.ignored };
          }
          return applyAutoIgnore(base);
        });
        const customLogs = parsed.filter(p => p.isCustom);
        setSupplements([...merged, ...customLogs]);
      } catch (e) {
        setSupplements(baseSupplements.map(applyAutoIgnore));
      }
    } else {
      setSupplements(baseSupplements.map(applyAutoIgnore));
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

  const addCustomSupplement = (name: string) => {
    if (!name.trim()) return;
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
    setIsCustomPickerOpen(false);
    setCustomNameInput('');
  };

  useEffect(() => {
    if (isModalOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isModalOpen]);

  // 過去曾新增過的額外補充品名稱，依使用次數排序，today 已經加過的不重複列出
  const todayCustomNames = new Set(supplements.filter(s => s.isCustom).map(s => s.name));
  const customNameCounts = new Map<string, number>();
  (data || []).filter(l => l.status !== 'deleted' && l.items).forEach(l => {
    try {
      const parsed: Supplement[] = JSON.parse(l.items);
      parsed.filter(p => p.isCustom).forEach(p => {
        customNameCounts.set(p.name, (customNameCounts.get(p.name) || 0) + 1);
      });
    } catch (e) { /* ignore malformed rows */ }
  });
  const pastCustomNames = Array.from(customNameCounts.entries())
    .filter(([name]) => !todayCustomNames.has(name))
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  const getCurrentSlotName = () => {
    const isPending = (s: Supplement) => !s.ignored && !(s.taken && isFulfilled(s));
    
    if (isMorning) {
      if (supplements.some(s => s.time === '早上起床' && isPending(s))) return '早上起床';
      if (supplements.some(s => (s.time === '隨餐' || s.time === '平日' || s.time === '每日') && isPending(s))) return '隨餐';
      return null;
    }

    if (isEvening) {
      if (supplements.some(s => (s.time === '隨餐' || s.time === '平日' || s.time === '每日') && isPending(s))) return '隨餐';
      if (supplements.some(s => s.time === '晚餐時' && isPending(s))) return '晚餐時';
      return null;
    }

    // 中午/午後時段 (12:00 ~ 16:59)
    if (supplements.some(s => (s.time === '隨餐' || s.time === '平日' || s.time === '每日') && isPending(s))) return '隨餐';
    
    // 未到 17:00 晚餐時段 -> 不提早解鎖「晚餐時」按鈕
    return null;
  };
  const currentSlotName = getCurrentSlotName();

  const handleSaveBatchUpdates = (updates: { id: string; taken: boolean; amount: number }[]) => {
    setSupplements(prev => {
      const updateMap = new Map(updates.map(u => [u.id, u]));
      const newState = prev.map(s => {
        const u = updateMap.get(s.id);
        if (u) {
          return {
            ...s,
            taken: u.taken,
            amount: u.taken ? u.amount : 0,
            ignored: false
          };
        }
        return s;
      });
      saveToCloud(newState);
      return newState;
    });
  };

  const activeSupps = relevantSupps.filter(s => !s.ignored);
  const pendingSupps = activeSupps.filter(s => !(s.taken && isFulfilled(s)));
  const completedSupps = activeSupps.filter(s => s.taken && isFulfilled(s));
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
        <button
          type="button"
          onClick={(e) => toggleTaken(item.id, e)}
          className={`absolute top-2 right-2 w-6 h-6 rounded-full border flex items-center justify-center transition-all z-10 ${
            full ? 'bg-[#6ba388] border-[#6ba388] shadow-2xs scale-105' 
            : partial ? 'bg-[#e5a045] border-[#e5a045] shadow-2xs scale-105'
            : 'border-stone-300 bg-white hover:border-stone-400'
          }`}
          title={full || partial ? "已服用 (點擊取消)" : "標記為已服用"}
        >
          {(full || partial) && <Check size={14} className="text-white stroke-[3]" />}
        </button>
        
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
        
        <div className="flex items-center justify-between w-full mt-auto min-h-[28px] pt-1">
          <div className="flex items-center gap-1 text-[10px] text-stone-400 font-medium whitespace-nowrap"><Clock size={10} /> {item.time}</div>
          
          {item.taken ? (
            <div className={`flex items-center gap-2 bg-white border rounded-full px-2 py-1 z-10 shadow-2xs ${
              full ? 'text-stone-600 border-[#d5e0d7]' : 'text-stone-600 border-[#f2e6d5]'
            }`} onClick={e => e.stopPropagation()}>
              <button onClick={(e) => updateAmount(item.id, -1, e)} className="p-0.5 hover:text-stone-800 disabled:opacity-30" disabled={currentAmt <= 1}>
                <Minus size={12} />
              </button>
              <span className="text-[11px] font-bold min-w-[10px] text-center">{currentAmt}</span>
              <button onClick={(e) => updateAmount(item.id, 1, e)} className="p-0.5 hover:text-stone-800">
                <Plus size={12} />
              </button>
            </div>
          ) : (
            !item.ignored && (
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleIgnored(item.id, e);
                }} 
                className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md bg-stone-100/90 text-stone-500 hover:bg-stone-200 border border-stone-200/80 active:scale-95 transition-all shadow-2xs z-20 touch-manipulation"
              >
                <Ban size={11} /> 略過
              </button>
            )
          )}
          {item.ignored && !item.taken && (
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleIgnored(item.id, e);
              }} 
              className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md bg-stone-200 text-stone-600 hover:bg-stone-300 border border-stone-300 active:scale-95 transition-all shadow-2xs z-20 touch-manipulation"
            >
              恢復
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div onClick={() => setIsHistoryModalOpen(true)} className="w-full max-w-md mx-auto bg-[#fdfdfc] rounded-lg shadow-sm border border-stone-200 mb-4 transition-all hover:shadow-md cursor-pointer group">
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

          <div
            onClick={(e) => { e.stopPropagation(); setIsModalOpen(true); }}
            className="bg-stone-50 hover:bg-stone-100 rounded p-3 flex items-center justify-between transition-colors"
          >
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
            <div className="flex items-center gap-2 shrink-0">
              {currentSlotName && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setBatchSlotName(currentSlotName);
                    setIsBatchModalOpen(true);
                  }}
                  className="px-2.5 py-1 bg-[#6ba388] text-white text-xs font-bold rounded-lg hover:bg-[#5b8c74] transition-colors shadow-2xs flex items-center gap-1"
                >
                  ✅ {currentSlotName}
                </button>
              )}
              <ChevronRight size={18} className="text-stone-300 group-hover:text-stone-500 transition-colors shrink-0" />
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setIsModalOpen(false)} />
          <div className="absolute bottom-0 left-0 w-full sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-md bg-[#fdfdfc] rounded-t-2xl sm:rounded-2xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)] sm:shadow-2xl border-t border-stone-200 flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-full duration-300">
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
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                {currentSlotName && (
                  <button
                    type="button"
                    onClick={() => {
                      setBatchSlotName(currentSlotName);
                      setIsBatchModalOpen(true);
                    }}
                    className="px-2.5 py-1 bg-[#6ba388] text-white text-xs font-bold rounded-lg hover:bg-[#5b8c74] transition-colors shadow-2xs flex items-center gap-1"
                  >
                    ✅ {currentSlotName}
                  </button>
                )}
                <button
                  onClick={() => setIsHistoryModalOpen(true)}
                  className="flex items-center gap-1 text-xs font-bold text-stone-500 hover:text-stone-700 shrink-0"
                >
                  <History size={14} /> 90天紀錄
                </button>
              </div>
            </div>

            <div className="p-4 pt-0 overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <div className="grid grid-cols-2 gap-3 pb-4">
                {pendingSupps.map(renderSuppCard)}

                <button onClick={() => setIsCustomPickerOpen(true)} className="flex flex-col items-center justify-center p-3 rounded-lg border border-dashed border-stone-300 bg-stone-50 text-stone-500 hover:bg-stone-100 transition-colors min-h-[80px]">
                  <Plus size={16} className="mb-1 text-stone-400" />
                  <span className="text-xs font-medium">新增其他</span>
                </button>
              </div>

              {completedSupps.length > 0 && (
                <>
                  <div className="flex items-center gap-3 my-2 mb-4">
                    <div className="h-px bg-stone-200 flex-1" />
                    <span className="text-[10px] font-bold text-stone-400 tracking-wider">已完成</span>
                    <div className="h-px bg-stone-200 flex-1" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 pb-4">
                    {completedSupps.map(renderSuppCard)}
                  </div>
                </>
              )}

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
        </div>,
        document.body
      )}

      <SupplementHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        data={data}
        settings={settings}
      />

      <BatchCheckinModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        slotName={batchSlotName}
        supplements={supplements}
        onSaveBatch={handleSaveBatchUpdates}
      />

      {isCustomPickerOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsCustomPickerOpen(false)}>
          <div
            className="bg-[#fcfcfc] w-full max-w-sm rounded-2xl shadow-xl flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-stone-100 shrink-0">
              <h2 className="text-base font-bold text-stone-800">新增額外補充品</h2>
              <button type="button" onClick={() => setIsCustomPickerOpen(false)} className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-500 rounded-full transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex flex-col gap-4">
              {pastCustomNames.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-stone-500">常用清單</span>
                  <div className="flex flex-wrap gap-2">
                    {pastCustomNames.map(name => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => addCustomSupplement(name)}
                        className="px-3 py-1.5 rounded-full text-xs font-bold border border-stone-200 bg-white text-stone-600 hover:bg-stone-100 transition-colors"
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-stone-500">或輸入新名稱</span>
                <form
                  onSubmit={(e) => { e.preventDefault(); addCustomSupplement(customNameInput); }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    autoFocus
                    value={customNameInput}
                    onChange={e => setCustomNameInput(e.target.value)}
                    placeholder="例如：B 群"
                    className="flex-1 px-3 py-2 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent text-[15px]"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#444] text-white rounded-lg font-bold text-sm hover:bg-[#333] transition-colors disabled:opacity-40"
                    disabled={!customNameInput.trim()}
                  >
                    新增
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Plus, Minus, CheckCircle2, Ban, RotateCcw, ChevronDown } from 'lucide-react';
import { type Supplement, getSupplementCategorySlot } from '@/lib/supplements';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  slotName: string;
  supplements: Supplement[];
  pastCustomNames?: string[];
  onSaveBatch: (
    updates: { id: string; taken: boolean; amount: number; ignored?: boolean }[],
    newCustomItems?: Supplement[]
  ) => void;
}

interface ItemState {
  id: string;
  name: string;
  targetAmount: number;
  amount: number;
  status: 'take' | 'skip' | 'none';
  initialTaken: boolean;
  isCustom?: boolean;
}

const isFulfilled = (s: Supplement) => (s.amount || 0) >= (s.targetAmount || 1);

export default function BatchCheckinModal({
  isOpen,
  onClose,
  slotName,
  supplements,
  pastCustomNames = [],
  onSaveBatch
}: Props) {
  const [items, setItems] = useState<ItemState[]>([]);
  const [isCompletedExpanded, setIsCompletedExpanded] = useState(false);
  const [isAddingOther, setIsAddingOther] = useState(false);
  const [customInput, setCustomInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      const slotSupps = supplements.filter(s => getSupplementCategorySlot(s.time) === slotName && !s.ignored);
      const initialItems: ItemState[] = slotSupps.map(s => {
        const isAlreadyTaken = Boolean(s.taken && isFulfilled(s));
        return {
          id: s.id,
          name: s.name,
          targetAmount: s.targetAmount || 1,
          amount: s.amount && s.amount > 0 ? s.amount : (s.targetAmount || 1),
          status: 'take',
          initialTaken: isAlreadyTaken,
          isCustom: s.isCustom
        };
      });
      setItems(initialItems);

      const hasPending = initialItems.some(i => !i.initialTaken);
      setIsCompletedExpanded(!hasPending);
      setIsAddingOther(false);
      setCustomInput('');
    }
  }, [isOpen, slotName, supplements]);

  if (!isOpen) return null;

  const pendingItems = items.filter(i => !i.initialTaken);
  const completedItems = items.filter(i => i.initialTaken);

  const isAllPendingChecked = pendingItems.length > 0 && pendingItems.every(i => i.status === 'take');

  const toggleSelectAllPending = () => {
    const nextStatus = isAllPendingChecked ? 'none' : 'take';
    setItems(prev => prev.map(i => {
      if (i.initialTaken) return i;
      return { ...i, status: nextStatus };
    }));
  };

  const togglePendingStatus = (id: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        if (item.status === 'take') return { ...item, status: 'none' };
        return { ...item, status: 'take' };
      }
      return item;
    }));
  };

  const togglePendingSkip = (id: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        if (item.status === 'skip') return { ...item, status: 'take' };
        return { ...item, status: 'skip' };
      }
      return item;
    }));
  };

  const toggleCompletedStatus = (id: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, status: item.status === 'none' ? 'take' : 'none' };
      }
      return item;
    }));
  };

  const updateAmount = (id: string, delta: number) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const newAmt = Math.max(1, item.amount + delta);
        return { ...item, amount: newAmt };
      }
      return item;
    }));
  };

  const handleAddCustomItem = (rawName: string) => {
    const name = rawName.trim();
    if (!name) return;

    // 1. 若當前彈窗清單已有此項目，直接設為服用並增加數量
    const existingInItems = items.find(i => i.name.toLowerCase() === name.toLowerCase());
    if (existingInItems) {
      setItems(prev => prev.map(i => i.id === existingInItems.id ? { ...i, status: 'take', amount: i.amount + 1 } : i));
      setCustomInput('');
      return;
    }

    // 2. 智慧喚醒：若在原始品項清單中已有此常態項目（如今日非排程但已被略過的魚油、葉黃素）
    const existingInSupps = supplements.find(
      s => !s.isCustom && s.name.toLowerCase() === name.toLowerCase()
    );

    if (existingInSupps) {
      const targetAmt = existingInSupps.targetAmount || 1;
      const newItem: ItemState = {
        id: existingInSupps.id,
        name: existingInSupps.name,
        targetAmount: targetAmt,
        amount: targetAmt,
        status: 'take',
        initialTaken: false,
        isCustom: false
      };
      setItems(prev => [...prev, newItem]);
      setCustomInput('');
      return;
    }

    // 3. 全新自訂品項
    const newItem: ItemState = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name,
      targetAmount: 1,
      amount: 1,
      status: 'take',
      initialTaken: false,
      isCustom: true
    };
    setItems(prev => [...prev, newItem]);
    setCustomInput('');
  };

  const handleSave = () => {
    const regularUpdates: { id: string; taken: boolean; amount: number; ignored?: boolean }[] = [];

    items
      .filter(i => !i.isCustom)
      .forEach(i => {
        if (!i.initialTaken) {
          if (i.status === 'take') {
            regularUpdates.push({ id: i.id, taken: true, amount: i.amount, ignored: false });
          } else if (i.status === 'skip') {
            regularUpdates.push({ id: i.id, taken: false, amount: 0, ignored: true });
          } else if (i.status === 'none') {
            regularUpdates.push({ id: i.id, taken: false, amount: 0, ignored: false });
          }
        } else {
          if (i.status === 'none') {
            regularUpdates.push({ id: i.id, taken: false, amount: 0, ignored: false });
          } else {
            regularUpdates.push({ id: i.id, taken: true, amount: i.amount, ignored: false });
          }
        }
      });

    const newCustomItems: Supplement[] = items
      .filter(i => i.isCustom && i.status === 'take')
      .map(i => ({
        id: i.id,
        name: i.name,
        time: slotName,
        taken: true,
        amount: i.amount,
        targetAmount: 1,
        ignored: false,
        isCustom: true
      }));

    onSaveBatch(regularUpdates, newCustomItems);
    onClose();
  };

  const currentNames = new Set(items.map(i => i.name.toLowerCase()));
  const availablePills = pastCustomNames.filter(name => !currentNames.has(name.toLowerCase()));

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />
      <div 
        className="absolute bottom-0 left-0 w-full sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-md bg-[#fdfdfc] rounded-t-2xl sm:rounded-2xl shadow-2xl border-t sm:border border-stone-200 flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-full duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-stone-100 shrink-0">
          <div className="flex items-center gap-2 text-[#6ba388]">
            <CheckCircle2 size={19} className="stroke-[2.5]" />
            <h2 className="text-base font-bold text-stone-800">{slotName} 批次打卡</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Action Sub-Header */}
        <div className="px-4 pt-3 pb-2 flex justify-between items-center bg-stone-50/60 border-b border-stone-100 shrink-0">
          <span className="text-xs font-semibold text-stone-500">
            {pendingItems.length > 0
              ? `待打卡 ${pendingItems.length} 項${completedItems.length > 0 ? ` · 已服 ${completedItems.length} 項` : ''}`
              : `共 ${completedItems.length} 項已完成`}
          </span>
          {pendingItems.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectAllPending}
              className="text-xs font-bold text-[#6ba388] hover:text-[#5b8c74] transition-colors"
            >
              {isAllPendingChecked ? '取消全選' : '全選'}
            </button>
          )}
        </div>

        {/* Item List */}
        <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-2.5">
          {items.length === 0 ? (
            <div className="text-center text-stone-400 py-6 text-sm">此時段目前無固定排程的保健食品</div>
          ) : pendingItems.length === 0 ? (
            <div className="text-center py-3.5 px-3 bg-[#f4f7f4] border border-[#d5e0d7] rounded-xl flex items-center justify-center gap-2 text-[#3e5f4f]">
              <CheckCircle2 size={16} className="stroke-[2.5]" />
              <span className="text-xs font-bold">{slotName} 排程品項今日皆已服用完成</span>
            </div>
          ) : null}

          {/* Pending Items */}
          {pendingItems.map(item => {
            const isTake = item.status === 'take';
            const isSkip = item.status === 'skip';

            return (
              <div
                key={item.id}
                onClick={() => togglePendingStatus(item.id)}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  isTake
                    ? 'bg-[#f4f7f4] border-[#d5e0d7] shadow-2xs'
                    : isSkip
                    ? 'bg-stone-50/80 border-stone-200 opacity-75'
                    : 'bg-white border-stone-200 opacity-60 hover:opacity-100'
                }`}
              >
                {/* Left side: Checkbox / Ban icon & Name */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                    isTake
                      ? 'bg-[#6ba388] border-[#6ba388]'
                      : isSkip
                      ? 'bg-stone-200 border-stone-300 text-stone-500'
                      : 'bg-white border-stone-300'
                  }`}>
                    {isTake && <Check size={14} className="text-white stroke-[3]" />}
                    {isSkip && <Ban size={12} className="stroke-[2.5]" />}
                  </div>

                  <div className="min-w-0">
                    <div className={`text-sm flex items-center gap-1.5 ${
                      isTake ? 'font-bold text-[#3e5f4f]' : isSkip ? 'font-medium text-stone-400 line-through' : 'font-semibold text-stone-600'
                    }`}>
                      <span className="truncate">{item.name}</span>
                      {item.isCustom && (
                        <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 border border-stone-200 shrink-0">
                          額外
                        </span>
                      )}
                      {isSkip && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-stone-200/80 text-stone-600 shrink-0 no-underline">
                          略過
                        </span>
                      )}
                    </div>
                    {item.targetAmount > 1 && !item.isCustom && !isSkip && (
                      <div className="text-[10px] text-stone-400 font-medium">目標: {item.targetAmount}</div>
                    )}
                  </div>
                </div>

                {/* Right side: Amount stepper & Skip / Undo button */}
                <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                  {isTake && (
                    <div className="flex items-center gap-2 bg-white border border-[#d5e0d7] rounded-full px-2 py-1 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => updateAmount(item.id, -1)}
                        className="p-0.5 hover:text-stone-800 disabled:opacity-30"
                        disabled={item.amount <= 1}
                      >
                        <Minus size={12} />
                      </button>
                      <span className="text-xs font-bold min-w-[12px] text-center text-stone-700">{item.amount}</span>
                      <button
                        type="button"
                        onClick={() => updateAmount(item.id, 1)}
                        className="p-0.5 hover:text-stone-800"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  )}

                  {isSkip ? (
                    <button
                      type="button"
                      onClick={() => togglePendingSkip(item.id)}
                      className="px-2 py-1 text-xs font-bold text-[#5b8c74] hover:bg-[#eaf2ed] rounded-lg transition-colors flex items-center gap-1"
                    >
                      <RotateCcw size={12} />
                      <span>復原</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => togglePendingSkip(item.id)}
                      className="p-1.5 text-stone-400 hover:text-amber-800 hover:bg-amber-50/80 rounded-lg transition-colors flex items-center gap-1 text-xs"
                      title="今日略過此品項"
                    >
                      <Ban size={13} />
                      <span className="text-[11px] hidden sm:inline">略過</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Already Completed Section */}
          {completedItems.length > 0 && (
            <div className="pt-2 border-t border-stone-100 flex flex-col gap-2 mt-1">
              <button
                type="button"
                onClick={() => setIsCompletedExpanded(!isCompletedExpanded)}
                className="flex items-center justify-between w-full py-1 px-1 text-xs font-bold text-stone-500 hover:text-stone-700 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-[#6ba388] stroke-[2.5]" />
                  <span>今日已服用 ({completedItems.length})</span>
                </div>
                <div className="flex items-center gap-0.5 text-[11px] font-normal text-stone-400">
                  <span>{isCompletedExpanded ? '收合' : '檢視'}</span>
                  <ChevronDown size={13} className={`transition-transform duration-200 ${isCompletedExpanded ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {isCompletedExpanded && (
                <div className="flex flex-col gap-2 animate-in fade-in duration-150">
                  {completedItems.map(item => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                        item.status === 'none'
                          ? 'bg-stone-50/70 border-stone-200 opacity-60'
                          : 'bg-[#fafbfa] border-[#e2eae3]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                          item.status === 'none' ? 'bg-stone-200 text-stone-500' : 'bg-[#eaf2ed] text-[#5b8c74]'
                        }`}>
                          {item.status === 'none' ? <X size={10} /> : <Check size={10} className="stroke-[3]" />}
                        </div>
                        <div className="min-w-0 flex items-center gap-1.5">
                          <span className={`text-xs font-bold truncate ${
                            item.status === 'none' ? 'text-stone-400 line-through' : 'text-stone-700'
                          }`}>
                            {item.name}
                          </span>
                          <span className="text-[10px] text-stone-400 shrink-0">
                            {item.status === 'none' ? '將還原為未服' : `已服 ${item.amount} 顆`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                        {item.status !== 'none' ? (
                          <>
                            <div className="flex items-center gap-1.5 bg-white border border-stone-200 rounded-full px-2 py-0.5 text-xs">
                              <button
                                type="button"
                                onClick={() => updateAmount(item.id, -1)}
                                className="text-stone-400 hover:text-stone-700 disabled:opacity-30"
                                disabled={item.amount <= 1}
                              >
                                <Minus size={11} />
                              </button>
                              <span className="text-xs font-bold text-stone-700 min-w-[10px] text-center">{item.amount}</span>
                              <button
                                type="button"
                                onClick={() => updateAmount(item.id, 1)}
                                className="text-stone-400 hover:text-stone-700"
                              >
                                <Plus size={11} />
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleCompletedStatus(item.id)}
                              className="p-1 text-stone-300 hover:text-stone-600 hover:bg-stone-100 rounded transition-colors"
                              title="撤銷今日打卡"
                            >
                              <X size={12} />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleCompletedStatus(item.id)}
                            className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-[#5b8c74] hover:bg-[#eaf2ed] rounded transition-colors"
                          >
                            <RotateCcw size={11} />
                            <span>復原</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Add custom item */}
          {!isAddingOther ? (
            <button
              type="button"
              onClick={() => setIsAddingOther(true)}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-dashed border-stone-200 bg-stone-50/50 text-stone-500 hover:text-stone-700 hover:bg-stone-100/70 hover:border-stone-300 text-xs font-semibold transition-all mt-1"
            >
              <Plus size={13} />
              <span>新增其他品項</span>
            </button>
          ) : (
            <div className="p-3 bg-stone-50/80 rounded-xl border border-stone-200 flex flex-col gap-2.5 mt-1 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-600">新增額外品項</span>
                <button
                  type="button"
                  onClick={() => { setIsAddingOther(false); setCustomInput(''); }}
                  className="text-stone-400 hover:text-stone-600 p-0.5 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {availablePills.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-stone-400 font-medium">常用清單快速加入：</span>
                  <div className="flex flex-wrap gap-1.5">
                    {availablePills.slice(0, 6).map(name => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => handleAddCustomItem(name)}
                        className="px-2.5 py-1 text-xs font-medium rounded-full bg-white border border-stone-200 text-stone-600 hover:border-[#6ba388] hover:text-[#5b8c74] transition-colors"
                      >
                        + {name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-1.5">
                <input
                  type="text"
                  autoFocus
                  value={customInput}
                  onChange={e => setCustomInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomItem(customInput);
                    }
                  }}
                  placeholder="輸入名稱，例如：B 群"
                  className="min-w-0 w-full flex-1 px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-stone-400 text-stone-800"
                />
                <button
                  type="button"
                  onClick={() => handleAddCustomItem(customInput)}
                  disabled={!customInput.trim()}
                  className="px-3 py-1.5 bg-[#6ba388] hover:bg-[#5b8c74] text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-40 shrink-0"
                >
                  加入
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-100 flex gap-2 shrink-0 bg-white rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-stone-100 text-stone-600 font-bold text-sm rounded-xl hover:bg-stone-200 transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={items.length === 0}
            className="flex-1 py-2.5 bg-[#6ba388] text-white font-bold text-sm rounded-xl hover:bg-[#5b8c74] transition-colors shadow-sm disabled:opacity-50"
          >
            確認儲存
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
}

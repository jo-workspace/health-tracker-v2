'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Plus, Minus, Pill, CheckCircle2 } from 'lucide-react';
import { type Supplement, getSupplementCategorySlot } from '@/lib/supplements';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  slotName: string;
  supplements: Supplement[];
  pastCustomNames?: string[];
  onSaveBatch: (
    updates: { id: string; taken: boolean; amount: number }[],
    newCustomItems?: Supplement[]
  ) => void;
}

interface ItemState {
  id: string;
  name: string;
  targetAmount: number;
  amount: number;
  checked: boolean;
  isCustom?: boolean;
}

export default function BatchCheckinModal({
  isOpen,
  onClose,
  slotName,
  supplements,
  pastCustomNames = [],
  onSaveBatch
}: Props) {
  const [items, setItems] = useState<ItemState[]>([]);
  const [isAddingOther, setIsAddingOther] = useState(false);
  const [customInput, setCustomInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      const slotSupps = supplements.filter(s => getSupplementCategorySlot(s.time) === slotName && !s.ignored);
      setItems(slotSupps.map(s => ({
        id: s.id,
        name: s.name,
        targetAmount: s.targetAmount || 1,
        amount: s.taken && s.amount ? s.amount : (s.targetAmount || 1),
        checked: true,
        isCustom: s.isCustom
      })));
      setIsAddingOther(false);
      setCustomInput('');
    }
  }, [isOpen, slotName, supplements]);

  if (!isOpen) return null;

  const toggleCheck = (id: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, checked: !item.checked } : item));
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

    // 1. 若當前彈窗清單已有此項目，直接勾選並增加數量
    const existingInItems = items.find(i => i.name.toLowerCase() === name.toLowerCase());
    if (existingInItems) {
      setItems(prev => prev.map(i => i.id === existingInItems.id ? { ...i, checked: true, amount: i.amount + 1 } : i));
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
        checked: true,
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
      checked: true,
      isCustom: true
    };
    setItems(prev => [...prev, newItem]);
    setCustomInput('');
  };

  const isAllChecked = items.length > 0 && items.every(i => i.checked);
  const toggleSelectAll = () => {
    const nextState = !isAllChecked;
    setItems(prev => prev.map(i => ({ ...i, checked: nextState })));
  };

  const handleSave = () => {
    const regularUpdates = items
      .filter(i => !i.isCustom)
      .map(i => ({
        id: i.id,
        taken: i.checked,
        amount: i.checked ? i.amount : 0
      }));

    const newCustomItems: Supplement[] = items
      .filter(i => i.isCustom && i.checked)
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

        {/* Action Header */}
        <div className="px-4 pt-3 pb-2 flex justify-between items-center bg-stone-50/60 border-b border-stone-100 shrink-0">
          <span className="text-xs font-semibold text-stone-500">共 {items.length} 項品項</span>
          <button
            type="button"
            onClick={toggleSelectAll}
            className="text-xs font-bold text-[#6ba388] hover:text-[#5b8c74] transition-colors"
          >
            {isAllChecked ? '取消全選' : '全選'}
          </button>
        </div>

        {/* Item List */}
        <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-2.5">
          {items.length === 0 ? (
            <div className="text-center text-stone-400 py-6 text-sm">此時段目前無固定排程的保健食品</div>
          ) : (
            items.map(item => (
              <div
                key={item.id}
                onClick={() => toggleCheck(item.id)}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  item.checked
                    ? 'bg-[#f4f7f4] border-[#d5e0d7] shadow-2xs'
                    : 'bg-white border-stone-200 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                    item.checked ? 'bg-[#6ba388] border-[#6ba388]' : 'bg-white border-stone-300'
                  }`}>
                    {item.checked && <Check size={14} className="text-white stroke-[3]" />}
                  </div>
                  <div>
                    <div className={`text-sm font-bold flex items-center gap-1.5 ${item.checked ? 'text-[#3e5f4f]' : 'text-stone-600'}`}>
                      <span>{item.name}</span>
                      {item.isCustom && (
                        <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 border border-stone-200">
                          額外
                        </span>
                      )}
                    </div>
                    {item.targetAmount > 1 && !item.isCustom && (
                      <div className="text-[10px] text-stone-400 font-medium">目標: {item.targetAmount}</div>
                    )}
                  </div>
                </div>

                {item.checked && (
                  <div
                    className="flex items-center gap-2 bg-white border border-[#d5e0d7] rounded-full px-2 py-1 shadow-2xs"
                    onClick={e => e.stopPropagation()}
                  >
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
              </div>
            ))
          )}

          {/* 方案 A: 內嵌展開新增其他 */}
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
                  className="flex-1 px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-stone-400 text-stone-800"
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

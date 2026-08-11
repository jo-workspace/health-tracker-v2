'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Plus, Minus, Pill } from 'lucide-react';
import type { Supplement } from '@/lib/supplements';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  slotName: string;
  supplements: Supplement[];
  onSaveBatch: (updates: { id: string; taken: boolean; amount: number }[]) => void;
}

interface ItemState {
  id: string;
  name: string;
  targetAmount: number;
  amount: number;
  checked: boolean;
}

export default function BatchCheckinModal({ isOpen, onClose, slotName, supplements, onSaveBatch }: Props) {
  const [items, setItems] = useState<ItemState[]>([]);

  useEffect(() => {
    if (isOpen) {
      const slotSupps = supplements.filter(s => s.time === slotName && !s.ignored);
      setItems(slotSupps.map(s => ({
        id: s.id,
        name: s.name,
        targetAmount: s.targetAmount || 1,
        amount: s.taken && s.amount ? s.amount : (s.targetAmount || 1),
        checked: true // 預設一鍵包含該時段所有項目
      })));
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

  const isAllChecked = items.length > 0 && items.every(i => i.checked);
  const toggleSelectAll = () => {
    const nextState = !isAllChecked;
    setItems(prev => prev.map(i => ({ ...i, checked: nextState })));
  };

  const handleSave = () => {
    const updates = items.map(i => ({
      id: i.id,
      taken: i.checked,
      amount: i.checked ? i.amount : 0
    }));
    onSaveBatch(updates);
    onClose();
  };

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
            <Pill size={20} strokeWidth={2.5} />
            <h2 className="text-lg font-bold text-stone-800">✅ {slotName} - 批次完成</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Action Header */}
        <div className="px-4 pt-3 pb-2 flex justify-between items-center bg-stone-50/60 border-b border-stone-100">
          <span className="text-xs font-semibold text-stone-500">共 {items.length} 項保健品</span>
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
            <div className="text-center text-stone-400 py-8 text-sm">此時段目前無設定的保健食品</div>
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
                    <div className={`text-sm font-bold ${item.checked ? 'text-[#3e5f4f]' : 'text-stone-600'}`}>
                      {item.name}
                    </div>
                    {item.targetAmount > 1 && (
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

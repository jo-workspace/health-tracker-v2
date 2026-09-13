'use client';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Pill, Trash2, Pause, Play, AlertCircle } from 'lucide-react';
import type { SupplementSetting } from '@/lib/types';
import { DEFAULT_CATEGORY } from '@/lib/supplements';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: SupplementSetting[];
  onSaveSettings: (newSettings: SupplementSetting[]) => void;
}

const TIME_SLOT_OPTIONS = ['早上起床', '隨餐', '晚餐時', '睡前'];

export default function SupplementManageModal({ isOpen, onClose, settings = [], onSaveSettings }: Props) {
  const [editingList, setEditingList] = useState<SupplementSetting[]>(() => {
    // 確保有預設品項，若沒有甘胺酸鎂/蘇糖酸鎂則預設補入
    let list = [...settings.filter(s => s.status !== 'deleted')];
    
    // 若原先有舊的「鎂」，將其轉化為「甘胺酸鎂」
    const legacyMagIndex = list.findIndex(s => s.name === '鎂');
    if (legacyMagIndex >= 0) {
      list[legacyMagIndex] = {
        ...list[legacyMagIndex],
        name: '甘胺酸鎂',
        time: '睡前',
        targetAmount: list[legacyMagIndex].targetAmount || '1',
        lastUpdated: Date.now().toString()
      };
    }

    const hasGlycinate = list.some(s => s.name.includes('甘胺酸鎂'));
    const hasThreonate = list.some(s => s.name.includes('蘇糖酸鎂'));

    if (!hasGlycinate && !hasThreonate) {
      list.push({
        id: 'supp-glycinate',
        name: '甘胺酸鎂',
        time: '睡前',
        targetAmount: '1',
        status: 'active',
        lastUpdated: Date.now().toString(),
        category: 'Mineral'
      });
    }

    if (!hasThreonate) {
      list.push({
        id: 'supp-threonate',
        name: '蘇糖酸鎂',
        time: '睡前',
        targetAmount: '1',
        status: 'paused',
        lastUpdated: Date.now().toString(),
        category: 'Mineral'
      });
    }

    return list;
  });

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTime, setNewTime] = useState('睡前');
  const [newTargetAmount, setNewTargetAmount] = useState('1');

  if (!isOpen) return null;

  const handleToggleStatus = (id: string) => {
    const updated = editingList.map(item => {
      if (item.id === id) {
        const nextStatus = item.status === 'paused' ? 'active' : 'paused';
        return { ...item, status: nextStatus, lastUpdated: Date.now().toString() };
      }
      return item;
    });
    setEditingList(updated);
    onSaveSettings(updated);
  };

  const handleUpdateAmount = (id: string, delta: number) => {
    const updated = editingList.map(item => {
      if (item.id === id) {
        const current = parseInt(item.targetAmount, 10) || 1;
        const nextAmt = Math.max(1, current + delta);
        return { ...item, targetAmount: String(nextAmt), lastUpdated: Date.now().toString() };
      }
      return item;
    });
    setEditingList(updated);
    onSaveSettings(updated);
  };

  const handleDelete = (id: string) => {
    const updated = editingList.map(item => {
      if (item.id === id) {
        return { ...item, status: 'deleted', lastUpdated: Date.now().toString() };
      }
      return item;
    }).filter(s => s.status !== 'deleted');
    setEditingList(updated);
    onSaveSettings(updated);
  };

  const handleCreateNew = () => {
    if (!newName.trim()) return;
    const newItem: SupplementSetting = {
      id: `supp-setting-${Date.now()}`,
      name: newName.trim(),
      time: newTime,
      targetAmount: newTargetAmount || '1',
      status: 'active',
      lastUpdated: Date.now().toString(),
      category: DEFAULT_CATEGORY
    };
    const updated = [...editingList, newItem];
    setEditingList(updated);
    onSaveSettings(updated);
    setNewName('');
    setIsAdding(false);
  };

  const activeItems = editingList.filter(s => s.status !== 'paused' && s.status !== 'deleted');
  const pausedItems = editingList.filter(s => s.status === 'paused');

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />
      <div 
        onClick={e => e.stopPropagation()}
        className="relative bg-[#fdfdfc] w-full max-w-md rounded-2xl shadow-xl border border-stone-200 flex flex-col max-h-[88vh] overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-stone-100 bg-white">
          <div className="flex items-center gap-2 text-stone-700">
            <Pill size={18} className="text-[#6ba388]" />
            <h2 className="font-bold text-base text-stone-800">保健品清單管理</h2>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          <div className="bg-[#f7f9f7] border border-[#e0ece3] rounded-xl p-3 text-xs text-[#476e58] leading-relaxed flex items-start gap-2">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <div>
              每個品項皆可獨立<strong>「啟用 / 暫停」</strong>。暫停中的品項不會出現在每日打卡清單中，方便做週期性輪替（如甘胺酸鎂與蘇糖酸鎂）。
            </div>
          </div>

          {/* Active Items Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-500">啟用中品項 ({activeItems.length})</span>
              <button 
                type="button"
                onClick={() => setIsAdding(!isAdding)}
                className="text-xs font-bold text-[#5b8c74] hover:text-[#4a725e] flex items-center gap-1"
              >
                <Plus size={14} /> 新增品項
              </button>
            </div>

            {isAdding && (
              <div className="bg-white border border-stone-200 rounded-xl p-3.5 space-y-3 shadow-xs">
                <div className="text-xs font-bold text-stone-700">新增常態保健品</div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="品項名稱 (如 蘇糖酸鎂)"
                    className="col-span-2 text-xs p-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-1 focus:ring-[#6ba388]"
                  />
                  <select
                    value={newTime}
                    onChange={e => setNewTime(e.target.value)}
                    className="text-xs p-2 rounded-lg border border-stone-200 bg-white"
                  >
                    {TIME_SLOT_OPTIONS.map(slot => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1.5 text-xs text-stone-500">
                    <span>每日目標：</span>
                    <input
                      type="number"
                      min="1"
                      value={newTargetAmount}
                      onChange={e => setNewTargetAmount(e.target.value)}
                      className="w-14 text-center p-1.5 rounded-lg border border-stone-200 text-xs"
                    />
                    <span>顆</span>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-3 py-1.5 rounded-lg text-xs text-stone-500 hover:bg-stone-100"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateNew}
                    disabled={!newName.trim()}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#6ba388] text-white hover:bg-[#5b8c74] disabled:opacity-40"
                  >
                    確認新增
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {activeItems.map(item => {
                const amt = parseInt(item.targetAmount, 10) || 1;
                return (
                  <div 
                    key={item.id}
                    className="bg-white border border-stone-200 rounded-xl p-3 flex items-center justify-between shadow-2xs"
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-stone-800 truncate">{item.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 font-medium">
                          {item.time}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-xs text-stone-400">
                        <span>目標: {amt} 顆</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* 增減顆數 */}
                      <div className="flex items-center gap-1 bg-stone-50 border border-stone-200 rounded-lg px-1.5 py-0.5 text-xs text-stone-600">
                        <button 
                          type="button"
                          onClick={() => handleUpdateAmount(item.id, -1)}
                          className="hover:text-stone-900 disabled:opacity-30 p-0.5"
                          disabled={amt <= 1}
                        >
                          -
                        </button>
                        <span className="font-bold w-4 text-center">{amt}</span>
                        <button 
                          type="button"
                          onClick={() => handleUpdateAmount(item.id, 1)}
                          className="hover:text-stone-900 p-0.5"
                        >
                          +
                        </button>
                      </div>

                      {/* 暫停開關按鈕 */}
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(item.id)}
                        className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 border border-stone-200 transition-colors"
                        title="點擊暫停服用此品項"
                      >
                        <Pause size={12} />
                        <span>暫停</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Paused Items Section */}
          {pausedItems.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-stone-100">
              <span className="text-xs font-bold text-stone-400">暫停輪替中 ({pausedItems.length})</span>
              <div className="space-y-2">
                {pausedItems.map(item => {
                  const amt = parseInt(item.targetAmount, 10) || 1;
                  return (
                    <div 
                      key={item.id}
                      className="bg-stone-50/80 border border-stone-200 rounded-xl p-3 flex items-center justify-between opacity-75"
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-stone-500 line-through truncate">{item.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-200 text-stone-500 font-medium">
                            暫停
                          </span>
                        </div>
                        <div className="text-[11px] text-stone-400 mt-0.5">
                          {item.time} · {amt} 顆
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* 啟用開關按鈕 */}
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(item.id)}
                          className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-[#6ba388] hover:bg-[#5b8c74] text-white transition-colors shadow-2xs"
                          title="點擊恢復啟用此品項"
                        >
                          <Play size={12} fill="currentColor" />
                          <span>啟用</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="p-1 text-stone-400 hover:text-stone-600 rounded-md transition-colors"
                          title="刪除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-stone-100 bg-stone-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-stone-800 text-white rounded-xl text-xs font-bold hover:bg-stone-700 transition-colors"
          >
            完成
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
}

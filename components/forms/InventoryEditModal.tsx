'use client';
import { useState } from 'react';
import { X, Check, Plus, Minus, Sparkles, Trash2 } from 'lucide-react';
import type { SupplementInventoryItem, SupplementSetting } from '@/lib/types';
import { CATEGORY_ORDER, DEFAULT_CATEGORY } from '@/lib/supplements';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  itemToEdit?: SupplementInventoryItem | null;
  onSave: (item: Partial<SupplementInventoryItem>) => void;
  onDelete?: (id: string) => void;
  existingSettings?: SupplementSetting[];
  existingInventory?: SupplementInventoryItem[];
}

function ModalContent({
  onClose,
  itemToEdit,
  onSave,
  onDelete,
  existingSettings = [],
  existingInventory = [],
}: Omit<Props, 'isOpen'>) {
  const [name, setName] = useState(itemToEdit?.name || '');
  const [brand, setBrand] = useState(itemToEdit?.brand || '');
  const [category, setCategory] = useState(itemToEdit?.category || DEFAULT_CATEGORY);
  const [openedCount, setOpenedCount] = useState(Number(itemToEdit?.openedCount) || 1);
  const [unopenedCount, setUnopenedCount] = useState(Number(itemToEdit?.unopenedCount) || 0);
  const [targetUsers, setTargetUsers] = useState(
    itemToEdit?.targetUsers === '僅自己' ? '僅自己' : '兩人共用'
  );
  const [location, setLocation] = useState(itemToEdit?.location || '');
  const [notes, setNotes] = useState(itemToEdit?.notes || '');

  // 找出還沒在庫存清單中的日常打卡品項，供快速匯入
  const existingNames = new Set(
    existingInventory.filter(i => i.status !== 'deleted').map(i => i.name.trim())
  );
  const importableSettings = existingSettings.filter(
    s => s.status !== 'deleted' && !existingNames.has(s.name.trim())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      id: itemToEdit?.id,
      name: name.trim(),
      brand: brand.trim(),
      category: category || DEFAULT_CATEGORY,
      openedCount: Math.max(0, Number(openedCount) || 0),
      unopenedCount: Math.max(0, Number(unopenedCount) || 0),
      targetUsers,
      location: location.trim(),
      notes: notes.trim(),
    });
    onClose();
  };

  const handleDelete = () => {
    if (!itemToEdit?.id) return;
    if (confirm(`確定要將「${name || itemToEdit.name}」從庫存移除嗎？`)) {
      onDelete?.(itemToEdit.id);
      onClose();
    }
  };

  const handleQuickImport = (setting: SupplementSetting) => {
    setName(setting.name);
    if (setting.category) {
      setCategory(setting.category);
    }
  };

  return (
    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl border border-stone-100 max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-stone-800">
          {itemToEdit ? '編輯保健品庫存' : '新增保健品品項'}
        </h3>
        <button
          onClick={onClose}
          type="button"
          className="p-1.5 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 快速從打卡清單帶入 */}
      {!itemToEdit && importableSettings.length > 0 && (
        <div className="mb-4 p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl">
          <div className="text-xs font-semibold text-emerald-800 mb-2 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            從日常打卡清單快速填入：
          </div>
          <div className="flex flex-wrap gap-1.5">
            {importableSettings.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleQuickImport(s)}
                className="text-xs bg-white text-emerald-700 px-2 py-1 rounded-md border border-emerald-200 hover:bg-emerald-100 transition-colors"
              >
                + {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1">品名 *</label>
          <input
            type="text"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="例：魚油、維他命 C、葉黃素"
            className="w-full text-sm px-3 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#52806b]/20 focus:border-[#52806b]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">品牌 (選填)</label>
            <input
              type="text"
              value={brand}
              onChange={e => setBrand(e.target.value)}
              placeholder="例：NOW Foods、好市多"
              className="w-full text-sm px-3 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#52806b]/20 focus:border-[#52806b]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">分類</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#52806b]/20 focus:border-[#52806b] bg-white"
            >
              {CATEGORY_ORDER.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 罐數管理區塊 */}
        <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/80 space-y-3">
          <div className="text-xs font-bold text-stone-700">罐數盤點</div>
          <div className="grid grid-cols-2 gap-4">
            {/* 已開啟 */}
            <div>
              <span className="text-[11px] font-medium text-emerald-700 block mb-1.5 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                已開啟
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setOpenedCount(prev => Math.max(0, prev - 1))}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-stone-200 text-stone-600 hover:bg-stone-100 active:scale-95"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  min="0"
                  value={openedCount}
                  onChange={e => setOpenedCount(parseInt(e.target.value, 10) || 0)}
                  className="w-12 text-center text-sm font-semibold py-1 bg-white border border-stone-200 rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => setOpenedCount(prev => prev + 1)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-stone-200 text-stone-600 hover:bg-stone-100 active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs text-stone-400">罐</span>
              </div>
            </div>

            {/* 備用 */}
            <div>
              <span className="text-[11px] font-medium text-sky-700 block mb-1.5 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-sky-500 inline-block" />
                備用
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setUnopenedCount(prev => Math.max(0, prev - 1))}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-stone-200 text-stone-600 hover:bg-stone-100 active:scale-95"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  min="0"
                  value={unopenedCount}
                  onChange={e => setUnopenedCount(parseInt(e.target.value, 10) || 0)}
                  className="w-12 text-center text-sm font-semibold py-1 bg-white border border-stone-200 rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => setUnopenedCount(prev => prev + 1)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-stone-200 text-stone-600 hover:bg-stone-100 active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs text-stone-400">罐</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">服用對象</label>
            <select
              value={targetUsers}
              onChange={e => setTargetUsers(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#52806b]/20 focus:border-[#52806b] bg-white"
            >
              <option value="兩人共用">兩人共用</option>
              <option value="僅自己">僅自己</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">存放地點 (選填)</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="例：客廳餐桌、儲藏櫃"
              className="w-full text-sm px-3 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#52806b]/20 focus:border-[#52806b]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1">備註 (選填)</label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="例：隨餐吃、睡前吃、好市多買大罐"
            className="w-full text-sm px-3 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#52806b]/20 focus:border-[#52806b]"
          />
        </div>

        {/* 底部動作列：刪除與儲存並排 */}
        <div className="pt-3 flex items-center justify-between border-t border-stone-100">
          {itemToEdit ? (
            <button
              type="button"
              onClick={handleDelete}
              className="px-3.5 py-2 text-sm font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors flex items-center gap-1.5 active:scale-95"
            >
              <Trash2 className="w-4 h-4" />
              刪除
            </button>
          ) : (
            <div />
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-xl transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-semibold text-white bg-[#52806b] hover:bg-[#446e5b] rounded-xl shadow-xs transition-colors flex items-center gap-1.5 active:scale-95"
            >
              <Check className="w-4 h-4" />
              儲存
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function InventoryEditModal(props: Props) {
  if (!props.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
      <ModalContent
        key={props.itemToEdit ? props.itemToEdit.id : 'new'}
        onClose={props.onClose}
        itemToEdit={props.itemToEdit}
        onSave={props.onSave}
        onDelete={props.onDelete}
        existingSettings={props.existingSettings}
        existingInventory={props.existingInventory}
      />
    </div>
  );
}

'use client';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Pill, Trash2, Pause, Play, Pencil, RefreshCw, Check } from 'lucide-react';
import type { SupplementSetting } from '@/lib/types';
import {
  DEFAULT_CATEGORY,
  TIME_SLOT_OPTIONS,
  WEEKDAY_OPTIONS,
  type ScheduleType,
  parseSupplementSchedule,
  formatSupplementSchedule,
  isRotationPartner,
} from '@/lib/supplements';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: SupplementSetting[];
  onSaveSettings: (newSettings: SupplementSetting[]) => void;
}

const SCHEDULE_TYPE_OPTIONS: { type: ScheduleType; label: string }[] = [
  { type: '每天', label: '每天' },
  { type: '平日', label: '平日' },
  { type: '週末', label: '週末' },
  { type: '自訂', label: '自訂星期' },
];

export default function SupplementManageModal({ isOpen, onClose, settings = [], onSaveSettings }: Props) {
  const [editingList, setEditingList] = useState<SupplementSetting[]>(() => {
    let list = [...settings.filter(s => s.status !== 'deleted')];

    // 若原先有舊的「鎂」，將其轉化為「甘胺酸鎂」
    const legacyMagIndex = list.findIndex(s => s.name === '鎂');
    if (legacyMagIndex >= 0) {
      list[legacyMagIndex] = {
        ...list[legacyMagIndex],
        name: '甘胺酸鎂',
        time: '睡前',
        targetAmount: list[legacyMagIndex].targetAmount || '1',
        lastUpdated: Date.now().toString(),
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
        category: 'Mineral',
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
        category: 'Mineral',
      });
    }

    return list;
  });

  // 新增品項表單狀態
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlot, setNewSlot] = useState('隨餐');
  const [newScheduleType, setNewScheduleType] = useState<ScheduleType>('每天');
  const [newCustomDays, setNewCustomDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [newTargetAmount, setNewTargetAmount] = useState('1');
  const [newRotationPartnerId, setNewRotationPartnerId] = useState('');

  // 單項內嵌編輯狀態
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSlot, setEditSlot] = useState('隨餐');
  const [editScheduleType, setEditScheduleType] = useState<ScheduleType>('每天');
  const [editCustomDays, setEditCustomDays] = useState<number[]>([]);
  const [editAmount, setEditAmount] = useState('1');
  const [editRotationPartnerId, setEditRotationPartnerId] = useState('');

  if (!isOpen) return null;

  const handleToggleStatus = (id: string) => {
    const target = editingList.find(s => s.id === id);
    if (!target) return;
    const willBeActive = target.status === 'paused';

    const updated = editingList.map(item => {
      if (item.id === id) {
        return {
          ...item,
          status: willBeActive ? 'active' : 'paused',
          lastUpdated: Date.now().toString(),
        };
      }
      // 關鍵單向互斥：若目標品項被啟用，自動將與其互斥輪替的品項設為暫停
      if (willBeActive && isRotationPartner(target, item)) {
        return {
          ...item,
          status: 'paused',
          lastUpdated: Date.now().toString(),
        };
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
    const updated = editingList.filter(s => s.id !== id);
    setEditingList(updated);
    onSaveSettings(updated);
    if (editingId === id) setEditingId(null);
  };

  const handleStartEdit = (item: SupplementSetting) => {
    const parsed = parseSupplementSchedule(item.time);
    setEditingId(item.id);
    setEditName(item.name);
    setEditSlot(parsed.slot);
    setEditScheduleType(parsed.scheduleType);
    setEditCustomDays(parsed.customDays.length > 0 ? parsed.customDays : [1, 2, 3, 4, 5]);
    setEditAmount(item.targetAmount || '1');

    // 尋找當前關聯的輪替對象
    const partner = editingList.find(other => isRotationPartner(item, other));
    setEditRotationPartnerId(partner ? partner.id : '');
  };

  const handleSaveEdit = (id: string) => {
    if (!editName.trim()) return;
    const formattedTime = formatSupplementSchedule(editSlot, editScheduleType, editCustomDays);

    const partner = editingList.find(s => s.id === editRotationPartnerId);
    const groupName = partner
      ? partner.rotationGroup || `rot-group-${Date.now()}`
      : undefined;

    const updated = editingList.map(item => {
      if (item.id === id) {
        return {
          ...item,
          name: editName.trim(),
          time: formattedTime,
          targetAmount: editAmount || '1',
          rotationGroup: groupName,
          lastUpdated: Date.now().toString(),
        };
      }
      if (editRotationPartnerId && item.id === editRotationPartnerId) {
        return {
          ...item,
          rotationGroup: groupName,
          lastUpdated: Date.now().toString(),
        };
      }
      // 若原先綁定但現在清空了
      if (!editRotationPartnerId && item.rotationGroup && item.rotationGroup === editingList.find(s => s.id === id)?.rotationGroup) {
        return {
          ...item,
          rotationGroup: undefined,
          lastUpdated: Date.now().toString(),
        };
      }
      return item;
    });

    setEditingList(updated);
    onSaveSettings(updated);
    setEditingId(null);
  };

  const handleCreateNew = () => {
    if (!newName.trim()) return;
    const formattedTime = formatSupplementSchedule(newSlot, newScheduleType, newCustomDays);

    const partner = editingList.find(s => s.id === newRotationPartnerId);
    const groupName = partner
      ? partner.rotationGroup || `rot-group-${Date.now()}`
      : undefined;

    const newItem: SupplementSetting = {
      id: `supp-setting-${Date.now()}`,
      name: newName.trim(),
      time: formattedTime,
      targetAmount: newTargetAmount || '1',
      status: 'active',
      lastUpdated: Date.now().toString(),
      category: DEFAULT_CATEGORY,
      rotationGroup: groupName,
    };

    let updated = [...editingList, newItem];
    if (newRotationPartnerId) {
      updated = updated.map(item =>
        item.id === newRotationPartnerId ? { ...item, rotationGroup: groupName, lastUpdated: Date.now().toString() } : item
      );
    }

    setEditingList(updated);
    onSaveSettings(updated);
    setNewName('');
    setNewSlot('隨餐');
    setNewScheduleType('每天');
    setNewCustomDays([1, 2, 3, 4, 5]);
    setNewTargetAmount('1');
    setNewRotationPartnerId('');
    setIsAdding(false);
  };

  const toggleCustomDay = (day: number, currentList: number[], setList: (days: number[]) => void) => {
    if (currentList.includes(day)) {
      if (currentList.length > 1) {
        setList(currentList.filter(d => d !== day));
      }
    } else {
      setList([...currentList, day]);
    }
  };

  const activeItems = editingList.filter(s => s.status !== 'paused' && s.status !== 'deleted');
  const pausedItems = editingList.filter(s => s.status === 'paused');

  // 格式化卡片上簡要標籤顯示
  const renderItemScheduleBadges = (timeStr: string) => {
    const parsed = parseSupplementSchedule(timeStr);
    let freqLabel = '每天';
    if (parsed.scheduleType === '平日') freqLabel = '平日';
    else if (parsed.scheduleType === '週末') freqLabel = '週末';
    else if (parsed.scheduleType === '自訂' && parsed.customDays.length > 0) {
      const labelsMap: Record<number, string> = { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 0: '日' };
      const sortOrder = [1, 2, 3, 4, 5, 6, 0];
      const sorted = sortOrder.filter(d => parsed.customDays.includes(d));
      freqLabel = `週${sorted.map(d => labelsMap[d]).join('')}`;
    }

    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-medium">
          {parsed.slot}
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-100/60">
          {freqLabel}
        </span>
      </div>
    );
  };

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />
      <div 
        onClick={e => e.stopPropagation()}
        className="relative bg-[#fdfdfc] w-full max-w-md rounded-2xl shadow-xl border border-stone-200 flex flex-col max-h-[88vh] overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-stone-100 bg-white shrink-0">
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
          {/* Active Items Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-500">啟用中品項 ({activeItems.length})</span>
              <button 
                type="button"
                onClick={() => { setIsAdding(!isAdding); setEditingId(null); }}
                className="text-xs font-bold text-[#5b8c74] hover:text-[#4a725e] flex items-center gap-1"
              >
                <Plus size={14} /> 新增品項
              </button>
            </div>

            {/* 新增品項展開區 */}
            {isAdding && (
              <div className="bg-white border border-stone-200 rounded-xl p-3.5 space-y-3 shadow-xs">
                <div className="text-xs font-bold text-stone-700">新增常態保健品</div>
                <div className="space-y-2.5">
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="品項名稱 (如 魚油、蘇糖酸鎂)"
                    className="w-full text-xs p-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-1 focus:ring-[#6ba388]"
                  />

                  {/* 時段選擇 */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-stone-500">服用時段</span>
                    <div className="grid grid-cols-4 gap-1">
                      {TIME_SLOT_OPTIONS.map(slot => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setNewSlot(slot)}
                          className={`py-1.5 text-[11px] font-medium rounded-lg border transition-all ${
                            newSlot === slot
                              ? 'bg-[#6ba388] text-white border-[#6ba388] shadow-2xs'
                              : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 日子選擇 */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-stone-500">服用日子</span>
                    <div className="grid grid-cols-4 gap-1">
                      {SCHEDULE_TYPE_OPTIONS.map(opt => (
                        <button
                          key={opt.type}
                          type="button"
                          onClick={() => setNewScheduleType(opt.type)}
                          className={`py-1.5 text-[11px] font-medium rounded-lg border transition-all ${
                            newScheduleType === opt.type
                              ? 'bg-stone-800 text-white border-stone-800 shadow-2xs'
                              : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {/* 自訂星期複選 */}
                    {newScheduleType === '自訂' && (
                      <div className="flex items-center justify-between pt-1.5 px-1">
                        {WEEKDAY_OPTIONS.map(opt => {
                          const isSelected = newCustomDays.includes(opt.day);
                          return (
                            <button
                              key={opt.day}
                              type="button"
                              onClick={() => toggleCustomDay(opt.day, newCustomDays, setNewCustomDays)}
                              className={`w-7 h-7 rounded-full text-[11px] font-bold flex items-center justify-center border transition-all ${
                                isSelected
                                  ? 'bg-[#6ba388] text-white border-[#6ba388]'
                                  : 'bg-stone-50 text-stone-400 border-stone-200'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    {/* 每日目標 */}
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

                    {/* 互斥輪替品項 */}
                    <div className="flex items-center gap-1 text-xs">
                      <select
                        value={newRotationPartnerId}
                        onChange={e => setNewRotationPartnerId(e.target.value)}
                        className="w-full text-xs p-1.5 rounded-lg border border-stone-200 bg-white text-stone-600 truncate"
                        title="設定與哪一個品項輪替互斥"
                      >
                        <option value="">無輪替綁定</option>
                        {editingList.map(other => (
                          <option key={other.id} value={other.id}>
                            ⟲ 輪替：{other.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
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

            {/* 啟用中品項清單 */}
            <div className="space-y-2">
              {activeItems.map(item => {
                const amt = parseInt(item.targetAmount, 10) || 1;
                const isEditingThis = editingId === item.id;
                const partner = editingList.find(other => isRotationPartner(item, other));

                if (isEditingThis) {
                  return (
                    <div key={item.id} className="bg-white border-2 border-[#6ba388]/60 rounded-xl p-3.5 space-y-3 shadow-sm">
                      <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                        <span className="text-xs font-bold text-stone-700">調整時段 / 日子</span>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="p-1 rounded text-stone-400 hover:text-stone-600"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        <input
                          type="text"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          placeholder="品項名稱"
                          className="w-full text-xs p-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-1 focus:ring-[#6ba388]"
                        />

                        {/* 時段選擇 */}
                        <div className="space-y-1">
                          <span className="text-[11px] font-semibold text-stone-500">服用時段</span>
                          <div className="grid grid-cols-4 gap-1">
                            {TIME_SLOT_OPTIONS.map(slot => (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => setEditSlot(slot)}
                                className={`py-1.5 text-[11px] font-medium rounded-lg border transition-all ${
                                  editSlot === slot
                                    ? 'bg-[#6ba388] text-white border-[#6ba388] shadow-2xs'
                                    : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                                }`}
                              >
                                {slot}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 日子選擇 */}
                        <div className="space-y-1">
                          <span className="text-[11px] font-semibold text-stone-500">服用日子</span>
                          <div className="grid grid-cols-4 gap-1">
                            {SCHEDULE_TYPE_OPTIONS.map(opt => (
                              <button
                                key={opt.type}
                                type="button"
                                onClick={() => setEditScheduleType(opt.type)}
                                className={`py-1.5 text-[11px] font-medium rounded-lg border transition-all ${
                                  editScheduleType === opt.type
                                    ? 'bg-stone-800 text-white border-stone-800 shadow-2xs'
                                    : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>

                          {editScheduleType === '自訂' && (
                            <div className="flex items-center justify-between pt-1.5 px-1">
                              {WEEKDAY_OPTIONS.map(opt => {
                                const isSelected = editCustomDays.includes(opt.day);
                                return (
                                  <button
                                    key={opt.day}
                                    type="button"
                                    onClick={() => toggleCustomDay(opt.day, editCustomDays, setEditCustomDays)}
                                    className={`w-7 h-7 rounded-full text-[11px] font-bold flex items-center justify-center border transition-all ${
                                      isSelected
                                        ? 'bg-[#6ba388] text-white border-[#6ba388]'
                                        : 'bg-stone-50 text-stone-400 border-stone-200'
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-0.5">
                          {/* 每日目標 */}
                          <div className="flex items-center gap-1.5 text-xs text-stone-500">
                            <span>每日目標：</span>
                            <input
                              type="number"
                              min="1"
                              value={editAmount}
                              onChange={e => setEditAmount(e.target.value)}
                              className="w-14 text-center p-1.5 rounded-lg border border-stone-200 text-xs"
                            />
                            <span>顆</span>
                          </div>

                          {/* 互斥輪替品項 */}
                          <div className="flex items-center gap-1 text-xs">
                            <select
                              value={editRotationPartnerId}
                              onChange={e => setEditRotationPartnerId(e.target.value)}
                              className="w-full text-xs p-1.5 rounded-lg border border-stone-200 bg-white text-stone-600 truncate"
                              title="設定與哪一個品項輪替互斥"
                            >
                              <option value="">無輪替綁定</option>
                              {editingList.filter(other => other.id !== item.id).map(other => (
                                <option key={other.id} value={other.id}>
                                  ⟲ 輪替：{other.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 rounded-lg text-xs text-stone-500 hover:bg-stone-100"
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(item.id)}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#6ba388] text-white hover:bg-[#5b8c74] flex items-center gap-1"
                        >
                          <Check size={13} /> 儲存變更
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div 
                    key={item.id}
                    className="bg-white border border-stone-200 rounded-xl p-3 flex items-center justify-between shadow-2xs"
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-stone-800 truncate">{item.name}</span>
                        {partner && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium border border-amber-200/50" title={`與「${partner.name}」互斥輪替`}>
                            <RefreshCw size={10} className="stroke-[2.5]" />
                            <span>{partner.name}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {renderItemScheduleBadges(item.time)}
                        <span className="text-xs text-stone-400">· {amt} 顆</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
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

                      {/* 編輯按鈕 */}
                      <button
                        type="button"
                        onClick={() => handleStartEdit(item)}
                        className="p-1.5 rounded-lg bg-stone-50 hover:bg-stone-100 text-stone-500 border border-stone-200 transition-colors"
                        title="編輯時段與日子"
                      >
                        <Pencil size={13} />
                      </button>

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
                  const isEditingThis = editingId === item.id;
                  const partner = editingList.find(other => isRotationPartner(item, other));

                  if (isEditingThis) {
                    return (
                      <div key={item.id} className="bg-white border-2 border-stone-300 rounded-xl p-3.5 space-y-3 shadow-sm">
                        <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                          <span className="text-xs font-bold text-stone-700">調整時段 / 日子</span>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="p-1 rounded text-stone-400 hover:text-stone-600"
                          >
                            <X size={14} />
                          </button>
                        </div>

                        <div className="space-y-2.5">
                          <input
                            type="text"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            placeholder="品項名稱"
                            className="w-full text-xs p-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-1 focus:ring-stone-400"
                          />

                          {/* 時段選擇 */}
                          <div className="space-y-1">
                            <span className="text-[11px] font-semibold text-stone-500">服用時段</span>
                            <div className="grid grid-cols-4 gap-1">
                              {TIME_SLOT_OPTIONS.map(slot => (
                                <button
                                  key={slot}
                                  type="button"
                                  onClick={() => setEditSlot(slot)}
                                  className={`py-1.5 text-[11px] font-medium rounded-lg border transition-all ${
                                    editSlot === slot
                                      ? 'bg-stone-700 text-white border-stone-700 shadow-2xs'
                                      : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                                  }`}
                                >
                                  {slot}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* 日子選擇 */}
                          <div className="space-y-1">
                            <span className="text-[11px] font-semibold text-stone-500">服用日子</span>
                            <div className="grid grid-cols-4 gap-1">
                              {SCHEDULE_TYPE_OPTIONS.map(opt => (
                                <button
                                  key={opt.type}
                                  type="button"
                                  onClick={() => setEditScheduleType(opt.type)}
                                  className={`py-1.5 text-[11px] font-medium rounded-lg border transition-all ${
                                    editScheduleType === opt.type
                                      ? 'bg-stone-800 text-white border-stone-800 shadow-2xs'
                                      : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>

                            {editScheduleType === '自訂' && (
                              <div className="flex items-center justify-between pt-1.5 px-1">
                                {WEEKDAY_OPTIONS.map(opt => {
                                  const isSelected = editCustomDays.includes(opt.day);
                                  return (
                                    <button
                                      key={opt.day}
                                      type="button"
                                      onClick={() => toggleCustomDay(opt.day, editCustomDays, setEditCustomDays)}
                                      className={`w-7 h-7 rounded-full text-[11px] font-bold flex items-center justify-center border transition-all ${
                                        isSelected
                                          ? 'bg-stone-700 text-white border-stone-700'
                                          : 'bg-stone-50 text-stone-400 border-stone-200'
                                      }`}
                                    >
                                      {opt.label}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-0.5">
                            <div className="flex items-center gap-1.5 text-xs text-stone-500">
                              <span>每日目標：</span>
                              <input
                                type="number"
                                min="1"
                                value={editAmount}
                                onChange={e => setEditAmount(e.target.value)}
                                className="w-14 text-center p-1.5 rounded-lg border border-stone-200 text-xs"
                              />
                              <span>顆</span>
                            </div>

                            <div className="flex items-center gap-1 text-xs">
                              <select
                                value={editRotationPartnerId}
                                onChange={e => setEditRotationPartnerId(e.target.value)}
                                className="w-full text-xs p-1.5 rounded-lg border border-stone-200 bg-white text-stone-600 truncate"
                              >
                                <option value="">無輪替綁定</option>
                                {editingList.filter(other => other.id !== item.id).map(other => (
                                  <option key={other.id} value={other.id}>
                                    ⟲ 輪替：{other.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1.5 rounded-lg text-xs text-stone-500 hover:bg-stone-100"
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(item.id)}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-stone-800 text-white hover:bg-stone-700 flex items-center gap-1"
                          >
                            <Check size={13} /> 儲存變更
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div 
                      key={item.id}
                      className="bg-stone-50/80 border border-stone-200 rounded-xl p-3 flex items-center justify-between opacity-80"
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-stone-500 line-through truncate">{item.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-200 text-stone-500 font-medium">
                            暫停
                          </span>
                          {partner && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-stone-200 text-stone-500 font-medium" title={`與「${partner.name}」互斥輪替`}>
                              <RefreshCw size={9} />
                              <span>{partner.name}</span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {renderItemScheduleBadges(item.time)}
                          <span className="text-xs text-stone-400">· {amt} 顆</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* 編輯按鈕 */}
                        <button
                          type="button"
                          onClick={() => handleStartEdit(item)}
                          className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-500 border border-stone-200 transition-colors"
                          title="編輯時段與日子"
                        >
                          <Pencil size={13} />
                        </button>

                        {/* 啟用開關按鈕 */}
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(item.id)}
                          className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-[#6ba388] hover:bg-[#5b8c74] text-white transition-colors shadow-2xs"
                          title="點擊恢復啟用此品項 (將自動暫停輪替對象)"
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
        <div className="p-3 border-t border-stone-100 bg-stone-50 flex justify-end shrink-0">
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

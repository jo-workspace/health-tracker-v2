'use client';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Package,
  Plus,
  Minus,
  Search,
  Sparkles,
  Edit2,
  Trash2,
  AlertCircle,
  MapPin
} from 'lucide-react';
import type { SupplementInventoryItem, SupplementSetting, SyncPayload } from '@/lib/types';
import InventoryEditModal from './forms/InventoryEditModal';

interface Props {
  inventory?: SupplementInventoryItem[];
  settings?: SupplementSetting[];
  updateData: (payload: SyncPayload) => void;
}

export default function SupplementInventoryTab({ inventory = [], settings = [], updateData }: Props) {
  const [localInventory, setLocalInventory] = useState<SupplementInventoryItem[]>(inventory);
  const [searchTerm, setSearchTerm] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | '兩人共用' | '僅自己' | '僅先生'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<SupplementInventoryItem | null>(null);

  const isDebouncingRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 當外部資料更新且非當前防抖微調中時，同步至 localInventory
  useEffect(() => {
    if (!isDebouncingRef.current) {
      setLocalInventory(inventory);
    }
  }, [inventory]);

  // 防抖同步：避免快速點擊 + / - 時頻繁打 API 觸發 Google 60 次/分限流
  const debouncedSync = useCallback((newItems: SupplementInventoryItem[]) => {
    isDebouncingRef.current = true;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      isDebouncingRef.current = false;
      updateData({ supplementInventory: newItems, clientTimestamp: Date.now() });
    }, 600);
  }, [updateData]);

  // 有效品項（排除 status === 'deleted'）
  const activeItems = useMemo(() => {
    return localInventory.filter(item => item.status !== 'deleted');
  }, [localInventory]);

  // 統計數據
  const stats = useMemo(() => {
    let totalOpened = 0;
    let totalUnopened = 0;
    let zeroUnopenedCount = 0;

    activeItems.forEach(item => {
      totalOpened += item.openedCount || 0;
      totalUnopened += item.unopenedCount || 0;
      if ((item.unopenedCount || 0) === 0) {
        zeroUnopenedCount++;
      }
    });

    return {
      totalKinds: activeItems.length,
      totalOpened,
      totalUnopened,
      zeroUnopenedCount,
    };
  }, [activeItems]);

  // 篩選後清單
  const filteredItems = useMemo(() => {
    return activeItems.filter(item => {
      const matchSearch =
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.brand && item.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.location && item.location.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.notes && item.notes.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchUser = userFilter === 'all' || item.targetUsers === userFilter;

      return matchSearch && matchUser;
    });
  }, [activeItems, searchTerm, userFilter]);

  // 儲存（新增或編輯）
  const handleSaveItem = useCallback((itemData: Partial<SupplementInventoryItem>) => {
    const timestamp = Date.now();
    const nowStr = timestamp.toString();
    let updated: SupplementInventoryItem[];

    if (itemData.id) {
      // 編輯
      updated = localInventory.map(item =>
        item.id === itemData.id
          ? ({ ...item, ...itemData, lastUpdated: nowStr } as SupplementInventoryItem)
          : item
      );
    } else {
      // 新增
      const newItem: SupplementInventoryItem = {
        id: `supp-inv-${timestamp}-${Math.random().toString(36).substring(2, 7)}`,
        name: itemData.name || '',
        brand: itemData.brand || '',
        category: itemData.category || '其他',
        openedCount: itemData.openedCount ?? 1,
        unopenedCount: itemData.unopenedCount ?? 0,
        targetUsers: itemData.targetUsers || '兩人共用',
        location: itemData.location || '',
        notes: itemData.notes || '',
        status: 'active',
        lastUpdated: nowStr,
      };
      updated = [...localInventory, newItem];
    }

    setLocalInventory(updated);
    updateData({ supplementInventory: updated, clientTimestamp: timestamp });
  }, [localInventory, updateData]);

  // 快捷操作：開新的一罐 (未開啟 -1, 已開啟 +1)
  const handleOpenNewBottle = useCallback((itemId: string) => {
    const timestamp = Date.now();
    const nowStr = timestamp.toString();
    const updated = localInventory.map(item => {
      if (item.id === itemId && (item.unopenedCount || 0) > 0) {
        return {
          ...item,
          unopenedCount: (item.unopenedCount || 0) - 1,
          openedCount: (item.openedCount || 0) + 1,
          lastUpdated: nowStr,
        };
      }
      return item;
    });
    setLocalInventory(updated);
    debouncedSync(updated);
  }, [localInventory, debouncedSync]);

  // 快捷操作：吃完一罐 (已開啟 -1)
  const handleFinishOpenedBottle = useCallback((itemId: string) => {
    const timestamp = Date.now();
    const nowStr = timestamp.toString();
    const updated = localInventory.map(item => {
      if (item.id === itemId && (item.openedCount || 0) > 0) {
        return {
          ...item,
          openedCount: (item.openedCount || 0) - 1,
          lastUpdated: nowStr,
        };
      }
      return item;
    });
    setLocalInventory(updated);
    debouncedSync(updated);
  }, [localInventory, debouncedSync]);

  // 微調罐數
  const handleAdjustCount = useCallback((itemId: string, field: 'openedCount' | 'unopenedCount', delta: number) => {
    const timestamp = Date.now();
    const nowStr = timestamp.toString();
    const updated = localInventory.map(item => {
      if (item.id === itemId) {
        const current = item[field] || 0;
        const nextVal = Math.max(0, current + delta);
        return {
          ...item,
          [field]: nextVal,
          lastUpdated: nowStr,
        };
      }
      return item;
    });
    setLocalInventory(updated);
    debouncedSync(updated);
  }, [localInventory, debouncedSync]);

  // 刪除品項
  const handleDeleteItem = useCallback((itemId: string, itemName: string) => {
    if (!confirm(`確定要將「${itemName}」從庫存清單移除嗎？`)) return;
    const timestamp = Date.now();
    const nowStr = timestamp.toString();
    const updated = localInventory.map(item =>
      item.id === itemId ? { ...item, status: 'deleted' as const, lastUpdated: nowStr } : item
    );
    setLocalInventory(updated);
    updateData({ supplementInventory: updated, clientTimestamp: timestamp });
  }, [localInventory, updateData]);

  // 一鍵匯入所有日常打卡名單
  const handleImportAllSettings = useCallback(() => {
    const existingNames = new Set(activeItems.map(i => i.name.trim()));
    const toImport = settings.filter(s => s.status !== 'deleted' && !existingNames.has(s.name.trim()));

    if (toImport.length === 0) {
      alert('所有日常打卡品項都已在庫存清單中！');
      return;
    }

    if (!confirm(`是否要自動建立 ${toImport.length} 個日常保健品品項至庫存（預設已開啟 1 罐、未開啟 0 罐）？`)) {
      return;
    }

    const timestamp = Date.now();
    const nowStr = timestamp.toString();
    const newItems: SupplementInventoryItem[] = toImport.map(s => ({
      id: `supp-inv-${timestamp}-${Math.random().toString(36).substring(2, 7)}`,
      name: s.name,
      brand: '',
      category: s.category || '其他',
      openedCount: 1,
      unopenedCount: 0,
      targetUsers: '兩人共用',
      location: '',
      notes: '',
      status: 'active',
      lastUpdated: nowStr,
    }));

    const updated = [...localInventory, ...newItems];
    setLocalInventory(updated);
    updateData({
      supplementInventory: updated,
      clientTimestamp: timestamp,
    });
  }, [activeItems, settings, localInventory, updateData]);

  return (
    <div className="w-full max-w-md mx-auto space-y-4 pt-2">
      {/* 統計概覽 Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-stone-200/80">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-700">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-800">保健品庫存</h2>
            </div>
          </div>
          <button
            onClick={() => {
              setItemToEdit(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1 text-xs font-semibold text-white bg-[#52806b] hover:bg-[#446e5b] px-3 py-1.5 rounded-xl shadow-xs transition-colors active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            新增品項
          </button>
        </div>

        {/* 數值儀表 */}
        <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-stone-100">
          <div className="bg-stone-50/80 py-2 rounded-xl">
            <div className="text-[11px] text-stone-500 font-medium">總品項</div>
            <div className="text-lg font-bold text-stone-700">{stats.totalKinds} <span className="text-xs font-normal text-stone-400">種</span></div>
          </div>
          <div className="bg-emerald-50/60 py-2 rounded-xl">
            <div className="text-[11px] text-emerald-700 font-medium">已開啟</div>
            <div className="text-lg font-bold text-emerald-800">{stats.totalOpened} <span className="text-xs font-normal text-emerald-600">罐</span></div>
          </div>
          <div className="bg-sky-50/60 py-2 rounded-xl">
            <div className="text-[11px] text-sky-700 font-medium">備用</div>
            <div className="text-lg font-bold text-sky-800">{stats.totalUnopened} <span className="text-xs font-normal text-sky-600">罐</span></div>
          </div>
        </div>

        {stats.zeroUnopenedCount > 0 && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50/80 px-2.5 py-1.5 rounded-lg border border-amber-200/60">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
            <span>有 <strong>{stats.zeroUnopenedCount}</strong> 項保健品目前無未拆備用罐</span>
          </div>
        )}
      </div>

      {/* 搜尋與對象篩選 */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="搜尋保健品、品牌、存放位置..."
            className="w-full text-xs pl-9 pr-3 py-2 bg-white rounded-xl border border-stone-200/80 text-stone-700 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#52806b]/20 focus:border-[#52806b]"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* 對象標籤篩選 */}
        <div className="flex gap-1.5 text-xs overflow-x-auto pb-1 scrollbar-none">
          {(['all', '兩人共用', '僅自己', '僅先生'] as const).map(userKey => (
            <button
              key={userKey}
              onClick={() => setUserFilter(userKey)}
              className={`px-3 py-1 rounded-lg transition-colors shrink-0 text-[11px] font-medium ${
                userFilter === userKey
                  ? 'bg-stone-800 text-white shadow-2xs'
                  : 'bg-white text-stone-600 border border-stone-200/80 hover:bg-stone-50'
              }`}
            >
              {userKey === 'all' ? '全部對象' : userKey}
            </button>
          ))}
        </div>
      </div>

      {/* 庫存列表 */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-stone-200/80 space-y-3">
          <div className="w-12 h-12 mx-auto bg-stone-100 rounded-full flex items-center justify-center text-stone-400">
            <Package className="w-6 h-6" />
          </div>
          <div className="text-sm font-semibold text-stone-600">
            {searchTerm ? '找不到符合搜尋的保健品' : '尚未建立保健品庫存'}
          </div>
          <p className="text-xs text-stone-400 max-w-xs mx-auto">
            {searchTerm
              ? '請嘗試更換關鍵字'
              : '你可以手動新增，或直接從現有每日打卡清單快速匯入！'}
          </p>

          {!searchTerm && settings.length > 0 && (
            <button
              onClick={handleImportAllSettings}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#52806b] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-2 rounded-xl transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              一鍵匯入每日打卡品項
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map(item => {
            const opened = item.openedCount || 0;
            const unopened = item.unopenedCount || 0;
            const total = opened + unopened;

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-2xs hover:shadow-xs transition-shadow"
              >
                {/* 頂部資訊列 */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-bold text-stone-800">{item.name}</span>
                      {item.brand && (
                        <span className="text-xs text-stone-500 font-normal bg-stone-100 px-1.5 py-0.5 rounded">
                          {item.brand}
                        </span>
                      )}
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                        {item.targetUsers || '兩人共用'}
                      </span>
                    </div>

                    {/* 輔助標籤：分類、位置、備註 */}
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-stone-400 flex-wrap">
                      {item.category && <span>{item.category}</span>}
                      {item.location && (
                        <span className="flex items-center gap-0.5 text-stone-500">
                          <MapPin className="w-3 h-3" />
                          {item.location}
                        </span>
                      )}
                      {item.notes && <span className="text-stone-400">· {item.notes}</span>}
                    </div>
                  </div>

                  {/* 編輯 / 刪除 */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setItemToEdit(item);
                        setIsModalOpen(true);
                      }}
                      className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors"
                      title="編輯"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id, item.name)}
                      className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                      title="刪除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 罐數管理區塊 */}
                <div className="mt-3.5 pt-3 border-t border-stone-100 grid grid-cols-2 gap-2.5">
                  {/* 已開啟 (食用中) */}
                  <div className="bg-emerald-50/50 rounded-xl p-2.5 border border-emerald-100/80 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-emerald-800 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        已開啟
                      </span>
                      <span className="text-xs font-bold text-emerald-700">{opened} 罐</span>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <button
                        onClick={() => handleAdjustCount(item.id, 'openedCount', -1)}
                        disabled={opened <= 0}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-100 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
                        title="已開啟 -1"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleFinishOpenedBottle(item.id)}
                        disabled={opened <= 0}
                        className="text-[10px] font-medium px-1.5 py-1 rounded bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-100 active:scale-95 disabled:opacity-40"
                      >
                        吃完1罐
                      </button>
                      <button
                        onClick={() => handleAdjustCount(item.id, 'openedCount', 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-100 active:scale-95"
                        title="已開啟 +1"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* 未開啟 (備用庫存) */}
                  <div className={`rounded-xl p-2.5 border flex flex-col justify-between ${
                    unopened === 0
                      ? 'bg-amber-50/40 border-amber-200/70'
                      : 'bg-sky-50/50 border-sky-100/80'
                  }`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-xs font-semibold flex items-center gap-1 ${
                        unopened === 0 ? 'text-amber-800' : 'text-sky-800'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${unopened === 0 ? 'bg-amber-400' : 'bg-sky-500'}`} />
                        未開啟
                      </span>
                      <span className={`text-xs font-bold ${unopened === 0 ? 'text-amber-700' : 'text-sky-700'}`}>
                        {unopened} 罐
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <button
                        onClick={() => handleAdjustCount(item.id, 'unopenedCount', -1)}
                        disabled={unopened <= 0}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-stone-200 text-stone-600 hover:bg-stone-100 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
                        title="未開啟 -1"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      
                      {/* 開新的一罐快捷按鈕 */}
                      <button
                        onClick={() => handleOpenNewBottle(item.id)}
                        disabled={unopened <= 0}
                        className="text-[10px] font-semibold px-2 py-1 rounded bg-[#52806b] text-white hover:bg-[#446e5b] active:scale-95 disabled:bg-stone-200 disabled:text-stone-400 shadow-2xs transition-colors"
                        title="未開啟 -1，已開啟 +1"
                      >
                        開新罐
                      </button>

                      <button
                        onClick={() => handleAdjustCount(item.id, 'unopenedCount', 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-stone-200 text-stone-600 hover:bg-stone-100 active:scale-95"
                        title="未開啟 +1 (新買入庫)"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 底部總計與提示 */}
                <div className="mt-2.5 flex items-center justify-between text-[11px] text-stone-500 px-1">
                  <span>總計：<strong>{total}</strong> 罐</span>
                  {unopened === 0 ? (
                    <span className="text-amber-600 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      無備用庫存
                    </span>
                  ) : (
                    <span className="text-stone-400">
                      備用庫存充足 ({unopened} 罐)
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 新增 / 編輯彈窗 */}
      <InventoryEditModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        itemToEdit={itemToEdit}
        onSave={handleSaveItem}
        existingSettings={settings}
        existingInventory={inventory}
      />
    </div>
  );
}

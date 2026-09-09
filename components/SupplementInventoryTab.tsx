'use client';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Package,
  Plus,
  Search,
  Sparkles,
  AlertCircle
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
  const [userFilter, setUserFilter] = useState<'all' | '兩人共用' | '僅自己'>('all');
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

  // 防抖同步：避免快速點擊時頻繁打 API 觸發 Google 限流
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

  // 統計數據：強制以 Number() 轉型，防止字串相加變 011111111
  const stats = useMemo(() => {
    let totalOpened = 0;
    let totalUnopened = 0;
    let zeroUnopenedCount = 0;

    activeItems.forEach(item => {
      const opened = Number(item.openedCount) || 0;
      const unopened = Number(item.unopenedCount) || 0;
      totalOpened += opened;
      totalUnopened += unopened;
      if (unopened === 0) {
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
          ? ({
              ...item,
              ...itemData,
              openedCount: Number(itemData.openedCount) || 0,
              unopenedCount: Number(itemData.unopenedCount) || 0,
              lastUpdated: nowStr,
            } as SupplementInventoryItem)
          : item
      );
    } else {
      // 新增
      const newItem: SupplementInventoryItem = {
        id: `supp-inv-${timestamp}-${Math.random().toString(36).substring(2, 7)}`,
        name: itemData.name || '',
        brand: itemData.brand || '',
        category: itemData.category || '其他',
        openedCount: Number(itemData.openedCount) || 1,
        unopenedCount: Number(itemData.unopenedCount) || 0,
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
      const unopened = Number(item.unopenedCount) || 0;
      const opened = Number(item.openedCount) || 0;
      if (item.id === itemId && unopened > 0) {
        return {
          ...item,
          unopenedCount: Math.max(0, unopened - 1),
          openedCount: opened + 1,
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
      const opened = Number(item.openedCount) || 0;
      if (item.id === itemId && opened > 0) {
        return {
          ...item,
          openedCount: Math.max(0, opened - 1),
          lastUpdated: nowStr,
        };
      }
      return item;
    });
    setLocalInventory(updated);
    debouncedSync(updated);
  }, [localInventory, debouncedSync]);

  // 微調未開啟備用罐 (+1)
  const handleAddUnopenedBottle = useCallback((itemId: string) => {
    const timestamp = Date.now();
    const nowStr = timestamp.toString();
    const updated = localInventory.map(item => {
      if (item.id === itemId) {
        const current = Number(item.unopenedCount) || 0;
        return {
          ...item,
          unopenedCount: current + 1,
          lastUpdated: nowStr,
        };
      }
      return item;
    });
    setLocalInventory(updated);
    debouncedSync(updated);
  }, [localInventory, debouncedSync]);

  // 刪除品項
  const handleDeleteItem = useCallback((itemId: string) => {
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

      {/* 搜尋與對象篩選 (排除僅先生) */}
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
          {(['all', '兩人共用', '僅自己'] as const).map(userKey => (
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

      {/* 庫存列表 (精簡一覽清單) */}
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
        <div className="space-y-2">
          {filteredItems.map(item => {
            const opened = Number(item.openedCount) || 0;
            const unopened = Number(item.unopenedCount) || 0;

            return (
              <div
                key={item.id}
                onClick={() => {
                  setItemToEdit(item);
                  setIsModalOpen(true);
                }}
                className="bg-white rounded-xl px-3 py-2.5 border border-stone-200/80 shadow-2xs hover:shadow-xs hover:border-[#52806b]/40 transition-all cursor-pointer flex items-center justify-between gap-2.5 group"
              >
                {/* 左側：品名與詳細資訊 */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-bold text-stone-800 group-hover:text-[#446e5b] transition-colors truncate">
                      {item.name}
                    </span>
                    {item.targetUsers === '僅自己' ? (
                      <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-full bg-stone-100 text-stone-600 border border-stone-200/60 shrink-0">
                        僅自己
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 shrink-0">
                        兩人
                      </span>
                    )}
                  </div>

                  {/* 次要資訊（品牌、分類、存放地點） */}
                  {(item.brand || item.location || item.category) && (
                    <div className="flex items-center gap-1 mt-0.5 text-[11px] text-stone-400 truncate">
                      {item.brand && <span>{item.brand}</span>}
                      {item.brand && (item.location || item.category) && <span>·</span>}
                      {item.category && <span>{item.category}</span>}
                      {item.location && <span>· {item.location}</span>}
                    </div>
                  )}
                </div>

                {/* 右側：數量狀態與快捷動作 */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* 已開啟 */}
                  <div className="flex items-center bg-emerald-50 text-emerald-800 border border-emerald-200/80 rounded-lg p-0.5">
                    <span className="text-[11px] font-bold px-1.5 py-0.5">
                      開 {opened}
                    </span>
                    {opened > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFinishOpenedBottle(item.id);
                        }}
                        className="text-[10px] font-medium text-emerald-700 hover:text-emerald-900 bg-white hover:bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200/80 active:scale-95 transition-all shadow-2xs"
                        title="吃完 1 罐"
                      >
                        吃完
                      </button>
                    )}
                  </div>

                  {/* 備用 */}
                  <div className={`text-[11px] font-bold px-2 py-1 rounded-lg border ${
                    unopened === 0
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-sky-50 text-sky-800 border-sky-100'
                  }`}>
                    備 {unopened}
                  </div>

                  {/* 動作群 */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenNewBottle(item.id);
                      }}
                      disabled={unopened <= 0}
                      className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-[#52806b] text-white hover:bg-[#446e5b] active:scale-95 disabled:bg-stone-100 disabled:text-stone-300 disabled:pointer-events-none shadow-2xs transition-colors whitespace-nowrap"
                      title="開新罐（備用 -1，已開 +1）"
                    >
                      開新罐
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddUnopenedBottle(item.id);
                      }}
                      className="w-6 h-6 flex items-center justify-center rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-stone-900 active:scale-95 transition-colors shadow-2xs font-bold"
                      title="新買備用入庫 (+1)"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                  </div>
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
        onDelete={handleDeleteItem}
        existingSettings={settings}
        existingInventory={localInventory}
      />
    </div>
  );
}

'use client';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Package,
  Plus,
  Search,
  Sparkles,
  AlertCircle,
  Archive
} from 'lucide-react';
import type { SupplementInventoryItem, SupplementSetting, SyncPayload } from '@/lib/types';
import { CATEGORY_ORDER, DEFAULT_CATEGORY, normalizeSupplementCategory } from '@/lib/supplements';
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

  // 統計數據：備用不足提醒僅針對主力常規品項（排除已封存）
  const stats = useMemo(() => {
    let totalOpened = 0;
    let totalUnopened = 0;
    let zeroUnopenedCount = 0;

    activeItems.forEach(item => {
      const opened = Number(item.openedCount) || 0;
      const unopened = Number(item.unopenedCount) || 0;
      totalOpened += opened;
      totalUnopened += unopened;
      if (unopened === 0 && !item.isArchived) {
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

  // 排序函式：依分類順序 ➔ 同分類內依品名筆畫
  const sortByCategoryAndName = useCallback((a: SupplementInventoryItem, b: SupplementInventoryItem) => {
    const catA = normalizeSupplementCategory(a.category);
    const catB = normalizeSupplementCategory(b.category);

    const getCatRank = (cat: string) => {
      const idx = CATEGORY_ORDER.indexOf(cat);
      return idx === -1 ? 999 : idx;
    };

    const rankDiff = getCatRank(catA) - getCatRank(catB);
    if (rankDiff !== 0) return rankDiff;

    return (a.name || '').localeCompare(b.name || '', 'zh-Hant');
  }, []);

  // 搜尋與對象篩選
  const filteredItems = useMemo(() => {
    return activeItems.filter(item => {
      const matchSearch =
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.brand && item.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.notes && item.notes.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchUser = userFilter === 'all' || item.targetUsers === userFilter;

      return matchSearch && matchUser;
    });
  }, [activeItems, searchTerm, userFilter]);

  // 分離主力品項與封存置底品項，並各自排序
  const { regularItems, archivedItems } = useMemo(() => {
    const regular: SupplementInventoryItem[] = [];
    const archived: SupplementInventoryItem[] = [];

    filteredItems.forEach(item => {
      if (item.isArchived) {
        archived.push(item);
      } else {
        regular.push(item);
      }
    });

    regular.sort(sortByCategoryAndName);
    archived.sort(sortByCategoryAndName);

    return { regularItems: regular, archivedItems: archived };
  }, [filteredItems, sortByCategoryAndName]);

  // 儲存（新增或編輯）
  const handleSaveItem = useCallback((itemData: Partial<SupplementInventoryItem>) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      isDebouncingRef.current = false;
    }
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
              isArchived: Boolean(itemData.isArchived),
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
        category: normalizeSupplementCategory(itemData.category),
        openedCount: Number(itemData.openedCount) || 1,
        unopenedCount: Number(itemData.unopenedCount) || 0,
        targetUsers: itemData.targetUsers || '兩人共用',
        notes: itemData.notes || '',
        isArchived: Boolean(itemData.isArchived),
        status: 'active',
        lastUpdated: nowStr,
      };
      updated = [...localInventory, newItem];
    }

    setLocalInventory(updated);
    updateData({ supplementInventory: updated, clientTimestamp: timestamp });
  }, [localInventory, updateData]);

  // 快捷操作：開新罐（同一種只會開一罐，備用 -1，已開維持 1）
  const handleOpenNewBottle = useCallback((itemId: string) => {
    const timestamp = Date.now();
    const nowStr = timestamp.toString();
    const updated = localInventory.map(item => {
      const unopened = Number(item.unopenedCount) || 0;
      if (item.id === itemId && unopened > 0) {
        return {
          ...item,
          unopenedCount: Math.max(0, unopened - 1),
          openedCount: 1,
          lastUpdated: nowStr,
        };
      }
      return item;
    });
    setLocalInventory(updated);
    debouncedSync(updated);
  }, [localInventory, debouncedSync]);

  // 快捷操作：吃完了（無備用罐時，已開啟設為 0）
  const handleFinishBottle = useCallback((itemId: string) => {
    const timestamp = Date.now();
    const nowStr = timestamp.toString();
    const updated = localInventory.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          openedCount: 0,
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
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      isDebouncingRef.current = false;
    }
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

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      isDebouncingRef.current = false;
    }

    const timestamp = Date.now();
    const nowStr = timestamp.toString();
    const newItems: SupplementInventoryItem[] = toImport.map(s => ({
      id: `supp-inv-${timestamp}-${Math.random().toString(36).substring(2, 7)}`,
      name: s.name,
      brand: '',
      category: normalizeSupplementCategory(s.category),
      openedCount: 1,
      unopenedCount: 0,
      targetUsers: '兩人共用',
      notes: '',
      isArchived: false,
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

  // 渲染單一品項卡片
  const renderItemCard = (item: SupplementInventoryItem, isArchivedSection = false) => {
    const opened = Number(item.openedCount) || 0;
    const unopened = Number(item.unopenedCount) || 0;

    return (
      <div
        key={item.id}
        onClick={() => {
          setItemToEdit(item);
          setIsModalOpen(true);
        }}
        className={`rounded-xl px-3 py-2.5 border transition-all cursor-pointer flex items-center justify-between gap-2.5 group ${
          isArchivedSection
            ? 'bg-stone-50/70 border-stone-200/60 opacity-80 hover:opacity-100 hover:border-stone-300'
            : 'bg-white border-stone-200/80 shadow-2xs hover:shadow-xs hover:border-[#52806b]/40'
        }`}
      >
        {/* 左側：品名與詳細資訊 */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`text-sm font-bold truncate transition-colors ${
                isArchivedSection
                  ? 'text-stone-600 group-hover:text-stone-800'
                  : 'text-stone-800 group-hover:text-[#446e5b]'
              }`}
            >
              {item.name}
            </span>

            {isArchivedSection && (
              <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-full bg-stone-200/70 text-stone-600 shrink-0">
                封存
              </span>
            )}

            {item.targetUsers === '僅自己' ? (
              <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-full bg-stone-100 text-stone-600 border border-stone-200/60 shrink-0">
                僅自己
              </span>
            ) : (
              <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 shrink-0">
                兩人
              </span>
            )}

            {opened > 0 ? (
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 shrink-0">
                已開啟
              </span>
            ) : (
              <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-full bg-stone-100 text-stone-400 border border-stone-200/60 shrink-0">
                未開啟
              </span>
            )}
          </div>

          {/* 次要資訊（品牌、分類、備註） */}
          {(item.brand || item.category || item.notes) && (
            <div className="flex items-center gap-1 mt-0.5 text-[11px] text-stone-400 truncate">
              {item.brand && <span>{item.brand}</span>}
              {item.brand && item.category && <span>·</span>}
              {item.category && <span>{normalizeSupplementCategory(item.category)}</span>}
              {item.notes && <span>· {item.notes}</span>}
            </div>
          )}
        </div>

        {/* 右側：數量狀態與快捷動作 */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* 備用 */}
          <span
            className={`text-[11px] font-bold px-2 py-1 rounded-lg border ${
              unopened === 0
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-stone-50 text-stone-700 border-stone-200/80'
            }`}
          >
            備 {unopened}
          </span>

          {/* 動作按鈕：有備用則「開新罐」；無備用且已開則「吃完了」 */}
          {unopened > 0 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenNewBottle(item.id);
              }}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[#52806b] text-white hover:bg-[#446e5b] active:scale-95 shadow-2xs transition-all whitespace-nowrap"
              title="開新罐（備用 -1，已開 1 罐）"
            >
              開新罐
            </button>
          ) : opened > 0 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleFinishBottle(item.id);
              }}
              className="text-[11px] font-medium px-2 py-1 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200 active:scale-95 border border-stone-200/80 shadow-2xs transition-all whitespace-nowrap"
              title="吃完了（已開啟設為 0）"
            >
              吃完了
            </button>
          ) : null}

          {/* 備用罐 +1 按鈕 */}
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
    );
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-4 pt-2 pb-8">
      {/* 備用罐不足提醒（精簡提示） */}
      {stats.zeroUnopenedCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50/90 px-3 py-2 rounded-xl border border-amber-200/80 font-medium shadow-2xs">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>有 <strong className="text-amber-900">{stats.zeroUnopenedCount}</strong> 項保健品目前無備用罐</span>
        </div>
      )}

      {/* 搜尋與對象篩選 */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="搜尋保健品、品牌、備註..."
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

      {/* 庫存列表 */}
      {regularItems.length === 0 && archivedItems.length === 0 ? (
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
        <div className="space-y-4">
          {/* 主力常態品項（依分類 ➔ 品名排序） */}
          {regularItems.length > 0 && (
            <div className="space-y-2">
              {regularItems.map(item => renderItemCard(item, false))}
            </div>
          )}

          {/* 封存置底品項（極簡分隔線） */}
          {archivedItems.length > 0 && (
            <div className="pt-2">
              <div className="flex items-center gap-2 mb-2 px-1 text-stone-400 select-none">
                <Archive className="w-3.5 h-3.5 text-stone-400" />
                <span className="text-[11px] font-medium tracking-wide">封存 · {archivedItems.length}</span>
                <div className="h-px bg-stone-200/80 flex-1" />
              </div>
              <div className="space-y-2">
                {archivedItems.map(item => renderItemCard(item, true))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 浮動新增品項按鈕 (FAB) */}
      <div className="fixed bottom-20 right-4 sm:right-[max(1.5rem,calc(50%-13rem))] z-30 pointer-events-auto">
        <button
          type="button"
          onClick={() => {
            setItemToEdit(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#52806b] hover:bg-[#446e5b] text-white font-semibold text-xs shadow-lg active:scale-95 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>新增品項</span>
        </button>
      </div>

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

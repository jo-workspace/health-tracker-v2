'use client';

import { useState, useMemo, useCallback } from 'react';
import type { Ingredient, PantryData } from '@/lib/types';
import { saveIngredient, deleteIngredient } from '@/lib/api';
import { useToast } from '../layout/Toast';
import IngredientModal from '../pantry/IngredientModal';

interface ShoppingTabProps {
  data: PantryData;
  onMutate: () => void;
}

export default function ShoppingTab({ data, onMutate }: ShoppingTabProps) {
  const { showToast } = useToast();
  const [activeStore, setActiveStore] = useState<string | null>(null);
  const [modalItem, setModalItem] = useState<Ingredient | null | 'new'>(null);
  const [saving, setSaving] = useState(false);

  // 取得需要採購的項目
  const shoppingItems = useMemo(() => {
    const items: (Ingredient & { totalQty: number; maxMinStock: number })[] = [];
    const processedNames = new Set<string>();
    
    data.ingredients.forEach(i => {
      if (!i.replenish) return;
      const normName = i.name.trim().toLowerCase();
      if (processedNames.has(normName)) return;
      
      const sameNameItems = data.ingredients.filter(other => other.name.trim().toLowerCase() === normName);
      const totalQty = sameNameItems.reduce((sum, other) => sum + (Number(other.quantity) || 0), 0);
      const maxMinStock = sameNameItems.reduce((max, other) => Math.max(max, Number(other.minStock) || 0), 0);
      
      if (totalQty <= maxMinStock) {
        processedNames.add(normName);
        items.push({ ...i, totalQty, maxMinStock });
      }
    });
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }, [data.ingredients]);

  // 依通路分組
  const { grouped, availableStores } = useMemo(() => {
    const buckets: Record<string, typeof shoppingItems> = { '未指定通路': [] };
    const allStores = new Set<string>();
    
    shoppingItems.forEach(i => {
      if (!i.channels || i.channels.length === 0) {
        buckets['未指定通路'].push(i);
      } else {
        i.channels.forEach(c => {
          if (!buckets[c]) buckets[c] = [];
          buckets[c].push(i);
          allStores.add(c);
        });
      }
    });
    
    const storeList = Array.from(allStores).sort();
    if (buckets['未指定通路'].length > 0) {
      storeList.push('未指定通路');
    }

    let displayStores = storeList;
    if (activeStore) {
      displayStores = [activeStore];
    }

    return { 
      grouped: displayStores.map(store => ({ store, items: buckets[store] || [] })).filter(g => g.items.length > 0),
      availableStores: storeList 
    };
  }, [shoppingItems, activeStore]);

  const handlePurchase = useCallback(async (item: Ingredient) => {
    const qtyStr = prompt(`購入「${item.name}」數量？`, '1');
    if (!qtyStr) return;
    const q = parseFloat(qtyStr);
    if (isNaN(q) || q <= 0) return;

    const updated = { ...item, quantity: item.quantity + q };

    // 如果是即食剩菜或曾經設過到期日/預設天數，順便詢問天數
    if (item.category === '剩菜/即食' || item.expiry_date || item.defaultShelfLife) {
      const defaultDays = item.defaultShelfLife ? String(item.defaultShelfLife) : '';
      const daysStr = prompt(`請問大約可以放幾天？\n(輸入數字，下次會記住這天數；若不設期限請留空)`, defaultDays);
      
      if (daysStr !== null && daysStr.trim() !== '') {
        const days = parseInt(daysStr.trim(), 10);
        if (!isNaN(days)) {
          const date = new Date();
          date.setDate(date.getDate() + days);
          updated.expiry_date = date.toISOString().split('T')[0];
          updated.defaultShelfLife = days;
        }
      } else if (daysStr !== null && daysStr.trim() === '') {
        // 使用者主動清空
        updated.expiry_date = '';
      }
    }

    try {
      await saveIngredient(updated);
      showToast(`已購入 ${item.name}`, 'success');
      onMutate();
    } catch {
      showToast('購入失敗', 'error');
    }
  }, [onMutate, showToast]);

  const handleEditChannels = useCallback(async (item: Ingredient) => {
    const current = item.channels ? item.channels.join(', ') : '';
    const val = prompt('修改通路(逗號分隔):', current);
    if (val === null) return;
    
    const newChannels = val ? val.split(',').map(c => c.trim()).filter(Boolean) : [];
    const updated = { ...item, channels: newChannels };
    
    try {
      await saveIngredient(updated);
      showToast('通路已更新', 'success');
      onMutate();
    } catch {
      showToast('更新失敗', 'error');
    }
  }, [onMutate, showToast]);

  const handleSave = useCallback(async (item: Ingredient) => {
    setSaving(true);
    try {
      await saveIngredient(item);
      showToast('儲存成功', 'success');
      setModalItem(null);
      onMutate();
    } catch {
      showToast('儲存失敗', 'error');
    } finally {
      setSaving(false);
    }
  }, [onMutate, showToast]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteIngredient(id);
      showToast('刪除成功', 'success');
      setModalItem(null);
      onMutate();
    } catch {
      showToast('刪除失敗', 'error');
    }
  }, [onMutate, showToast]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-6 pb-2">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold whitespace-nowrap animate-fade-in" style={{ color: 'var(--text)' }}>
            採購清單
          </h1>
          <button
            onClick={() => setModalItem('new')}
            className="w-[34px] h-[34px] flex items-center justify-center rounded-full shadow-md text-lg transition-transform active:scale-95"
            style={{ background: 'var(--primary)', color: 'white' }}
            title="新增採購"
          >
            ➕
          </button>
        </div>
      </div>

      {/* 列表區 */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* 通路過濾器 */}
        {availableStores.length > 0 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 pb-1 -mx-4 px-4 sticky top-0 z-10 pt-2" style={{ background: 'var(--bg)' }}>
            <button
              onClick={() => setActiveStore(null)}
              className="flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all shadow-sm"
              style={{
                background: activeStore === null ? 'var(--text)' : 'var(--surface)',
                color: activeStore === null ? 'var(--bg)' : 'var(--text-secondary)',
                border: activeStore === null ? '1px solid var(--text)' : '1px solid var(--border)',
              }}
            >
              全部
            </button>
            {availableStores.map((store) => (
              <button
                key={store}
                onClick={() => setActiveStore(store)}
                className="flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all shadow-sm"
                style={{
                  background: activeStore === store ? 'var(--primary)' : 'var(--surface)',
                  color: activeStore === store ? 'white' : 'var(--text-secondary)',
                  border: activeStore === store ? '1px solid var(--primary)' : '1px solid var(--border)',
                }}
              >
                {store}
              </button>
            ))}
          </div>
        )}

        {grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 opacity-50 mt-10">
            <span className="text-4xl">🛒</span>
            <p className="text-sm font-medium">目前庫存充足，無需採購</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6 pb-4">
            {grouped.map(({ store, items }) => (
              <div key={store} className="flex flex-col gap-2">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-4 w-1 rounded-full" style={{ background: 'var(--primary)' }} />
                  <h2 className="font-bold text-lg" style={{ color: 'var(--text)' }}>{store}</h2>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--primary-muted)', color: 'var(--primary)' }}>
                    {items.length}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {items.map(item => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-xl transition-colors hover:shadow-sm"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                    >
                      {/* Left: Purchase Checkbox */}
                      <button
                        onClick={() => handlePurchase(item)}
                        className="w-[22px] h-[22px] flex-shrink-0 flex items-center justify-center rounded-full mr-2.5 border-2 transition-colors active:scale-90"
                        style={{ borderColor: 'var(--border)', background: 'transparent' }}
                      >
                        <svg className="w-4 h-4 opacity-0 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                          <path d="M20 6L9 17L4 12" />
                        </svg>
                      </button>

                      {/* Middle: Info */}
                      <div className="flex flex-col flex-1 gap-1 overflow-hidden">
                        <span className="font-semibold text-[15px] leading-tight truncate" style={{ color: 'var(--text)' }}>
                          {item.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                            目前 {item.totalQty} {item.unit} / 安全 {item.maxMinStock}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEditChannels(item); }}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-secondary)] transition-colors active:bg-[var(--border)]"
                          >
                            修改通路
                          </button>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={() => setModalItem(item)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-[var(--bg-secondary)] text-[var(--text-muted)] transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`確定要將「${item.name}」完全刪除嗎？`)) handleDelete(item.id);
                          }}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-[var(--danger-muted)] text-[var(--danger)] transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalItem && (
        <IngredientModal
          item={modalItem === 'new' ? null : modalItem}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModalItem(null)}
          saving={saving}
        />
      )}
      
      <style>{`
        .check-btn:active svg { opacity: 1; }
      `}</style>
    </div>
  );
}

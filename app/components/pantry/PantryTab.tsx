'use client';

import { useState, useMemo, useCallback } from 'react';
import type { Ingredient, PantryData } from '@/lib/types';
import { saveIngredient, deleteIngredient } from '@/lib/api';
import { useToast } from '../layout/Toast';
import IngredientCard from './IngredientCard';
import IngredientModal from './IngredientModal';

const CATEGORY_ORDER = ['剩菜/即食', '蛋豆魚肉類', '蔬菜類', '辛香料', '調味料', '乾貨', '澱粉類', '水果類', '乳製品', '烘焙類', '點心類'];
const CATEGORY_EMOJI: Record<string, string> = {
  '剩菜/即食': '🥡',
  '蛋豆魚肉類': '🥩',
  '蔬菜類': '🥬',
  '辛香料': '🧄',
  '調味料': '🧂',
  '乾貨': '🍄',
  '澱粉類': '🍚',
  '水果類': '🍎',
  '乳製品': '🥛',
  '烘焙類': '🍞',
  '點心類': '🍪',
};

const OWNER_OPTIONS = ['人類', '特特'] as const;
type Owner = typeof OWNER_OPTIONS[number];

interface PantryTabProps {
  data: PantryData;
  onMutate: () => void;
}

export default function PantryTab({ data, onMutate }: PantryTabProps) {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [owner, setOwner] = useState<Owner>('人類');
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const [modalItem, setModalItem] = useState<Ingredient | null | 'new'>(null);
  const [saving, setSaving] = useState(false);
  const [activeCatFilter, setActiveCatFilter] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // 篩選食材：只顯示庫存 > 0、符合 owner 和搜尋
  const filtered = useMemo(() => {
    return data.ingredients.filter((i) => {
      if (i.quantity <= 0) return false;
      if (owner === '人類' && i.owner !== '人類' && i.owner !== '共享') return false;
      if (owner === '特特' && i.owner !== '特特' && i.owner !== '共享') return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          i.name.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q) ||
          (i.location || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [data.ingredients, owner, search]);

  // 檢查是否有剩菜/即食食材
  const hasLeftovers = useMemo(() => {
    return data.ingredients.some(i => {
      if (i.quantity <= 0) return false;
      if (owner === '人類' && i.owner !== '人類' && i.owner !== '共享') return false;
      if (owner === '特特' && i.owner !== '特特' && i.owner !== '共享') return false;
      
      const cat = i.category || '其他';
      return cat === '剩菜' || cat === '即食品' || cat === '剩菜/即食';
    });
  }, [data.ingredients, owner]);

  // 動態分類顯示順序：若無剩菜，則將其排至最右側
  const renderCategories = useMemo(() => {
    const base = ['蛋豆魚肉類', '蔬菜類', '辛香料', '調味料', '乾貨', '澱粉類', '水果類', '乳製品', '烘焙類', '點心類'];
    return hasLeftovers ? ['剩菜/即食', ...base] : [...base, '剩菜/即食'];
  }, [hasLeftovers]);

  // 依分類分組
  const { grouped, availableCategories } = useMemo(() => {
    const buckets: Record<string, Ingredient[]> = {};
    filtered.forEach((i) => {
      let cat = i.category || '其他';
      // 如果類別明確是剩菜/即食品，或者沒有大分類 (其他) 且類型是即食剩菜，才歸入剩菜/即食
      if (cat === '剩菜' || cat === '即食品' || cat === '剩菜/即食') {
        cat = '剩菜/即食';
      } else if (cat === '麵包') {
        cat = '烘焙類';
      } else if (cat === '飲料') {
        cat = '點心類';
      }

      if (!buckets[cat]) buckets[cat] = [];
      buckets[cat].push({ ...i, category: cat });
    });
    
    let entries = Object.entries(buckets).sort(([a], [b]) => {
      const ia = renderCategories.indexOf(a);
      const ib = renderCategories.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });

    const availableCategories = entries.map(([c]) => c);

    if (activeCatFilter) {
      entries = entries.filter(([c]) => c === activeCatFilter);
    }

    return { grouped: entries, availableCategories };
  }, [filtered, activeCatFilter, renderCategories]);

  const toggleCat = useCallback((cat: string) => {
    setExpandedCats((prev) => ({ ...prev, [cat]: prev[cat] === false ? true : false }));
  }, []);

  const handleSave = useCallback(async (item: Ingredient) => {
    setSaving(true);
    try {
      await saveIngredient(item);
      showToast(item.id ? `已更新 ${item.name}` : `已新增 ${item.name}`);
      onMutate();
      setModalItem(null);
    } catch (e) {
      showToast('儲存失敗', 'error');
    } finally {
      setSaving(false);
    }
  }, [onMutate, showToast]);

  const handleDelete = useCallback(async (id: string, name: string) => {
    setSaving(true);
    try {
      await deleteIngredient(id);
      showToast(`已刪除 ${name}`);
      onMutate();
      setModalItem(null);
    } catch (e) {
      showToast('刪除失敗', 'error');
    } finally {
      setSaving(false);
    }
  }, [onMutate, showToast]);

  // 快速調整數量（直接 save 並 mutate）
  const handleQtyChange = useCallback(async (item: Ingredient, delta: number) => {
    const newQty = Math.max(0, item.quantity + delta);
    const updated = { ...item, quantity: newQty };
    try {
      await saveIngredient(updated);
      onMutate();
    } catch {
      showToast('更新失敗', 'error');
    }
  }, [onMutate, showToast]);

  const handleQuickUpdate = useCallback(async (item: Ingredient) => {
    try {
      await saveIngredient(item);
      onMutate();
    } catch {
      showToast('更新失敗', 'error');
    }
  }, [onMutate, showToast]);

  const pinnedIngredients = useMemo(() => {
    const list = data.ingredients.filter(
      (i) => {
        const isPinned = (i.todayPlanned || i.priorityDeplete) &&
               i.quantity > 0 &&
               (owner === '人類' ? i.owner !== '特特' : i.owner !== '人類');

        if (!isPinned) return false;

        // 配合大類別過濾切換
        if (activeCatFilter) {
          let cat = i.category || '其他';
          if (cat === '剩菜' || cat === '即食品') {
            cat = '剩菜/即食';
          } else if (cat === '麵包') {
            cat = '烘焙類';
          } else if (cat === '飲料') {
            cat = '點心類';
          }
          return cat === activeCatFilter;
        }

        return true;
      }
    );

    // 進行對稱排序：搶鮮在前，清庫存在後
    return list.sort((a, b) => {
      const aIsFresh = a.todayPlanned;
      const bIsFresh = b.todayPlanned;
      if (aIsFresh && !bIsFresh) return -1;
      if (!aIsFresh && bIsFresh) return 1;

      // 如果同為搶鮮，依據類別順序
      if (aIsFresh && bIsFresh) {
        let catA = a.category || '其他';
        if (catA === '剩菜' || catA === '即食品') catA = '剩菜/即食';
        else if (catA === '麵包') catA = '烘焙類';
        else if (catA === '飲料') catA = '其他';

        let catB = b.category || '其他';
        if (catB === '剩菜' || catB === '即食品') catB = '剩菜/即食';
        else if (catB === '麵包') catB = '烘焙類';
        else if (catB === '飲料') catB = '其他';

        const indexA = renderCategories.indexOf(catA);
        const indexB = renderCategories.indexOf(catB);
        if (indexA !== indexB) {
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        }
      }

      return a.name.localeCompare(b.name);
    });
  }, [data.ingredients, owner, activeCatFilter, renderCategories]);

  const handleCopyToAI = useCallback(() => {
    const available = data.ingredients.filter(
      (i) => i.quantity > 0 && i.category !== '剩菜/即食' && (owner === '人類' ? i.owner !== '特特' : i.owner !== '人類')
    );
    
    if (available.length === 0) {
      showToast('目前沒有庫存食材可複製', 'error');
      return;
    }

    const buckets: Record<string, string[]> = {};
    available.forEach((i) => {
      let cat = i.category || '其他';
      if (cat === '剩菜' || cat === '即食品') {
        cat = '剩菜/即食';
      } else if (cat === '麵包') {
        cat = '烘焙類';
      } else if (cat === '飲料') {
        cat = '點心類';
      }
      if (!buckets[cat]) buckets[cat] = [];
      buckets[cat].push(`${i.name} (${i.quantity}${i.unit || ''})`);
    });

    let text = `請幫我用以下現有的食材規劃食譜（我不一定要全部用完）。
【重要提醒】在列出食譜的食材與用量時，請務必「完全使用我提供的庫存單位」。例如我寫"高麗菜(1顆)"，請用"顆"為單位；如果我寫"豬肉(300g)"，請用"g"為單位。：\n\n`;
    
    const appendCategory = (cat: string) => {
      if (buckets[cat] && buckets[cat].length > 0) {
        text += `【${cat}】\n${buckets[cat].join('、')}\n\n`;
      }
    };

    renderCategories.forEach(appendCategory);
    Object.keys(buckets).forEach(cat => {
      if (!renderCategories.includes(cat)) appendCategory(cat);
    });

    navigator.clipboard.writeText(text.trim())
      .then(() => showToast('已複製食材清單！可直接貼給 AI', 'success'))
      .catch(() => showToast('複製失敗，請檢查瀏覽器權限', 'error'));
  }, [data.ingredients, owner, showToast, renderCategories]);

  return (
    <div className="flex flex-col h-full">
      {/* Header (標題 + Emoji 功能按鈕) */}
      <div className="px-4 pt-6 pb-2">
        <div className="flex items-center justify-between gap-2">
          {isSearchOpen ? (
            <div
              className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-xl animate-fade-in"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
            >
              <span className="text-sm">🔍</span>
              <input
                autoFocus
                type="text"
                placeholder="搜尋名稱、位置..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: 'var(--text)' }}
              />
              <button
                onClick={() => {
                  setSearch('');
                  setIsSearchOpen(false);
                }}
                className="w-6 h-6 flex items-center justify-center rounded-full bg-[var(--surface)] shadow-sm text-xs"
              >
                ✕
              </button>
            </div>
          ) : (
            <h1 className="text-2xl font-bold whitespace-nowrap animate-fade-in" style={{ color: 'var(--text)' }}>
              庫存食材
            </h1>
          )}

          {!isSearchOpen && (
            <div className="flex items-center gap-2 animate-fade-in">
              <button
                onClick={handleCopyToAI}
                className="w-[34px] h-[34px] flex items-center justify-center rounded-full shadow-sm text-lg transition-transform active:scale-95"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                title="一鍵複製給 AI 配餐"
              >
                🤖
              </button>
              <button
                onClick={() => setIsSearchOpen(true)}
                className="w-[34px] h-[34px] flex items-center justify-center rounded-full shadow-sm text-lg transition-transform active:scale-95"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                title="搜尋"
              >
                🔍
              </button>
              <button
                onClick={() => setOwner(owner === '人類' ? '特特' : '人類')}
                className="w-[34px] h-[34px] flex items-center justify-center rounded-full shadow-sm text-lg transition-transform active:scale-95"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                title={`目前: ${owner} (點擊切換)`}
              >
                {owner === '人類' ? '🧑' : '🐶'}
              </button>
              <button
                onClick={() => setModalItem('new')}
                className="w-[34px] h-[34px] flex items-center justify-center rounded-full shadow-md text-lg transition-transform active:scale-95"
                style={{ background: 'var(--primary)', color: 'white' }}
                title="新增食材"
              >
                ➕
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* 分類快捷列 (純 Emoji + 底線) */}
        <div className="flex gap-4 overflow-x-auto no-scrollbar mb-2 pb-1 -mx-4 px-6 sticky top-0 z-10 pt-2" style={{ background: 'var(--bg)' }}>
          <button
            onClick={() => setActiveCatFilter(null)}
            className="flex-shrink-0 px-1 py-1.5 text-2xl transition-all relative"
            style={{
              opacity: activeCatFilter === null ? 1 : 0.4,
              filter: activeCatFilter === null ? 'none' : 'grayscale(100%)',
            }}
            title="全部"
          >
            🍽️
            {activeCatFilter === null && (
              <div className="absolute bottom-0 left-0 right-0 h-1 rounded-t-md" style={{ background: 'var(--primary)' }} />
            )}
          </button>
          {renderCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCatFilter(cat)}
              className="flex-shrink-0 px-1 py-1.5 text-2xl transition-all relative"
              style={{
                opacity: activeCatFilter === cat ? 1 : 0.4,
                filter: activeCatFilter === cat ? 'none' : 'grayscale(100%)',
              }}
              title={cat}
            >
              {CATEGORY_EMOJI[cat] || '📦'}
              {activeCatFilter === cat && (
                <div className="absolute bottom-0 left-0 right-0 h-1 rounded-t-md" style={{ background: 'var(--primary)' }} />
              )}
            </button>
          ))}
        </div>

        {grouped.length === 0 && pinnedIngredients.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-3">
            {/* 置頂關注食材區塊 */}
            {pinnedIngredients.length > 0 && (
              <div 
                className="p-3 rounded-2xl flex flex-col gap-2 border" 
                style={{ 
                  background: 'rgba(16,185,129,0.03)', 
                  borderColor: 'rgba(16,185,129,0.15)' 
                }}
              >
                <div className="flex items-center gap-1.5 px-1">
                  <span className="text-sm font-bold text-[var(--primary)] flex items-center gap-1">
                    <span>🥬</span>搶鮮吃 / <span>🧹</span>清庫存
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] font-semibold">
                    (生鮮搶鮮與庫存活化)
                  </span>
                </div>
                <div className="flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-thin snap-x snap-mandatory">
                  {pinnedIngredients.map(item => (
                    <div key={`pinned-${item.id}`} className="w-[280px] md:w-[320px] shrink-0 snap-start">
                      <IngredientCard
                        item={item}
                        onEdit={() => setModalItem(item)}
                        onQtyChange={(delta) => handleQtyChange(item, delta)}
                        onUpdate={handleQuickUpdate}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeCatFilter !== null ? (
              // 點進單一分類：不顯示分類標題與折疊按鈕，直接顯示卡片網格
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-4 mt-2">
                {grouped.flatMap(([_, items]) => items).map((item) => (
                  <IngredientCard
                    key={item.id}
                    item={item}
                    onEdit={() => setModalItem(item)}
                    onQtyChange={(delta) => handleQtyChange(item, delta)}
                    onUpdate={handleQuickUpdate}
                  />
                ))}
              </div>
            ) : (
              // 未選擇分類：顯示折疊卡片清單
              grouped.map(([cat, items]) => {
                const isExpanded = expandedCats[cat] !== false;
                return (
                  <div key={cat} className="card overflow-hidden">
                    {/* 分類 header */}
                    <button
                      onClick={() => toggleCat(cat)}
                      className="w-full flex items-center justify-between px-4 py-3 transition-colors"
                      style={{ color: 'var(--text)' }}
                    >
                      <span className="font-semibold text-sm">
                        {cat}
                        <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full" style={{ background: 'var(--primary-muted)', color: 'var(--primary)' }}>
                          {items.length}
                        </span>
                      </span>
                      <svg
                        className="w-4 h-4 transition-transform duration-200"
                        style={{
                          color: 'var(--text-muted)',
                          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        }}
                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                      >
                        <path d="M6 9l6 6 6-6"/>
                      </svg>
                    </button>

                    {/* 分類清單內容 */}
                    {isExpanded && (
                      <div className="p-3 md:p-4 bg-[var(--bg)] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-4">
                        {items.map((item) => (
                          <IngredientCard
                            key={item.id}
                            item={item}
                            onEdit={() => setModalItem(item)}
                            onQtyChange={(delta) => handleQtyChange(item, delta)}
                            onUpdate={handleQuickUpdate}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* 新增/編輯彈窗 */}
      {modalItem !== null && (
        <IngredientModal
          item={modalItem === 'new' ? null : modalItem}
          defaultOwner={owner}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModalItem(null)}
          saving={saving}
        />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4" style={{ color: 'var(--text-muted)' }}>
      <svg className="w-14 h-14 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2}>
        <path d="M3 9h18M3 15h18M5 3v18M19 3v18M9 3v18M15 3v18"/>
      </svg>
      <div className="text-center">
        <p className="font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>目前沒有食材</p>
        <p className="text-sm">點擊右上「+ 新增」加入第一筆食材</p>
      </div>
    </div>
  );
}

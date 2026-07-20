'use client';

import { useState, useEffect } from 'react';
import type { Recipe, Ingredient } from '@/lib/types';
import { normalizeName } from '@/lib/recipe-utils';

interface CookConfirmationModalProps {
  recipe: Recipe;
  pantry: Ingredient[];
  onClose: () => void;
  onConfirm: (updates: { ingredient: Ingredient; deductAmount: number }[]) => Promise<void> | void;
}

interface DeductItemState {
  recipeIngredientName: string;
  recipeQuantity: number;
  recipeUnit: string;
  section: 'main' | 'seasoning';
  optional: boolean;
  pantryMatches: Ingredient[];
  selectedPantryId: string;
  deductQuantity: number;
}

export default function CookConfirmationModal({
  recipe,
  pantry,
  onClose,
  onConfirm,
}: CookConfirmationModalProps) {
  const [items, setItems] = useState<DeductItemState[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const mainList = recipe.ingredients_main || [];
    const seasoningList = recipe.seasonings || [];

    const initializeItems = (list: any[], section: 'main' | 'seasoning'): DeductItemState[] => {
      return list.map(req => {
        const alternatives = req.name.split(/[/|、]/).map((n: string) => normalizeName(n)).filter(Boolean);
        
        // 尋找庫存中所有名稱符合的食材 (且庫存大於 0)
        const matches = pantry.filter(i => 
          alternatives.includes(normalizeName(i.name)) && i.quantity > 0
        );

        // 預設選擇：優先選數量足夠且單位一致的，否則選第一個
        let defaultSelectedId = '';
        let defaultDeductQty = 0;

        if (matches.length > 0) {
          const reqUnit = (req.unit || '').trim().toLowerCase();
          const reqQty = Number(req.quantity) || 0;

          // 試圖找單位一致且足夠的
          const bestMatch = matches.find(m => {
            const mUnit = (m.unit || '').trim().toLowerCase();
            return mUnit === reqUnit && m.quantity >= reqQty;
          }) || matches[0];

          defaultSelectedId = bestMatch.id;

          const mUnit = (bestMatch.unit || '').trim().toLowerCase();
          if (mUnit === reqUnit) {
            defaultDeductQty = reqQty;
          } else {
            // 單位不同（如小匙 vs 瓶），預設不扣除
            defaultDeductQty = 0;
          }
        }

        return {
          recipeIngredientName: req.name,
          recipeQuantity: Number(req.quantity) || 0,
          recipeUnit: req.unit || '',
          section,
          optional: !!req.optional,
          pantryMatches: matches,
          selectedPantryId: defaultSelectedId,
          deductQuantity: defaultDeductQty,
        };
      });
    };

    setItems([
      ...initializeItems(mainList, 'main'),
      ...initializeItems(seasoningList, 'seasoning'),
    ]);
  }, [recipe, pantry]);

  const handlePantryChange = (index: number, pantryId: string) => {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item;

      const newMatch = item.pantryMatches.find(m => m.id === pantryId);
      if (!newMatch) {
        return { ...item, selectedPantryId: '', deductQuantity: 0 };
      }

      // 當切換庫存食材時，重新檢查單位是否一致
      const mUnit = (newMatch.unit || '').trim().toLowerCase();
      const rUnit = item.recipeUnit.trim().toLowerCase();
      const defaultDeduct = mUnit === rUnit ? item.recipeQuantity : 0;

      return {
        ...item,
        selectedPantryId: pantryId,
        deductQuantity: defaultDeduct,
      };
    }));
  };

  const handleQuantityChange = (index: number, val: number) => {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item;
      return { ...item, deductQuantity: Math.max(0, val) };
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const updates: { ingredient: Ingredient; deductAmount: number }[] = [];
    
    for (const item of items) {
      if (!item.selectedPantryId || item.deductQuantity <= 0) continue;
      
      const pantryItem = pantry.find(p => p.id === item.selectedPantryId);
      if (pantryItem) {
        updates.push({
          ingredient: pantryItem,
          deductAmount: item.deductQuantity,
        });
      }
    }

    try {
      await onConfirm(updates);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end bg-black/60 sm:items-center sm:justify-center p-0 sm:p-4 animate-fade-in" onClick={onClose}>
      <div 
        className="w-full sm:max-w-lg bg-[var(--bg)] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col h-[85vh] sm:h-[75vh] overflow-hidden" 
        onClick={e => e.stopPropagation()}
        style={{ animation: 'slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* 標頭 */}
        <div className="flex justify-between items-center p-4 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex flex-col">
            <h2 className="text-lg font-bold text-[var(--text)]">🍳 開煮扣料確認</h2>
            <span className="text-xs text-[var(--text-muted)] leading-tight">{recipe.name}</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--bg-secondary)] hover:bg-[var(--surface)] transition-colors">✕</button>
        </div>

        {/* 內容滾動區 */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          <div className="text-xs text-orange-500 bg-orange-500/10 p-3 rounded-lg border border-orange-500/20 font-medium">
            💡 您可以在下方自由微調要扣除的庫存數量。若單位不符，預設不扣除（以 0 顯示），但仍可點擊輸入框微調成如 0.2 瓶等小數點進行精準扣除。
          </div>

          {items.map((item, idx) => {
            const hasMatch = item.pantryMatches.length > 0;
            const selectedMatch = item.pantryMatches.find(m => m.id === item.selectedPantryId);
            const isUnitMismatch = selectedMatch && item.recipeUnit && selectedMatch.unit &&
              (selectedMatch.unit.trim().toLowerCase() !== item.recipeUnit.trim().toLowerCase());

            return (
              <div 
                key={idx} 
                className="flex flex-col gap-2 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]"
              >
                {/* 食材名稱與食譜需求 */}
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-[var(--text)]">{item.recipeIngredientName}</span>
                    <span className="text-xs text-[var(--text-muted)]">
                      食譜需求：{item.recipeQuantity > 0 ? `${item.recipeQuantity} ${item.recipeUnit}` : '適量'} 
                      {item.optional && <span className="text-amber-600 ml-1 font-semibold">(可選)</span>}
                      {item.section === 'seasoning' && <span className="text-blue-600 ml-1 font-semibold">(調味料)</span>}
                    </span>
                  </div>
                </div>

                {/* 庫存選擇與扣量調整 */}
                {hasMatch ? (
                  <div className="flex flex-col gap-2 mt-1">
                    {/* 下拉選單選擇庫存 */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--text-secondary)] font-medium shrink-0">扣除對象</span>
                      <select
                        value={item.selectedPantryId}
                        onChange={e => handlePantryChange(idx, e.target.value)}
                        className="flex-1 text-xs bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1.5 outline-none font-medium text-[var(--text)]"
                      >
                        <option value="">⚠️ 不扣除此項目</option>
                        {item.pantryMatches.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.name} (剩餘 {m.quantity} {m.unit || ''}){m.owner ? ` [${m.owner}]` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 扣除數量調整 */}
                    {item.selectedPantryId && (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[var(--text-secondary)] font-medium shrink-0">扣除數量</span>
                          <input
                            type="number"
                            step="any"
                            value={item.deductQuantity === 0 ? '' : item.deductQuantity}
                            onChange={e => handleQuantityChange(idx, parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className="w-24 text-xs text-center bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1.5 outline-none font-bold"
                          />
                          <span className="text-xs text-[var(--text-muted)] font-semibold shrink-0">
                            {selectedMatch?.unit || ''}
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)] ml-auto">
                            扣後剩餘：{selectedMatch ? Math.max(0, Number((selectedMatch.quantity - item.deductQuantity).toFixed(2))) : 0} {selectedMatch?.unit || ''}
                          </span>
                        </div>

                        {/* 單位不符警告 */}
                        {isUnitMismatch && (
                          <span className="text-[10px] text-orange-500 font-medium">
                            ⚠️ 單位不符（食譜: {item.recipeUnit} vs 庫存: {selectedMatch?.unit}），預設不扣除。您可手動換算輸入。
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-[var(--text-muted)] italic py-1 px-1">
                    庫存中無此食材（預設跳過扣除）
                  </div>
                )}
              </div>
            );
          })}
        </form>

        {/* 底部按鈕 */}
        <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t flex gap-2 shrink-0 bg-[var(--surface)]" style={{ borderColor: 'var(--border)' }}>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl font-bold transition-colors bg-[var(--bg-secondary)] hover:bg-[var(--border)] text-[var(--text)] text-sm"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 py-3 rounded-xl font-bold text-white transition-opacity active:opacity-80 text-sm"
            style={{ background: 'var(--primary)' }}
          >
            {isSubmitting ? '扣除中...' : '確認扣除並開煮 🍳'}
          </button>
        </div>
      </div>
    </div>
  );
}

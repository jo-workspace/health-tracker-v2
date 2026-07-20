'use client';

import { useState, useMemo, useCallback } from 'react';
import type { PantryData, Recipe, Ingredient } from '@/lib/types';
import { saveRecipe, saveIngredient } from '@/lib/api';
import { useToast } from '../layout/Toast';
import RecipeCard from './RecipeCard';
import RecipeDetailModal from './RecipeDetailModal';
import RecipeEditModal from './RecipeEditModal';
import RecipeImportModal from './RecipeImportModal';
import CookConfirmationModal from '../meal/CookConfirmationModal';

interface RecipesTabProps {
  data: PantryData;
  onMutate: () => void;
}

type FilterTab = 'cook-now' | 'all-recipes' | 'one-off' | 'archived';

export default function RecipesTab({ data, onMutate }: RecipesTabProps) {
  const { showToast } = useToast();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('cook-now');
  const [search, setSearch] = useState('');
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  
  // Modal 狀態
  const [viewingRecipe, setViewingRecipe] = useState<Recipe | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [cookingRecipe, setCookingRecipe] = useState<Recipe | null>(null);

  const toggleExpand = useCallback((id: string) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleToggleMeal = useCallback(async (recipe: Recipe) => {
    // 簡單的實作：如果已排入配餐，則取消；若無，則排入午餐（後續可加上選擇早中晚餐的 popup）
    const newMeal = recipe.todayMeal ? '' : 'lunch';
    try {
      await saveRecipe({ ...recipe, todayMeal: newMeal });
      showToast(newMeal ? `已將「${recipe.name}」排入配餐` : `已取消排入`, 'success');
      onMutate();
    } catch {
      showToast('更新失敗', 'error');
    }
  }, [onMutate, showToast]);

  const handleArchive = useCallback(async (recipe: Recipe) => {
    try {
      await saveRecipe({ ...recipe, archivedAt: new Date().toISOString() });
      showToast(`已封存「${recipe.name}」`, 'success');
      onMutate();
    } catch {
      showToast('封存失敗', 'error');
    }
  }, [onMutate, showToast]);

  const handleUnarchive = useCallback(async (recipe: Recipe) => {
    try {
      await saveRecipe({ ...recipe, archivedAt: null });
      showToast(`已取消封存「${recipe.name}」`, 'success');
      onMutate();
    } catch {
      showToast('更新失敗', 'error');
    }
  }, [onMutate, showToast]);

  const handleConfirmCook = useCallback(async (updates: { ingredient: Ingredient; deductAmount: number }[]) => {
    if (!cookingRecipe) return;

    // 將扣除資料以 id 分組，以防有重複選取同個庫存食材的情況
    const groupedUpdates = new Map<string, { ingredient: Ingredient; totalDeduct: number }>();
    for (const u of updates) {
      const existing = groupedUpdates.get(u.ingredient.id);
      if (existing) {
        existing.totalDeduct += u.deductAmount;
      } else {
        groupedUpdates.set(u.ingredient.id, { ingredient: u.ingredient, totalDeduct: u.deductAmount });
      }
    }

    try {
      // 1. 執行扣除庫存
      await Promise.all(
        Array.from(groupedUpdates.values()).map(({ ingredient, totalDeduct }) => {
          const newQty = Math.max(0, Number((ingredient.quantity - totalDeduct).toFixed(2)));
          return saveIngredient({ 
            ...ingredient, 
            quantity: newQty,
            todayPlanned: false, // 今天煮了，取消📌
            priorityDeplete: newQty > 0 ? ingredient.priorityDeplete : false // 扣到0才取消🔥
          });
        })
      );
      
      // 2. 將食譜移出配餐 (開煮後一律不需留在配餐中)
      await saveRecipe({ ...cookingRecipe, todayMeal: '' });
      
      showToast(`已扣除庫存並完成「${cookingRecipe.name}」！`, 'success');
      onMutate();
      setCookingRecipe(null);
    } catch (e) {
      showToast('扣除庫存時發生錯誤', 'error');
    }
  }, [cookingRecipe, onMutate, showToast]);

  const filteredRecipes = useMemo(() => {
    let list = data.recipes;
    
    // 依據 Tab 過濾
    if (activeFilter === 'archived') {
      list = list.filter(r => r.archivedAt);
    } else if (activeFilter === 'one-off') {
      list = list.filter(r => !r.archivedAt && r.isOneOff);
    } else {
      const normalActive = list.filter(r => !r.archivedAt && !r.isOneOff);
      if (search) {
        list = normalActive; // 搜尋時不分 cook-now 或 all
      } else {
        if (activeFilter === 'cook-now') {
          // 在 RecipeCard 內分析，這裡我們只能簡單拿全部，或是在這裡也分析
          // 為了效能，其實應該要在外層分析好。這邊我們簡化為交由外層統一判斷
          // 由於此處需要判斷 isCookable，我們引入 analyzeRecipe
          const { analyzeRecipe } = require('@/lib/recipe-utils');
          list = normalActive.filter(r => {
            const analysis = analyzeRecipe(r, data.ingredients);
            return analysis.isCookable;
          });
        } else {
          list = normalActive;
        }
      }
    }

    // 文字搜尋
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r => 
        r.name.toLowerCase().includes(q) || 
        (r.instructions || '').toLowerCase().includes(q) ||
        (r.ingredients_main || []).some(i => i.name.toLowerCase().includes(q))
      );
    }

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [data.recipes, data.ingredients, activeFilter, search]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-6 pb-2">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>食譜庫</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setIsImporting(true)}
              className="px-3 h-[34px] flex items-center justify-center rounded-full shadow-md text-sm font-bold transition-transform active:scale-95"
              style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}
              title="AI匯入"
            >
              ✨ AI 匯入
            </button>
            <button
              onClick={() => setIsAdding(true)}
              className="w-[34px] h-[34px] flex items-center justify-center rounded-full shadow-md text-lg transition-transform active:scale-95"
              style={{ background: 'var(--primary)', color: 'white' }}
              title="新增食譜"
            >
              ➕
            </button>
          </div>
        </div>
        
        {/* 搜尋框 */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl mb-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <span className="text-sm">🔍</span>
          <input
            type="text"
            placeholder="搜尋食譜或食材..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--text)' }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="w-6 h-6 flex items-center justify-center rounded-full bg-[var(--surface)] shadow-sm text-xs">✕</button>
          )}
        </div>

        {/* 過濾標籤 */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: 'cook-now', label: '可以開煮' },
            { id: 'all-recipes', label: '全部食譜' },
            { id: 'one-off', label: '特別' },
            { id: 'archived', label: '已封存' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id as FilterTab)}
              className="flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all shadow-sm"
              style={{
                background: activeFilter === tab.id ? 'var(--text)' : 'var(--surface)',
                color: activeFilter === tab.id ? 'var(--bg)' : 'var(--text-secondary)',
                border: activeFilter === tab.id ? '1px solid var(--text)' : '1px solid var(--border)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {filteredRecipes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 opacity-50 mt-10">
            <span className="text-4xl">📖</span>
            <p className="text-sm font-medium">沒有符合的食譜</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredRecipes.map(recipe => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                pantry={data.ingredients}
                isExpanded={activeFilter !== 'cook-now' || !!expandedCards[recipe.id]}
                onToggleExpand={() => toggleExpand(recipe.id)}
                onViewDetail={() => setViewingRecipe(recipe)}
                onEdit={() => setEditingRecipe(recipe)}
                onToggleMeal={() => handleToggleMeal(recipe)}
                onArchive={activeFilter !== 'archived' ? () => handleArchive(recipe) : undefined}
                onUnarchive={activeFilter === 'archived' ? () => handleUnarchive(recipe) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* 詳情彈窗 */}
      {viewingRecipe && (
        <RecipeDetailModal
          recipe={viewingRecipe}
          pantry={data.ingredients}
          onClose={() => setViewingRecipe(null)}
          onCook={() => {
            setViewingRecipe(null);
            setCookingRecipe(viewingRecipe);
          }}
          onEdit={() => {
            setViewingRecipe(null);
            setEditingRecipe(viewingRecipe);
          }}
        />
      )}

      {/* 編輯/新增彈窗 */}
      {(editingRecipe || isAdding) && (
        <RecipeEditModal
          recipe={editingRecipe || undefined}
          pantryIngredients={data.ingredients}
          onClose={() => {
            setEditingRecipe(null);
            setIsAdding(false);
          }}
          onMutate={onMutate}
        />
      )}

      {/* AI匯入彈窗 */}
      {isImporting && (
        <RecipeImportModal
          onClose={() => setIsImporting(false)}
          onImportSuccess={(parsed) => {
            setIsImporting(false);
            setEditingRecipe(parsed as Recipe);
          }}
        />
      )}

      {cookingRecipe && (
        <CookConfirmationModal
          recipe={cookingRecipe}
          pantry={data.ingredients}
          onClose={() => setCookingRecipe(null)}
          onConfirm={handleConfirmCook}
        />
      )}
    </div>
  );
}

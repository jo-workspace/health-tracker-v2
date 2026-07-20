'use client';

import { useMemo, useCallback, useState } from 'react';
import type { PantryData, Recipe, Ingredient } from '@/lib/types';
import { saveRecipe, saveIngredient } from '@/lib/api';
import { useToast } from '../layout/Toast';
import { analyzeRecipe } from '@/lib/recipe-utils';
import CookConfirmationModal from './CookConfirmationModal';

const CATEGORY_ORDER = ['剩菜/即食', '蛋豆魚肉類', '蔬菜類', '辛香料', '調味料', '乾貨', '澱粉類', '水果類', '乳製品', '烘焙類', '點心類'];

interface MealTabProps {
  data: PantryData;
  onMutate: () => void;
}

export default function MealTab({ data, onMutate }: MealTabProps) {
  const { showToast } = useToast();

  const meals = useMemo(() => {
    const planned = data.recipes.filter(r => r.todayMeal && !r.archivedAt);
    
    const groups: Record<string, Recipe[]> = {
      '早餐': [],
      '午餐': [],
      '晚餐': [],
      '點心': [],
      '其他': []
    };

    planned.forEach(r => {
      const m = r.todayMeal;
      if (groups[m]) groups[m].push(r);
      else {
        // Fallback or mapping
        if (m === 'breakfast') groups['早餐'].push(r);
        else if (m === 'lunch') groups['午餐'].push(r);
        else if (m === 'dinner') groups['晚餐'].push(r);
        else if (m === 'snack') groups['點心'].push(r);
        else groups['其他'].push(r);
      }
    });

    return Object.entries(groups).filter(([, recipes]) => recipes.length > 0);
  }, [data.recipes]);

  const [removingIds, setRemovingIds] = useState<Record<string, boolean>>({});
  const [cookingRecipe, setCookingRecipe] = useState<Recipe | null>(null);

  const freshIngredients = useMemo(() => {
    return data.ingredients.filter(
      i => i.todayPlanned && i.quantity > 0
    ).sort((a, b) => {
      let catA = a.category || '其他';
      if (catA === '剩菜' || catA === '即食品') catA = '剩菜/即食';
      else if (catA === '麵包') catA = '烘焙類';
      else if (catA === '飲料') catA = '點心類';

      let catB = b.category || '其他';
      if (catB === '剩菜' || catB === '即食品') catB = '剩菜/即食';
      else if (catB === '麵包') catB = '烘焙類';
      else if (catB === '飲料') catB = '點心類';

      const indexA = CATEGORY_ORDER.indexOf(catA);
      const indexB = CATEGORY_ORDER.indexOf(catB);
      if (indexA !== indexB) {
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      }
      return a.name.localeCompare(b.name);
    });
  }, [data.ingredients]);

  const dormantIngredients = useMemo(() => {
    return data.ingredients.filter(i => 
      i.quantity > 0 && i.priorityDeplete
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [data.ingredients]);

  const handleQtyChange = useCallback(async (item: Ingredient, delta: number) => {
    const newQty = Math.max(0, Number((item.quantity + delta).toFixed(2)));
    const updated = { 
      ...item, 
      quantity: newQty,
      // 庫存被扣至 0 時自動取消加強消耗與今日要煮
      todayPlanned: newQty > 0 ? item.todayPlanned : false,
      priorityDeplete: newQty > 0 ? item.priorityDeplete : false
    };
    try {
      await saveIngredient(updated);
      onMutate();
    } catch {
      showToast('更新失敗', 'error');
    }
  }, [onMutate, showToast]);

  const handleRemove = useCallback(async (recipe: Recipe) => {
    setRemovingIds(prev => ({ ...prev, [recipe.id]: true }));
    try {
      await saveRecipe({ ...recipe, todayMeal: '' });
      showToast(`已將「${recipe.name}」移出配餐`, 'success');
      onMutate();
    } catch {
      showToast('移除失敗', 'error');
      setRemovingIds(prev => ({ ...prev, [recipe.id]: false }));
    }
  }, [onMutate, showToast]);

  const handleCook = useCallback((recipe: Recipe) => {
    setCookingRecipe(recipe);
  }, []);

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
      
      // 2. 將食譜移出配餐
      await saveRecipe({ ...cookingRecipe, todayMeal: '' });
      
      showToast(`已扣除庫存並完成「${cookingRecipe.name}」！`, 'success');
      onMutate();
      setCookingRecipe(null);
    } catch (e) {
      showToast('扣除庫存時發生錯誤', 'error');
    }
  }, [cookingRecipe, onMutate, showToast]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>今日配餐</h1>
      </div>

      {freshIngredients.length > 0 && (
        <div className="px-4 mb-4 shrink-0">
          <div 
            className="p-3 rounded-2xl flex flex-col gap-2 border animate-fade-in" 
            style={{ 
              background: 'rgba(16,185,129,0.03)', 
              borderColor: 'rgba(16,185,129,0.15)',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold text-[var(--primary)] flex items-center gap-1">
                <span>💡</span>今日食材備忘
              </span>
            </div>
            <div className="flex flex-wrap gap-2 mt-0.5">
              {freshIngredients.map(item => (
                <div 
                  key={item.id} 
                  className="flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-xl border text-[11px] font-medium bg-[var(--surface)] border-[var(--border)]"
                >
                  <span 
                    className="text-[9px] font-bold px-1 py-[0.5px] rounded flex items-center gap-0.5 bg-[var(--primary-muted)] text-[var(--primary)]"
                  >
                    🥬 搶鮮
                  </span>
                  <span className="font-bold text-[var(--text)]">{item.name}</span>
                  <div className="flex items-center gap-1 bg-[var(--bg-secondary)] rounded-md px-1 py-0.5 border border-[var(--border)] ml-0.5 shrink-0">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQtyChange(item, -(item.step_size || 1));
                      }}
                      className="w-3.5 h-3.5 flex items-center justify-center font-extrabold text-[var(--text-muted)] hover:text-[var(--text)] active:scale-130 transition-transform text-[10px]"
                      title="減少庫存"
                    >
                      -
                    </button>
                    <span className="font-semibold text-[var(--text)] text-[10px] min-w-[20px] text-center">
                      {item.quantity}{item.unit || ''}
                    </span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQtyChange(item, (item.step_size || 1));
                      }}
                      className="w-3.5 h-3.5 flex items-center justify-center font-extrabold text-[var(--text-muted)] hover:text-[var(--text)] active:scale-130 transition-transform text-[10px]"
                      title="增加庫存"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {meals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 opacity-50 mt-10">
            <span className="text-4xl">🍽️</span>
            <p className="text-sm font-medium">今天還沒排入配餐</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {meals.map(([mealName, recipes]) => {
              const visibleRecipes = recipes.filter(r => !removingIds[r.id]);
              if (visibleRecipes.length === 0) return null;
              
              return (
                <div key={mealName} className="flex flex-col gap-2">
                  <h2 className="font-bold text-lg mb-1" style={{ color: 'var(--text)' }}>{mealName}</h2>
                  <div className="flex flex-col gap-3">
                    {visibleRecipes.map(recipe => {
                      const analysis = analyzeRecipe(recipe, data.ingredients);
                      
                      return (
                        <div
                          key={recipe.id}
                          className="flex flex-col p-3 rounded-xl transition-all duration-200"
                          style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            boxShadow: 'var(--shadow-sm)'
                          }}
                        >
                          <div className="flex justify-between items-start gap-2 mb-2">
                            <h3 className="font-bold text-base leading-tight" style={{ color: 'var(--text)' }}>
                              {recipe.name}
                            </h3>
                            <div className="flex gap-1">
                              <button onClick={() => handleCook(recipe)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--primary-muted)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white transition-colors" title="開煮並扣庫存">🍳</button>
                              <button onClick={() => handleRemove(recipe)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--danger-muted)] text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white transition-colors" title="移出">✕</button>
                            </div>
                          </div>

                          {/* 食材狀況分析 */}
                          {analysis.ingredientsStatus.length > 0 && (
                            <div className="flex flex-col gap-1.5">
                              {/* 主食材 */}
                              {analysis.ingredientsStatus.filter(i => i.section === 'main').length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {analysis.ingredientsStatus
                                    .filter(i => i.section === 'main')
                                    .map((status, idx) => {
                                      const isEnough = status.isEnough;
                                      return (
                                        <span
                                          key={idx}
                                          className="text-[11px] font-medium px-1.5 py-[2px] rounded border"
                                          style={{
                                            background: isEnough ? 'var(--bg-secondary)' : (status.optional ? '#FEF3C7' : 'var(--danger-muted)'),
                                            color: isEnough ? 'var(--text)' : (status.optional ? '#B45309' : 'var(--danger)'),
                                            borderColor: isEnough ? 'transparent' : (status.optional ? '#FDE68A' : 'rgba(239,68,68,0.2)')
                                          }}
                                        >
                                          {status.name} {status.qtyNeeded > 0 ? `${status.qtyNeeded}${status.unit}` : ''} {status.optional && '(可選)'}
                                        </span>
                                      );
                                    })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 🧹 庫存活化建議 (清老庫存，擺在頁面最下方) */}
        {dormantIngredients.length > 0 && (
          <div className="mt-8 pt-4 border-t border-[var(--border)] animate-fade-in">
            <div 
              className="p-3 rounded-2xl flex flex-col gap-2 border bg-purple-50/10 dark:bg-purple-950/5" 
              style={{ 
                borderColor: 'rgba(139,92,246,0.15)',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-[#8B5CF6] flex items-center gap-1">
                  <span>🧹</span>庫存活化建議 (清老庫存)
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mt-0.5">
                {dormantIngredients.map(item => (
                  <div 
                    key={item.id} 
                    className="flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-xl border text-[11px] font-medium bg-[var(--surface)] border-[var(--border)]"
                  >
                    <span 
                      className="text-[9px] font-bold px-1 py-[0.5px] rounded flex items-center gap-0.5 bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400"
                    >
                      🧹 庫存
                    </span>
                    <span className="font-bold text-[var(--text)]">{item.name}</span>
                    <div className="flex items-center gap-1 bg-[var(--bg-secondary)] rounded-md px-1 py-0.5 border border-[var(--border)] ml-0.5 shrink-0">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQtyChange(item, -(item.step_size || 1));
                        }}
                        className="w-3.5 h-3.5 flex items-center justify-center font-extrabold text-[var(--text-muted)] hover:text-[var(--text)] active:scale-130 transition-transform text-[10px]"
                        title="減少庫存"
                      >
                        -
                      </button>
                      <span className="font-semibold text-[var(--text)] text-[10px] min-w-[20px] text-center">
                        {item.quantity}{item.unit || ''}
                      </span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQtyChange(item, (item.step_size || 1));
                        }}
                        className="w-3.5 h-3.5 flex items-center justify-center font-extrabold text-[var(--text-muted)] hover:text-[var(--text)] active:scale-130 transition-transform text-[10px]"
                        title="增加庫存"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

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

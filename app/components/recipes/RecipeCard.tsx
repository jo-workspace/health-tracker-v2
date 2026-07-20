import { memo, useState, useEffect, useMemo } from 'react';
import type { Recipe } from '@/lib/types';
import { analyzeRecipe, type IngredientStatus } from '@/lib/recipe-utils';

interface RecipeCardProps {
  recipe: Recipe;
  pantry: any[];
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onViewDetail: () => void;
  onEdit: () => void;
  onToggleMeal: () => Promise<void> | void;
  onArchive?: () => void;
  onUnarchive?: () => void;
}

const Tag = ({ status, pantry }: { status: IngredientStatus; pantry: any[] }) => {
  const isEnough = status.isEnough;
  
  // 匹配替代食材對應的庫存項目
  const alternatives = status.name.split(/[/|、]/).map(n => n.trim().toLowerCase()).filter(Boolean);
  const matchedPantryItems = pantry.filter(i => alternatives.includes(i.name.trim().toLowerCase()) && i.quantity > 0);
  
  const hasFresh = matchedPantryItems.some(i => i.todayPlanned);
  const hasDormant = matchedPantryItems.some(i => i.priorityDeplete);

  let borderStyle = {};
  let icon = '';
  if (hasFresh) {
    borderStyle = { borderColor: 'rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.04)' };
    icon = '🥬 ';
  } else if (hasDormant) {
    borderStyle = { borderColor: 'rgba(139,92,246,0.4)', background: 'rgba(139,92,246,0.04)' };
    icon = '🧹 ';
  }

  return (
    <span
      className="text-[11px] font-medium px-1.5 py-[2px] rounded border flex items-center gap-0.5"
      style={{
        background: isEnough ? 'var(--bg-secondary)' : (status.optional ? '#FEF3C7' : 'var(--danger-muted)'),
        color: isEnough ? 'var(--text)' : (status.optional ? '#B45309' : 'var(--danger)'),
        borderColor: isEnough ? 'transparent' : (status.optional ? '#FDE68A' : 'rgba(239,68,68,0.2)'),
        ...borderStyle
      }}
    >
      {icon && <span className="text-[10px]">{icon}</span>}
      <span>{status.name} {status.qtyNeeded > 0 ? `${status.qtyNeeded}${status.unit}` : ''} {status.optional && '(可選)'}</span>
    </span>
  );
};

export default memo(function RecipeCard({
  recipe,
  pantry,
  isExpanded = true,
  onToggleExpand,
  onViewDetail,
  onEdit,
  onToggleMeal,
  onArchive,
  onUnarchive,
}: RecipeCardProps) {
  const analysis = analyzeRecipe(recipe, pantry);
  const mainIngredients = analysis.ingredientsStatus.filter(i => i.section === 'main');
  const seasonings = analysis.ingredientsStatus.filter(i => i.section === 'seasoning');

  const [isToggling, setIsToggling] = useState(false);
  const [optimisticMeal, setOptimisticMeal] = useState<string | null>(recipe.todayMeal || null);

  useEffect(() => {
    setOptimisticMeal(recipe.todayMeal || null);
  }, [recipe.todayMeal]);

  const handleToggleMeal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isToggling) return;
    setIsToggling(true);
    setOptimisticMeal(optimisticMeal ? null : 'lunch'); // 樂觀更新 UI
    
    try {
      await onToggleMeal();
    } finally {
      setIsToggling(false);
    }
  };

  const hasPerishable = useMemo(() => {
    return pantry.some(i => {
      if (!i.todayPlanned || i.quantity <= 0) return false;
      const nameNorm = i.name.trim().toLowerCase();
      return (recipe.ingredients_main || []).some(req => 
        req.name.split(/[/|、]/).some((n: string) => n.trim().toLowerCase() === nameNorm)
      );
    });
  }, [pantry, recipe.ingredients_main]);

  const hasDormant = useMemo(() => {
    return pantry.some(i => {
      if (i.quantity <= 0 || !i.priorityDeplete) return false;

      const nameNorm = i.name.trim().toLowerCase();
      return (recipe.ingredients_main || []).some(req => 
        req.name.split(/[/|、]/).some((n: string) => n.trim().toLowerCase() === nameNorm)
      );
    });
  }, [pantry, recipe.ingredients_main]);

  return (
    <div
      className={`flex flex-col p-3 rounded-2xl transition-all duration-200 cursor-pointer ${isExpanded ? '' : 'max-h-24 overflow-hidden'}`}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
        opacity: recipe.archivedAt ? 0.6 : 1,
      }}
      onClick={onToggleExpand}
    >
      {/* 標題與操作列 */}
      <div className="flex justify-between items-start mb-2 gap-2">
        <div className="flex flex-col flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-base leading-tight" style={{ color: 'var(--text)' }}>
              {recipe.name}
            </h3>
            {recipe.isOneOff && (
              <span className="text-[10px] px-1.5 py-[1px] rounded" style={{ background: '#E0E7FF', color: '#4338CA' }}>
                特別
              </span>
            )}
            <span
              className="text-[10px] px-1.5 py-[1px] rounded font-semibold whitespace-nowrap"
              style={{
                background: analysis.isCookable ? 'var(--primary-muted)' : 'var(--danger-muted)',
                color: analysis.isCookable ? 'var(--primary)' : 'var(--danger)'
              }}
            >
              {analysis.isCookable ? '✓ 可以開煮' : '✕ 缺食材'}
            </span>
            {hasPerishable && (
              <span className="text-[10px] px-1.5 py-[1px] rounded font-semibold whitespace-nowrap bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                🥬 搶鮮
              </span>
            )}
            {hasDormant && (
              <span className="text-[10px] px-1.5 py-[1px] rounded font-semibold whitespace-nowrap bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400">
                🧹 清庫存
              </span>
            )}
          </div>
        </div>

        {/* 按鈕群 */}
        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={onViewDetail} className="w-7 h-7 flex items-center justify-center rounded-lg bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors" title="步驟">📖</button>
          <button onClick={onEdit} className="w-7 h-7 flex items-center justify-center rounded-lg bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors" title="編輯">✎</button>
          
          {recipe.archivedAt ? (
            <button onClick={onUnarchive} className="w-7 h-7 flex items-center justify-center rounded-lg bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors" title="取消封存">↩</button>
          ) : (
            <>
              <button onClick={onArchive} className="w-7 h-7 flex items-center justify-center rounded-lg bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors" title="封存食譜">📥</button>
              <button
                onClick={handleToggleMeal}
                disabled={isToggling}
                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors border ${isToggling ? 'opacity-70 cursor-wait' : ''}`}
                style={{
                  background: optimisticMeal ? 'var(--primary-muted)' : 'var(--bg-secondary)',
                  color: optimisticMeal ? 'var(--primary)' : 'var(--text-muted)',
                  borderColor: optimisticMeal ? 'rgba(16,185,129,0.3)' : 'transparent'
                }}
                title="排入配餐"
              >
                {isToggling ? (
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="17" x2="12" y2="22"></line>
                    <path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.78-3.5A2 2 0 0 1 15 9.26V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4.26a2 2 0 0 1-.78 1.24l-2.78 3.5a2 2 0 0 0-.44 1.24Z"></path>
                  </svg>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* 食材列表 */}
      <div className="flex flex-col gap-1.5 mt-1">
        {mainIngredients.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {mainIngredients.map((status, idx) => <Tag key={idx} status={status} pantry={pantry} />)}
          </div>
        )}
        
        {seasonings.length > 0 && isExpanded && (
          <>
            <div className="text-[10px] font-semibold mt-1" style={{ color: 'var(--text-muted)' }}>調味料</div>
            <div className="flex flex-wrap gap-1">
              {seasonings.map((status, idx) => <Tag key={idx} status={status} pantry={pantry} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
});

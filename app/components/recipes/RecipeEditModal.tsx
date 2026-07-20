'use client';

import { useState, useCallback } from 'react';
import type { Recipe, RecipeIngredient, Ingredient } from '@/lib/types';
import { saveRecipe, deleteRecipe } from '@/lib/api';
import { useToast } from '../layout/Toast';

import { normalizeName } from '@/lib/recipe-utils';

interface RecipeEditModalProps {
  recipe?: Recipe; // 傳入則為編輯，無傳入則為新增
  pantryIngredients?: Ingredient[]; // 用於自動帶入單位
  onClose: () => void;
  onMutate: () => void;
}

const IngredientRow = ({ 
  item, 
  pantryIngredients,
  isSeasoning,
  onChange, 
  onRemove 
}: { 
  item: RecipeIngredient, 
  pantryIngredients?: Ingredient[],
  isSeasoning?: boolean,
  onChange: (val: RecipeIngredient) => void, 
  onRemove: () => void 
}) => {
  let unitWarning = '';
  if (!isSeasoning && item.name.trim() && item.unit && pantryIngredients) {
    const alts = item.name.split(/[/|、]/).map(n => normalizeName(n)).filter(Boolean);
    const match = pantryIngredients.find(i => alts.includes(normalizeName(i.name)));
    
    if (match && match.unit && match.unit !== item.unit) {
      unitWarning = `庫存單位為「${match.unit}」，請手動換算`;
    }
  }

  return (
    <div className="flex flex-col w-full">
      <div className="flex items-center gap-1.5 w-full">
        <input 
          type="text" 
          value={item.name} 
          onChange={e => onChange({ ...item, name: e.target.value })} 
          onBlur={() => {
            if (!item.unit && item.name.trim() && pantryIngredients) {
              const norm = normalizeName(item.name);
              const match = pantryIngredients.find(i => normalizeName(i.name) === norm);
              if (match && match.unit) {
                onChange({ ...item, unit: match.unit });
              }
            }
          }}
          placeholder="食材名稱" 
          className="flex-[2.5] min-w-0 bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1.5 text-sm"
        />
        <input 
          type="number" 
          step="0.1" 
          value={item.quantity || ''} 
          onChange={e => onChange({ ...item, quantity: parseFloat(e.target.value) })} 
          placeholder="量" 
          className="flex-[1] min-w-0 bg-[var(--surface)] border border-[var(--border)] rounded px-1 py-1.5 text-sm text-center"
        />
        <input 
          type="text" 
          value={item.unit} 
          onChange={e => onChange({ ...item, unit: e.target.value })} 
          placeholder="單位" 
          title={unitWarning}
          className={`flex-[1.2] min-w-0 border rounded px-1 py-1.5 text-sm text-center transition-colors ${
            unitWarning 
              ? 'border-orange-500 bg-orange-500/10 text-orange-600 font-bold' 
              : 'border-[var(--border)] bg-[var(--surface)]'
          }`}
        />
        <label className="flex items-center justify-center bg-[var(--surface)] border border-[var(--border)] rounded w-8 h-[34px] shrink-0 cursor-pointer shadow-sm">
          <input 
            type="checkbox" 
            checked={item.optional || false}
            onChange={e => onChange({ ...item, optional: e.target.checked })}
            className="w-4 h-4 accent-[var(--primary)]"
          />
        </label>
        <button type="button" onClick={onRemove} className="text-[var(--danger)] font-bold text-xl w-6 flex items-center justify-center shrink-0">×</button>
      </div>
      {unitWarning && (
        <div className="text-[11px] text-orange-500 mt-1 ml-1 font-medium animate-fade-in">
          ⚠️ {unitWarning}
        </div>
      )}
    </div>
  );
};

export default function RecipeEditModal({ recipe, pantryIngredients, onClose, onMutate }: RecipeEditModalProps) {
  const { showToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  // 表單狀態
  const [name, setName] = useState(recipe?.name || '');
  const [isOneOff, setIsOneOff] = useState(recipe?.isOneOff || false);
  const [instructions, setInstructions] = useState(recipe?.instructions || '');
  
  const [mainIngredients, setMainIngredients] = useState<RecipeIngredient[]>(
    recipe?.ingredients_main?.length ? recipe.ingredients_main : [{ name: '', quantity: 1, unit: '' }]
  );
  const [seasonings, setSeasonings] = useState<RecipeIngredient[]>(
    recipe?.seasonings?.length ? recipe.seasonings : []
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      const cleanMains = mainIngredients.filter(i => i.name.trim());
      const cleanSeasonings = seasonings.filter(i => i.name.trim());

      const payload: Partial<Recipe> = {
        id: recipe?.id || `r_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        name: name.trim(),
        isOneOff,
        instructions: instructions.trim(),
        ingredients_main: cleanMains,
        seasonings: cleanSeasonings,
        ingredients: [...cleanMains, ...cleanSeasonings],
        last_updated: new Date().toISOString(),
        todayMeal: recipe?.todayMeal || '',
        archivedAt: recipe?.archivedAt || null,
      };

      await saveRecipe(payload as Recipe);
      showToast(recipe ? '已儲存食譜' : '已新增食譜', 'success');
      onMutate();
      onClose();
    } catch {
      showToast('儲存失敗', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!recipe?.id) return;
    if (!confirm(`確定要刪除食譜「${recipe.name}」嗎？這個動作無法復原。`)) return;

    setIsSaving(true);
    try {
      await deleteRecipe(recipe.id);
      showToast('已刪除食譜', 'success');
      onMutate();
      onClose();
    } catch {
      showToast('刪除失敗', 'error');
      setIsSaving(false);
    }
  };

  const handleArchiveToggle = async () => {
    if (!recipe?.id) return;
    const isArchived = !!recipe.archivedAt;
    setIsSaving(true);
    try {
      await saveRecipe({
        ...recipe,
        archivedAt: isArchived ? null : new Date().toISOString()
      });
      showToast(isArchived ? '已取消封存食譜' : '已封存食譜', 'success');
      onMutate();
      onClose();
    } catch {
      showToast('操作失敗', 'error');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/60 sm:items-center sm:justify-center p-0 sm:p-4 animate-fade-in" onClick={onClose}>
      <div 
        className="w-full sm:max-w-lg bg-[var(--bg)] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col h-[90vh] sm:h-[80vh] overflow-hidden" 
        onClick={e => e.stopPropagation()}
        style={{ animation: 'slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <div className="flex justify-between items-center p-4 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-lg font-bold text-[var(--text)]">{recipe ? '編輯食譜' : '新增食譜'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--bg-secondary)] hover:bg-[var(--surface)] transition-colors">✕</button>
        </div>

        <form id="recipe-form" onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
          {/* 基本資訊 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>食譜名稱 *</label>
            <input 
              type="text" 
              required 
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例如：番茄炒蛋" 
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--primary)]"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
            <input 
              type="checkbox" 
              checked={isOneOff}
              onChange={e => setIsOneOff(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>特別食譜（不列入常態清單，煮完後可封存）</span>
          </label>

          {/* 主要食材 */}
          <div className="flex flex-col gap-2 p-3 rounded-lg border border-[var(--border)]" style={{ background: 'var(--bg-secondary)' }}>
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>主要食材</label>
              <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>☑️ 可選</span>
            </div>
            <div className="flex flex-col gap-2">
              {mainIngredients.map((item, idx) => (
                <IngredientRow 
                  key={idx} 
                  item={item} 
                  pantryIngredients={pantryIngredients}
                  onChange={v => setMainIngredients(prev => prev.map((it, i) => i === idx ? v : it))}
                  onRemove={() => setMainIngredients(prev => prev.filter((_, i) => i !== idx))}
                />
              ))}
            </div>
            <button 
              type="button" 
              onClick={() => setMainIngredients(prev => [...prev, { name: '', quantity: 1, unit: '' }])}
              className="self-start text-sm mt-1 px-3 py-1 rounded bg-[var(--surface)] shadow-sm font-medium"
            >
              + 增加主要食材
            </button>
          </div>

          {/* 調味料 */}
          <div className="flex flex-col gap-2 p-3 rounded-lg border border-[var(--border)]" style={{ background: 'var(--bg-secondary)' }}>
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>調味料</label>
              <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>☑️ 可選</span>
            </div>
            <div className="flex flex-col gap-2">
              {seasonings.map((item, idx) => (
                <IngredientRow 
                  key={idx} 
                  item={item} 
                  pantryIngredients={pantryIngredients}
                  isSeasoning={true}
                  onChange={v => setSeasonings(prev => prev.map((it, i) => i === idx ? v : it))}
                  onRemove={() => setSeasonings(prev => prev.filter((_, i) => i !== idx))}
                />
              ))}
            </div>
            <button 
              type="button" 
              onClick={() => setSeasonings(prev => [...prev, { name: '', quantity: 1, unit: '' }])}
              className="self-start text-sm mt-1 px-3 py-1 rounded bg-[var(--surface)] shadow-sm font-medium"
            >
              + 增加調味料
            </button>
          </div>

          {/* 步驟 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>烹飪步驟</label>
            <textarea 
              rows={4}
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              placeholder="請輸入料理步驟..." 
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--primary)] resize-none"
            />
          </div>
        </form>

        {/* 底部操作區 */}
        <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t flex gap-2 shrink-0 bg-[var(--surface)]" style={{ borderColor: 'var(--border)' }}>
          {recipe && (
            <>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSaving}
                className="w-12 flex items-center justify-center rounded-xl bg-[var(--danger-muted)] text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white transition-colors"
                title="刪除食譜"
              >
                🗑️
              </button>
              <button
                type="button"
                onClick={handleArchiveToggle}
                disabled={isSaving}
                className="w-12 flex items-center justify-center rounded-xl bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--border)] transition-colors text-lg"
                title={recipe.archivedAt ? "取消封存" : "封存食譜"}
              >
                {recipe.archivedAt ? "📂" : "📥"}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl font-bold transition-colors bg-[var(--bg-secondary)] hover:bg-[var(--border)] text-[var(--text)]"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-3 rounded-xl font-bold text-white transition-opacity active:opacity-80"
            style={{ background: 'var(--primary)' }}
          >
            {isSaving ? '儲存中...' : '儲存食譜'}
          </button>
        </div>
      </div>
    </div>
  );
}

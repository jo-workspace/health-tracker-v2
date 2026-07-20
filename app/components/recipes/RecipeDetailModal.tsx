'use client';

import { useMemo } from 'react';
import type { Recipe, Ingredient } from '@/lib/types';
import { analyzeRecipe } from '@/lib/recipe-utils';

interface RecipeDetailModalProps {
  recipe: Recipe;
  pantry: Ingredient[];
  onClose: () => void;
  onCook?: () => void;
  onEdit?: () => void;
}

export default function RecipeDetailModal({ recipe, pantry, onClose, onCook, onEdit }: RecipeDetailModalProps) {
  const analysis = useMemo(() => analyzeRecipe(recipe, pantry), [recipe, pantry]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/60 sm:items-center sm:justify-center p-0 sm:p-4 animate-fade-in" onClick={onClose}>
      <div 
        className="w-full sm:max-w-lg bg-[var(--bg)] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col h-[90vh] sm:h-[80vh] overflow-hidden" 
        onClick={e => e.stopPropagation()}
        style={{ animation: 'slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <div className="flex justify-between items-center p-4 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-lg font-bold text-[var(--text)]">{recipe.name}</h2>
          <div className="flex gap-2">
            {onEdit && (
              <button onClick={onEdit} className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--bg-secondary)] hover:bg-[var(--surface)] transition-colors">
                ✎
              </button>
            )}
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--bg-secondary)] hover:bg-[var(--surface)] transition-colors">
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
          {/* 食材清單 */}
          <div className="flex flex-col gap-3">
            <h3 className="font-bold text-base" style={{ color: 'var(--text)' }}>食材清單</h3>
            
            {/* 主要食材 */}
            {analysis.ingredientsStatus.filter(i => i.section === 'main').length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>主要食材</div>
                <div className="flex flex-col gap-1">
                  {analysis.ingredientsStatus.filter(i => i.section === 'main').map((i, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2.5 rounded-lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                        {i.name} {i.qtyNeeded > 0 ? <small className="opacity-70 ml-1">(需 {i.qtyNeeded}{i.unit})</small> : ''} {i.optional && <span className="text-xs ml-1 text-amber-600">(可選)</span>}
                      </span>
                      <span className="text-xs font-bold px-2 py-1 rounded" style={{ 
                        background: i.isEnough ? 'var(--primary-muted)' : (i.optional ? '#FEF3C7' : 'var(--danger-muted)'), 
                        color: i.isEnough ? 'var(--primary)' : (i.optional ? '#B45309' : 'var(--danger)') 
                      }}>
                        {i.isEnough ? '充足' : (i.optional ? '缺料 (可省略)' : '缺料')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 調味料 */}
            {analysis.ingredientsStatus.filter(i => i.section === 'seasoning').length > 0 && (
              <div className="flex flex-col gap-2 mt-2">
                <div className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>調味料</div>
                <div className="flex flex-col gap-1">
                  {analysis.ingredientsStatus.filter(i => i.section === 'seasoning').map((i, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2.5 rounded-lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                        {i.name} {i.qtyNeeded > 0 ? <small className="opacity-70 ml-1">(需 {i.qtyNeeded}{i.unit})</small> : ''} {i.optional && <span className="text-xs ml-1 text-amber-600">(可選)</span>}
                      </span>
                      <span className="text-xs font-bold px-2 py-1 rounded" style={{ 
                        background: i.isEnough ? 'var(--primary-muted)' : (i.optional ? '#FEF3C7' : 'var(--danger-muted)'), 
                        color: i.isEnough ? 'var(--primary)' : (i.optional ? '#B45309' : 'var(--danger)') 
                      }}>
                        {i.isEnough ? '充足' : (i.optional ? '缺料 (可省略)' : '缺料')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 步驟 */}
          <div className="flex flex-col gap-3">
            <h3 className="font-bold text-base" style={{ color: 'var(--text)' }}>烹飪步驟</h3>
            <div className="p-4 rounded-xl text-sm leading-relaxed whitespace-pre-wrap" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
              {recipe.instructions || '無料理步驟。'}
            </div>
          </div>
        </div>

        {/* 底部操作區 */}
        <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t flex gap-2 shrink-0 bg-[var(--surface)]" style={{ borderColor: 'var(--border)' }}>
          {analysis.isCookable ? (
            <button
              onClick={() => { onClose(); onCook?.(); }}
              className="flex-1 py-3 rounded-xl font-bold text-white transition-opacity active:opacity-80"
              style={{ background: 'var(--primary)' }}
            >
              做這道菜 (扣庫存)
            </button>
          ) : (
            <button
              disabled
              className="flex-1 py-3 rounded-xl font-bold transition-opacity"
              style={{ background: 'var(--danger-muted)', color: 'var(--danger)' }}
            >
              缺食材無法開煮
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

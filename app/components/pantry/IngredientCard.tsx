'use client';

import { useState, useRef, useMemo } from 'react';
import type { Ingredient } from '@/lib/types';

const CATEGORY_COLORS: Record<string, string> = {
  '剩菜/即食': 'hsl(16, 85%, 50%)',
  '蛋豆魚肉類': 'hsl(340, 60%, 52%)',
  '蔬菜類': 'hsl(120, 45%, 42%)',
  '辛香料': 'hsl(15, 70%, 48%)',
  '調味料': 'hsl(260, 40%, 52%)',
  '乾貨': 'hsl(40, 45%, 42%)',
  '澱粉類': 'hsl(40, 60%, 50%)',
  '水果類': 'hsl(35, 80%, 50%)',
  '乳製品': 'hsl(210, 65%, 52%)',
  '烘焙類': 'hsl(25, 75%, 48%)',
  '點心類': 'hsl(330, 65%, 60%)',
};

function getCategoryColor(cat: string) {
  return CATEGORY_COLORS[cat] || 'var(--primary)';
}

function formatQty(qty: number) {
  return Math.round(qty * 1000000) / 1000000 + '' === String(Math.round(qty))
    ? String(Math.round(qty))
    : qty.toFixed(6).replace(/\.?0+$/, '');
}

interface IngredientCardProps {
  item: Ingredient;
  onEdit: () => void;
  onQtyChange: (delta: number) => void;
  onUpdate?: (updated: Ingredient) => void;
}

export default function IngredientCard({ item, onEdit, onQtyChange, onUpdate }: IngredientCardProps) {
  const [showDeduct, setShowDeduct] = useState<'minus' | 'plus' | null>(null);
  const effectiveStepSize = useMemo(() => {
    if (item.step_size && item.step_size !== 1) {
      return item.step_size;
    }
    const unit = (item.unit || '').trim();
    const category = (item.category || '').trim();
    const isBulkUnit = ['瓶', '罐', '包', '盒', '袋', '桶'].includes(unit);
    const isSeasoningOrSpice = ['調味料', '辛香料'].includes(category);
    
    if (isBulkUnit && isSeasoningOrSpice) {
      return 0.1; // 瓶裝調味料/辛香料預設微調 0.1
    }
    return item.step_size || 1;
  }, [item.step_size, item.unit, item.category]);

  const catColor = getCategoryColor(item.category);

  // 快速 +/- 預設選項
  const deductOptions = [effectiveStepSize, effectiveStepSize * 2, effectiveStepSize * 3].filter((v, i, a) => a.indexOf(v) === i);
  const addOptions = [effectiveStepSize, effectiveStepSize * 2, effectiveStepSize * 5].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div
      className="group flex items-center gap-2 py-1.5 px-2 md:py-3 md:px-4 rounded-xl transition-all duration-200 relative overflow-visible"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* 左邊緣色條 */}
      <div className="absolute left-0 top-2 bottom-2 md:top-3 md:bottom-3 w-1 md:w-1.5 rounded-r" style={{ background: catColor }} />

      {/* 左側：名稱與標籤 */}
      <div className="flex flex-col flex-1 gap-0.5 md:gap-1.5 pl-1.5 md:pl-3 overflow-hidden">
        <div className="flex items-center gap-1">
          <span className="font-semibold text-[14px] md:text-base leading-tight truncate" style={{ color: 'var(--text)' }}>
            {item.name}
          </span>
          {item.category === '剩菜/即食' && item.expiry_date && (() => {
            const daysLeft = Math.ceil((new Date(item.expiry_date).getTime() - new Date().getTime()) / 86400000);
            let badgeStyle = { background: 'var(--primary-muted)', color: 'var(--primary)' };
            let text = `剩 ${daysLeft} 天`;
            if (daysLeft < 0) {
              badgeStyle = { background: 'var(--danger-muted)', color: 'var(--danger)' };
              text = `過期 ${Math.abs(daysLeft)} 天`;
            } else if (daysLeft <= 2) {
              badgeStyle = { background: '#FFF3E0', color: '#E65100' }; // Warning orange
              if (daysLeft === 0) text = '今天到期';
            }
            return (
              <span
                className="text-[10px] font-bold px-1.5 py-[1px] rounded-md flex-shrink-0"
                style={badgeStyle}
              >
                {text}
              </span>
            );
          })()}
          <button
            onClick={onEdit}
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center transition-colors"
            style={{ color: 'var(--text-muted)' }}
            title="編輯"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        </div>

        {/* 標籤列 */}
        <div className="flex flex-wrap gap-1 items-center">
          <span
            className="text-[10px] font-medium px-1.5 py-[1px] rounded-md"
            style={{ background: `${catColor}15`, color: catColor }}
          >
            {item.location}
          </span>
          {item.owner !== '人類' && (
            <span
              className="text-[10px] font-medium px-1.5 py-[1px] rounded-md"
              style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
            >
              {item.owner}
            </span>
          )}

          {/* 🥬 搶鮮快速切換 */}
          {onUpdate && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUpdate({ ...item, todayPlanned: !item.todayPlanned });
              }}
              className={`active:scale-135 hover:scale-115 transition-all duration-150 select-none cursor-pointer text-base p-0.5 flex items-center justify-center shrink-0
                ${item.todayPlanned 
                  ? 'opacity-100 filter-none' 
                  : 'opacity-0 pointer-events-none md:pointer-events-auto md:group-hover:opacity-35 md:hover:!opacity-100 filter grayscale'
                }`}
              title="點擊切換『🥬 搶鮮』"
            >
              🥬
            </button>
          )}

          {/* 🧹 清庫存快速切換 */}
          {onUpdate && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUpdate({ ...item, priorityDeplete: !item.priorityDeplete });
              }}
              className={`active:scale-135 hover:scale-115 transition-all duration-150 select-none cursor-pointer text-base p-0.5 flex items-center justify-center shrink-0
                ${item.priorityDeplete 
                  ? 'opacity-100 filter-none' 
                  : 'opacity-0 pointer-events-none md:pointer-events-auto md:group-hover:opacity-35 md:hover:!opacity-100 filter grayscale'
                }`}
              title="點擊切換『🧹 清庫存』"
            >
              🧹
            </button>
          )}

          {item.urls && (
            <a
              href={item.urls}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-medium px-1.5 py-[1px] rounded-md flex items-center gap-0.5"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <span>🛒</span>購買
            </a>
          )}
        </div>
      </div>

      {/* 右側：數量控制器 */}
      <div className="flex-shrink-0 relative">
        <div
          className="flex items-center justify-between rounded-lg overflow-hidden"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
        >
          {/* - 按鈕 */}
          <button
            onClick={() => setShowDeduct(showDeduct === 'minus' ? null : 'minus')}
            className="w-6 h-[26px] flex items-center justify-center font-bold text-base transition-colors flex-shrink-0"
            style={{ color: 'var(--danger)' }}
          >
            −
          </button>

          {/* 數量顯示 */}
          <div className="flex flex-row items-center justify-center min-w-[32px] px-1 h-[26px] gap-0.5 bg-white dark:bg-transparent">
            <span className="text-[14px] font-bold pt-[1px]" style={{ color: 'var(--text)' }}>
              {formatQty(item.quantity)}
            </span>
            <span className="text-[10px] font-medium pt-[2px]" style={{ color: 'var(--text-muted)' }}>
              {item.unit}
            </span>
          </div>

          {/* + 按鈕 */}
          <button
            onClick={() => setShowDeduct(showDeduct === 'plus' ? null : 'plus')}
            className="w-6 h-[26px] flex items-center justify-center font-bold text-[15px] transition-colors flex-shrink-0"
            style={{ color: 'var(--primary)' }}
          >
            +
          </button>
        </div>

        {/* Popover：快速扣減 */}
        {showDeduct !== null && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowDeduct(null)} />
            <div
              className="absolute bottom-full right-0 mb-1 rounded-xl p-1.5 z-20 flex gap-1 animate-scale-in w-[160px]"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              {(showDeduct === 'minus' ? deductOptions : addOptions).map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    onQtyChange(showDeduct === 'minus' ? -v : v);
                    setShowDeduct(null);
                  }}
                  className="flex-1 py-1 rounded-lg text-xs font-semibold transition-colors"
                  style={{
                    background: showDeduct === 'minus' ? 'var(--danger-muted)' : 'var(--primary-muted)',
                    color: showDeduct === 'minus' ? 'var(--danger)' : 'var(--primary)',
                  }}
                >
                  {showDeduct === 'minus' ? '-' : '+'}{formatQty(v)}
                </button>
              ))}
              <button
                onClick={() => {
                  const val = prompt(showDeduct === 'minus' ? '扣減多少？' : '增加多少？');
                  const n = parseFloat(val || '');
                  if (!isNaN(n) && n > 0) onQtyChange(showDeduct === 'minus' ? -n : n);
                  setShowDeduct(null);
                }}
                className="flex-shrink-0 px-2 py-1 rounded-lg text-xs font-semibold transition-colors"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
              >
                自訂
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

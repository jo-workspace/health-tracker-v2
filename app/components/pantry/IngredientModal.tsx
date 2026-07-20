'use client';

import { useState, useEffect } from 'react';
import type { Ingredient } from '@/lib/types';

const CATEGORIES = ['剩菜/即食', '蛋豆魚肉類', '蔬菜類', '辛香料', '調味料', '乾貨', '澱粉類', '水果類', '乳製品', '烘焙類', '點心類'];
const LOCATIONS = ['冷藏', '冷凍', '廚房櫥櫃', '客廳櫥櫃', '餐桌', '乾燥室'];
const UNITS = ['個', '包', '袋', '瓶', '罐', '片', '條', '盒', '克', '公克', 'g', '公斤', 'kg', '毫升', 'ml', '公升', 'L', '份', '串', '匙', '茶匙', '湯匙', 'pcs'];
const OWNERS = ['人類', '特特', '共享'];

function genId() {
  return 'ing_' + Date.now();
}

interface IngredientModalProps {
  item: Ingredient | null; // null = 新增模式
  defaultOwner?: string;
  onSave: (item: Ingredient) => void;
  onDelete: (id: string, name: string) => void;
  onClose: () => void;
  saving: boolean;
}

export default function IngredientModal({
  item, defaultOwner = '人類',
  onSave, onDelete, onClose, saving,
}: IngredientModalProps) {
  const isNew = !item;

  const [form, setForm] = useState<Partial<Ingredient>>({
    id: item?.id || '',
    name: item?.name || '',
    category: item?.category || '蔬菜類',
    location: item?.location || '冷藏',
    quantity: item?.quantity ?? 1,
    unit: item?.unit || '個',
    replenish: item?.replenish ?? true,
    channels: item?.channels || [],
    urls: item?.urls || '',
    owner: item?.owner || defaultOwner,
    protein: item?.protein ?? 0,
    fat: item?.fat ?? 0,
    carbs: item?.carbs ?? 0,
    color: item?.color || '無',
    expiry_date: item?.expiry_date || '',
    step_size: item?.step_size ?? 1,
    todayPlanned: item?.todayPlanned ?? false,
    priorityDeplete: item?.priorityDeplete ?? false,
    todayConsumed: item?.todayConsumed ?? false,
    todayDeductQty: item?.todayDeductQty ?? 0,
    minStock: item?.minStock ?? 0,
  });

  // 每次 item 變化時重設 form
  useEffect(() => {
    setForm({
      id: item?.id || '',
      name: item?.name || '',
      category: item?.category || '蔬菜類',
      location: item?.location || '冷藏',
      quantity: item?.quantity ?? 1,
      unit: item?.unit || '個',
      replenish: item?.replenish ?? true,
      channels: item?.channels || [],
      urls: item?.urls || '',
      owner: item?.owner || defaultOwner,
      protein: item?.protein ?? 0,
      fat: item?.fat ?? 0,
      carbs: item?.carbs ?? 0,
      color: item?.color || '無',
      expiry_date: item?.expiry_date || '',
      step_size: item?.step_size ?? 1,
      todayPlanned: item?.todayPlanned ?? false,
      priorityDeplete: item?.priorityDeplete ?? false,
      todayConsumed: item?.todayConsumed ?? false,
      todayDeductQty: item?.todayDeductQty ?? 0,
      minStock: item?.minStock ?? 0,
    });
  }, [item, defaultOwner]);

  const set = (key: keyof Ingredient, val: unknown) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    onSave({
      ...(form as Ingredient),
      id: form.id || genId(),
      last_updated: now,
      channels: typeof form.channels === 'string'
        ? (form.channels as string).split(',').map((s) => s.trim()).filter(Boolean)
        : form.channels || [],
    });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4"
      style={{ background: 'hsla(0,0%,0%,0.4)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-3xl overflow-hidden animate-fade-up"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
            {isNew ? '新增食材' : `編輯：${item.name}`}
          </h2>
          <button onClick={onClose} className="btn-ghost w-8 h-8 rounded-full flex items-center justify-center text-lg">✕</button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 py-4 flex flex-col gap-4">

          {/* 名稱 */}
          <Field label="食材名稱" required>
            <input
              autoFocus
              type="text"
              required
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="例：紅蘿蔔"
              className="input-field"
            />
          </Field>

          {/* 分類 + 存放位置 */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="分類">
              <select value={form.category} onChange={(e) => set('category', e.target.value)} className="input-field">
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="存放位置">
              <select value={form.location} onChange={(e) => set('location', e.target.value)} className="input-field">
                {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </Field>
          </div>

          {/* 數量 + 單位 */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="數量">
              <input
                type="number"
                min="0"
                step="any"
                value={form.quantity}
                onChange={(e) => set('quantity', parseFloat(e.target.value) || 0)}
                className="input-field"
              />
            </Field>
            <Field label="單位">
              <select value={form.unit} onChange={(e) => set('unit', e.target.value)} className="input-field">
                {UNITS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </Field>
          </div>

          {/* 擁有者 */}
          <Field label="擁有者">
            <div className="flex gap-2">
              {OWNERS.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => set('owner', o)}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: form.owner === o ? 'var(--primary)' : 'var(--bg-secondary)',
                    color: form.owner === o ? 'white' : 'var(--text-secondary)',
                  }}
                >
                  {o}
                </button>
              ))}
            </div>
          </Field>

          {/* 最低庫存 + 步進 */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="最低庫存">
              <input
                type="number" min="0" step="any"
                value={form.minStock}
                onChange={(e) => set('minStock', parseFloat(e.target.value) || 0)}
                className="input-field"
              />
            </Field>
            <Field label="每次步進量">
              <input
                type="number" min="0.01" step="any"
                value={form.step_size}
                onChange={(e) => set('step_size', parseFloat(e.target.value) || 1)}
                className="input-field"
              />
            </Field>
          </div>

          {/* 採購通路 + 連結 */}
          <Field label="採購通路">
            <input
              type="text"
              value={Array.isArray(form.channels) ? form.channels.join(', ') : form.channels}
              onChange={(e) => set('channels', e.target.value)}
              placeholder="線上寵物店, 全聯..."
              className="input-field"
            />
          </Field>
          <Field label="購買連結">
            <input
              type="url"
              value={form.urls}
              onChange={(e) => set('urls', e.target.value)}
              placeholder="https://..."
              className="input-field"
            />
          </Field>

          {/* 🥬 搶鮮吃 & 🧹 清庫存 */}
          <div className="flex flex-col gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                className="relative w-10 h-6 rounded-full transition-colors shrink-0"
                style={{ background: form.todayPlanned ? 'var(--primary)' : 'var(--border)' }}
                onClick={() => set('todayPlanned', !form.todayPlanned)}
              >
                <div
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                  style={{ left: form.todayPlanned ? '18px' : '2px' }}
                />
              </div>
              <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>🥬 搶鮮吃（易腐爛/過期，優先拯救）</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <div
                className="relative w-10 h-6 rounded-full transition-colors shrink-0"
                style={{ background: form.priorityDeplete ? '#8B5CF6' : 'var(--border)' }}
                onClick={() => set('priorityDeplete', !form.priorityDeplete)}
              >
                <div
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                  style={{ left: form.priorityDeplete ? '18px' : '2px' }}
                />
              </div>
              <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>🧹 清庫存（耐放但擺了很久，活化空間）</span>
            </label>
          </div>

          {/* 自動補貨 */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              className="relative w-10 h-6 rounded-full transition-colors"
              style={{ background: form.replenish ? 'var(--primary)' : 'var(--bg-secondary)' }}
              onClick={() => set('replenish', !form.replenish)}
            >
              <div
                className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                style={{ left: form.replenish ? '18px' : '2px' }}
              />
            </div>
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>自動補貨（採購清單）</span>
          </label>

          {/* 按鈕組 */}
          <div className="flex gap-2 pt-2">
            {!isNew && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`確定刪除「${item.name}」？`)) onDelete(item.id, item.name);
                }}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                style={{ background: 'var(--danger-muted)', color: 'var(--danger)', border: '1px solid var(--danger)' }}
              >
                刪除
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn-secondary py-2.5 text-sm"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 btn-primary py-2.5 text-sm"
            >
              {saving ? '儲存中...' : isNew ? '新增' : '儲存'}
            </button>
          </div>
        </form>

        <style>{`
          .input-field {
            width: 100%;
            padding: 10px 12px;
            border-radius: 12px;
            border: 1px solid var(--border);
            background: var(--bg-secondary);
            color: var(--text);
            font-size: 14px;
            outline: none;
            font-family: var(--font-sans);
            transition: border-color 0.15s;
          }
          .input-field:focus { border-color: var(--primary); }
          select.input-field { cursor: pointer; }
        `}</style>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
        {label}{required && <span style={{ color: 'var(--danger)' }}> *</span>}
      </label>
      {children}
    </div>
  );
}

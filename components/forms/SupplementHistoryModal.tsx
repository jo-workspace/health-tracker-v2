'use client';
import { createPortal } from 'react-dom';
import { X, History } from 'lucide-react';
import type { SupplementLog, SupplementSetting } from '@/lib/types';
import { PREDEFINED_SUPPLEMENTS, isScheduledDay, type Supplement } from '@/lib/supplements';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data?: SupplementLog[];
  settings?: SupplementSetting[];
}

const MAX_WINDOW_DAYS = 90;

interface ItemStat {
  id: string;
  name: string;
  expected: number;
  achieved: number;
  increasedDose: number;
}

export default function SupplementHistoryModal({ isOpen, onClose, data = [], settings = [] }: Props) {
  if (!isOpen) return null;

  const activeLogs = data.filter(l => l.status !== 'deleted');

  // 基底品項清單：邏輯與 SupplementTracker 一致，優先用雲端設定，否則用預設清單
  const baseItems = settings && settings.length > 0
    ? settings.filter(s => s.status !== 'deleted').map(s => ({
        id: s.id,
        name: s.name,
        time: s.time,
        targetAmount: parseInt(s.targetAmount, 10) || 1
      }))
    : PREDEFINED_SUPPLEMENTS.map(s => ({ id: s.id, name: s.name, time: s.time, targetAmount: 1 }));

  const logsByDate = new Map<string, SupplementLog>();
  activeLogs.forEach(l => logsByDate.set(l.date, l));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 視窗從「第一筆紀錄」開始算，最長不超過 90 天，避免帳號使用初期把還沒開始用的日子也算成未達成
  let windowDays = MAX_WINDOW_DAYS;
  const logDates = activeLogs
    .map(l => new Date(l.date))
    .filter(d => !isNaN(d.getTime()));
  if (logDates.length > 0) {
    const firstLogDate = new Date(Math.min(...logDates.map(d => d.getTime())));
    firstLogDate.setHours(0, 0, 0, 0);
    const daysSinceFirst = Math.round((today.getTime() - firstLogDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    windowDays = Math.min(MAX_WINDOW_DAYS, Math.max(1, daysSinceFirst));
  }

  const windowDates: Date[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    windowDates.push(d);
  }

  const statsMap = new Map<string, ItemStat>();
  baseItems.forEach(item => statsMap.set(item.id, { id: item.id, name: item.name, expected: 0, achieved: 0, increasedDose: 0 }));

  const customCounts = new Map<string, number>();

  windowDates.forEach(dateObj => {
    const dateStr = dateObj.toLocaleDateString('en-CA');
    const log = logsByDate.get(dateStr);
    let parsedItems: Supplement[] = [];
    if (log && log.items) {
      try { parsedItems = JSON.parse(log.items); } catch (e) { parsedItems = []; }
    }

    baseItems.forEach(item => {
      if (!isScheduledDay(item.time, dateObj)) return;
      const stat = statsMap.get(item.id);
      if (!stat) return;
      stat.expected += 1;
      const entry = parsedItems.find(p => p.id === item.id);
      if (entry && entry.taken) {
        const amt = entry.amount || 1;
        const target = entry.targetAmount || item.targetAmount || 1;
        if (amt >= target) stat.achieved += 1;
        if (amt > target) stat.increasedDose += 1;
      }
    });

    parsedItems.filter(p => p.isCustom).forEach(p => {
      customCounts.set(p.name, (customCounts.get(p.name) || 0) + 1);
    });
  });

  const itemStats = Array.from(statsMap.values()).sort((a, b) => {
    const rateA = a.expected > 0 ? a.achieved / a.expected : 1;
    const rateB = b.expected > 0 ? b.achieved / b.expected : 1;
    return rateA - rateB;
  });

  const customList = Array.from(customCounts.entries()).sort((a, b) => b[1] - a[1]);

  const getRateColor = (rate: number) => {
    if (rate >= 90) return 'bg-[#e2e7e1] text-[#5b6657]';
    if (rate >= 70) return 'bg-[#fef3c7] text-[#d97706]';
    return 'bg-[#fef2f2] text-[#dc2626]';
  };

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="bg-[#fcfcfc] w-full sm:w-[440px] sm:rounded-2xl rounded-t-2xl shadow-xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-4 duration-300"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-stone-100 shrink-0">
          <h2 className="text-lg font-bold text-stone-800 flex items-center gap-2">
            <History size={20} className="text-stone-600" />
            保健食品 {windowDays} 天紀錄
          </h2>
          <button type="button" onClick={onClose} className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-500 rounded-full transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 flex flex-col">
          <p className="text-[11px] text-stone-400 mb-2">
            依達成率由低到高排序，最容易漏服的品項會排在最上面。沒有開啟 App 紀錄的日子視為未達成。
            {windowDays < MAX_WINDOW_DAYS && `（目前紀錄還未滿 ${MAX_WINDOW_DAYS} 天，統計範圍為您開始使用以來的 ${windowDays} 天）`}
          </p>

          <div className="flex flex-col">
            {itemStats.map((stat, idx) => {
              const rate = stat.expected > 0 ? Math.round((stat.achieved / stat.expected) * 100) : null;
              return (
                <div
                  key={stat.id}
                  className={`flex items-center justify-between gap-3 py-2.5 ${idx > 0 ? 'border-t border-stone-100' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-stone-700 text-sm truncate">{stat.name}</div>
                    <div className="text-[11px] text-stone-400 mt-0.5">
                      應服 {stat.expected} 天・達成 {stat.achieved} 天
                      {stat.increasedDose > 0 && `・加量 ${stat.increasedDose} 天`}
                    </div>
                  </div>
                  {rate !== null && (
                    <span className={`px-2 py-1 rounded-md font-black text-sm shrink-0 ${getRateColor(rate)}`}>
                      {rate}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {customList.length > 0 && (
            <div className="mt-3 pt-3 border-t border-stone-100">
              <div className="text-xs font-bold text-stone-500 mb-2">期間曾額外服用（非固定清單）</div>
              <div className="flex flex-wrap gap-2">
                {customList.map(([name, count]) => (
                  <span key={name} className="text-xs bg-stone-100 text-stone-600 px-2.5 py-1 rounded-full font-medium">
                    {name} × {count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  ) : null;
}

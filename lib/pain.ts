import type { PainLog, PainHistoryEntry } from './types';

export interface PainLevelOption {
  level: number;
  label: string;
  desc: string;
  badgeClass: string;
  dotClass: string;
}

export const PAIN_LEVELS: PainLevelOption[] = [
  {
    level: 5,
    label: '靜止痛',
    desc: '不動或輕壓就痛',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
    dotClass: 'bg-red-500'
  },
  {
    level: 4,
    label: '走路痛',
    desc: '日常走動即會痛',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200',
    dotClass: 'bg-orange-500'
  },
  {
    level: 3,
    label: '跑步痛',
    desc: '慢跑或運動時會痛',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    dotClass: 'bg-amber-500'
  },
  {
    level: 2,
    label: '高強度痛',
    desc: '快跑或重訓才痛',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClass: 'bg-emerald-500'
  },
  {
    level: 1,
    label: '微酸緊繃',
    desc: '無明顯痛感，微酸緊繃',
    badgeClass: 'bg-stone-100 text-stone-700 border-stone-200',
    dotClass: 'bg-stone-400'
  },
  {
    level: 0,
    label: '已無痛',
    desc: '完全恢復正常',
    badgeClass: 'bg-stone-50 text-stone-500 border-stone-200',
    dotClass: 'bg-stone-300'
  }
];

export const PRESET_TREATMENTS = [
  '休息',
  '冰敷',
  '熱敷',
  '伸展',
  '消炎藥',
  '貼布',
  '就醫',
  '按摩'
];

export const COMMON_LOCATIONS = [
  '右膝外側',
  '右膝蓋',
  '左膝蓋',
  '右腳踝',
  '左腳踝',
  '足底筋膜',
  '阿基里斯腱',
  '右小腿',
  '左小腿',
  '右髖/臀',
  '左髖/臀',
  '下背部',
  '右肩膀',
  '左肩膀'
];

export const PRESET_TRIGGERS = [
  '慢跑',
  '間歇跑',
  '長距離跑',
  '重訓',
  '久站',
  '久坐',
  '其他'
];

/**
 * 取得疼痛等級物件（若為舊版 1-10 分，進行平滑轉換）
 */
export function getPainLevel(levelOrIntensity: number | undefined): PainLevelOption {
  if (levelOrIntensity === undefined || levelOrIntensity === null) {
    return PAIN_LEVELS[2]; // 預設跑步痛 (Lv.3)
  }

  // 若值在 0~5 之間，直接對應
  if (levelOrIntensity >= 0 && levelOrIntensity <= 5) {
    const found = PAIN_LEVELS.find(p => p.level === Math.round(levelOrIntensity));
    if (found) return found;
  }

  // 舊版 1-10 分映射
  if (levelOrIntensity > 5) {
    if (levelOrIntensity >= 9) return PAIN_LEVELS[0]; // Lv.5
    if (levelOrIntensity >= 7) return PAIN_LEVELS[1]; // Lv.4
    if (levelOrIntensity >= 5) return PAIN_LEVELS[2]; // Lv.3
    if (levelOrIntensity >= 3) return PAIN_LEVELS[3]; // Lv.2
    return PAIN_LEVELS[4]; // Lv.1
  }

  return PAIN_LEVELS[2];
}

/**
 * 計算已持續天數（或從起始至康復的總天數）
 */
export function getDurationDays(startDateStr: string, endDateStr?: string): number {
  if (!startDateStr) return 1;
  const start = new Date(startDateStr);
  start.setHours(0, 0, 0, 0);

  const end = endDateStr ? new Date(endDateStr) : new Date();
  end.setHours(0, 0, 0, 0);

  const diffMs = end.getTime() - start.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, days);
}

/**
 * 格式化日期 YYYY/MM/DD
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}/${mm}/${dd}`;
  } catch {
    return dateStr;
  }
}

/**
 * 確保 PainLog 擁有 history 結構（若無則自動產生初次節點）
 */
export function ensurePainLogHistory(log: PainLog): PainHistoryEntry[] {
  if (Array.isArray(log.history) && log.history.length > 0) {
    return [...log.history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  const initialLevel = log.level ?? log.intensity ?? 3;
  const levelObj = getPainLevel(initialLevel);

  return [
    {
      id: `${log.id}-init`,
      date: log.startDate || log.date || new Date(log.lastUpdated || Date.now()).toLocaleDateString('en-CA'),
      level: levelObj.level,
      levelLabel: levelObj.label,
      treatments: log.treatments || [],
      notes: log.notes || '',
      timestamp: log.lastUpdated || Date.now()
    }
  ];
}

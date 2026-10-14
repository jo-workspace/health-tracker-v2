export interface Supplement {
  id: string;
  name: string;
  time: string;
  taken: boolean;
  amount?: number;
  targetAmount?: number;
  ignored?: boolean;
  isCustom?: boolean;
  category?: string;
  rotationGroup?: string;
}

export type ScheduleType = '每天' | '平日' | '週末' | '自訂';

export interface ParsedSchedule {
  slot: string;
  scheduleType: ScheduleType;
  customDays: number[]; // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 0=Sun
}

export const WEEKDAY_OPTIONS = [
  { day: 1, label: '一' },
  { day: 2, label: '二' },
  { day: 3, label: '三' },
  { day: 4, label: '四' },
  { day: 5, label: '五' },
  { day: 6, label: '六' },
  { day: 0, label: '日' },
];

export const TIME_SLOT_OPTIONS = ['早上起床', '隨餐', '晚餐時', '睡前'];

export const DEFAULT_CATEGORY = '其他';
/** 分類顯示順序，未列在此清單中的分類會排在最後 */
export const CATEGORY_ORDER = ['維他命', 'Mineral', '礦物質', '護眼健康', DEFAULT_CATEGORY];

/** 解析 time 字串為主要時段與頻率 */
export function parseSupplementSchedule(timeStr: string): ParsedSchedule {
  const t = timeStr || '';
  const s = t.replace(/週/g, '周');

  // 1. 判定時段 (早上起床 / 隨餐 / 晚餐時 / 睡前)
  let slot = '隨餐';
  if (s.includes('早上') || s.includes('起床')) {
    slot = '早上起床';
  } else if (s.includes('睡前')) {
    slot = '睡前';
  } else if (s.includes('晚餐')) {
    slot = '晚餐時';
  }

  // 2. 判定服用日子 (每天 / 平日 / 週末 / 自訂)
  let scheduleType: ScheduleType = '每天';
  const customDays: number[] = [];

  if (s.includes('平日') || s.includes('一~五') || s.includes('一至五') || s.includes('周一~五')) {
    scheduleType = '平日';
  } else if (s.includes('週末') || s.includes('假日') || s.includes('六日')) {
    scheduleType = '週末';
  } else if (s.includes('周') && !s.includes('每天') && !s.includes('每日')) {
    if (s.includes('一')) customDays.push(1);
    if (s.includes('二')) customDays.push(2);
    if (s.includes('三')) customDays.push(3);
    if (s.includes('四')) customDays.push(4);
    if (s.includes('五')) customDays.push(5);
    if (s.includes('六')) customDays.push(6);
    if (s.includes('日')) customDays.push(0);

    if (customDays.length > 0) {
      scheduleType = '自訂';
    }
  }

  return { slot, scheduleType, customDays };
}

/** 格式化時段與日子為標準存檔字串 */
export function formatSupplementSchedule(
  slot: string,
  scheduleType: ScheduleType,
  customDays: number[] = []
): string {
  const cleanSlot = slot || '隨餐';
  if (scheduleType === '每天') {
    return cleanSlot;
  }
  if (scheduleType === '平日') {
    return `${cleanSlot} · 周一~五`;
  }
  if (scheduleType === '週末') {
    return `${cleanSlot} · 週末`;
  }
  if (scheduleType === '自訂' && customDays.length > 0) {
    const sortOrder = [1, 2, 3, 4, 5, 6, 0];
    const sorted = sortOrder.filter(d => customDays.includes(d));
    const labelsMap: Record<number, string> = { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 0: '日' };
    const daysLabel = sorted.map(d => labelsMap[d]).join('');
    return `${cleanSlot} · 周${daysLabel}`;
  }
  return cleanSlot;
}

/** 判斷兩品項是否為互斥輪替組（預設：甘胺酸鎂 ⟷ 蘇糖酸鎂，或指定 rotationGroup） */
export function isRotationPartner(
  itemA: { id?: string; name: string; rotationGroup?: string },
  itemB: { id?: string; name: string; rotationGroup?: string }
): boolean {
  if (itemA.id && itemB.id && itemA.id === itemB.id) return false;

  // 1. 若兩者具有相同的非空 rotationGroup
  if (itemA.rotationGroup && itemB.rotationGroup && itemA.rotationGroup === itemB.rotationGroup) {
    return true;
  }

  // 2. 預設智慧互斥：甘胺酸鎂 ⟷ 蘇糖酸鎂
  const nameA = itemA.name || '';
  const nameB = itemB.name || '';
  const isGlycinateA = nameA.includes('甘胺酸鎂') || nameA === '鎂';
  const isThreonateA = nameA.includes('蘇糖酸鎂');
  const isGlycinateB = nameB.includes('甘胺酸鎂') || nameB === '鎂';
  const isThreonateB = nameB.includes('蘇糖酸鎂');

  if ((isGlycinateA && isThreonateB) || (isThreonateA && isGlycinateB)) {
    return true;
  }

  return false;
}

/** 依保健品的服用頻率文字（如「平日」「周一~五」「每天」）判斷指定日期是否為應服用日 */
export function isScheduledDay(timeStr: string, date: Date): boolean {
  const day = date.getDay();
  const s = timeStr.replace(/週/g, '周');
  let autoIgnored = false;
  if (!s.includes('每天') && !s.includes('每日')) {
    if (s.includes('平日') || s.includes('一~五') || s.includes('一至五') || s.includes('周一~五')) {
      if (day === 0 || day === 6) autoIgnored = true;
    } else if (s.includes('週末') || s.includes('假日') || s.includes('六日')) {
      if (day >= 1 && day <= 5) autoIgnored = true;
    } else if (s.includes('周')) {
      const days: number[] = [];
      if (s.includes('一')) days.push(1);
      if (s.includes('二')) days.push(2);
      if (s.includes('三')) days.push(3);
      if (s.includes('四')) days.push(4);
      if (s.includes('五')) days.push(5);
      if (s.includes('六')) days.push(6);
      if (s.includes('日')) days.push(0);
      if (days.length > 0 && !days.includes(day)) {
        autoIgnored = true;
      }
    }
  }
  return !autoIgnored;
}

/** 將保健品的服用時間（如「隨餐」「周一~五」「週一三五」）映射歸類為主要時段 (早上起床 / 隨餐 / 晚餐時) */
export function getSupplementCategorySlot(timeStr: string): string {
  const t = timeStr || '';
  if (t.includes('早上') || t.includes('起床')) return '早上起床';
  if (t.includes('晚餐') || t.includes('睡前')) return '晚餐時';
  return '隨餐';
}

export function isBedtimeSupplement(timeStr: string, name?: string): boolean {
  const t = timeStr || '';
  const n = name || '';
  if (t.includes('睡前')) return true;
  if (t.includes('晚餐') && (n.includes('鎂') || n.includes('C') || n.toLowerCase().includes('magnesium'))) return true;
  return false;
}

export const PREDEFINED_SUPPLEMENTS: Supplement[] = [
  { id: '1', name: 'Avamys', time: '早上起床', taken: false, ignored: false, category: '其他' },
  { id: '2', name: 'D3 (2000 IU)', time: '隨餐', taken: false, ignored: false, category: '維他命' },
  { id: '3', name: '鋅', time: '隨餐', taken: false, ignored: false, category: 'Mineral' },
  { id: '4', name: '鐵', time: '隨餐', taken: false, ignored: false, category: 'Mineral' },
  { id: '5', name: 'Q10', time: '隨餐', taken: false, ignored: false, category: '其他' },
  { id: '6', name: 'PQQ', time: '隨餐', taken: false, ignored: false, category: '其他' },
  { id: '7', name: '魚油', time: '周一~五', taken: false, ignored: false, category: '其他' },
  { id: '8', name: '葉黃素', time: '周一~五', taken: false, ignored: false, category: '護眼健康' },
  { id: '9', name: '甘胺酸鎂', time: '睡前', taken: false, ignored: false, category: 'Mineral' },
  { id: '10', name: '維他命 C', time: '晚餐時', taken: false, ignored: false, category: '維他命' },
  { id: '11', name: '蘇糖酸鎂', time: '睡前', taken: false, ignored: false, category: 'Mineral' },
];

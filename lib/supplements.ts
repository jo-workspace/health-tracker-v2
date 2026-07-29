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
}

export const DEFAULT_CATEGORY = '其他';
/** 分類顯示順序，未列在此清單中的分類會排在最後 */
export const CATEGORY_ORDER = ['維他命', '礦物質', '護眼健康', DEFAULT_CATEGORY];

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

export const PREDEFINED_SUPPLEMENTS: Supplement[] = [
  { id: '1', name: 'Avamys', time: '早上起床', taken: false, ignored: false, category: '其他' },
  { id: '2', name: 'D3 (2000 IU)', time: '隨餐', taken: false, ignored: false, category: '維他命' },
  { id: '3', name: '鋅', time: '隨餐', taken: false, ignored: false, category: '礦物質' },
  { id: '4', name: '鐵', time: '隨餐', taken: false, ignored: false, category: '礦物質' },
  { id: '5', name: 'Q10', time: '隨餐', taken: false, ignored: false, category: '其他' },
  { id: '6', name: 'PQQ', time: '隨餐', taken: false, ignored: false, category: '其他' },
  { id: '7', name: '魚油', time: '周一~五', taken: false, ignored: false, category: '其他' },
  { id: '8', name: '葉黃素', time: '周一~五', taken: false, ignored: false, category: '護眼健康' },
  { id: '9', name: '鎂', time: '晚餐時', taken: false, ignored: false, category: '礦物質' },
  { id: '10', name: '維他命 C', time: '晚餐時', taken: false, ignored: false, category: '維他命' },
];

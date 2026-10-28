export interface ParsedBedtime {
  hour12: number;
  minute: number;
  period: 'AM' | 'PM';
  hour24: number;
}

export function parseBedtimeParts(timeStr?: string): ParsedBedtime | null {
  if (!timeStr || !timeStr.trim() || timeStr === '-') return null;
  const trimmed = timeStr.trim();

  // 判定是否包含 PM / 下午 / 晚上 或 AM / 上午 / 凌晨 關鍵字
  const isPM = /pm|下午|晚上|傍晚|夜間/i.test(trimmed);
  const isAM = /am|上午|凌晨|早上|清晨/i.test(trimmed);

  // 抓取時間數字符號，支援 HH:mm 或 HH:mm:ss（例："10:01", "22:01:00", "下午 10:01"）
  const match = trimmed.match(/(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (!match) return null;

  const rawH = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (isNaN(rawH) || isNaN(m) || m < 0 || m > 59) return null;

  let hour24: number;
  let hour12: number;
  let period: 'AM' | 'PM';

  if (isPM) {
    period = 'PM';
    hour24 = rawH === 12 ? 12 : rawH < 12 ? rawH + 12 : rawH;
    hour12 = rawH === 0 ? 12 : rawH > 12 ? rawH - 12 : rawH;
  } else if (isAM) {
    period = 'AM';
    hour24 = rawH === 12 ? 0 : rawH;
    hour12 = rawH === 0 ? 12 : rawH > 12 ? rawH - 12 : rawH;
  } else {
    // 無明確 AM/PM 標記（如純 24 小時制 "22:01" 或 "00:15"）
    if (rawH >= 13 && rawH <= 23) {
      period = 'PM';
      hour24 = rawH;
      hour12 = rawH - 12;
    } else if (rawH === 0) {
      period = 'AM';
      hour24 = 0;
      hour12 = 12;
    } else if (rawH === 12) {
      period = 'PM';
      hour24 = 12;
      hour12 = 12;
    } else if (rawH >= 1 && rawH <= 5) {
      // 凌晨 1 ~ 5 點入睡
      period = 'AM';
      hour24 = rawH;
      hour12 = rawH;
    } else {
      // 6 ~ 11 點夜間就寢習慣，無標示時預設視為晚間 PM
      period = 'PM';
      hour24 = rawH + 12;
      hour12 = rawH;
    }
  }

  if (hour24 < 0 || hour24 > 23) return null;

  return { hour12, minute: m, period, hour24 };
}

export function formatTo12Hour(timeStr?: string): string {
  if (!timeStr || !timeStr.trim() || timeStr === '-') return '-';
  const parsed = parseBedtimeParts(timeStr);
  if (!parsed) return timeStr;
  const m = String(parsed.minute).padStart(2, '0');
  return `${parsed.hour12}:${m} ${parsed.period}`;
}

export function isBefore1030PM(timeStr?: string): boolean {
  if (!timeStr || !timeStr.trim() || timeStr === '-') return false;
  const parsed = parseBedtimeParts(timeStr);
  if (!parsed) return false;

  const { hour24, minute } = parsed;

  // 傍晚 18:00 (6 PM) 至 22:30 (10:30 PM) 為早睡達標區間
  // 例如 21:50, 22:01, 22:30 皆為 true
  // 22:31, 23:00, 00:30 (凌晨), 01:00 皆為 false
  if (hour24 >= 18 && hour24 < 22) return true;
  if (hour24 === 22 && minute <= 30) return true;

  return false;
}

export const DEFAULT_EXPIRES_AT = process.env.GARMIN_API_KEY_EXPIRES_AT || '2027-11-19';

export function getTaipeiDateStr(offsetDays = 0): string {
  const now = new Date(Date.now() + offsetDays * 86400 * 1000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function getMondayOfCurrentWeekTaipei(todayStr: string): string {
  const [y, m, d] = todayStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  dt.setUTCDate(dt.getUTCDate() + diff);
  return dt.toISOString().slice(0, 10);
}

export function computeExpiryInfo(expiresAtStr: string): {
  expiresAt: string;
  daysUntilExpiry: number;
  isExpiringSoon: boolean;
} {
  const cleanDate = expiresAtStr.trim() || DEFAULT_EXPIRES_AT;
  const todayStr = getTaipeiDateStr(0);
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const [ey, em, ed] = cleanDate.split('-').map(Number);

  const todayMs = Date.UTC(ty, (tm || 1) - 1, td || 1);
  const expMs = Date.UTC(ey || 2027, (em || 11) - 1, ed || 19);
  const daysUntilExpiry = Math.round((expMs - todayMs) / (1000 * 60 * 60 * 24));

  return {
    expiresAt: cleanDate,
    daysUntilExpiry,
    isExpiringSoon: daysUntilExpiry <= 14,
  };
}

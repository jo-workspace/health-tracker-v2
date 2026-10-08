export function formatTo12Hour(timeStr?: string): string {
  if (!timeStr || timeStr.trim() === '' || timeStr === '-') return '-';
  const trimmed = timeStr.trim();
  if (/(am|pm)$/i.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return timeStr;
  const h = parseInt(match[1], 10);
  const m = match[2];
  if (isNaN(h)) return timeStr;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${period}`;
}

export function isBefore1030PM(timeStr?: string): boolean {
  if (!timeStr || !timeStr.trim() || timeStr === '-') return false;
  const trimmed = timeStr.trim();

  // 12 小時制 (例如 "10:15 PM", "9:30 PM", "12:15 AM", "1:30 AM")
  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (ampmMatch) {
    const rawH = parseInt(ampmMatch[1], 10);
    const m = parseInt(ampmMatch[2], 10);
    const period = ampmMatch[3].toUpperCase();
    if (isNaN(rawH) || isNaN(m)) return false;

    // 凌晨/上午跨夜入睡 (12:00 AM - 11:59 AM) -> 不符合 10:30 PM 前
    if (period === 'AM') return false;

    // 12:xx PM 為正午，非夜間就寢
    if (rawH === 12) return false;

    // 傍晚 18:00 (6 PM) 至 22:30 (10:30 PM) 為早睡達標區間
    if (rawH >= 6 && rawH < 10) return true;
    if (rawH === 10 && m <= 30) return true;
    return false;
  }

  // 24 小時制 (例如 "22:15", "22:30", "23:45", "00:15", "01:30")
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const h = parseInt(match24[1], 10);
    const m = parseInt(match24[2], 10);
    if (isNaN(h) || isNaN(m)) return false;

    if (h >= 18 && h < 22) return true;
    if (h === 22 && m <= 30) return true;
    return false;
  }

  return false;
}

export const GREGORIAN_MONTHS_HE: string[] = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
];

/** חודש לועזי בעברית עם מספר חודש (1–12), למשל `10/ אוקטובר 2026`. */
export function formatGregorianMonthYearHebrew(date: Date): string {
  const monthIndex = date.getMonth();
  const monthNum = monthIndex + 1;
  const m = GREGORIAN_MONTHS_HE[monthIndex] ?? '';
  return `${monthNum}/ ${m} ${date.getFullYear()}`.trim();
}


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
]

/** חודש לועזי בעברית (ללא מספר חודש), למשל `אוקטובר 2026`. */
export function formatGregorianMonthYearHebrew(date: Date): string {
  const monthIndex = date.getMonth()
  const m = GREGORIAN_MONTHS_HE[monthIndex] ?? ''
  return `${m} ${date.getFullYear()}`.trim()
}

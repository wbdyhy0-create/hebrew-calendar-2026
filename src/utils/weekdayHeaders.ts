export type WeekdayHeaderMode = 'shortLetter' | 'fullName';

/** RTL column order: שבת … א׳ (ימין → שמאל) */
export function getWeekdayHeaderLabels(mode: string | undefined): string[] {
  if (mode === 'fullName') {
    return ['שבת', 'שישי', 'חמישי', 'רביעי', 'שלישי', 'שני', 'ראשון'];
  }
  return ['שבת', 'ו׳', 'ה׳', 'ד׳', 'ג׳', 'ב׳', 'א׳'];
}

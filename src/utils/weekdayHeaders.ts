export type WeekdayHeaderMode = 'shortLetter' | 'fullName';

/** LTR column order: א׳ … שבת (שמאל → ימין) */
export function getWeekdayHeaderLabels(mode: string | undefined): string[] {
  if (mode === 'fullName') {
    return ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  }
  return ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'שבת'];
}

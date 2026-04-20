import {
  addDays,
  endOfMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

import { civilGregorianDateParts } from './hebrewDate';

export type CalendarWeek = Date[]; // always length 7

export function getMonthGridWeeks(monthDate: Date): CalendarWeek[] {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
  // Important: do NOT extend into the next month for padding.
  // We only pad from the previous month at the start, then fill the current month,
  // then pad with days after month end; the renderer shows any day not in the viewed
  // Gregorian month as an empty gray cell (same as leading days from the prior month).
  // across month pages.
  let gridEnd = monthEnd;

  const weeks: CalendarWeek[] = [];
  let cursor = gridStart;

  // Pad the final week with empty cells (no next-month dates) by extending the grid
  // to a full multiple of 7 days. The UI/PDF renderer should treat out-of-range dates
  // after monthEnd as visually empty.
  const totalDaysInclusive =
    Math.floor((gridEnd.getTime() - gridStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const remainder = totalDaysInclusive % 7;
  if (remainder !== 0) {
    gridEnd = addDays(gridEnd, 7 - remainder);
  }

  while (cursor <= gridEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(
        civilGregorianDateParts(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()),
      );
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }

  return weeks;
}

/**
 * Flat list of all grid days (previous/current/next month padding included),
 * returned in the same rendering order used by the UI (Sat->Sun per week)
 * so it can be directly mapped in a CSS grid with `dir="rtl"`.
 */
export function getMonthGridDaysFlat(monthDate: Date): Date[] {
  const weeks = getMonthGridWeeks(monthDate);
  const days: Date[] = [];
  for (const week of weeks) {
    // With `dir="rtl"`, the first rendered item appears in the rightmost column.
    // To keep Sat on the right, we render each week in reverse: Sat -> Sun.
    for (const g of [...week].reverse()) days.push(g);
  }
  return days;
}


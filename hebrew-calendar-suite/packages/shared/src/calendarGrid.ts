import { addDays, endOfMonth, startOfMonth, startOfWeek } from 'date-fns'

import { civilGregorianDateParts } from './hebrewDate'

export type CalendarWeek = Date[] // always length 7

export function getMonthGridWeeks(monthDate: Date): CalendarWeek[] {
  const monthStart = startOfMonth(monthDate)
  const monthEnd = endOfMonth(monthDate)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 }) // Sunday
  let gridEnd = monthEnd

  const weeks: CalendarWeek[] = []
  let cursor = gridStart

  const totalDaysInclusive =
    Math.floor((gridEnd.getTime() - gridStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
  const remainder = totalDaysInclusive % 7
  if (remainder !== 0) gridEnd = addDays(gridEnd, 7 - remainder)

  while (cursor <= gridEnd) {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) {
      week.push(civilGregorianDateParts(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()))
      cursor = addDays(cursor, 1)
    }
    weeks.push(week)
  }

  return weeks
}

export function getMonthGridDaysFlat(monthDate: Date): Date[] {
  const weeks = getMonthGridWeeks(monthDate)
  const days: Date[] = []
  for (const week of weeks) for (const g of week) days.push(g)
  return days
}


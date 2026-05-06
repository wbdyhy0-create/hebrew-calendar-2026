import { flags, HebrewCalendar, Location } from '@hebcal/core'

import { formatYmdJerusalem } from './hebrewDate'

const ASIA_JERUSALEM = 'Asia/Jerusalem'

export const ZMANIM_LOCATION_JERUSALEM = new Location(
  31.7683,
  35.2137,
  true,
  ASIA_JERUSALEM,
  'ירושלים',
  'IL',
  undefined,
  780,
)

export const ZMANIM_LOCATION_TEL_AVIV = new Location(
  32.0853,
  34.7818,
  true,
  ASIA_JERUSALEM,
  'תל אביב',
  'IL',
  undefined,
  0,
)

export type DayEvents = {
  titles: string[]
  candleLighting?: string
  havdalah?: string
  fastBegins?: string
  fastEnds?: string
  fastNameHe?: string
  parshaHe?: string
}

function hasLatin(s: string) {
  return /[A-Za-z]/.test(s)
}

function isBareYearLine(s: string) {
  return /^\d{4}$/.test(String(s ?? '').trim())
}

export function getDayEventsByGregorianDate(
  start: Date,
  end: Date,
  opts?: {
    il?: boolean
    location?: 'Jerusalem' | 'TelAviv'
    havdalahMins?: number
    candleLightingMins?: number
  },
): Map<string, DayEvents> {
  const il = opts?.il ?? true
  const location =
    opts?.location === 'TelAviv' ? ZMANIM_LOCATION_TEL_AVIV : ZMANIM_LOCATION_JERUSALEM

  const events = HebrewCalendar.calendar({
    start,
    end,
    isHebrewYear: false,
    noHolidays: false,
    noRoshChodesh: false,
    il,
    locale: 'he',
    candlelighting: true,
    location,
    useElevation: true,
    sedrot: true,
    omer: true,
    havdalahMins: typeof opts?.havdalahMins === 'number' ? opts.havdalahMins : undefined,
    candleLightingMins:
      typeof opts?.candleLightingMins === 'number' ? opts.candleLightingMins : undefined,
  })

  const byDay = new Map<string, DayEvents>()

  for (const ev of events) {
    const g = ev.getDate().greg()
    const key = formatYmdJerusalem(g)
    const existing = byDay.get(key) ?? { titles: [] }

    const desc = ev.getDesc()
    const eventTimeStr = (ev as any).eventTimeStr as string | undefined

    if (desc === 'Candle lighting' || desc.startsWith('Candle lighting')) {
      existing.candleLighting = eventTimeStr ?? existing.candleLighting
    } else if (desc === 'Havdalah' || desc.startsWith('Havdalah')) {
      existing.havdalah = eventTimeStr ?? existing.havdalah
    } else if (desc === 'Fast begins') {
      existing.fastBegins = eventTimeStr ?? existing.fastBegins
    } else if (desc === 'Fast ends') {
      existing.fastEnds = eventTimeStr ?? existing.fastEnds
    } else {
      const mask = ev.getFlags?.() ?? 0
      const title = String(ev.render('he') ?? '').trim()

      const isParsha = (mask & flags.PARSHA_HASHAVUA) !== 0
      if (isParsha) {
        if (title && !hasLatin(title)) existing.parshaHe = title
        byDay.set(key, existing)
        continue
      }

      const isOmer = (mask & flags.OMER_COUNT) !== 0
      if (isOmer) {
        byDay.set(key, existing)
        continue
      }

      const isFastDay = (mask & (flags.MINOR_FAST | flags.MAJOR_FAST)) !== 0
      if (isFastDay && title && !existing.fastNameHe && !hasLatin(title)) existing.fastNameHe = title

      if (!title || hasLatin(title) || isBareYearLine(title)) {
        byDay.set(key, existing)
        continue
      }

      if (!existing.titles.includes(title)) existing.titles.push(title)
    }

    byDay.set(key, existing)
  }

  return byDay
}


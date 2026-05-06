import { HDate } from '@hebcal/core'

import { civilDateToUtcNoonStable } from './hebrewDate'

export type HebrewHeader = {
  hebrewMonth: string
  hebrewYearGematriya: string
}

const HEBREW_GEMATRIYA_YEAR_RE = /^[אבגדהוזחטיכלמנסעפצקרשת׳״״]+$/

function hebrewMonthYearFromHDate(hd: HDate): { month: string; year: string } {
  const parts = hd.renderGematriya(true, false).split(' ').filter(Boolean)
  if (parts.length < 2) return { month: '', year: '' }

  const last = parts[parts.length - 1] ?? ''
  const hasYear = HEBREW_GEMATRIYA_YEAR_RE.test(last)
  const year = hasYear ? last : ''
  const monthTokens = hasYear ? parts.slice(1, -1) : parts.slice(1)
  const month = monthTokens.join(' ').trim()
  return { month, year }
}

export function getHebrewHeaderForGregorianMonth(monthDate: Date): HebrewHeader {
  const y = monthDate.getFullYear()
  const m = monthDate.getMonth()
  const start = civilDateToUtcNoonStable(new Date(y, m, 1))
  const end = civilDateToUtcNoonStable(new Date(y, m + 1, 0))

  const s = hebrewMonthYearFromHDate(new HDate(start))
  const e = hebrewMonthYearFromHDate(new HDate(end))

  if (s.month === e.month && s.year === e.year) {
    return { hebrewMonth: s.month, hebrewYearGematriya: s.year }
  }

  if (s.year === e.year) {
    return { hebrewMonth: `${s.month} / ${e.month}`, hebrewYearGematriya: s.year || e.year }
  }

  return {
    hebrewMonth: `${s.month} ${s.year} / ${e.month} ${e.year}`.trim(),
    hebrewYearGematriya: '',
  }
}

export function formatHebrewHeaderText(h: HebrewHeader): string {
  const y = h.hebrewYearGematriya?.trim()
  const m = h.hebrewMonth?.trim()
  if (!m) return ''
  if (!y) return m
  return `${m} ${y}`.trim()
}


export type DayTextOverride = {
  centerLines: string[]
  centerOffsetX?: number
  centerOffsetY?: number
  centerAlign?: 'right' | 'center' | 'left'
  imageDataUrl?: string
  imageFit?: 'cover' | 'contain'
  imageOpacity?: number
  imageOffsetX?: number
  imageOffsetY?: number
}

export type OverridesMap = Record<string, DayTextOverride>

const ISO_FULL_KEY = /^\d{4}-\d{2}-\d{2}$/
const MM_DD_KEY = /^\d{2}-\d{2}$/

function toMmDdFromIsoYmd(isoYmd: string): string | null {
  const m = String(isoYmd ?? '')
    .trim()
    .match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!m) return null
  const mm = String(Number(m[2])).padStart(2, '0')
  const dd = String(Number(m[3])).padStart(2, '0')
  return `${mm}-${dd}`
}

/** מפתח חוזר מדי שנה ב־overrides (MM-DD) מתאריך yyyy-MM-dd (ירושלים אזרחי). */
export function recurringDayKeyFromIsoYmd(isoYmd: string): string | null {
  return toMmDdFromIsoYmd(isoYmd)
}

/** True when the user saved an override that intentionally shows no centered lines (hides auto holiday text). */
export function isCenterContentSuppressedByOverride(ovr: DayTextOverride | undefined): boolean {
  if (!ovr) return false
  const lines = ovr.centerLines ?? []
  if (lines.length === 0) return true
  return lines.every((l) => !String(l).trim())
}

export function resolveDayTextOverride(
  map: OverridesMap | undefined,
  isoYmd: string,
): DayTextOverride | undefined {
  if (!map) return undefined
  const md = toMmDdFromIsoYmd(isoYmd)
  if (md) return map[md] ?? map[isoYmd]
  if (MM_DD_KEY.test(isoYmd)) return map[isoYmd]
  return map[isoYmd]
}

export function normalizeOverridesMapToRecurring(map: OverridesMap): OverridesMap {
  const out: OverridesMap = {}
  for (const [k, v] of Object.entries(map ?? {})) {
    if (MM_DD_KEY.test(k)) out[k] = v
    else if (!ISO_FULL_KEY.test(k)) out[k] = v
  }
  for (const [k, v] of Object.entries(map ?? {})) {
    const md = toMmDdFromIsoYmd(k)
    if (!md) continue
    if (out[md] === undefined) out[md] = v
  }
  return out
}


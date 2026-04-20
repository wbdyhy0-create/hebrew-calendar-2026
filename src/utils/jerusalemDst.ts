import { formatYmdJerusalem } from './hebrewDate';

const JERUSALEM = 'Asia/Jerusalem';

const offsetPartsFormatter =
  typeof Intl !== 'undefined'
    ? new Intl.DateTimeFormat('en-US', {
        timeZone: JERUSALEM,
        timeZoneName: 'longOffset',
      })
    : null;

const shortTzFormatter =
  typeof Intl !== 'undefined'
    ? new Intl.DateTimeFormat('en-US', {
        timeZone: JERUSALEM,
        timeZoneName: 'shortGeneric',
      })
    : null;

/** Minutes east of UTC (e.g. +120, +180 for Israel standard / daylight). */
export function jerusalemOffsetMinutesEastOfUtc(at: Date): number {
  if (offsetPartsFormatter) {
    const raw = offsetPartsFormatter.formatToParts(at).find((p) => p.type === 'timeZoneName')?.value ?? '';
    const m = raw.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/i);
    if (m) {
      const sign = m[1] === '-' ? -1 : 1;
      const hh = Number(m[2]);
      const mm = m[3] != null && m[3] !== '' ? Number(m[3]) : 0;
      if (Number.isFinite(hh) && Number.isFinite(mm)) {
        return sign * (hh * 60 + mm);
      }
    }
  }
  if (shortTzFormatter) {
    const s = shortTzFormatter.formatToParts(at).find((p) => p.type === 'timeZoneName')?.value ?? '';
    if (/IDT|GMT\+3/i.test(s)) return 180;
    if (/IST|GMT\+2/i.test(s)) return 120;
  }
  return 120;
}

function parseYmd(ymd: string): [number, number, number] | null {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (![y, mo, d].every((n) => Number.isFinite(n))) return null;
  return [y, mo, d];
}

/** First UTC ms that falls on Jerusalem civil date `ymd`. */
function firstMsOfJerusalemYmd(ymd: string): number {
  const parts = parseYmd(ymd);
  if (!parts) return NaN;
  const [y, mo, d] = parts;
  let best = NaN;
  for (let dayOff = -2; dayOff <= 2; dayOff++) {
    for (let h = 0; h < 24; h++) {
      const cand = Date.UTC(y, mo - 1, d + dayOff, h, 0, 0);
      if (formatYmdJerusalem(new Date(cand)) === ymd) {
        if (!Number.isFinite(best) || cand < best) best = cand;
      }
    }
  }
  if (!Number.isFinite(best)) return Date.UTC(y, mo - 1, d, 12, 0, 0);
  let t = best;
  while (t > 0) {
    const prev = t - 3600000;
    if (formatYmdJerusalem(new Date(prev)) !== ymd) break;
    t = prev;
  }
  while (t > 0) {
    const prev = t - 60000;
    if (formatYmdJerusalem(new Date(prev)) !== ymd) break;
    t = prev;
  }
  return t;
}

/** Last UTC ms still on Jerusalem civil date `ymd` (inclusive). */
function lastMsOfJerusalemYmd(ymd: string, tStart: number): number {
  let t = tStart;
  for (let step = 0; step < 30; step++) {
    const cand = t + 3600000;
    if (formatYmdJerusalem(new Date(cand)) !== ymd) break;
    t = cand;
  }
  while (formatYmdJerusalem(new Date(t + 60000)) === ymd) t += 60000;
  return t;
}

export type JerusalemDstTransitionKind = 'to_summer' | 'to_winter';

export function getJerusalemDstTransitionKind(ymd: string): JerusalemDstTransitionKind | null {
  const t0 = firstMsOfJerusalemYmd(ymd);
  if (!Number.isFinite(t0)) return null;
  const t1 = lastMsOfJerusalemYmd(ymd, t0);
  const offs: number[] = [];
  for (let u = t0; u <= t1; u += 30 * 60 * 1000) {
    offs.push(jerusalemOffsetMinutesEastOfUtc(new Date(u)));
  }
  if (offs.length === 0) return null;
  const min = Math.min(...offs);
  const max = Math.max(...offs);
  if (min === max) return null;
  const first = offs[0]!;
  const last = offs[offs.length - 1]!;
  if (last > first) return 'to_summer';
  if (last < first) return 'to_winter';
  return null;
}

/**
 * Hebrew notice for the Jerusalem civil day when clocks change (per IANA `Asia/Jerusalem`).
 * Hebcal candle / fast wall times already follow this zone — no separate time math is required.
 */
export function getJerusalemDstTransitionLabel(ymd: string): string | null {
  const kind = getJerusalemDstTransitionKind(ymd);
  if (!kind) return null;
  if (kind === 'to_summer') {
    return 'מעבר לשעון קיץ — השעה מואחרת (02:00→03:00, שעון ישראל)';
  }
  return 'מעבר לשעון חורף — השעה מוקדמת (02:00→01:00, שעון ישראל)';
}

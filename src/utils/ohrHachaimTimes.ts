import { formatYmdJerusalem } from './hebrewDate';

export type OhrCityKey = 'Jerusalem' | 'TelAviv';

type DayTimes = { candleLighting?: string; havdalah?: string };
type TimesByDateKey = Record<string, DayTimes>; // yyyy-MM-dd

const STORAGE_KEY = 'hebrew-gregorian-calendar:ohr-hachaim-times:v2';

type CacheShape = Partial<Record<OhrCityKey, Partial<Record<number, TimesByDateKey>>>>;

function loadCache(): CacheShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CacheShape;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveCache(c: CacheShape) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  } catch {
    // ignore
  }
}

function parseDatePair(text: string): { start: Date; end: Date } | null {
  const s = text.replace(/\s+/g, '').trim();
  // Pattern: 17-18/4/2026 or 2-3/1/2026
  let m = s.match(/^(\d{1,2})-(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d1 = Number(m[1]);
    const d2 = Number(m[2]);
    const mo = Number(m[3]);
    const y = Number(m[4]);
    if ([d1, d2, mo, y].some((n) => !Number.isFinite(n))) return null;
    return { start: new Date(y, mo - 1, d1), end: new Date(y, mo - 1, d2) };
  }

  // Pattern: 31/7-1/8/2026
  m = s.match(/^(\d{1,2})\/(\d{1,2})-(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d1 = Number(m[1]);
    const m1 = Number(m[2]);
    const d2 = Number(m[3]);
    const m2 = Number(m[4]);
    const y = Number(m[5]);
    if ([d1, m1, d2, m2, y].some((n) => !Number.isFinite(n))) return null;
    return { start: new Date(y, m1 - 1, d1), end: new Date(y, m2 - 1, d2) };
  }
  return null;
}

function cityTo2netParam(city: OhrCityKey): string {
  return city === 'Jerusalem' ? 'ירושלים' : 'תל אביב';
}

function normalizeTime(t: string): string | undefined {
  const s = (t ?? '').trim();
  if (!s) return undefined;
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return undefined;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return undefined;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return undefined;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function addMinutesToHHMM(hhmm: string, minutesToAdd: number): string {
  const m = (hhmm ?? '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return hhmm;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return hhmm;
  const total = hh * 60 + mm + minutesToAdd;
  const wrapped = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);
  const outH = Math.floor(wrapped / 60);
  const outM = wrapped % 60;
  return `${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}`;
}

function extractTimesFrom2netHtml(html: string, year: number): TimesByDateKey {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const tables = Array.from(doc.querySelectorAll('table'));
  const result: TimesByDateKey = {};

  for (const table of tables) {
    const rows = Array.from(table.querySelectorAll('tr'));
    if (rows.length < 2) continue;

    // Look for header row containing the entry/exit columns.
    const headerText = rows[0]?.textContent ?? '';
    if (!headerText.includes('כניסת') || !headerText.includes('יציאת')) continue;

    for (const tr of rows.slice(1)) {
      const tds = Array.from(tr.querySelectorAll('td'));
      if (tds.length < 5) continue;
      const gregText = (tds[1]?.textContent ?? '').trim();
      const entry = normalizeTime(tds[3]?.textContent ?? '');
      const exit = normalizeTime(tds[4]?.textContent ?? '');
      const pair = parseDatePair(gregText);
      if (!pair) continue;

      // Only accept rows that belong to requested Gregorian year (start date year).
      if (pair.start.getFullYear() !== year && pair.end.getFullYear() !== year) continue;

      const kStart = formatYmdJerusalem(pair.start);
      const kEnd = formatYmdJerusalem(pair.end);
      if (entry) result[kStart] = { ...(result[kStart] ?? {}), candleLighting: entry };
      if (exit) result[kEnd] = { ...(result[kEnd] ?? {}), havdalah: exit };
    }

    // First matching table is enough.
    if (Object.keys(result).length > 10) break;
  }

  return result;
}

export function getCachedOhrHachaimTimes(city: OhrCityKey, year: number): TimesByDateKey | null {
  const cache = loadCache();
  const byCity = cache[city];
  const byYear = byCity?.[year];
  return byYear ?? null;
}

export function getOhrHachaimOverrideForDate(
  city: OhrCityKey,
  year: number,
  dateKeyYmd: string,
): DayTimes | undefined {
  const byYear = getCachedOhrHachaimTimes(city, year);
  return byYear ? byYear[dateKeyYmd] : undefined;
}

export async function ensureOhrHachaimYearCached(city: OhrCityKey, year: number): Promise<void> {
  const existing = getCachedOhrHachaimTimes(city, year);
  if (existing && Object.keys(existing).length > 50) return;

  const cityParam = encodeURIComponent(cityTo2netParam(city));
  const directUrl = `https://calendar.2net.co.il/parasha.aspx?city=${cityParam}&year=${year}&methodid=3`;

  async function fetchTextWithFallback(u: string): Promise<string> {
    const r = await fetch(u, { method: 'GET' });
    if (!r.ok) throw new Error(`fetch failed: ${r.status}`);
    return await r.text();
  }

  let html: string | undefined;
  try {
    // Some hosts block CORS; try direct first.
    html = await fetchTextWithFallback(directUrl);
  } catch {
    // Fallback through a public HTML proxy that sends permissive CORS headers.
    // r.jina.ai returns the upstream HTML as plain text.
    const proxied = `https://r.jina.ai/${directUrl}`;
    html = await fetchTextWithFallback(proxied);
  }

  const extracted = extractTimesFrom2netHtml(html, year);

  const cache = loadCache();
  const byCity = (cache[city] ?? {}) as Partial<Record<number, TimesByDateKey>>;
  byCity[year] = extracted;
  cache[city] = byCity;
  saveCache(cache);
}


import { flags, HDate, HebrewCalendar, Location, months, Zmanim } from '@hebcal/core';

const ASIA_JERUSALEM = 'Asia/Jerusalem';

/**
 * חישוב זמנים כפול לפי @hebcal/core — קואורדינטות וגובה לכל עיר בנפרד.
 * חובה `useElevation: true` ב־`HebrewCalendar.calendar` כדי שגובה ירושלים ישפיע על שקיעה (אחרת Hebcal משתמש בשקיעה בגובה פני הים).
 */
export const ZMANIM_LOCATION_JERUSALEM = new Location(
  31.7683,
  35.2137,
  true,
  ASIA_JERUSALEM,
  'ירושלים',
  'IL',
  undefined,
  780,
);

export const ZMANIM_LOCATION_TEL_AVIV = new Location(
  32.0853,
  34.7818,
  true,
  ASIA_JERUSALEM,
  'תל אביב',
  'IL',
  undefined,
  0,
);

/** מפתח yyyy-MM-dd (ירושלים אזרחי) → תאריך ל־Zmanim (שעות מתעלמות). */
function jerusalemYmdKeyToGregDate(key: string): Date | null {
  const m = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  if (![y, mo, da].every((n) => Number.isFinite(n))) return null;
  return new Date(Date.UTC(y, mo - 1, da, 12, 0, 0, 0));
}

/**
 * מחליף את שעת «יציאת צום» (Fast ends) ל־שקיעה + דקות — רק לצומות רגילים, לא יום כיפור.
 * שבת ויום כיפור נשארים ב־Havdalah עם havdalahMins נפרד.
 */
function applyFastEndsSunsetMinutesForStandardFasts(
  byDay: Map<string, DayEvents>,
  location: Location,
  offsetMins: number,
) {
  const mins = Math.min(45, Math.max(15, Math.round(Number(offsetMins) || 25)));
  const useElev = true;
  const tf = location.getTimeFormatter();

  for (const [key, rec] of byDay) {
    if (!rec.fastEnds) continue;
    if (isYomKippurHolidayTitleHe(rec.titles)) continue;
    const day = jerusalemYmdKeyToGregDate(key);
    if (!day) continue;
    try {
      const z = new Zmanim(location, day, useElev);
      const t = z.sunsetOffset(mins, true);
      if (isNaN(t.getTime())) continue;
      rec.fastEnds = Zmanim.formatTime(Zmanim.roundTime(t), tf);
      byDay.set(key, rec);
    } catch {
      // ignore bad dates / polar edge cases
    }
  }
}

/**
 * Treat a JS `Date` as an instant and map it to the **Israel civil** Gregorian calendar day,
 * then pin to **UTC noon** of that (y, m, d) tuple.
 *
 * Hebcal's `HDate.greg()` is anchored to midnight in Israel; using `getFullYear()/getMonth()/getDate()`
 * in the **process** timezone (e.g. `TZ=UTC`) shifts Sukkot / הושענא רבה / שמיני עצרת one day off
 * when building event keys. We therefore read the calendar day in `Asia/Jerusalem` via `Intl`.
 */
function civilDateToUtcNoon(d: Date): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ASIA_JERUSALEM,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(d);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month1 = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  if (!Number.isFinite(year) || !Number.isFinite(month1) || !Number.isFinite(day)) {
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0));
  }
  return new Date(Date.UTC(year, month1 - 1, day, 12, 0, 0, 0));
}

/**
 * Stable `Date` for a **local civil** Gregorian day (browser calendar). Use for grid cells
 * so event keys and Hebrew dates never drift across OS timezones.
 */
export function civilGregorianDateParts(year: number, monthIndex: number, day: number): Date {
  return civilDateToUtcNoon(new Date(year, monthIndex, day));
}

/**
 * Gregorian `yyyy-MM-dd` for the **Israel civil** date of an instant.
 * Hebcal's `HDate.greg()` is anchored to this calendar; using the browser's local
 * `format(date, 'yyyy-MM-dd')` can shift holidays (e.g. שבת חזון) one column in diaspora TZ.
 */
export function formatYmdJerusalem(d: Date): string {
  const stable = civilDateToUtcNoon(d);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ASIA_JERUSALEM,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(stable);
}

/** Today's date as `yyyy-MM-dd` in Jerusalem civil time (matches cell keys from `formatYmdJerusalem`). */
export function formatTodayYmdJerusalem(): string {
  return formatYmdJerusalem(civilDateToUtcNoon(new Date()));
}

/**
 * Israel civil Gregorian month (1–12) and day (1–31) for `d`, matching `formatYmdJerusalem` / cell keys.
 * Uses the UTC fields of `civilDateToUtcNoon(d)` (that instant encodes the Israel calendar tuple).
 */
export function getGregorianDayMonthJerusalem(d: Date): { month: number; day: number } {
  const stable = civilDateToUtcNoon(d);
  return { month: stable.getUTCMonth() + 1, day: stable.getUTCDate() };
}

/** Add `delta` Israel civil days (month/year rollover via `Date.UTC`). */
export function addJerusalemCivilDays(d: Date, delta: number): Date {
  const stable = civilDateToUtcNoon(d);
  return new Date(
    Date.UTC(stable.getUTCFullYear(), stable.getUTCMonth(), stable.getUTCDate() + delta, 12, 0, 0, 0),
  );
}

/** 0 = Sunday … 6 = Saturday, by Jerusalem civil date (not `Date#getDay()` in local TZ). */
export function getIsoWeekdaySun0Jerusalem(d: Date): number {
  const stable = civilDateToUtcNoon(d);
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone: ASIA_JERUSALEM,
    weekday: 'short',
  }).format(stable);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[short] ?? 0;
}

export type HebrewHeader = {
  hebrewMonth: string;
  hebrewYearGematriya: string; // e.g. תשפ״ד
};

export type DayEvents = {
  titles: string[];
  candleLighting?: string; // e.g. 18:40
  havdalah?: string; // e.g. 19:37
  fastBegins?: string; // e.g. 05:12
  fastEnds?: string; // e.g. 19:45
  fastNameHe?: string; // e.g. עשרה בטבת
  parshaHe?: string; // e.g. פָּרָשַׁת נח (Hebcal `he` locale)
};

const HEBREW_ORDINALS_1_7 = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ז׳'] as const;

/** Hebcal locale `he` renders ראש חודש with nikud (רֹאשׁ חוֹדֶשׁ…); plain spelling may appear in overrides. */
export function abbreviateRoshChodeshHeTitle(s: string): string {
  if (!s) return s;
  return s.replaceAll('רֹאשׁ חוֹדֶשׁ', 'ר״ח').replaceAll('ראש חודש', 'ר״ח');
}

function stripHebcalYearSuffixFromHolidayHeTitle(s: string): string {
  const raw = String(s ?? '').trim();
  const plain = stripHebrewNikkud(raw).replace(/\s+/g, ' ').trim();
  // Hebcal can render: "רֹאשׁ הַשָּׁנָה 5788" (with niqqud) – prefer without the year.
  // Also accept the plain spelling without the ה prefix.
  const normalized = plain.replace(/^ראש ה?שנה/u, 'ראש השנה');
  if (/^ראש השנה \d{4}$/u.test(plain) || /^ראש השנה \d{4}$/u.test(normalized)) {
    return 'ראש השנה';
  }
  return raw;
}

function stripInvisibleDirectionMarks(s: string): string {
  // Remove common bidi/isolate markers that can sneak into rendered strings
  // and break simple regexes like /^\d{4}$/.
  return String(s ?? '').replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '');
}

function isBareGregorianYearLine(s: string): boolean {
  const t = stripInvisibleDirectionMarks(String(s ?? '')).trim();
  // treat anything that becomes exactly 4 ASCII digits as a year-only line
  return /^\d{4}$/.test(t);
}

/** Hebcal title lines, abbreviated, deduped, order preserved (center cells, PDF, editor). */
export function uniqAbbrevHebrewTitleLines(titles: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of titles) {
    const trimmed = String(raw ?? '').trim();
    // Hebcal can sometimes emit the Hebrew year as a separate line/title (e.g. "5788").
    // Never show bare year numbers in the calendar.
    if (isBareGregorianYearLine(trimmed)) continue;
    const s = abbreviateRoshChodeshHeTitle(stripHebcalYearSuffixFromHolidayHeTitle(trimmed));
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/** Strip niqqud / cantillation (same idea as @hebcal/hdate hebrewStripNikkud). */
function stripHebrewNikkud(str: string): string {
  const a = str.normalize('NFC');
  return a.replace(/[\u0590-\u05bd]/g, '').replace(/[\u05bf-\u05c7]/g, '');
}

function plainHebrewTitleKey(s: string): string {
  return stripHebrewNikkud(s).replace(/\s+/g, ' ').trim();
}

/**
 * Whether any holiday title line denotes Rosh Hashanah (Erev, day I, or II).
 * Patterns are prefixes / exact roots — Hebcal may append text or use alternate punctuation.
 */
export function isRoshHashanaHolidayTitleHe(titles: readonly string[]): boolean {
  for (const t of titles ?? []) {
    const s = stripHebrewNikkud(String(t ?? ''))
      .replace(/\s+/g, ' ')
      .trim();
    if (/^ערב ראש השנה/u.test(s)) return true;
    if (/^ראש השנה\s+ב['׳״]/u.test(s)) return true;
    if (/^ראש השנה(\s+\d{4})?\s*$/u.test(s)) return true;
  }
  return false;
}

/** Erev Yom Kippur or Yom Kippur (titles from `getDayEventsByGregorianDate`). */
export function isYomKippurHolidayTitleHe(titles: readonly string[]): boolean {
  for (const t of titles ?? []) {
    const s = stripHebrewNikkud(String(t ?? ''))
      .replace(/\s+/g, ' ')
      .trim();
    if (/^ערב יום (כיפור|כפור|הכפורים)/u.test(s)) return true;
    if (/^יום (כיפור|כפור|הכפורים)/u.test(s)) return true;
  }
  return false;
}

/**
 * Israeli civil / “modern” Hebcal entries (not halachic חגים / תעניות / ר״ח).
 * Yom HaShoah / HaZikaron / HaAtzma'ut stay — user asked to drop language, Herzl, Ben-Gurion, Rabin, Aliyah, etc.
 */
export function isExcludedIsraelCivicCalendarEvent(desc: string, titleHe: string): boolean {
  const d = desc.trim();
  if (
    d === 'Hebrew Language Day' ||
    d === 'Family Day' ||
    d === 'Jabotinsky Day' ||
    d === 'Yitzhak Rabin Memorial Day' ||
    d === 'Yom HaAliyah' ||
    d === 'Yom HaAliyah School Observance' ||
    d === 'Ben-Gurion Day' ||
    d.includes('Ben-Gurion') ||
    d === 'Yom Herzl' ||
    d.includes('Herzl')
  ) {
    return true;
  }
  if (/^Yom HaAliyah/i.test(d)) return true;

  const t = stripHebrewNikkud(titleHe).replace(/\s+/g, ' ');
  if (/יום הזיכרון ליצחק רבין/.test(t)) return true;
  if (/(יום השפה|שפת העברית|השפה העברית)/.test(t)) return true;
  if (/יום המשפחה/.test(t)) return true;
  if (/זבוטינסקי|ז׳בוטינסקי|ג׳בוטינסקי/.test(t)) return true;
  if (/יום העלייה/.test(t)) return true;
  if (/בן[\s\u05BE-]*גוריון/.test(t)) return true;
  if (/יום/.test(t) && /הרצל|הרצ״ל/.test(t)) return true;
  return false;
}

/** Hebcal `desc` values we omit from center `titles` everywhere (does not remove the day from the grid). */
function isSuppressedFromCenterTitlesHebcalDesc(desc: string): boolean {
  const d = desc.trim();
  // א׳ אלול — «ראש השנה למעשר בהמה» (@hebcal/core static `Rosh Hashana LaBehemot`)
  return d === 'Rosh Hashana LaBehemot';
}

/**
 * After uniq/abbrev titles, prepends `fastNameHe` if it is missing (Hebcal `titles` vs `fastNameHe` can differ by nikud).
 */
export function mergeTitlesWithFastNameIfMissing(
  titles: string[],
  fastNameHe: string | undefined | null,
): string[] {
  const base = uniqAbbrevHebrewTitleLines(titles);
  const raw = (fastNameHe ?? '').trim();
  if (!raw) return base;
  const key = plainHebrewTitleKey(raw);
  if (!key) return base;
  const already = base.some((ln) => plainHebrewTitleKey(ln) === key);
  if (already) return base;
  return [raw, ...base];
}

const PARSHA_PREFIX_LETTERS = ['פ', 'ר', 'ש', 'ת'] as const;

/**
 * Parsha title for display without the word "פרשת" (handles plain spelling and Hebcal niqqud, e.g. פָּרָשַׁת).
 */
export function formatParshaDisplayHe(raw: string | undefined | null): string {
  if (raw == null || raw === '') return '';
  let s = String(raw).trim();
  if (!s) return '';

  const plain = stripHebrewNikkud(s);
  if (!plain.startsWith('פרשת')) {
    // Plain "פרשת " prefix (no niqqud) or no prefix
    return s.replace(/^פרשת\s+/u, '').trim();
  }

  let i = 0;
  let matched = 0;
  while (i < s.length && matched < PARSHA_PREFIX_LETTERS.length) {
    const c = s[i]!;
    if (/[\u0590-\u05bd\u05bf-\u05c7]/.test(c)) {
      i++;
      continue;
    }
    const base = stripHebrewNikkud(c);
    if (base !== PARSHA_PREFIX_LETTERS[matched]) {
      return s;
    }
    matched++;
    i++;
  }
  while (i < s.length && /[\u0590-\u05bd\u05bf-\u05c7]/.test(s[i]!)) i++;
  while (i < s.length && /\s/.test(s[i]!)) i++;
  return s.slice(i).trim();
}

/** Hebcal weekly parsha rows start with «פרשת»; holiday titles (e.g. שמיני עצרת) must not be deduped against `parshaHe`. */
export function hebrewTitleLooksLikeParshaLine(raw: string | undefined | null): boolean {
  const plain = stripHebrewNikkud(String(raw ?? ''))
    .replace(/\s+/g, ' ')
    .trim();
  return plain.startsWith('פרשת');
}

const TAANIT_ESTHER_PLAIN = 'תענית אסתר';

/** Fast of Esther — no fast begin/end times in UI/PDF (name stays in center titles). */
export function isTaanitEstherFastNameHe(name: string | undefined | null): boolean {
  if (name == null || name === '') return false;
  const plain = stripHebrewNikkud(String(name).normalize('NFC').trim()).replace(/\s+/g, ' ');
  return plain === TAANIT_ESTHER_PLAIN || plain.startsWith(`${TAANIT_ESTHER_PLAIN} `);
}

/** Ordinal after "סוכות"/"פסח" in Hebcal Hebrew titles (e.g. סוכות ו׳ (חוה״מ)). */
function extractCholOrdinalFromHolidayTitle(evTitleHe: string): string | undefined {
  const plain = stripHebrewNikkud(evTitleHe).replace(/\s+/g, ' ').trim();
  const m = plain.match(/^(?:סוכות|פסח)\s+([אבגדהוזחטיכלמנסעפצקרשת][׳״']?)/u);
  return m?.[1];
}

function cholHamoedTitle(evTitleHe: string, cholHaMoedDay?: number): string | undefined {
  // Hebcal: cholHaMoedDay 1 = first חוה״מ day, which is already "פסח/סוכות **ב׳**" in Hebrew (not א׳).
  // Older code used (day - 1) into א׳–ז׳ and a bad fallback (first Hebrew letter → often ס),
  // which produced wrong labels (e.g. off-by-one or unrelated letters).
  if (typeof cholHaMoedDay === 'number' && cholHaMoedDay === -1) return undefined;

  if (typeof cholHaMoedDay === 'number' && cholHaMoedDay >= 1 && cholHaMoedDay <= 6) {
    const ord = HEBREW_ORDINALS_1_7[cholHaMoedDay];
    if (ord) return `${ord} חוה״מ`;
  }

  const picked = extractCholOrdinalFromHolidayTitle(evTitleHe);
  if (picked) return `${picked} חוה״מ`;
  return undefined;
}

// Omer is intentionally not auto-rendered. Users can add it manually.

export function getHebrewDayGematriya(gregDate: Date): string {
  const hd = new HDate(civilDateToUtcNoon(gregDate));
  // "ט״ו חשון" (when suppressYear=true) -> take first token
  return hd.renderGematriya(true, true).split(' ')[0] ?? '';
}

export function getHebrewDayAndMonth(gregDate: Date): { day: string; month: string } {
  const hd = new HDate(civilDateToUtcNoon(gregDate));
  // Example (suppressYear=true): "א׳ ניסן" or "ט״ו חשון"
  const parts = hd.renderGematriya(true, true).split(' ').filter(Boolean);
  return { day: parts[0] ?? '', month: parts[1] ?? '' };
}

const HEBREW_GEMATRIYA_YEAR_RE = /^[אבגדהוזחטיכלמנסעפצקרשת׳״״]+$/;

function hebrewMonthYearFromHDate(hd: HDate): { month: string; year: string } {
  // Example (suppressNikud=true, include year): "ט״ו חשון תשס״ט"
  const parts = hd.renderGematriya(true, false).split(' ').filter(Boolean);
  if (parts.length < 2) return { month: '', year: '' };

  const last = parts[parts.length - 1] ?? '';
  const hasYear = HEBREW_GEMATRIYA_YEAR_RE.test(last);
  const year = hasYear ? last : '';
  const monthTokens = hasYear ? parts.slice(1, -1) : parts.slice(1);
  const month = monthTokens.join(' ').trim();
  return { month, year };
}

export function getHebrewHeaderForGregorianMonth(monthDate: Date): HebrewHeader {
  const y = monthDate.getFullYear();
  const m = monthDate.getMonth();
  const start = civilDateToUtcNoon(new Date(y, m, 1));
  const end = civilDateToUtcNoon(new Date(y, m + 1, 0));

  const s = hebrewMonthYearFromHDate(new HDate(start));
  const e = hebrewMonthYearFromHDate(new HDate(end));

  // Same Hebrew month + year across the whole Gregorian month
  if (s.month === e.month && s.year === e.year) {
    return { hebrewMonth: s.month, hebrewYearGematriya: s.year };
  }

  // Different Hebrew months (most common when Gregorian month spans Adar/Nisan etc.)
  if (s.year === e.year) {
    return {
      hebrewMonth: `${s.month} / ${e.month}`,
      hebrewYearGematriya: s.year || e.year,
    };
  }

  // Rare: Gregorian month spans a Hebrew year boundary; include year on both sides.
  return {
    hebrewMonth: `${s.month} ${s.year} / ${e.month} ${e.year}`.trim(),
    hebrewYearGematriya: '',
  };
}

export function formatHebrewHeaderText(h: HebrewHeader): string {
  const y = h.hebrewYearGematriya?.trim();
  const m = h.hebrewMonth?.trim();
  if (!m) return '';
  if (!y) return m;
  return `${m} ${y}`.trim();
}

/** י״ד בניסן — ערב פסח (כולל נרות ליום טוב). */
export function isErevPesachGregorian(g: Date): boolean {
  const hd = new HDate(civilDateToUtcNoon(g));
  return hd.getMonth() === months.NISAN && hd.getDate() === 14;
}

/** ט״ו בניסן — תחילת פסח בישראל. */
export function isPesachIGregorian(g: Date): boolean {
  const hd = new HDate(civilDateToUtcNoon(g));
  return hd.getMonth() === months.NISAN && hd.getDate() === 15;
}

/** כ׳ בניסן — ערב שביעי של פסח בישראל (נרות ליום טוב). */
export function isErevSheviShelPesachGregorian(g: Date): boolean {
  const hd = new HDate(civilDateToUtcNoon(g));
  return hd.getMonth() === months.NISAN && hd.getDate() === 20;
}

/** כ״א בניסן — שביעי של פסח בישראל. */
export function isSheviShelPesachGregorian(g: Date): boolean {
  const hd = new HDate(civilDateToUtcNoon(g));
  return hd.getMonth() === months.NISAN && hd.getDate() === 21;
}

export function getHolidayTitlesByGregorianDate(
  start: Date,
  end: Date,
  opts?: { il?: boolean },
): Map<string, string[]> {
  const il = opts?.il ?? false;
  const startStable = civilDateToUtcNoon(start);
  const endStable = civilDateToUtcNoon(end);

  const events = HebrewCalendar.calendar({
    start: startStable,
    end: endStable,
    isHebrewYear: false,
    noHolidays: false,
    noRoshChodesh: false,
    il,
    locale: 'he',
  });

  const byDay = new Map<string, string[]>();
  for (const ev of events) {
    const desc = ev.getDesc();
    const g = ev.getDate().greg();
    const key = formatYmdJerusalem(g);
    const title = abbreviateRoshChodeshHeTitle(ev.render('he'));
    if (isExcludedIsraelCivicCalendarEvent(desc, title) || isSuppressedFromCenterTitlesHebcalDesc(desc)) continue;
    const arr = byDay.get(key) ?? [];
    if (!arr.includes(title)) arr.push(title);
    byDay.set(key, arr);
  }

  return byDay;
}

export function getDayEventsByGregorianDate(
  start: Date,
  end: Date,
  opts?: {
    il?: boolean;
    location?: 'Jerusalem' | 'TelAviv' | { latitude: number; longitude: number; tzid: string; name?: string };
    havdalahMins?: number;
    candleLightingMins?: number;
    /**
     * צומות רגילים (לא יום כיפור): `hebcal_tzeit` = שעת «יציאת צום» מ־Hebcal (צאת כוכבים);
     * `sunset_minutes` = שקיעה + `fastSunsetOffsetMins` (לא משפיע על הבדלה לשבת/יום כיפור).
     */
    fastTzaitStyle?: 'hebcal_tzeit' | 'sunset_minutes';
    fastSunsetOffsetMins?: number;
  },
): Map<string, DayEvents> {
  const il = opts?.il ?? true;
  const startStable = civilDateToUtcNoon(start);
  const endStable = civilDateToUtcNoon(end);

  const location =
    opts?.location === 'TelAviv'
      ? ZMANIM_LOCATION_TEL_AVIV
      : opts?.location === 'Jerusalem' || !opts?.location
        ? ZMANIM_LOCATION_JERUSALEM
        : new Location(
            opts.location.latitude,
            opts.location.longitude,
            il,
            opts.location.tzid,
            opts.location.name,
          );

  const events = HebrewCalendar.calendar({
    start: startStable,
    end: endStable,
    isHebrewYear: false,
    noHolidays: false,
    noRoshChodesh: false,
    il,
    locale: 'he',
    candlelighting: true,
    location,
    /** בלי זה Hebcal מחשב שקיעה בגובה פני הים — ירושלים (780 מ׳) נראית מוקדמת מדי לעומת ת״א. */
    useElevation: true,
    sedrot: true,
    omer: true,
    havdalahMins: typeof opts?.havdalahMins === 'number' ? opts.havdalahMins : undefined,
    candleLightingMins:
      typeof opts?.candleLightingMins === 'number' ? opts.candleLightingMins : undefined,
  });

  const byDay = new Map<string, DayEvents>();

  for (const ev of events) {
    const g = ev.getDate().greg();
    const key = formatYmdJerusalem(g);
    const existing = byDay.get(key) ?? { titles: [] };

    const desc = ev.getDesc(); // stable English
    const eventTimeStr = (ev as any).eventTimeStr as string | undefined;

    // Hebcal sometimes annotates timed-event descriptions (e.g. "Havdalah (42 min)").
    // Be tolerant so Yom Kippur / Rosh Hashana motzaei-shabbat times are not missed.
    if (desc === 'Candle lighting' || desc.startsWith('Candle lighting')) {
      existing.candleLighting = eventTimeStr ?? existing.candleLighting;
    } else if (desc === 'Havdalah' || desc.startsWith('Havdalah')) {
      existing.havdalah = eventTimeStr ?? existing.havdalah;
    } else if (desc === 'Fast begins') {
      existing.fastBegins = eventTimeStr ?? existing.fastBegins;
    } else if (desc === 'Fast ends') {
      existing.fastEnds = eventTimeStr ?? existing.fastEnds;
    } else {
      const mask = ev.getFlags?.() ?? 0;
      const title = abbreviateRoshChodeshHeTitle(ev.render('he'));
      if (isExcludedIsraelCivicCalendarEvent(desc, title) || isSuppressedFromCenterTitlesHebcalDesc(desc)) {
        byDay.set(key, existing);
        continue;
      }
      const isParsha = (mask & flags.PARSHA_HASHAVUA) !== 0;
      if (isParsha) {
        existing.parshaHe = title;
        byDay.set(key, existing);
        continue;
      }

      // We render Omer ourselves (starting 16 Nisan). Do not include Hebcal's Omer events
      // in titles, otherwise it duplicates and incorrectly marks the cell as an "event day".
      const isOmer = (mask & flags.OMER_COUNT) !== 0;
      if (isOmer) {
        byDay.set(key, existing);
        continue;
      }

      const isFastDay = (mask & (flags.MINOR_FAST | flags.MAJOR_FAST)) !== 0;
      if (isFastDay && !existing.fastNameHe) existing.fastNameHe = title;

      const isCholHamoed = (mask & flags.CHOL_HAMOED) !== 0;
      const cholHaMoedDay = (ev as any).cholHaMoedDay as number | undefined;
      let chosenTitle =
        isCholHamoed
          ? cholHamoedTitle(title, cholHaMoedDay) ?? title
          : desc === 'Pesach I'
            ? 'חג הפסח'
            : desc === 'Pesach VII'
              ? 'שביעי של פסח'
              : desc === 'Erev Shavuot'
                ? 'ער״ח השבועות'
                : desc === 'Shavuot'
                  ? 'חג השבועות'
                  : title;
      // Israel: שמיני עצרת ושמחת תורה ביום אחד — Hebcal Hebrew is only «שְׁמִינִי עֲצֶרֶת»; align with common luach wording.
      if (il && desc === 'Shmini Atzeret') {
        chosenTitle = 'שמיני עצרת / שמחת תורה';
      }
      const normalizedTitle = stripHebcalYearSuffixFromHolidayHeTitle(chosenTitle);

      // Some events may not have Hebrew translations and render in English.
      // Hide any event title containing Latin letters *after* applying our normalizations.
      if (/[A-Za-z]/.test(normalizedTitle)) {
        byDay.set(key, existing);
        continue;
      }

      // Hide bare Hebrew year lines like "5788"
      if (isBareGregorianYearLine(normalizedTitle)) {
        byDay.set(key, existing);
        continue;
      }

      if (!existing.titles.includes(normalizedTitle)) existing.titles.push(normalizedTitle);
    }

    byDay.set(key, existing);
  }

  if (opts?.fastTzaitStyle === 'sunset_minutes') {
    applyFastEndsSunsetMinutesForStandardFasts(
      byDay,
      location,
      typeof opts.fastSunsetOffsetMins === 'number' ? opts.fastSunsetOffsetMins : 25,
    );
  }

  return byDay;
}


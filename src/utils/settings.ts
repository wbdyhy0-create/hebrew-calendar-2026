

/** מבנה כותרת החודש ביחס לרשת — נשלט מערכת נושא ומהגדרות. */
export const HEADER_LAYOUT_STYLES = [
  'floating',
  'seamless',
  'right_block',
  'centered_pill',
  'minimal_text',
] as const;

export type HeaderLayoutStyle = (typeof HEADER_LAYOUT_STYLES)[number];

export function sanitizeHeaderLayoutStyle(v: unknown): HeaderLayoutStyle {
  return HEADER_LAYOUT_STYLES.includes(v as HeaderLayoutStyle)
    ? (v as HeaderLayoutStyle)
    : 'floating';
}

/** יציאת צומות רגילים (לא יום כיפור) — נפרד מהבדלת שבת/יום כיפור. */
export type FastTzaitStyle = 'hebcal_tzeit' | 'sunset_minutes';


export type CalendarSettings = {
  titleMain: string;
  titleSub: string;
  /** צורת הכותרת והחיבור לרשת (לא רק צבעים). */
  headerLayoutStyle: HeaderLayoutStyle;

  // פס עליון — מסגרת
  headerBarHeightPx: number;
  headerBarRadiusPx: number;
  headerBarBg: string;
  headerBarBorderColor: string;
  headerBarBorderWidthPx: number;
  headerBarMarginBottomPx: number;
  headerBarOffsetYPx: number;
  headerBarMaxWidthPx: number; // 0 = full width
  headerBarShowEditButton: boolean;

  // פס עליון — תיבה 1: כותרת ראשית
  headerBox1OffsetXPx: number; // 0 = קצה ימין, גדל = זז שמאלה
  headerBox1OffsetYPx: number; // 0 = קצה עליון, גדל = למטה
  headerBox1FontPx: number;
  headerBox1FontWeight: number;
  headerBox1Color: string;

  // פס עליון — תיבה 2: כותרת משנה
  headerBox2OffsetXPx: number;
  headerBox2OffsetYPx: number;
  headerBox2FontPx: number;
  headerBox2FontWeight: number;
  headerBox2Color: string;

  // פס עליון — תיבה 3: חודש עברי
  headerBox3OffsetXPx: number;
  headerBox3OffsetYPx: number;
  headerBox3FontPx: number;
  headerBox3FontWeight: number;
  headerBox3Color: string;

  // פס עליון — תיבה 4: חודש לועזי
  headerBox4OffsetXPx: number;
  headerBox4OffsetYPx: number;
  headerBox4FontPx: number;
  headerBox4FontWeight: number;
  headerBox4Color: string;
  fontFamily: string;
  /**
   * Optional per-area font override. When omitted, `fontFamily` is used as fallback.
   * This enables choosing different fonts for different parts (header vs. times, etc).
   */
  fontFamilyByTarget?: Partial<
    Record<'settings' | 'calendarHeader' | 'cellDates' | 'cellTimes' | 'cellEvents', string>
  >;
  /**
   * Where to apply `fontFamily` in the app UI.
   * - `all`: apply to everything (legacy behavior)
   * - `settings`: only the settings panel
   * - `calendarHeader`: month header / top strip
   * - `cellDates`: the dates in the top-right corner of each cell
   * - `cellTimes`: the zmanim/times blocks
   * - `cellEvents`: the center event titles
   */
  fontApplyTargets: Array<
    'all' | 'settings' | 'calendarHeader' | 'cellDates' | 'cellTimes' | 'cellEvents'
  >;
  fontSizePx: number;
  fontWeight: 400 | 600 | 700;
  gregDayFontPx: number;
  hebDayFontPx: number;
  eventTitleFontPx: number;
  shabbatTimesFontPx: number;
  showParsha: boolean;
  // Kept for backward-compatible settings migration.
  // The app currently uses @hebcal/core built-in Zmanim only.
  shabbatTimesSource: 'hebcal' | 'ohrHachaim';
  // Kept for backward-compatible settings migration.
  zmanimCity: 'Jerusalem' | 'TelAviv';
  /**
   * דקות לפני השקיעה לכניסת שבת/חג (Hebcal candleLightingMins) — 20 או 40.
   */
  candleLightingMins: 20 | 40;
  /** צאת צומות (תשעה באב וכו׳), לא שבת ולא יום כיפור. */
  fastTzaitStyle: FastTzaitStyle;
  /** כש־`fastTzaitStyle` הוא `sunset_minutes` — דקות אחרי השקיעה (15–45). */
  fastSunsetOffsetMins: number;
  enableManualEdits: boolean;
  showEditButtonInCells: boolean;
  canvasPaddingPx: number;
  canvasPaddingTopPx: number;
  /**
   * זום כל תוכן הלוח (כותרת+רשת) בתוך הקנבס, באחוזים.
   * 100 = מלא; פחות = הלוח קטן יותר ומשאיר שוליים בתוך מסגרת העמוד (A4 וכו׳).
   */
  calendarLayoutScalePercent: number;
  tableOffsetYPx: number;
  /** Center calendar vertically when smaller than canvas (web/PDF). */
  layoutCenterVertically: boolean;
  /** Stretch the month grid rows to fill available height (web only). */
  layoutFillHeight: boolean;
  /** Auto-fit the calendar to fill the canvas at 100%. */
  layoutAutoFitToCanvas: boolean;
  canvasBorderWidthPx: number;
  canvasBorderColor: string;
  /** Rounded corners for the outer canvas frame (px). */
  canvasOuterRadiusPx: number;
  gridBorderWidthPx: number;
  gridBorderColor: string;
  /** שורת כותרות ימי השבוע מעל הטבלה: א׳ ב׳… או שמות מלאים */
  weekdayHeaderMode: 'shortLetter' | 'fullName';
  /** צבע טקסט כותרות ימי השבוע */
  gridWeekdayHeaderTextColor: string;
  /** צבע רקע פס כותרות ימי השבוע (השורה מעל הטבלה) */
  gridWeekdayHeaderBg: string;
  /** גובה פס כותרות ימי השבוע (px) */
  gridWeekdayHeaderHeightPx: number;
  /** היסט אנכי לכל פס ימי השבוע (המסגרת/הרקע), px (חיובי=למטה) */
  gridWeekdayHeaderRowOffsetYPx: number;
  /** עובי מסגרת תחתונה לפס ימי השבוע (px) */
  gridWeekdayHeaderBorderBottomWidthPx: number;
  /** צבע מסגרת תחתונה לפס ימי השבוע */
  gridWeekdayHeaderBorderBottomColor: string;
  /** גודל טקסט כותרות ימי השבוע (px) */
  gridWeekdayHeaderFontPx: number;
  /** משקל טקסט כותרות ימי השבוע */
  gridWeekdayHeaderFontWeight: number; // 400..900
  /** היסט אנכי לטקסט בפס ימי השבוע (px, חיובי=למטה) */
  gridWeekdayHeaderTextOffsetYPx: number;
  cellBorderWidthPx: number;
  cellBorderColor: string;
  /** `double` uses CSS `double` border (classic “מסגרת”). */
  cellBorderStyle: 'solid' | 'double';
  /** Rounded cell corners (px). 0 = square. */
  cellCornerRadiusPx: number;
  showCellBorders: boolean;
  /** Active catalog theme id (`default` = built-in defaults, no catalog overlay). */
  designThemeId: string;
  /** Structural style pack id (`default` = none). */
  stylePackId: string;
  /** Fill behind the canvas image / lace (calendar “body” tray). */
  calendarCanvasFill: string;
  /** Background for the 7-column grid shell (weekday row + cells). */
  gridShellBg: string;
  backgroundImageDataUrl?: string;
  /** Background image usage: one image for the whole year, or a different image per Gregorian month. */
  backgroundImageMode: 'year' | 'perMonth';
  /** Optional images per month index 0..11 (Jan..Dec). Used when backgroundImageMode='perMonth'. */
  backgroundImagesByMonth?: (string | undefined)[];
  backgroundOpacity: number; // 0..1
  eventBg: string; // light blue
  shabbatBg: string; // cream
  todayBg: string; // subtle blue

  // PDF / printable month page sizing
  pdfPagePreset: 'A4' | 'A5' | 'custom';
  pdfOrientation: 'landscape' | 'portrait';
  pdfCustomWidthMm: number;
  pdfCustomHeightMm: number;
  pdfMarginMm: number;
  pdfHtml2CanvasScale: number; // 1..3
  /**
   * גובה מינימלי לתא בייצוא חודש/שנה ל‑PDF (px). ערך קבוע ב‑CSS — מתאים ל‑html2canvas בלי `fr`/`%` על התאים.
   * טווח מומלץ ב‑UI: 90–150.
   */
  pdfExportCellHeightPx: number;

  // Empty / padding cells (end-of-month fillers + out-of-month padding)
  paddingCellColor: string; // hex
  paddingCellStrength: number; // 0..1 (how strong the gray is vs white)
};

export const DEFAULT_SETTINGS: CalendarSettings = {
  titleMain: 'לוח שנה עברי‑לועזי',
  titleSub: 'מועדים · ראשי חודשים · זמני שבת',
  headerLayoutStyle: 'floating',
  headerBarHeightPx: 78,
  headerBarRadiusPx: 16,
  headerBarBg: 'rgba(255,255,255,0.88)',
  headerBarBorderColor: '#E2E8F0',
  headerBarBorderWidthPx: 2,
  headerBarMarginBottomPx: 12,
  headerBarOffsetYPx: 0,
  headerBarMaxWidthPx: 0,
  headerBarShowEditButton: true,

  // תיבה 1
  headerBox1OffsetXPx: 0,
  headerBox1OffsetYPx: 8,
  headerBox1FontPx: 20,
  headerBox1FontWeight: 700,
  headerBox1Color: '#0F172A',

  // תיבה 2
  headerBox2OffsetXPx: 0,
  headerBox2OffsetYPx: 36,
  headerBox2FontPx: 13,
  headerBox2FontWeight: 400,
  headerBox2Color: '#64748B',

  // תיבה 3
  headerBox3OffsetXPx: 0,
  headerBox3OffsetYPx: 8,
  headerBox3FontPx: 22,
  headerBox3FontWeight: 400,
  headerBox3Color: '#0F172A',

  // תיבה 4
  headerBox4OffsetXPx: 0,
  headerBox4OffsetYPx: 36,
  headerBox4FontPx: 16,
  headerBox4FontWeight: 400,
  headerBox4Color: '#334155',
  fontFamily:
    '"Heebo", "Assistant", system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
  fontFamilyByTarget: {},
  fontApplyTargets: ['all'],
  fontSizePx: 9,
  fontWeight: 400,
  gregDayFontPx: 8,
  hebDayFontPx: 7,
  eventTitleFontPx: 6,
  shabbatTimesFontPx: 5,
  showParsha: true,
  shabbatTimesSource: 'hebcal',
  zmanimCity: 'Jerusalem',
  candleLightingMins: 40,
  fastTzaitStyle: 'hebcal_tzeit',
  fastSunsetOffsetMins: 25,
  enableManualEdits: true,
  showEditButtonInCells: true,
  canvasPaddingPx: 14,
  canvasPaddingTopPx: 32,
  calendarLayoutScalePercent: 100,
  tableOffsetYPx: 0,
  layoutCenterVertically: true,
  layoutFillHeight: true,
  layoutAutoFitToCanvas: true,
  canvasBorderWidthPx: 2,
  canvasBorderColor: '#D8DEE9',
  canvasOuterRadiusPx: 18,
  gridBorderWidthPx: 2,
  gridBorderColor: '#E2E8F0',
  weekdayHeaderMode: 'shortLetter',
  gridWeekdayHeaderTextColor: '#334155',
  gridWeekdayHeaderBg: '#ffffff',
  gridWeekdayHeaderHeightPx: 34,
  gridWeekdayHeaderRowOffsetYPx: 0,
  gridWeekdayHeaderBorderBottomWidthPx: 1,
  gridWeekdayHeaderBorderBottomColor: '#E2E8F0',
  gridWeekdayHeaderFontPx: 1,
  gridWeekdayHeaderFontWeight: 700,
  gridWeekdayHeaderTextOffsetYPx: 0,
  cellBorderWidthPx: 1,
  cellBorderColor: '#E2E8F0',
  cellBorderStyle: 'solid',
  cellCornerRadiusPx: 0,
  showCellBorders: true,
  designThemeId: 'default',
  stylePackId: 'default',
  calendarCanvasFill: '#ffffff',
  gridShellBg: 'rgba(255,255,255,0.8)',
  backgroundImageMode: 'year',
  backgroundOpacity: 0.38,
  eventBg: '#E6F6FF',
  shabbatBg: '#FFF7E6',
  todayBg: '#EAF2FF',

  pdfPagePreset: 'A4',
  pdfOrientation: 'portrait',
  pdfCustomWidthMm: 297,
  pdfCustomHeightMm: 210,
  pdfMarginMm: 0,
  pdfHtml2CanvasScale: 2,
  pdfExportCellHeightPx: 92,

  paddingCellColor: '#94a3b8',
  paddingCellStrength: 0.22,
};

// Bump cache version to force a clean reset when data gets inconsistent.
const STORAGE_KEY = 'hebrew-gregorian-calendar:settings:v5';

export function loadSettings(): CalendarSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsedUnknown = JSON.parse(raw) as unknown;
    if (!parsedUnknown || typeof parsedUnknown !== 'object' || Array.isArray(parsedUnknown)) {
      return DEFAULT_SETTINGS;
    }
    const parsed = parsedUnknown as Partial<CalendarSettings>;
    // Merge, but never let null/undefined override defaults (handles older saved versions)
    const merged: any = { ...DEFAULT_SETTINGS };
    for (const [k, v] of Object.entries(parsed ?? {})) {
      if (v !== null && v !== undefined) merged[k] = v;
    }

    // Coerce a few fields that must be numeric (older saves / manual edits can store strings)
    const numericKeys = [
      'fontSizePx',
      'gregDayFontPx',
      'hebDayFontPx',
      'eventTitleFontPx',
      'shabbatTimesFontPx',
      'headerBarHeightPx',
      'headerBarRadiusPx',
      'headerBarBorderWidthPx',
      'headerBarMarginBottomPx',
      'headerBarOffsetYPx',
      'headerBarMaxWidthPx',
      'headerBox1OffsetXPx',
      'headerBox1OffsetYPx',
      'headerBox1FontPx',
      'headerBox1FontWeight',
      'headerBox2OffsetXPx',
      'headerBox2OffsetYPx',
      'headerBox2FontPx',
      'headerBox2FontWeight',
      'headerBox3OffsetXPx',
      'headerBox3OffsetYPx',
      'headerBox3FontPx',
      'headerBox3FontWeight',
      'headerBox4OffsetXPx',
      'headerBox4OffsetYPx',
      'headerBox4FontPx',
      'headerBox4FontWeight',
      'canvasPaddingPx',
      'canvasPaddingTopPx',
      'calendarLayoutScalePercent',
      'tableOffsetYPx',
      // layout booleans are coerced below
      'canvasBorderWidthPx',
      'canvasOuterRadiusPx',
      'gridBorderWidthPx',
      'gridWeekdayHeaderHeightPx',
      'gridWeekdayHeaderRowOffsetYPx',
      'gridWeekdayHeaderBorderBottomWidthPx',
      'gridWeekdayHeaderFontPx',
      'gridWeekdayHeaderFontWeight',
      'gridWeekdayHeaderTextOffsetYPx',
      'cellBorderWidthPx',
      'cellCornerRadiusPx',
      'backgroundOpacity',
      'pdfCustomWidthMm',
      'pdfCustomHeightMm',
      'pdfMarginMm',
      'pdfHtml2CanvasScale',
      'paddingCellStrength',
      'fastSunsetOffsetMins',
    ] as const;

    for (const key of numericKeys) {
      if (merged[key] === undefined || merged[key] === null) continue;
      const n = Number(merged[key]);
      if (!Number.isFinite(n)) continue;
      merged[key] = n;
    }

    // header bar migrations removed

    // ברירת מחדל ישנה: 6px לכל סוגי הטקסט בתא — מחליפים בסולם קריא (ללא לדרוס התאמות ידניות אחרות).
    if (
      merged.gregDayFontPx === 6 &&
      merged.hebDayFontPx === 6 &&
      merged.eventTitleFontPx === 6 &&
      merged.shabbatTimesFontPx === 6
    ) {
      merged.gregDayFontPx = DEFAULT_SETTINGS.gregDayFontPx;
      merged.hebDayFontPx = DEFAULT_SETTINGS.hebDayFontPx;
      merged.eventTitleFontPx = DEFAULT_SETTINGS.eventTitleFontPx;
      merged.shabbatTimesFontPx = DEFAULT_SETTINGS.shabbatTimesFontPx;
    }
    // ברירת מחדל ישנה: 1px — מחליפים בסולם קריא.
    if (
      merged.gregDayFontPx === 1 &&
      merged.hebDayFontPx === 1 &&
      merged.eventTitleFontPx === 1 &&
      merged.shabbatTimesFontPx === 1
    ) {
      merged.gregDayFontPx = DEFAULT_SETTINGS.gregDayFontPx;
      merged.hebDayFontPx = DEFAULT_SETTINGS.hebDayFontPx;
      merged.eventTitleFontPx = DEFAULT_SETTINGS.eventTitleFontPx;
      merged.shabbatTimesFontPx = DEFAULT_SETTINGS.shabbatTimesFontPx;
    }

    if (merged.weekdayHeaderMode !== 'shortLetter' && merged.weekdayHeaderMode !== 'fullName') {
      merged.weekdayHeaderMode = DEFAULT_SETTINGS.weekdayHeaderMode;
    }
    // Force built-in @hebcal/core zmanim (no external sources).
    merged.shabbatTimesSource = 'hebcal';
    merged.candleLightingMins = merged.candleLightingMins === 20 ? 20 : 40;

    if (merged.fastTzaitStyle !== 'hebcal_tzeit' && merged.fastTzaitStyle !== 'sunset_minutes') {
      merged.fastTzaitStyle = DEFAULT_SETTINGS.fastTzaitStyle;
    }
    const fsm = Number(merged.fastSunsetOffsetMins);
    merged.fastSunsetOffsetMins = Number.isFinite(fsm)
      ? Math.min(45, Math.max(15, Math.round(fsm)))
      : DEFAULT_SETTINGS.fastSunsetOffsetMins;

    if (merged.zmanimCity !== 'Jerusalem' && merged.zmanimCity !== 'TelAviv') {
      merged.zmanimCity = DEFAULT_SETTINGS.zmanimCity;
    }
    if (merged.backgroundImageMode !== 'year' && merged.backgroundImageMode !== 'perMonth') {
      merged.backgroundImageMode = DEFAULT_SETTINGS.backgroundImageMode;
    }
    if (merged.cellBorderStyle !== 'solid' && merged.cellBorderStyle !== 'double') {
      merged.cellBorderStyle = DEFAULT_SETTINGS.cellBorderStyle;
    }
    if (typeof merged.designThemeId !== 'string' || !merged.designThemeId.trim()) {
      merged.designThemeId = DEFAULT_SETTINGS.designThemeId;
    }
    if (typeof merged.stylePackId !== 'string' || !merged.stylePackId.trim()) {
      merged.stylePackId = DEFAULT_SETTINGS.stylePackId;
    }
    merged.headerLayoutStyle = sanitizeHeaderLayoutStyle(merged.headerLayoutStyle);
    merged.layoutCenterVertically = merged.layoutCenterVertically !== false;
    merged.layoutAutoFitToCanvas = merged.layoutAutoFitToCanvas !== false;
    merged.layoutFillHeight = merged.layoutFillHeight !== false;
    const pdfCellH = Number(merged.pdfExportCellHeightPx);
    merged.pdfExportCellHeightPx = Number.isFinite(pdfCellH)
      ? Math.min(150, Math.max(90, Math.round(pdfCellH)))
      : DEFAULT_SETTINGS.pdfExportCellHeightPx;
    const scalePct = Number(merged.calendarLayoutScalePercent);
    merged.calendarLayoutScalePercent = Number.isFinite(scalePct)
      ? Math.min(100, Math.max(40, Math.round(scalePct)))
      : DEFAULT_SETTINGS.calendarLayoutScalePercent;
    if (typeof merged.calendarCanvasFill !== 'string' || !merged.calendarCanvasFill.trim()) {
      merged.calendarCanvasFill = DEFAULT_SETTINGS.calendarCanvasFill;
    }
    if (typeof merged.gridShellBg !== 'string' || !merged.gridShellBg.trim()) {
      merged.gridShellBg = DEFAULT_SETTINGS.gridShellBg;
    }
    // Coerce font apply targets (migration / manual edits)
    const allowedTargets = new Set([
      'all',
      'settings',
      'calendarHeader',
      'cellDates',
      'cellTimes',
      'cellEvents',
    ]);
    if (Array.isArray(merged.fontApplyTargets)) {
      const next = (merged.fontApplyTargets as any[]).filter((x) => typeof x === 'string' && allowedTargets.has(x));
      merged.fontApplyTargets = next.length ? (next as any) : DEFAULT_SETTINGS.fontApplyTargets;
    } else if (merged.fontApplyTargets === undefined || merged.fontApplyTargets === null) {
      merged.fontApplyTargets = DEFAULT_SETTINGS.fontApplyTargets;
    } else {
      merged.fontApplyTargets = DEFAULT_SETTINGS.fontApplyTargets;
    }

    // Coerce per-target font families
    if (merged.fontFamilyByTarget && typeof merged.fontFamilyByTarget === 'object' && !Array.isArray(merged.fontFamilyByTarget)) {
      const src = merged.fontFamilyByTarget as any;
      const next: any = {};
      for (const k of ['settings', 'calendarHeader', 'cellDates', 'cellTimes', 'cellEvents'] as const) {
        const v = src[k];
        if (typeof v === 'string' && v.trim()) next[k] = v;
      }
      merged.fontFamilyByTarget = next;
    } else if (merged.fontFamilyByTarget === undefined || merged.fontFamilyByTarget === null) {
      merged.fontFamilyByTarget = {};
    } else {
      merged.fontFamilyByTarget = {};
    }
    if (Array.isArray(merged.backgroundImagesByMonth)) {
      const arr = merged.backgroundImagesByMonth as any[];
      const normalized = new Array(12).fill(undefined) as (string | undefined)[];
      for (let i = 0; i < 12; i++) {
        const v = arr[i];
        if (typeof v === 'string' && v.length > 0) normalized[i] = v;
      }
      merged.backgroundImagesByMonth = normalized;
    } else if (merged.backgroundImagesByMonth !== undefined) {
      merged.backgroundImagesByMonth = undefined;
    }

    return merged as CalendarSettings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: CalendarSettings): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}


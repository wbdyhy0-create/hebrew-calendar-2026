/** מבנה כותרת החודש ביחס לרשת — נשלט מערכת נושא ומהגדרות. */
export const HEADER_LAYOUT_STYLES = [
  'floating',
  'seamless',
  'right_block',
  'centered_pill',
  'minimal_text',
  // Title row is part of the grid, with visible gaps between cells.
  'grid_integrated',
] as const;

export type HeaderLayoutStyle = (typeof HEADER_LAYOUT_STYLES)[number];

export function sanitizeHeaderLayoutStyle(v: unknown): HeaderLayoutStyle {
  return HEADER_LAYOUT_STYLES.includes(v as HeaderLayoutStyle) ? (v as HeaderLayoutStyle) : 'floating';
}

/** יציאת צומות רגילים (לא יום כיפור) — נפרד מהבדלת שבת/יום כיפור. */
export type FastTzaitStyle = 'hebcal_tzeit' | 'sunset_minutes';

export type CalendarSettings = {
  /** Optional branding name (e.g. organization/bank). */
  brandName: string;
  /** Optional brand logo image (data URL). */
  brandLogoDataUrl: string;
  /** Brand accent color (CSS color). */
  brandAccentColor: string;

  /** Department / org unit label shown on the calendar (optional). */
  departmentName: string;
  /** Department theme accent color (CSS color). */
  departmentColor: string;
  /** Feature/widget layers enabled for this calendar configuration. */
  activeLayers: string[];

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

  /**
   * Header text stretch (InDesign-like scale).
   * Applied as transform scale on the header text spans (not via `font-stretch`, since most fonts aren't variable).
   */
  headerTextScaleXPercent: number; // 100 = normal
  headerTextScaleYPercent: number; // 100 = normal

  // פס עליון — תיבה 1: כותרת ראשית
  headerBox1OffsetXPx: number; // 0 = קצה ימין, גדל = זז שמאלה
  headerBox1OffsetYPx: number; // 0 = קצה עליון, גדל = למטה
  headerBox1FontPx: number;
  headerBox1FontWeight: number;
  headerBox1Color: string;
  /** Optional manual override for the displayed text. Empty = default. */
  headerBox1TextOverride?: string;

  // פס עליון — תיבה 2: כותרת משנה
  headerBox2OffsetXPx: number;
  headerBox2OffsetYPx: number;
  headerBox2FontPx: number;
  headerBox2FontWeight: number;
  headerBox2Color: string;
  headerBox2TextOverride?: string;

  // פס עליון — תיבה 3: חודש עברי
  headerBox3OffsetXPx: number;
  headerBox3OffsetYPx: number;
  headerBox3FontPx: number;
  headerBox3FontWeight: number;
  headerBox3Color: string;
  headerBox3TextOverride?: string;

  // פס עליון — תיבה 4: חודש לועזי
  headerBox4OffsetXPx: number;
  headerBox4OffsetYPx: number;
  headerBox4FontPx: number;
  headerBox4FontWeight: number;
  headerBox4Color: string;
  headerBox4TextOverride?: string;
  /** Vertical separator between Hebrew and Gregorian month labels in the top bar (not diagonal / not horizontal rule). */
  headerDatePairSeparatorEnabled: boolean;
  headerDatePairSeparatorColor: string;
  headerDatePairSeparatorWidthPx: number;
  /** Pad line top/bottom inside the text band (px). */
  headerDatePairSeparatorInsetYPx: number;
  /** Vertical nudge (px) for the separator line (positive = down). */
  headerDatePairSeparatorOffsetYPx: number;
  /**
   * Migration marker for separator offset semantics.
   * - `absolute_v0`: legacy saved value (where ~40px behaved like “0” visually)
   * - `relative_v1`: current value where 0 means “aligned” and render adds {@link HEADER_DATE_SEPARATOR_BASELINE_Y_PX}
   */
  headerDatePairSeparatorOffsetMode?: 'absolute_v0' | 'relative_v1';
  fontFamily: string;
  /**
   * Optional per-area font override. When omitted, `fontFamily` is used as fallback.
   * This enables choosing different fonts for different parts (header vs. times, etc).
   */
  fontFamilyByTarget?: Partial<Record<'settings' | 'calendarHeader' | 'cellDates' | 'cellTimes' | 'cellEvents', string>>;
  /**
   * Where to apply `fontFamily` in the app UI.
   * - `all`: apply to everything (legacy behavior)
   * - `settings`: only the settings panel
   * - `calendarHeader`: month header / top strip
   * - `cellDates`: the dates in the top-right corner of each cell
   * - `cellTimes`: the zmanim/times blocks
   * - `cellEvents`: the center event titles
   */
  fontApplyTargets: Array<'all' | 'settings' | 'calendarHeader' | 'cellDates' | 'cellTimes' | 'cellEvents'>;
  fontSizePx: number;
  fontWeight: 400 | 600 | 700;
  gregDayFontPx: number;
  hebDayFontPx: number;
  /** Font weight for Hebrew day number inside the cell corner. */
  hebDayFontWeight: number;
  /** Vertical offset (px) for Hebrew day number inside the cell corner. */
  hebDayOffsetYPx: number;
  /** Horizontal offset (px) for Hebrew day number inside the cell corner. */
  hebDayOffsetXPx: number;
  /** Font weight for Gregorian day number inside the cell corner. */
  gregDayFontWeight: number;
  /** Vertical offset (px) for Gregorian day number inside the cell corner. */
  gregDayOffsetYPx: number;
  /** Horizontal offset (px) for Gregorian day number inside the cell corner. */
  gregDayOffsetXPx: number;
  /** Order of date numbers inside the cell corner. */
  cellDateOrder: 'greg_first' | 'heb_first';
  eventTitleFontPx: number;
  /** Vertical offset (px) for the center event titles inside each day cell. */
  eventOffsetYPx: number;
  /** Horizontal offset (px) for the center event titles inside each day cell. */
  eventOffsetXPx: number;
  shabbatTimesFontPx: number;
  /** Text color for Gregorian day number in each cell (CSS color). */
  gregDayTextColor: string;
  /** Text color for Hebrew day number in each cell (CSS color). */
  hebDayTextColor: string;
  /** Text color for event title lines in each cell (CSS color). */
  eventTitleTextColor: string;
  /** Text color for zmanim / Shabbat times block in each cell (CSS color). */
  shabbatTimesTextColor: string;
  showParsha: boolean;
  /**
   * Cell corner layout for Gregorian/Hebrew day numbers.
   * - `default`: current layout (dates at top area, events centered)
   * - `bottom_left`: dates at bottom-left, events move to top-right
   */
  cellCornerLayout: 'default' | 'bottom_left';
  /**
   * Extra layout option for `headerLayoutStyle === 'grid_integrated'`.
   * When enabled: events sit at the bottom-left; dates stay top-right.
   */
  gridIntegratedEventsBottomLeft: boolean;
  /** Optional visual split inside each cell (like a narrow side column). */
  cellSplitEnabled: boolean;
  /** Width of the side column (0.15..0.45). */
  cellSplitRatio: number;
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
  /** Vertical offset for the month grid only (does not move the header bar). */
  gridOffsetYPx: number;
  canvasBorderWidthPx: number;
  canvasBorderColor: string;
  /** Rounded corners for the outer canvas frame (px). */
  canvasOuterRadiusPx: number;
  gridBorderWidthPx: number;
  gridBorderColor: string;
  /** שורת כותרות ימי השבוע מעל הטבלה: א׳ ב׳… או שמות מלאים */
  weekdayHeaderMode: 'shortLetter' | 'fullName';
  /** Add English weekday (SUN/MON/…) to the left of the Hebrew label. */
  weekdayHeaderShowEnglish: boolean;
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
  /** Optional outline around "today" cell (studio/display). */
  todayOutlineColor: string;
  todayOutlineWidthPx: number;

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

  /** Show live finance RSS headlines sidebar in Display (tenant-specific). */
  showFinanceSidebar?: boolean;
  /** Optional RSS URL override for finance sidebar. */
  financeRssUrl?: string;
};

/** User-facing "0" baseline for the header separator Y offset (px). */
export const HEADER_DATE_SEPARATOR_BASELINE_Y_PX = 40;

export const DEFAULT_SETTINGS: CalendarSettings = {
  brandName: '',
  brandLogoDataUrl: '',
  brandAccentColor: '#E31B23',

  departmentName: '',
  departmentColor: '#E31B23',
  activeLayers: [],

  titleMain: 'לוח שנה עברי‑לועזי',
  titleSub: '',
  // Month title bar sits flush above the weekday/grid shell (no “floating” gap).
  headerLayoutStyle: 'grid_integrated',
  headerBarHeightPx: 78,
  headerBarRadiusPx: 16,
  headerBarBg: 'rgba(255,255,255,0.88)',
  headerBarBorderColor: '#E2E8F0',
  headerBarBorderWidthPx: 2,
  headerBarMarginBottomPx: 0,
  headerBarOffsetYPx: 0,
  headerBarMaxWidthPx: 0,
  headerBarShowEditButton: true,

  headerTextScaleXPercent: 100,
  headerTextScaleYPercent: 100,

  // תיבה 1
  headerBox1OffsetXPx: 0,
  headerBox1OffsetYPx: 8,
  headerBox1FontPx: 20,
  headerBox1FontWeight: 700,
  headerBox1Color: '#0F172A',
  headerBox1TextOverride: '',

  // תיבה 2
  headerBox2OffsetXPx: 0,
  headerBox2OffsetYPx: 36,
  headerBox2FontPx: 13,
  headerBox2FontWeight: 400,
  headerBox2Color: '#64748B',
  headerBox2TextOverride: '',

  // תיבה 3
  headerBox3OffsetXPx: 0,
  headerBox3OffsetYPx: 8,
  headerBox3FontPx: 22,
  headerBox3FontWeight: 400,
  headerBox3Color: '#0F172A',
  headerBox3TextOverride: '',

  // תיבה 4
  headerBox4OffsetXPx: 466,
  headerBox4OffsetYPx: 36,
  headerBox4FontPx: 16,
  headerBox4FontWeight: 400,
  headerBox4Color: '#334155',
  headerBox4TextOverride: '',
  headerDatePairSeparatorEnabled: false,
  headerDatePairSeparatorColor: '#94a3b8',
  headerDatePairSeparatorWidthPx: 2,
  headerDatePairSeparatorInsetYPx: 2,
  headerDatePairSeparatorOffsetYPx: 0,
  headerDatePairSeparatorOffsetMode: 'relative_v1',
  fontFamily: '"Heebo", "Assistant", system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
  fontFamilyByTarget: {},
  fontApplyTargets: ['all'],
  fontSizePx: 5,
  fontWeight: 400,
  gregDayFontPx: 8,
  hebDayFontPx: 7,
  hebDayFontWeight: 500,
  hebDayOffsetYPx: 0,
  hebDayOffsetXPx: 0,
  gregDayFontWeight: 600,
  gregDayOffsetYPx: 0,
  gregDayOffsetXPx: 0,
  cellDateOrder: 'greg_first',
  eventTitleFontPx: 6,
  eventOffsetYPx: 0,
  eventOffsetXPx: 0,
  shabbatTimesFontPx: 5,
  gregDayTextColor: '#334155',
  hebDayTextColor: '#0f172a',
  eventTitleTextColor: '#1e293b',
  shabbatTimesTextColor: '#1e293b',
  showParsha: true,
  cellCornerLayout: 'default',
  gridIntegratedEventsBottomLeft: false,
  cellSplitEnabled: false,
  cellSplitRatio: 0.28,
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
  layoutAutoFitToCanvas: false,
  gridOffsetYPx: 0,
  canvasBorderWidthPx: 2,
  canvasBorderColor: '#D8DEE9',
  canvasOuterRadiusPx: 18,
  gridBorderWidthPx: 2,
  gridBorderColor: '#E2E8F0',
  weekdayHeaderMode: 'shortLetter',
  weekdayHeaderShowEnglish: false,
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
  todayOutlineColor: 'rgba(16,185,129,0.55)',
  todayOutlineWidthPx: 3,

  pdfPagePreset: 'A4',
  pdfOrientation: 'portrait',
  pdfCustomWidthMm: 297,
  pdfCustomHeightMm: 210,
  pdfMarginMm: 0,
  pdfHtml2CanvasScale: 2,
  pdfExportCellHeightPx: 92,

  paddingCellColor: '#94a3b8',
  paddingCellStrength: 0.22,

  showFinanceSidebar: false,
  financeRssUrl: '',
};

// Bump cache version to force a clean reset when data gets inconsistent.
const STORAGE_KEY = 'hebrew-gregorian-calendar:settings:v5';

/** True on public 2026 web (strict hostname or env for custom domains). */
function shouldMigrate2026PublicDockHeader(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const v = String((import.meta as any)?.env?.VITE_PUBLIC_CALENDAR_2026 ?? '').trim();
    if (v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'yes') return true;
  } catch {
    // ignore
  }
  try {
    const host = String(window.location.hostname || '').toLowerCase();
    if (host === 'hebrew-calendar-2026.vercel.app' || host.endsWith('.hebrew-calendar-2026.vercel.app')) return true;
    // Vercel preview URLs: `…-git-…-user.vercel.app` (project name contains hebrew-calendar-2026).
    if (host.endsWith('.vercel.app') && host.includes('hebrew-calendar-2026')) return true;
  } catch {
    // ignore
  }
  return false;
}

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

    // Migration: older configs used a built-in default subtitle.
    // We removed that default so empty subtitle truly means "empty".
    if (merged.titleSub === 'מועדים · ראשי חודשים · זמני שבת') {
      merged.titleSub = '';
    }

    // Migration: "pocket_compact" style pack removed from Studio catalog.
    // If an older saved config references it, fall back to default.
    if (merged.stylePackId === 'pocket_compact') {
      merged.stylePackId = 'default';
    }

    // Coerce a few fields that must be numeric (older saves / manual edits can store strings)
    const numericKeys = [
      'fontSizePx',
      'gregDayFontPx',
      'gregDayOffsetYPx',
      'gregDayOffsetXPx',
      'hebDayFontPx',
      'eventTitleFontPx',
      'eventOffsetYPx',
      'eventOffsetXPx',
      'shabbatTimesFontPx',
      'cellSplitRatio',
      'headerBarHeightPx',
      'headerBarRadiusPx',
      'headerBarBorderWidthPx',
      'headerBarMarginBottomPx',
      'headerBarOffsetYPx',
      'headerBarMaxWidthPx',
      'headerTextScaleXPercent',
      'headerTextScaleYPercent',
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
      'headerDatePairSeparatorWidthPx',
      'headerDatePairSeparatorInsetYPx',
      'headerDatePairSeparatorOffsetYPx',
      'canvasPaddingPx',
      'canvasPaddingTopPx',
      'calendarLayoutScalePercent',
      'tableOffsetYPx',
      'gridOffsetYPx',
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

    // Header stretch: keep sane bounds.
    const hsx = Number((merged as any).headerTextScaleXPercent)
    ;(merged as any).headerTextScaleXPercent = Number.isFinite(hsx)
      ? Math.min(200, Math.max(50, Math.round(hsx)))
      : DEFAULT_SETTINGS.headerTextScaleXPercent
    const hsy = Number((merged as any).headerTextScaleYPercent)
    ;(merged as any).headerTextScaleYPercent = Number.isFinite(hsy)
      ? Math.min(200, Math.max(50, Math.round(hsy)))
      : DEFAULT_SETTINGS.headerTextScaleYPercent

    ;(merged as any).headerDatePairSeparatorEnabled = (merged as any).headerDatePairSeparatorEnabled === true
    const hdsW = Number((merged as any).headerDatePairSeparatorWidthPx)
    ;(merged as any).headerDatePairSeparatorWidthPx = Number.isFinite(hdsW)
      ? Math.min(12, Math.max(1, Math.round(hdsW)))
      : DEFAULT_SETTINGS.headerDatePairSeparatorWidthPx
    const hdsIn = Number((merged as any).headerDatePairSeparatorInsetYPx)
    ;(merged as any).headerDatePairSeparatorInsetYPx = Number.isFinite(hdsIn)
      ? Math.min(24, Math.max(0, Math.round(hdsIn)))
      : DEFAULT_SETTINGS.headerDatePairSeparatorInsetYPx
    const hdsOff = Number((merged as any).headerDatePairSeparatorOffsetYPx)
    const hdsMode = (merged as any).headerDatePairSeparatorOffsetMode
    if (hdsMode !== 'relative_v1') {
      // Migration (one-time): older configs stored absolute Y (where ~40px behaved like "0" visually).
      // Convert to user-facing relative offset where 0 aligns with the header text baseline.
      const rel = Number.isFinite(hdsOff) ? Math.round(hdsOff - HEADER_DATE_SEPARATOR_BASELINE_Y_PX) : NaN
      ;(merged as any).headerDatePairSeparatorOffsetYPx = Number.isFinite(rel)
        ? Math.min(200, Math.max(0, rel))
        : DEFAULT_SETTINGS.headerDatePairSeparatorOffsetYPx
      ;(merged as any).headerDatePairSeparatorOffsetMode = 'relative_v1'
    } else {
      ;(merged as any).headerDatePairSeparatorOffsetYPx = Number.isFinite(hdsOff)
        ? Math.min(200, Math.max(0, Math.round(hdsOff)))
        : DEFAULT_SETTINGS.headerDatePairSeparatorOffsetYPx
      ;(merged as any).headerDatePairSeparatorOffsetMode = 'relative_v1'
    }
    if (
      typeof (merged as any).headerDatePairSeparatorColor !== 'string' ||
      !(merged as any).headerDatePairSeparatorColor.trim()
    ) {
      ;(merged as any).headerDatePairSeparatorColor = DEFAULT_SETTINGS.headerDatePairSeparatorColor
    }

    if ((merged as any).cellCornerLayout !== 'bottom_left' && (merged as any).cellCornerLayout !== 'default') {
      ;(merged as any).cellCornerLayout = DEFAULT_SETTINGS.cellCornerLayout
    }
    if ((merged as any).cellDateOrder !== 'greg_first' && (merged as any).cellDateOrder !== 'heb_first') {
      ;(merged as any).cellDateOrder = DEFAULT_SETTINGS.cellDateOrder
    }
    const hfw = Number((merged as any).hebDayFontWeight)
    ;(merged as any).hebDayFontWeight = Number.isFinite(hfw)
      ? Math.min(900, Math.max(300, Math.round(hfw / 50) * 50))
      : DEFAULT_SETTINGS.hebDayFontWeight
    const hoy = Number((merged as any).hebDayOffsetYPx)
    ;(merged as any).hebDayOffsetYPx = Number.isFinite(hoy)
      ? Math.min(30, Math.max(-30, Math.round(hoy)))
      : DEFAULT_SETTINGS.hebDayOffsetYPx
    const hox = Number((merged as any).hebDayOffsetXPx)
    ;(merged as any).hebDayOffsetXPx = Number.isFinite(hox)
      ? Math.min(30, Math.max(-30, Math.round(hox)))
      : DEFAULT_SETTINGS.hebDayOffsetXPx
    const gfw = Number((merged as any).gregDayFontWeight)
    ;(merged as any).gregDayFontWeight = Number.isFinite(gfw)
      ? Math.min(900, Math.max(300, Math.round(gfw / 50) * 50))
      : DEFAULT_SETTINGS.gregDayFontWeight
    const goy = Number((merged as any).gregDayOffsetYPx)
    ;(merged as any).gregDayOffsetYPx = Number.isFinite(goy)
      ? Math.min(30, Math.max(-30, Math.round(goy)))
      : DEFAULT_SETTINGS.gregDayOffsetYPx
    const gox = Number((merged as any).gregDayOffsetXPx)
    ;(merged as any).gregDayOffsetXPx = Number.isFinite(gox)
      ? Math.min(30, Math.max(-30, Math.round(gox)))
      : DEFAULT_SETTINGS.gregDayOffsetXPx
    const eoy = Number((merged as any).eventOffsetYPx)
    ;(merged as any).eventOffsetYPx = Number.isFinite(eoy)
      ? Math.min(60, Math.max(-60, Math.round(eoy)))
      : DEFAULT_SETTINGS.eventOffsetYPx
    const eox = Number((merged as any).eventOffsetXPx)
    ;(merged as any).eventOffsetXPx = Number.isFinite(eox)
      ? Math.min(60, Math.max(-60, Math.round(eox)))
      : DEFAULT_SETTINGS.eventOffsetXPx
    ;(merged as any).cellSplitEnabled = (merged as any).cellSplitEnabled === true
    const sr = Number((merged as any).cellSplitRatio)
    ;(merged as any).cellSplitRatio = Number.isFinite(sr)
      ? Math.min(0.45, Math.max(0.15, sr))
      : DEFAULT_SETTINGS.cellSplitRatio

    // Department/theme fields
    if (typeof merged.departmentName !== 'string') merged.departmentName = DEFAULT_SETTINGS.departmentName;
    if (typeof merged.departmentColor !== 'string' || !merged.departmentColor.trim()) {
      merged.departmentColor = DEFAULT_SETTINGS.departmentColor;
    }
    if (typeof (merged as any).brandName !== 'string') (merged as any).brandName = DEFAULT_SETTINGS.brandName;
    if (typeof (merged as any).brandLogoDataUrl !== 'string') (merged as any).brandLogoDataUrl = DEFAULT_SETTINGS.brandLogoDataUrl;
    if (typeof (merged as any).brandAccentColor !== 'string' || !(merged as any).brandAccentColor.trim()) {
      ;(merged as any).brandAccentColor = DEFAULT_SETTINGS.brandAccentColor;
    }
    if (Array.isArray(merged.activeLayers)) {
      const next = (merged.activeLayers as any[])
        .filter((x) => typeof x === 'string' && x.trim())
        .map((s) => s.trim());
      // Keep order but remove duplicates
      const seen = new Set<string>();
      merged.activeLayers = next.filter((s) => (seen.has(s) ? false : (seen.add(s), true)));
    } else if (merged.activeLayers === undefined || merged.activeLayers === null) {
      merged.activeLayers = DEFAULT_SETTINGS.activeLayers;
    } else {
      merged.activeLayers = DEFAULT_SETTINGS.activeLayers;
    }

    // header bar migrations removed
    if (merged.weekdayHeaderMode !== 'shortLetter' && merged.weekdayHeaderMode !== 'fullName') {
      merged.weekdayHeaderMode = DEFAULT_SETTINGS.weekdayHeaderMode;
    }
    if (typeof (merged as any).weekdayHeaderShowEnglish !== 'boolean') {
      ;(merged as any).weekdayHeaderShowEnglish = DEFAULT_SETTINGS.weekdayHeaderShowEnglish
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
    if (typeof (merged as any).gridIntegratedEventsBottomLeft !== 'boolean') {
      ;(merged as any).gridIntegratedEventsBottomLeft = DEFAULT_SETTINGS.gridIntegratedEventsBottomLeft
    }
    merged.layoutCenterVertically = merged.layoutCenterVertically !== false;
    merged.layoutAutoFitToCanvas = merged.layoutAutoFitToCanvas === true;
    merged.layoutFillHeight = merged.layoutFillHeight !== false;
    const gridOffY = Number((merged as any).gridOffsetYPx)
    ;(merged as any).gridOffsetYPx = Number.isFinite(gridOffY)
      ? Math.min(500, Math.max(-500, Math.round(gridOffY)))
      : DEFAULT_SETTINGS.gridOffsetYPx
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
    if (typeof (merged as any).todayOutlineColor !== 'string' || !(merged as any).todayOutlineColor.trim()) {
      ;(merged as any).todayOutlineColor = DEFAULT_SETTINGS.todayOutlineColor
    }
    if (typeof (merged as any).gregDayTextColor !== 'string' || !(merged as any).gregDayTextColor.trim()) {
      ;(merged as any).gregDayTextColor = DEFAULT_SETTINGS.gregDayTextColor
    }
    if (typeof (merged as any).hebDayTextColor !== 'string' || !(merged as any).hebDayTextColor.trim()) {
      ;(merged as any).hebDayTextColor = DEFAULT_SETTINGS.hebDayTextColor
    }
    if (typeof (merged as any).eventTitleTextColor !== 'string' || !(merged as any).eventTitleTextColor.trim()) {
      ;(merged as any).eventTitleTextColor = DEFAULT_SETTINGS.eventTitleTextColor
    }
    if (typeof (merged as any).shabbatTimesTextColor !== 'string' || !(merged as any).shabbatTimesTextColor.trim()) {
      ;(merged as any).shabbatTimesTextColor = DEFAULT_SETTINGS.shabbatTimesTextColor
    }
    const tow = Number((merged as any).todayOutlineWidthPx)
    ;(merged as any).todayOutlineWidthPx = Number.isFinite(tow)
      ? Math.min(10, Math.max(0, Math.round(tow)))
      : DEFAULT_SETTINGS.todayOutlineWidthPx
    if (typeof merged.gridShellBg !== 'string' || !merged.gridShellBg.trim()) {
      merged.gridShellBg = DEFAULT_SETTINGS.gridShellBg;
    }
    // Coerce font apply targets (migration / manual edits)
    const allowedTargets = new Set(['all', 'settings', 'calendarHeader', 'cellDates', 'cellTimes', 'cellEvents']);
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

    ;(merged as any).showFinanceSidebar = (merged as any).showFinanceSidebar === true
    if (typeof (merged as any).financeRssUrl !== 'string') (merged as any).financeRssUrl = ''

    // Public 2026: older browsers still have `floating` + bottom margin in localStorage,
    // which overrides new defaults and keeps the header visually “detached”.
    let dockPersist = false;
    if (shouldMigrate2026PublicDockHeader()) {
      if (merged.headerLayoutStyle === 'floating') {
        merged.headerLayoutStyle = 'grid_integrated';
        dockPersist = true;
      }
      const mb = Number(merged.headerBarMarginBottomPx);
      if (Number.isFinite(mb) && mb > 0) {
        merged.headerBarMarginBottomPx = 0;
        dockPersist = true;
      }
      // Older saved configs left `headerBarMaxWidthPx` at a non-zero value (e.g. 932), which
      // centers a narrow bar inside the wide canvas; subsequently the horizontal offset sliders
      // appear to "start from the middle of the page" instead of the right edge. Force full-width
      // so the right edge of the bar coincides with the right edge of the calendar canvas.
      const cap = Number(merged.headerBarMaxWidthPx);
      if (Number.isFinite(cap) && cap > 0) {
        merged.headerBarMaxWidthPx = 0;
        dockPersist = true;
      }
    }
    if (dockPersist) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch {
        // ignore
      }
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


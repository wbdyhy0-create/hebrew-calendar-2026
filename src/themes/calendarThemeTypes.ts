import type { CalendarSettings } from '../utils/settings';

/** Preset border personality for calendar cells (maps to CSS). */
export type CalendarThemeCellBorder = 'thin' | 'double' | 'rounded';

/**
 * Logical theme contract (implementation maps into `CalendarSettings` + `cellBorderStyle` / radii).
 * - `headerBg` → `headerBarBg` (+ related header colors)
 * - `gridBg` → `gridShellBg` + `calendarCanvasFill`
 * - `accentColor` → carried implicitly via `eventBg` / borders in each preset patch
 */
export type CalendarTheme = {
  id: string;
  nameHe: string;
  headerBg: string;
  gridBg: string;
  fontFamily: string;
  cellBorder: CalendarThemeCellBorder;
  accentColor: string;
};

/** Catalog entry: metadata + partial settings layered over defaults when applying a theme. */
export type CalendarThemeCatalogEntry = {
  id: string;
  nameHe: string;
  /** Short flavor text for the picker card */
  blurbHe: string;
  /** CSS background for the thumbnail (gradient or color) */
  previewCss: string;
  cellBorder: CalendarThemeCellBorder;
  /** Keys merged after `DEFAULT_SETTINGS` when user picks this theme (כולל `headerLayoutStyle` וצבעים). */
  patch: Partial<CalendarSettings>;
};

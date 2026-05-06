export type SettingsSearchItem = {
  anchorId: string;
  /** כותרת בתוצאות */
  label: string;
  /** שם הקטגוריה המתקפלת */
  category: string;
  /** מילות מפתח נוספות (אנגלית, מפתחות הגדרות וכו׳) */
  tokens?: string;
};

/**
 * פריטים לחיפוש בהגדרות — כל `anchorId` קיים ב־`Calendar.tsx` עם אותו `id`.
 * מילות `tokens` משולבות עם לקסיקון (`settingsSearchLexicon.ts`) ועם מזהה העוגן — ראו `settingsSearchMatch.ts`.
 */
export const SETTINGS_SEARCH_ITEMS: SettingsSearchItem[] = [
  {
    anchorId: 'settings-anchor-themes',
    label: 'ערכות צבע מוכנות',
    category: 'ערכות צבע ומבנה',
    tokens: 'theme style pack בורר ערכת צבע',
  },
  {
    anchorId: 'settings-anchor-header-new',
    label: 'פס עליון (חדש) — תיבות כותרת',
    category: 'כותרת עליונה',
    tokens: 'header bar box hebrew gregorian title',
  },
  {
    anchorId: 'settings-anchor-header-separator',
    label: 'קו מפריד בין עברי ללועזי (אנכי)',
    category: 'כותרת עליונה',
    tokens:
      'separator line vertical קו מפריד אנכי headerDatePairSeparatorEnabled headerDatePairSeparatorColor headerDatePairSeparatorWidthPx headerDatePairSeparatorInsetYPx headerDatePairSeparatorOffsetYPx',
  },
  {
    anchorId: 'settings-anchor-zmanim',
    label: 'זמני כניסה ויציאה — כללי Hebcal',
    category: 'זמנים',
    tokens: 'hebcal zmanim shabbat candle city jerusalem tel aviv',
  },
  {
    anchorId: 'settings-anchor-zmanim-candle',
    label: 'נרות — דקות לפני שקיעה',
    category: 'זמנים',
    tokens: 'candle lighting minutes sunset',
  },
  {
    anchorId: 'settings-anchor-fast-tzait',
    label: 'צאת צומות — שיטה',
    category: 'זמנים',
    tokens: 'fast tzeit taanit hebcal sunset',
  },
  {
    anchorId: 'settings-anchor-fast-tzait-offset',
    label: 'צאת צומות — דקות אחרי שקיעה',
    category: 'זמנים',
    tokens: 'fast offset minutes',
  },
  {
    anchorId: 'settings-anchor-typography-family',
    label: 'משפחת גופן (Fallback)',
    category: 'טיפוגרפיה',
    tokens: 'font family heebo assistant typography',
  },
  {
    anchorId: 'settings-anchor-typography-apply',
    label: 'איפה להחיל גופן',
    category: 'טיפוגרפיה',
    tokens: 'font apply targets header cell',
  },
  {
    anchorId: 'settings-anchor-typography-upload',
    label: 'העלאת ומחיקת גופנים',
    category: 'טיפוגרפיה',
    tokens: 'font upload woff ttf delete',
  },
  {
    anchorId: 'settings-anchor-typography-weight',
    label: 'משקל גופן כללי',
    category: 'טיפוגרפיה',
    tokens: 'font weight bold',
  },
  {
    anchorId: 'settings-anchor-typography-sizes',
    label: 'גדלי טקסט בתאים (לועזי, עברי, אירועים, זמנים)',
    category: 'טיפוגרפיה',
    tokens: 'gregDayFontPx hebDayFontPx eventTitleFontPx shabbatTimesFontPx font size px',
  },
  {
    anchorId: 'settings-anchor-typography-color-greg',
    label: 'צבע מספר לועזי בתא',
    category: 'טיפוגרפיה',
    tokens: 'gregDayTextColor gregorian color typography',
  },
  {
    anchorId: 'settings-anchor-typography-color-heb',
    label: 'צבע יום עברי בתא',
    category: 'טיפוגרפיה',
    tokens: 'hebDayTextColor hebrew color typography',
  },
  {
    anchorId: 'settings-anchor-typography-color-events',
    label: 'צבע שם אירוע בתא',
    category: 'טיפוגרפיה',
    tokens: 'eventTitleTextColor event title color typography',
  },
  {
    anchorId: 'settings-anchor-typography-color-zmanim',
    label: 'צבע זמנים (שבת / כניסה / יציאה)',
    category: 'טיפוגרפיה',
    tokens: 'shabbatTimesTextColor zmanim candle havdalah color typography',
  },
  {
    anchorId: 'settings-anchor-padding-cells',
    label: 'תאי ריפוד / אפור חלש',
    category: 'ריפוד ותאים',
    tokens: 'padding cells grey gray month logo',
  },
  {
    anchorId: 'settings-anchor-padding-color',
    label: 'ריפוד — צבע בסיס',
    category: 'ריפוד ותאים',
    tokens: 'paddingCellColor padding',
  },
  {
    anchorId: 'settings-anchor-padding-strength',
    label: 'ריפוד — עוצמה',
    category: 'ריפוד ותאים',
    tokens: 'paddingCellStrength mix',
  },
  {
    anchorId: 'settings-anchor-grid-border-width',
    label: 'מסגרת חיצונית — עובי',
    category: 'מסגרות ורשת',
    tokens: 'gridBorderWidthPx outer frame',
  },
  {
    anchorId: 'settings-anchor-grid-border-color',
    label: 'מסגרת חיצונית — צבע',
    category: 'מסגרות ורשת',
    tokens: 'gridBorderColor shell',
  },
  {
    anchorId: 'settings-anchor-weekdays',
    label: 'פס ימי השבוע — כללי',
    category: 'ימי השבוע',
    tokens: 'weekday header row dow',
  },
  {
    anchorId: 'settings-anchor-weekdays-mode',
    label: 'פס ימי השבוע — פורמט (מקוצר / מלא)',
    category: 'ימי השבוע',
    tokens: 'weekdayHeaderMode short english',
  },
  {
    anchorId: 'settings-anchor-weekdays-bg',
    label: 'פס ימי השבוע — רקע',
    category: 'ימי השבוע',
    tokens: 'gridWeekdayHeaderBg',
  },
  {
    anchorId: 'settings-anchor-weekdays-height',
    label: 'פס ימי השבוע — גובה',
    category: 'ימי השבוע',
    tokens: 'gridWeekdayHeaderHeightPx',
  },
  {
    anchorId: 'settings-anchor-weekdays-text-offset',
    label: 'פס ימי השבוע — הזזת טקסט',
    category: 'ימי השבוע',
    tokens: 'gridWeekdayHeaderTextOffsetYPx',
  },
  {
    anchorId: 'settings-anchor-weekdays-text-color',
    label: 'פס ימי השבוע — צבע טקסט',
    category: 'ימי השבוע',
    tokens: 'gridWeekdayHeaderTextColor',
  },
  {
    anchorId: 'settings-anchor-weekdays-font',
    label: 'פס ימי השבוע — גודל ומשקל גופן',
    category: 'ימי השבוע',
    tokens: 'gridWeekdayHeaderFontPx',
  },
  {
    anchorId: 'settings-anchor-weekdays-underline',
    label: 'פס ימי השבוע — קו תחתון',
    category: 'ימי השבוע',
    tokens: 'gridWeekdayHeaderBorderBottom',
  },
  {
    anchorId: 'settings-anchor-weekdays-row-offset',
    label: 'פס ימי השבוע — היסט אנכי לשורה',
    category: 'ימי השבוע',
    tokens: 'gridWeekdayHeaderRowOffsetYPx',
  },
  {
    anchorId: 'settings-anchor-borders',
    label: 'קווי תאים — עובי וצבע',
    category: 'מסגרות ורשת',
    tokens: 'cellBorderWidthPx cellBorderColor',
  },
  {
    anchorId: 'settings-anchor-borders-toggle',
    label: 'הצגה או הסתרת קווי תאים',
    category: 'מסגרות ורשת',
    tokens: 'showCellBorders',
  },
  {
    anchorId: 'settings-anchor-colors',
    label: 'צבעי ימים — כללי',
    category: 'צבעי ימים',
    tokens: 'todayBg shabbatBg eventBg',
  },
  {
    anchorId: 'settings-anchor-colors-event',
    label: 'צבע יום עם אירוע',
    category: 'צבעי ימים',
    tokens: 'eventBg',
  },
  {
    anchorId: 'settings-anchor-colors-shabbat',
    label: 'צבע שבת',
    category: 'צבעי ימים',
    tokens: 'shabbatBg saturday',
  },
  {
    anchorId: 'settings-anchor-colors-today',
    label: 'צבע היום ומסגרת היום',
    category: 'צבעי ימים',
    tokens: 'todayBg todayOutlineColor todayOutlineWidthPx',
  },
  {
    anchorId: 'settings-anchor-export',
    label: 'ייצוא PDF — כללי',
    category: 'ייצוא',
    tokens: 'pdf export print month html2canvas',
  },
  {
    anchorId: 'settings-anchor-export-page',
    label: 'ייצוא PDF — גודל עמוד (A4 / A5 / מותאם)',
    category: 'ייצוא',
    tokens: 'pdfPagePreset pdfCustomWidthMm pdfOrientation',
  },
  {
    anchorId: 'settings-anchor-export-orientation',
    label: 'ייצוא PDF — כיוון עמוד',
    category: 'ייצוא',
    tokens: 'pdfOrientation landscape portrait',
  },
  {
    anchorId: 'settings-anchor-export-margin',
    label: 'ייצוא PDF — שוליים',
    category: 'ייצוא',
    tokens: 'pdfMarginMm margin',
  },
  {
    anchorId: 'settings-anchor-manual-edits',
    label: 'עריכה ידנית בתאים',
    category: 'כללי',
    tokens: 'manual edit override centerLines enableManualEdits',
  },
  {
    anchorId: 'settings-anchor-background',
    label: 'תמונת רקע — כללי',
    category: 'רקע וקנבס',
    tokens: 'background image url',
  },
  {
    anchorId: 'settings-anchor-background-mode',
    label: 'מצב תמונת רקע (שנה / חודש)',
    category: 'רקע וקנבס',
    tokens: 'backgroundImageMode perMonth year',
  },
  {
    anchorId: 'settings-anchor-background-upload',
    label: 'העלאת תמונת רקע',
    category: 'רקע וקנבס',
    tokens: 'upload file image',
  },
  {
    anchorId: 'settings-anchor-background-remove',
    label: 'הסרת תמונת רקע',
    category: 'רקע וקנבס',
    tokens: 'remove reset background',
  },
  {
    anchorId: 'settings-anchor-background-opacity',
    label: 'אטימות רקע',
    category: 'רקע וקנבס',
    tokens: 'backgroundOpacity',
  },
  {
    anchorId: 'settings-anchor-canvas-surface',
    label: 'מידות קנבס (כמו עמוד PDF)',
    category: 'רקע וקנבס',
    tokens: 'canvas surface pdf page width height',
  },
  {
    anchorId: 'settings-anchor-canvas-autofit',
    label: 'מתח למילוי (Auto-fit)',
    category: 'רקע וקנבס',
    tokens: 'layoutAutoFitToCanvas autofit scale',
  },
  {
    anchorId: 'settings-anchor-canvas-fillheight',
    label: 'מלא גובה',
    category: 'רקע וקנבס',
    tokens: 'layoutFillHeight',
  },
  {
    anchorId: 'settings-anchor-canvas-zoom',
    label: 'זום לוח (אחוז)',
    category: 'רקע וקנבס',
    tokens: 'calendarLayoutScalePercent zoom percent',
  },
  {
    anchorId: 'settings-anchor-grid-offset',
    label: 'הזזת הטבלה בלבד (למעלה/למטה)',
    category: 'רקע וקנבס',
    tokens: 'gridOffsetYPx table move offset y',
  },
  {
    anchorId: 'settings-anchor-canvas-center',
    label: 'מרכוז אנכי',
    category: 'רקע וקנבס',
    tokens: 'layoutCenterVertically',
  },
  {
    anchorId: 'settings-anchor-canvas-padding',
    label: 'ריפוד קנבס',
    category: 'רקע וקנבס',
    tokens: 'canvasPaddingPx canvasPaddingTopPx',
  },
  {
    anchorId: 'settings-anchor-canvas-border',
    label: 'מסגרת קנבס',
    category: 'רקע וקנבס',
    tokens: 'canvasBorderWidthPx canvasBorderColor canvasOuterRadiusPx',
  },
];

export type SettingsSearchItem = {
  anchorId: string;
  /** כותרת בתוצאות */
  label: string;
  /** שם הקטגוריה המתקפלת */
  category: string;
  /** מילות מפתח נוספות (אנגלית וכו׳) */
  tokens?: string;
};

/**
 * פריטים לחיפוש בהגדרות — כל עוגן קיים ב־Calendar עם id תואם.
 */
export const SETTINGS_SEARCH_ITEMS: SettingsSearchItem[] = [
  {
    anchorId: 'settings-anchor-themes',
    label: 'ערכות עיצוב מוכנות',
    category: 'ערכות נושא ומבנה כותרת',
    tokens: 'theme בורר ערכות נושא',
  },
  {
    anchorId: 'settings-anchor-zmanim',
    label: 'זמני כניסה ויציאה (Hebcal)',
    category: 'זמנים (Hebcal)',
    tokens: 'candle lighting havdalah zmanim',
  },
  {
    anchorId: 'settings-anchor-fast-tzait',
    label: 'צאת צומות (תעניות)',
    category: 'זמנים (Hebcal)',
    tokens: 'fast tzeit taanit',
  },
  {
    anchorId: 'settings-anchor-header',
    label: 'משפחת גופן ומשקל',
    category: 'טיפוגרפיה',
    tokens: 'font typography גופן גודל טקסט',
  },
  {
    anchorId: 'settings-anchor-padding-cells',
    label: 'משבצות ריקות / ריפוד / אפור',
    category: 'צבעים, מסגרות וריפוד',
    tokens: 'padding cells ריפוד',
  },
  {
    anchorId: 'settings-anchor-weekdays',
    label: 'כותרות ימי השבוע',
    category: 'צבעים, מסגרות וריפוד',
    tokens: 'weekday שורה עליונה',
  },
  {
    anchorId: 'settings-anchor-borders',
    label: 'מסגרת חיצונית וקווי תאים',
    category: 'צבעים, מסגרות וריפוד',
    tokens: 'border grid',
  },
  {
    anchorId: 'settings-anchor-colors',
    label: 'צבעי אירועים, שבת והיום',
    category: 'צבעים, מסגרות וריפוד',
    tokens: 'event shabbat today',
  },
  {
    anchorId: 'settings-anchor-export',
    label: 'ייצוא PDF — עמוד, שוליים, איכות, גובה תא',
    category: 'ייצוא PDF (חודש)',
    tokens: 'pdf margin scale html2canvas orientation A4 A5',
  },
  {
    anchorId: 'settings-anchor-manual-edits',
    label: 'עריכה ידנית לתאים',
    category: 'כותרת, מבנה וכללי',
    tokens: 'manual edit',
  },
  {
    anchorId: 'settings-anchor-headerbar-size',
    label: 'גובה ועיגול פס הכותרת',
    category: 'כותרת, מבנה וכללי',
    tokens: 'header bar height radius',
  },
  {
    anchorId: 'settings-anchor-headerbar-colors',
    label: 'צבעי פס הכותרת',
    category: 'כותרת, מבנה וכללי',
    tokens: 'header colors',
  },
  {
    anchorId: 'settings-anchor-header-month',
    label: 'חודש עברי ולועזי בפס',
    category: 'כותרת, מבנה וכללי',
    tokens: 'month pill gregorian hebrew',
  },
  {
    anchorId: 'settings-anchor-header-position',
    label: 'מיקום ורוחב פס הכותרת',
    category: 'כותרת, מבנה וכללי',
    tokens: 'position width offset',
  },
  {
    anchorId: 'settings-anchor-background',
    label: 'תמונת רקע ואטימות',
    category: 'רקע, קנבס ופריסה',
    tokens: 'background image opacity',
  },
  {
    anchorId: 'settings-anchor-canvas-surface',
    label: 'גודל קנבס וזום לוח',
    category: 'רקע, קנבס ופריסה',
    tokens: 'canvas zoom layout',
  },
];

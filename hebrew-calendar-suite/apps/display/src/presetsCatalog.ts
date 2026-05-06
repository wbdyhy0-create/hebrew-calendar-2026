import type { CalendarSettings } from '@hebrew-calendar/shared'

import type { StylePreset } from './stylePresets'

// כאן תטמיע 10 סגנונות קבועים. כל סגנון הוא snapshot של settings+overrides.
// מומלץ להעתיק מתוך "ייצוא סגנון (JSON)" בסטודיו, ואז להדביק לשדות settings/overrides.
export const PRESET_CATALOG: StylePreset[] = [
  {
    id: 'default',
    name: 'ברירת מחדל',
    settings: {} as CalendarSettings,
    overrides: {},
  },
  // דוגמאות (תמלא בפועל):
  // { id: 'poalim_red', name: 'הפועלים – אדום', settings: {...} as CalendarSettings, overrides: {...} },
  // { id: 'leumi_blue', name: 'לאומי – כחול', settings: {...} as CalendarSettings, overrides: {...} },
]


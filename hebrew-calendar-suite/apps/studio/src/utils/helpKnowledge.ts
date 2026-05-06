export type HelpAnswerBlock =
  | { kind: 'text'; text: string }
  | { kind: 'steps'; title?: string; steps: string[] };

export type HelpEntry = {
  id: string;
  /** Short title shown as the matched result. */
  title: string;
  /** Keywords / phrases (Hebrew) used for matching. */
  keywords: string[];
  /** Optional settings anchor to jump to. */
  anchorId?: string;
  /** Full answer blocks. */
  answer: HelpAnswerBlock[];
};

export const HELP_ENTRIES: HelpEntry[] = [
  {
    id: 'padding-cells',
    title: 'ריפוד (תאים אפורים מחוץ לחודש) — איך משנים?',
    keywords: ['ריפוד', 'תאים אפורים', 'ימים מחוץ לחודש', 'padding', 'אפור חלש', 'תאי ריפוד'],
    anchorId: 'settings-anchor-padding-cells',
    answer: [
      {
        kind: 'steps',
        steps: [
          'פתח הגדרות עיצוב → “צבעים, מסגרות וריפוד”.',
          'גש לסעיף “תאי ריפוד/אפור חלש”.',
          'שנה צבע ריפוד ועוצמה (Strength) כדי לשלוט כמה “אפור” זה נראה.',
        ],
      },
    ],
  },
  {
    id: 'cell-borders',
    title: 'איך משנים מסגרת של התאים וקווי הטבלה?',
    keywords: ['מסגרת', 'קווים', 'קווי תאים', 'גבול', 'border', 'עובי קו', 'צבע קו', 'סגנון קו'],
    anchorId: 'settings-anchor-borders',
    answer: [
      {
        kind: 'steps',
        steps: [
          'פתח הגדרות עיצוב → “צבעים, מסגרות וריפוד”.',
          'גש ל“מסגרת חיצונית וקווי תאים”.',
          'הפעל/כבה “הצג קווי תאים”, ושנה עובי/צבע/סגנון.',
        ],
      },
    ],
  },
  {
    id: 'background-photo',
    title: 'איך שמים תמונת רקע ללוח (ואטימות)?',
    keywords: ['רקע', 'תמונת רקע', 'צילום רקע', 'אטימות', 'opacity', 'background', 'תמונה חודשית', 'רקע שנתי'],
    anchorId: 'settings-anchor-background',
    answer: [
      {
        kind: 'steps',
        steps: [
          'פתח הגדרות עיצוב → “רקע, קנבס ופריסה”.',
          'בחר מצב תמונת רקע (חודשי/שנתי/ללא).',
          'שנה “אטימות רקע” כדי לקבל קריאות טובה בתוך התאים.',
        ],
      },
    ],
  },
  {
    id: 'zoom-calendar',
    title: 'איך עושים זום ללוח בתוך הקנבס?',
    keywords: ['זום', 'scale', 'הגדלה', 'הקטנה', 'זום הלוח', 'קנבס', 'calendarLayoutScalePercent'],
    anchorId: 'settings-anchor-canvas-surface',
    answer: [
      {
        kind: 'steps',
        steps: [
          'פתח הגדרות עיצוב → “רקע, קנבס ופריסה”.',
          'שנה “זום הלוח (%)”.',
          'אם יש חפיפות, הורד מעט את הזום או הגדל גובה תאים.',
        ],
      },
    ],
  },
  {
    id: 'weekday-row',
    title: 'איך משנים את פס ימי השבוע (גובה/צבע/גופן)?',
    keywords: ['ימי שבוע', 'פס ימי השבוע', 'שורת ימים', 'א ב ג', 'גובה פס', 'צבע פס', 'גופן ימי השבוע'],
    anchorId: 'settings-anchor-weekdays',
    answer: [
      {
        kind: 'steps',
        steps: [
          'פתח הגדרות עיצוב → “צבעים, מסגרות וריפוד”.',
          'גש ל“פס ימי השבוע”.',
          'שנה גובה, צבע רקע, צבע טקסט, גודל גופן, ומשקל.',
        ],
      },
    ],
  },
  {
    id: 'export-html',
    title: 'איך מורידים HTML/PNG/PDF ומה הכי אמין?',
    keywords: ['יצוא', 'הורדה', 'HTML', 'PNG', 'PDF', 'אמין', 'נשבר', 'print', 'הדפסה'],
    anchorId: 'settings-anchor-export',
    answer: [
      {
        kind: 'text',
        text: 'כלל אצבע: PNG הכי “יציב” (תמונה), PDF הכי טוב להדפסה, HTML טוב כבסיס להדפסה/המרה. אם כרום חוסם הורדות מרובות — השתמש ב“שמירה בשם” או פתח בטאב עליון (לא בתוך iframe).',
      },
    ],
  },
  {
    id: 'cell-image-add',
    title: 'איך מוסיפים תמונה בתוך משבצת?',
    keywords: [
      'תמונה',
      'להוסיף תמונה',
      'להכניס תמונה',
      'משבצת',
      'תא',
      'תמונה בתא',
      'רקע בתא',
      'החלפת תמונה',
      'מחיקת תמונה',
    ],
    anchorId: 'settings-anchor-manual-edits',
    answer: [
      {
        kind: 'steps',
        title: 'הוספת תמונה לתא',
        steps: [
          'לחץ על המשבצת הרצויה בלוח (בתוך התא).',
          'בחר באפשרות עריכת תמונה/תא (בפאנל “עריכה מהירה” או מתוך אפשרויות עריכה ידנית).',
          'בחר תמונה מהמחשב ושמור.',
          'כדי להזיז/להתאים בתוך התא, השתמש בהגדרות התא (כיסוי/הכלה, אטימות, הזזה).',
        ],
      },
      {
        kind: 'text',
        text: 'טיפ: אם הורדת PNG נכשלת בגלל תמונות חיצוניות, אפשר לייצא במצב “Safe” (ללא תמונות) ואז להוסיף תמונות בעימוד.',
      },
    ],
  },
  {
    id: 'cell-image-delete',
    title: 'איך מוחקים תמונה מתא?',
    keywords: ['מחק תמונה', 'מחיקת תמונה', 'להסיר תמונה', 'תמונה', 'תא', 'משבצת'],
    anchorId: 'settings-anchor-manual-edits',
    answer: [
      {
        kind: 'steps',
        steps: [
          'לחץ על התא שיש בו תמונה.',
          'פתח את אפשרויות “עריכה ידנית” / “תמונה בתא”.',
          'לחץ “מחק תמונה”.',
        ],
      },
    ],
  },
  {
    id: 'font-times',
    title: 'איך מגדילים/מקטינים גופן של “זמנים”?',
    keywords: ['זמנים', 'כניסה', 'יציאה', 'הבדלה', 'הדלקת נרות', 'גופן זמנים', 'גודל זמנים'],
    anchorId: 'settings-anchor-zmanim',
    answer: [
      {
        kind: 'steps',
        steps: ['פתח הגדרות עיצוב → “זמנים (Hebcal)”', 'שנה את “גודל גופן זמנים”.'],
      },
    ],
  },
  {
    id: 'font-events',
    title: 'איך משנים גודל/עובי גופן של אירועים במרכז התא?',
    keywords: ['אירועים', 'אירוע', 'כותרת אירוע', 'גופן אירועים', 'מרכז התא', 'טקסט באמצע'],
    anchorId: 'settings-anchor-header',
    answer: [
      {
        kind: 'steps',
        steps: ['פתח הגדרות עיצוב → “טיפוגרפיה”', 'שנה את “גודל כותרת אירוע” ואת משקל הגופן.'],
      },
    ],
  },
  {
    id: 'font-days',
    title: 'איך משנים גודל תאריך עברי/לועזי בתוך התא?',
    keywords: ['תאריך', 'לועזי', 'עברי', 'גופן תאריך', 'מספר לועזי', 'מספר עברי', 'יום בחודש'],
    anchorId: 'settings-anchor-header',
    answer: [
      {
        kind: 'steps',
        steps: [
          'פתח הגדרות עיצוב → “טיפוגרפיה”.',
          'שנה את “גודל יום עברי” ו/או “גודל יום לועזי”.',
        ],
      },
    ],
  },
  {
    id: 'cell-color',
    title: 'איך משנים צבע משבצת (שבת/אירוע/היום)?',
    keywords: ['צבע תא', 'צבע משבצת', 'שבת', 'אירוע', 'היום', 'רקע תא'],
    anchorId: 'settings-anchor-colors',
    answer: [
      {
        kind: 'steps',
        steps: ['פתח הגדרות עיצוב → “צבעים, מסגרות וריפוד”', 'שנה את צבעי שבת/אירוע/היום.'],
      },
    ],
  },
  {
    id: 'center-calendar',
    title: 'איך ממרכזים את הלוח בתוך הקנבס?',
    keywords: ['מרכוז', 'מרכז', 'קנבס', 'לוח באמצע', 'align', 'center calendar'],
    anchorId: 'settings-anchor-canvas-surface',
    answer: [
      {
        kind: 'steps',
        steps: [
          'פתח הגדרות עיצוב → “רקע, קנבס ופריסה”.',
          'הפעל/כבה “מרכוז הלוח” (אופקי/אנכי לפי האפשרויות).',
          'אם הלוח לא “נמתח”, בדוק שגם עטיפות הפריסה אינן על max-content.',
        ],
      },
    ],
  },
];


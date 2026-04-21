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


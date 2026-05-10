# hebrew-calendar-suite

Monorepo for:

- `apps/admin`: **Admin / publishing** (הגדרות, פרסום קונפיגורציה ל־KV, טננטים)
- `apps/studio`: editor / style creation
- `apps/display`: display app (read-only, kiosks)
- `packages/shared`: shared calendar logic + UI primitives

## Dev

```bash
npm install
npm run dev:studio
npm run dev:display
npm run dev:admin
```

## Vercel (חשוב: Root Directory)

ב־Vercel כל אפליקציה היא **פרויקט נפרד** עם **אותו Git repo** ו־**Root Directory שונה**.

| אפליקציה | כשה־Git repo הוא **`hebrew-calendar-2026`** (יש תיקיית `hebrew-calendar-suite` מתחת לשורש) | כשה־Git repo הוא **`hebrew-calendar-suite`** בלבד (מונורפו בשורש) |
|----------|----------------------------------------------------------------------------------------|------------------------------------------------------------------|
| Admin (כולל פרסום) | `hebrew-calendar-suite/apps/admin` | `apps/admin` |
| Display (תצוגה) | `hebrew-calendar-suite/apps/display` | `apps/display` |
| Studio בתוך הסוויטה | `hebrew-calendar-suite/apps/studio` | `apps/studio` |

אם ב־`hebrew-calendar-admin.vercel.app` מופיע ממשק **תצוגה** (משיכת קונפיג, מסך מלא…) במקום אדמין — יש לבדוק שהפרויקט ב־Vercel מהודר מתוך שורת **Admin** בטבלה, לא מ־`display` ולא משורש המאגר.


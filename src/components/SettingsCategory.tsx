import type { ReactNode } from 'react';

type Props = {
  /** תו או אימוג׳י קטן לכותרת (למשל 📁) */
  icon: string;
  title: string;
  children: ReactNode;
};

/**
 * קטגוריה מתקפלת בהגדרות — `<details>` סגור כברירת מחדל, בלי גלילה אנכית ארוכה בכל הפאנל.
 */
export function SettingsCategory({ icon, title, children }: Props) {
  return (
    <details className="rounded-lg border border-slate-200 bg-slate-50/30 shadow-sm open:bg-white open:shadow-md">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none hover:bg-slate-100/80 [&::-webkit-details-marker]:hidden">
        <span className="text-base leading-none select-none" aria-hidden>
          {icon}
        </span>
        <span className="min-w-0 flex-1 text-right">{title}</span>
        <span
          className="shrink-0 text-[10px] font-normal text-slate-400"
          aria-hidden
        >
          ▾
        </span>
      </summary>
      <div className="border-t border-slate-200/90 px-2 pb-3 pt-2 sm:px-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
      </div>
    </details>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';

import { SETTINGS_SEARCH_ITEMS } from '../data/settingsSearchItems';

type Props = {
  onPick: (anchorId: string) => void;
};

function matchesQuery(query: string, label: string, category: string, tokens?: string) {
  const t = query.trim();
  if (!t) return false;
  const tl = t.toLowerCase();
  const hay = `${label} ${category} ${tokens ?? ''}`.toLowerCase();
  return hay.includes(tl);
}

export function SettingsSearchBar({ onPick }: Props) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    if (!q.trim()) return [];
    return SETTINGS_SEARCH_ITEMS.filter((item) =>
      matchesQuery(q, item.label, item.category, item.tokens),
    ).slice(0, 14);
  }, [q]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const showList = open && q.trim().length > 0;
  const showEmpty = showList && results.length === 0;

  return (
    <div ref={rootRef} className="relative px-3 pb-2.5 pt-0 sm:px-4">
      <label htmlFor="settings-panel-search" className="sr-only">
        חיפוש פריט בהגדרות
      </label>
      <input
        id="settings-panel-search"
        type="search"
        dir="rtl"
        autoComplete="off"
        spellCheck={false}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (q.trim()) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === 'Enter' && results.length > 0) {
            e.preventDefault();
            onPick(results[0].anchorId);
            setQ('');
            setOpen(false);
          }
        }}
        placeholder="חיפוש פריט בקטגוריות (למשל: PDF, ריפוד, גופן)…"
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-sky-200 placeholder:text-slate-400 focus:border-sky-300 focus:ring-2"
      />

      {showList && results.length > 0 ? (
        <ul
          role="listbox"
          aria-label="תוצאות חיפוש"
          className="absolute left-3 right-3 top-full z-30 mt-1 max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg sm:left-4 sm:right-4"
        >
          {results.map((item) => (
            <li key={item.anchorId} role="presentation">
              <button
                type="button"
                role="option"
                className="flex w-full flex-col gap-0.5 px-3 py-2 text-right text-sm text-slate-800 hover:bg-sky-50"
                onClick={() => {
                  onPick(item.anchorId);
                  setQ('');
                  setOpen(false);
                }}
              >
                <span className="font-medium text-slate-900">{item.label}</span>
                <span className="text-xs text-slate-500">{item.category}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {showEmpty ? (
        <div className="absolute left-3 right-3 top-full z-30 mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-lg sm:left-4 sm:right-4">
          לא נמצאו תוצאות
        </div>
      ) : null}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';

import { SETTINGS_SEARCH_ITEMS } from '../data/settingsSearchItems';
import { searchSettingsItems, tokenizeSearchQuery } from '../data/settingsSearchMatch';

type Props = {
  onPick: (anchorId: string) => void;
};

export function SettingsSearchBar({ onPick }: Props) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const words = useMemo(() => tokenizeSearchQuery(q), [q]);

  const { results, mode } = useMemo(
    () => searchSettingsItems(SETTINGS_SEARCH_ITEMS, words),
    [words],
  );

  useEffect(() => {
    setActiveIdx((prev) => {
      if (results.length === 0) return -1;
      if (prev < 0) return 0;
      return Math.min(prev, results.length - 1);
    });
  }, [results]);

  useEffect(() => {
    if (!open || activeIdx < 0 || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-search-hit="${activeIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx, open, results]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const showList = open && words.length > 0;
  const showEmpty = showList && results.length === 0;

  const pickAt = (idx: number) => {
    const item = results[idx];
    if (!item) return;
    onPick(item.anchorId);
    setQ('');
    setOpen(false);
    setActiveIdx(-1);
  };

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
          if (words.length > 0) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            setActiveIdx(-1);
            (e.target as HTMLInputElement).blur();
            return;
          }
          if (!showList || results.length === 0) return;

          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActiveIdx((i) => {
              const base = i < 0 ? -1 : i;
              return Math.min(base + 1, results.length - 1);
            });
            return;
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setOpen(true);
            setActiveIdx((i) => Math.max((i < 0 ? 0 : i) - 1, 0));
            return;
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            const idx = activeIdx >= 0 ? activeIdx : 0;
            pickAt(idx);
          }
        }}
        placeholder="חיפוש — מילים מצמצמות; חיפוש חופשי אם אין התאמה מלאה (פסיקים/רווחים)…"
        className="w-full rounded-lg border-2 border-sky-600 bg-white px-3 py-2 text-sm font-medium text-slate-950 shadow-md shadow-sky-200/60 outline-none ring-offset-1 placeholder:text-slate-700 placeholder:font-medium focus:border-sky-700 focus:ring-2 focus:ring-sky-500/70 focus:ring-offset-0"
        aria-activedescendant={
          showList && activeIdx >= 0 ? `settings-search-opt-${results[activeIdx]?.anchorId}` : undefined
        }
        aria-controls="settings-search-listbox"
        aria-expanded={showList && results.length > 0}
        aria-autocomplete="list"
        role="combobox"
      />

      {showList && results.length > 0 ? (
        <div className="absolute left-3 right-3 top-full z-30 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg sm:left-4 sm:right-4">
          {mode === 'relaxed' ? (
            <p className="border-b border-amber-100 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
              חיפוש חופשי: לפחות אחת מהמילים התאימה — הוסיפו מילים או דיוק כדי לצמצם.
            </p>
          ) : null}
          <ul
            ref={listRef}
            id="settings-search-listbox"
            role="listbox"
            aria-label="תוצאות חיפוש"
            className="max-h-52 overflow-y-auto py-1"
          >
            {results.map((item, idx) => (
              <li key={item.anchorId} role="presentation">
                <button
                  type="button"
                  id={`settings-search-opt-${item.anchorId}`}
                  role="option"
                  aria-selected={idx === activeIdx}
                  data-search-hit={idx}
                  className={`flex w-full flex-col gap-0.5 px-3 py-2 text-right text-sm text-slate-800 hover:bg-sky-50 ${
                    idx === activeIdx ? 'bg-sky-100' : ''
                  }`}
                  onMouseEnter={() => setActiveIdx(idx)}
                  onClick={() => pickAt(idx)}
                >
                  <span className="font-medium text-slate-900">{item.label}</span>
                  <span className="text-xs text-slate-500">{item.category}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {showEmpty ? (
        <div className="absolute left-3 right-3 top-full z-30 mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-lg sm:left-4 sm:right-4">
          לא נמצאו תוצאות
        </div>
      ) : null}
    </div>
  );
}

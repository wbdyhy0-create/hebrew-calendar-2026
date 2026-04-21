import { useMemo, useState } from 'react';
import type { HelpEntry, HelpAnswerBlock } from '../utils/helpKnowledge';
import { searchHelp } from '../utils/helpSearch';

function AnswerBlockView({ block }: { block: HelpAnswerBlock }) {
  if (block.kind === 'text') {
    return <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{block.text}</div>;
  }
  return (
    <div>
      {block.title ? (
        <div className="text-sm font-normal text-slate-900 mb-2">{block.title}</div>
      ) : null}
      <ol className="list-decimal pr-6 text-sm text-slate-700 space-y-1 leading-relaxed">
        {block.steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </div>
  );
}

export function HelpAssistant({
  entries,
  onJumpToAnchor,
  onClose,
}: {
  entries: HelpEntry[];
  onJumpToAnchor: (anchorId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const matches = useMemo(() => searchHelp(entries, query, 6), [entries, query]);
  const best = matches[0]?.entry ?? null;

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-[min(980px,96vw)] h-[min(86vh,900px)] rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-slate-50">
          <div className="text-sm font-normal text-slate-900">מדריך תפעולי</div>
          <button
            type="button"
            className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50"
            onClick={onClose}
          >
            סגור
          </button>
        </div>

        <div className="p-4 border-b border-slate-200">
          <label className="block text-xs font-normal text-slate-600 mb-2">
            שאל שאלה (אפשר משפט חופשי)
          </label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='לדוגמה: "איך מוסיפים תמונה לתא?" או "איך מגדילים גופן של זמנים?"'
            className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
            dir="rtl"
            autoFocus
          />
          <div className="mt-2 text-[11px] text-slate-500">
            טיפ: אפשר לכתוב גם “זמנים”, “תמונה”, “מרכוז”, “צבע תא”, “גודל גופן” וכו׳.
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-0">
            <div className="border-b lg:border-b-0 lg:border-l border-slate-200 p-3">
              <div className="text-xs font-normal text-slate-600 mb-2">התאמות</div>
              {query.trim().length === 0 ? (
                <div className="text-sm text-slate-500">הקלד שאלה כדי לראות תשובות.</div>
              ) : matches.length === 0 ? (
                <div className="text-sm text-slate-500">
                  לא מצאתי תשובה מדויקת. נסה לנסח עם מילים כמו “תמונה”, “גופן”, “זמנים”, “מרכוז”.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {matches.map((m) => (
                    <button
                      key={m.entry.id}
                      type="button"
                      className={[
                        'text-right rounded-xl border px-3 py-2 text-sm',
                        best?.id === m.entry.id
                          ? 'border-sky-200 bg-sky-50 text-slate-900'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700',
                      ].join(' ')}
                      onClick={() => {
                        setQuery(m.entry.title);
                      }}
                      title={m.matched.length ? `מילים שזוהו: ${m.matched.slice(0, 6).join(', ')}` : undefined}
                    >
                      {m.entry.title}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4">
              {best ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-base font-normal text-slate-900">{best.title}</div>
                    {best.anchorId ? (
                      <button
                        type="button"
                        className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                        onClick={() => onJumpToAnchor(best.anchorId!)}
                      >
                        פתח בהגדרות
                      </button>
                    ) : null}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                    {best.answer.map((b, i) => (
                      <AnswerBlockView key={i} block={b} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-600">הקלד שאלה כדי לראות תשובה.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


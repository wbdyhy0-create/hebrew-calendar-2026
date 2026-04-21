import { CALENDAR_THEME_CATALOG } from '../themes/calendarThemes';

type Props = {
  open: boolean;
  currentThemeId: string;
  onClose: () => void;
  onSelectTheme: (themeId: string) => void;
};

const STYLE_PACK_IDS = new Set([
  'retro_yeshivish',
  'minimal_clean_nolines',
  'pocket_compact',
  'combined_header',
  'double_headerbar',
  'modern_soft',
  'overlay_header',
  'handdrawn_art',
  'compact_torani',
]);

export function StylePackModal({ open, currentThemeId, onClose, onSelectTheme }: Props) {
  if (!open) return null;

  const entries = CALENDAR_THEME_CATALOG.filter((t) => STYLE_PACK_IDS.has(t.id));

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="style-pack-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="style-pack-title" className="text-lg font-normal text-slate-900">
              ערכת סגנונות
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              בחרו מבנה/סגנון. זה משנה פריסה (כותרת, קווים, פינות, קומפקטיות) ויכול לשנות גם טיפוגרפיה.
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            onClick={onClose}
          >
            סגור
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-100 pb-4">
          <button
            type="button"
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              currentThemeId === 'default'
                ? 'border-sky-500 bg-sky-50 text-sky-900'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
            onClick={() => {
              onSelectTheme('default');
              onClose();
            }}
          >
            ברירת מחדל (מערכת)
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {entries.map((t) => {
            const active = currentThemeId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                className={[
                  'flex flex-col overflow-hidden rounded-xl border text-right transition',
                  active
                    ? 'border-sky-500 ring-2 ring-sky-300'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-sm',
                ].join(' ')}
                onClick={() => {
                  onSelectTheme(t.id);
                  onClose();
                }}
              >
                <div className="h-16 w-full shrink-0 border-b border-slate-100" style={{ background: t.previewCss }} />
                <div className="flex flex-1 flex-col gap-0.5 p-2.5">
                  <div className="text-sm font-normal text-slate-900">{t.nameHe}</div>
                  <div className="text-[11px] leading-snug text-slate-600">{t.blurbHe}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}


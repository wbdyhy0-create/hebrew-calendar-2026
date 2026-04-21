import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  addMonths,
  format,
  getDaysInMonth,
} from 'date-fns';

import { getMonthGridWeeks } from '../utils/calendarGrid';
import { getMonthGridDaysFlat } from '../utils/calendarGrid';
import {
  abbreviateRoshChodeshHeTitle,
  isTaanitEstherFastNameHe,
  getHebrewHeaderForGregorianMonth,
  formatHebrewHeaderText,
  getDayEventsByGregorianDate,
  formatTodayYmdJerusalem,
  getIsoWeekdaySun0Jerusalem,
  formatParshaDisplayHe,
  mergeTitlesWithFastNameIfMissing,
  uniqAbbrevHebrewTitleLines,
  isErevPesachGregorian,
  isErevSheviShelPesachGregorian,
  isPesachIGregorian,
  isSheviShelPesachGregorian,
  isRoshHashanaHolidayTitleHe as isRoshHashanaDay,
  isYomKippurHolidayTitleHe as isYomKippurDay,
} from '../utils/hebrewDate';
import { buildCalendarDayMetas } from '../utils/monthViewModel';
import { formatGregorianMonthYearHebrew } from '../utils/gregorianHebrew';
import { downloadPdfFromHtml, exportPdfBlobFromHtml } from '../utils/pdf';
import {
  downloadHtmlFromPrintableHtml,
  exportPngBlobFromPrintableHtml,
  downloadPngFromPrintableHtml,
} from '../utils/exportDownloads';
import {
  downloadBlobViaPopup,
  isEmbeddedFrame,
  openDownloadPopup,
  openInNewTab,
  requestSaveHandle,
  saveBlobToHandle,
  saveTextToHandle,
} from '../utils/download';
import {
  resolveCalendarLayoutZoomPercent,
  resolveCanvasOuterRadiusPx,
} from '../utils/calendarDocumentStyles';
import {
  calendarSurfaceDimensionsPx,
  resolvePdfPageDimensionsMm,
} from '../utils/pdfPage';
import { buildPrintableMonthHtml } from '../utils/printMonth';
import { buildPrintableYearPdfHtml } from '../utils/printYearPdf';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type CalendarSettings,
  type HeaderLayoutStyle,
} from '../utils/settings';
import { HAVDALAH_MINS_AFTER_SUNSET } from '../utils/zmanimConstants';
import {
  isCenterContentSuppressedByOverride,
  loadOverrides,
  recurringOverrideKeyFromIsoDate,
  resolveDayTextOverride,
  saveOverrides,
  type OverridesMap,
} from '../utils/overrides';
import { mixHexWithWhite } from '../utils/color';
import { getWeekdayHeaderLabels } from '../utils/weekdayHeaders';
import { getBackgroundImageForMonth } from '../utils/backgroundImage';
import { cssCellEdgeBorder } from '../utils/cellBorderCss';
import { applyDesignThemeId, applyStylePackId, getThemeEntry } from '../themes/calendarThemes';
import { ThemePickerModal } from './ThemePickerModal';
import { StylePackModal } from './StylePackModal';
import {
  DEFAULT_HEADER_WYSIWYG_CLASSIC_ALIGN,
  DEFAULT_HEADER_WYSIWYG_CLASSIC_PCT,
} from '../utils/headerWysiwyg';
import { CalendarMonthChrome } from './CalendarMonthChrome';
import { SettingsCategory } from './SettingsCategory';
import { SettingsSearchBar } from './SettingsSearchBar';
import { HebcalZmanimLine } from './HebcalZmanimLine';
import { HelpAssistant } from './HelpAssistant';
import { HELP_ENTRIES } from '../utils/helpKnowledge';
import {
  cssFontFamilyForUploaded,
  deleteStoredFont,
  deleteStoredFontsByFamily,
  getStoredFont,
  listStoredFonts,
  putStoredFont,
  type StoredFont,
} from '../utils/fontStore';
import { makeUploadedFamilyName, registerStoredFont } from '../utils/fontRuntime';

function FontFamilyPicker({
  label,
  value,
  onPick,
  uploadedFonts,
  fontBusy,
  onDeleteFamily,
  fontLabelForValue,
  builtins,
  defaultValue,
}: {
  label: string;
  value: string;
  onPick: (v: string) => void;
  uploadedFonts: Array<Omit<StoredFont, 'data'>>;
  fontBusy: string | null;
  onDeleteFamily: (family: string) => Promise<void>;
  fontLabelForValue: (value: string) => string;
  builtins: Array<{ label: string; value: string }>;
  defaultValue: string;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [menuRect, setMenuRect] = useState<{ left: number; top: number; width: number } | null>(
    null,
  );

  useEffect(() => {
    if (!open) return;
    const compute = () => {
      const el = btnRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const left = Math.max(8, Math.min(window.innerWidth - 8 - r.width, r.left));
      setMenuRect({ left, top: r.bottom + 8, width: r.width });
    };
    compute();
    const onResize = () => compute();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  return (
    <div className="sm:col-span-2 lg:col-span-3">
      <div className="text-sm text-slate-700">{label}</div>
      <div className="relative mt-1">
        <button
          ref={btnRef}
          type="button"
          className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm text-right hover:bg-slate-50 active:bg-slate-100 flex items-center justify-between gap-2"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="truncate">{fontLabelForValue(value)}</span>
          <span aria-hidden="true" className="text-slate-500">
            ▾
          </span>
        </button>

        {open
          ? createPortal(
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-[89] cursor-default bg-transparent"
                  aria-label="סגור רשימת גופנים"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpen(false);
                  }}
                />
                <div
                  role="listbox"
                  className="fixed rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden z-[90]"
                  style={{
                    left: menuRect?.left ?? 8,
                    top: menuRect?.top ?? 80,
                    width: menuRect?.width ?? 300,
                    maxWidth: 'calc(100vw - 16px)',
                  }}
                >
                  <button
                    type="button"
                    role="option"
                    className="w-full text-right px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between gap-2"
                    onClick={() => {
                      setOpen(false);
                      onPick(defaultValue);
                    }}
                  >
                    <span className="truncate">ברירת מחדל</span>
                    {value === defaultValue ? (
                      <span className="text-emerald-600 text-xs">נבחר</span>
                    ) : null}
                  </button>

                  {uploadedFonts.length ? (
                    <>
                      <div className="px-3 py-2 text-[11px] font-normal text-slate-600 bg-slate-50 border-t border-slate-200">
                        גופנים שהועלו
                      </div>
                      <div className="max-h-[240px] overflow-auto">
                        {(() => {
                          const groups = new Map<string, Omit<StoredFont, 'data'>[]>();
                          for (const f of uploadedFonts) {
                            const arr = groups.get(f.family) ?? [];
                            arr.push(f);
                            groups.set(f.family, arr);
                          }
                          const families = Array.from(groups.entries()).sort((a, b) =>
                            a[0].localeCompare(b[0], 'he'),
                          );
                          return families.map(([family, faces]) => {
                            const v = cssFontFamilyForUploaded(family);
                            const isSelected = v === value;
                            const weights = Array.from(
                              new Set(
                                faces
                                  .map((x) => (typeof x.weight === 'string' ? x.weight : '400'))
                                  .filter(Boolean),
                              ),
                            )
                              .sort((a, b) => Number(a) - Number(b))
                              .join(', ');
                            return (
                              <div
                                key={family}
                                className="w-full px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between gap-2"
                              >
                                <button
                                  type="button"
                                  role="option"
                                  className="min-w-0 flex-1 text-right"
                                  onClick={() => {
                                    setOpen(false);
                                    onPick(v);
                                  }}
                                  style={{ fontFamily: v }}
                                >
                                  <div className="truncate">{family}</div>
                                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                    משקלים שהועלו: {weights || '400'}
                                  </div>
                                </button>
                                <div className="flex items-center gap-2 shrink-0">
                                  {isSelected ? (
                                    <span className="text-emerald-600 text-xs">נבחר</span>
                                  ) : null}
                                  <button
                                    type="button"
                                    className="h-7 w-7 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                                    title="מחק גופן"
                                    aria-label={`מחק גופן ${family}`}
                                    disabled={fontBusy !== null}
                                    onClick={async (e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (fontBusy) return;
                                      await onDeleteFamily(family);
                                    }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </>
                  ) : null}

                  <div className="px-3 py-2 text-[11px] font-normal text-slate-600 bg-slate-50 border-t border-slate-200">
                    גופנים מובנים
                  </div>
                  {builtins.map((opt) => {
                    const isSelected = opt.value === value;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        role="option"
                        className="w-full text-right px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between gap-2"
                        onClick={() => {
                          setOpen(false);
                          onPick(opt.value);
                        }}
                        style={{ fontFamily: opt.value }}
                      >
                        <span className="truncate">{opt.label}</span>
                        {isSelected ? (
                          <span className="text-emerald-600 text-xs">נבחר</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </>,
              document.body,
            )
          : null}
      </div>
    </div>
  );
}

export function Calendar() {
  const [viewDate, setViewDate] = useState<Date>(() => new Date());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<CalendarSettings>(() =>
    typeof window === 'undefined' ? DEFAULT_SETTINGS : loadSettings(),
  );
  const [overrides, setOverrides] = useState<OverridesMap>(() =>
    typeof window === 'undefined' ? {} : loadOverrides(),
  );
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<string>('');
  const [editOffsetX, setEditOffsetX] = useState<number>(0);
  const [editOffsetY, setEditOffsetY] = useState<number>(0);
  const [editAlign, setEditAlign] = useState<'right' | 'center' | 'left'>('center');
  const imgPickerRef = useRef<HTMLInputElement | null>(null);
  const [pendingImageKey, setPendingImageKey] = useState<string | null>(null);
  const imgDragRef = useRef<{
    key: string;
    startX: number;
    startY: number;
    startOffX: number;
    startOffY: number;
    moved: boolean;
  } | null>(null);
  const [saveFlash, setSaveFlash] = useState<string | null>(null);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [uploadedFonts, setUploadedFonts] = useState<Omit<StoredFont, 'data'>[]>([]);
  const [fontBusy, setFontBusy] = useState<string | null>(null);
  const fontPickerRef = useRef<HTMLInputElement | null>(null);
  const [fontDragActive, setFontDragActive] = useState(false);

  const fontTargets = settings.fontApplyTargets ?? ['all'];
  const hasFontTarget = (t: (typeof fontTargets)[number]) =>
    Array.isArray(fontTargets) && fontTargets.includes(t);
  const shouldApplyFontEverywhere = hasFontTarget('all');
  const shouldApplyFontTo = (
    t: Exclude<(typeof fontTargets)[number], 'all'>,
  ): boolean => shouldApplyFontEverywhere || hasFontTarget(t);
  const resolveFontFamilyFor = (
    t: Exclude<(typeof fontTargets)[number], 'all'>,
  ): string => {
    const map = settings.fontFamilyByTarget;
    const v = map && typeof map === 'object' ? (map as any)[t] : undefined;
    return typeof v === 'string' && v.trim() ? v : settings.fontFamily;
  };

  const uploadFontFiles = async (files: File[]) => {
    const ok = files.filter((f) => /\.(ttf|otf|woff2?|)$/i.test(f.name) || String(f.type).includes('font'));
    if (!ok.length) {
      setSaveFlash('לא נמצאו קבצי גופן (ttf/otf/woff/woff2).');
      window.setTimeout(() => setSaveFlash(null), 2500);
      return;
    }

    for (const file of ok) {
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      setFontBusy(id);
      try {
        const data = await file.arrayBuffer();
        const lower = file.name.toLowerCase();
        const inferWeight = (): string => {
          if (/(extra|ultra)[-_ ]?bold|extrabold|ultrabold/.test(lower)) return '800';
          if (/black|heavy/.test(lower)) return '900';
          if (/bold/.test(lower)) return '700';
          if (/semi[-_ ]?bold|semibold|demi[-_ ]?bold|demibold/.test(lower)) return '600';
          if (/medium/.test(lower)) return '500';
          if (/light/.test(lower)) return '300';
          if (/thin/.test(lower)) return '200';
          return '400';
        };
        const inferStyle = (): string => (/(italic|oblique)/.test(lower) ? 'italic' : 'normal');

        const family = makeUploadedFamilyName(file.name);
        const rec: StoredFont = {
          id,
          family,
          fileName: file.name,
          weight: inferWeight(),
          style: inferStyle(),
          mime: file.type || 'font/ttf',
          data,
          createdAt: Date.now(),
        };
        await putStoredFont(rec);
        await registerStoredFont(rec);
        setUploadedFonts((prev) => [
          ...prev,
          {
            id: rec.id,
            family: rec.family,
            fileName: rec.fileName,
            weight: rec.weight,
            style: rec.style,
            mime: rec.mime,
            createdAt: rec.createdAt,
          },
        ]);
        setSettings((s) => ({ ...s, fontFamily: cssFontFamilyForUploaded(rec.family) }));
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        setSaveFlash(`שגיאה בהעלאת גופן: ${file.name}`);
        window.setTimeout(() => setSaveFlash(null), 3500);
      } finally {
        setFontBusy(null);
      }
    }
  };

  // Note: font picker dropdown closing is handled by an overlay + Escape (inside each picker),
  // to avoid tricky event ordering with capture listeners inside scroll/overflow containers.

  const FONT_BUILTINS: Array<{ label: string; value: string }> = [
    { label: 'Heebo (אם מותקן)', value: '"Heebo", system-ui, "Segoe UI", Arial, sans-serif' },
    {
      label: 'Assistant (אם מותקן)',
      value: '"Assistant", system-ui, "Segoe UI", Arial, sans-serif',
    },
    { label: 'System', value: 'system-ui, -apple-system, "Segoe UI", Arial, sans-serif' },
    { label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
  ];

  const fontLabelForValue = (value: string): string => {
    if (value === DEFAULT_SETTINGS.fontFamily) return 'ברירת מחדל';
    const uploadedMatch = uploadedFonts.find((f) => cssFontFamilyForUploaded(f.family) === value);
    if (uploadedMatch) return uploadedMatch.family;
    const builtin = FONT_BUILTINS.find((b) => b.value === value);
    if (builtin) return builtin.label;
    if (value.includes('Heebo')) return 'Heebo (אם מותקן)';
    if (value.includes('Assistant')) return 'Assistant (אם מותקן)';
    if (value.startsWith('system-ui')) return 'System';
    if (value.includes('Georgia')) return 'Serif';
    return 'בחירה';
  };

  const deleteUploadedFontEverywhere = async (family: string) => {
    const ok = window.confirm(`האם למחוק את הגופן "${family}" מהאפליקציה?`);
    if (!ok) return;
    try {
      setFontBusy(family);
      await deleteStoredFontsByFamily(family);
      setUploadedFonts((prev) => prev.filter((x) => x.family !== family));
      setSettings((s) => {
        const next: any = { ...s };
        if (typeof next.fontFamily === 'string' && next.fontFamily.includes(family)) {
          next.fontFamily = DEFAULT_SETTINGS.fontFamily;
        }
        const map = (next.fontFamilyByTarget && typeof next.fontFamilyByTarget === 'object')
          ? { ...next.fontFamilyByTarget }
          : {};
        for (const k of ['settings', 'calendarHeader', 'cellDates', 'cellTimes', 'cellEvents'] as const) {
          const v = map[k];
          if (typeof v === 'string' && v.includes(family)) delete map[k];
        }
        next.fontFamilyByTarget = map;
        return next;
      });
      setSaveFlash('הגופן נמחק');
      window.setTimeout(() => setSaveFlash(null), 1500);
    } finally {
      setFontBusy(null);
    }
  };

  // FontFamilyPicker is defined at module scope (above) so its open-state doesn't reset on every Calendar re-render.
  const ensureDownloadsWork = (): boolean => {
    // When embedded in a cross-origin iframe, Chrome can block both file pickers and repeated downloads.
    // Best UX: open the calendar in a top-level tab and ask the user to download there.
    if (isEmbeddedFrame()) {
      openInNewTab(window.location.href);
      setSaveFlash('הורדות חסומות בהטמעה — פתחתי את הלוח בטאב חדש להורדה');
      window.setTimeout(() => setSaveFlash(null), 3500);
      return false;
    }
    return true;
  };

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTitle, setPreviewTitle] = useState<string>('');
  const [previewKind, setPreviewKind] = useState<'pdf' | 'png' | 'html'>('pdf');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewSrcDoc, setPreviewSrcDoc] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewSuggested, setPreviewSuggested] = useState<string>('');

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const [bgMonthIdx, setBgMonthIdx] = useState<number>(() => new Date().getMonth());
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [stylePackOpen, setStylePackOpen] = useState(false);
  const [shortcutOpen, setShortcutOpen] = useState<string | null>(null);
  const [inspect, setInspect] = useState<{
    key: 'none' | 'header' | 'weekdays' | 'cell' | 'background';
    x: number;
    y: number;
  }>({ key: 'none', x: 0, y: 0 });
  const [headerLayoutEditMode, setHeaderLayoutEditMode] = useState(false);

  const viewedGregorianMonthKey = format(viewDate, 'yyyy-MM');

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    saveOverrides(overrides);
  }, [overrides]);

  /** ברירת החודש לשמירת תמונה תואמת את החודש המוצג בלוח (מניעת שמירה לאינדקס ישן מעליית האפליקציה). */
  useEffect(() => {
    if (settings.backgroundImageMode !== 'perMonth') return;
    const parts = viewedGregorianMonthKey.split('-');
    const m1 = Number(parts[1]);
    if (!Number.isFinite(m1) || m1 < 1 || m1 > 12) return;
    setBgMonthIdx(m1 - 1);
  }, [settings.backgroundImageMode, viewedGregorianMonthKey]);

  /** Inspect / "עריכה מהירה" opens on click, not hover; closes on outside click. */
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const el = e.target as Element | null;
      if (!el) return;

      if (el.closest('[data-inspect-panel]')) return;

      const hit = el.closest('[data-inspect]') as HTMLElement | null;
      const key = hit?.dataset?.inspect;

      if (el.closest('button, a, input, textarea, select, label')) {
        if (!el.closest('[data-inspect-panel]')) {
          setInspect((s) => ({ ...s, key: 'none' }));
        }
        return;
      }

      if (key === 'header' || key === 'weekdays' || key === 'cell' || key === 'background') {
        setInspect({ key, x: e.clientX, y: e.clientY });
        e.stopPropagation();
        return;
      }

      setInspect((s) => ({ ...s, key: 'none' }));
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, []);

  /** Download menu: close on outside click or Escape. */
  useEffect(() => {
    if (!downloadMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = e.target as Element | null;
      if (!el) return;
      if (downloadMenuRef.current && downloadMenuRef.current.contains(el)) return;
      setDownloadMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDownloadMenuOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [downloadMenuOpen]);

  // Load uploaded fonts from IndexedDB and register them.
  useEffect(() => {
    const run = async () => {
      try {
        const list = await listStoredFonts();
        setUploadedFonts(list);
        for (const meta of list) {
          const full = await getStoredFont(meta.id);
          if (full) await registerStoredFont(full);
        }
      } catch {
        // ignore
      }
    };
    run();
  }, []);

  const openEditorForDay = (gKey: string, suggested: string) => {
    const existing = resolveDayTextOverride(overrides, gKey);
    const savedLines = existing?.centerLines;
    const hasVisibleSaved =
      Array.isArray(savedLines) && savedLines.some((l) => String(l).trim().length > 0);
    const suppressAuto = isCenterContentSuppressedByOverride(existing);
    const curX = existing?.centerOffsetX ?? 0;
    const curY = existing?.centerOffsetY ?? 0;
    const curAlign = existing?.centerAlign ?? 'center';
    setEditKey(gKey);
    // Visible saved lines → restore them. Explicit "empty center" override → open blank (do NOT
    // inject Hebcal suggestion: saving that draft would undo recurring suppression for all years).
    // No override at all → Hebcal suggestion as a starting point.
    setEditDraft(
      hasVisibleSaved ? (savedLines ?? []).join('\n') : suppressAuto ? '' : suggested,
    );
    setEditOffsetX(curX);
    setEditOffsetY(curY);
    setEditAlign(curAlign);
  };

  const pickImageForCell = (gKey: string) => {
    setPendingImageKey(gKey);
    // reset value so picking same file twice still triggers change
    if (imgPickerRef.current) imgPickerRef.current.value = '';
    imgPickerRef.current?.click();
  };

  const startImageDrag = (key: string, e: React.PointerEvent) => {
    if (!settings.enableManualEdits) return;
    const manual = resolveDayTextOverride(overrides, key);
    if (!manual?.imageDataUrl) return;
    imgDragRef.current = {
      key,
      startX: e.clientX,
      startY: e.clientY,
      startOffX: Number(manual.imageOffsetX) || 0,
      startOffY: Number(manual.imageOffsetY) || 0,
      moved: false,
    };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    e.preventDefault();
    e.stopPropagation();
  };

  const moveImageDrag = (e: React.PointerEvent) => {
    const st = imgDragRef.current;
    if (!st) return;
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;
    if (!st.moved && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) st.moved = true;
    const nextX = st.startOffX + dx;
    const nextY = st.startOffY + dy;
    setOverrides((prev) => {
      const copy = { ...prev };
      const storeKey = recurringOverrideKeyFromIsoDate(st.key);
      const cur = resolveDayTextOverride(copy, st.key) ?? copy[storeKey];
      if (!cur) return copy;
      copy[storeKey] = { ...cur, imageOffsetX: nextX, imageOffsetY: nextY };
      if (/^\d{4}-\d{2}-\d{2}$/.test(st.key)) delete copy[st.key];
      return copy;
    });
    e.preventDefault();
    e.stopPropagation();
  };

  const endImageDrag = (e: React.PointerEvent) => {
    const st = imgDragRef.current;
    if (!st) return;
    imgDragRef.current = null;
    e.preventDefault();
    e.stopPropagation();
  };

  const openHeaderEditor = () => {
    setSettingsOpen(true);
    // Scroll to top so the settings panel is visible
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // ignore
    }
  };

  const weeks = useMemo(() => getMonthGridWeeks(viewDate), [viewDate]);
  const gridDays = useMemo(() => getMonthGridDaysFlat(viewDate), [viewDate]);
  const paddingBg = useMemo(() => {
    const strength = Number(settings.paddingCellStrength);
    return mixHexWithWhite(
      settings.paddingCellColor,
      Number.isFinite(strength) ? strength : DEFAULT_SETTINGS.paddingCellStrength,
    );
  }, [settings.paddingCellColor, settings.paddingCellStrength]);
  const gridStart = weeks[0]?.[0] ?? viewDate;
  const gridEnd = weeks.at(-1)?.at(-1) ?? viewDate;

  const candleLightingMinsResolved = settings.candleLightingMins === 20 ? 20 : 40;

  const dayEventsJer = useMemo(() => {
    return getDayEventsByGregorianDate(gridStart, gridEnd, {
      il: true,
      location: 'Jerusalem',
      havdalahMins: HAVDALAH_MINS_AFTER_SUNSET,
      candleLightingMins: candleLightingMinsResolved,
      fastTzaitStyle: settings.fastTzaitStyle,
      fastSunsetOffsetMins: settings.fastSunsetOffsetMins,
    });
  }, [
    gridStart,
    gridEnd,
    candleLightingMinsResolved,
    settings.fastTzaitStyle,
    settings.fastSunsetOffsetMins,
  ]);

  const dayEventsTA = useMemo(() => {
    return getDayEventsByGregorianDate(gridStart, gridEnd, {
      il: true,
      location: 'TelAviv',
      havdalahMins: HAVDALAH_MINS_AFTER_SUNSET,
      candleLightingMins: candleLightingMinsResolved,
      fastTzaitStyle: settings.fastTzaitStyle,
      fastSunsetOffsetMins: settings.fastSunsetOffsetMins,
    });
  }, [
    gridStart,
    gridEnd,
    candleLightingMinsResolved,
    settings.fastTzaitStyle,
    settings.fastSunsetOffsetMins,
  ]);

  const headerHd = useMemo(
    () => getHebrewHeaderForGregorianMonth(viewDate),
    [viewDate],
  );
  const hebrewMonthTitle = useMemo(() => formatHebrewHeaderText(headerHd), [headerHd]);
  const weekdayHeaders = useMemo(
    () => getWeekdayHeaderLabels(settings.weekdayHeaderMode),
    [settings.weekdayHeaderMode],
  );

  const dayMetas = useMemo(
    () =>
      buildCalendarDayMetas({
        viewDate,
        gridDays,
        dayEventsJer,
        dayEventsTA,
        todayKey: formatTodayYmdJerusalem(),
      }),
    [gridDays, dayEventsJer, dayEventsTA, viewDate],
  );

  const gMonthDays = getDaysInMonth(viewDate);
  const bgUrl = useMemo(
    () => getBackgroundImageForMonth(settings, viewDate.getMonth()),
    [
      viewDate,
      settings.backgroundImageMode,
      settings.backgroundImageDataUrl,
      settings.backgroundImagesByMonth,
    ],
  );
  const canvasBgStyle = useMemo(() => {
    const opacity = Math.min(1, Math.max(0, Number(settings.backgroundOpacity) || 0));
    const overlay = Math.min(1, Math.max(0, 1 - opacity));
    const lace1 =
      'radial-gradient(circle at 1px 1px, rgba(148,163,184,0.35) 1px, transparent 1px)';
    const lace2 =
      'radial-gradient(circle at 12px 12px, rgba(148,163,184,0.20) 1px, transparent 1px)';
    if (bgUrl) {
      return {
        backgroundImage: `${lace1}, ${lace2}, linear-gradient(rgba(255,255,255,${overlay}), rgba(255,255,255,${overlay})), url(${bgUrl})`,
        backgroundSize: '24px 24px, 24px 24px, cover, cover',
        backgroundPosition: '0 0, 0 0, center, center',
        backgroundRepeat: 'repeat, repeat, no-repeat, no-repeat',
      } as const;
    }
    return {
      backgroundImage: `${lace1}, ${lace2}`,
      backgroundSize: '24px 24px, 24px 24px',
      backgroundPosition: '0 0, 0 0',
      backgroundRepeat: 'repeat, repeat',
    } as const;
  }, [bgUrl, settings.backgroundOpacity]);

  const canvasSurfacePx = useMemo(
    () => calendarSurfaceDimensionsPx(settings),
    [
      settings.pdfPagePreset,
      settings.pdfOrientation,
      settings.pdfCustomWidthMm,
      settings.pdfCustomHeightMm,
    ],
  );

  const canvasInnerRef = useRef<HTMLDivElement | null>(null);
  const calendarContentRef = useRef<HTMLDivElement | null>(null);
  const [autoFitScale, setAutoFitScale] = useState(1);
  const effectiveVisualScale =
    (settings.layoutAutoFitToCanvas ? autoFitScale : 1) *
    (resolveCalendarLayoutZoomPercent(settings) / 100);
  const scaledPx = (px: number) => {
    const s =
      Number.isFinite(effectiveVisualScale) && effectiveVisualScale > 0
        ? effectiveVisualScale
        : 1;
    return px / s;
  };
  const cellFontScale =
    Number(settings.fontSizePx) > 0
      ? Number(settings.fontSizePx) / Number(DEFAULT_SETTINGS.fontSizePx || 14)
      : 1;
  const cellScaledPx = (px: number) => scaledPx(px * cellFontScale);

  useEffect(() => {
    if (!settings.layoutAutoFitToCanvas) {
      // When auto-fit is disabled, keep scale strictly at 1 (plus user zoom).
      setAutoFitScale(1);
      return;
    }
    const container = canvasInnerRef.current;
    const content = calendarContentRef.current;
    if (!container || !content) return;

    const compute = () => {
      const cw = Math.max(1, container.clientWidth);
      // Use layout width rather than scrollWidth.
      // `scrollWidth` is affected by non-wrapping lines (e.g. zmanim clocks),
      // which makes auto-fit “fight” font-size sliders and look like nothing changes.
      const naturalW = Math.max(1, content.clientWidth || content.offsetWidth || content.scrollWidth);
      const next = cw / naturalW;
      if (!Number.isFinite(next) || next <= 0) return;
      setAutoFitScale((prev) => (Math.abs(prev - next) < 0.01 ? prev : next));
    };

    compute();
    const ro = new ResizeObserver(() => compute());
    ro.observe(container);
    ro.observe(content);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    settings.layoutAutoFitToCanvas,
    settings.calendarLayoutScalePercent,
    settings.headerLayoutStyle,
    settings.headerWysiwygManualActive,
    settings.headerWysiwygClassicPct,
    settings.tableOffsetYPx,
    settings.gridWeekdayHeaderHeightPx,
    settings.pdfPagePreset,
    settings.pdfOrientation,
    settings.pdfCustomWidthMm,
    settings.pdfCustomHeightMm,
    settings.gregDayFontPx,
    settings.hebDayFontPx,
    settings.eventTitleFontPx,
    settings.shabbatTimesFontPx,
  ]);

  const pdfPageMm = useMemo(
    () => resolvePdfPageDimensionsMm(settings),
    [
      settings.pdfPagePreset,
      settings.pdfOrientation,
      settings.pdfCustomWidthMm,
      settings.pdfCustomHeightMm,
    ],
  );

  const cellEdgeBorder = useMemo(
    () =>
      cssCellEdgeBorder(
        settings.showCellBorders,
        settings.cellBorderWidthPx,
        settings.cellBorderColor,
        settings.cellBorderStyle,
      ),
    [
      settings.showCellBorders,
      settings.cellBorderWidthPx,
      settings.cellBorderColor,
      settings.cellBorderStyle,
    ],
  );
  const cellRadiusPx = Math.max(0, Math.round(Number(settings.cellCornerRadiusPx) || 0));

  const supportsEyeDropper =
    typeof (window as any).EyeDropper !== 'undefined' &&
    typeof (window as any).EyeDropper === 'function';

  const [livePicker, setLivePicker] = useState<null | {
    label: string;
    original: string;
    current: string;
    commit: (hex: string) => void;
    revert: () => void;
  }>(null);
  const livePickerOverlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!livePicker) return;
    // Focus overlay so Escape works reliably.
    window.setTimeout(() => livePickerOverlayRef.current?.focus(), 0);
  }, [livePicker]);

  const rgbToHex = (rgb: string): string | null => {
    // Supports: rgb(r,g,b) / rgba(r,g,b,a)
    const m = rgb
      .replace(/\s+/g, '')
      .match(/^rgba?\((\d{1,3}),(\d{1,3}),(\d{1,3})(?:,([0-9.]+))?\)$/i);
    if (!m) return null;
    const r = Math.max(0, Math.min(255, Number(m[1])));
    const g = Math.max(0, Math.min(255, Number(m[2])));
    const b = Math.max(0, Math.min(255, Number(m[3])));
    const to2 = (n: number) => n.toString(16).padStart(2, '0');
    return `#${to2(r)}${to2(g)}${to2(b)}`.toUpperCase();
  };

  const normalizeToHexForColorInput = (raw: string, fallbackHex = '#FFFFFF'): string => {
    const v = String(raw ?? '').trim();
    if (/^#[0-9a-f]{6}$/i.test(v)) return v.toUpperCase();
    const fromRgb = rgbToHex(v);
    if (fromRgb) return fromRgb;
    // Common named values from presets:
    if (isTransparent(v)) return fallbackHex;
    return fallbackHex;
  };

  const isTransparent = (v: string) => {
    const s = v.trim().toLowerCase();
    return s === 'transparent' || s === 'rgba(0,0,0,0)' || s === 'rgba(0, 0, 0, 0)';
  };

  const sampleHexAtPoint = (clientX: number, clientY: number): string | null => {
    const stack = document.elementsFromPoint(clientX, clientY);
    const overlay = stack.find((el) => (el as HTMLElement)?.dataset?.liveEyedropper === '1');
    const el =
      stack.find((n) => n !== overlay && (n as HTMLElement).nodeType === 1) ??
      document.elementFromPoint(clientX, clientY);
    if (!el || !(el instanceof HTMLElement)) return null;

    // Prefer a visible background; fall back to text color.
    let cur: HTMLElement | null = el;
    for (let i = 0; i < 6 && cur; i++) {
      const cs = getComputedStyle(cur);
      const bg = cs.backgroundColor;
      if (bg && !isTransparent(bg)) {
        const hex = rgbToHex(bg);
        if (hex) return hex;
      }
      cur = cur.parentElement;
    }
    const cs = getComputedStyle(el);
    const hex = rgbToHex(cs.color);
    return hex;
  };

  const pickColorFromScreen = async (apply: (hex: string) => void) => {
    try {
      const AnyWindow = window as any;
      if (!AnyWindow.EyeDropper) {
        setSaveFlash('הטפטפת זמינה כרגע רק בדפדפנים תומכים (Chrome/Edge).');
        window.setTimeout(() => setSaveFlash(null), 2200);
        return;
      }
      const ed = new AnyWindow.EyeDropper();
      const res = await ed.open();
      const hex = String(res?.sRGBHex ?? '').trim();
      if (hex) apply(hex);
    } catch (e) {
      // user cancelled or permission denied - ignore quietly
    }
  };

  const ColorInput = ({
    value,
    onChange,
    label,
  }: {
    value: string;
    onChange: (hex: string) => void;
    label: string;
  }) => (
    <div className="text-sm text-slate-700 pointer-events-auto">
      <div className="mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <input
          className="w-full h-10 rounded-md border border-slate-200 bg-white px-2"
          type="color"
          value={normalizeToHexForColorInput(value)}
          onChange={(e) => onChange(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
        />
        <button
          type="button"
          className={[
            'h-10 w-10 shrink-0 rounded-md border bg-white hover:bg-slate-50',
            livePicker?.label === label ? 'border-sky-400 ring-2 ring-sky-200 bg-sky-50' : 'border-slate-200',
          ].join(' ')}
          title="טפטפת חיה (תצוגה מיידית)"
          aria-label="טפטפת חיה"
          aria-pressed={livePicker?.label === label}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            const original = normalizeToHexForColorInput(value);
            setLivePicker((prev) => {
              if (prev?.label === label) {
                prev.revert();
                return null;
              }
              setSaveFlash('טפטפת פעילה: הזז את העכבר על הלוח, קליק לקיבוע, Esc לביטול');
              window.setTimeout(() => setSaveFlash(null), 1800);
              return {
                label,
                original,
                current: original,
                commit: (hex) => onChange(hex),
                revert: () => onChange(original),
              };
            });
          }}
        >
          🎯
        </button>
        {supportsEyeDropper ? (
          <button
            type="button"
            className="h-10 w-10 shrink-0 rounded-md border border-slate-200 bg-white hover:bg-slate-50"
            title="טפטפת מערכת (EyeDropper)"
            aria-label="טפטפת מערכת (EyeDropper)"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => pickColorFromScreen(onChange)}
          >
            ⛏️
          </button>
        ) : null}
      </div>
    </div>
  );

  const openAndJumpToSetting = (anchorId: string) => {
    setSettingsOpen(true);
    // Wait a tick for the settings panel to mount before searching for anchors.
    window.setTimeout(() => jumpToSetting(anchorId), 0);
  };

  const jumpToSetting = (anchorId: string) => {
    setSettingsOpen(true);
    window.setTimeout(() => {
      const el = document.getElementById(anchorId);
      if (!el) return;
      let p: HTMLElement | null = el.parentElement;
      while (p) {
        if (p.tagName === 'DETAILS') {
          (p as HTMLDetailsElement).open = true;
        }
        p = p.parentElement;
      }
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add('ring-2', 'ring-sky-300');
      window.setTimeout(() => el.classList.remove('ring-2', 'ring-sky-300'), 800);
    }, 60);
  };

  const INSPECT_ACTIONS: Record<
    Exclude<(typeof inspect)['key'], 'none'>,
    { title: string; items: { label: string; anchorId: string }[] }[]
  > = {
    header: [
      {
        title: 'ערכות מוכנות',
        items: [{ label: 'בורר ערכות עיצוב (12)', anchorId: 'settings-anchor-themes' }],
      },
      {
        title: 'עיצוב פס עליון',
        items: [
          { label: 'גובה/עיגול/מסגרת פס עליון', anchorId: 'settings-anchor-headerbar-size' },
          { label: 'צבעים בפס עליון', anchorId: 'settings-anchor-headerbar-colors' },
          { label: 'חודש עברי/לועזי בפס עליון', anchorId: 'settings-anchor-header-month' },
          { label: 'מיקום/רוחב פס עליון', anchorId: 'settings-anchor-header-position' },
        ],
      },
      {
        title: 'ייצוא',
        items: [
          { label: 'הגדרות PDF/ייצוא', anchorId: 'settings-anchor-export' },
        ],
      },
    ],
    weekdays: [
      {
        title: 'פס ימי השבוע',
        items: [
          { label: 'פורמט/צבע/גובה/מרכוז', anchorId: 'settings-anchor-weekdays' },
        ],
      },
      {
        title: 'טבלה',
        items: [
          { label: 'מסגרת חיצונית וקווי תאים', anchorId: 'settings-anchor-borders' },
        ],
      },
    ],
    cell: [
      {
        title: 'זמנים',
        items: [{ label: 'כניסה/יציאה (Hebcal)', anchorId: 'settings-anchor-zmanim' }],
      },
      {
        title: 'טבלה – צבעים',
        items: [
          { label: 'צבעי ימים (אירועים/שבת/היום)', anchorId: 'settings-anchor-colors' },
          { label: 'תאי ריפוד/אפור חלש', anchorId: 'settings-anchor-padding-cells' },
        ],
      },
      {
        title: 'טבלה – קווים',
        items: [
          { label: 'מסגרת חיצונית וקווי תאים', anchorId: 'settings-anchor-borders' },
        ],
      },
      {
        title: 'עריכה ידנית',
        items: [{ label: 'אפשרויות עריכה ידנית', anchorId: 'settings-anchor-manual-edits' }],
      },
    ],
    background: [
      {
        title: 'רקע ותמונות',
        items: [
          { label: 'תמונת רקע / חודשית / אטימות', anchorId: 'settings-anchor-background' },
          { label: 'גודל קנבס (כמו עמוד PDF) וזום לוח', anchorId: 'settings-anchor-canvas-surface' },
        ],
      },
      {
        title: 'ייצוא',
        items: [{ label: 'הגדרות PDF/ייצוא', anchorId: 'settings-anchor-export' }],
      },
    ],
  };

  const compressImageToDataUrl = async (file: File): Promise<string | null> => {
    try {
      // Conservative defaults to keep localStorage under quota (images are base64).
      const maxEdgePx = 900;
      const quality = 0.82;

      const bmp = await createImageBitmap(file);
      const w = bmp.width || 1;
      const h = bmp.height || 1;
      const scale = Math.min(1, maxEdgePx / Math.max(w, h));
      const outW = Math.max(1, Math.round(w * scale));
      const outH = Math.max(1, Math.round(h * scale));

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bmp, 0, 0, outW, outH);

      // Prefer webp (smaller), fall back to jpeg.
      const tryWebp = canvas.toDataURL('image/webp', quality);
      if (typeof tryWebp === 'string' && tryWebp.startsWith('data:image/webp')) return tryWebp;
      const jpg = canvas.toDataURL('image/jpeg', quality);
      if (typeof jpg === 'string' && jpg.startsWith('data:image/jpeg')) return jpg;
      // As a last resort, keep original read (may exceed quota).
      return null;
    } catch {
      return null;
    }
  };

  const isLandingOnly =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('landing') === '1';
  const LANDING_IMAGE_KEY = 'calendarLandingImageDataUrl';
  const [landingImage, setLandingImage] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const v = window.localStorage.getItem(LANDING_IMAGE_KEY);
      return v && v.startsWith('data:image/') ? v : null;
    } catch {
      return null;
    }
  });

  const landingPickerRef = useRef<HTMLInputElement | null>(null);
  const setLandingImageSafe = (dataUrl: string | null) => {
    setLandingImage(dataUrl);
    if (typeof window === 'undefined') return;
    try {
      if (dataUrl) window.localStorage.setItem(LANDING_IMAGE_KEY, dataUrl);
      else window.localStorage.removeItem(LANDING_IMAGE_KEY);
    } catch {
      // ignore quota / privacy errors
    }
  };

  if (isLandingOnly) {
    return (
      <section dir="rtl" className="relative w-full max-w-6xl mx-auto p-4 sm:p-6 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="text-sm text-slate-700">
            כאן אפשר להעלות תמונת תצוגה. למחיקת/החלפת התמונה השתמש בכפתורים.
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 transition"
              onClick={() => landingPickerRef.current?.click()}
            >
              {landingImage ? 'החלף תמונה' : 'בחר תמונה'}
            </button>
            <button
              type="button"
              className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 transition"
              onClick={() => setLandingImageSafe(null)}
              disabled={!landingImage}
            >
              מחק
            </button>
            <a
              className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 transition"
              href="/"
            >
              עבור ללוח שנה
            </a>
          </div>
        </div>

        <input
          ref={landingPickerRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            (async () => {
              const compressed = await compressImageToDataUrl(file);
              if (compressed && compressed.startsWith('data:image/')) {
                setLandingImageSafe(compressed);
                return;
              }
              // fallback: read original
              const reader = new FileReader();
              reader.onload = () => {
                const v = typeof reader.result === 'string' ? reader.result : null;
                if (v && v.startsWith('data:image/')) setLandingImageSafe(v);
              };
              reader.readAsDataURL(file);
            })();
          }}
        />

        <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden shadow-sm">
          <div className="relative w-full" style={{ aspectRatio: '16 / 7' }}>
            {landingImage ? (
              <img
                src={landingImage}
                alt="תצוגת לוח שנה"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
                אין תמונה — לחץ על “בחר תמונה”
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      dir="rtl"
      className="relative w-full max-w-6xl mx-auto p-4 sm:p-6 bg-white"
      style={{
        fontFamily: shouldApplyFontEverywhere ? settings.fontFamily : undefined,
        fontSize: settings.fontSizePx,
        fontWeight: settings.fontWeight,
      }}
    >
      {livePicker ? (
        <div
          data-live-eyedropper="1"
          ref={livePickerOverlayRef}
          className="fixed inset-0 z-[120] cursor-crosshair bg-black/10"
          onMouseMove={(e) => {
            const hex = sampleHexAtPoint(e.clientX, e.clientY);
            if (!hex) return;
            setLivePicker((p) => {
              if (!p || p.current === hex) return p;
              p.commit(hex); // live preview
              return { ...p, current: hex };
            });
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // left click commits; right click cancels
            if (e.button === 2) {
              livePicker.revert();
              setLivePicker(null);
              return;
            }
            setLivePicker(null);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            livePicker.revert();
            setLivePicker(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              livePicker.revert();
              setLivePicker(null);
            }
          }}
          tabIndex={0}
        >
          <div className="absolute left-3 top-3 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs text-slate-800 shadow-sm">
            <div className="font-semibold text-slate-900">טפטפת: {livePicker.label}</div>
            <div className="mt-1 flex items-center gap-2">
              <span
                className="inline-block h-4 w-6 rounded border border-slate-300"
                style={{ background: livePicker.current }}
              />
              <span className="font-mono">{livePicker.current}</span>
              <span className="text-slate-500">• קליק לקיבוע • Esc לביטול</span>
            </div>
          </div>
        </div>
      ) : null}

      <input
        ref={imgPickerRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const key = pendingImageKey;
          const file = e.target.files?.[0];
          if (!key || !file) return;
          (async () => {
            const compressed = await compressImageToDataUrl(file);
            if (compressed && compressed.startsWith('data:image/')) {
              setOverrides((prev) => {
                const copy = { ...prev };
                const storeKey = recurringOverrideKeyFromIsoDate(key);
                const existing = resolveDayTextOverride(copy, key) ?? copy[storeKey];
                copy[storeKey] = {
                  centerLines: Array.isArray(existing?.centerLines) ? existing!.centerLines : [],
                  centerOffsetX: existing?.centerOffsetX ?? 0,
                  centerOffsetY: existing?.centerOffsetY ?? 0,
                  centerAlign: existing?.centerAlign ?? 'center',
                  imageDataUrl: compressed,
                  imageFit: existing?.imageFit ?? 'cover',
                  imageOpacity:
                    typeof existing?.imageOpacity === 'number' ? existing!.imageOpacity : 1,
                  imageOffsetX: existing?.imageOffsetX ?? 0,
                  imageOffsetY: existing?.imageOffsetY ?? 0,
                };
                if (/^\d{4}-\d{2}-\d{2}$/.test(key)) delete copy[key];
                return copy;
              });
              return;
            }

            // Fallback: read original (may exceed quota).
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = String(reader.result ?? '');
              if (!dataUrl.startsWith('data:image/')) return;
              setOverrides((prev) => {
                const copy = { ...prev };
                const storeKey = recurringOverrideKeyFromIsoDate(key);
                const existing = resolveDayTextOverride(copy, key) ?? copy[storeKey];
                copy[storeKey] = {
                  centerLines: Array.isArray(existing?.centerLines) ? existing!.centerLines : [],
                  centerOffsetX: existing?.centerOffsetX ?? 0,
                  centerOffsetY: existing?.centerOffsetY ?? 0,
                  centerAlign: existing?.centerAlign ?? 'center',
                  imageDataUrl: dataUrl,
                  imageFit: existing?.imageFit ?? 'cover',
                  imageOpacity:
                    typeof existing?.imageOpacity === 'number' ? existing!.imageOpacity : 1,
                  imageOffsetX: existing?.imageOffsetX ?? 0,
                  imageOffsetY: existing?.imageOffsetY ?? 0,
                };
                if (/^\d{4}-\d{2}-\d{2}$/.test(key)) delete copy[key];
                return copy;
              });
            };
            reader.readAsDataURL(file);
          })();
        }}
      />
      {inspect.key !== 'none' &&
      (inspect.key === 'header' ||
        inspect.key === 'weekdays' ||
        inspect.key === 'cell' ||
        inspect.key === 'background') ? (
        <div
          className="fixed z-[70] w-[280px] rounded-xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur p-3"
          data-inspect-panel="1"
          style={{
            left: Math.min(window.innerWidth - 300, inspect.x + 14),
            top: Math.min(window.innerHeight - 220, inspect.y + 14),
          }}
        >
          <div className="text-xs font-normal text-slate-700 mb-2">עריכה מהירה</div>
          <div className="flex flex-col gap-3">
            {INSPECT_ACTIONS[inspect.key].map((sec) => (
              <div key={sec.title} className="rounded-lg border border-slate-200 bg-white/80 p-2">
                <div className="text-[11px] font-normal text-slate-700 mb-2">{sec.title}</div>
                <div className="flex flex-col gap-2">
                  {sec.items.map((a) => (
                    <button
                      key={a.anchorId + a.label}
                      type="button"
                      className="text-right px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                      onClick={() => jumpToSetting(a.anchorId)}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <header
        className="relative flex flex-col gap-3 mb-4 mx-auto"
        style={{ width: `min(100%, ${canvasSurfacePx.widthPx}px)` }}
      >
        <div dir="ltr" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div dir="rtl" className="flex flex-wrap items-center gap-2 justify-center sm:justify-end">
            <button
              type="button"
              onClick={() => setThemePickerOpen(true)}
              className="px-3 py-2 text-sm rounded-md border border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100 active:bg-violet-100/80 transition flex items-center gap-2"
            >
              <span aria-hidden="true">🎨</span>
              ערכות צבע
            </button>
            <button
              type="button"
              onClick={() => setStylePackOpen(true)}
              className="px-3 py-2 text-sm rounded-md border border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900 hover:bg-fuchsia-100 active:bg-fuchsia-100/80 transition flex items-center gap-2"
            >
              <span aria-hidden="true">🧩</span>
              ערכת סגנונות
            </button>

            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              className="px-3 py-2 text-sm rounded-md border border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100 active:bg-sky-100/80 transition flex items-center gap-2"
            >
              <span aria-hidden="true">⚙️</span>
              הגדרות עיצוב
            </button>

            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="px-3 py-2 text-sm rounded-md border border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 active:bg-emerald-100/80 transition flex items-center gap-2"
            >
              <span aria-hidden="true">📘</span>
              מדריך תפעולי
            </button>

            <div ref={downloadMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setDownloadMenuOpen((v) => !v)}
                className="px-3 py-2 text-sm rounded-md border border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100 active:bg-amber-100/80 transition flex items-center gap-2"
                aria-haspopup="menu"
                aria-expanded={downloadMenuOpen}
              >
                <span aria-hidden="true">⬇️</span>
                הורדה
              </button>
              {downloadMenuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-2 w-[260px] rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden z-50"
                >
                  <div className="px-3 py-2 text-[11px] font-normal text-slate-600 bg-slate-50 border-b border-slate-200">
                    חודש
                  </div>
                  <div className="p-2 grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={async () => {
                        setDownloadMenuOpen(false);
                        if (!ensureDownloadsWork()) return;
                        try {
                          setPreviewOpen(true);
                          setPreviewTitle('תצוגה מקדימה — חודש PDF');
                          setPreviewKind('pdf');
                          const html = buildPrintableMonthHtml(viewDate, settings, overrides, {
                            location: 'Jerusalem',
                          });
                          const suggested = `calendar-${format(viewDate, 'yyyy-MM')}.pdf`;
                          setPreviewSuggested(suggested);
                          setPreviewSrcDoc(html);
                          const blob = await exportPdfBlobFromHtml(html, settings);
                          setPreviewBlob(blob);
                          if (previewUrl) URL.revokeObjectURL(previewUrl);
                          setPreviewUrl(URL.createObjectURL(blob));
                        } catch (e) {
                          const msg = e instanceof Error ? e.message : 'שגיאה לא ידועה';
                          setSaveFlash(`שגיאה בתצוגה מקדימה: ${msg}`);
                          window.setTimeout(() => setSaveFlash(null), 3500);
                          // eslint-disable-next-line no-console
                          console.error(e);
                        }
                      }}
                      className="text-right px-3 py-2 text-sm rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100"
                    >
                      תצוגה מקדימה — PDF
                    </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={async () => {
                      setDownloadMenuOpen(false);
                      if (!ensureDownloadsWork()) return;
                      try {
                        setSaveFlash('מכין PDF…');
                        const html = buildPrintableMonthHtml(viewDate, settings, overrides, {
                          location: 'Jerusalem',
                        });
                        const suggested = `calendar-${format(viewDate, 'yyyy-MM')}.pdf`;
                        const handle = await requestSaveHandle(suggested, {
                          mime: 'application/pdf',
                          description: 'PDF',
                          extensions: ['.pdf'],
                        });
                        if (handle) {
                          const blob = await exportPdfBlobFromHtml(html, settings);
                          await saveBlobToHandle(handle, blob);
                          setSaveFlash('ה‑PDF נשמר');
                        } else {
                          await downloadPdfFromHtml(suggested, html, settings);
                          setSaveFlash('ה‑PDF נשלח להורדה');
                        }
                        window.setTimeout(() => setSaveFlash(null), 1400);
                      } catch (e) {
                        const msg = e instanceof Error ? e.message : 'שגיאה לא ידועה';
                        setSaveFlash(`שגיאה בהורדת PDF: ${msg}`);
                        window.setTimeout(() => setSaveFlash(null), 3500);
                        // eslint-disable-next-line no-console
                        console.error(e);
                      }
                    }}
                    className="text-right px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                  >
                    הורד חודש PDF
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={async () => {
                      setDownloadMenuOpen(false);
                      if (!ensureDownloadsWork()) return;
                      try {
                        setPreviewOpen(true);
                        setPreviewTitle('תצוגה מקדימה — חודש PNG');
                        setPreviewKind('png');
                        const html = buildPrintableMonthHtml(viewDate, settings, overrides, {
                          location: 'Jerusalem',
                        });
                        const suggested = `calendar-${format(viewDate, 'yyyy-MM')}.png`;
                        setPreviewSuggested(suggested);
                        setPreviewSrcDoc(html);
                        const blob = await exportPngBlobFromPrintableHtml(html, settings);
                        setPreviewBlob(blob);
                        if (previewUrl) URL.revokeObjectURL(previewUrl);
                        setPreviewUrl(URL.createObjectURL(blob));
                      } catch (e) {
                        const msg = e instanceof Error ? e.message : 'שגיאה לא ידועה';
                        setSaveFlash(`שגיאה בתצוגה מקדימה: ${msg}`);
                        window.setTimeout(() => setSaveFlash(null), 3500);
                        // eslint-disable-next-line no-console
                        console.error(e);
                      }
                    }}
                    className="text-right px-3 py-2 text-sm rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100"
                  >
                    תצוגה מקדימה — PNG
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={async () => {
                      setDownloadMenuOpen(false);
                      if (!ensureDownloadsWork()) return;
                      try {
                        setSaveFlash('מכין PNG…');
                        const html = buildPrintableMonthHtml(viewDate, settings, overrides, {
                          location: 'Jerusalem',
                        });
                        const suggested = `calendar-${format(viewDate, 'yyyy-MM')}.png`;
                        // Chrome sometimes blocks async downloads after the first one.
                        // If supported, ask "Save as" immediately (user gesture) and write later.
                        const handle = await requestSaveHandle(suggested, {
                          mime: 'image/png',
                          description: 'PNG',
                          extensions: ['.png'],
                        });
                        if (handle) {
                          const blob = await exportPngBlobFromPrintableHtml(html, settings);
                          await saveBlobToHandle(handle, blob);
                          setSaveFlash('ה‑PNG נשמר');
                        } else {
                          await downloadPngFromPrintableHtml(suggested, html, settings);
                          setSaveFlash('ה‑PNG נשלח להורדה');
                        }
                        window.setTimeout(() => setSaveFlash(null), 1400);
                      } catch (e) {
                        const msg = e instanceof Error ? e.message : 'שגיאה לא ידועה';
                        setSaveFlash(`שגיאה בהורדת PNG: ${msg}`);
                        window.setTimeout(() => setSaveFlash(null), 3500);
                        // eslint-disable-next-line no-console
                        console.error(e);
                      }
                    }}
                    className="text-right px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                  >
                    הורד חודש PNG
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setDownloadMenuOpen(false);
                      if (!ensureDownloadsWork()) return;
                      try {
                        const html = buildPrintableMonthHtml(viewDate, settings, overrides, {
                          location: 'Jerusalem',
                        });
                        setPreviewOpen(true);
                        setPreviewTitle('תצוגה מקדימה — חודש HTML');
                        setPreviewKind('html');
                        setPreviewSuggested(`calendar-${format(viewDate, 'yyyy-MM')}.html`);
                        setPreviewSrcDoc(html);
                        setPreviewBlob(null);
                        if (previewUrl) URL.revokeObjectURL(previewUrl);
                        setPreviewUrl(null);
                      } catch (e) {
                        const msg = e instanceof Error ? e.message : 'שגיאה לא ידועה';
                        setSaveFlash(`שגיאה בתצוגה מקדימה: ${msg}`);
                        window.setTimeout(() => setSaveFlash(null), 3500);
                        // eslint-disable-next-line no-console
                        console.error(e);
                      }
                    }}
                    className="text-right px-3 py-2 text-sm rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100"
                  >
                    תצוגה מקדימה — HTML
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setDownloadMenuOpen(false);
                      if (!ensureDownloadsWork()) return;
                      try {
                        const html = buildPrintableMonthHtml(viewDate, settings, overrides, {
                          location: 'Jerusalem',
                        });
                        const suggested = `calendar-${format(viewDate, 'yyyy-MM')}.html`;
                        requestSaveHandle(suggested, {
                          mime: 'text/html',
                          description: 'HTML',
                          extensions: ['.html'],
                        })
                          .then(async (handle) => {
                            if (handle) {
                              await saveTextToHandle(handle, html, 'text/html;charset=utf-8');
                              setSaveFlash('ה‑HTML נשמר');
                            } else {
                              downloadHtmlFromPrintableHtml(suggested, html);
                              setSaveFlash('ה‑HTML נשלח להורדה');
                            }
                            window.setTimeout(() => setSaveFlash(null), 1400);
                          })
                          .catch((e) => {
                            const msg = e instanceof Error ? e.message : 'שגיאה לא ידועה';
                            setSaveFlash(`שגיאה בהורדת HTML: ${msg}`);
                            window.setTimeout(() => setSaveFlash(null), 3500);
                            // eslint-disable-next-line no-console
                            console.error(e);
                          });
                      } catch (e) {
                        const msg = e instanceof Error ? e.message : 'שגיאה לא ידועה';
                        setSaveFlash(`שגיאה בהורדת HTML: ${msg}`);
                        window.setTimeout(() => setSaveFlash(null), 3500);
                        // eslint-disable-next-line no-console
                        console.error(e);
                      }
                    }}
                    className="text-right px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                  >
                    הורד חודש HTML
                  </button>
                </div>

                <div className="px-3 py-2 text-[11px] font-normal text-slate-600 bg-slate-50 border-y border-slate-200">
                  שנה
                </div>
                <div className="p-2 grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={async () => {
                      setDownloadMenuOpen(false);
                      if (!ensureDownloadsWork()) return;
                      try {
                        setPreviewOpen(true);
                        setPreviewTitle('תצוגה מקדימה — שנה PDF');
                        setPreviewKind('pdf');
                        const year = viewDate.getFullYear();
                        const html = buildPrintableYearPdfHtml(year, settings, overrides);
                        const suggested = `calendar-${year}.pdf`;
                        setPreviewSuggested(suggested);
                        setPreviewSrcDoc(html);
                        const blob = await exportPdfBlobFromHtml(html, settings, { multiPage: true });
                        setPreviewBlob(blob);
                        if (previewUrl) URL.revokeObjectURL(previewUrl);
                        setPreviewUrl(URL.createObjectURL(blob));
                      } catch (e) {
                        const msg = e instanceof Error ? e.message : 'שגיאה לא ידועה';
                        setSaveFlash(`שגיאה בתצוגה מקדימה: ${msg}`);
                        window.setTimeout(() => setSaveFlash(null), 3500);
                        // eslint-disable-next-line no-console
                        console.error(e);
                      }
                    }}
                    className="text-right px-3 py-2 text-sm rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100"
                  >
                    תצוגה מקדימה — PDF
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={async () => {
                      setDownloadMenuOpen(false);
                      if (!ensureDownloadsWork()) return;
                      try {
                        setSaveFlash('מכין PDF של שנה…');
                        const year = viewDate.getFullYear();
                        const html = buildPrintableYearPdfHtml(year, settings, overrides);
                        const suggested = `calendar-${year}.pdf`;
                        const handle = await requestSaveHandle(suggested, {
                          mime: 'application/pdf',
                          description: 'PDF',
                          extensions: ['.pdf'],
                        });
                        if (handle) {
                          const blob = await exportPdfBlobFromHtml(html, settings, { multiPage: true });
                          await saveBlobToHandle(handle, blob);
                          setSaveFlash('ה‑PDF נשמר');
                        } else {
                          const popup = openDownloadPopup();
                          const blob = await exportPdfBlobFromHtml(html, settings, { multiPage: true });
                          if (popup) {
                            downloadBlobViaPopup(popup, suggested, blob);
                            setSaveFlash('ה‑PDF נשלח להורדה');
                          } else {
                            await downloadPdfFromHtml(suggested, html, settings, { multiPage: true });
                            setSaveFlash('ה‑PDF נשלח להורדה');
                          }
                        }
                        window.setTimeout(() => setSaveFlash(null), 1600);
                      } catch (e) {
                        const msg = e instanceof Error ? e.message : 'שגיאה לא ידועה';
                        setSaveFlash(`שגיאה בהורדת PDF: ${msg}`);
                        window.setTimeout(() => setSaveFlash(null), 3500);
                        // eslint-disable-next-line no-console
                        console.error(e);
                      }
                    }}
                    className="text-right px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                  >
                    הורד שנה PDF
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setDownloadMenuOpen(false);
                      if (!ensureDownloadsWork()) return;
                      try {
                        const year = viewDate.getFullYear();
                        const html = buildPrintableYearPdfHtml(year, settings, overrides);
                        setPreviewOpen(true);
                        setPreviewTitle('תצוגה מקדימה — שנה HTML');
                        setPreviewKind('html');
                        setPreviewSuggested(`calendar-${year}.html`);
                        setPreviewSrcDoc(html);
                        setPreviewBlob(null);
                        if (previewUrl) URL.revokeObjectURL(previewUrl);
                        setPreviewUrl(null);
                      } catch (e) {
                        const msg = e instanceof Error ? e.message : 'שגיאה לא ידועה';
                        setSaveFlash(`שגיאה בתצוגה מקדימה: ${msg}`);
                        window.setTimeout(() => setSaveFlash(null), 3500);
                        // eslint-disable-next-line no-console
                        console.error(e);
                      }
                    }}
                    className="text-right px-3 py-2 text-sm rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100"
                  >
                    תצוגה מקדימה — HTML
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setDownloadMenuOpen(false);
                      if (!ensureDownloadsWork()) return;
                      try {
                        const year = viewDate.getFullYear();
                        const html = buildPrintableYearPdfHtml(year, settings, overrides);
                        const suggested = `calendar-${year}.html`;
                        requestSaveHandle(suggested, {
                          mime: 'text/html',
                          description: 'HTML',
                          extensions: ['.html'],
                        })
                          .then(async (handle) => {
                            if (handle) {
                              await saveTextToHandle(handle, html, 'text/html;charset=utf-8');
                              setSaveFlash('ה‑HTML נשמר');
                            } else {
                              downloadHtmlFromPrintableHtml(suggested, html);
                              setSaveFlash('ה‑HTML נשלח להורדה');
                            }
                            window.setTimeout(() => setSaveFlash(null), 1400);
                          })
                          .catch((e) => {
                            const msg = e instanceof Error ? e.message : 'שגיאה לא ידועה';
                            setSaveFlash(`שגיאה בהורדת HTML: ${msg}`);
                            window.setTimeout(() => setSaveFlash(null), 3500);
                            // eslint-disable-next-line no-console
                            console.error(e);
                          });
                      } catch (e) {
                        const msg = e instanceof Error ? e.message : 'שגיאה לא ידועה';
                        setSaveFlash(`שגיאה בהורדת HTML: ${msg}`);
                        window.setTimeout(() => setSaveFlash(null), 3500);
                        // eslint-disable-next-line no-console
                        console.error(e);
                      }
                    }}
                    className="text-right px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                  >
                    הורד שנה HTML
                  </button>
                </div>
              </div>
              ) : null}
            </div>
          </div>

          <div className="text-left">
            <p className="text-xs sm:text-sm text-slate-500">
              {gMonthDays} ימים בחודש (לועזי)
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400 select-text">
              build {typeof __APP_BUILD__ === 'string' ? __APP_BUILD__ : 'unknown'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-end">
          <button
            type="button"
            onClick={() => setViewDate((d) => addMonths(d, 12))}
            className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 transition"
          >
            שנה הבאה
          </button>
          <button
            type="button"
            onClick={() => setViewDate((d) => addMonths(d, -12))}
            className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 transition"
          >
            שנה קודמת
          </button>
          <button
            type="button"
            onClick={() => setViewDate((d) => addMonths(d, 1))}
            className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 transition"
          >
            החודש הבא
          </button>
          <button
            type="button"
            onClick={() => setViewDate((d) => addMonths(d, -1))}
            className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 transition"
          >
            החודש הקודם
          </button>
        </div>
      </header>

      {/*
        Category shortcuts are rendered next to the canvas below (in the canvas row),
        so they never overlap the canvas border.
      */}
      {helpOpen ? (
        <HelpAssistant
          entries={HELP_ENTRIES}
          onJumpToAnchor={(anchorId) => jumpToSetting(anchorId)}
          onClose={() => setHelpOpen(false)}
        />
      ) : null}

      {previewOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-[min(1100px,96vw)] h-[min(86vh,900px)] rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-slate-50">
              <div className="text-sm font-normal text-slate-900">{previewTitle}</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                  onClick={async () => {
                    try {
                      if (!ensureDownloadsWork()) return;
                      const suggested = previewSuggested;
                      if (previewKind === 'html') {
                        const html = previewSrcDoc ?? '';
                        const handle = await requestSaveHandle(suggested, {
                          mime: 'text/html',
                          description: 'HTML',
                          extensions: ['.html'],
                        });
                        if (handle) {
                          await saveTextToHandle(handle, html, 'text/html;charset=utf-8');
                          setSaveFlash('ה‑HTML נשמר');
                        } else {
                          downloadHtmlFromPrintableHtml(suggested, html);
                          setSaveFlash('ה‑HTML נשלח להורדה');
                        }
                      } else {
                        const blob = previewBlob;
                        if (!blob) throw new Error('תצוגה מקדימה עדיין נטענת.');
                        const mime = previewKind === 'pdf' ? 'application/pdf' : 'image/png';
                        const desc = previewKind === 'pdf' ? 'PDF' : 'PNG';
                        const ext = previewKind === 'pdf' ? '.pdf' : '.png';
                        const handle = await requestSaveHandle(suggested, {
                          mime,
                          description: desc,
                          extensions: [ext],
                        });
                        if (handle) {
                          await saveBlobToHandle(handle, blob);
                          setSaveFlash(previewKind === 'pdf' ? 'ה‑PDF נשמר' : 'ה‑PNG נשמר');
                        } else if (previewKind === 'pdf') {
                          const popup = openDownloadPopup();
                          if (popup) downloadBlobViaPopup(popup, suggested, blob);
                          else await downloadPdfFromHtml(suggested, previewSrcDoc ?? '', settings);
                          setSaveFlash('ה‑PDF נשלח להורדה');
                        } else {
                          await downloadPngFromPrintableHtml(suggested, previewSrcDoc ?? '', settings);
                          setSaveFlash('ה‑PNG נשלח להורדה');
                        }
                      }
                      window.setTimeout(() => setSaveFlash(null), 1600);
                    } catch (e) {
                      const msg = e instanceof Error ? e.message : 'שגיאה לא ידועה';
                      setSaveFlash(`שגיאה בייצוא: ${msg}`);
                      window.setTimeout(() => setSaveFlash(null), 3500);
                      // eslint-disable-next-line no-console
                      console.error(e);
                    }
                  }}
                >
                  ייצא קובץ
                </button>
                <button
                  type="button"
                  className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                  onClick={() => {
                    setPreviewOpen(false);
                    setPreviewTitle('');
                    setPreviewKind('pdf');
                    if (previewUrl) URL.revokeObjectURL(previewUrl);
                    setPreviewUrl(null);
                    setPreviewSrcDoc(null);
                    setPreviewBlob(null);
                    setPreviewSuggested('');
                  }}
                >
                  סגור
                </button>
              </div>
            </div>
            <div className="flex-1 bg-white">
              {previewKind === 'html' ? (
                <iframe title="preview" className="w-full h-full" srcDoc={previewSrcDoc ?? ''} />
              ) : previewUrl ? (
                <iframe title="preview" className="w-full h-full" src={previewUrl} />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-sm text-slate-600">
                  טוען תצוגה מקדימה…
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {settingsOpen && (
        <div
          className="relative mb-4 flex max-h-[min(92vh,940px)] flex-col rounded-xl border border-slate-200 bg-white/95 shadow-sm sm:max-h-[min(88vh,900px)]"
          style={
            shouldApplyFontTo('settings')
              ? { fontFamily: resolveFontFamilyFor('settings') }
              : undefined
          }
        >
          <div className="sticky top-0 z-20 shrink-0 border-b border-slate-200/90 bg-white/95 backdrop-blur-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 sm:px-4">
              <div className="font-normal text-slate-900">עיצוב</div>
              <div className="flex flex-wrap items-center gap-2">
                {saveFlash ? (
                  <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-md">
                    {saveFlash}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    // Explicit save (even though we auto-save) for user confidence
                    const okSettings = saveSettings(settings);
                    const okOverrides = saveOverrides(overrides);
                    if (okSettings && okOverrides) {
                      setSaveFlash('נשמר');
                      window.setTimeout(() => setSaveFlash(null), 1200);
                      return;
                    }
                    if (okSettings && !okOverrides) {
                      setSaveFlash(
                        'ההגדרות נשמרו, אבל התמונות/עריכות לא נשמרו (האחסון בדפדפן מלא/חסום). נסה להסיר תמונות או להקטין אותן.',
                      );
                      window.setTimeout(() => setSaveFlash(null), 6200);
                      return;
                    }
                    setSaveFlash(
                      'לא נשמר: האחסון בדפדפן מלא/חסום (בד״כ בגלל תמונות). נסה להסיר תמונות או לנקות נתוני אתר.',
                    );
                    window.setTimeout(() => setSaveFlash(null), 6200);
                  }}
                  className="text-sm px-3 py-2 rounded-md border border-slate-200 bg-slate-900 text-white hover:bg-slate-800"
                >
                  שמור
                </button>
                <button
                  type="button"
                  onClick={() => setSettings(DEFAULT_SETTINGS)}
                  className="text-sm px-3 py-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                >
                  איפוס
                </button>
              </div>
            </div>
            <SettingsSearchBar onPick={jumpToSetting} />
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-y-contain px-2 py-2 sm:px-3 sm:py-3">
            <SettingsCategory icon="📁" title="ערכות צבע ומבנה כותרת">
            <div
              id="settings-anchor-themes"
              className="sm:col-span-2 lg:col-span-3 scroll-mt-24 rounded-lg border border-violet-100 bg-violet-50/50 p-3"
            >
              <div className="text-sm font-normal text-slate-900">ערכות צבע מוכנות</div>
              <p className="mt-1 text-xs text-slate-600">
                בחרו פלטת צבעים בלבד (לא משנה מבנה/גופנים). מבנה נקבע ב״ערכת סגנונות״.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded-md border border-violet-200 bg-white px-3 py-2 text-sm font-medium text-violet-900 hover:bg-violet-50"
                  onClick={() => setThemePickerOpen(true)}
                >
                  פתח בורר ערכות
                </button>
                <span className="text-xs text-slate-500">
                  נבחר:{' '}
                  <span className="font-normal text-slate-700">
                    {settings.designThemeId === 'default'
                      ? 'ברירת מחדל'
                      : getThemeEntry(settings.designThemeId)?.nameHe ?? settings.designThemeId}
                  </span>
                </span>
              </div>
            </div>

            <label className="text-sm text-slate-700 sm:col-span-2 lg:col-span-3">
              כותרת ראשית
              <input
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
                value={settings.titleMain}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, titleMain: e.target.value }))
                }
              />
              <div className="mt-2" />
              כותרת משנה
              <input
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
                value={settings.titleSub}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, titleSub: e.target.value }))
                }
              />
            </label>

            <label className="text-sm text-slate-700 sm:col-span-2 lg:col-span-3">
              מבנה כותרת (צורה מול הרשת)
              <select
                className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
                value={settings.headerLayoutStyle}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    headerLayoutStyle: e.target.value as HeaderLayoutStyle,
                  }))
                }
              >
                <option value="floating">מודרני צף — פס נפרד עם מרווח מהלוח</option>
                <option value="seamless">ספר — פס מחובר לרשת במסגרת אחת</option>
                <option value="right_block">קלאסי ימני — בלוק חודש/שנה בצד (ימין ב־RTL)</option>
                <option value="centered_pill">כדור במרכז — תג חודש במרכז, כותרות מתחת</option>
                <option value="minimal_text">מינימליסטי — בלי פס, טקסט גדול מעל הלוח</option>
              </select>
              <div className="mt-1 text-xs text-slate-500">
                מבנה נקבע ב״ערכת סגנונות״; כאן אפשר לעקוף ידנית.
              </div>
            </label>

            <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700 sm:col-span-2 lg:col-span-3">
              <input
                type="checkbox"
                checked={settings.headerWysiwygManualActive}
                onChange={(e) => {
                  const on = e.target.checked;
                  setSettings((s) => ({
                    ...s,
                    headerWysiwygManualActive: on,
                    headerWysiwygClassicPct:
                      on && !s.headerWysiwygClassicPct
                        ? DEFAULT_HEADER_WYSIWYG_CLASSIC_PCT
                        : s.headerWysiwygClassicPct,
                    headerWysiwygClassicAlign:
                      on && !s.headerWysiwygClassicAlign
                        ? DEFAULT_HEADER_WYSIWYG_CLASSIC_ALIGN
                        : s.headerWysiwygClassicAlign,
                  }));
                  if (!on) setHeaderLayoutEditMode(false);
                }}
              />
              פריסת פס כותרת קלאסי (צף / ספר) לפי גרירה — מיקומים באחוזים זהים ב־PDF
            </label>
            {settings.headerWysiwygManualActive &&
            (settings.headerLayoutStyle === 'floating' ||
              settings.headerLayoutStyle === 'seamless') ? (
              <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700 sm:col-span-2 lg:col-span-3">
                <input
                  type="checkbox"
                  checked={headerLayoutEditMode}
                  onChange={(e) => setHeaderLayoutEditMode(e.target.checked)}
                />
                מצב עריכת פריסה (גרירה, ידיות שינוי גודל; קווי עזר למרכז בזמן גרירה)
              </label>
            ) : null}
            {settings.headerWysiwygManualActive &&
            (settings.headerLayoutStyle === 'floating' ||
              settings.headerLayoutStyle === 'seamless') ? (
              <button
                type="button"
                className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50 sm:col-span-2"
                onClick={() =>
                  setSettings((s) => ({
                    ...s,
                    headerWysiwygClassicPct: DEFAULT_HEADER_WYSIWYG_CLASSIC_PCT,
                  }))
                }
              >
                איפוס פריסה שמורה לברירת מחדל
              </button>
            ) : null}

            </SettingsCategory>

            <SettingsCategory icon="🕯️" title="זמנים (Hebcal)">
            <div id="settings-anchor-zmanim" className="sm:col-span-2 lg:col-span-3 scroll-mt-24" />
            <div className="sm:col-span-2 lg:col-span-3 rounded-lg border border-amber-100 bg-amber-50/60 p-3 text-sm text-slate-700">
              חישוב כפול ב־<code className="rounded bg-white/80 px-1 text-xs">@hebcal/core</code>: ירושלים
              (780 מ׳) ותל אביב (0 מ׳). <strong>שבת ויום כיפור</strong> — יציאה כהבדלה אחרי השקיעה ב־
              <strong> {HAVDALAH_MINS_AFTER_SUNSET} דקות</strong> (קבוע, נפרד מצאת צומות).
            </div>

            <fieldset className="sm:col-span-2 lg:col-span-3 min-w-0 rounded-lg border border-slate-200 bg-white/80 p-3">
              <legend className="text-sm font-medium text-slate-800">זמן כניסה — דקות לפני השקיעה (נרות)</legend>
              <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-700">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="candleLightingMins"
                    checked={settings.candleLightingMins === 20}
                    onChange={() =>
                      setSettings((s) => ({
                        ...s,
                        candleLightingMins: 20,
                      }))
                    }
                  />
                  20 דקות
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="candleLightingMins"
                    checked={settings.candleLightingMins === 40}
                    onChange={() =>
                      setSettings((s) => ({
                        ...s,
                        candleLightingMins: 40,
                      }))
                    }
                  />
                  40 דקות
                </label>
              </div>
            </fieldset>

            <fieldset className="sm:col-span-2 lg:col-span-3 min-w-0 rounded-lg border border-slate-200 bg-white/80 p-3">
              <legend className="text-sm font-medium text-slate-800">צאת צומות (לא שבת, לא יום כיפור)</legend>
              <div id="settings-anchor-fast-tzait" className="scroll-mt-24" />
              <p className="mb-2 text-xs text-slate-600">
                צומות כמו י״ז בתמוז, תשעה באב, עשרה בטבת וכו׳. יום כיפור נשאר בדין שבת — מוצג בשורת
                «הבדלה» בלבד.
              </p>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="fastTzaitStyle"
                  checked={settings.fastTzaitStyle === 'hebcal_tzeit'}
                  onChange={() =>
                    setSettings((s) => ({
                      ...s,
                      fastTzaitStyle: 'hebcal_tzeit',
                    }))
                  }
                />
                צאת הכוכבים לפי Hebcal (ברירת מחדל)
              </label>
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="fastTzaitStyle"
                  checked={settings.fastTzaitStyle === 'sunset_minutes'}
                  onChange={() =>
                    setSettings((s) => ({
                      ...s,
                      fastTzaitStyle: 'sunset_minutes',
                    }))
                  }
                />
                דקות אחרי השקיעה (קבוע)
              </label>
              {settings.fastTzaitStyle === 'sunset_minutes' ? (
                <label className="mt-3 block text-sm text-slate-700">
                  צאת צומות — דקות אחרי השקיעה ({settings.fastSunsetOffsetMins})
                  <input
                    className="mt-2 w-full"
                    type="range"
                    min={15}
                    max={45}
                    step={1}
                    value={settings.fastSunsetOffsetMins}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        fastSunsetOffsetMins: Number(e.target.value),
                      }))
                    }
                  />
                </label>
              ) : null}
            </fieldset>
            </SettingsCategory>

            <SettingsCategory icon="✏️" title="טיפוגרפיה">
            <div id="settings-anchor-header" className="sm:col-span-2 lg:col-span-3 scroll-mt-24" />
            <FontFamilyPicker
              label="משפחת גופן — ברירת מחדל (Fallback)"
              value={settings.fontFamily}
              onPick={(v) => setSettings((s) => ({ ...s, fontFamily: v }))}
              uploadedFonts={uploadedFonts}
              fontBusy={fontBusy}
              onDeleteFamily={deleteUploadedFontEverywhere}
              fontLabelForValue={fontLabelForValue}
              builtins={FONT_BUILTINS}
              defaultValue={DEFAULT_SETTINGS.fontFamily}
            />

            <div className="sm:col-span-2 lg:col-span-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              <div className="text-sm font-semibold text-slate-900 mb-2">החל את הגופן על</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={settings.fontApplyTargets?.includes('all')}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSettings((s) => ({
                        ...s,
                        fontApplyTargets: checked
                          ? ['all']
                          : (s.fontApplyTargets || ['all']).filter((t) => t !== 'all'),
                      }));
                    }}
                  />
                  הכל (כולל ממשק)
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    disabled={settings.fontApplyTargets?.includes('all')}
                    checked={settings.fontApplyTargets?.includes('settings')}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSettings((s) => ({
                        ...s,
                        fontApplyTargets: checked
                          ? Array.from(new Set([...(s.fontApplyTargets || []).filter((t) => t !== 'all'), 'settings']))
                          : (s.fontApplyTargets || []).filter((t) => t !== 'settings'),
                      }));
                    }}
                  />
                  חלונית ההגדרות
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    disabled={settings.fontApplyTargets?.includes('all')}
                    checked={settings.fontApplyTargets?.includes('calendarHeader')}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSettings((s) => ({
                        ...s,
                        fontApplyTargets: checked
                          ? Array.from(new Set([...(s.fontApplyTargets || []).filter((t) => t !== 'all'), 'calendarHeader']))
                          : (s.fontApplyTargets || []).filter((t) => t !== 'calendarHeader'),
                      }));
                    }}
                  />
                  פס הכותרת/תאריכים למעלה
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    disabled={settings.fontApplyTargets?.includes('all')}
                    checked={settings.fontApplyTargets?.includes('cellDates')}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSettings((s) => ({
                        ...s,
                        fontApplyTargets: checked
                          ? Array.from(new Set([...(s.fontApplyTargets || []).filter((t) => t !== 'all'), 'cellDates']))
                          : (s.fontApplyTargets || []).filter((t) => t !== 'cellDates'),
                      }));
                    }}
                  />
                  תאריכים בתוך משבצות
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    disabled={settings.fontApplyTargets?.includes('all')}
                    checked={settings.fontApplyTargets?.includes('cellTimes')}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSettings((s) => ({
                        ...s,
                        fontApplyTargets: checked
                          ? Array.from(new Set([...(s.fontApplyTargets || []).filter((t) => t !== 'all'), 'cellTimes']))
                          : (s.fontApplyTargets || []).filter((t) => t !== 'cellTimes'),
                      }));
                    }}
                  />
                  זמנים בתוך משבצות
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    disabled={settings.fontApplyTargets?.includes('all')}
                    checked={settings.fontApplyTargets?.includes('cellEvents')}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSettings((s) => ({
                        ...s,
                        fontApplyTargets: checked
                          ? Array.from(new Set([...(s.fontApplyTargets || []).filter((t) => t !== 'all'), 'cellEvents']))
                          : (s.fontApplyTargets || []).filter((t) => t !== 'cellEvents'),
                      }));
                    }}
                  />
                  אירועים/טקסט במרכז התא
                </label>
              </div>
              {!settings.fontApplyTargets?.includes('all') ? (
                <div className="mt-3 grid grid-cols-1 gap-3">
                  {settings.fontApplyTargets?.includes('settings') ? (
                    <FontFamilyPicker
                      label="גופן לחלונית ההגדרות"
                      value={settings.fontFamilyByTarget?.settings ?? settings.fontFamily}
                      onPick={(v) =>
                        setSettings((s) => ({
                          ...s,
                          fontFamilyByTarget: { ...(s.fontFamilyByTarget ?? {}), settings: v },
                        }))
                      }
                      uploadedFonts={uploadedFonts}
                      fontBusy={fontBusy}
                      onDeleteFamily={deleteUploadedFontEverywhere}
                      fontLabelForValue={fontLabelForValue}
                      builtins={FONT_BUILTINS}
                      defaultValue={DEFAULT_SETTINGS.fontFamily}
                    />
                  ) : null}
                  {settings.fontApplyTargets?.includes('calendarHeader') ? (
                    <FontFamilyPicker
                      label="גופן לפס העליון (כותרת חודש)"
                      value={settings.fontFamilyByTarget?.calendarHeader ?? settings.fontFamily}
                      onPick={(v) =>
                        setSettings((s) => ({
                          ...s,
                          fontFamilyByTarget: { ...(s.fontFamilyByTarget ?? {}), calendarHeader: v },
                        }))
                      }
                      uploadedFonts={uploadedFonts}
                      fontBusy={fontBusy}
                      onDeleteFamily={deleteUploadedFontEverywhere}
                      fontLabelForValue={fontLabelForValue}
                      builtins={FONT_BUILTINS}
                      defaultValue={DEFAULT_SETTINGS.fontFamily}
                    />
                  ) : null}
                  {settings.fontApplyTargets?.includes('cellDates') ? (
                    <FontFamilyPicker
                      label="גופן לתאריכים במשבצות"
                      value={settings.fontFamilyByTarget?.cellDates ?? settings.fontFamily}
                      onPick={(v) =>
                        setSettings((s) => ({
                          ...s,
                          fontFamilyByTarget: { ...(s.fontFamilyByTarget ?? {}), cellDates: v },
                        }))
                      }
                      uploadedFonts={uploadedFonts}
                      fontBusy={fontBusy}
                      onDeleteFamily={deleteUploadedFontEverywhere}
                      fontLabelForValue={fontLabelForValue}
                      builtins={FONT_BUILTINS}
                      defaultValue={DEFAULT_SETTINGS.fontFamily}
                    />
                  ) : null}
                  {settings.fontApplyTargets?.includes('cellTimes') ? (
                    <FontFamilyPicker
                      label="גופן לזמני שבת במשבצות"
                      value={settings.fontFamilyByTarget?.cellTimes ?? settings.fontFamily}
                      onPick={(v) =>
                        setSettings((s) => ({
                          ...s,
                          fontFamilyByTarget: { ...(s.fontFamilyByTarget ?? {}), cellTimes: v },
                        }))
                      }
                      uploadedFonts={uploadedFonts}
                      fontBusy={fontBusy}
                      onDeleteFamily={deleteUploadedFontEverywhere}
                      fontLabelForValue={fontLabelForValue}
                      builtins={FONT_BUILTINS}
                      defaultValue={DEFAULT_SETTINGS.fontFamily}
                    />
                  ) : null}
                  {settings.fontApplyTargets?.includes('cellEvents') ? (
                    <FontFamilyPicker
                      label="גופן לאירועים/טקסט במרכז התא"
                      value={settings.fontFamilyByTarget?.cellEvents ?? settings.fontFamily}
                      onPick={(v) =>
                        setSettings((s) => ({
                          ...s,
                          fontFamilyByTarget: { ...(s.fontFamilyByTarget ?? {}), cellEvents: v },
                        }))
                      }
                      uploadedFonts={uploadedFonts}
                      fontBusy={fontBusy}
                      onDeleteFamily={deleteUploadedFontEverywhere}
                      fontLabelForValue={fontLabelForValue}
                      builtins={FONT_BUILTINS}
                      defaultValue={DEFAULT_SETTINGS.fontFamily}
                    />
                  ) : null}
                </div>
              ) : null}
              <div className="mt-2 text-xs text-slate-600">
                אם לא מסמנים “הכל”, הגופן לא יכפה על שאר הממשק — רק על החלקים שנבחרו.
              </div>
            </div>

            <div className="sm:col-span-2 lg:col-span-3 min-w-0 rounded-lg border border-slate-200 bg-white/80 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-normal text-slate-900">העלאת גופן מהמחשב</div>
                  <div className="text-xs text-slate-600 mt-1">
                    TTF / OTF / WOFF / WOFF2. נשמר מקומית בדפדפן (IndexedDB) וייטען אוטומטית בפעם הבאה.
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 transition"
                    onClick={() => fontPickerRef.current?.click()}
                    disabled={fontBusy !== null}
                  >
                    {fontBusy ? 'מעלה…' : 'בחר קובץ גופן'}
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 transition disabled:opacity-40"
                    disabled={!uploadedFonts.length || fontBusy !== null}
                    onClick={async () => {
                      try {
                        if (!uploadedFonts.length) return;
                        const last = uploadedFonts.at(-1);
                        if (!last) return;
                        setFontBusy(last.id);
                        await deleteStoredFont(last.id);
                        setUploadedFonts((prev) => prev.filter((x) => x.id !== last.id));
                        if (settings.fontFamily.includes(last.family)) {
                          setSettings((s) => ({ ...s, fontFamily: DEFAULT_SETTINGS.fontFamily }));
                        }
                      } finally {
                        setFontBusy(null);
                      }
                    }}
                    title="מוחק את הגופן האחרון שהועלה"
                  >
                    מחק גופן אחרון
                  </button>
                </div>
              </div>
              <div
                className={[
                  'mt-3 rounded-xl border border-dashed px-4 py-4 text-sm',
                  fontDragActive
                    ? 'border-sky-300 bg-sky-50 text-slate-900'
                    : 'border-slate-200 bg-white text-slate-600',
                ].join(' ')}
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (fontBusy) return;
                  setFontDragActive(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (fontBusy) return;
                  setFontDragActive(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setFontDragActive(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setFontDragActive(false);
                  if (fontBusy) return;
                  const files = Array.from(e.dataTransfer.files || []);
                  void uploadFontFiles(files);
                }}
              >
                גרור קובץ גופן מהתיקייה ושחרר כאן (אפשר גם כמה קבצים).
              </div>
              <input
                ref={fontPickerRef}
                type="file"
                accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  e.target.value = '';
                  if (!files.length) return;
                  void uploadFontFiles(files);
                }}
              />
              {uploadedFonts.length ? (
                <div className="mt-3 text-xs text-slate-600">
                  גופנים שהועלו: {uploadedFonts.map((f) => f.family).join(' • ')}
                </div>
              ) : (
                <div className="mt-3 text-xs text-slate-500">עדיין לא הועלו גופנים.</div>
              )}
            </div>

            <label className="text-sm text-slate-700">
              גודל גופן ({settings.fontSizePx}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={11}
                max={20}
                value={settings.fontSizePx}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    fontSizePx: Number(e.target.value),
                  }))
                }
              />
            </label>

            <label className="text-sm text-slate-700">
              גודל מספר לועזי ({settings.gregDayFontPx}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={1}
                max={40}
                value={settings.gregDayFontPx}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    gregDayFontPx: Number(e.target.value),
                  }))
                }
              />
            </label>

            <label className="text-sm text-slate-700">
              גודל יום עברי ({settings.hebDayFontPx}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={1}
                max={40}
                value={settings.hebDayFontPx}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    hebDayFontPx: Number(e.target.value),
                  }))
                }
              />
            </label>

            <label className="text-sm text-slate-700">
              גודל שם אירוע ({settings.eventTitleFontPx}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={1}
                max={18}
                value={settings.eventTitleFontPx}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    eventTitleFontPx: Number(e.target.value),
                  }))
                }
              />
            </label>

            <label className="text-sm text-slate-700">
              גודל זמני שבת ({settings.shabbatTimesFontPx}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={1}
                max={14}
                value={settings.shabbatTimesFontPx}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    shabbatTimesFontPx: Number(e.target.value),
                  }))
                }
              />
            </label>

            <div className="sm:col-span-2 lg:col-span-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              <div className="text-xs font-bold text-slate-700 mb-2">
                תצוגת תא אמיתית (כמו בלוח)
              </div>
              <div className="flex flex-col sm:flex-row gap-3 items-start">
                <div
                  className="relative overflow-hidden rounded-lg border border-slate-200 bg-white"
                  style={{ width: 260, height: 190 }}
                >
                  {/* Top-right date band (same placement style as the real cell) */}
                  <div className="absolute right-2 top-2 z-10 flex items-center gap-1 text-right text-slate-900">
                    <span
                      className="font-semibold text-slate-600"
                      style={{ fontSize: cellScaledPx(settings.gregDayFontPx), lineHeight: 1 }}
                    >
                      14
                    </span>
                    <span
                      className="font-semibold"
                      style={{ fontSize: cellScaledPx(settings.hebDayFontPx), lineHeight: 1 }}
                    >
                      י״ד
                    </span>
                  </div>

                  {/* Center event text */}
                  <div className="absolute inset-0 flex items-center justify-center px-5">
                    <div
                      className="w-full text-center font-bold text-slate-800"
                      style={{ fontSize: cellScaledPx(settings.eventTitleFontPx), lineHeight: 1.15 }}
                    >
                      ערב פסח
                    </div>
                  </div>

                  {/* Bottom zmanim block (same idea/placement as the real cell) */}
                  <div
                    className="absolute inset-x-2 bottom-2 z-20 min-w-0 max-w-full leading-snug text-slate-800 text-right space-y-0.5"
                    style={{ fontSize: cellScaledPx(settings.shabbatTimesFontPx) }}
                  >
                    <div className="font-normal text-slate-900 whitespace-nowrap">
                      כניסת השבת:
                    </div>
                    <HebcalZmanimLine jer="18:22" ta="18:20" />
                  </div>
                </div>

                <div className="text-xs text-slate-600 max-w-sm leading-relaxed">
                  כאן אתה רואה את אותם סוגי שכבות של התא בלוח (תאריך בפינה, טקסט אירוע במרכז,
                  וזמנים בתחתית), כך שכל שינוי בסליידרים משקף את מה שיקרה בתאים אמיתיים.
                </div>
              </div>
            </div>

            <label className="text-sm text-slate-700">
              משקל
              <select
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
                value={settings.fontWeight}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    fontWeight: Number(e.target.value) as 400 | 600 | 700,
                  }))
                }
              >
                <option value={400}>רגיל</option>
                <option value={600}>חצי‑בולד</option>
                <option value={700}>בולד</option>
              </select>
            </label>

            </SettingsCategory>

            <SettingsCategory icon="🖌️" title="צבעים, מסגרות וריפוד">
            <div className="sm:col-span-2 lg:col-span-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              <div className="text-sm font-semibold text-slate-900 mb-2">משבצות ריקות / ריפוד</div>
              <div id="settings-anchor-padding-cells" className="scroll-mt-24" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ColorInput
                  label="צבע בסיס (אפור)"
                  value={settings.paddingCellColor}
                  onChange={(hex) =>
                    setSettings((s) => ({
                      ...s,
                      paddingCellColor: hex,
                    }))
                  }
                />

                <label className="text-sm text-slate-700">
                  עוצמת אפור (0–1):{' '}
                  {Number(settings.paddingCellStrength).toFixed(2)}
                  <input
                    className="mt-2 w-full"
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={Number(settings.paddingCellStrength)}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        paddingCellStrength: Number(e.target.value),
                      }))
                    }
                  />
                </label>
              </div>
              <div className="mt-2 text-xs text-slate-600">
                תצוגה מקדימה:{' '}
                <span
                  className="inline-block align-middle h-4 w-10 rounded border border-slate-200"
                  style={{ background: paddingBg }}
                />
              </div>
            </div>

            <label className="text-sm text-slate-700">
              קווי טבלה (מסגרת חיצונית) {settings.gridBorderWidthPx}px
              <input
                className="mt-2 w-full"
                type="range"
                min={0}
                max={6}
                value={settings.gridBorderWidthPx}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    gridBorderWidthPx: Number(e.target.value),
                  }))
                }
              />
            </label>

            <ColorInput
              label="צבע מסגרת חיצונית"
              value={settings.gridBorderColor}
              onChange={(hex) =>
                setSettings((s) => ({
                  ...s,
                  gridBorderColor: hex,
                }))
              }
            />

            <label className="text-sm text-slate-700">
              כותרות ימי השבוע (שורה עליונה)
              <div id="settings-anchor-weekdays" className="scroll-mt-24" />
              <select
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
                value={settings.weekdayHeaderMode}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    weekdayHeaderMode: e.target.value as 'shortLetter' | 'fullName',
                  }))
                }
              >
                <option value="shortLetter">א׳ · ב׳ · ג׳ … (מקוצר)</option>
                <option value="fullName">ראשון · שני · שלישי … (שם מלא)</option>
              </select>
            </label>

            <ColorInput
              label="צבע רקע פס ימי השבוע"
              value={settings.gridWeekdayHeaderBg}
              onChange={(hex) =>
                setSettings((s) => ({
                  ...s,
                  gridWeekdayHeaderBg: hex,
                }))
              }
            />

            <label className="text-sm text-slate-700">
              גובה פס ימי השבוע ({settings.gridWeekdayHeaderHeightPx}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={22}
                max={60}
                value={settings.gridWeekdayHeaderHeightPx}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    gridWeekdayHeaderHeightPx: Number(e.target.value),
                  }))
                }
              />
            </label>

            <label className="text-sm text-slate-700">
              הזזת טקסט ימי השבוע למעלה/למטה ({settings.gridWeekdayHeaderTextOffsetYPx}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={-14}
                max={14}
                value={settings.gridWeekdayHeaderTextOffsetYPx}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    gridWeekdayHeaderTextOffsetYPx: Number(e.target.value),
                  }))
                }
              />
            </label>

            <ColorInput
              label="צבע טקסט כותרות ימי השבוע"
              value={settings.gridWeekdayHeaderTextColor}
              onChange={(hex) =>
                setSettings((s) => ({
                  ...s,
                  gridWeekdayHeaderTextColor: hex,
                }))
              }
            />

            <label className="text-sm text-slate-700">
              גודל גופן כותרות ימי השבוע ({settings.gridWeekdayHeaderFontPx}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={9}
                max={22}
                value={settings.gridWeekdayHeaderFontPx}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    gridWeekdayHeaderFontPx: Number(e.target.value),
                  }))
                }
              />
            </label>

            <label className="text-sm text-slate-700">
              משקל גופן כותרות ימי השבוע ({settings.gridWeekdayHeaderFontWeight})
              <input
                className="mt-2 w-full"
                type="range"
                min={400}
                max={900}
                step={50}
                value={settings.gridWeekdayHeaderFontWeight}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    gridWeekdayHeaderFontWeight: Number(e.target.value),
                  }))
                }
              />
            </label>

            <label className="text-sm text-slate-700">
              עובי קו תחתון לפס ימי השבוע ({settings.gridWeekdayHeaderBorderBottomWidthPx}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={0}
                max={4}
                value={settings.gridWeekdayHeaderBorderBottomWidthPx}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    gridWeekdayHeaderBorderBottomWidthPx: Number(e.target.value),
                  }))
                }
              />
            </label>

            <ColorInput
              label="צבע קו תחתון לפס ימי השבוע"
              value={settings.gridWeekdayHeaderBorderBottomColor}
              onChange={(hex) =>
                setSettings((s) => ({
                  ...s,
                  gridWeekdayHeaderBorderBottomColor: hex,
                }))
              }
            />

            <label className="text-sm text-slate-700">
              היסט אנכי לפס ימי השבוע ({settings.gridWeekdayHeaderRowOffsetYPx}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={-10}
                max={10}
                value={settings.gridWeekdayHeaderRowOffsetYPx}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    gridWeekdayHeaderRowOffsetYPx: Number(e.target.value),
                  }))
                }
              />
            </label>

            <label className="text-sm text-slate-700">
              קווי תאים {settings.cellBorderWidthPx}px
              <div id="settings-anchor-borders" className="scroll-mt-24" />
              <input
                className="mt-2 w-full"
                type="range"
                min={0}
                max={4}
                value={settings.cellBorderWidthPx}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    cellBorderWidthPx: Number(e.target.value),
                  }))
                }
              />
            </label>

            <ColorInput
              label="צבע קווי תאים"
              value={settings.cellBorderColor}
              onChange={(hex) =>
                setSettings((s) => ({
                  ...s,
                  cellBorderColor: hex,
                }))
              }
            />

            <label className="text-sm text-slate-700 flex items-center gap-2 mt-6">
              <input
                type="checkbox"
                checked={settings.showCellBorders}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    showCellBorders: e.target.checked,
                  }))
                }
              />
              להציג קווי תאים
            </label>

            <div id="settings-anchor-colors" className="scroll-mt-24" />
            <ColorInput
              label="צבע אירועים (חגים/ר״ח/יום העצמאות וכו׳)"
              value={settings.eventBg}
              onChange={(hex) => setSettings((s) => ({ ...s, eventBg: hex }))}
            />

            <ColorInput
              label="צבע שבת"
              value={settings.shabbatBg}
              onChange={(hex) => setSettings((s) => ({ ...s, shabbatBg: hex }))}
            />

            <ColorInput
              label="צבע “היום”"
              value={settings.todayBg}
              onChange={(hex) => setSettings((s) => ({ ...s, todayBg: hex }))}
            />

            </SettingsCategory>

            <SettingsCategory icon="📄" title="ייצוא PDF (חודש)">
            <div id="settings-anchor-export" className="sm:col-span-2 lg:col-span-3 scroll-mt-24" />
            <div className="sm:col-span-2 lg:col-span-3 rounded-md border border-slate-200 bg-white/80 px-2 py-2 text-xs text-slate-600">
              גודל עמוד לפי ההגדרות:{' '}
              <span className="font-semibold text-slate-800">
                {pdfPageMm.widthMm}×{pdfPageMm.heightMm} מ״מ
              </span>
              , שוליים {settings.pdfMarginMm} מ״מ.
            </div>

            <label className="text-sm text-slate-700">
              גודל עמוד (תבנית)
              <select
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
                value={settings.pdfPagePreset}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    pdfPagePreset: e.target.value as CalendarSettings['pdfPagePreset'],
                  }))
                }
              >
                <option value="A4">A4</option>
                <option value="A5">A5</option>
                <option value="custom">מותאם (מ״מ)</option>
              </select>
            </label>

            <label className="text-sm text-slate-700">
              כיוון עמוד
              <select
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
                value={settings.pdfOrientation}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    pdfOrientation: e.target.value as CalendarSettings['pdfOrientation'],
                  }))
                }
              >
                <option value="landscape">לרוחב</option>
                <option value="portrait">לאורך</option>
              </select>
            </label>

            {settings.pdfPagePreset === 'custom' ? (
              <>
                <label className="text-sm text-slate-700">
                  רוחב מותאם (מ״מ)
                  <input
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
                    type="number"
                    min={80}
                    max={420}
                    value={settings.pdfCustomWidthMm}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        pdfCustomWidthMm: Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label className="text-sm text-slate-700">
                  גובה מותאם (מ״מ)
                  <input
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
                    type="number"
                    min={80}
                    max={420}
                    value={settings.pdfCustomHeightMm}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        pdfCustomHeightMm: Number(e.target.value),
                      }))
                    }
                  />
                </label>
              </>
            ) : null}

            <label className="text-sm text-slate-700 sm:col-span-2 lg:col-span-3">
              שוליים סביב העמוד ({settings.pdfMarginMm} מ״מ)
              <input
                className="mt-2 w-full"
                type="range"
                min={0}
                max={24}
                step={1}
                value={settings.pdfMarginMm}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    pdfMarginMm: Number(e.target.value),
                  }))
                }
              />
            </label>



            </SettingsCategory>

            <SettingsCategory icon="📌" title="כותרת, מבנה וכללי">
            <label className="text-sm text-slate-700 flex items-center gap-2 mt-6">
              <input
                type="checkbox"
                checked={settings.showParsha}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, showParsha: e.target.checked }))
                }
              />
              הצג פרשת השבוע (בשבתות)
            </label>

            <label className="text-sm text-slate-700 flex items-center gap-2 mt-6">
              <input
                type="checkbox"
                checked={settings.enableManualEdits}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    enableManualEdits: e.target.checked,
                  }))
                }
              />
              אפשר עריכה ידנית לתאים (קליק)
            </label>
            <div id="settings-anchor-manual-edits" className="sm:col-span-2 lg:col-span-3 scroll-mt-24" />

            <label className="text-sm text-slate-700 flex items-center gap-2 mt-6">
              <input
                type="checkbox"
                checked={settings.showEditButtonInCells}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    showEditButtonInCells: e.target.checked,
                  }))
                }
              />
              הצג כפתור “ערוך” בתוך התאים
            </label>

            <div
              id="settings-anchor-headerbar-size"
              className="sm:col-span-2 lg:col-span-3 scroll-mt-24"
            />
            <label className="text-sm text-slate-700">
              גובה פס כותרת ({settings.headerBarHeightPx}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={48}
                max={140}
                value={settings.headerBarHeightPx}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    headerBarHeightPx: Number(e.target.value),
                  }))
                }
              />
            </label>

            <label className="text-sm text-slate-700">
              עיגול פינות פס ({settings.headerBarRadiusPx}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={0}
                max={28}
                value={settings.headerBarRadiusPx}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    headerBarRadiusPx: Number(e.target.value),
                  }))
                }
              />
            </label>

            <div
              id="settings-anchor-headerbar-colors"
              className="sm:col-span-2 lg:col-span-3 scroll-mt-24"
            />
            <ColorInput
              label="צבע רקע פס"
              value={
                (settings.headerBarBg ?? '').startsWith('#')
                  ? (settings.headerBarBg as string)
                  : '#FFFFFF'
              }
              onChange={(hex) =>
                setSettings((s) => ({
                  ...s,
                  headerBarBg: hex,
                }))
              }
            />
            <div className="mt-1 text-xs text-slate-500 sm:col-span-2 lg:col-span-3">
              שים לב: בחירת צבע תחליף לרקע אטום (לא שקוף).
            </div>

            <ColorInput
              label="צבע מסגרת פס"
              value={settings.headerBarBorderColor}
              onChange={(hex) =>
                setSettings((s) => ({
                  ...s,
                  headerBarBorderColor: hex,
                }))
              }
            />

            <label className="text-sm text-slate-700">
              עובי מסגרת פס ({settings.headerBarBorderWidthPx}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={0}
                max={6}
                value={settings.headerBarBorderWidthPx}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    headerBarBorderWidthPx: Number(e.target.value),
                  }))
                }
              />
            </label>

            <ColorInput
              label="צבע כותרת ראשית"
              value={settings.headerBarTitleColor}
              onChange={(hex) =>
                setSettings((s) => ({
                  ...s,
                  headerBarTitleColor: hex,
                }))
              }
            />

            <ColorInput
              label="צבע כותרת משנה"
              value={settings.headerBarSubtitleColor}
              onChange={(hex) =>
                setSettings((s) => ({
                  ...s,
                  headerBarSubtitleColor: hex,
                }))
              }
            />

            <label className="text-sm text-slate-700 sm:col-span-2 lg:col-span-3 font-semibold text-slate-900">
              תצוגת חודש (מרכז: עברי, שמאל: לועזי)
            </label>
            <div
              id="settings-anchor-header-month"
              className="sm:col-span-2 lg:col-span-3 scroll-mt-24"
            />

            <label className="text-sm text-slate-700">
              גודל טקסט חודש עברי במרכז ({settings.headerHebMonthFontPx}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={14}
                max={40}
                value={settings.headerHebMonthFontPx}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    headerHebMonthFontPx: Number(e.target.value),
                  }))
                }
              />
            </label>

            <label className="text-sm text-slate-700">
              גודל טקסט חודש/שנה לועזי משמאל ({settings.headerGregMonthFontPx}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={10}
                max={28}
                value={settings.headerGregMonthFontPx}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    headerGregMonthFontPx: Number(e.target.value),
                  }))
                }
              />
            </label>

            <ColorInput
              label="צבע טקסט לועזי"
              value={settings.headerGregMonthTextColor}
              onChange={(hex) =>
                setSettings((s) => ({
                  ...s,
                  headerGregMonthTextColor: hex,
                }))
              }
            />

            <ColorInput
              label="צבע מסגרת תג עברי (מרכז)"
              value={settings.headerHebMonthBorderColor}
              onChange={(hex) =>
                setSettings((s) => ({
                  ...s,
                  headerHebMonthBorderColor: hex,
                }))
              }
            />

            <label className="text-sm text-slate-700">
              עובי מסגרת תג עברי (מרכז) ({settings.headerHebMonthBorderWidthPx}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={0}
                max={8}
                value={settings.headerHebMonthBorderWidthPx}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    headerHebMonthBorderWidthPx: Number(e.target.value),
                  }))
                }
              />
            </label>

            <ColorInput
              label="רקע תג עברי (מרכז)"
              value={
                (settings.headerHebMonthBg ?? '').startsWith('#')
                  ? (settings.headerHebMonthBg as string)
                  : '#FFFFFF'
              }
              onChange={(hex) =>
                setSettings((s) => ({
                  ...s,
                  headerHebMonthBg: hex,
                }))
              }
            />
            <div className="mt-1 text-xs text-slate-500 sm:col-span-2 lg:col-span-3">
              שים לב: בחירת צבע תחליף לרקע אטום (לא שקוף).
            </div>

            <ColorInput
              label="צבע טקסט תג עברי (מרכז)"
              value={settings.headerHebMonthTextColor}
              onChange={(hex) =>
                setSettings((s) => ({
                  ...s,
                  headerHebMonthTextColor: hex,
                }))
              }
            />

            <label className="text-sm text-slate-700">
              משקל גופן תג עברי (מרכז) ({settings.headerHebMonthFontWeight})
              <input
                className="mt-2 w-full"
                type="range"
                min={400}
                max={900}
                step={50}
                value={settings.headerHebMonthFontWeight}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    headerHebMonthFontWeight: Number(e.target.value),
                  }))
                }
              />
            </label>

            <label className="text-sm text-slate-700">
              עיגול פינות תג עברי (מרכז) ({settings.headerHebMonthRadiusPx}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={0}
                max={999}
                value={settings.headerHebMonthRadiusPx}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    headerHebMonthRadiusPx: Number(e.target.value),
                  }))
                }
              />
            </label>

            <label className="text-sm text-slate-700">
              ריפוד תג עברי לרוחב ({settings.headerHebMonthPaddingXPx}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={6}
                max={40}
                value={settings.headerHebMonthPaddingXPx}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    headerHebMonthPaddingXPx: Number(e.target.value),
                  }))
                }
              />
            </label>

            <label className="text-sm text-slate-700">
              ריפוד תג עברי לגובה ({settings.headerHebMonthPaddingYPx}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={2}
                max={22}
                value={settings.headerHebMonthPaddingYPx}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    headerHebMonthPaddingYPx: Number(e.target.value),
                  }))
                }
              />
            </label>

            <label className="text-sm text-slate-700 sm:col-span-2 lg:col-span-3 font-semibold text-slate-900">
              מיקום ורוחב פס הכותרת
            </label>
            <div
              id="settings-anchor-header-position"
              className="sm:col-span-2 lg:col-span-3 scroll-mt-24"
            />

            <label className="text-sm text-slate-700">
              מרווח מתחת לפס לפני הטבלה ({settings.headerBarMarginBottomPx}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={0}
                max={48}
                value={settings.headerBarMarginBottomPx}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    headerBarMarginBottomPx: Number(e.target.value),
                  }))
                }
              />
            </label>

            <label className="text-sm text-slate-700">
              הזזת פס כותרת למטה/למעלה ({settings.headerBarOffsetYPx}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={-40}
                max={40}
                value={settings.headerBarOffsetYPx}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    headerBarOffsetYPx: Number(e.target.value),
                  }))
                }
              />
            </label>

            <label className="text-sm text-slate-700">
              רוחב מקסימלי לפס ({settings.headerBarMaxWidthPx === 0 ? 'ללא' : `${settings.headerBarMaxWidthPx}px`})
              <input
                className="mt-2 w-full"
                type="range"
                min={0}
                max={1400}
                step={10}
                value={settings.headerBarMaxWidthPx}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    headerBarMaxWidthPx: Number(e.target.value),
                  }))
                }
              />
              <div className="mt-1 text-xs text-slate-500">0 = רוחב מלא (לפי הקנבס)</div>
            </label>

            <label className="text-sm text-slate-700">
              הזזת כותרות (ימין/שמאל) ({settings.headerBarTitlesOffsetXPx}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={-60}
                max={60}
                value={settings.headerBarTitlesOffsetXPx}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    headerBarTitlesOffsetXPx: Number(e.target.value),
                  }))
                }
              />
            </label>

            <label className="text-sm text-slate-700">
              הזזת כותרות (למעלה/למטה) ({settings.headerBarTitlesOffsetYPx}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={-40}
                max={40}
                value={settings.headerBarTitlesOffsetYPx}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    headerBarTitlesOffsetYPx: Number(e.target.value),
                  }))
                }
              />
            </label>

            <label className="text-sm text-slate-700">
              הזזת תג החודש (ימין/שמאל) ({settings.headerBarMonthPillOffsetXPx}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={-60}
                max={60}
                value={settings.headerBarMonthPillOffsetXPx}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    headerBarMonthPillOffsetXPx: Number(e.target.value),
                  }))
                }
              />
            </label>

            <label className="text-sm text-slate-700">
              הזזת תג החודש (למעלה/למטה) ({settings.headerBarMonthPillOffsetYPx}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={-40}
                max={40}
                value={settings.headerBarMonthPillOffsetYPx}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    headerBarMonthPillOffsetYPx: Number(e.target.value),
                  }))
                }
              />
            </label>

            <label className="text-sm text-slate-700 flex items-center gap-2 mt-6">
              <input
                type="checkbox"
                checked={settings.headerBarShowEditButton}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    headerBarShowEditButton: e.target.checked,
                  }))
                }
              />
              הצג כפתור “ערוך” בפס הכותרת
            </label>

            </SettingsCategory>

            <SettingsCategory icon="🖼️" title="רקע, קנבס ופריסה">
            <label className="text-sm text-slate-700 sm:col-span-2 lg:col-span-3">
              תמונת רקע לטבלה
              <div id="settings-anchor-background" className="scroll-mt-24" />
              <div className="mt-1 flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="bgMode"
                        checked={settings.backgroundImageMode === 'year'}
                        onChange={() =>
                          setSettings((s) => ({ ...s, backgroundImageMode: 'year' }))
                        }
                      />
                      תמונה אחת לכל השנה
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="bgMode"
                        checked={settings.backgroundImageMode === 'perMonth'}
                        onChange={() =>
                          setSettings((s) => ({ ...s, backgroundImageMode: 'perMonth' }))
                        }
                      />
                      תמונה לכל חודש
                    </label>
                  </div>

                  {settings.backgroundImageMode === 'perMonth' ? (
                    <select
                      className="w-full sm:w-56 rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
                      value={bgMonthIdx}
                      onChange={(e) => setBgMonthIdx(Number(e.target.value))}
                    >
                      {[
                        'ינואר',
                        'פברואר',
                        'מרץ',
                        'אפריל',
                        'מאי',
                        'יוני',
                        'יולי',
                        'אוגוסט',
                        'ספטמבר',
                        'אוקטובר',
                        'נובמבר',
                        'דצמבר',
                      ].map((name, idx) => (
                        <option key={idx} value={idx}>
                          {name}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  {settings.backgroundImageMode === 'perMonth' ? (
                    <p className="text-xs text-slate-500 max-w-md">
                      החודש ברשימה מתעדכן אוטומטית כשעוברים חודש בלוח, כדי שהעלאה תישמר לחודש הנכון.
                    </p>
                  ) : null}
                </div>

                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      const dataUrl = String(reader.result ?? '');
                      setSettings((s) => {
                        if (s.backgroundImageMode === 'perMonth') {
                          const arr = Array.isArray(s.backgroundImagesByMonth)
                            ? [...s.backgroundImagesByMonth]
                            : (new Array(12).fill(undefined) as (string | undefined)[]);
                          arr[bgMonthIdx] = dataUrl;
                          return { ...s, backgroundImagesByMonth: arr };
                        }
                        return { ...s, backgroundImageDataUrl: dataUrl };
                      });
                    };
                    reader.readAsDataURL(file);
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setSettings((s) => {
                      if (s.backgroundImageMode === 'perMonth') {
                        const arr = Array.isArray(s.backgroundImagesByMonth)
                          ? [...s.backgroundImagesByMonth]
                          : (new Array(12).fill(undefined) as (string | undefined)[]);
                        arr[bgMonthIdx] = undefined;
                        return { ...s, backgroundImagesByMonth: arr };
                      }
                      return { ...s, backgroundImageDataUrl: undefined };
                    });
                  }}
                  className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                >
                  הסר רקע
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSettings((s) => ({
                      ...s,
                      backgroundImageDataUrl: undefined,
                      backgroundImagesByMonth: undefined,
                    }))
                  }
                  className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                >
                  הסר הכל
                </button>
                <div className="text-sm text-slate-600">
                  אטימות ({Math.round(settings.backgroundOpacity * 100)}%)
                  <input
                    className="ml-2 align-middle"
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={settings.backgroundOpacity}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        backgroundOpacity: Number(e.target.value),
                      }))
                    }
                  />
                </div>
              </div>
            </label>

            <div
              id="settings-anchor-canvas-surface"
              className="sm:col-span-2 lg:col-span-3 scroll-mt-24"
            />
            <div className="sm:col-span-2 lg:col-span-3 rounded-lg border border-slate-100 bg-slate-50/80 p-3 text-xs text-slate-600">
              מסגרת הקנבס בגודל{' '}
              <span className="font-semibold text-slate-800">
                {canvasSurfacePx.widthPx}×{canvasSurfacePx.heightPx}px
              </span>{' '}
              — לפי עמוד הייצוא ({settings.pdfPagePreset === 'custom' ? 'מותאם' : settings.pdfPagePreset},{' '}
              {settings.pdfOrientation === 'landscape' ? 'לרוחב' : 'לאורך'}). שינוי ב־PDF מעדכן גם את
              הקנבס כאן.
            </div>

            <label className="text-sm text-slate-700 flex items-center gap-2 sm:col-span-2 lg:col-span-3">
              <input
                type="checkbox"
                checked={settings.layoutAutoFitToCanvas}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    layoutAutoFitToCanvas: e.target.checked,
                    // Auto-fit commonly pairs with fill-height, but keep fill-height user-controllable.
                    layoutFillHeight: e.target.checked ? true : s.layoutFillHeight,
                  }))
                }
              />
              מתח את הלוח למילוי הקנבס
            </label>

            <label className="text-sm text-slate-700 flex items-center gap-2 sm:col-span-2 lg:col-span-3">
              <input
                type="checkbox"
                checked={settings.layoutFillHeight}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    layoutFillHeight: e.target.checked,
                  }))
                }
              />
              מלא גובה (מותח את שורות הלוח עד התחתית)
            </label>

            <label className="text-sm text-slate-700">
              זום הלוח ({resolveCalendarLayoutZoomPercent(settings)}%)
              <input
                className="mt-2 w-full"
                type="range"
                min={40}
                max={100}
                step={1}
                value={resolveCalendarLayoutZoomPercent(settings)}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    calendarLayoutScalePercent: Number(e.target.value),
                  }))
                }
              />
              <div className="mt-1 text-xs text-slate-500">
                אם יש חפיפות בגלל צפיפות/גובה — הורד את הזום מעט.
              </div>
            </label>

            <label className="text-sm text-slate-700 flex items-center gap-2 sm:col-span-2 lg:col-span-3">
              <input
                type="checkbox"
                checked={settings.layoutCenterVertically}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    layoutCenterVertically: e.target.checked,
                  }))
                }
              />
              מרכוז אנכי בתוך הקנבס (כשלא ממלאים גובה)
            </label>

            <label className="text-sm text-slate-700">
              רווח מסביב בקנבס ({settings.canvasPaddingPx}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={0}
                max={60}
                value={settings.canvasPaddingPx}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    canvasPaddingPx: Number(e.target.value),
                  }))
                }
              />
            </label>
            <label className="text-sm text-slate-700">
              ריפוד עליון בקנבס ({settings.canvasPaddingTopPx}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={0}
                max={120}
                value={settings.canvasPaddingTopPx}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    canvasPaddingTopPx: Number(e.target.value),
                  }))
                }
              />
              <div className="mt-1 text-xs text-slate-500">
                מוריד את הרווח הלבן מעל הפס העליון.
              </div>
            </label>
            <label className="text-sm text-slate-700">
              מסגרת הקנבס ({settings.canvasBorderWidthPx}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={0}
                max={8}
                value={settings.canvasBorderWidthPx}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    canvasBorderWidthPx: Number(e.target.value),
                  }))
                }
              />
            </label>
            <label className="text-sm text-slate-700">
              עיגול פינות מסגרת קנבס ({settings.canvasOuterRadiusPx}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={0}
                max={28}
                value={settings.canvasOuterRadiusPx}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    canvasOuterRadiusPx: Number(e.target.value),
                  }))
                }
              />
            </label>

            <ColorInput
              label="צבע מסגרת קנבס"
              value={settings.canvasBorderColor}
              onChange={(hex) =>
                setSettings((s) => ({
                  ...s,
                  canvasBorderColor: hex,
                }))
              }
            />
            </SettingsCategory>
          </div>
        </div>
      )}

      <div
        dir="ltr"
        className="relative mx-auto flex w-full justify-center gap-3"
        style={{ maxWidth: canvasSurfacePx.widthPx + 220 }}
      >
        {/* Category shortcuts (right of canvas, never overlapping) */}
        <div className="order-2 flex w-[160px] shrink-0 flex-col gap-2 pt-2">
          {[
            {
              key: 'themes',
              label: 'ערכות צבע',
              cls: 'border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100',
              items: [{ label: 'בורר ערכות צבע', anchorId: 'settings-anchor-themes' }],
            },
            {
              key: 'header',
              label: 'פס עליון',
              cls: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900 hover:bg-fuchsia-100',
              items: [
                { label: 'גובה/מסגרת', anchorId: 'settings-anchor-headerbar-size' },
                { label: 'צבעים', anchorId: 'settings-anchor-headerbar-colors' },
                { label: 'חודש עברי/לועזי', anchorId: 'settings-anchor-header-month' },
                { label: 'מיקום/רוחב', anchorId: 'settings-anchor-header-position' },
              ],
            },
            {
              key: 'zmanim',
              label: 'זמנים',
              cls: 'border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100',
              items: [{ label: 'כניסה/יציאה', anchorId: 'settings-anchor-zmanim' }],
            },
            {
              key: 'typography',
              label: 'טיפוגרפיה',
              cls: 'border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100',
              items: [{ label: 'גופנים/משקלים', anchorId: 'settings-anchor-header' }],
            },
            {
              key: 'colors',
              label: 'צבעים',
              cls: 'border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100',
              items: [
                { label: 'צבעי ימים', anchorId: 'settings-anchor-colors' },
                { label: 'ריפוד תאים', anchorId: 'settings-anchor-padding-cells' },
                { label: 'קווים/מסגרות', anchorId: 'settings-anchor-borders' },
              ],
            },
            {
              key: 'weekdays',
              label: 'ימי שבוע',
              cls: 'border-teal-200 bg-teal-50 text-teal-900 hover:bg-teal-100',
              items: [{ label: 'פורמט/צבע/גובה', anchorId: 'settings-anchor-weekdays' }],
            },
            {
              key: 'export',
              label: 'ייצוא',
              cls: 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100',
              items: [{ label: 'PDF/HTML/PNG', anchorId: 'settings-anchor-export' }],
            },
            {
              key: 'background',
              label: 'רקע/קנבס',
              cls: 'border-indigo-200 bg-indigo-50 text-indigo-900 hover:bg-indigo-100',
              items: [
                { label: 'תמונת רקע', anchorId: 'settings-anchor-background' },
                { label: 'גודל/זום', anchorId: 'settings-anchor-canvas-surface' },
              ],
            },
            {
              key: 'manual',
              label: 'עריכה ידנית',
              cls: 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50',
              items: [{ label: 'אפשרויות', anchorId: 'settings-anchor-manual-edits' }],
            },
          ].map((b) => (
            <div key={b.key} className="relative w-full">
              <button
                type="button"
                className={[
                  'w-full text-right px-3 py-2 text-sm rounded-md border transition shadow-sm',
                  b.cls,
                ].join(' ')}
                onClick={() => {
                  setShortcutOpen((prev) => (prev === b.key ? null : b.key));
                }}
              >
                <span className="truncate">{b.label}</span>
              </button>
              {shortcutOpen === b.key ? (
                <div
                  className={[
                    'absolute top-0 z-30 w-[220px] rounded-md border border-slate-200 bg-white shadow-lg overflow-hidden',
                    // Open the submenu to the left of the sidebar (so it never covers the list below).
                    'right-full mr-2',
                  ].join(' ')}
                >
                  <div className="max-h-[260px] overflow-auto">
                    {b.items.map((it) => (
                      <button
                        key={it.anchorId}
                        type="button"
                        className="w-full text-right px-3 py-2 text-xs hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                        onClick={() => {
                          openAndJumpToSetting(it.anchorId);
                          setShortcutOpen(null);
                        }}
                      >
                        {it.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
          <button
            type="button"
            className="mt-2 w-full text-right px-3 py-2 text-sm rounded-md border border-slate-200 bg-slate-900 text-white hover:bg-slate-800 transition"
            onClick={() => {
              setSettingsOpen(false);
              setShortcutOpen(null);
            }}
          >
            סגור עריכה
          </button>
        </div>

        {/* Ornamental canvas around the table — גודל כמו עמוד PDF (ברירת מחדל A4 לרוחב) */}
        <div
          className={[
            'order-1',
            'relative shadow-sm',
            // Always allow scrolling if content overflows the frame (when zoom/manual settings exceed the canvas).
            'overflow-auto',
          ].join(' ')}
          data-inspect="background"
          style={{
            border: `${settings.canvasBorderWidthPx}px solid ${settings.canvasBorderColor}`,
            borderRadius: resolveCanvasOuterRadiusPx(settings),
            padding: settings.canvasPaddingPx,
            paddingTop: settings.canvasPaddingTopPx,
            backgroundColor: settings.calendarCanvasFill,
            ...canvasBgStyle,
            width: `min(100%, ${canvasSurfacePx.widthPx}px)`,
            height: canvasSurfacePx.heightPx,
            boxSizing: 'border-box',
          }}
        >
        {/* background is baked into the canvas layer for better PDF parity */}

        <div
          ref={canvasInnerRef}
          className="relative h-full w-full overflow-visible"
          style={
            settings.layoutCenterVertically && !settings.layoutFillHeight
              ? { display: 'flex', alignItems: 'center', justifyContent: 'center' }
              : undefined
          }
        >
          <div
            ref={calendarContentRef}
            className={['w-full origin-center', settings.layoutFillHeight ? 'h-full' : ''].join(' ')}
            style={{
              ...(settings.layoutFillHeight
                ? (() => {
                    const scale =
                      (settings.layoutAutoFitToCanvas ? autoFitScale : 1) *
                      (resolveCalendarLayoutZoomPercent(settings) / 100);
                    // `transform: scale()` shrinks visually but not in layout, which can leave a
                    // visible gap at the bottom when we *want* to fill the canvas height.
                    // Counteract by expanding the unscaled box height so the scaled result is 100%.
                    const safeScale = Math.max(0.01, scale);
                    const hPct = (100 / safeScale).toFixed(4);
                    return {
                      height: `${hPct}%`,
                      minHeight: `${hPct}%`,
                      transform: `scale(${safeScale})`,
                    } as const;
                  })()
                : {
                    transform: `scale(${
                      (settings.layoutAutoFitToCanvas ? autoFitScale : 1) *
                      (resolveCalendarLayoutZoomPercent(settings) / 100)
                    })`,
                  }),
              transformOrigin: 'center center',
            }}
          >
            <div
              className={['relative w-full', settings.layoutFillHeight ? 'h-full' : ''].join(' ')}
              style={{
                ...(settings.layoutFillHeight
                  ? {
                      height: '100%',
                      paddingTop: settings.tableOffsetYPx,
                      boxSizing: 'border-box',
                    }
                  : { marginTop: settings.tableOffsetYPx }),
              }}
            >
          <CalendarMonthChrome
            settings={settings}
            hebrewMonthTitle={hebrewMonthTitle}
            gregorianLabel={formatGregorianMonthYearHebrew(viewDate)}
            onEditHeader={openHeaderEditor}
            gridWeekCount={weeks.length}
            headerFontFamily={
              shouldApplyFontTo('calendarHeader')
                ? resolveFontFamilyFor('calendarHeader')
                : undefined
            }
            headerLayoutEditMode={headerLayoutEditMode}
            onHeaderWysiwygClassicPctChange={(pct) =>
              setSettings((s) => ({ ...s, headerWysiwygClassicPct: pct }))
            }
            onHeaderWysiwygClassicAlignChange={(align) =>
              setSettings((s) => ({ ...s, headerWysiwygClassicAlign: align }))
            }
            gridChildren={
              <>
          {weekdayHeaders.map((d) => (
            <div
              key={d}
              className="text-center"
              data-inspect="weekdays"
              style={{
                borderBottom: `${settings.gridWeekdayHeaderBorderBottomWidthPx}px solid ${settings.gridWeekdayHeaderBorderBottomColor}`,
                color: settings.gridWeekdayHeaderTextColor || '#334155',
                background: settings.gridWeekdayHeaderBg || '#ffffff',
                height: settings.gridWeekdayHeaderHeightPx,
                minHeight: settings.gridWeekdayHeaderHeightPx,
                fontSize: settings.gridWeekdayHeaderFontPx,
                fontWeight: settings.gridWeekdayHeaderFontWeight,
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                paddingLeft: 8,
                paddingRight: 8,
                paddingTop: 0,
                paddingBottom: 0,
                boxSizing: 'border-box',
                transform:
                  settings.gridWeekdayHeaderRowOffsetYPx === 0
                    ? undefined
                    : `translateY(${settings.gridWeekdayHeaderRowOffsetYPx}px)`,
              }}
            >
              <span
                style={{
                  transform:
                    settings.gridWeekdayHeaderTextOffsetYPx === 0
                      ? undefined
                      : `translateY(${settings.gridWeekdayHeaderTextOffsetYPx}px)`,
                  display: 'inline-block',
                  lineHeight: 1,
                }}
              >
                {d}
              </span>
            </div>
          ))}

          {dayMetas.map((m) => {
          if (!m.inMonth) {
            const manual = resolveDayTextOverride(overrides, m.gKey);
            return (
              <div
                key={m.gKey}
                className="relative min-h-0 min-w-0 h-full overflow-hidden"
                style={{
                  background: paddingBg,
                  borderLeft: cellEdgeBorder,
                  borderBottom: cellEdgeBorder,
                  borderRadius: cellRadiusPx ? `${cellRadiusPx}px` : undefined,
                  cursor: settings.enableManualEdits ? 'pointer' : undefined,
                }}
                onClick={(e) => {
                  // Only open picker when clicking the empty cell background (not image drag/delete).
                  if (e.target !== e.currentTarget) return;
                  if (!settings.enableManualEdits) return;
                  pickImageForCell(m.gKey);
                }}
              >
                {manual?.imageDataUrl ? (
                  <>
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage: `url(${manual.imageDataUrl})`,
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: manual.imageFit ?? 'cover',
                        backgroundPosition: `calc(50% + ${(Number(manual.imageOffsetX) || 0).toFixed(
                          1,
                        )}px) calc(50% + ${(Number(manual.imageOffsetY) || 0).toFixed(1)}px)`,
                        opacity:
                          typeof manual.imageOpacity === 'number' ? manual.imageOpacity : 1,
                        cursor: settings.enableManualEdits ? 'grab' : undefined,
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        startImageDrag(m.gKey, e);
                      }}
                      onPointerMove={moveImageDrag}
                      onPointerUp={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        endImageDrag(e);
                      }}
                      onPointerCancel={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        endImageDrag(e);
                      }}
                    />
                    <button
                      type="button"
                      className="absolute left-2 top-2 z-30 rounded border border-slate-200 bg-white/90 px-1 py-px text-xs leading-none text-slate-700 hover:bg-white"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setOverrides((prev) => {
                          const copy = { ...prev };
                          const storeKey = recurringOverrideKeyFromIsoDate(m.gKey);
                          const cur = resolveDayTextOverride(copy, m.gKey) ?? copy[storeKey];
                          if (!cur) return copy;
                          copy[storeKey] = { ...cur, imageDataUrl: undefined };
                          return copy;
                        });
                      }}
                      title="הסר תמונה"
                      aria-label="הסר תמונה"
                    >
                      ✕
                    </button>
                  </>
                ) : null}
              </div>
            );
          }

          const manual = resolveDayTextOverride(overrides, m.gKey);
          const suppressEventHighlight = isCenterContentSuppressedByOverride(manual);
          const bg = m.isToday
            ? settings.todayBg
            : m.isShabbat
              ? settings.shabbatBg
              : m.inMonth && m.isEventDay && !suppressEventHighlight
                ? settings.eventBg
                : m.inMonth
                  ? '#ffffff'
                  : paddingBg;

          const dim = m.inMonth ? 'text-slate-900' : 'text-slate-400';
          const dow = getIsoWeekdaySun0Jerusalem(m.g);
          const isFriday = dow === 5;
          const isErevPesach = isErevPesachGregorian(m.g);
          const isPesachI = isPesachIGregorian(m.g);
          const isErevSheviShelPesach = isErevSheviShelPesachGregorian(m.g);
          const isSheviShelPesach = isSheviShelPesachGregorian(m.g);
          const fastName = m.fastNameHe;
          const hasFast = Boolean(
            fastName &&
              !isTaanitEstherFastNameHe(fastName) &&
              !isErevPesach &&
              !isErevSheviShelPesach &&
              (m.fastBeginsJer || m.fastEndsJer || m.fastBeginsTA || m.fastEndsTA),
          );

          const reserveBottomForZmanim =
            ((isFriday ||
              isErevPesach ||
              isErevSheviShelPesach ||
              isRoshHashanaDay(m.titles) ||
              isYomKippurDay(m.titles)) &&
              !!(m.candleLightingJer || m.candleLightingTA)) ||
            (m.isShabbat &&
              !!(m.havdalahJer || m.havdalahTA || (settings.showParsha && m.parshaHe))) ||
            ((!m.isShabbat &&
              (isPesachI || isSheviShelPesach || isRoshHashanaDay(m.titles) || isYomKippurDay(m.titles)) &&
              !!(m.havdalahJer || m.havdalahTA))) ||
            (!isFriday && hasFast && m.inMonth);

          const gregPx = Math.max(1, Number(settings.gregDayFontPx) || 12) * cellFontScale;
          const hebPx = Math.max(1, Number(settings.hebDayFontPx) || 12) * cellFontScale;
          const editBtnFontPx = Math.max(5, Math.round(gregPx * 0.62));
          const topCornerPx = 8;
          const datesBandPx = Math.ceil(Math.max(gregPx, hebPx) * 1.32);
          const editBandPx = Math.ceil(editBtnFontPx * 1.35) + 2;
          const gapBelowTopDatesPx = 6;
          const datesEndPx =
            topCornerPx + Math.max(datesBandPx, editBandPx) + gapBelowTopDatesPx;
          const dstBumpPx = m.dstTransitionLabel ? 38 : 0;
          const centerPaddingTopPx = datesEndPx + dstBumpPx;

          return (
            <div
              key={m.gKey}
              className="relative min-h-24 min-w-0 overflow-hidden sm:min-h-28 p-2"
              data-inspect="cell"
              style={{
                minHeight: settings.layoutFillHeight ? 0 : undefined,
                height: settings.layoutFillHeight ? '100%' : undefined,
                background: bg,
                borderLeft: cellEdgeBorder,
                borderBottom: cellEdgeBorder,
                borderRadius: cellRadiusPx ? `${cellRadiusPx}px` : undefined,
                cursor: settings.enableManualEdits && m.inMonth ? 'pointer' : 'default',
              }}
            >
              {manual?.imageDataUrl ? (
                <>
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: `url(${manual.imageDataUrl})`,
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: manual.imageFit ?? 'cover',
                      backgroundPosition: `calc(50% + ${(Number(manual.imageOffsetX) || 0).toFixed(
                        1,
                      )}px) calc(50% + ${(Number(manual.imageOffsetY) || 0).toFixed(1)}px)`,
                      opacity:
                        typeof manual.imageOpacity === 'number' ? manual.imageOpacity : 1,
                      cursor: settings.enableManualEdits ? 'grab' : undefined,
                    }}
                    onPointerDown={(e) => startImageDrag(m.gKey, e)}
                    onPointerMove={moveImageDrag}
                    onPointerUp={endImageDrag}
                    onPointerCancel={endImageDrag}
                  />
                  <button
                    type="button"
                    className="absolute left-2 top-2 z-30 rounded border border-slate-200 bg-white/90 px-1 py-px text-xs leading-none text-slate-700 hover:bg-white"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setOverrides((prev) => {
                        const copy = { ...prev };
                        const storeKey = recurringOverrideKeyFromIsoDate(m.gKey);
                        const cur = resolveDayTextOverride(copy, m.gKey) ?? copy[storeKey];
                        if (!cur) return copy;
                        copy[storeKey] = { ...cur, imageDataUrl: undefined };
                        return copy;
                      });
                    }}
                    title="הסר תמונה"
                    aria-label="הסר תמונה"
                  >
                    ✕
                  </button>
                </>
              ) : null}
              {settings.enableManualEdits && settings.showEditButtonInCells && m.inMonth ? (
                <button
                  type="button"
                  className="absolute left-2 top-2 z-30 rounded border border-slate-200 bg-white/90 px-0.5 py-px leading-none text-slate-700 hover:bg-white"
                  style={{
                    fontSize: Math.max(5, Math.round(Number(settings.gregDayFontPx) * 0.62)),
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    const suggested = uniqAbbrevHebrewTitleLines(m.titles).join('\n');
                    openEditorForDay(m.gKey, suggested);
                  }}
                >
                  ערוך
                </button>
              ) : null}

              <div
                className={[
                  'absolute right-2 top-2 z-10 flex items-center gap-1 text-right',
                  dim,
                ].join(' ')}
              >
                <span
                  className="font-semibold text-slate-600"
                  style={{
                    fontSize: cellScaledPx(settings.gregDayFontPx),
                    lineHeight: 1,
                    fontFamily: shouldApplyFontTo('cellDates')
                      ? resolveFontFamilyFor('cellDates')
                      : undefined,
                  }}
                >
                  {m.gDay}
                  {m.gDay === 1 ? (
                    <span className="text-[0.75em] text-slate-500">/{m.gMonth}</span>
                  ) : null}
                </span>
                <span
                  className="font-medium text-slate-700"
                  style={{
                    fontSize: cellScaledPx(settings.hebDayFontPx),
                    lineHeight: 1,
                    fontFamily: shouldApplyFontTo('cellDates')
                      ? resolveFontFamilyFor('cellDates')
                      : undefined,
                  }}
                >
                  {m.hebDay}
                  {m.hebDay === 'א׳' && m.hebMonth ? (
                    <span className="mr-1 text-[0.75em] text-slate-500">
                      {m.hebMonth}
                    </span>
                  ) : null}
                </span>
              </div>

              {m.dstTransitionLabel ? (
                <div
                  className="pointer-events-none absolute left-1 right-1 z-[12] mx-auto max-w-[calc(100%-0.5rem)] rounded border border-amber-300/90 bg-amber-50/95 px-1 py-0.5 text-center leading-tight text-amber-950 shadow-sm"
                  style={{
                    top: datesEndPx + 2,
                    fontSize: Math.max(
                      1,
                      Math.round(Number(settings.eventTitleFontPx) * cellFontScale * 0.55),
                    ),
                  }}
                  title="לפי אזור הזמן Asia/Jerusalem (מסד IANA). זמני Hebcal: ירושלים (780 מ׳) ותל אביב (0 מ׳), לפי ההגדרות בפאנל «זמנים»."
                >
                  {m.dstTransitionLabel}
                </div>
              ) : null}

              {(() => {
                const manual = resolveDayTextOverride(overrides, m.gKey);
                const manualLines = manual?.centerLines;
                const manualHasVisibleCenter =
                  Array.isArray(manualLines) &&
                  manualLines.some((l) => String(l).trim().length > 0);
                const isEditingThisCell =
                  settings.enableManualEdits && editKey && editKey === m.gKey;

                const draftLines = isEditingThisCell
                  ? editDraft.split('\n').map((s) => s.trimEnd())
                  : null;

                const titlesForCenter = [...m.titles];
                const ensureFastName =
                  m.fastNameHe &&
                  (hasFast || isTaanitEstherFastNameHe(m.fastNameHe))
                    ? m.fastNameHe
                    : undefined;
                const autoLines = mergeTitlesWithFastNameIfMissing(
                  titlesForCenter,
                  ensureFastName,
                );

                const lines = isEditingThisCell
                  ? draftLines!.every((l) => !l.trim())
                    ? []
                    : draftLines!
                  : manual !== undefined
                    ? manualHasVisibleCenter
                      ? manualLines!
                      : []
                    : autoLines;

                const offX = isEditingThisCell ? editOffsetX : manual?.centerOffsetX ?? 0;
                const offY = isEditingThisCell ? editOffsetY : manual?.centerOffsetY ?? 0;
                const align = isEditingThisCell ? editAlign : manual?.centerAlign ?? 'center';
                const textAlign: 'right' | 'center' | 'left' =
                  hasFast && !isEditingThisCell ? 'center' : align;
                const displayLines =
                  !isEditingThisCell &&
                  hasFast &&
                  m.fastNameHe?.trim() &&
                  lines.length === 0
                    ? mergeTitlesWithFastNameIfMissing([], m.fastNameHe)
                    : lines;
                /** Auto fast: title lives in bottom stack so row height stays uniform (no tall cell). */
                const autoFastOnly =
                  hasFast &&
                  !isEditingThisCell &&
                  !manualHasVisibleCenter &&
                  displayLines.length > 0;
                if (autoFastOnly) return null;

                if (!displayLines.length) return null;

                const tightTitleBand =
                  hasFast && (manualHasVisibleCenter || isEditingThisCell);
                return (
                  <div
                    className={[
                      'absolute z-[8] flex w-full flex-col items-center px-8 text-slate-800 font-semibold',
                      tightTitleBand
                        ? 'left-2 right-2 justify-start text-center'
                        : 'inset-0 justify-center text-center',
                      !tightTitleBand && reserveBottomForZmanim ? 'pb-24 sm:pb-28' : '',
                      !tightTitleBand && !reserveBottomForZmanim ? 'pb-10' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={
                      tightTitleBand
                        ? {
                            top: centerPaddingTopPx,
                            bottom: '5.25rem',
                            fontSize: cellScaledPx(settings.eventTitleFontPx),
                            fontFamily: shouldApplyFontTo('cellEvents')
                              ? resolveFontFamilyFor('cellEvents')
                              : undefined,
                          }
                        : {
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            fontSize: cellScaledPx(settings.eventTitleFontPx),
                            paddingTop:
                              centerPaddingTopPx +
                              (hasFast
                                ? Math.round(
                                    Number(settings.eventTitleFontPx) * cellFontScale * 0.2,
                                  )
                                : 0),
                            fontFamily: shouldApplyFontTo('cellEvents')
                              ? resolveFontFamilyFor('cellEvents')
                              : undefined,
                          }
                    }
                  >
                    <div
                      className={[
                        'w-full max-w-full shrink-0 overflow-hidden break-words',
                        tightTitleBand || hasFast
                          ? 'max-h-24 sm:max-h-28'
                          : 'max-h-12 sm:max-h-14',
                      ].join(' ')}
                      style={{
                        transform: `translate(${offX}px, ${offY}px)`,
                        textAlign,
                      }}
                    >
                      {displayLines.map((ln, idx) => (
                        <div
                          key={idx}
                          className={[
                            idx === 0 ? 'text-slate-800' : 'text-slate-700',
                            'w-full',
                          ].join(' ')}
                        >
                          {ln === '' ? (
                            <span className="opacity-50">&nbsp;</span>
                          ) : (
                            abbreviateRoshChodeshHeTitle(ln)
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {(isFriday ||
                isErevPesach ||
                isErevSheviShelPesach ||
                isRoshHashanaDay(m.titles) ||
                isYomKippurDay(m.titles)) &&
              (m.candleLightingJer || m.candleLightingTA) ? (
                <div
                  className="absolute inset-x-2 bottom-2 z-20 min-w-0 max-w-full leading-snug text-slate-800 text-right space-y-0.5"
                  style={{
                    fontSize: cellScaledPx(settings.shabbatTimesFontPx),
                    fontFamily: shouldApplyFontTo('cellTimes')
                      ? resolveFontFamilyFor('cellTimes')
                      : undefined,
                  }}
                >
                  <div className="font-normal text-slate-900 whitespace-nowrap">
                    {m.isShabbat
                      ? 'יציאת השבת:'
                      : isYomKippurDay(m.titles) || isRoshHashanaDay(m.titles)
                        ? 'כניסה:'
                        : isErevPesach || isErevSheviShelPesach
                          ? 'כניסת החג:'
                          : 'כניסת השבת:'}
                  </div>
                  <HebcalZmanimLine jer={m.candleLightingJer} ta={m.candleLightingTA} />
                </div>
              ) : null}

              {m.isShabbat &&
              ((m.havdalahJer || m.havdalahTA) || (settings.showParsha && m.parshaHe)) ? (
                <div
                  className="absolute inset-x-2 bottom-2 z-20 min-w-0 max-w-full leading-snug text-slate-800 text-right"
                  style={{
                    fontSize: cellScaledPx(settings.shabbatTimesFontPx),
                    fontFamily: shouldApplyFontTo('cellTimes')
                      ? resolveFontFamilyFor('cellTimes')
                      : undefined,
                  }}
                >
                  {settings.showParsha && m.parshaHe ? (
                    <div className="line-clamp-2 break-words font-semibold text-slate-900 leading-tight">
                      {formatParshaDisplayHe(m.parshaHe)}
                    </div>
                  ) : null}
                  {(m.havdalahJer || m.havdalahTA) ? (
                    <div className="space-y-0.5">
                      <div className="font-normal text-slate-900 whitespace-nowrap">
                        {isPesachI || isSheviShelPesach ? 'יציאת החג:' : 'יציאת השבת:'}
                      </div>
                      <HebcalZmanimLine jer={m.havdalahJer} ta={m.havdalahTA} />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {(!m.isShabbat &&
                (isPesachI ||
                  isSheviShelPesach ||
                  isRoshHashanaDay(m.titles) ||
                  isYomKippurDay(m.titles)) &&
                (m.havdalahJer || m.havdalahTA)) ? (
                <div
                  className="absolute inset-x-2 bottom-2 z-20 min-w-0 max-w-full leading-snug text-slate-800 text-right space-y-0.5"
                  style={{
                    fontSize: cellScaledPx(settings.shabbatTimesFontPx),
                    fontFamily: shouldApplyFontTo('cellTimes')
                      ? resolveFontFamilyFor('cellTimes')
                      : undefined,
                  }}
                >
                  <div className="font-normal text-slate-900 whitespace-nowrap">
                    {isYomKippurDay(m.titles) || isRoshHashanaDay(m.titles)
                      ? 'יציאה:'
                      : 'יציאת החג:'}
                  </div>
                  <HebcalZmanimLine jer={m.havdalahJer} ta={m.havdalahTA} />
                </div>
              ) : null}

              {!isFriday && hasFast && m.inMonth
                ? (() => {
                    const mo = resolveDayTextOverride(overrides, m.gKey);
                    const ml = mo?.centerLines;
                    const mVis =
                      Array.isArray(ml) && ml.some((l) => String(l).trim().length > 0);
                    const editingHere =
                      settings.enableManualEdits && editKey === m.gKey;
                    const fn =
                      m.fastNameHe &&
                      (hasFast || isTaanitEstherFastNameHe(m.fastNameHe))
                        ? m.fastNameHe
                        : undefined;
                    const fastTitleLines = mergeTitlesWithFastNameIfMissing(
                      [...m.titles],
                      fn,
                    );
                    const showAutoFastTitles =
                      !editingHere &&
                      (mo === undefined ||
                        (!mVis && !isCenterContentSuppressedByOverride(mo)));

                    return (
                      <div
                        className="absolute inset-x-2 bottom-2 z-[6] min-w-0 max-w-full leading-snug text-slate-800 text-right space-y-0.5"
                        style={{
                          fontSize: cellScaledPx(settings.shabbatTimesFontPx),
                          fontFamily: shouldApplyFontTo('cellTimes')
                            ? resolveFontFamilyFor('cellTimes')
                            : undefined,
                        }}
                      >
                        {showAutoFastTitles ? (
                          <div
                            className="mb-1 space-y-0.5 text-center font-semibold leading-tight text-slate-900 break-words"
                            style={{
                              fontSize: Math.min(
                                Math.max(1, Number(settings.eventTitleFontPx) || 1),
                                Math.max(1, Number(settings.shabbatTimesFontPx) || 1) + 4,
                              ),
                            }}
                          >
                            {fastTitleLines.slice(0, 3).map((ln, idx) => (
                              <div
                                key={idx}
                                className={idx === 0 ? '' : 'font-semibold text-slate-800'}
                              >
                                {abbreviateRoshChodeshHeTitle(ln)}
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {(m.fastBeginsJer || m.fastBeginsTA) ? (
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-800">כניסה:</div>
                            <HebcalZmanimLine
                              variant="fast"
                              jer={m.fastBeginsJer}
                              ta={m.fastBeginsTA}
                            />
                          </div>
                        ) : null}
                        {(m.fastEndsJer || m.fastEndsTA) ? (
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-800">יציאה:</div>
                            <HebcalZmanimLine
                              variant="fast"
                              jer={m.fastEndsJer}
                              ta={m.fastEndsTA}
                            />
                          </div>
                        ) : null}
                      </div>
                    );
                  })()
                : null}
            </div>
          );
        })}
              </>
            }
          />
            </div>
          </div>
        </div>
        </div>
      </div>

      {settings.enableManualEdits && editKey ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="עריכת טקסט בתא"
          onClick={() => setEditKey(null)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl border border-slate-200 p-4 sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-slate-900 font-bold">עריכה ידנית</div>
                <div className="text-sm text-slate-500">
                  תאריך: {editKey}
                <div className="mt-1 text-xs text-slate-400">
                  העריכה נשמרת לפי יום וחודש בלוח הלועזי — חוזרת בכל השנים באותו תאריך. “מחק עריכה”
                  מבטל את ההסתרה/הטקסט ומחזיר את Hebcal; כדי להשאיר תא ריק בכל השנים שמור עם שדה
                  ריק (אל תשתמש ב“מחק עריכה”).
                </div>
                </div>
              </div>
              <button
                type="button"
                className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                onClick={() => setEditKey(null)}
              >
                סגור
              </button>
            </div>

            <div className="mt-3">
              {(() => {
                const existing = resolveDayTextOverride(overrides, editKey ?? '');
                const hasImg = Boolean(existing?.imageDataUrl);
                return (
                  <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-sm font-semibold text-slate-700 mb-2">תמונה בתא</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                        onClick={() => {
                          if (!editKey) return;
                          pickImageForCell(editKey);
                        }}
                      >
                        {hasImg ? 'החלף תמונה' : 'העלה תמונה'}
                      </button>
                      {hasImg ? (
                        <button
                          type="button"
                          className="px-3 py-2 text-sm rounded-md border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                          onClick={() => {
                            if (!editKey) return;
                            setOverrides((prev) => {
                              const copy = { ...prev };
                              const storeKey = recurringOverrideKeyFromIsoDate(editKey);
                              const cur = resolveDayTextOverride(copy, editKey) ?? copy[storeKey];
                              if (!cur) return copy;
                              copy[storeKey] = { ...cur, imageDataUrl: undefined };
                              return copy;
                            });
                          }}
                        >
                          הסר תמונה
                        </button>
                      ) : null}
                      <label className="text-sm text-slate-700 flex items-center gap-2">
                        התאמה
                        <select
                          className="rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
                          value={(existing?.imageFit ?? 'cover') as any}
                          onChange={(e) => {
                            if (!editKey) return;
                            const fit = e.target.value as 'cover' | 'contain';
                            setOverrides((prev) => {
                              const copy = { ...prev };
                              const storeKey = recurringOverrideKeyFromIsoDate(editKey);
                              const cur = resolveDayTextOverride(copy, editKey) ?? copy[storeKey];
                              if (!cur) return copy;
                              copy[storeKey] = { ...cur, imageFit: fit };
                              return copy;
                            });
                          }}
                        >
                          <option value="cover">מלא (crop)</option>
                          <option value="contain">התאם (ללא חיתוך)</option>
                        </select>
                      </label>
                      {hasImg ? (
                        <button
                          type="button"
                          className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                          onClick={() => {
                            if (!editKey) return;
                            setOverrides((prev) => {
                              const copy = { ...prev };
                              const storeKey = recurringOverrideKeyFromIsoDate(editKey);
                              const cur = resolveDayTextOverride(copy, editKey) ?? copy[storeKey];
                              if (!cur) return copy;
                              copy[storeKey] = { ...cur, imageOffsetX: 0, imageOffsetY: 0 };
                              return copy;
                            });
                          }}
                        >
                          אפס מיקום תמונה
                        </button>
                      ) : null}
                    </div>
                    {hasImg ? (
                      <div className="mt-3 rounded-lg overflow-hidden border border-slate-200 bg-white">
                        <img
                          src={existing!.imageDataUrl}
                          alt=""
                          className="w-full h-32"
                          style={{ objectFit: existing?.imageFit ?? 'cover' }}
                          draggable={false}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })()}
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                טקסט במרכז התא — שורה לכל אירוע (ברירת המחדל: כל החגים והאירועים של אותו יום)
              </label>
              <textarea
                dir="rtl"
                className="w-full min-h-40 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-200"
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
              />
              <div className="mt-2 text-xs text-slate-500">
                טיפ: “שמור” כשהשדה ריק שומר תא בלי טקסט מרכזי (מסתיר חגים אוטומטיים) בכל השנים
                באותו יום/חודש לועזי. כדי לחזור לטקסט האוטומטי לחץ “מחק עריכה”.
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="text-sm text-slate-700">
                הזזה ימינה/שמאלה ({editOffsetX}px)
                <input
                  className="mt-2 w-full"
                  type="range"
                  min={-80}
                  max={80}
                  value={editOffsetX}
                  onChange={(e) => setEditOffsetX(Number(e.target.value))}
                />
              </label>
              <label className="text-sm text-slate-700">
                הזזה למעלה/למטה ({editOffsetY}px)
                <input
                  className="mt-2 w-full"
                  type="range"
                  min={-80}
                  max={80}
                  value={editOffsetY}
                  onChange={(e) => setEditOffsetY(Number(e.target.value))}
                />
              </label>
              <label className="text-sm text-slate-700">
                יישור
                <select
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
                  value={editAlign}
                  onChange={(e) =>
                    setEditAlign(e.target.value as 'right' | 'center' | 'left')
                  }
                >
                  <option value="right">ימין</option>
                  <option value="center">מרכז</option>
                  <option value="left">שמאל</option>
                </select>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 justify-between">
              <button
                type="button"
                className="px-3 py-2 text-sm rounded-md border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                onClick={() => {
                  if (!editKey) return;
                  setOverrides((prev) => {
                    const copy = { ...prev };
                    const storeKey = recurringOverrideKeyFromIsoDate(editKey);
                    delete copy[storeKey];
                    if (/^\d{4}-\d{2}-\d{2}$/.test(editKey)) delete copy[editKey];
                    return copy;
                  });
                  setEditKey(null);
                }}
                disabled={!resolveDayTextOverride(overrides, editKey ?? '')}
              >
                מחק עריכה
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                  onClick={() => {
                    setEditOffsetX(0);
                    setEditOffsetY(0);
                    setEditAlign('center');
                  }}
                >
                  אפס מיקום
                </button>
                <button
                  type="button"
                  className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                  onClick={() => setEditKey(null)}
                >
                  ביטול
                </button>
                <button
                  type="button"
                  className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-slate-900 text-white hover:bg-slate-800"
                  onClick={() => {
                    if (!editKey) return;
                    const lines = editDraft.split('\n').map((s) => s.trimEnd());
                    const hasAnyText = lines.some((l) => l.trim().length > 0);
                    setOverrides((prev) => {
                      const copy = { ...prev };
                      const storeKey = recurringOverrideKeyFromIsoDate(editKey);
                      const existing = resolveDayTextOverride(copy, editKey) ?? copy[storeKey];
                      const hasImg =
                        typeof existing?.imageDataUrl === 'string' &&
                        existing.imageDataUrl.length > 0;
                      // Empty save restores Hebcal/auto titles (same as "מחק עריכה"). Recurring
                      // keys like `10-02` apply every year — saving empty used to suppress Sukkot
                      // end forever by mistake.
                      if (!hasAnyText && !hasImg) {
                        delete copy[storeKey];
                        if (/^\d{4}-\d{2}-\d{2}$/.test(editKey)) delete copy[editKey];
                        return copy;
                      }
                      copy[storeKey] = {
                        centerLines: hasAnyText ? lines : (existing?.centerLines ?? []),
                        centerOffsetX: editOffsetX,
                        centerOffsetY: editOffsetY,
                        centerAlign: editAlign,
                        imageDataUrl: existing?.imageDataUrl,
                        imageFit: existing?.imageFit,
                        imageOpacity: existing?.imageOpacity,
                      };
                      if (/^\d{4}-\d{2}-\d{2}$/.test(editKey)) delete copy[editKey];
                      return copy;
                    });
                    setEditKey(null);
                  }}
                >
                  שמור
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ThemePickerModal
        open={themePickerOpen}
        currentThemeId={settings.designThemeId}
        onClose={() => setThemePickerOpen(false)}
        onSelectTheme={(id) => setSettings((s) => applyDesignThemeId(s, id))}
      />
      <StylePackModal
        open={stylePackOpen}
        currentStylePackId={settings.stylePackId}
        onClose={() => setStylePackOpen(false)}
        onSelectTheme={(id) => setSettings((s) => applyStylePackId(s, id))}
      />
    </section>
  );
}

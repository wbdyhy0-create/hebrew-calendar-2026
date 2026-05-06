import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  addMonths,
  format,
  getDaysInMonth,
} from 'date-fns';
import { HDate, months } from '@hebcal/core';

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
} from '@hebrew-calendar/shared';
import { buildCalendarDayMetas } from '../utils/monthViewModel';
import {
  downloadPdfFromHtml,
  exportPdfBlobFromHtml,
  exportPdfBlobFromCalendarElement,
  exportYearPdfBlobFromCalendarCapture,
} from '../utils/pdf';
import {
  downloadHtmlFromPrintableHtml,
  exportPngBlobFromPrintableHtml,
  downloadPngFromPrintableHtml,
} from '../utils/exportDownloads';
import {
  downloadBlobViaPopup,
  isEmbeddedFrame,
  openDownloadPopup,
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
  HEADER_BOX4_CENTER_OFFSET_X_PX,
  loadSettings,
  saveSettings,
  type CalendarSettings,
  type HeaderLayoutStyle,
  CalendarMonthChrome,
  CalendarContainer,
  DISPLAY_CALENDAR_SCREEN_MIN_WIDTH_VW,
  DISPLAY_CALENDAR_SCREEN_MAX_WIDTH_PX,
} from '@hebrew-calendar/shared';
import { HAVDALAH_MINS_AFTER_SUNSET } from '../utils/zmanimConstants';
import {
  isCenterContentSuppressedByOverride,
  loadOverrides,
  GLOBAL_CELL_IMAGE_KEY,
  monthPaddingImageKeyFromYearMonth,
  recurringOverrideKeyFromIsoDate,
  resolveDayTextOverride,
  saveOverrides,
  type OverridesMap,
} from '../utils/overrides';
import { mixHexWithWhite } from '../utils/color';
import { getWeekdayHeaderLabels } from '../utils/weekdayHeaders';
import { formatGregorianMonthYearHebrew } from '../utils/gregorianHebrew';
import { getBackgroundImageForMonth } from '../utils/backgroundImage';
import { cssCellEdgeBorder } from '../utils/cellBorderCss';
import {
  CALENDAR_THEME_CATALOG,
  STYLE_PACK_IDS,
  applyDesignThemeId,
  applyStylePackId,
  getThemeEntry,
} from '../themes/calendarThemes';
import { ThemePickerModal } from './ThemePickerModal';
import { StylePackModal } from './StylePackModal';
import { createPresetId, loadStylePresets, saveStylePresets, type StylePreset } from '../utils/stylePresets';
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

type TransferFont = {
  id: string;
  family: string;
  fileName: string;
  weight?: string;
  style?: string;
  mime: string;
  dataBase64: string;
  createdAt: number;
};

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

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
  const [stylePresets, setStylePresets] = useState<StylePreset[]>(() =>
    typeof window === 'undefined' ? [] : loadStylePresets(),
  );
  const [stylePresetSelectedId, setStylePresetSelectedId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const items = loadStylePresets();
    return items[0]?.id ?? null;
  });
  const [stylePresetUndo, setStylePresetUndo] = useState<CalendarSettings | null>(null);
  const [stylePresetName, setStylePresetName] = useState<string>('');
  type TenantEntry = { id: string; name: string };
  const sanitizeTenantIdForUi = (raw: unknown): string => {
    const s = String(raw ?? '').trim().toLowerCase();
    if (!s) return 'default';
    const cleaned = s
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-_]+|[-_]+$/g, '');
    return cleaned.slice(0, 64) || 'default';
  };
  const [tenants, setTenants] = useState<TenantEntry[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem('hebrew-gregorian-calendar:studio:tenants:v1');
      const parsed = raw ? (JSON.parse(raw) as any) : null;
      if (!Array.isArray(parsed)) return [];
      const out: TenantEntry[] = [];
      for (const it of parsed) {
        const id = sanitizeTenantIdForUi(typeof it?.id === 'string' ? it.id : '');
        const name = typeof it?.name === 'string' ? it.name.trim() : '';
        if (!id || !name) continue;
        out.push({ id, name });
      }
      return out;
    } catch {
      return [];
    }
  });
  const [activeTenantId, setActiveTenantId] = useState<string>(() => {
    if (typeof window === 'undefined') return 'default';
    try {
      return (
        sanitizeTenantIdForUi(
          window.localStorage.getItem('hebrew-gregorian-calendar:studio:active-tenant:v1') ?? '',
        ) || 'default'
      );
    } catch {
      return 'default';
    }
  });
  const [tenantEditorOpen, setTenantEditorOpen] = useState(false);
  const [tenantDraftId, setTenantDraftId] = useState('');
  const [tenantDraftName, setTenantDraftName] = useState('');
  const isCalendar2026Host = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const host = (window.location.hostname || '').toLowerCase();
    return host === 'hebrew-calendar-2026.vercel.app' || host.endsWith('.hebrew-calendar-2026.vercel.app');
  }, []);
  const [publishIncludeUserPresets, setPublishIncludeUserPresets] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const raw = window.localStorage.getItem(
        'hebrew-gregorian-calendar:studio:publish-include-user-presets:v1',
      );
      if (raw === '0') return false;
      if (raw === '1') return true;
    } catch {
      // ignore
    }
    return true;
  });
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
  const pendingImageGlobalRef = useRef<boolean>(true);
  const pendingImageStoreKeyRef = useRef<string | null>(null);
  const imgDragRef = useRef<{
    key: string;
    startX: number;
    startY: number;
    startOffX: number;
    startOffY: number;
    moved: boolean;
  } | null>(null);
  const [saveFlash, setSaveFlash] = useState<string | null>(null);
  const [applyCellImageGlobally, setApplyCellImageGlobally] = useState<boolean>(true);
  const [paddingImageScopeOpen, setPaddingImageScopeOpen] = useState(false);
  const [paddingImageDayKey, setPaddingImageDayKey] = useState<string | null>(null);
  const [exportStyleOpen, setExportStyleOpen] = useState(false);
  const [exportStyleJson, setExportStyleJson] = useState('');
  const [exportStyleCopied, setExportStyleCopied] = useState<string | null>(null);
  const [importStyleOpen, setImportStyleOpen] = useState(false);
  const [importStyleJson, setImportStyleJson] = useState('');
  const [headerQuickOpen, setHeaderQuickOpen] = useState(false);
  const headerQuickRef = useRef<HTMLDivElement | null>(null);
  const printInProgressRef = useRef(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [uploadedFonts, setUploadedFonts] = useState<Omit<StoredFont, 'data'>[]>([]);
  const [fontBusy, setFontBusy] = useState<string | null>(null);
  const fontPickerRef = useRef<HTMLInputElement | null>(null);
  const [fontDragActive, setFontDragActive] = useState(false);

  const exportTransferFonts = async (): Promise<TransferFont[]> => {
    try {
      const list = await listStoredFonts();
      const out: TransferFont[] = [];
      for (const meta of list) {
        const full = await getStoredFont(meta.id);
        if (!full?.data) continue;
        out.push({
          id: full.id,
          family: full.family,
          fileName: full.fileName,
          weight: full.weight,
          style: full.style,
          mime: full.mime,
          dataBase64: arrayBufferToBase64(full.data),
          createdAt: full.createdAt,
        });
      }
      return out;
    } catch {
      return [];
    }
  };

  function base64ToArrayBuffer(b64: string): ArrayBuffer {
    const bin = atob(String(b64 || ''));
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  const importTransferFonts = async (fonts: unknown) => {
    if (!Array.isArray(fonts)) return;
    for (const f of fonts as any[]) {
      try {
        const id = typeof f?.id === 'string' && f.id.trim() ? String(f.id) : null;
        const family = typeof f?.family === 'string' && f.family.trim() ? String(f.family) : null;
        const fileName = typeof f?.fileName === 'string' ? String(f.fileName) : 'imported-font';
        const mime = typeof f?.mime === 'string' && f.mime.trim() ? String(f.mime) : 'font/ttf';
        const dataBase64 = typeof f?.dataBase64 === 'string' ? String(f.dataBase64) : '';
        if (!id || !family || !dataBase64) continue;
        const rec: StoredFont = {
          id,
          family,
          fileName,
          weight: typeof f?.weight === 'string' ? String(f.weight) : '400',
          style: typeof f?.style === 'string' ? String(f.style) : 'normal',
          mime,
          data: base64ToArrayBuffer(dataBase64),
          createdAt: typeof f?.createdAt === 'number' ? f.createdAt : Date.now(),
        };
        await putStoredFont(rec);
        await registerStoredFont(rec);
        setUploadedFonts((prev) => {
          if (prev.some((x) => x.id === rec.id)) return prev;
          return [
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
          ];
        });
      } catch {
        // ignore bad font entries
      }
    }
  };

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
      // In some environments (desktop/webview) we may be embedded but downloads can still work.
      // Do not hard-block the action; just warn the user if the browser ends up blocking.
      setSaveFlash('שימו לב: האפליקציה רצה בהטמעה — אם ההורדה נחסמת, נסו לפתוח בטאב חדש');
      window.setTimeout(() => setSaveFlash(null), 3500);
      return true;
    }
    return true;
  };

  const pdfDebugEnabled = (() => {
    try {
      return window.localStorage.getItem('debugPdf') === '1';
    } catch {
      return false;
    }
  })();

  const pdfDebug = (...args: unknown[]) => {
    if (!pdfDebugEnabled) return;
    // eslint-disable-next-line no-console
    console.log('[pdf]', ...args);
  };

  const printMonth = async () => {
    if (printInProgressRef.current) return;
    printInProgressRef.current = true;
    try {
      const html = buildPrintableMonthHtml(viewDate, settingsForExport, overrides, { location: 'Jerusalem' });
      const w = window.open('', '_blank', 'noopener,noreferrer');
      if (!w) throw new Error('חלון ההדפסה נחסם. אפשר לאפשר popups או לפתוח בטאב חדש.');
      w.document.open();
      w.document.write(html);
      w.document.close();
      // Give the browser a moment to load fonts/images before print.
      w.focus();
      window.setTimeout(() => {
        try {
          w.print();
        } catch {
          // ignore
        }
      }, 350);
    } finally {
      printInProgressRef.current = false;
    }
  };

  const exportMonthPdf = async () => {
    const element = calendarContentRef.current;
    if (!element) return;
    setSaveFlash('מכין PDF…');
    setIsExporting(true);

    const canvasEl = document.querySelector('[data-inspect="background"]') as HTMLElement | null;
    const captureTarget = canvasEl ?? element;

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);

      const canvas = await html2canvas(captureTarget, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#fff',
        logging: false,
        width: 1123,
        height: 794,
        windowWidth: 1123,
        windowHeight: 794,
        onclone: (clonedDoc) => {
          const clonedCanvas = clonedDoc.querySelector('[data-inspect="background"]') as HTMLElement | null;
          const clonedParent = clonedCanvas?.parentElement as HTMLElement | null;

          // Expand to exact A4 landscape pixel canvas (96dpi) just for capture.
          if (clonedCanvas) {
            clonedCanvas.style.width = '1123px';
            clonedCanvas.style.minWidth = '1123px';
            clonedCanvas.style.height = '794px';

            // Ensure header/top content isn't clipped by scroll in the cloned capture.
            clonedCanvas.scrollTop = 0;
            clonedCanvas.scrollLeft = 0;
            clonedCanvas.style.overflow = 'visible';
          }
          if (clonedParent) {
            clonedParent.style.width = '1200px';
            clonedParent.style.maxWidth = '1200px';
          }

          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            .break-words { overflow: visible !important; max-height: none !important; }
            /* PDF capture hardening: html2canvas can render blur/filters and transforms differently. */
            [data-inspect="month-grid"] { backdrop-filter: none !important; filter: none !important; }
            [data-inspect="header"] { filter: none !important; opacity: 1 !important; }
            [data-inspect="header"] * { opacity: 1 !important; filter: none !important; }
            /* Avoid weekday header row disappearing when using row offset sliders. */
            [data-inspect="weekdays"] { transform: none !important; }
          `;
          clonedDoc.head.appendChild(style);
        },
      });

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, 297, 210);
      pdf.save(`calendar-${format(viewDate, 'yyyy-MM')}.pdf`);
      setSaveFlash('הורד!');
      setTimeout(() => setSaveFlash(null), 1400);
    } finally {
      setIsExporting(false);
    }
  };

  const [isExporting, setIsExporting] = useState(false);
  const [yearPdfDialogOpen, setYearPdfDialogOpen] = useState(false);
  const [yearPdfDialogMode, setYearPdfDialogMode] = useState<'preview' | 'download'>('preview');
  const [yearPdfDialogCalendarMode, setYearPdfDialogCalendarMode] = useState<'gregorian' | 'hebrew'>('gregorian');
  const [yearPdfDialogYear, setYearPdfDialogYear] = useState<number>(viewDate.getFullYear());
  const [yearPdfDialogFromMonth, setYearPdfDialogFromMonth] = useState<number>(0);
  const [yearPdfDialogToMonth, setYearPdfDialogToMonth] = useState<number>(11);
  const [yearPdfHebrewYear, setYearPdfHebrewYear] = useState<number>(() => new HDate(new Date()).getFullYear());
  const [yearPdfHebrewToYear, setYearPdfHebrewToYear] = useState<number>(() => new HDate(new Date()).getFullYear());
  const [yearPdfHebrewFromMonth, setYearPdfHebrewFromMonth] = useState<number>(months.TISHREI);
  const [yearPdfHebrewToMonth, setYearPdfHebrewToMonth] = useState<number>(months.ELUL);

  const gregorianMonthLabelsHe = [
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
  ] as const;
  const hebrewMonthLabelsByNum: Record<number, string> = {
    [months.TISHREI]: 'תשרי',
    [months.CHESHVAN]: 'חשוון',
    [months.KISLEV]: 'כסלו',
    [months.TEVET]: 'טבת',
    [months.SHVAT]: 'שבט',
    [months.ADAR_I]: 'אדר א׳',
    [months.ADAR_II]: 'אדר',
    [months.NISAN]: 'ניסן',
    [months.IYYAR]: 'אייר',
    [months.SIVAN]: 'סיוון',
    [months.TAMUZ]: 'תמוז',
    [months.AV]: 'אב',
    [months.ELUL]: 'אלול',
  };
  const hebrewMonthLabel = (monthNum: number) => hebrewMonthLabelsByNum[monthNum] ?? `חודש ${monthNum}`;

  const openYearPdfRangeDialog = (mode: 'preview' | 'download') => {
    setYearPdfDialogMode(mode);
    setYearPdfDialogCalendarMode('gregorian');
    setYearPdfDialogYear(viewDate.getFullYear());
    setYearPdfDialogFromMonth(0);
    setYearPdfDialogToMonth(11);
    const hy = new HDate(viewDate).getFullYear();
    setYearPdfHebrewYear(hy);
    setYearPdfHebrewToYear(hy);
    setYearPdfHebrewFromMonth(months.TISHREI);
    setYearPdfHebrewToMonth(months.ELUL);
    setYearPdfDialogOpen(true);
  };

  const runYearPdfExportFromDialog = async () => {
    let monthIndices: number[] | null = null;
    let monthTargets: Array<{ year: number; month: number }> | null = null;
    let monthRangeLabel = '';
    let suggested = '';

    if (yearPdfDialogCalendarMode === 'gregorian') {
      if (yearPdfDialogFromMonth > yearPdfDialogToMonth) {
        setSaveFlash('חודש התחלה חייב להיות לפני חודש סיום');
        window.setTimeout(() => setSaveFlash(null), 2500);
        return;
      }
      monthIndices = Array.from(
        { length: yearPdfDialogToMonth - yearPdfDialogFromMonth + 1 },
        (_, i) => yearPdfDialogFromMonth + i,
      );
      monthRangeLabel = `${gregorianMonthLabelsHe[yearPdfDialogFromMonth]} - ${gregorianMonthLabelsHe[yearPdfDialogToMonth]}`;
      suggested =
        yearPdfDialogFromMonth === 0 && yearPdfDialogToMonth === 11
          ? `calendar-${yearPdfDialogYear}.pdf`
          : `calendar-${yearPdfDialogYear}-${String(yearPdfDialogFromMonth + 1).padStart(2, '0')}-${String(
              yearPdfDialogToMonth + 1,
            ).padStart(2, '0')}.pdf`;
    } else {
      const orderForYear = (hy: number) => {
        const monthsInHebYear = HDate.monthsInYear(hy);
        return [
          ...Array.from({ length: monthsInHebYear - months.TISHREI + 1 }, (_, i) => months.TISHREI + i),
          ...Array.from({ length: months.ELUL }, (_, i) => i + 1),
        ];
      };
      if (yearPdfHebrewToYear < yearPdfHebrewYear) {
        setSaveFlash('שנת הסיום העברית חייבת להיות שווה או אחרי שנת ההתחלה');
        window.setTimeout(() => setSaveFlash(null), 2500);
        return;
      }
      const startOrder = orderForYear(yearPdfHebrewYear);
      const endOrder = orderForYear(yearPdfHebrewToYear);
      const startIdx = startOrder.indexOf(yearPdfHebrewFromMonth);
      const endIdx = endOrder.indexOf(yearPdfHebrewToMonth);
      if (startIdx < 0 || endIdx < 0) {
        setSaveFlash('טווח חודשים עברי לא תקין');
        window.setTimeout(() => setSaveFlash(null), 2500);
        return;
      }
      if (yearPdfHebrewYear === yearPdfHebrewToYear && startIdx > endIdx) {
        setSaveFlash('בטווח באותה שנה: חודש התחלה חייב להיות לפני חודש הסיום');
        window.setTimeout(() => setSaveFlash(null), 2500);
        return;
      }
      const hebTargets: Array<{ hy: number; hm: number }> = [];
      for (let hy = yearPdfHebrewYear; hy <= yearPdfHebrewToYear; hy++) {
        const ord = orderForYear(hy);
        const from = hy === yearPdfHebrewYear ? startIdx : 0;
        const to = hy === yearPdfHebrewToYear ? endIdx : ord.length - 1;
        for (let i = from; i <= to; i++) {
          const hm = ord[i]!;
          hebTargets.push({ hy, hm });
        }
      }
      monthTargets = hebTargets.map(({ hy, hm }) => {
        const g = new HDate(1, hm, hy).greg();
        return { year: g.getFullYear(), month: g.getMonth() };
      });

      const hmName = (hm: number) => hebrewMonthLabel(hm);
      const y1 = new HDate(1, months.TISHREI, yearPdfHebrewYear).renderGematriya(true, false).split(' ').at(-1) ?? String(yearPdfHebrewYear);
      const y2 = new HDate(1, months.TISHREI, yearPdfHebrewToYear).renderGematriya(true, false).split(' ').at(-1) ?? String(yearPdfHebrewToYear);
      monthRangeLabel = `${hmName(yearPdfHebrewFromMonth)} ${y1} - ${hmName(yearPdfHebrewToMonth)} ${y2}`;
      suggested = `calendar-he-${yearPdfHebrewYear}-${String(yearPdfHebrewFromMonth).padStart(2, '0')}-${yearPdfHebrewToYear}-${String(
        yearPdfHebrewToMonth,
      ).padStart(2, '0')}.pdf`;
    }

    setYearPdfDialogOpen(false);
    setSaveFlash('מכין PDF של שנה…');
    pdfDebug('year export (dialog): started', {
      mode: yearPdfDialogCalendarMode,
      year: yearPdfDialogCalendarMode === 'gregorian' ? yearPdfDialogYear : yearPdfHebrewYear,
      toYear: yearPdfDialogCalendarMode === 'gregorian' ? yearPdfDialogYear : yearPdfHebrewToYear,
      from: yearPdfDialogCalendarMode === 'gregorian' ? yearPdfDialogFromMonth : yearPdfHebrewFromMonth,
      to: yearPdfDialogCalendarMode === 'gregorian' ? yearPdfDialogToMonth : yearPdfHebrewToMonth,
      count: (monthTargets ?? monthIndices ?? []).length,
    });

    const prevViewDate = new Date(viewDate);
    try {
      const blob = await exportYearPdfBlobFromCalendarCapture({
        getElement: () => calendarContentRef.current,
        setMonth: (m, y) => setViewDate(new Date(y ?? yearPdfDialogYear, m, 1)),
        settings: settingsForExport,
        monthIndices: monthIndices ?? undefined,
        monthTargets: monthTargets ?? undefined,
      });
      setViewDate(prevViewDate);
      const handle = await requestSaveHandle(suggested, { mime: 'application/pdf', description: 'PDF', extensions: ['.pdf'] });
      if (handle) {
        await saveBlobToHandle(handle, blob);
        setSaveFlash('ה‑PDF נשמר');
      } else {
        const popup = openDownloadPopup();
        if (popup) downloadBlobViaPopup(popup, suggested, blob);
        setSaveFlash('ה‑PDF נשלח להורדה');
      }
      window.setTimeout(() => setSaveFlash(null), 2200);
    } catch (e) {
      setViewDate(prevViewDate);
      const msg = e instanceof Error ? e.message : 'שגיאה לא ידועה';
      setSaveFlash(`שגיאה בהורדת PDF: ${msg}`);
      window.setTimeout(() => setSaveFlash(null), 3500);
      // eslint-disable-next-line no-console
      console.error(e);
    }
  };

  const [bgMonthIdx, setBgMonthIdx] = useState<number>(() => new Date().getMonth());
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [stylePackOpen, setStylePackOpen] = useState(false);
  const [shortcutOpen, setShortcutOpen] = useState<string | null>(null);
  const [colorPaletteOpen, setColorPaletteOpen] = useState(false);
  const [colorPalettePos, setColorPalettePos] = useState<{ x: number; y: number }>(() => ({
    x: 24,
    y: 160,
  }));
  const paletteDragRef = useRef<null | {
    pointerId: number;
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
  }>(null);
  const [inspect, setInspect] = useState<{
    key: 'none' | 'header' | 'weekdays' | 'cell' | 'background';
    x: number;
    y: number;
  }>({ key: 'none', x: 0, y: 0 });

  const viewedGregorianMonthKey = format(viewDate, 'yyyy-MM');

  // If the settings panel opens, always close the quick-inspect popup so it can't get "stuck".
  useEffect(() => {
    if (!settingsOpen) return;
    setInspect((s) => (s.key === 'none' ? s : { ...s, key: 'none' }));
  }, [settingsOpen]);

  // Escape should close the quick-inspect popup (even when settings are open).
  useEffect(() => {
    if (inspect.key === 'none') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInspect((s) => ({ ...s, key: 'none' }));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [inspect.key]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    try {
      window.localStorage.setItem('hebrew-gregorian-calendar:studio:tenants:v1', JSON.stringify(tenants));
    } catch {
      // ignore
    }
  }, [tenants]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        'hebrew-gregorian-calendar:studio:active-tenant:v1',
        String(activeTenantId || 'default'),
      );
    } catch {
      // ignore
    }
  }, [activeTenantId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        'hebrew-gregorian-calendar:studio:publish-include-user-presets:v1',
        publishIncludeUserPresets ? '1' : '0',
      );
    } catch {
      // ignore
    }
  }, [publishIncludeUserPresets]);

  useEffect(() => {
    saveStylePresets(stylePresets);
  }, [stylePresets]);

  const mergeStyleOnlySettings = (current: CalendarSettings, preset: CalendarSettings) => {
    // Apply "look" from preset but keep sizing/typography stable.
    // Users expect styles to change colors/frames/backgrounds, not make everything tiny.
    const keepKeys: Array<keyof CalendarSettings> = [
      'fontSizePx',
      'gregDayFontPx',
      'hebDayFontPx',
      'eventTitleFontPx',
      'shabbatTimesFontPx',
      // Layout/scale that affects perceived font size on canvas
      'calendarLayoutScalePercent',
      'layoutAutoFitToCanvas',
      'layoutFillHeight',
      'layoutCenterVertically',
      'tableOffsetYPx',
      'canvasPaddingPx',
      'canvasPaddingTopPx',
    ];
    const out: any = { ...current, ...(preset as any) };
    for (const k of keepKeys) out[k] = (current as any)[k];
    return out as CalendarSettings;
  };

  /**
   * Ensure export uses the same visual theme as the on-screen calendar.
   *
   * Some tenants rely on selecting a Style Pack / Design Theme (via ids) and then tweaking a few
   * sliders. In certain flows, the selected catalog patch might not be fully materialized into the
   * persisted `settings` object. For exports, we “hydrate” patch values only when the current value
   * still equals the DEFAULT for that key, so we don't override manual edits.
   */
  const settingsForExport = useMemo(() => {
    const cur: any = settings as any;
    const out: any = { ...cur };

    const styleId = String(cur?.stylePackId ?? 'default');
    if (styleId && styleId !== 'default') {
      const entry = getThemeEntry(styleId);
      const patch = entry?.patch && typeof entry.patch === 'object' ? (entry.patch as any) : null;
      if (patch) {
        for (const [k, v] of Object.entries(patch)) {
          if (v === undefined) continue;
          if (out[k] === (DEFAULT_SETTINGS as any)[k]) out[k] = v;
        }
      }
    }

    const colorId = String(cur?.designThemeId ?? 'default');
    if (colorId && colorId !== 'default') {
      const entry = getThemeEntry(colorId);
      const patch = entry?.patch && typeof entry.patch === 'object' ? (entry.patch as any) : null;
      if (patch) {
        // Keep in sync with COLOR_THEME_KEYS in `calendarThemes.ts`.
        const colorKeys = [
          'calendarCanvasFill',
          'gridShellBg',
          'gridBorderColor',
          'gridWeekdayHeaderBg',
          'gridWeekdayHeaderTextColor',
          'gridWeekdayHeaderBorderBottomColor',
          'cellBorderColor',
          'eventBg',
          'shabbatBg',
          'todayBg',
          'canvasBorderColor',
          'backgroundOpacity',
          'gregDayTextColor',
          'hebDayTextColor',
          'eventTitleTextColor',
          'shabbatTimesTextColor',
        ] as const;
        for (const k of colorKeys) {
          const v = patch[k];
          if (v === undefined) continue;
          if (out[k] === (DEFAULT_SETTINGS as any)[k]) out[k] = v;
        }
      }
    }

    return out as CalendarSettings;
  }, [settings]);

  const applyStylePresetAll = (p: StylePreset) => {
    try {
      const next = p.settings;
      setStylePresetUndo(settings);
      setSettings(next);
      setSaveFlash(`הוחל סגנון (כולל פונטים): ${p.name}`);
      window.setTimeout(() => setSaveFlash(null), 1600);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'שגיאה לא ידועה';
      setSaveFlash(`שגיאה בהחלת סגנון: ${msg}`);
      window.setTimeout(() => setSaveFlash(null), 3500);
    }
  };

  const applyStylePreset = (p: StylePreset) => {
    try {
      const next = p.settings;
      setStylePresetUndo(settings);
      setSettings((cur) => mergeStyleOnlySettings(cur as any, next as any));
      setSaveFlash(`הוחל סגנון: ${p.name}`);
      window.setTimeout(() => setSaveFlash(null), 1600);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'שגיאה לא ידועה';
      setSaveFlash(`שגיאה בהחלת סגנון: ${msg}`);
      window.setTimeout(() => setSaveFlash(null), 3500);
    }
  };

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
    // When the settings panel is open, avoid capture-phase listeners that can interfere with
    // native controls (e.g. <input type="color">) and custom tools (eyedropper buttons).
    if (settingsOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      const el = e.target as Element | null;
      if (!el) return;

      // Never interfere with clicks inside the settings panel (e.g. color inputs, sliders).
      if (el.closest('[data-settings-panel]')) return;

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
  }, [settingsOpen]);

  /** Header quick controls menu: close on outside click or Escape. */
  useEffect(() => {
    if (!headerQuickOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = e.target as Element | null;
      if (!el) return;
      if (headerQuickRef.current && headerQuickRef.current.contains(el)) return;
      setHeaderQuickOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHeaderQuickOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [headerQuickOpen]);

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

  const openPaddingImageScopeDialog = (gKey: string) => {
    setPaddingImageDayKey(gKey);
    setPaddingImageScopeOpen(true);
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

  // A single deterministic padding cell per month used for the "logo" slot.
  const paddingLogoGKey = useMemo(() => {
    const firstPad = dayMetas.find((m) => !m.inMonth) ?? null;
    return firstPad?.gKey ?? null;
  }, [dayMetas]);

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
  const [, setAutoFitScale] = useState(1);
  // Studio should always render at 100% “true size” (no auto-fit / no layout zoom),
  // even if it means the user needs to scroll inside the canvas frame.
  const effectiveVisualScale = 1;
  const scaledPx = (px: number) => {
    const s =
      Number.isFinite(effectiveVisualScale) && effectiveVisualScale > 0
        ? effectiveVisualScale
        : 1;
    return px / s;
  };
  const cellFontScale = 1;
  const cellScaledPx = (px: number) => scaledPx(px);
  const fontSizeStyleAllowUnder10Px = (
    px: number,
    origin: 'top right' | 'bottom right' | 'center center' = 'center center',
  ) => {
    const n = Number(px) || 0;
    if (n >= 10) return { fontSize: n } as const;
    const scale = Math.max(0.05, n / 10);
    return {
      fontSize: 10,
      transform: `scale(${scale})`,
      transformOrigin: origin,
    } as const;
  };
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

  const cellEdgeBorder = useMemo(() => {
    // In "grid_integrated" mode we keep gaps transparent, but still allow the existing
    // "cell borders" sliders to control per-cell borders.
    return cssCellEdgeBorder(
      settings.showCellBorders,
      settings.cellBorderWidthPx,
      settings.cellBorderColor,
      settings.cellBorderStyle,
    );
  }, [settings.showCellBorders, settings.cellBorderWidthPx, settings.cellBorderColor, settings.cellBorderStyle]);
  const cellFullBorder = useMemo(() => {
    if (!settings.showCellBorders) return 'none';
    const w = Math.max(0, Math.round(Number(settings.cellBorderWidthPx) || 0));
    const c = settings.cellBorderColor || '#E2E8F0';
    const s = settings.cellBorderStyle === 'double' ? 'double' : 'solid';
    return `${w}px ${s} ${c}`;
  }, [settings.showCellBorders, settings.cellBorderWidthPx, settings.cellBorderColor, settings.cellBorderStyle]);
  const cellRadiusPx = Math.max(0, Math.round(Number(settings.cellCornerRadiusPx) || 0));

  const supportsEyeDropper =
    typeof (window as any).EyeDropper !== 'undefined' &&
    typeof (window as any).EyeDropper === 'function';

  const IMAGE_SAMPLER_KEY = 'hebrew-gregorian-calendar:studio:image-sampler:data-url:v1';
  const IMAGE_SAMPLER_POS_KEY = 'hebrew-gregorian-calendar:studio:image-sampler:pos:v1';
  const [imageSamplerOpen, setImageSamplerOpen] = useState(false);
  const [imageSamplerPos, setImageSamplerPos] = useState<{ x: number; y: number }>(() => {
    try {
      const raw = window.localStorage.getItem(IMAGE_SAMPLER_POS_KEY);
      if (!raw) return { x: 18, y: 140 };
      const parsed = JSON.parse(raw) as any;
      const x = Number(parsed?.x);
      const y = Number(parsed?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return { x: 18, y: 140 };
      return { x, y };
    } catch {
      return { x: 18, y: 140 };
    }
  });
  const [imageSamplerImage, setImageSamplerImage] = useState<string | null>(() => {
    try {
      const raw = window.localStorage.getItem(IMAGE_SAMPLER_KEY);
      return raw && raw.startsWith('data:image/') ? raw : null;
    } catch {
      return null;
    }
  });
  const imageSamplerPickerRef = useRef<HTMLInputElement | null>(null);
  const imageSamplerImgRef = useRef<HTMLImageElement | null>(null);
  const imageSamplerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageSamplerDragRef = useRef<null | {
    pointerId: number;
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
  }>(null);
  const [imageSamplerArmed, setImageSamplerArmed] = useState<null | { label: string; apply: (hex: string) => void }>(
    null,
  );
  const [imageSamplerLastHex, setImageSamplerLastHex] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(IMAGE_SAMPLER_POS_KEY, JSON.stringify(imageSamplerPos));
    } catch {
      // ignore
    }
  }, [imageSamplerPos]);

  const setImageSamplerImageSafe = (dataUrl: string | null) => {
    setImageSamplerImage(dataUrl);
    try {
      if (dataUrl) window.localStorage.setItem(IMAGE_SAMPLER_KEY, dataUrl);
      else window.localStorage.removeItem(IMAGE_SAMPLER_KEY);
    } catch {
      // ignore
    }
  };

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

  const rgbaToHex = (r: number, g: number, b: number): string => {
    const to2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
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

  const sampleHexAtPoint = (
    clientX: number,
    clientY: number,
  ): { hex: string | null; needsSystemPick: boolean } => {
    const stack = document.elementsFromPoint(clientX, clientY);
    const overlay = stack.find((el) => (el as HTMLElement)?.dataset?.liveEyedropper === '1');
    const el =
      stack.find((n) => n !== overlay && (n as HTMLElement).nodeType === 1) ??
      document.elementFromPoint(clientX, clientY);
    if (!el || !(el instanceof HTMLElement)) return { hex: null, needsSystemPick: false };

    // Prefer a visible background; fall back to text color.
    let cur: HTMLElement | null = el;
    for (let i = 0; i < 6 && cur; i++) {
      const cs = getComputedStyle(cur);
      const bg = cs.backgroundColor;
      const bgImg = cs.backgroundImage;
      if (bgImg && bgImg !== 'none') {
        return { hex: null, needsSystemPick: true };
      }
      if (bg && !isTransparent(bg)) {
        const hex = rgbToHex(bg);
        if (hex) return { hex, needsSystemPick: false };
      }
      cur = cur.parentElement;
    }
    const cs = getComputedStyle(el);
    const hex = rgbToHex(cs.color);
    return { hex, needsSystemPick: false };
  };

  const sampleHexFromImageAtClientPoint = (clientX: number, clientY: number): string | null => {
    try {
      const img = imageSamplerImgRef.current;
      const canvas = imageSamplerCanvasRef.current;
      if (!img || !canvas) return null;
      if (!img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0) return null;

      const rect = img.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;

      const sx = Math.max(0, Math.min(img.naturalWidth - 1, Math.round((x / rect.width) * img.naturalWidth)));
      const sy = Math.max(0, Math.min(img.naturalHeight - 1, Math.round((y / rect.height) * img.naturalHeight)));

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;
      const data = ctx.getImageData(sx, sy, 1, 1)?.data;
      if (!data || data.length < 3) return null;
      const [r, g, b, a] = [data[0] ?? 0, data[1] ?? 0, data[2] ?? 0, data[3] ?? 255];
      if (a === 0) return null;
      return rgbaToHex(r, g, b);
    } catch {
      return null;
    }
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
          {livePicker?.label === label ? '✕' : '🎯'}
        </button>
        {supportsEyeDropper ? (
          <button
            type="button"
            className="h-10 w-10 shrink-0 rounded-md border border-slate-200 bg-white hover:bg-slate-50"
            title="טפטפת מערכת"
            aria-label="טפטפת מערכת"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => pickColorFromScreen(onChange)}
          >
            ⛏️
          </button>
        ) : null}
        <button
          type="button"
          className={[
            'h-10 w-12 shrink-0 rounded-md border bg-white hover:bg-slate-50 text-[11px] font-bold',
            imageSamplerArmed?.label === label ? 'border-fuchsia-400 ring-2 ring-fuchsia-200 bg-fuchsia-50 text-fuchsia-900' : 'border-slate-200 text-slate-700',
          ].join(' ')}
          title="דגימה מתמונה (חלון צף)"
          aria-label="דגימה מתמונה (חלון צף)"
          aria-pressed={imageSamplerArmed?.label === label}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setImageSamplerArmed((prev) => {
              if (prev?.label === label) return null;
              return { label, apply: (hex) => onChange(hex) };
            });
            setImageSamplerOpen(true);
            setSaveFlash('דגימה מתמונה פעילה: העלה תמונה ואז קליק על התמונה יחיל את הצבע');
            window.setTimeout(() => setSaveFlash(null), 2200);
          }}
        >
          IMG
        </button>
      </div>
    </div>
  );

  const openAndJumpToSetting = (anchorId: string) => {
    setInspect((s) => ({ ...s, key: 'none' }));
    setSettingsOpen(true);
    // Wait a tick for the settings panel to mount before searching for anchors.
    window.setTimeout(() => jumpToSetting(anchorId), 0);
  };

  const jumpToSetting = (anchorId: string) => {
    setInspect((s) => ({ ...s, key: 'none' }));
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
        title: 'ייצוא',
        items: [{ label: 'הגדרות PDF/ייצוא', anchorId: 'settings-anchor-export' }],
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
      <section dir="rtl" className="relative w-full max-w-none mx-auto p-4 sm:p-6 bg-white">
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
      className="relative w-full max-w-none mx-auto p-4 sm:p-6 bg-white"
      style={{
        fontFamily: shouldApplyFontEverywhere ? settings.fontFamily : undefined,
        // Browsers can clamp very small font sizes to ~10px (minimum font size setting).
        // Allow previewing smaller UI by keeping a 10px base and visually scaling down.
        ...(Number(settings.fontSizePx) < 10
          ? {
              fontSize: 10,
              transform: `scale(${Math.max(0.05, Number(settings.fontSizePx) / 10)})`,
              transformOrigin: 'top right',
            }
          : { fontSize: settings.fontSizePx }),
        fontWeight: settings.fontWeight,
      }}
    >
      {livePicker ? (
        <div
          data-live-eyedropper="1"
          ref={livePickerOverlayRef}
          className="fixed inset-0 z-[120] cursor-crosshair bg-black/10"
          style={{ cursor: 'crosshair' }}
          onMouseMove={(e) => {
            const s = sampleHexAtPoint(e.clientX, e.clientY);
            if (s.needsSystemPick) return;
            const hex = s.hex;
            if (!hex) return;
            setLivePicker((p) => {
              if (!p || p.current === hex) return p;
              p.commit(hex); // live preview
              return { ...p, current: hex };
            });
          }}
          onPointerMove={(e) => {
            const s = sampleHexAtPoint(e.clientX, e.clientY);
            if (s.needsSystemPick) return;
            const hex = s.hex;
            if (!hex) return;
            setLivePicker((p) => {
              if (!p || p.current === hex) return p;
              p.commit(hex);
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
            const s = sampleHexAtPoint(e.clientX, e.clientY);
            if (s.needsSystemPick) {
              if (!supportsEyeDropper) {
                setSaveFlash('אי אפשר לדגום מתמונה בדפדפן הזה (אין EyeDropper).');
                window.setTimeout(() => setSaveFlash(null), 2200);
                return;
              }
              pickColorFromScreen((hex) => {
                livePicker.commit(hex);
                setLivePicker(null);
              });
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
            <div className="mt-1 text-[11px] text-slate-500">
              מעל תמונה/רקע — קליק יפתח טפטפת מערכת לדגימה מדויקת.
            </div>
          </div>
        </div>
      ) : null}

      {imageSamplerOpen ? (
        <div
          className="fixed z-[118] w-[420px] rounded-xl border border-slate-200 bg-white shadow-xl"
          style={{
            left: Math.max(8, Math.round(imageSamplerPos.x)),
            top: Math.max(8, Math.round(imageSamplerPos.y)),
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2 rounded-t-xl border-b border-slate-200 bg-slate-50 px-3 py-2 select-none">
            {/* Drag handle only — full-bar capture was swallowing ✕ clicks (pointer captured on parent). */}
            <div
              className="min-w-0 flex-1 cursor-move"
              onPointerDown={(e) => {
                e.stopPropagation();
                (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                imageSamplerDragRef.current = {
                  pointerId: e.pointerId,
                  startX: e.clientX,
                  startY: e.clientY,
                  startPosX: imageSamplerPos.x,
                  startPosY: imageSamplerPos.y,
                };
              }}
              onPointerMove={(e) => {
                const st = imageSamplerDragRef.current;
                if (!st || st.pointerId !== e.pointerId) return;
                const dx = e.clientX - st.startX;
                const dy = e.clientY - st.startY;
                setImageSamplerPos({ x: st.startPosX + dx, y: st.startPosY + dy });
              }}
              onPointerUp={(e) => {
                const st = imageSamplerDragRef.current;
                if (!st || st.pointerId !== e.pointerId) return;
                imageSamplerDragRef.current = null;
                try {
                  (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
                } catch {
                  // ignore
                }
              }}
              onPointerCancel={() => {
                imageSamplerDragRef.current = null;
              }}
            >
              <div className="text-sm font-semibold text-slate-900">
                תמונה לדגימת צבעים{imageSamplerArmed ? ` — יעד: ${imageSamplerArmed.label}` : ''}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                className="h-8 px-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-sm"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => imageSamplerPickerRef.current?.click()}
              >
                {imageSamplerImage ? 'החלף' : 'בחר'}
              </button>
              <button
                type="button"
                className="h-8 w-8 rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                aria-label="סגור חלון תמונה"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  setImageSamplerOpen(false);
                  setImageSamplerArmed(null);
                }}
              >
                ✕
              </button>
            </div>
          </div>

          <div className="px-3 py-2 text-[11px] text-slate-600 border-b border-slate-100">
            קליק על התמונה ידגום צבע. אם בחרת יעד (IMG ליד צבע), הצבע יחול מיד.
          </div>

          <input
            ref={imageSamplerPickerRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              (async () => {
                const compressed = await compressImageToDataUrl(file);
                if (compressed && compressed.startsWith('data:image/')) {
                  setImageSamplerImageSafe(compressed);
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => {
                  const v = typeof reader.result === 'string' ? reader.result : null;
                  if (v && v.startsWith('data:image/')) setImageSamplerImageSafe(v);
                };
                reader.readAsDataURL(file);
              })();
            }}
          />

          <div className="p-3">
            <div className="relative w-full rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
              {imageSamplerImage ? (
                <>
                  <img
                    ref={imageSamplerImgRef}
                    src={imageSamplerImage}
                    alt="תמונה לדגימת צבעים"
                    className="block w-full h-[240px] object-contain bg-white"
                    onLoad={() => {
                      try {
                        const img = imageSamplerImgRef.current;
                        const canvas = imageSamplerCanvasRef.current;
                        if (!img || !canvas) return;
                        canvas.width = img.naturalWidth || 1;
                        canvas.height = img.naturalHeight || 1;
                        const ctx = canvas.getContext('2d', { willReadFrequently: true });
                        if (!ctx) return;
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                      } catch {
                        // ignore
                      }
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const hex = sampleHexFromImageAtClientPoint(e.clientX, e.clientY);
                      if (!hex) return;
                      setImageSamplerLastHex(hex);
                      if (imageSamplerArmed) imageSamplerArmed.apply(hex);
                      try {
                        void navigator.clipboard?.writeText(hex);
                      } catch {
                        // ignore
                      }
                    }}
                  />
                  <canvas ref={imageSamplerCanvasRef} className="hidden" />
                </>
              ) : (
                <button
                  type="button"
                  className="w-full h-[240px] flex items-center justify-center text-sm text-slate-500 hover:bg-slate-100"
                  onClick={() => imageSamplerPickerRef.current?.click()}
                >
                  אין תמונה — לחץ כדי לבחור תמונה
                </button>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-600">דגימה אחרונה:</span>
                {imageSamplerLastHex ? (
                  <>
                    <span className="inline-block h-4 w-6 rounded border border-slate-300" style={{ background: imageSamplerLastHex }} />
                    <span className="font-mono text-slate-900">{imageSamplerLastHex}</span>
                  </>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="h-8 px-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-xs"
                  disabled={!imageSamplerImage}
                  onClick={() => setImageSamplerImageSafe(null)}
                >
                  מחק תמונה
                </button>
                <button
                  type="button"
                  className="h-8 px-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-xs"
                  onClick={() => setImageSamplerArmed(null)}
                  disabled={!imageSamplerArmed}
                  title="בטל יעד דגימה"
                >
                  בטל יעד
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {colorPaletteOpen ? (
        <div
          className="fixed z-[115] w-[380px] rounded-xl border border-slate-200 bg-white shadow-xl"
          style={{
            left: Math.max(8, Math.round(colorPalettePos.x)),
            top: Math.max(8, Math.round(colorPalettePos.y)),
          }}
        >
          <div className="flex items-center justify-between gap-2 rounded-t-xl border-b border-slate-200 bg-slate-50 px-3 py-2 select-none">
            <div
              className="min-w-0 flex-1 cursor-move"
              onPointerDown={(e) => {
                e.stopPropagation();
                (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                paletteDragRef.current = {
                  pointerId: e.pointerId,
                  startX: e.clientX,
                  startY: e.clientY,
                  startPosX: colorPalettePos.x,
                  startPosY: colorPalettePos.y,
                };
              }}
              onPointerMove={(e) => {
                const st = paletteDragRef.current;
                if (!st || st.pointerId !== e.pointerId) return;
                const dx = e.clientX - st.startX;
                const dy = e.clientY - st.startY;
                setColorPalettePos({ x: st.startPosX + dx, y: st.startPosY + dy });
              }}
              onPointerUp={(e) => {
                const st = paletteDragRef.current;
                if (!st || st.pointerId !== e.pointerId) return;
                paletteDragRef.current = null;
                try {
                  (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
                } catch {
                  // ignore
                }
              }}
              onPointerCancel={() => {
                paletteDragRef.current = null;
              }}
            >
              <div className="text-sm font-semibold text-slate-900">צבעים לדגימה ידנית</div>
            </div>
            <button
              type="button"
              className="h-8 w-8 shrink-0 rounded-md border border-slate-200 bg-white hover:bg-slate-50"
              aria-label="סגור פלטת צבעים"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setColorPaletteOpen(false);
              }}
            >
              ✕
            </button>
          </div>
          <div className="px-3 py-2 text-[11px] text-slate-600 border-b border-slate-100">
            טיפ: הפעל טפטפת 🎯 באחד הצבעים ואז רחף/הקלק על ריבועים כאן כדי לדגום.
          </div>
          <div className="max-h-[420px] overflow-auto p-3">
            {[
              {
                name: 'כחולים',
                colors: [
                  '#0B1220',
                  '#0F172A',
                  '#1E3A8A',
                  '#1D4ED8',
                  '#2563EB',
                  '#3B82F6',
                  '#60A5FA',
                  '#93C5FD',
                  '#BFDBFE',
                  '#DBEAFE',
                ],
              },
              {
                name: 'אדומים/ורודים',
                colors: [
                  '#450A0A',
                  '#7F1D1D',
                  '#B91C1C',
                  '#DC2626',
                  '#EF4444',
                  '#F87171',
                  '#FDA4AF',
                  '#FB7185',
                  '#BE123C',
                  '#FFE4E6',
                ],
              },
              {
                name: 'צהובים/כתומים',
                colors: [
                  '#451A03',
                  '#7C2D12',
                  '#C2410C',
                  '#EA580C',
                  '#F97316',
                  '#FB923C',
                  '#FDBA74',
                  '#FACC15',
                  '#FDE047',
                  '#FEF9C3',
                ],
              },
              {
                name: 'ירוקים/טורקיז',
                colors: [
                  '#052E16',
                  '#14532D',
                  '#166534',
                  '#16A34A',
                  '#22C55E',
                  '#4ADE80',
                  '#86EFAC',
                  '#0F766E',
                  '#14B8A6',
                  '#CCFBF1',
                ],
              },
              {
                name: 'אפור/שחור',
                colors: [
                  '#000000',
                  '#111827',
                  '#1F2937',
                  '#334155',
                  '#475569',
                  '#64748B',
                  '#94A3B8',
                  '#CBD5E1',
                  '#E2E8F0',
                  '#F8FAFC',
                ],
              },
              {
                name: 'סגולים',
                colors: [
                  '#2E1065',
                  '#4C1D95',
                  '#6D28D9',
                  '#7C3AED',
                  '#8B5CF6',
                  '#A78BFA',
                  '#C4B5FD',
                  '#DDD6FE',
                  '#F3E8FF',
                  '#FAF5FF',
                ],
              },
            ].map((group) => (
              <div key={group.name} className="mb-3 last:mb-0">
                <div className="mb-2 text-xs font-semibold text-slate-800">{group.name}</div>
                <div className="grid grid-cols-10 gap-2">
                  {group.colors.map((c) => (
                    <div
                      key={c}
                      title={c}
                      className="h-6 w-6 rounded border border-slate-200"
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
            ))}
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
                const storeKey =
                  pendingImageStoreKeyRef.current ||
                  (pendingImageGlobalRef.current
                    ? GLOBAL_CELL_IMAGE_KEY
                    : recurringOverrideKeyFromIsoDate(key));
                const existing = resolveDayTextOverride(copy, key) ?? copy[storeKey];
                copy[storeKey] = {
                  centerLines: Array.isArray(existing?.centerLines) ? existing!.centerLines : [],
                  centerOffsetX: existing?.centerOffsetX ?? 0,
                  centerOffsetY: existing?.centerOffsetY ?? 0,
                  centerAlign: existing?.centerAlign ?? 'center',
                  imageDataUrl: compressed,
                  imageDisabled: false,
                  imageFit: existing?.imageFit ?? 'contain',
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
                const storeKey =
                  pendingImageStoreKeyRef.current ||
                  (pendingImageGlobalRef.current
                    ? GLOBAL_CELL_IMAGE_KEY
                    : recurringOverrideKeyFromIsoDate(key));
                const existing = resolveDayTextOverride(copy, key) ?? copy[storeKey];
                copy[storeKey] = {
                  centerLines: Array.isArray(existing?.centerLines) ? existing!.centerLines : [],
                  centerOffsetX: existing?.centerOffsetX ?? 0,
                  centerOffsetY: existing?.centerOffsetY ?? 0,
                  centerAlign: existing?.centerAlign ?? 'center',
                  imageDataUrl: dataUrl,
                  imageDisabled: false,
                  imageFit: existing?.imageFit ?? 'contain',
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

      {paddingImageScopeOpen && paddingImageDayKey ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[120] grid place-items-center bg-black/40 p-4"
          onMouseDown={() => setPaddingImageScopeOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="text-base font-bold text-slate-900">תמונה לתאים האפורים</div>
            <div className="mt-1 text-sm text-slate-600">
              לבחור איך להחיל את התמונה (ואז לבחור קובץ).
            </div>
            <div className="mt-3 grid gap-2">
              <button
                type="button"
                className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-slate-900 text-white hover:bg-slate-800"
                onClick={() => {
                  pendingImageStoreKeyRef.current = GLOBAL_CELL_IMAGE_KEY;
                  pendingImageGlobalRef.current = true;
                  setPaddingImageScopeOpen(false);
                  setPendingImageKey(paddingImageDayKey);
                  pickImageForCell(paddingImageDayKey);
                }}
              >
                החל על התאים האפורים בכל החודשים (כל השנה)
              </button>
              <button
                type="button"
                className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                onClick={() => {
                  pendingImageStoreKeyRef.current = monthPaddingImageKeyFromYearMonth(viewDate);
                  pendingImageGlobalRef.current = false;
                  setPaddingImageScopeOpen(false);
                  setPendingImageKey(paddingImageDayKey);
                  pickImageForCell(paddingImageDayKey);
                }}
              >
                החל רק על החודש הזה (תאים אפורים בלבד)
              </button>
              <button
                type="button"
                className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                onClick={() => setPaddingImageScopeOpen(false)}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
          <div className="text-left sm:order-1">
            <p className="text-xs sm:text-sm text-slate-500">
              {gMonthDays} ימים בחודש (לועזי)
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400 select-text">
              build {typeof __APP_BUILD__ === 'string' ? __APP_BUILD__ : 'unknown'}
            </p>
          </div>
          <div dir="rtl" className="flex flex-wrap items-center gap-2 justify-center sm:justify-start sm:order-2">
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

            <div ref={headerQuickRef} className="relative inline-flex items-center">
              <button
                type="button"
                onClick={() => setHeaderQuickOpen((v) => !v)}
                className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 active:bg-slate-100/70 transition flex items-center gap-2"
                aria-haspopup="menu"
                aria-expanded={headerQuickOpen}
                title="כותרות — גודל/מתיחה"
              >
                <span aria-hidden="true">🅣</span>
                כותרת
              </button>
              {headerQuickOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-2 w-[300px] rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden z-50 p-3 grid gap-3"
                  dir="rtl"
                >
                  <div className="text-[11px] font-semibold text-slate-700">כותרות בפס העליון</div>

                  <label className="text-xs text-slate-700">
                    כותרת ראשית ({settings.headerBox1FontPx}px)
                    <input
                      className="mt-2 w-full"
                      type="range"
                      min={10}
                      max={80}
                      step={1}
                      value={settings.headerBox1FontPx}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, headerBox1FontPx: Number(e.target.value) }))
                      }
                    />
                  </label>

                  <label className="text-xs text-slate-700">
                    כותרת משנה ({settings.headerBox2FontPx}px)
                    <input
                      className="mt-2 w-full"
                      type="range"
                      min={10}
                      max={80}
                      step={1}
                      value={settings.headerBox2FontPx}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, headerBox2FontPx: Number(e.target.value) }))
                      }
                    />
                  </label>

                  <label className="text-xs text-slate-700">
                    כותרת עברית ({settings.headerBox3FontPx}px)
                    <input
                      className="mt-2 w-full"
                      type="range"
                      min={10}
                      max={80}
                      step={1}
                      value={settings.headerBox3FontPx}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, headerBox3FontPx: Number(e.target.value) }))
                      }
                    />
                  </label>

                  <label className="text-xs text-slate-700">
                    כותרת לועזית ({settings.headerBox4FontPx}px)
                    <input
                      className="mt-2 w-full"
                      type="range"
                      min={10}
                      max={80}
                      step={1}
                      value={settings.headerBox4FontPx}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, headerBox4FontPx: Number(e.target.value) }))
                      }
                    />
                  </label>

                  <div className="h-px bg-slate-100" />

                  <label className="text-xs text-slate-700">
                    מתיחת טקסט — אופקי ({Number((settings as any).headerTextScaleXPercent ?? 100)}%)
                    <input
                      className="mt-2 w-full"
                      type="range"
                      min={50}
                      max={200}
                      step={1}
                      value={Number((settings as any).headerTextScaleXPercent ?? 100)}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, headerTextScaleXPercent: Number(e.target.value) }))
                      }
                    />
                  </label>

                  <label className="text-xs text-slate-700">
                    מתיחת טקסט — אנכי ({Number((settings as any).headerTextScaleYPercent ?? 100)}%)
                    <input
                      className="mt-2 w-full"
                      type="range"
                      min={50}
                      max={200}
                      step={1}
                      value={Number((settings as any).headerTextScaleYPercent ?? 100)}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, headerTextScaleYPercent: Number(e.target.value) }))
                      }
                    />
                  </label>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="px-3 py-2 text-sm rounded-md border border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 active:bg-emerald-100/80 transition flex items-center gap-2"
            >
              <span aria-hidden="true">📘</span>
              מדריך תפעולי
            </button>

          </div>
        </div>

        <div
          dir="rtl"
          className="flex flex-wrap items-center gap-2 justify-center sm:justify-start"
        >
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

      {yearPdfDialogOpen ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-[min(520px,96vw)] rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-sm font-normal text-slate-900">
              בחירת טווח לייצוא שנה PDF
            </div>
            <div className="px-4 pt-3 flex items-center gap-2 text-xs">
              <button
                type="button"
                className={`px-2 py-1 rounded-md border ${
                  yearPdfDialogCalendarMode === 'gregorian'
                    ? 'border-sky-300 bg-sky-50 text-sky-900'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
                onClick={() => setYearPdfDialogCalendarMode('gregorian')}
              >
                לועזי
              </button>
              <button
                type="button"
                className={`px-2 py-1 rounded-md border ${
                  yearPdfDialogCalendarMode === 'hebrew'
                    ? 'border-sky-300 bg-sky-50 text-sky-900'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
                onClick={() => setYearPdfDialogCalendarMode('hebrew')}
              >
                עברי
              </button>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {yearPdfDialogCalendarMode === 'gregorian' ? (
                <>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-slate-600">שנה</span>
                    <input
                      type="number"
                      className="w-full px-3 py-2 rounded-md border border-slate-200"
                      value={yearPdfDialogYear}
                      onChange={(e) => setYearPdfDialogYear(Number(e.target.value) || new Date().getFullYear())}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-slate-600">מחודש</span>
                    <select
                      className="w-full px-3 py-2 rounded-md border border-slate-200 bg-white"
                      value={yearPdfDialogFromMonth}
                      onChange={(e) => setYearPdfDialogFromMonth(Number(e.target.value))}
                    >
                      {gregorianMonthLabelsHe.map((m, idx) => (
                        <option key={`from-${idx}`} value={idx}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-slate-600">עד חודש</span>
                    <select
                      className="w-full px-3 py-2 rounded-md border border-slate-200 bg-white"
                      value={yearPdfDialogToMonth}
                      onChange={(e) => setYearPdfDialogToMonth(Number(e.target.value))}
                    >
                      {gregorianMonthLabelsHe.map((m, idx) => (
                        <option key={`to-${idx}`} value={idx}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-slate-600">משנה עברית (מספר)</span>
                    <input
                      type="number"
                      className="w-full px-3 py-2 rounded-md border border-slate-200"
                      value={yearPdfHebrewYear}
                      onChange={(e) => setYearPdfHebrewYear(Number(e.target.value) || new HDate(new Date()).getFullYear())}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-slate-600">מחודש עברי</span>
                    <select
                      className="w-full px-3 py-2 rounded-md border border-slate-200 bg-white"
                      value={yearPdfHebrewFromMonth}
                      onChange={(e) => setYearPdfHebrewFromMonth(Number(e.target.value))}
                    >
                      {(() => {
                        const monthsInHebYear = HDate.monthsInYear(yearPdfHebrewYear);
                        const ordered = [
                          ...Array.from(
                            { length: monthsInHebYear - months.TISHREI + 1 },
                            (_, i) => months.TISHREI + i,
                          ),
                          ...Array.from({ length: months.ELUL }, (_, i) => i + 1),
                        ];
                        return ordered.map((hm) => (
                          <option key={`hfrom-${hm}`} value={hm}>
                            {hebrewMonthLabel(hm)}
                          </option>
                        ));
                      })()}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-slate-600">עד שנה עברית (מספר)</span>
                    <input
                      type="number"
                      className="w-full px-3 py-2 rounded-md border border-slate-200"
                      value={yearPdfHebrewToYear}
                      onChange={(e) => setYearPdfHebrewToYear(Number(e.target.value) || new HDate(new Date()).getFullYear())}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-slate-600">עד חודש עברי</span>
                    <select
                      className="w-full px-3 py-2 rounded-md border border-slate-200 bg-white"
                      value={yearPdfHebrewToMonth}
                      onChange={(e) => setYearPdfHebrewToMonth(Number(e.target.value))}
                    >
                      {(() => {
                        const monthsInHebYear = HDate.monthsInYear(yearPdfHebrewToYear);
                        const ordered = [
                          ...Array.from(
                            { length: monthsInHebYear - months.TISHREI + 1 },
                            (_, i) => months.TISHREI + i,
                          ),
                          ...Array.from({ length: months.ELUL }, (_, i) => i + 1),
                        ];
                        return ordered.map((hm) => (
                          <option key={`hto-${hm}`} value={hm}>
                            {hebrewMonthLabel(hm)}
                          </option>
                        ));
                      })()}
                    </select>
                  </label>
                </>
              )}
            </div>
            <div className="px-4 pb-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                onClick={() => setYearPdfDialogOpen(false)}
              >
                ביטול
              </button>
              <button
                type="button"
                className="px-3 py-2 text-sm rounded-md border border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100"
                onClick={async () => {
                  await runYearPdfExportFromDialog();
                }}
              >
                המשך
              </button>
            </div>
          </div>
        </div>
      ) : null}


      <div
        className="mx-auto w-full"
        style={{
          maxWidth: `min(calc(100vw - 48px), ${DISPLAY_CALENDAR_SCREEN_MAX_WIDTH_PX + 220}px)`,
        }}
      >
      {settingsOpen && (
        <div
          data-settings-panel="1"
          className="relative mb-4 flex max-h-[min(92vh,940px)] flex-col rounded-xl border border-slate-200 bg-white/95 shadow-sm sm:max-h-[min(88vh,900px)]"
          style={{
            maxWidth: `min(100%, ${DISPLAY_CALENDAR_SCREEN_MAX_WIDTH_PX + 160}px)`,
            ...(shouldApplyFontTo('settings')
              ? { fontFamily: resolveFontFamilyFor('settings') }
              : {}),
          }}
        >
          <div className="sticky top-0 z-20 shrink-0 border-b border-slate-200/90 bg-white/95 backdrop-blur-sm">
            <div className="flex flex-col items-end gap-2 px-3 py-2.5 sm:px-4">
              <div className="font-normal text-slate-900">עיצוב</div>
              <div className="flex flex-wrap items-center justify-end gap-2">
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
                  onClick={() => {
                    const ok = window.confirm(
                      'איפוס מקומי מלא לסטודיו בדפדפן זה?\n\nזה ימחק: הגדרות, עריכות/תמונות בתאים, פריסטים שמורים, טננטים שמורים והעדפות פרסום.\n\nהענן/העמדות לא יושפעו.',
                    );
                    if (!ok) return;
                    try {
                      // Shared settings
                      window.localStorage.removeItem('hebrew-gregorian-calendar:settings:v5');
                      // Studio overrides + presets
                      window.localStorage.removeItem('hebrew-gregorian-calendar:overrides:v2');
                      window.localStorage.removeItem('hebrew-gregorian-calendar:style-presets:v1');
                      // Studio tenant UI state
                      window.localStorage.removeItem('hebrew-gregorian-calendar:studio:tenants:v1');
                      window.localStorage.removeItem('hebrew-gregorian-calendar:studio:active-tenant:v1');
                      window.localStorage.removeItem(
                        'hebrew-gregorian-calendar:studio:publish-include-user-presets:v1',
                      );
                      // Best-effort: clear any other local keys this app uses (won't touch other sites).
                      try {
                        for (let i = window.localStorage.length - 1; i >= 0; i--) {
                          const k = window.localStorage.key(i);
                          if (k && k.startsWith('hebrew-gregorian-calendar:')) window.localStorage.removeItem(k);
                        }
                      } catch {
                        // ignore
                      }
                    } catch {
                      // ignore
                    }
                    window.location.reload();
                  }}
                  className="text-sm px-3 py-2 rounded-md border border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100"
                  title="מחיקת כל ההגדרות/פריסטים המקומיים בדפדפן זה"
                >
                  איפוס מקומי
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const fonts = await exportTransferFonts();
                    const json = JSON.stringify({ settings, overrides, fonts }, null, 2);
                    setExportStyleJson(json);
                    setExportStyleCopied(null);
                    setExportStyleOpen(true);
                    try {
                      await navigator.clipboard.writeText(json);
                      setExportStyleCopied('הועתק ללוח');
                      window.setTimeout(() => setExportStyleCopied(null), 1400);
                    } catch {
                      // ignore — user can copy manually from the modal
                    }
                  }}
                  className="text-sm px-3 py-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                  title="העתקת סגנון כ‑JSON לשיתוף עם התצוגה"
                >
                  ייצוא סגנון (JSON)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImportStyleJson('');
                    setImportStyleOpen(true);
                  }}
                  className="text-sm px-3 py-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                  title="ייבוא settings/overrides מג׳סון ששמרת"
                >
                  ייבוא סגנון (JSON)
                </button>
                {!isCalendar2026Host && (
                  <button
                    type="button"
                    onClick={async () => {
                    try {
                      const publishUrl = (() => {
                        const fromEnv = (import.meta as any).env?.VITE_PUBLISH_URL?.trim?.();
                        // Only honor absolute URLs. Relative paths would publish to the Studio domain,
                        // which does not update the Display KV/catalog.
                        if (fromEnv && /^https?:\/\//i.test(String(fromEnv))) return String(fromEnv);
                        // Default Studio publishes directly to Display so that theme catalog + config
                        // update the same KV that Display reads from.
                        return 'https://hebrew-calendar-suite-display.vercel.app/api/publish-config';
                      })();
                      const publishSecret =
                        (import.meta as any).env?.VITE_PUBLISH_SECRET?.trim?.() || '';
                      const fonts = await exportTransferFonts();
                      // overrides = עריכות ידניות/תמונות לפי תא בלבד; לא קשור לתיבת "פריסטים לקטלוג בענן".
                      // פרסום תקין גם כש־overrides ריק — settings + themeCatalog עדיין נשמרים.

                      const r = await fetch(publishUrl, {
                        method: 'POST',
                        headers: {
                          'content-type': 'application/json',
                          ...(publishSecret ? { 'x-publish-secret': publishSecret } : null),
                        },
                        body: JSON.stringify({
                          tenantId: activeTenantId || 'default',
                          settings,
                          overrides,
                          viewDate: viewDate.toISOString(),
                          fonts,
                          themeCatalog: [
                            ...CALENDAR_THEME_CATALOG.map((t) => ({
                              id: t.id,
                              kind: STYLE_PACK_IDS.has(t.id) ? 'style' : 'color',
                              nameHe: t.nameHe,
                              patch: t.patch,
                            })),
                            ...(publishIncludeUserPresets
                              ? stylePresets.map((p) => ({
                                  id: `user:${p.id}`,
                                  kind: 'style',
                                  nameHe: p.name,
                                  patch: p.settings,
                                }))
                              : []),
                          ],
                        }),
                      });
                      if (!r.ok) {
                        const t = await r.text();
                        window.alert(`Publish נכשל (${r.status}): ${t}`);
                        return;
                      }
                      let storage: string | undefined;
                      let stats: any = null;
                      let themeCatalogSaved: number | null = null;
                      let themeCatalogKey: string | null = null;
                      let themeCatalogUserItems: number | null = null;
                      try {
                        const parsed = (await r.json()) as any;
                        storage = typeof parsed?.storage === 'string' ? parsed.storage : undefined;
                        stats = parsed?.overridesStats ?? null;
                        themeCatalogSaved =
                          typeof parsed?.themeCatalogSaved === 'number' ? parsed.themeCatalogSaved : null;
                        themeCatalogKey =
                          typeof parsed?.themeCatalogKey === 'string' ? parsed.themeCatalogKey : null;
                        themeCatalogUserItems =
                          typeof parsed?.themeCatalogUserItems === 'number'
                            ? parsed.themeCatalogUserItems
                            : null;
                      } catch {
                        // ignore
                      }
                      if (storage === 'vite-shim') {
                        window.alert('Published locally (Vite shim)');
                        return;
                      }
                      if (stats && typeof stats === 'object') {
                        const userPresetFallback = publishIncludeUserPresets
                          ? (Array.isArray(stylePresets) ? stylePresets.length : 0)
                          : 0
                        const userInCatalog =
                          themeCatalogUserItems !== null ? themeCatalogUserItems : userPresetFallback
                        window.alert(
                          [
                            'פורסם ל־KV בהצלחה.',
                            '',
                            `עריכות ידניות / תמונות בתאים (overrides): ${stats.keys} רשומות, ${stats.withImages} עם תמונה.`,
                            'המספר הזה לא כולל פריסטים שמורים — אלה נשלחים בנפרד בקטלוג הערכות.',
                            themeCatalogSaved !== null
                              ? `קטלוג ערכות בענן: ${themeCatalogSaved} פריטים${userInCatalog ? ` (מתוכם ${userInCatalog} פריסטי משתמש)` : ''}.${themeCatalogKey ? `\nמפתח: ${themeCatalogKey}` : ''}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join('\n'),
                        );
                      } else {
                        window.alert('פורסם ל־KV');
                      }
                    } catch (e: any) {
                      window.alert(`Publish נכשל: ${String(e?.message ?? e)}`);
                    }
                    }}
                    className="text-sm px-3 py-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                    title="פרסום קונפיגורציה"
                  >
                    פרסום קונפיגורציה
                  </button>
                )}
                {!isCalendar2026Host && (
                  <>
                    <button
                  type="button"
                  onClick={async () => {
                    const ok = window.confirm(
                      'פרסום איפוס לטננט הנוכחי?\n\nזה ידרוס בענן: settings, overrides, וקטלוג הסגנונות (ימחק סגנונות משתמש).\n\nמומלץ רק אם רוצים להתחיל “סלאט” נקי בעמדות.',
                    );
                    if (!ok) return;
                    try {
                      const publishUrl = (() => {
                        const fromEnv = (import.meta as any).env?.VITE_PUBLISH_URL?.trim?.();
                        if (fromEnv && /^https?:\/\//i.test(String(fromEnv))) return String(fromEnv);
                        return 'https://hebrew-calendar-suite-display.vercel.app/api/publish-config';
                      })();
                      const publishSecret =
                        (import.meta as any).env?.VITE_PUBLISH_SECRET?.trim?.() || '';
                      const fonts: any[] = [];
                      const resetSettings: any = { ...DEFAULT_SETTINGS };
                      // Keep tenant-specific identity fields if present.
                      resetSettings.brandName = (settings as any).brandName ?? DEFAULT_SETTINGS.brandName;
                      resetSettings.departmentName =
                        (settings as any).departmentName ?? DEFAULT_SETTINGS.departmentName;
                      resetSettings.brandLogoDataUrl =
                        (settings as any).brandLogoDataUrl ?? DEFAULT_SETTINGS.brandLogoDataUrl;

                      const r = await fetch(publishUrl, {
                        method: 'POST',
                        headers: {
                          'content-type': 'application/json',
                          ...(publishSecret ? { 'x-publish-secret': publishSecret } : null),
                        },
                        body: JSON.stringify({
                          tenantId: activeTenantId || 'default',
                          settings: resetSettings,
                          overrides: {},
                          viewDate: viewDate.toISOString(),
                          fonts,
                          themeCatalog: [
                            ...CALENDAR_THEME_CATALOG.map((t) => ({
                              id: t.id,
                              kind: STYLE_PACK_IDS.has(t.id) ? 'style' : 'color',
                              nameHe: t.nameHe,
                              patch: t.patch,
                            })),
                          ],
                        }),
                      });
                      if (!r.ok) {
                        const t = await r.text();
                        window.alert(`איפוס Publish נכשל (${r.status}): ${t}`);
                        return;
                      }
                      window.alert('פורסם איפוס לטננט. כעת רענן את העמדות/דיספליי.');
                    } catch (e: any) {
                      window.alert(`איפוס Publish נכשל: ${String(e?.message ?? e)}`);
                    }
                  }}
                  className="text-sm px-3 py-2 rounded-md border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                  title="דריסת הענן לברירת מחדל לטננט זה"
                >
                  פרסום איפוס
                </button>
                    <button
                  type="button"
                  onClick={async () => {
                    const ok = window.confirm(
                      'למחוק מהענן את כל סגנונות המשתמש (כמו “משכן”, “יוסף 2” וכו׳) עבור הטננט הנוכחי?\n\nזה ישאיר רק את הסגנונות המובנים.',
                    );
                    if (!ok) return;
                    try {
                      const publishSecret =
                        (import.meta as any).env?.VITE_PUBLISH_SECRET?.trim?.() || '';
                      const namesToRemove = (stylePresets ?? [])
                        .map((p) => String(p?.name ?? '').trim())
                        .filter(Boolean);
                      const r = await fetch('/api/prune-theme-catalog', {
                        method: 'POST',
                        headers: {
                          'content-type': 'application/json',
                          ...(publishSecret ? { 'x-publish-secret': publishSecret } : null),
                        },
                        body: JSON.stringify({
                          tenantId: activeTenantId || 'default',
                          namesToRemove,
                        }),
                      });
                      if (!r.ok) {
                        const t = await r.text();
                        window.alert(`ניקוי סגנונות נכשל (${r.status}): ${t}`);
                        return;
                      }
                      const parsed = (await r.json()) as any;
                      const removed = typeof parsed?.removed === 'number' ? parsed.removed : null;
                      const remaining =
                        typeof parsed?.remaining === 'number' ? parsed.remaining : null;
                      window.alert(
                        removed !== null
                          ? `נמחקו ${removed} סגנונות מהענן.${remaining !== null ? ` נשארו ${remaining}.` : ''}`
                          : 'בוצע ניקוי סגנונות.',
                      );
                    } catch (e: any) {
                      window.alert(`ניקוי סגנונות נכשל: ${String(e?.message ?? e)}`);
                    }
                  }}
                  className="text-sm px-3 py-2 rounded-md border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                  title="מחיקת סגנונות משתמש מהענן (קטלוג)"
                >
                  מחק סגנונות משתמש מהענן
                </button>
                    <label className="flex items-center gap-2 text-sm text-slate-700 select-none">
                      <input
                        type="checkbox"
                        checked={publishIncludeUserPresets}
                        onChange={(e) => setPublishIncludeUserPresets(Boolean(e.target.checked))}
                      />
                      כלול סגנונות שמורים שלי (פריסטים) בקטלוג לענן
                    </label>
                  </>
                )}
                {!isCalendar2026Host && (
                  <>
                    <label className="flex items-center gap-2 text-sm text-slate-700 select-none">
                      <input
                        type="checkbox"
                        checked={(settings as any).showFinanceSidebar === true}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...(s as any),
                            showFinanceSidebar: Boolean(e.target.checked),
                          }))
                        }
                      />
                      Enable Finance News Sidebar (טננט פעיל בלבד)
                    </label>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-slate-700">
                        טננט פעיל
                        <select
                          className="ms-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
                          value={activeTenantId}
                          onChange={(e) =>
                            setActiveTenantId(sanitizeTenantIdForUi(String(e.target.value || 'default')))
                          }
                          title="הטננט שאליו Publish יישמר בענן"
                        >
                          <option value="default">default</option>
                          {tenants.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({t.id})
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() => setTenantEditorOpen(true)}
                        className="text-sm px-3 py-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                        title="ניהול רשימת טננטים"
                      >
                        ניהול טננטים
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSettings(DEFAULT_SETTINGS)}
                      className="text-sm px-3 py-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                    >
                      איפוס
                    </button>
                  </>
                )}
              </div>
            </div>
            <SettingsSearchBar onPick={jumpToSetting} />
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-y-contain px-2 py-2 sm:px-3 sm:py-3">
            <SettingsCategory icon="🏦" title="מיתוג">
              <div className="sm:col-span-2 lg:col-span-3 rounded-lg border border-slate-200 bg-white/80 p-3">
                <div className="text-sm font-medium text-slate-800">לוגו וצבע מותג</div>
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-sm text-slate-700">
                    שם ארגון
                    <input
                      className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
                      value={(settings as any).brandName ?? ''}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          brandName: e.target.value,
                        }))
                      }
                      placeholder="למשל: בנק הפועלים"
                    />
                  </label>
                  <label className="text-sm text-slate-700">
                    צבע מותג
                    <div className="mt-2 flex items-center gap-3">
                      <input
                        type="color"
                        value={(settings as any).brandAccentColor ?? '#E31B23'}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            brandAccentColor: e.target.value,
                          }))
                        }
                        className="h-10 w-12 rounded-md border border-slate-200 bg-white p-1"
                        aria-label="בחר צבע מותג"
                      />
                      <input
                        className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
                        value={(settings as any).brandAccentColor ?? '#E31B23'}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            brandAccentColor: e.target.value,
                          }))
                        }
                        placeholder="#E31B23"
                      />
                    </div>
                  </label>
                </div>

                <label className="mt-3 block text-sm text-slate-700">
                  לוגו (קובץ תמונה)
                  <input
                    className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (!f) return
                      const r = new FileReader()
                      r.onload = () => {
                        const dataUrl = typeof r.result === 'string' ? r.result : ''
                        setSettings((s) => ({ ...s, brandLogoDataUrl: dataUrl }))
                      }
                      r.readAsDataURL(f)
                    }}
                  />
                  {(settings as any).brandLogoDataUrl ? (
                    <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-2 py-2">
                      <img
                        src={(settings as any).brandLogoDataUrl}
                        alt="לוגו"
                        className="h-8 w-auto max-w-[160px] object-contain"
                      />
                      <button
                        type="button"
                        className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-900 hover:bg-rose-100"
                        onClick={() => setSettings((s) => ({ ...s, brandLogoDataUrl: '' }))}
                      >
                        הסר לוגו
                      </button>
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-slate-500">הלוגו יופיע מעל הלוח בתצוגה ובאדמין.</div>
                  )}
                </label>
              </div>
            </SettingsCategory>

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
                <option value="grid_integrated">דוגמת דפוס — כותרת בתוך הרשת + רווח בין משבצות</option>
              </select>
              <div className="mt-1 text-xs text-slate-500">
                מבנה נקבע ב״ערכת סגנונות״; כאן אפשר לעקוף ידנית.
              </div>
            </label>

            {/* header bar WYSIWYG controls removed */}

            </SettingsCategory>

            <SettingsCategory icon="🕯️" title="זמנים (Hebcal)">
            <div id="settings-anchor-zmanim" className="sm:col-span-2 lg:col-span-3 scroll-mt-24" />
            <div className="sm:col-span-2 lg:col-span-3 rounded-lg border border-amber-100 bg-amber-50/60 p-3 text-sm text-slate-700">
              חישוב כפול ב־<code className="rounded bg-white/80 px-1 text-xs">@hebcal/core</code>: ירושלים
              (780 מ׳) ותל אביב (0 מ׳). <strong>שבת ויום כיפור</strong> — יציאה כהבדלה אחרי השקיעה ב־
              <strong> {HAVDALAH_MINS_AFTER_SUNSET} דקות</strong> (קבוע, נפרד מצאת צומות).
            </div>

            <fieldset className="sm:col-span-2 lg:col-span-3 min-w-0 rounded-lg border border-slate-200 bg-white/80 p-3">
              <div id="settings-anchor-zmanim-candle" className="scroll-mt-24" />
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
                  <div id="settings-anchor-fast-tzait-offset" className="scroll-mt-24" />
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
            <div id="settings-anchor-typography-family" className="sm:col-span-2 lg:col-span-3 scroll-mt-24" />
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
              <div id="settings-anchor-typography-apply" className="scroll-mt-24" />
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
              <div id="settings-anchor-typography-upload" className="scroll-mt-24" />
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
                min={1}
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

            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:gap-3">
              <label className="text-sm text-slate-700 flex-1 min-w-0">
                <div id="settings-anchor-typography-color-greg" className="scroll-mt-24" />
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
              <div className="lg:w-[300px] shrink-0">
                <ColorInput
                  label="צבע מספר לועזי"
                  value={settings.gregDayTextColor}
                  onChange={(hex) => setSettings((s) => ({ ...s, gregDayTextColor: hex }))}
                />
              </div>
            </div>

            <label className="text-sm text-slate-700">
              משקל מספר לועזי ({Number((settings as any).gregDayFontWeight ?? 600)})
              <input
                className="mt-2 w-full"
                type="range"
                min={300}
                max={900}
                step={50}
                value={Number((settings as any).gregDayFontWeight ?? 600)}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    gregDayFontWeight: Number(e.target.value),
                  }))
                }
              />
            </label>

            <label className="text-sm text-slate-700">
              הזזת יום לועזי למעלה/למטה ({Number((settings as any).gregDayOffsetYPx ?? 0)}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={-20}
                max={20}
                step={1}
                value={Number((settings as any).gregDayOffsetYPx ?? 0)}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    gregDayOffsetYPx: Number(e.target.value),
                  }))
                }
              />
            </label>

            <label className="text-sm text-slate-700">
              הזזת יום לועזי ימין/שמאל ({Number((settings as any).gregDayOffsetXPx ?? 0)}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={-20}
                max={20}
                step={1}
                value={Number((settings as any).gregDayOffsetXPx ?? 0)}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    gregDayOffsetXPx: Number(e.target.value),
                  }))
                }
              />
            </label>

            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:gap-3">
              <label className="text-sm text-slate-700 flex-1 min-w-0">
                <div id="settings-anchor-typography-color-heb" className="scroll-mt-24" />
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
              <div className="lg:w-[300px] shrink-0">
                <ColorInput
                  label="צבע יום עברי"
                  value={settings.hebDayTextColor}
                  onChange={(hex) => setSettings((s) => ({ ...s, hebDayTextColor: hex }))}
                />
              </div>
            </div>

            <label className="text-sm text-slate-700">
              משקל יום עברי ({Number((settings as any).hebDayFontWeight ?? 500)})
              <input
                className="mt-2 w-full"
                type="range"
                min={300}
                max={900}
                step={50}
                value={Number((settings as any).hebDayFontWeight ?? 500)}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    hebDayFontWeight: Number(e.target.value),
                  }))
                }
              />
            </label>

            <label className="text-sm text-slate-700">
              הזזת יום עברי למעלה/למטה ({Number((settings as any).hebDayOffsetYPx ?? 0)}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={-20}
                max={20}
                step={1}
                value={Number((settings as any).hebDayOffsetYPx ?? 0)}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    hebDayOffsetYPx: Number(e.target.value),
                  }))
                }
              />
            </label>

            <label className="text-sm text-slate-700">
              הזזת יום עברי ימין/שמאל ({Number((settings as any).hebDayOffsetXPx ?? 0)}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={-20}
                max={20}
                step={1}
                value={Number((settings as any).hebDayOffsetXPx ?? 0)}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    hebDayOffsetXPx: Number(e.target.value),
                  }))
                }
              />
            </label>

            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:gap-3">
              <label className="text-sm text-slate-700 flex-1 min-w-0">
                <div id="settings-anchor-typography-color-events" className="scroll-mt-24" />
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
              <div className="lg:w-[300px] shrink-0">
                <ColorInput
                  label="צבע שם אירוע"
                  value={settings.eventTitleTextColor}
                  onChange={(hex) => setSettings((s) => ({ ...s, eventTitleTextColor: hex }))}
                />
              </div>
            </div>

            <label className="text-sm text-slate-700">
              הזזת אירועים למעלה/למטה ({Number((settings as any).eventOffsetYPx ?? 0)}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={-60}
                max={60}
                step={1}
                value={Number((settings as any).eventOffsetYPx ?? 0)}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    eventOffsetYPx: Number(e.target.value),
                  }))
                }
              />
            </label>

            <label className="text-sm text-slate-700">
              הזזת אירועים ימין/שמאל ({Number((settings as any).eventOffsetXPx ?? 0)}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={-60}
                max={60}
                step={1}
                value={Number((settings as any).eventOffsetXPx ?? 0)}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    eventOffsetXPx: Number(e.target.value),
                  }))
                }
              />
            </label>

            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:gap-3">
              <label className="text-sm text-slate-700 flex-1 min-w-0">
                <div id="settings-anchor-typography-color-zmanim" className="scroll-mt-24" />
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
              <div className="lg:w-[300px] shrink-0">
                <ColorInput
                  label="צבע זמנים (שבת / כניסה / יציאה)"
                  value={settings.shabbatTimesTextColor}
                  onChange={(hex) => setSettings((s) => ({ ...s, shabbatTimesTextColor: hex }))}
                />
              </div>
            </div>

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
                  <div className="absolute right-2 top-2 z-10 flex items-baseline gap-1 text-right">
                    <span
                      className="font-semibold"
                      style={{
                        fontSize: cellScaledPx(settings.gregDayFontPx),
                        lineHeight: 1,
                        fontWeight: Number((settings as any).gregDayFontWeight ?? settings.fontWeight ?? 600),
                        color: settings.gregDayTextColor,
                      }}
                    >
                      14
                    </span>
                    <span
                      className="font-semibold"
                      style={{
                        fontSize: cellScaledPx(settings.hebDayFontPx),
                        lineHeight: 1,
                        fontWeight: Number((settings as any).hebDayFontWeight ?? 500),
                        display: 'inline-block',
                        transform: `translate(${Number((settings as any).hebDayOffsetXPx ?? 0)}px, ${Number(
                          (settings as any).hebDayOffsetYPx ?? 0,
                        )}px)`,
                        color: settings.hebDayTextColor,
                      }}
                    >
                      י״ד
                    </span>
                  </div>

                  {/* Center event text */}
                  <div className="absolute inset-0 flex items-center justify-center px-5">
                    <div
                      className="w-full text-center font-bold"
                      style={{
                        ...fontSizeStyleAllowUnder10Px(
                          cellScaledPx(settings.eventTitleFontPx),
                          'center center',
                        ),
                        lineHeight: 1.15,
                        color: settings.eventTitleTextColor,
                      }}
                    >
                      ערב פסח
                    </div>
                  </div>

                  {/* Bottom zmanim block (same idea/placement as the real cell) */}
                  <div
                    className="absolute inset-x-2 bottom-2 z-20 min-w-0 max-w-full leading-snug text-right space-y-0.5"
                    // Browsers can clamp very small font sizes to ~10px (minimum font size setting).
                    // To allow previewing <10px, we keep a 10px base and visually scale down.
                    style={{
                      fontSize: Math.max(10, Number(settings.shabbatTimesFontPx) || 10),
                      transform:
                        Number(settings.shabbatTimesFontPx) < 10
                          ? `scale(${Math.max(0.05, Number(settings.shabbatTimesFontPx) / 10)})`
                          : undefined,
                      transformOrigin: 'bottom right',
                      color: settings.shabbatTimesTextColor,
                    }}
                  >
                    <div className="font-normal whitespace-nowrap">
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
              <div id="settings-anchor-typography-weight" className="scroll-mt-24" />
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

            <div id="settings-anchor-typography-sizes" className="sm:col-span-2 lg:col-span-3 scroll-mt-24" />
            </SettingsCategory>

            <SettingsCategory icon="🖌️" title="צבעים, מסגרות וריפוד">
            <div className="sm:col-span-2 lg:col-span-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              <div className="text-sm font-semibold text-slate-900 mb-2">משבצות ריקות / ריפוד</div>
              <div id="settings-anchor-padding-cells" className="scroll-mt-24" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div id="settings-anchor-padding-color" className="scroll-mt-24" />
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
                  <div id="settings-anchor-padding-strength" className="scroll-mt-24" />
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
              <div id="settings-anchor-grid-border-width" className="scroll-mt-24" />
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
            <div id="settings-anchor-grid-border-color" className="scroll-mt-24" />

            <label className="text-sm text-slate-700">
              כותרות ימי השבוע (שורה עליונה)
              <div id="settings-anchor-weekdays" className="scroll-mt-24" />
              <div id="settings-anchor-weekdays-mode" className="scroll-mt-24" />
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

            <label className="text-sm text-slate-700">
              <input
                type="checkbox"
                className="mr-2"
                checked={Boolean((settings as any).weekdayHeaderShowEnglish)}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    weekdayHeaderShowEnglish: e.target.checked,
                  }))
                }
              />
              הצג גם באנגלית (SUN ראשון וכו׳)
            </label>

            <label className="text-sm text-slate-700">
              <input
                type="checkbox"
                className="mr-2"
                checked={Boolean((settings as any).gridIntegratedEventsBottomLeft)}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    gridIntegratedEventsBottomLeft: e.target.checked,
                  }))
                }
              />
              במצב “דוגמת דפוס” בלבד: אירועים בתחתית שמאל + תאריכים ימין־למעלה
            </label>

            <div id="settings-anchor-weekdays-bg" className="scroll-mt-24" />
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
              <div id="settings-anchor-weekdays-height" className="scroll-mt-24" />
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
              <div id="settings-anchor-weekdays-text-offset" className="scroll-mt-24" />
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

            <div id="settings-anchor-weekdays-text-color" className="scroll-mt-24" />

            <label className="text-sm text-slate-700">
              <div id="settings-anchor-weekdays-font" className="scroll-mt-24" />
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
              <div id="settings-anchor-weekdays-underline" className="scroll-mt-24" />
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
              <div id="settings-anchor-weekdays-row-offset" className="scroll-mt-24" />
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
              <div id="settings-anchor-borders-toggle" className="scroll-mt-24" />
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
            <div id="settings-anchor-colors-event" className="scroll-mt-24" />

            <ColorInput
              label="צבע שבת"
                value={settings.shabbatBg}
              onChange={(hex) => setSettings((s) => ({ ...s, shabbatBg: hex }))}
            />
            <div id="settings-anchor-colors-shabbat" className="scroll-mt-24" />

            <ColorInput
              label="צבע “היום”"
                value={settings.todayBg}
              onChange={(hex) => setSettings((s) => ({ ...s, todayBg: hex }))}
              />
            <div id="settings-anchor-colors-today" className="scroll-mt-24" />

            <ColorInput
              label="צבע קו הדגשה סביב “היום”"
                value={(settings as any).todayOutlineColor ?? 'rgba(16,185,129,0.55)'}
              onChange={(v) => setSettings((s) => ({ ...s, todayOutlineColor: v }))}
            />
            <label className="text-sm text-slate-700">
              עובי קו הדגשה סביב “היום” ({Number((settings as any).todayOutlineWidthPx ?? 3)}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={0}
                max={10}
                step={1}
                value={Number((settings as any).todayOutlineWidthPx ?? 3)}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, todayOutlineWidthPx: Number(e.target.value) }))
                }
              />
            </label>

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
              <div id="settings-anchor-export-page" className="scroll-mt-24" />
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
              <div id="settings-anchor-export-orientation" className="scroll-mt-24" />
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
              <div id="settings-anchor-export-margin" className="scroll-mt-24" />
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

            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 sm:col-span-2 lg:col-span-3">
              <div className="text-sm font-semibold text-slate-900">תצוגת משבצות</div>
              <div className="mt-1 text-xs text-slate-600">
                אופציות פריסה לתאריך (עברי/לועזי) ולאירועים בתוך כל משבצת. גדלים נשלטים ע״י הסליידרים בטיפוגרפיה.
              </div>

              <label className="mt-3 block text-sm text-slate-700">
                סדר תאריכים בפינה (עברי/לועזי)
                <select
                  className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
                  value={(settings as any).cellDateOrder ?? 'greg_first'}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      cellDateOrder: e.target.value === 'heb_first' ? 'heb_first' : 'greg_first',
                    }))
                  }
                >
                  <option value="heb_first">עברי ואז לועזי</option>
                  <option value="greg_first">לועזי ואז עברי</option>
                </select>
              </label>

              <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={settings.cellCornerLayout === 'bottom_left'}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      cellCornerLayout: e.target.checked ? 'bottom_left' : 'default',
                    }))
                  }
                />
                תאריך בפינה שמאל‑למטה + אירועים בימין‑למעלה
              </label>

              <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={Boolean(settings.cellSplitEnabled)}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, cellSplitEnabled: e.target.checked }))
                  }
                />
                פיצול תא (עמודה צדדית)
              </label>

              {settings.cellSplitEnabled ? (
                <label className="mt-3 block text-sm text-slate-700">
                  רוחב עמודה צדדית ({Math.round(Number(settings.cellSplitRatio ?? 0.28) * 100)}%)
                  <input
                    className="mt-2 w-full"
                    type="range"
                    min={15}
                    max={45}
                    step={1}
                    value={Math.round(Number(settings.cellSplitRatio ?? 0.28) * 100)}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        cellSplitRatio: Number(e.target.value) / 100,
                      }))
                    }
                  />
                </label>
              ) : null}
            </div>

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
            <p className="mt-1 text-xs text-slate-600 sm:col-span-2 lg:col-span-3 max-w-3xl leading-relaxed">
              כשהסימון מופעל: לחיצה על תא בתוך החודש בלוח פותחת חלונית — שם אפשר למחוק או לשנות את
              שורות האירועים במרכז התא, ולכוון את המיקום עם «הזזה ימינה/שמאלה», «הזזה למעלה/למטה»
              ו«יישור». השינוי נשמר לפי יום־חודש לועזי (חוזר בכל השנים באותו תאריך) עד לחיצה על
              «מחק עריכה».
            </p>
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

            <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2 lg:col-span-3">
              <div className="text-sm font-semibold text-slate-900">סגנונות שמורים</div>
              <div className="mt-1 text-xs text-slate-600">
                שמור את כל ההגדרות הנוכחיות בשם, והחל אותן בלחיצה אחת.
              </div>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  className="w-full sm:w-72 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  placeholder="שם סגנון (למשל: פרינט נקי / רטרו)"
                  value={stylePresetName}
                  onChange={(e) => setStylePresetName(e.target.value)}
                />
                <button
                  type="button"
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                  onClick={() => {
                    const name = stylePresetName.trim();
                    if (!name) {
                      setSaveFlash('אנא כתוב שם לסגנון.');
                      window.setTimeout(() => setSaveFlash(null), 1800);
                      return;
                    }
                    const now = Date.now();
                    const p: StylePreset = {
                      id: createPresetId(),
                      name,
                      createdAt: now,
                      updatedAt: now,
                      settings,
                    };
                    setStylePresets((items) => [p, ...items]);
                    setStylePresetSelectedId(p.id);
                    setStylePresetName('');
                    setSaveFlash('הסגנון נשמר');
                    window.setTimeout(() => setSaveFlash(null), 1500);
                  }}
                >
                  שמור כסגנון חדש
                </button>
              </div>

              <div className="mt-3 flex flex-col gap-2">
                {stylePresets.length ? (
                  <div className="flex flex-col gap-2">
                    <select
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                      value={stylePresetSelectedId ?? ''}
                      onChange={(e) => setStylePresetSelectedId(e.target.value || null)}
                    >
                      {stylePresets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                        onClick={() => {
                          const p = stylePresets.find((x) => x.id === stylePresetSelectedId);
                          if (!p) return;
                          try {
                            const changed = JSON.stringify(settings) !== JSON.stringify(p.settings);
                            if (changed) {
                              const ok = window.confirm(
                                `שמת לב: יש שינויים ביחס לסגנון "${p.name}".\n\nלעדכן את הסגנון לפי ההגדרות הנוכחיות (במקום להחזיר אחורה)?`,
                              );
                              if (ok) {
                                const now = Date.now();
                                setStylePresets((items) =>
                                  items.map((x) => (x.id === p.id ? { ...x, updatedAt: now, settings } : x)),
                                );
                                setSaveFlash('הסגנון עודכן');
                                window.setTimeout(() => setSaveFlash(null), 1500);
                                return;
                              }
                            }
                          } catch {
                            // ignore
                          }
                          applyStylePreset(p);
                        }}
                      >
                        החל עיצוב
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                        onClick={() => {
                          const p = stylePresets.find((x) => x.id === stylePresetSelectedId);
                          if (!p) return;
                          try {
                            const changed = JSON.stringify(settings) !== JSON.stringify(p.settings);
                            if (changed) {
                              const ok = window.confirm(
                                `שמת לב: יש שינויים ביחס לסגנון "${p.name}".\n\nלעדכן את הסגנון לפי ההגדרות הנוכחיות (במקום להחזיר אחורה)?`,
                              );
                              if (ok) {
                                const now = Date.now();
                                setStylePresets((items) =>
                                  items.map((x) => (x.id === p.id ? { ...x, updatedAt: now, settings } : x)),
                                );
                                setSaveFlash('הסגנון עודכן');
                                window.setTimeout(() => setSaveFlash(null), 1500);
                                return;
                              }
                            }
                          } catch {
                            // ignore
                          }
                          applyStylePresetAll(p);
                        }}
                        title="כולל פונטים וגדלים"
                      >
                        החל הכל
                      </button>
                      {stylePresetUndo ? (
                        <button
                          type="button"
                          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                          onClick={() => {
                            setSettings(stylePresetUndo);
                            setStylePresetUndo(null);
                            setSaveFlash('חזרה לסגנון הקודם');
                            window.setTimeout(() => setSaveFlash(null), 1500);
                          }}
                          title="Undo"
                        >
                          חזור
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                        onClick={() => {
                          const p = stylePresets.find((x) => x.id === stylePresetSelectedId);
                          if (!p) return;
                          if (!window.confirm(`לעדכן את הסגנון \"${p.name}\" לפי ההגדרות הנוכחיות?`)) return;
                          const now = Date.now();
                          setStylePresets((items) =>
                            items.map((x) =>
                              x.id === p.id ? { ...x, updatedAt: now, settings } : x,
                            ),
                          );
                          setSaveFlash('הסגנון עודכן');
                          window.setTimeout(() => setSaveFlash(null), 1500);
                        }}
                      >
                        עדכן לפי מצב נוכחי
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 hover:bg-rose-100"
                        onClick={() => {
                          const p = stylePresets.find((x) => x.id === stylePresetSelectedId);
                          if (!p) return;
                          if (!window.confirm(`למחוק את הסגנון \"${p.name}\"?`)) return;
                          setStylePresets((items) => items.filter((x) => x.id !== p.id));
                          setStylePresetSelectedId((cur) => {
                            if (cur !== p.id) return cur;
                            const next = stylePresets.filter((x) => x.id !== p.id)[0];
                            return next?.id ?? null;
                          });
                          setSaveFlash('הסגנון נמחק');
                          window.setTimeout(() => setSaveFlash(null), 1500);
                        }}
                      >
                        מחק
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-600">אין עדיין סגנונות שמורים.</div>
                )}
              </div>
            </div>

            <div
              id="settings-anchor-header-new"
              className="sm:col-span-2 lg:col-span-3 mt-8 rounded-xl border border-slate-200 bg-white/80 p-4 scroll-mt-24"
            >
              <div className="text-sm font-semibold text-slate-900">פס עליון חדש — 4 תיבות טקסט</div>
              <div className="mt-1 text-xs text-slate-600">
                כל תיבה היא <strong>עצמאית לחלוטין</strong>, ממוקמת ב־<code>absolute</code>, מתחילה מימין,
                והפס חותך כל גלישה (<code>overflow: hidden</code>).
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <label className="text-sm text-slate-700">
                  גובה פס ({settings.headerBarHeightPx}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={48}
                max={140}
                value={settings.headerBarHeightPx}
                onChange={(e) =>
                      setSettings((s) => ({ ...s, headerBarHeightPx: Number(e.target.value) }))
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
                      setSettings((s) => ({ ...s, headerBarRadiusPx: Number(e.target.value) }))
                }
              />
            </label>
            <label className="text-sm text-slate-700">
              עובי מסגרת פס ({settings.headerBarBorderWidthPx}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={0}
                max={6}
                value={settings.headerBarBorderWidthPx}
                onChange={(e) =>
                      setSettings((s) => ({ ...s, headerBarBorderWidthPx: Number(e.target.value) }))
                }
              />
            </label>

                <ColorInput
                  label="צבע רקע פס"
                  value={(settings.headerBarBg ?? '').startsWith('#') ? settings.headerBarBg : '#FFFFFF'}
                  onChange={(hex) => setSettings((s) => ({ ...s, headerBarBg: hex }))}
                />
                <ColorInput
                  label="צבע מסגרת פס"
                  value={settings.headerBarBorderColor}
                  onChange={(hex) => setSettings((s) => ({ ...s, headerBarBorderColor: hex }))}
                />
            <label className="text-sm text-slate-700">
                  מרווח מתחת לפס ({settings.headerBarMarginBottomPx}px)
              <input
                    className="mt-2 w-full"
                    type="range"
                    min={0}
                    max={48}
                    value={settings.headerBarMarginBottomPx}
                onChange={(e) =>
                      setSettings((s) => ({ ...s, headerBarMarginBottomPx: Number(e.target.value) }))
                }
              />
            </label>

            <label className="text-sm text-slate-700">
                  הזזת פס למעלה/למטה ({settings.headerBarOffsetYPx}px)
              <input
                className="mt-2 w-full"
                type="range"
                    min={-40}
                max={40}
                    value={settings.headerBarOffsetYPx}
                onChange={(e) =>
                      setSettings((s) => ({ ...s, headerBarOffsetYPx: Number(e.target.value) }))
                }
              />
            </label>

            <label className="text-sm text-slate-700">
                  מתיחת טקסט כותרות — אופקי ({(settings as any).headerTextScaleXPercent ?? 100}%)
              <input
                className="mt-2 w-full"
                type="range"
                min={50}
                max={200}
                step={1}
                value={Number((settings as any).headerTextScaleXPercent ?? 100)}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, headerTextScaleXPercent: Number(e.target.value) }))
                }
              />
            </label>

            <label className="text-sm text-slate-700">
                  מתיחת טקסט כותרות — אנכי ({(settings as any).headerTextScaleYPercent ?? 100}%)
              <input
                className="mt-2 w-full"
                type="range"
                min={50}
                max={200}
                step={1}
                value={Number((settings as any).headerTextScaleYPercent ?? 100)}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, headerTextScaleYPercent: Number(e.target.value) }))
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
                      setSettings((s) => ({ ...s, headerBarMaxWidthPx: Number(e.target.value) }))
                }
              />
                  <div className="mt-1 text-xs text-slate-500">0 = רוחב מלא</div>
            </label>
                <label className="text-sm text-slate-700 flex items-center gap-2 mt-6">
              <input
                    type="checkbox"
                    checked={settings.headerBarShowEditButton}
                onChange={(e) =>
                      setSettings((s) => ({ ...s, headerBarShowEditButton: e.target.checked }))
                }
              />
                  הצג כפתור “ערוך” בפס
            </label>
              </div>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* ─── תיבה 1 ─── */}
                <div className="sm:col-span-2 lg:col-span-3 text-sm font-semibold text-slate-800 border-b border-slate-200 pb-1">
                  תיבה 1 — כותרת ראשית
                </div>
                <div className="sm:col-span-2 lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <label className="text-sm text-slate-700 sm:col-span-2">
                    כותרת ראשית (נשמרת בקונפיגורציה)
                    <input
                      className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
                      value={settings.titleMain}
                      onChange={(e) => setSettings((s) => ({ ...s, titleMain: e.target.value }))}
                      placeholder="לוח שנה עברי‑לועזי"
                    />
                  </label>
                  <label className="text-sm text-slate-700">
                    גודל גופן ({settings.headerBox1FontPx}px)
                    <input
                      className="mt-2 w-full"
                      type="range"
                      min={10}
                      max={80}
                      step={1}
                      value={settings.headerBox1FontPx}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, headerBox1FontPx: Number(e.target.value) }))
                      }
                    />
                  </label>
                </div>
                <label className="text-xs text-slate-600 sm:col-span-2 lg:col-span-3">
                  דריסה לתיבה 1 (אופציונלי) — אם כתוב כאן טקסט, הוא יוצג במקום הכותרת הראשית
                  <input
                    className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
                    value={(settings as any).headerBox1TextOverride ?? ''}
                    onChange={(e) => setSettings((s) => ({ ...s, headerBox1TextOverride: e.target.value }))}
                    placeholder="ריק = ללא דריסה"
                  />
                </label>
            <label className="text-sm text-slate-700">
                  הזזה ימין ← שמאל ({settings.headerBox1OffsetXPx}px)
                  <input className="mt-2 w-full" type="range" min={0} max={800} step={1}
                    value={settings.headerBox1OffsetXPx}
                    onChange={e => setSettings(s => ({ ...s, headerBox1OffsetXPx: Number(e.target.value) }))} />
            </label>
            <label className="text-sm text-slate-700">
                  הזזה למעלה ← למטה ({settings.headerBox1OffsetYPx}px)
                  <input className="mt-2 w-full" type="range" min={0} max={200} step={1}
                    value={settings.headerBox1OffsetYPx}
                    onChange={e => setSettings(s => ({ ...s, headerBox1OffsetYPx: Number(e.target.value) }))} />
            </label>
            <label className="text-sm text-slate-700">
                  משקל גופן ({settings.headerBox1FontWeight})
                  <input className="mt-2 w-full" type="range" min={300} max={900} step={50}
                    value={settings.headerBox1FontWeight}
                    onChange={e => setSettings(s => ({ ...s, headerBox1FontWeight: Number(e.target.value) }))} />
            </label>
                <ColorInput label="צבע" value={settings.headerBox1Color}
                  onChange={hex => setSettings(s => ({ ...s, headerBox1Color: hex }))} />

                {/* ─── תיבה 2 ─── */}
                <div className="sm:col-span-2 lg:col-span-3 text-sm font-semibold text-slate-800 border-b border-slate-200 pb-1 mt-2">
                  תיבה 2 — כותרת משנה
                </div>
                <div className="sm:col-span-2 lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <label className="text-sm text-slate-700 sm:col-span-2">
                    טקסט ידני (אופציונלי) — ריק = ברירת מחדל
                    <input
                      className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
                      value={(settings as any).headerBox2TextOverride ?? ''}
                      onChange={(e) => setSettings((s) => ({ ...s, headerBox2TextOverride: e.target.value }))}
                      placeholder={settings.titleSub}
                    />
                  </label>
                  <label className="text-sm text-slate-700">
                    גודל גופן ({settings.headerBox2FontPx}px)
                    <input
                      className="mt-2 w-full"
                      type="range"
                      min={10}
                      max={80}
                      step={1}
                      value={settings.headerBox2FontPx}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, headerBox2FontPx: Number(e.target.value) }))
                      }
                    />
                  </label>
                </div>
            <label className="text-sm text-slate-700">
                  הזזה ימין ← שמאל ({settings.headerBox2OffsetXPx}px)
                  <input className="mt-2 w-full" type="range" min={0} max={1000} step={1}
                    value={settings.headerBox2OffsetXPx}
                    onChange={e => setSettings(s => ({ ...s, headerBox2OffsetXPx: Number(e.target.value) }))} />
            </label>
            <label className="text-sm text-slate-700">
                  הזזה למעלה ← למטה ({settings.headerBox2OffsetYPx}px)
                  <input className="mt-2 w-full" type="range" min={0} max={200} step={1}
                    value={settings.headerBox2OffsetYPx}
                    onChange={e => setSettings(s => ({ ...s, headerBox2OffsetYPx: Number(e.target.value) }))} />
            </label>
            <label className="text-sm text-slate-700">
                  משקל גופן ({settings.headerBox2FontWeight})
                  <input className="mt-2 w-full" type="range" min={300} max={900} step={50}
                    value={settings.headerBox2FontWeight}
                    onChange={e => setSettings(s => ({ ...s, headerBox2FontWeight: Number(e.target.value) }))} />
            </label>
                <ColorInput label="צבע" value={settings.headerBox2Color}
                  onChange={hex => setSettings(s => ({ ...s, headerBox2Color: hex }))} />

                {/* ─── תיבה 3 ─── */}
                <div className="sm:col-span-2 lg:col-span-3 text-sm font-semibold text-slate-800 border-b border-slate-200 pb-1 mt-2">
                  תיבה 3 — חודש עברי (אוטומטי / טקסט ידני)
                </div>
                <label className="text-sm text-slate-700 sm:col-span-2 lg:col-span-3">
                  טקסט ידני (אופציונלי) — ריק = אוטומטי
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
                      value={(settings as any).headerBox3TextOverride ?? ''}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, headerBox3TextOverride: e.target.value }))
                      }
                      placeholder="אוטומטי לפי חודש"
                    />
                    <button
                      type="button"
                      className="shrink-0 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() => setSettings((s) => ({ ...s, headerBox3TextOverride: '' }))}
                      title="חזור לטקסט אוטומטי"
                    >
                      אוטומטי
                    </button>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    אם יש כאן טקסט ידני, הוא יישאר קבוע גם כשעוברים לחודש/שנה אחרת. לחץ “אוטומטי” כדי
                    לחזור לעדכון אוטומטי.
                  </div>
                </label>
                <label className="text-sm text-slate-700">
                  הזזה ימין ← שמאל ({settings.headerBox3OffsetXPx}px)
                  <input className="mt-2 w-full" type="range" min={0} max={800} step={1}
                    value={settings.headerBox3OffsetXPx}
                    onChange={e => setSettings(s => ({ ...s, headerBox3OffsetXPx: Number(e.target.value) }))} />
            </label>
            <label className="text-sm text-slate-700">
                  הזזה למעלה ← למטה ({settings.headerBox3OffsetYPx}px)
                  <input className="mt-2 w-full" type="range" min={0} max={200} step={1}
                    value={settings.headerBox3OffsetYPx}
                    onChange={e => setSettings(s => ({ ...s, headerBox3OffsetYPx: Number(e.target.value) }))} />
            </label>
            <label className="text-sm text-slate-700">
                  גודל גופן ({settings.headerBox3FontPx}px)
                  <input className="mt-2 w-full" type="range" min={10} max={80} step={1}
                    value={settings.headerBox3FontPx}
                    onChange={e => setSettings(s => ({ ...s, headerBox3FontPx: Number(e.target.value) }))} />
            </label>
            <label className="text-sm text-slate-700">
                  משקל גופן ({settings.headerBox3FontWeight})
                  <input className="mt-2 w-full" type="range" min={300} max={900} step={50}
                    value={settings.headerBox3FontWeight}
                    onChange={e => setSettings(s => ({ ...s, headerBox3FontWeight: Number(e.target.value) }))} />
            </label>
                <ColorInput label="צבע" value={settings.headerBox3Color}
                  onChange={hex => setSettings(s => ({ ...s, headerBox3Color: hex }))} />

                {/* ─── תיבה 4 ─── */}
                <div className="sm:col-span-2 lg:col-span-3 text-sm font-semibold text-slate-800 border-b border-slate-200 pb-1 mt-2">
                  תיבה 4 — חודש לועזי (אוטומטי / טקסט ידני)
                </div>
                <label className="text-sm text-slate-700 sm:col-span-2 lg:col-span-3">
                  טקסט ידני (אופציונלי) — ריק = אוטומטי
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
                      value={(settings as any).headerBox4TextOverride ?? ''}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, headerBox4TextOverride: e.target.value }))
                      }
                      placeholder="אוטומטי לפי חודש"
                    />
                    <button
                      type="button"
                      className="shrink-0 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() => setSettings((s) => ({ ...s, headerBox4TextOverride: '' }))}
                      title="חזור לטקסט אוטומטי"
                    >
                      אוטומטי
                    </button>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    אם יש כאן טקסט ידני, הוא יישאר קבוע גם כשעוברים לחודש/שנה אחרת. לחץ “אוטומטי” כדי
                    לחזור לעדכון אוטומטי.
                  </div>
                </label>
            <label className="text-sm text-slate-700">
                  הזזה אופקית סביב מרכז הפס — {settings.headerBox4OffsetXPx}px ({HEADER_BOX4_CENTER_OFFSET_X_PX} ≈ מרכז)
                  <input className="mt-2 w-full" type="range" min={0} max={800} step={1}
                    value={settings.headerBox4OffsetXPx}
                    onChange={e => setSettings(s => ({ ...s, headerBox4OffsetXPx: Number(e.target.value) }))} />
            </label>
            <label className="text-sm text-slate-700">
                  הזזה למעלה ← למטה ({settings.headerBox4OffsetYPx}px)
                  <input className="mt-2 w-full" type="range" min={0} max={200} step={1}
                    value={settings.headerBox4OffsetYPx}
                    onChange={e => setSettings(s => ({ ...s, headerBox4OffsetYPx: Number(e.target.value) }))} />
            </label>
            <label className="text-sm text-slate-700">
                  גודל גופן ({settings.headerBox4FontPx}px)
                  <input className="mt-2 w-full" type="range" min={10} max={80} step={1}
                    value={settings.headerBox4FontPx}
                    onChange={e => setSettings(s => ({ ...s, headerBox4FontPx: Number(e.target.value) }))} />
            </label>
            <label className="text-sm text-slate-700">
                  משקל גופן ({settings.headerBox4FontWeight})
                  <input className="mt-2 w-full" type="range" min={300} max={900} step={50}
                    value={settings.headerBox4FontWeight}
                    onChange={e => setSettings(s => ({ ...s, headerBox4FontWeight: Number(e.target.value) }))} />
            </label>
                <ColorInput label="צבע" value={settings.headerBox4Color}
                  onChange={hex => setSettings(s => ({ ...s, headerBox4Color: hex }))} />

                <div id="settings-anchor-header-separator" className="scroll-mt-24" />
                <div className="sm:col-span-2 lg:col-span-3 text-sm font-semibold text-slate-800 border-b border-slate-200 pb-1 mt-3">
                  קו מפריד בין תאריך עברי ללועזי (אנכי)
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2 lg:col-span-3">
                  <input
                    type="checkbox"
                    checked={settings.headerDatePairSeparatorEnabled}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, headerDatePairSeparatorEnabled: e.target.checked }))
                    }
                  />
                  הצג קו מפריד בין החודשים
                </label>
                <ColorInput
                  label="צבע הקו"
                  value={settings.headerDatePairSeparatorColor}
                  onChange={(hex) => setSettings((s) => ({ ...s, headerDatePairSeparatorColor: hex }))}
                />
                <label className="text-sm text-slate-700">
                  עובי הקו ({settings.headerDatePairSeparatorWidthPx}px)
                  <input
                    className="mt-2 w-full"
                    type="range"
                    min={1}
                    max={12}
                    step={1}
                    value={settings.headerDatePairSeparatorWidthPx}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        headerDatePairSeparatorWidthPx: Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label className="text-sm text-slate-700">
                  מרווח אנכי מהקצוות של שורת התאריכים ({settings.headerDatePairSeparatorInsetYPx}px)
                  <input
                    className="mt-2 w-full"
                    type="range"
                    min={0}
                    max={24}
                    step={1}
                    value={settings.headerDatePairSeparatorInsetYPx}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        headerDatePairSeparatorInsetYPx: Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label className="text-sm text-slate-700">
                  הוזזה למעלה ← למטה ({settings.headerDatePairSeparatorOffsetYPx}px)
                  <input
                    className="mt-2 w-full"
                    type="range"
                    min={0}
                    max={200}
                    step={1}
                    value={settings.headerDatePairSeparatorOffsetYPx}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        headerDatePairSeparatorOffsetYPx: Number(e.target.value),
                      }))
                    }
                  />
                </label>
              </div>
            </div>
            </SettingsCategory>

            <SettingsCategory icon="🖼️" title="רקע, קנבס ופריסה">
            <label className="text-sm text-slate-700 sm:col-span-2 lg:col-span-3">
              תמונת רקע לטבלה
              <div id="settings-anchor-background" className="scroll-mt-24" />
              <div className="mt-1 flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
                    <div id="settings-anchor-background-mode" className="scroll-mt-24" />
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
                  id="settings-anchor-background-upload"
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
                  id="settings-anchor-background-remove"
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
                  <div id="settings-anchor-background-opacity" className="scroll-mt-24" />
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
              <div id="settings-anchor-canvas-autofit" className="scroll-mt-24" />
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
              <div id="settings-anchor-canvas-fillheight" className="scroll-mt-24" />
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
              <div id="settings-anchor-canvas-zoom" className="scroll-mt-24" />
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

            <label className="text-sm text-slate-700">
              <div id="settings-anchor-grid-offset" className="scroll-mt-24" />
              הזזת הלוח (הטבלה) למעלה/למטה ({Number((settings as any).gridOffsetYPx ?? 0)}px)
              <input
                className="mt-2 w-full"
                type="range"
                min={-500}
                max={500}
                step={1}
                value={Number((settings as any).gridOffsetYPx ?? 0)}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    gridOffsetYPx: Number(e.target.value),
                  }))
                }
              />
              <div className="mt-1 text-xs text-slate-500">
                מזיז את הטבלה בלבד (לא את הפס העליון). לא פעיל במצב “כותרת משולבת בתוך הטבלה”.
              </div>
            </label>

            <label className="text-sm text-slate-700 flex items-center gap-2 sm:col-span-2 lg:col-span-3">
              <div id="settings-anchor-canvas-center" className="scroll-mt-24" />
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
              <div id="settings-anchor-canvas-padding" className="scroll-mt-24" />
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
              <div id="settings-anchor-canvas-border" className="scroll-mt-24" />
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
      </div>

      {tenantEditorOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4"
          onMouseDown={() => setTenantEditorOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-base font-bold text-slate-900">ניהול טננטים</div>
              <button
                type="button"
                onClick={() => setTenantEditorOpen(false)}
                className="text-sm px-3 py-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50"
              >
                סגור
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm text-slate-700">
                Tenant ID
                <input
                  className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
                  value={tenantDraftId}
                  onChange={(e) => setTenantDraftId(e.target.value)}
                  placeholder="example: branch-1"
                />
              </label>
              <label className="text-sm text-slate-700">
                שם
                <input
                  className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
                  value={tenantDraftName}
                  onChange={(e) => setTenantDraftName(e.target.value)}
                  placeholder="example: סניף ירושלים"
                />
              </label>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const idRaw = tenantDraftId.trim();
                  const id = sanitizeTenantIdForUi(idRaw);
                  const name = tenantDraftName.trim();
                  if (!id || !name) return;
                  if (id !== idRaw && idRaw) {
                    window.alert(
                      `Tenant ID הותאם אוטומטית לכתיבה בענן: "${idRaw}" → "${id}"\n\nמומלץ להשתמש רק באנגלית/מספרים/מינוס/קו תחתון.`,
                    );
                  }
                  setTenants((prev) => {
                    const next = prev.filter((t) => t.id !== id);
                    next.unshift({ id, name });
                    return next;
                  });
                  setTenantDraftId('');
                  setTenantDraftName('');
                }}
                className="text-sm px-3 py-2 rounded-md border border-slate-200 bg-slate-900 text-white hover:bg-slate-800"
              >
                הוסף / עדכן
              </button>
              <button
                type="button"
                onClick={() => {
                  setTenants([]);
                  setActiveTenantId('default');
                }}
                className="text-sm px-3 py-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                title="ניקוי כל הטננטים המקומיים"
              >
                איפוס רשימה
              </button>
            </div>

            <div className="mt-4 border-t border-slate-200 pt-3">
              <div className="text-sm font-medium text-slate-800">טננטים שמורים</div>
              <div className="mt-2 grid grid-cols-1 gap-2">
                {tenants.length ? (
                  tenants.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate">{t.name}</div>
                        <div className="text-xs text-slate-600 direction-ltr">{t.id}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveTenantId(t.id)}
                          className="text-sm px-3 py-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                          title="בחר כטננט פעיל"
                        >
                          בחר
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const ok = window.confirm(`למחוק את הטננט "${t.name}"?`);
                            if (!ok) return;
                            setTenants((prev) => prev.filter((x) => x.id !== t.id));
                            if (activeTenantId === t.id) setActiveTenantId('default');
                          }}
                          className="text-sm px-3 py-2 rounded-md border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                          title="מחק מהרשימה המקומית"
                        >
                          מחק
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-600">אין טננטים. אפשר לעבוד עם default.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className="mx-auto w-full"
        style={{
          maxWidth: `min(calc(100vw - 48px), ${DISPLAY_CALENDAR_SCREEN_MAX_WIDTH_PX + 220}px)`,
        }}
      >
      <div
        dir="ltr"
        className="relative flex w-full gap-0"
      >
      <div className="min-w-0 flex-1" style={{ overflowX: 'auto' }}>
        <CalendarContainer
          screenMinWidthVw={DISPLAY_CALENDAR_SCREEN_MIN_WIDTH_VW}
          screenMaxWidthPx={DISPLAY_CALENDAR_SCREEN_MAX_WIDTH_PX}
          printOrientation={settings.pdfOrientation === 'portrait' ? 'portrait' : 'landscape'}
          style={{
            // Override CalendarContainer `margin: 0 auto` so the frame is not centered in flex-1.
            margin: 0,
            marginLeft: 'auto',
            width: `${canvasSurfacePx.widthPx}px`,
            boxSizing: 'border-box',
          }}
        >
      {/* Ornamental canvas — שטח PDF בתוך מסגרת רוחב כמו Display / עמדות (CalendarContainer) */}
      <div
        className={[
            'relative shadow-sm',
            // Always allow scrolling if content overflows the frame (when zoom/manual settings exceed the canvas).
            'overflow-auto',
        ].join(' ')}
        data-inspect="background"
        data-pdf-target="true"
        style={{
          border: `${settings.canvasBorderWidthPx}px solid ${settings.canvasBorderColor}`,
          ...(pdfDebugEnabled ? ({ outline: '5px solid red', outlineOffset: 2 } as const) : null),
          borderRadius: resolveCanvasOuterRadiusPx(settings),
          padding: settings.canvasPaddingPx,
          // Keep the top edge tight: a top padding creates an empty “shelf” above the weekday row,
          // and can overlap the header when moving the table up.
          paddingTop: 0,
          backgroundColor: settings.calendarCanvasFill,
          ...canvasBgStyle,
          width: `${canvasSurfacePx.widthPx}px`,
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
              ? {
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  justifyContent: 'center',
                }
              : undefined
          }
        >
          <div
            ref={calendarContentRef}
            data-pdf-capture-root="true"
            className={['w-full', settings.layoutFillHeight ? 'h-full' : ''].join(' ')}
            style={{
              // Apply the Studio "canvas zoom" slider (40–100%) to the calendar content only.
              // The outer canvas remains true-size; zoom uses scroll when content overflows.
              transform: `scale(${resolveCalendarLayoutZoomPercent(settings) / 100})`,
              ...(settings.layoutFillHeight
                ? (() => {
                    return {
                      height: '100%',
                      minHeight: '100%',
                    } as const;
                  })()
                : null),
              // Center origin + scale()>1 paints left of x=0; scroll cannot go negative, so clip. Pin top-left.
              transformOrigin: 'left top',
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
            layoutInvScale={
              undefined
            }
            headerFontFamily={
              shouldApplyFontTo('calendarHeader')
                ? resolveFontFamilyFor('calendarHeader')
                : undefined
            }
            gridChildren={
              <>
          {weekdayHeaders.map((d, idx) => (
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
              {settings.weekdayHeaderShowEnglish ? (
                <div
                  dir="rtl"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    transform:
                      settings.gridWeekdayHeaderTextOffsetYPx === 0
                        ? undefined
                        : `translateY(${settings.gridWeekdayHeaderTextOffsetYPx}px)`,
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span>{d}</span>
                  <span dir="ltr" style={{ fontWeight: 800, opacity: 0.9 }}>
                    {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][idx] ?? ''}
                  </span>
                </div>
              ) : (
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
              )}
            </div>
          ))}

          {dayMetas.map((m) => {
          if (!m.inMonth) {
            const isLogoCell = Boolean(paddingLogoGKey && m.gKey === paddingLogoGKey);
            const padMonthKey = monthPaddingImageKeyFromYearMonth(viewDate);
            const base = resolveDayTextOverride(overrides, m.gKey) as any;
            const monthPad = (overrides as any)?.[padMonthKey] as any;
            const globalPad = (overrides as any)?.[GLOBAL_CELL_IMAGE_KEY] as any;
            const manual =
              (typeof base?.imageDataUrl === 'string' && String(base.imageDataUrl).trim())
                ? base
                : isLogoCell && (typeof monthPad?.imageDataUrl === 'string' && String(monthPad.imageDataUrl).trim())
                  ? monthPad
                  : isLogoCell && (typeof globalPad?.imageDataUrl === 'string' && String(globalPad.imageDataUrl).trim())
                    ? globalPad
                    : base;
            const manualKeyUsed =
              manual === monthPad ? padMonthKey : manual === globalPad ? GLOBAL_CELL_IMAGE_KEY : recurringOverrideKeyFromIsoDate(m.gKey);
            return (
              <div
                key={m.gKey}
                className="relative min-h-0 min-w-0 h-full overflow-hidden"
                style={{
                  background: paddingBg,
                  ...(settings.headerLayoutStyle === 'grid_integrated'
                    ? { border: cellFullBorder }
                    : { borderLeft: cellEdgeBorder, borderBottom: cellEdgeBorder }),
                  borderRadius: cellRadiusPx ? `${cellRadiusPx}px` : undefined,
                  cursor: settings.enableManualEdits ? 'pointer' : undefined,
                }}
                onClick={(e) => {
                  if (!settings.enableManualEdits) return;

                  // Don't open dialogs when clicking controls inside the cell.
                  const el = e.target as Element | null;
                  if (el && el.closest('button, a, input, textarea, select, label')) return;

                  // Keep the special "padding logo" behavior (apply to all padding cells).
                  // For all other padding cells, behave like the 2026 app: click → pick image for this cell.
                  if (isLogoCell) {
                    openPaddingImageScopeDialog(m.gKey);
                    return;
                  }
                  pendingImageStoreKeyRef.current = null;
                  pendingImageGlobalRef.current = false;
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
                        backgroundSize: manual.imageFit ?? 'contain',
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
                          const storeKey = manualKeyUsed;
                          const cur = (copy as any)[storeKey] ?? resolveDayTextOverride(copy, m.gKey);
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

          const dateFade = m.inMonth ? 1 : 0.45;
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
          const editBtnFontPx = Math.max(5, Math.round(gregPx * 0.62));
          const topCornerPx = 3;
          const datesBandPx = 22;
          const editBandPx = Math.ceil(editBtnFontPx * 1.35) + 2;
          const gapBelowTopDatesPx = 4;
          const datesEndPx = topCornerPx + Math.max(datesBandPx, editBandPx) + gapBelowTopDatesPx;
          const dstBumpPx = m.dstTransitionLabel ? 22 : 0;
          const centerPaddingTopPx = 30 + dstBumpPx;

          return (
            <div
              key={m.gKey}
              className={`group relative min-h-24 min-w-0 sm:min-h-28 p-2 ${isExporting ? '' : 'overflow-hidden'}`}
              data-inspect="cell"
              data-pdf-cell="true"
              style={{
                minHeight: settings.layoutFillHeight ? 0 : undefined,
                height: settings.layoutFillHeight ? '100%' : undefined,
                background: bg,
                boxShadow:
                  m.inMonth && m.isToday
                    ? `inset 0 0 0 ${Math.max(0, Number((settings as any).todayOutlineWidthPx ?? 3))}px ${String(
                        (settings as any).todayOutlineColor ?? 'rgba(16,185,129,0.55)',
                      )}`
                    : undefined,
                ...(settings.headerLayoutStyle === 'grid_integrated'
                  ? { border: cellFullBorder }
                  : { borderLeft: cellEdgeBorder, borderBottom: cellEdgeBorder }),
                borderRadius: cellRadiusPx ? `${cellRadiusPx}px` : undefined,
                cursor: settings.enableManualEdits && m.inMonth ? 'pointer' : 'default',
              }}
              onClick={(e) => {
                if (!settings.enableManualEdits) return;
                // Ignore clicks on interactive controls (edit/delete buttons, inputs, etc.).
                const el = e.target as Element | null;
                if (el && el.closest('button, a, input, textarea, select, label')) return;
                const suggested = uniqAbbrevHebrewTitleLines(m.titles).join('\n');
                openEditorForDay(m.gKey, suggested);
              }}
            >
              {settings.cellSplitEnabled ? (
                <div
                  className="pointer-events-none absolute bottom-0 right-0 top-0 z-[7]"
                  style={{
                    width: `${Math.round((Number(settings.cellSplitRatio ?? 0.28) || 0.28) * 100)}%`,
                    borderLeft: '1px solid rgba(148,163,184,0.35)',
                  }}
                  aria-hidden
                />
              ) : null}
              {manual?.imageDataUrl ? (
                <>
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: `url(${manual.imageDataUrl})`,
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: manual.imageFit ?? 'contain',
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
                  className={[
                    'absolute left-2 top-2 z-30 rounded border border-slate-200 bg-white/90 px-0.5 py-px leading-none text-slate-700 hover:bg-white transition-opacity',
                    settings.cellCornerLayout === 'bottom_left' ? 'opacity-0 group-hover:opacity-100' : '',
                  ].join(' ')}
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
                data-pdf-date-block="true"
                className={['absolute z-10 flex items-baseline gap-1 text-right', 'right-2 top-2'].join(' ')}
                style={{
                  top: 1,
                  right: 4,
                  bottom: 'auto',
                  alignSelf: 'flex-start',
                  alignItems: 'baseline',
                  lineHeight: 1,
                  paddingTop: 0,
                  marginTop: 0,
                }}
              >
                {settings.cellDateOrder === 'heb_first' ? (
                  <>
                    <span
                      className="font-medium"
                      style={{
                        fontSize: cellScaledPx(settings.hebDayFontPx),
                        lineHeight: 1,
                        fontWeight: Number((settings as any).hebDayFontWeight ?? 500),
                        display: 'inline-block',
                        transform: `translate(${cellScaledPx(Number((settings as any).hebDayOffsetXPx ?? 0))}px, ${cellScaledPx(
                          Number((settings as any).hebDayOffsetYPx ?? 0),
                        )}px)`,
                        fontFamily: shouldApplyFontTo('cellDates')
                          ? resolveFontFamilyFor('cellDates')
                          : undefined,
                        color: settings.hebDayTextColor,
                        opacity: dateFade,
                      }}
                    >
                      {m.hebDay}
                      {m.hebDay === 'א׳' && m.hebMonth ? (
                        <span className="mr-1 text-[0.75em]" style={{ color: settings.hebDayTextColor, opacity: 0.62 }}>
                          {m.hebMonth}
                        </span>
                      ) : null}
                    </span>
                    <span
                      className="font-semibold"
                      style={{
                        fontSize: cellScaledPx(settings.gregDayFontPx),
                        lineHeight: 1,
                        fontFamily: shouldApplyFontTo('cellDates')
                          ? resolveFontFamilyFor('cellDates')
                          : undefined,
                        fontWeight: Number((settings as any).gregDayFontWeight ?? settings.fontWeight ?? 600),
                        display: 'inline-block',
                        transform: `translate(${cellScaledPx(Number((settings as any).gregDayOffsetXPx ?? 0))}px, ${cellScaledPx(
                          Number((settings as any).gregDayOffsetYPx ?? 0),
                        )}px)`,
                        color: settings.gregDayTextColor,
                        opacity: dateFade,
                      }}
                    >
                      {m.gDay}
                      {m.gDay === 1 ? (
                        <span className="text-[0.75em]" style={{ color: settings.gregDayTextColor, opacity: 0.62 }}>
                          /{m.gMonth}
                        </span>
                      ) : null}
                    </span>
                  </>
                ) : (
                  <>
                    <span
                      className="font-semibold"
                      style={{
                        fontSize: cellScaledPx(settings.gregDayFontPx),
                        lineHeight: 1,
                        fontFamily: shouldApplyFontTo('cellDates')
                          ? resolveFontFamilyFor('cellDates')
                          : undefined,
                        fontWeight: Number((settings as any).gregDayFontWeight ?? settings.fontWeight ?? 600),
                        display: 'inline-block',
                        transform: `translate(${cellScaledPx(Number((settings as any).gregDayOffsetXPx ?? 0))}px, ${cellScaledPx(
                          Number((settings as any).gregDayOffsetYPx ?? 0),
                        )}px)`,
                        color: settings.gregDayTextColor,
                        opacity: dateFade,
                      }}
                    >
                      {m.gDay}
                      {m.gDay === 1 ? (
                        <span className="text-[0.75em]" style={{ color: settings.gregDayTextColor, opacity: 0.62 }}>
                          /{m.gMonth}
                        </span>
                      ) : null}
                    </span>
                    <span
                      className="font-medium"
                      style={{
                        fontSize: cellScaledPx(settings.hebDayFontPx),
                        lineHeight: 1,
                        fontWeight: Number((settings as any).hebDayFontWeight ?? 500),
                        display: 'inline-block',
                        transform: `translate(${cellScaledPx(Number((settings as any).hebDayOffsetXPx ?? 0))}px, ${cellScaledPx(
                          Number((settings as any).hebDayOffsetYPx ?? 0),
                        )}px)`,
                        fontFamily: shouldApplyFontTo('cellDates')
                          ? resolveFontFamilyFor('cellDates')
                          : undefined,
                        color: settings.hebDayTextColor,
                        opacity: dateFade,
                      }}
                    >
                      {m.hebDay}
                      {m.hebDay === 'א׳' && m.hebMonth ? (
                        <span className="mr-1 text-[0.75em]" style={{ color: settings.hebDayTextColor, opacity: 0.62 }}>
                          {m.hebMonth}
                        </span>
                      ) : null}
                    </span>
                  </>
                )}
              </div>

              {m.dstTransitionLabel ? (
                <div
                  className="pointer-events-none absolute left-1 right-1 z-[12] mx-auto max-w-[calc(100%-0.5rem)] rounded border border-amber-300/90 bg-amber-50/95 px-1 py-0.5 text-center leading-tight text-amber-950 shadow-sm"
                  style={{
                    top: datesEndPx + 2,
                    fontSize: Math.max(
                      5,
                      Math.round(Number(settings.eventTitleFontPx) * cellFontScale * 0.22),
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

                const offX =
                  (isEditingThisCell ? editOffsetX : manual?.centerOffsetX ?? 0) +
                  Number((settings as any).eventOffsetXPx ?? 0);
                const offY =
                  (isEditingThisCell ? editOffsetY : manual?.centerOffsetY ?? 0) +
                  Number((settings as any).eventOffsetYPx ?? 0);
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
                const integratedEventsBottomLeft =
                  settings.headerLayoutStyle === 'grid_integrated' && settings.gridIntegratedEventsBottomLeft;
                return (
                  <div
                    className={[
                      'absolute z-[8] flex w-full flex-col items-center px-8 font-semibold',
                      integratedEventsBottomLeft
                        ? 'left-2 right-2 justify-end text-left items-start'
                        : settings.cellCornerLayout === 'bottom_left'
                        ? 'left-2 right-2 justify-start text-right'
                        : tightTitleBand
                          ? 'left-2 right-2 justify-start text-center'
                          : 'left-2 right-2 justify-start text-center',
                      !tightTitleBand && reserveBottomForZmanim ? 'pb-28 sm:pb-32' : '',
                      !tightTitleBand && !reserveBottomForZmanim ? 'pb-10' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={
                      integratedEventsBottomLeft
                        ? {
                            left: 8,
                            right: settings.cellSplitEnabled
                              ? `${Math.round((Number(settings.cellSplitRatio ?? 0.28) || 0.28) * 100)}%`
                              : 8,
                            bottom: undefined,
                            paddingBottom: reserveBottomForZmanim ? '6.75rem' : 10,
                            top: undefined,
                            color: settings.eventTitleTextColor,
                            opacity: dateFade,
                            ...fontSizeStyleAllowUnder10Px(
                              cellScaledPx(settings.eventTitleFontPx),
                              'center center',
                            ),
                            fontFamily: shouldApplyFontTo('cellEvents')
                              ? resolveFontFamilyFor('cellEvents')
                              : undefined,
                          }
                        : settings.cellCornerLayout === 'bottom_left'
                        ? {
                            top: 6,
                            left: 8,
                            right: settings.cellSplitEnabled
                              ? `${Math.round((Number(settings.cellSplitRatio ?? 0.28) || 0.28) * 100)}%`
                              : 8,
                            bottom: undefined,
                            paddingBottom: reserveBottomForZmanim ? '6.75rem' : 8,
                            color: settings.eventTitleTextColor,
                            opacity: dateFade,
                            ...fontSizeStyleAllowUnder10Px(
                              cellScaledPx(settings.eventTitleFontPx),
                              'center center',
                            ),
                            fontFamily: shouldApplyFontTo('cellEvents')
                              ? resolveFontFamilyFor('cellEvents')
                              : undefined,
                          }
                        : tightTitleBand
                          ? {
                              top: centerPaddingTopPx,
                              bottom: undefined,
                              paddingBottom: '6.75rem',
                              color: settings.eventTitleTextColor,
                              opacity: dateFade,
                              ...fontSizeStyleAllowUnder10Px(
                                cellScaledPx(settings.eventTitleFontPx),
                                'center center',
                              ),
                              fontFamily: shouldApplyFontTo('cellEvents')
                                ? resolveFontFamilyFor('cellEvents')
                                : undefined,
                            }
                          : {
                              top: centerPaddingTopPx,
                              left: 8,
                              right: settings.cellSplitEnabled
                                ? `${Math.round((Number(settings.cellSplitRatio ?? 0.28) || 0.28) * 100)}%`
                                : 8,
                              bottom: undefined,
                              paddingBottom: reserveBottomForZmanim ? '6.75rem' : 8,
                              color: settings.eventTitleTextColor,
                              opacity: dateFade,
                              ...fontSizeStyleAllowUnder10Px(
                                cellScaledPx(settings.eventTitleFontPx),
                                'center center',
                              ),
                              fontFamily: shouldApplyFontTo('cellEvents')
                                ? resolveFontFamilyFor('cellEvents')
                                : undefined,
                            }
                    }
                  >
                    <div
                      data-pdf-event-wrap="true"
                      className={`w-full max-w-full shrink-0 break-words ${isExporting ? '' : 'max-h-16 sm:max-h-20'}`}
                      style={{
                        transform: `translate(${offX}px, ${offY}px)`,
                        overflow: 'visible',
                        lineHeight: 1.35,
                        paddingTop: 1,
                        paddingBottom: 2,
                        textAlign: integratedEventsBottomLeft
                          ? 'left'
                          : settings.cellCornerLayout === 'bottom_left'
                            ? 'right'
                            : textAlign,
                      }}
                    >
                      {displayLines.map((ln, idx) => (
                        <div
                          key={idx}
                          className={['w-full'].join(' ')}
                          style={{
                            color: settings.eventTitleTextColor,
                            opacity: idx === 0 ? 1 : 0.92,
                          }}
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
                  className={[
                    settings.cellCornerLayout === 'bottom_left'
                      ? 'absolute bottom-2 right-2 z-20 min-w-0 max-w-[56%] leading-snug text-right space-y-0.5'
                      : 'absolute inset-x-2 bottom-2 z-20 min-w-0 max-w-full leading-snug text-right space-y-0.5',
                  ].join(' ')}
                  style={{
                    color: settings.shabbatTimesTextColor,
                    opacity: dateFade,
                    ...fontSizeStyleAllowUnder10Px(
                      Number(settings.shabbatTimesFontPx) || 0,
                      'bottom right',
                    ),
                    fontFamily: shouldApplyFontTo('cellTimes')
                      ? resolveFontFamilyFor('cellTimes')
                      : undefined,
                  }}
                >
                  <div className="font-normal whitespace-nowrap">
                    <span dir="rtl" style={{ unicodeBidi: 'isolate' }}>
                    {m.isShabbat
                      ? 'יציאת השבת:'
                      : isYomKippurDay(m.titles) || isRoshHashanaDay(m.titles)
                        ? 'כניסה:'
                        : isErevPesach || isErevSheviShelPesach
                          ? 'כניסת החג:'
                          : 'כניסת השבת:'}
                    </span>
                  </div>
                  <HebcalZmanimLine jer={m.candleLightingJer} ta={m.candleLightingTA} />
                </div>
              ) : null}

              {m.isShabbat &&
              ((m.havdalahJer || m.havdalahTA) || (settings.showParsha && m.parshaHe)) ? (
                <div
                  className={[
                    settings.cellCornerLayout === 'bottom_left'
                      ? 'absolute bottom-2 right-2 z-20 min-w-0 max-w-[56%] leading-snug text-right'
                      : 'absolute inset-x-2 bottom-2 z-20 min-w-0 max-w-full leading-snug text-right',
                  ].join(' ')}
                  style={{
                    color: settings.shabbatTimesTextColor,
                    opacity: dateFade,
                    ...fontSizeStyleAllowUnder10Px(
                      Number(settings.shabbatTimesFontPx) || 0,
                      'bottom right',
                    ),
                    fontFamily: shouldApplyFontTo('cellTimes')
                      ? resolveFontFamilyFor('cellTimes')
                      : undefined,
                  }}
                >
                  {settings.showParsha && m.parshaHe ? (
                    <div
                      className="break-words font-semibold"
                      style={{
                        overflow: 'visible',
                        maxHeight: 'none',
                        lineHeight: 1.35,
                        paddingTop: 1,
                        paddingBottom: 2,
                        color: 'inherit',
                      }}
                    >
                      {formatParshaDisplayHe(m.parshaHe)}
                    </div>
                  ) : null}
                  {(m.havdalahJer || m.havdalahTA) ? (
                    <div className="space-y-0.5">
                      <div className="font-normal whitespace-nowrap">
                        <span dir="rtl" style={{ unicodeBidi: 'isolate' }}>
                          {isPesachI || isSheviShelPesach ? 'יציאת החג:' : 'יציאת השבת:'}
                        </span>
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
                  className="absolute inset-x-2 bottom-2 z-20 min-w-0 max-w-full leading-snug text-right space-y-0.5"
                  style={{
                    color: settings.shabbatTimesTextColor,
                    opacity: dateFade,
                    ...fontSizeStyleAllowUnder10Px(
                      Number(settings.shabbatTimesFontPx) || 0,
                      'bottom right',
                    ),
                    fontFamily: shouldApplyFontTo('cellTimes')
                      ? resolveFontFamilyFor('cellTimes')
                      : undefined,
                  }}
                >
                  <div className="font-normal whitespace-nowrap">
                    <span dir="rtl" style={{ unicodeBidi: 'isolate' }}>
                      {isYomKippurDay(m.titles) || isRoshHashanaDay(m.titles)
                        ? 'יציאה:'
                        : 'יציאת החג:'}
                    </span>
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
                        className="absolute inset-x-2 bottom-2 z-[6] min-w-0 max-w-full leading-snug text-right space-y-0.5"
                        style={{
                          color: settings.shabbatTimesTextColor,
                          ...fontSizeStyleAllowUnder10Px(
                            Number(settings.shabbatTimesFontPx) || 0,
                            'bottom right',
                          ),
                          fontFamily: shouldApplyFontTo('cellTimes')
                            ? resolveFontFamilyFor('cellTimes')
                            : undefined,
                        }}
                      >
                        {showAutoFastTitles ? (
                          <div
                            className="mb-1 space-y-0.5 text-center font-semibold leading-tight break-words"
                            style={{
                              fontSize: Math.min(
                                Math.max(1, Number(settings.eventTitleFontPx) || 1),
                                Math.max(1, Number(settings.shabbatTimesFontPx) || 1) + 4,
                              ),
                              color: settings.eventTitleTextColor,
                            }}
                          >
                            {fastTitleLines.slice(0, 3).map((ln, idx) => (
                              <div
                                key={idx}
                                className={idx === 0 ? '' : 'font-semibold'}
                                style={idx === 0 ? undefined : { color: settings.eventTitleTextColor, opacity: 0.92 }}
                              >
                                {abbreviateRoshChodeshHeTitle(ln)}
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {(m.fastBeginsJer || m.fastBeginsTA) ? (
                          <div className="min-w-0">
                            <div className="font-semibold">
                              <span dir="rtl" style={{ unicodeBidi: 'isolate' }}>כניסה:</span>
                            </div>
                            <HebcalZmanimLine
                              variant="fast"
                              jer={m.fastBeginsJer}
                              ta={m.fastBeginsTA}
                            />
                          </div>
                        ) : null}
                        {(m.fastEndsJer || m.fastEndsTA) ? (
                          <div className="min-w-0">
                            <div className="font-semibold">
                              <span dir="rtl" style={{ unicodeBidi: 'isolate' }}>יציאה:</span>
                            </div>
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
        </CalendarContainer>
      </div>
        {/* Category shortcuts (right of canvas, never overlapping) */}
        <div className="flex w-[140px] shrink-0 flex-shrink-0 flex-col gap-2 pt-2">
          {[
            {
              key: 'themes',
              label: 'ערכות צבע',
              cls: 'border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100',
              items: [{ label: 'בורר ערכות צבע', anchorId: 'settings-anchor-themes' }],
            },
            {
              key: 'styles',
              label: 'סגנונות',
              cls: 'border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-100',
              items: [],
            },
            {
              key: 'headerEdit',
              label: 'עריכת פס',
              cls: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900 hover:bg-fuchsia-100',
              items: [{ label: 'פס עליון (חדש)', anchorId: 'settings-anchor-header-new' }],
            },
            // header bar shortcuts removed
            {
              key: 'zmanim',
              label: 'זמנים',
              cls: 'border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100',
              items: [
                { label: 'כללי (Hebcal)', anchorId: 'settings-anchor-zmanim' },
                { label: 'נרות — דקות לפני שקיעה', anchorId: 'settings-anchor-zmanim-candle' },
                { label: 'צאת צומות — שיטה', anchorId: 'settings-anchor-fast-tzait' },
                { label: 'צאת צומות — דקות אחרי שקיעה', anchorId: 'settings-anchor-fast-tzait-offset' },
              ],
            },
            {
              key: 'typography',
              label: 'טיפוגרפיה',
              cls: 'border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100',
              items: [
                { label: 'משפחת גופן (Fallback)', anchorId: 'settings-anchor-typography-family' },
                { label: 'איפה להחיל גופן', anchorId: 'settings-anchor-typography-apply' },
                { label: 'העלאת/מחיקת גופנים', anchorId: 'settings-anchor-typography-upload' },
                { label: 'משקל כללי', anchorId: 'settings-anchor-typography-weight' },
                { label: 'גדלי טקסט בתאים', anchorId: 'settings-anchor-typography-sizes' },
                { label: 'צבע — מספר לועזי', anchorId: 'settings-anchor-typography-color-greg' },
                { label: 'צבע — יום עברי', anchorId: 'settings-anchor-typography-color-heb' },
                { label: 'צבע — שם אירוע', anchorId: 'settings-anchor-typography-color-events' },
                { label: 'צבע — זמנים', anchorId: 'settings-anchor-typography-color-zmanim' },
              ],
            },
            {
              key: 'colors',
              label: 'צבעים',
              cls: 'border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100',
              items: [
                { label: 'ריפוד — צבע בסיס', anchorId: 'settings-anchor-padding-color' },
                { label: 'ריפוד — עוצמה', anchorId: 'settings-anchor-padding-strength' },
                { label: 'מסגרת חיצונית — עובי', anchorId: 'settings-anchor-grid-border-width' },
                { label: 'מסגרת חיצונית — צבע', anchorId: 'settings-anchor-grid-border-color' },
                { label: 'קווי תאים — עובי/צבע', anchorId: 'settings-anchor-borders' },
                { label: 'הצג/הסתר קווי תאים', anchorId: 'settings-anchor-borders-toggle' },
                { label: 'צבעי ימים (אירועים/שבת/היום)', anchorId: 'settings-anchor-colors' },
                { label: 'אירועים', anchorId: 'settings-anchor-colors-event' },
                { label: 'שבת', anchorId: 'settings-anchor-colors-shabbat' },
                { label: 'היום', anchorId: 'settings-anchor-colors-today' },
              ],
            },
            {
              key: 'weekdays',
              label: 'ימי שבוע',
              cls: 'border-teal-200 bg-teal-50 text-teal-900 hover:bg-teal-100',
              items: [
                { label: 'פורמט (מקוצר/מלא)', anchorId: 'settings-anchor-weekdays-mode' },
                { label: 'רקע הפס', anchorId: 'settings-anchor-weekdays-bg' },
                { label: 'גובה הפס', anchorId: 'settings-anchor-weekdays-height' },
                { label: 'הזזת טקסט', anchorId: 'settings-anchor-weekdays-text-offset' },
                { label: 'צבע טקסט', anchorId: 'settings-anchor-weekdays-text-color' },
                { label: 'גודל/משקל גופן', anchorId: 'settings-anchor-weekdays-font' },
                { label: 'קו תחתון (עובי/צבע)', anchorId: 'settings-anchor-weekdays-underline' },
                { label: 'היסט אנכי לפס', anchorId: 'settings-anchor-weekdays-row-offset' },
              ],
            },
            {
              key: 'export',
              label: 'ייצוא',
              cls: 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100',
              items: [
                { label: 'כללי ייצוא', anchorId: 'settings-anchor-export' },
                { label: 'גודל עמוד (A4/A5/מותאם)', anchorId: 'settings-anchor-export-page' },
                { label: 'כיוון עמוד', anchorId: 'settings-anchor-export-orientation' },
                { label: 'שוליים', anchorId: 'settings-anchor-export-margin' },
              ],
            },
            {
              key: 'background',
              label: 'רקע/קנבס',
              cls: 'border-indigo-200 bg-indigo-50 text-indigo-900 hover:bg-indigo-100',
              items: [
                { label: 'תמונת רקע', anchorId: 'settings-anchor-background' },
                { label: 'מצב תמונה (שנה/חודש)', anchorId: 'settings-anchor-background-mode' },
                { label: 'העלאת תמונה', anchorId: 'settings-anchor-background-upload' },
                { label: 'הסרה/איפוס רקע', anchorId: 'settings-anchor-background-remove' },
                { label: 'אטימות רקע', anchorId: 'settings-anchor-background-opacity' },
                { label: 'מידות קנבס', anchorId: 'settings-anchor-canvas-surface' },
                { label: 'מתח למילוי (Auto‑fit)', anchorId: 'settings-anchor-canvas-autofit' },
                { label: 'מלא גובה', anchorId: 'settings-anchor-canvas-fillheight' },
                { label: 'זום לוח', anchorId: 'settings-anchor-canvas-zoom' },
                { label: 'מרכוז אנכי', anchorId: 'settings-anchor-canvas-center' },
                { label: 'ריפוד קנבס', anchorId: 'settings-anchor-canvas-padding' },
                { label: 'מסגרת קנבס', anchorId: 'settings-anchor-canvas-border' },
              ],
            },
            {
              key: 'manual',
              label: settings.enableManualEdits && settings.showEditButtonInCells
                ? 'סגור עריכה ידנית'
                : 'ערוך עריכה ידנית',
              cls: 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50',
              items: [],
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
                  if (b.key === 'manual') {
                    setSettings((s) => {
                      const on = !(s.enableManualEdits && s.showEditButtonInCells);
                      return {
                        ...s,
                        enableManualEdits: on,
                        showEditButtonInCells: on,
                      };
                    });
                    setShortcutOpen(null);
                    setSettingsOpen(false);
                    return;
                  }
                  // headerDrag removed
                  setShortcutOpen((prev) => (prev === b.key ? null : b.key));
                }}
              >
                <span className="truncate">{b.label}</span>
              </button>
              {shortcutOpen === b.key && (b.items.length > 0 || b.key === 'styles') ? (
                <div
                  className={[
                    'absolute top-0 z-30 w-[260px] rounded-md border border-slate-200 bg-white shadow-lg overflow-hidden',
                    // Open the submenu to the left of the sidebar (so it never covers the list below).
                    'right-full mr-2',
                  ].join(' ')}
                >
                  {b.key === 'styles' ? (
                    <div className="max-h-[360px] overflow-auto p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-slate-900">סגנונות שמורים</div>
                        <button
                          type="button"
                          className="h-8 w-8 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          aria-label="סגור סגנונות"
                          onClick={() => setShortcutOpen(null)}
                        >
                          ✕
                        </button>
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        שמור והחל את כל ההגדרות בלחיצה אחת.
                      </div>

                      <div className="mt-3 flex flex-col gap-2">
                        <input
                          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                          placeholder="שם סגנון"
                          value={stylePresetName}
                          onChange={(e) => setStylePresetName(e.target.value)}
                        />
                        <button
                          type="button"
                          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                          onClick={() => {
                            const name = stylePresetName.trim();
                            if (!name) {
                              setSaveFlash('אנא כתוב שם לסגנון.');
                              window.setTimeout(() => setSaveFlash(null), 1800);
                              return;
                            }
                            const now = Date.now();
                            const p: StylePreset = {
                              id: createPresetId(),
                              name,
                              createdAt: now,
                              updatedAt: now,
                              settings,
                            };
                            setStylePresets((items) => [p, ...items]);
                            setStylePresetSelectedId(p.id);
                            setStylePresetName('');
                            setSaveFlash('הסגנון נשמר');
                            window.setTimeout(() => setSaveFlash(null), 1500);
                          }}
                        >
                          שמור כסגנון חדש
                        </button>
                      </div>

                      <div className="mt-3">
                        {stylePresets.length ? (
                          <>
                            <select
                              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                              value={stylePresetSelectedId ?? ''}
                              onChange={(e) => setStylePresetSelectedId(e.target.value || null)}
                            >
                              {stylePresets.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>

                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                                onClick={() => {
                                  const p = stylePresets.find((x) => x.id === stylePresetSelectedId);
                                  if (!p) return;
                                  try {
                                    const changed = JSON.stringify(settings) !== JSON.stringify(p.settings);
                                    if (changed) {
                                      const ok = window.confirm(
                                        `שמת לב: יש שינויים ביחס לסגנון "${p.name}".\n\nלעדכן את הסגנון לפי ההגדרות הנוכחיות (במקום להחזיר אחורה)?`,
                                      );
                                      if (ok) {
                                        const now = Date.now();
                                        setStylePresets((items) =>
                                          items.map((x) => (x.id === p.id ? { ...x, updatedAt: now, settings } : x)),
                                        );
                                        setSaveFlash('הסגנון עודכן');
                                        window.setTimeout(() => setSaveFlash(null), 1500);
                                        return;
                                      }
                                    }
                                  } catch {
                                    // ignore
                                  }
                                  applyStylePreset(p);
                                }}
                              >
                                החל עיצוב
                              </button>
                              <button
                                type="button"
                                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                                onClick={() => {
                                  const p = stylePresets.find((x) => x.id === stylePresetSelectedId);
                                  if (!p) return;
                                  try {
                                    const changed = JSON.stringify(settings) !== JSON.stringify(p.settings);
                                    if (changed) {
                                      const ok = window.confirm(
                                        `שמת לב: יש שינויים ביחס לסגנון "${p.name}".\n\nלעדכן את הסגנון לפי ההגדרות הנוכחיות (במקום להחזיר אחורה)?`,
                                      );
                                      if (ok) {
                                        const now = Date.now();
                                        setStylePresets((items) =>
                                          items.map((x) => (x.id === p.id ? { ...x, updatedAt: now, settings } : x)),
                                        );
                                        setSaveFlash('הסגנון עודכן');
                                        window.setTimeout(() => setSaveFlash(null), 1500);
                                        return;
                                      }
                                    }
                                  } catch {
                                    // ignore
                                  }
                                  applyStylePresetAll(p);
                                }}
                                title="כולל פונטים וגדלים"
                              >
                                החל הכל
                              </button>
                              {stylePresetUndo ? (
                                <button
                                  type="button"
                                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                                  onClick={() => {
                                    setSettings(stylePresetUndo);
                                    setStylePresetUndo(null);
                                    setSaveFlash('חזרה לסגנון הקודם');
                                    window.setTimeout(() => setSaveFlash(null), 1500);
                                  }}
                                  title="Undo"
                                >
                                  חזור
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                                onClick={() => {
                                  const p = stylePresets.find((x) => x.id === stylePresetSelectedId);
                                  if (!p) return;
                                  if (!window.confirm(`לעדכן את הסגנון \"${p.name}\" לפי ההגדרות הנוכחיות?`))
                                    return;
                                  const now = Date.now();
                                  setStylePresets((items) =>
                                    items.map((x) =>
                                      x.id === p.id ? { ...x, updatedAt: now, settings } : x,
                                    ),
                                  );
                                  setSaveFlash('הסגנון עודכן');
                                  window.setTimeout(() => setSaveFlash(null), 1500);
                                }}
                              >
                                עדכן
                              </button>
                              <button
                                type="button"
                                className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 hover:bg-rose-100"
                                onClick={() => {
                                  const p = stylePresets.find((x) => x.id === stylePresetSelectedId);
                                  if (!p) return;
                                  if (!window.confirm(`למחוק את הסגנון \"${p.name}\"?`)) return;
                                  setStylePresets((items) => {
                                    const next = items.filter((x) => x.id !== p.id);
                                    setStylePresetSelectedId((cur) =>
                                      cur === p.id ? (next[0]?.id ?? null) : cur,
                                    );
                                    return next;
                                  });
                                  setSaveFlash('הסגנון נמחק');
                                  window.setTimeout(() => setSaveFlash(null), 1500);
                                }}
                              >
                                מחק
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-slate-600">אין עדיין סגנונות שמורים.</div>
                        )}
                      </div>
                    </div>
                  ) : (
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
                  )}
                </div>
              ) : null}
            </div>
          ))}
          <div className="relative w-full">
            <button
              type="button"
              className="w-full text-right px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50 transition shadow-sm"
              onClick={() => setColorPaletteOpen((v) => !v)}
            >
              <span className="truncate">פלטת צבעים</span>
            </button>
          </div>
          <div className="relative w-full mt-2">
            <button
              type="button"
              className="w-full text-right px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50 transition shadow-sm"
              onClick={() => {
                setImageSamplerOpen(true);
                setSaveFlash('פתחתי חלון “דגימה מתמונה”. לחץ “בחר” כדי להעלות תמונה.');
                window.setTimeout(() => setSaveFlash(null), 2200);
              }}
            >
              <span className="truncate">דגימה מתמונה</span>
            </button>
          </div>
          <button
            type="button"
            className="mt-2 w-full text-right px-3 py-2 text-sm rounded-md border border-slate-200 bg-slate-900 text-white hover:bg-slate-800 transition"
            onClick={() => {
              setSettingsOpen(false);
              setShortcutOpen(null);
              setColorPaletteOpen(false);
            }}
          >
            סגור עריכה
          </button>
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
                      <label className="text-sm text-slate-700 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={applyCellImageGlobally}
                          onChange={(e) => setApplyCellImageGlobally(Boolean(e.target.checked))}
                        />
                        החל על התאים האפורים בכל החודשים (ברירת מחדל)
                      </label>
                      <button
                        type="button"
                        className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                        onClick={() => {
                          if (!editKey) return;
                          pendingImageGlobalRef.current = applyCellImageGlobally;
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
                              const storeKey = applyCellImageGlobally ? GLOBAL_CELL_IMAGE_KEY : recurringOverrideKeyFromIsoDate(editKey);
                              const cur =
                                (applyCellImageGlobally ? copy[GLOBAL_CELL_IMAGE_KEY] : resolveDayTextOverride(copy, editKey)) ??
                                copy[storeKey];
                              if (!cur) return copy;
                              copy[storeKey] = applyCellImageGlobally
                                ? { ...cur, imageDataUrl: undefined }
                                : { ...cur, imageDataUrl: undefined, imageDisabled: true };
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
                              const storeKey = applyCellImageGlobally ? GLOBAL_CELL_IMAGE_KEY : recurringOverrideKeyFromIsoDate(editKey);
                              const cur =
                                (applyCellImageGlobally ? copy[GLOBAL_CELL_IMAGE_KEY] : resolveDayTextOverride(copy, editKey)) ??
                                copy[storeKey];
                              if (!cur) return copy;
                              copy[storeKey] = { ...cur, imageFit: fit, imageDisabled: applyCellImageGlobally ? false : cur.imageDisabled };
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
                              const storeKey = applyCellImageGlobally ? GLOBAL_CELL_IMAGE_KEY : recurringOverrideKeyFromIsoDate(editKey);
                              const cur =
                                (applyCellImageGlobally ? copy[GLOBAL_CELL_IMAGE_KEY] : resolveDayTextOverride(copy, editKey)) ??
                                copy[storeKey];
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
        onSelectTheme={(id) =>
          setSettings((s) => mergeStyleOnlySettings(s, applyDesignThemeId(s, id)))
        }
      />
      <StylePackModal
        open={stylePackOpen}
        currentStylePackId={settings.stylePackId}
        onClose={() => setStylePackOpen(false)}
        onSelectTheme={(id) => setSettings((s) => mergeStyleOnlySettings(s, applyStylePackId(s, id)))}
      />

      {exportStyleOpen ? (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={() => setExportStyleOpen(false)}
        >
          <div
            className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div className="font-normal text-slate-900">ייצוא סגנון (JSON)</div>
              <div className="flex items-center gap-2">
                {exportStyleCopied ? (
                  <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-md">
                    {exportStyleCopied}
                  </div>
                ) : null}
                <button
                  type="button"
                  className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                  onClick={() => setExportStyleOpen(false)}
                >
                  סגור
                </button>
              </div>
            </div>

            <div className="px-4 py-3">
              <p className="text-xs text-slate-600 mb-2">
                העתק את ה‑JSON הזה והדבק ב‑Display תחת “ייבוא סגנון”.
              </p>
              <textarea
                className="w-full min-h-[280px] rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-900"
                value={exportStyleJson}
                readOnly
                spellCheck={false}
                onFocus={(e) => e.currentTarget.select()}
              />
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(exportStyleJson);
                      setExportStyleCopied('הועתק ללוח');
                      window.setTimeout(() => setExportStyleCopied(null), 1400);
                    } catch {
                      // ignore
                    }
                  }}
                >
                  העתק ללוח
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {importStyleOpen ? (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={() => setImportStyleOpen(false)}
        >
          <div
            className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-lg"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div className="font-semibold text-slate-900">ייבוא סגנון (JSON)</div>
              <button
                type="button"
                className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                onClick={() => setImportStyleOpen(false)}
              >
                סגור
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-sm text-slate-700">
                הדבק כאן JSON של <span className="font-mono">{"{ settings, overrides, fonts }"}</span> (כמו שנוצר ב־“ייצוא
                סגנון”).
              </div>
              <textarea
                className="w-full min-h-[260px] rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-900"
                value={importStyleJson}
                onChange={(e) => setImportStyleJson(e.target.value)}
                spellCheck={false}
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="px-3 py-2 text-sm rounded-md border border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                  onClick={async () => {
                    try {
                      const parsed = JSON.parse(importStyleJson || '{}') as any;
                      const nextSettings = parsed?.settings;
                      const nextOverrides = parsed?.overrides;
                      const nextFonts = parsed?.fonts;
                      if (!nextSettings || typeof nextSettings !== 'object') {
                        window.alert('JSON לא כולל settings תקין.');
                        return;
                      }
                      await importTransferFonts(nextFonts);
                      setSettings((_) => ({ ...DEFAULT_SETTINGS, ...(nextSettings as any) } as any));
                      setOverrides((_) => (nextOverrides && typeof nextOverrides === 'object' ? (nextOverrides as any) : {}));
                      try {
                        saveSettings({ ...DEFAULT_SETTINGS, ...(nextSettings as any) } as any);
                        saveOverrides(
                          nextOverrides && typeof nextOverrides === 'object' ? (nextOverrides as any) : ({} as any),
                        );
                      } catch {
                        // ignore
                      }
                      setImportStyleOpen(false);
                      setSaveFlash('הסגנון יובא');
                      window.setTimeout(() => setSaveFlash(null), 1400);
                    } catch (e: any) {
                      window.alert(`ייבוא נכשל: ${String(e?.message ?? e)}`);
                    }
                  }}
                >
                  החל סגנון
                </button>
                <button
                  type="button"
                  className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                  onClick={async () => {
                    try {
                      const t = await navigator.clipboard.readText();
                      setImportStyleJson(t || '');
                    } catch {
                      // ignore
                    }
                  }}
                  title="הדבק מהלוח"
                >
                  הדבק מהלוח
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

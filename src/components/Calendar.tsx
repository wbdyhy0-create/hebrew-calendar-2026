import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDays,
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
import { downloadPdfFromHtml } from '../utils/pdf';
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
import { applyDesignThemeId, getThemeEntry } from '../themes/calendarThemes';
import { ThemePickerModal } from './ThemePickerModal';
import {
  DEFAULT_HEADER_WYSIWYG_CLASSIC_ALIGN,
  DEFAULT_HEADER_WYSIWYG_CLASSIC_PCT,
} from '../utils/headerWysiwyg';
import { CalendarMonthChrome } from './CalendarMonthChrome';
import { SettingsCategory } from './SettingsCategory';
import { SettingsSearchBar } from './SettingsSearchBar';
import { HebcalZmanimLine } from './HebcalZmanimLine';

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
  const [bgMonthIdx, setBgMonthIdx] = useState<number>(() => new Date().getMonth());
  const [themePickerOpen, setThemePickerOpen] = useState(false);
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

  return (
    <section
      dir="rtl"
      className="relative w-full max-w-6xl mx-auto p-4 sm:p-6 bg-white"
      style={{
        fontFamily: settings.fontFamily,
        fontSize: settings.fontSizePx,
        fontWeight: settings.fontWeight,
      }}
    >
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
          <div className="text-xs font-semibold text-slate-700 mb-2">עריכה מהירה</div>
          <div className="flex flex-col gap-3">
            {INSPECT_ACTIONS[inspect.key].map((sec) => (
              <div key={sec.title} className="rounded-lg border border-slate-200 bg-white/80 p-2">
                <div className="text-[11px] font-bold text-slate-700 mb-2">{sec.title}</div>
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
      <header className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="text-right">
          <p className="text-xs sm:text-sm text-slate-500">
            {gMonthDays} ימים בחודש (לועזי)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-end">
          <button
            type="button"
            onClick={() => setThemePickerOpen(true)}
            className="px-3 py-2 text-sm rounded-md border border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100 active:bg-violet-100/80 transition"
          >
            ערכות עיצוב
          </button>

          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 transition"
          >
            הגדרות עיצוב
          </button>

          <button
            type="button"
            onClick={async () => {
              try {
                setSaveFlash('מכין PDF…');
                const html = buildPrintableMonthHtml(viewDate, settings, overrides, {
                  location: 'Jerusalem',
                });
                await downloadPdfFromHtml(`calendar-${format(viewDate, 'yyyy-MM')}.pdf`, html, settings);
                setSaveFlash('ה‑PDF ירד');
                window.setTimeout(() => setSaveFlash(null), 1400);
              } catch (e) {
                const msg = e instanceof Error ? e.message : 'שגיאה לא ידועה';
                setSaveFlash(`שגיאה בהורדת PDF: ${msg}`);
                window.setTimeout(() => setSaveFlash(null), 3500);
                // eslint-disable-next-line no-console
                console.error(e);
              }
            }}
            className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 transition"
          >
            הורד חודש PDF
          </button>

          <button
            type="button"
            onClick={() => {
              const html = buildPrintableMonthHtml(viewDate, settings, overrides, {
                location: 'Jerusalem',
              });
              // Print via hidden iframe (no popups; closest to Chrome's native layout engine).
              const iframe = document.createElement('iframe');
              iframe.style.position = 'fixed';
              iframe.style.left = '0';
              iframe.style.top = '0';
              iframe.style.width = '100%';
              iframe.style.height = '100%';
              iframe.style.opacity = '0';
              iframe.style.pointerEvents = 'none';
              iframe.style.zIndex = '-1';
              iframe.setAttribute('aria-hidden', 'true');
              iframe.srcdoc = html;
              document.body.appendChild(iframe);

              const cleanup = () => {
                try {
                  iframe.remove();
                } catch {
                  // ignore
                }
              };

              iframe.onload = () => {
                try {
                  const w = iframe.contentWindow;
                  if (!w) return cleanup();
                  w.focus();
                  w.print();
                  // remove after print dialog opens
                  setTimeout(cleanup, 2000);
                } catch {
                  cleanup();
                }
              };
            }}
            className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 transition"
          >
            הדפס / שמור כ‑PDF (Chrome)
          </button>

          <button
            type="button"
            onClick={async () => {
              try {
                setSaveFlash('מכין PDF של שנה…');
                const year = viewDate.getFullYear();
                const html = buildPrintableYearPdfHtml(year, settings, overrides);
                await downloadPdfFromHtml(`calendar-${year}.pdf`, html, settings, { multiPage: true });
                setSaveFlash('ה‑PDF ירד');
                window.setTimeout(() => setSaveFlash(null), 1600);
              } catch (e) {
                const msg = e instanceof Error ? e.message : 'שגיאה לא ידועה';
                setSaveFlash(`שגיאה בהורדת PDF: ${msg}`);
                window.setTimeout(() => setSaveFlash(null), 3500);
                // eslint-disable-next-line no-console
                console.error(e);
              }
            }}
            className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 transition"
          >
            הורד שנה PDF
          </button>

          <button
            type="button"
            onClick={() => setViewDate((d) => addMonths(d, 12))}
            className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 transition"
          >
            שנה הבאה
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
          <button
            type="button"
            onClick={() => setViewDate((d) => addMonths(d, -12))}
            className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 transition"
          >
            שנה קודמת
          </button>

          <div className="w-px h-7 bg-slate-200 mx-1" aria-hidden="true" />

          <button
            type="button"
            onClick={() => setViewDate((d) => addDays(d, 7))}
            className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 transition"
          >
            שבוע הבא
          </button>
          <button
            type="button"
            onClick={() => setViewDate((d) => addDays(d, -7))}
            className="px-3 py-2 text-sm rounded-md border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 transition"
          >
            שבוע קודם
          </button>
        </div>
      </header>

      {settingsOpen && (
        <div className="relative mb-4 flex max-h-[min(92vh,940px)] flex-col rounded-xl border border-slate-200 bg-white/95 shadow-sm sm:max-h-[min(88vh,900px)]">
          <div className="sticky top-0 z-20 shrink-0 border-b border-slate-200/90 bg-white/95 backdrop-blur-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 sm:px-4">
              <div className="font-semibold text-slate-900">עיצוב</div>
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
            <SettingsCategory icon="📁" title="ערכות נושא ומבנה כותרת">
            <div
              id="settings-anchor-themes"
              className="sm:col-span-2 lg:col-span-3 scroll-mt-24 rounded-lg border border-violet-100 bg-violet-50/50 p-3"
            >
              <div className="text-sm font-semibold text-slate-900">ערכות עיצוב מוכנות</div>
              <p className="mt-1 text-xs text-slate-600">
                12 סגנונות לפס הכותרת והטבלה. תמונות רקע, זמנים ו־PDF נשמרים מהגדרות נפרדות.
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
                  <span className="font-semibold text-slate-700">
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
                ערכות עיצוב יכולות לקבוע מבנה ברירת מחדל; כאן אפשר לעקוף ידנית.
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
            <label className="text-sm text-slate-700">
              משפחת גופן
              <select
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
                value={settings.fontFamily}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, fontFamily: e.target.value }))
                }
              >
                <option value={DEFAULT_SETTINGS.fontFamily}>ברירת מחדל</option>
                <option value='"Heebo", system-ui, "Segoe UI", Arial, sans-serif'>
                  Heebo (אם מותקן)
                </option>
                <option value='"Assistant", system-ui, "Segoe UI", Arial, sans-serif'>
                  Assistant (אם מותקן)
                </option>
                <option value='system-ui, -apple-system, "Segoe UI", Arial, sans-serif'>
                  System
                </option>
                <option value='Georgia, "Times New Roman", serif'>Serif</option>
              </select>
            </label>

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
                      style={{ fontSize: scaledPx(settings.gregDayFontPx), lineHeight: 1 }}
                    >
                      14
                    </span>
                    <span
                      className="font-semibold"
                      style={{ fontSize: scaledPx(settings.hebDayFontPx), lineHeight: 1 }}
                    >
                      י״ד
                    </span>
                  </div>

                  {/* Center event text */}
                  <div className="absolute inset-0 flex items-center justify-center px-5">
                    <div
                      className="w-full text-center font-bold text-slate-800"
                      style={{ fontSize: scaledPx(settings.eventTitleFontPx), lineHeight: 1.15 }}
                    >
                      ערב פסח
                    </div>
                  </div>

                  {/* Bottom zmanim block (same idea/placement as the real cell) */}
                  <div
                    className="absolute inset-x-2 bottom-2 z-20 min-w-0 max-w-full leading-snug text-slate-800 text-right space-y-0.5"
                    style={{ fontSize: scaledPx(settings.shabbatTimesFontPx) }}
                  >
                    <div className="font-extrabold text-slate-900 whitespace-nowrap">
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
                <label className="text-sm text-slate-700">
                  צבע בסיס (אפור)
                  <input
                    className="mt-1 w-full h-10 rounded-md border border-slate-200 bg-white px-2"
                    type="color"
                    value={settings.paddingCellColor}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        paddingCellColor: e.target.value,
                      }))
                    }
                  />
                </label>

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

            <label className="text-sm text-slate-700">
              צבע מסגרת חיצונית
              <input
                className="mt-1 w-full h-10 rounded-md border border-slate-200 bg-white px-2"
                type="color"
                value={settings.gridBorderColor}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    gridBorderColor: e.target.value,
                  }))
                }
              />
            </label>

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

            <label className="text-sm text-slate-700">
              צבע רקע פס ימי השבוע
              <input
                className="mt-1 w-full h-10 rounded-md border border-slate-200 bg-white px-2"
                type="color"
                value={settings.gridWeekdayHeaderBg}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    gridWeekdayHeaderBg: e.target.value,
                  }))
                }
              />
            </label>

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

            <label className="text-sm text-slate-700">
              צבע טקסט כותרות ימי השבוע
              <input
                className="mt-1 w-full h-10 rounded-md border border-slate-200 bg-white px-2"
                type="color"
                value={settings.gridWeekdayHeaderTextColor}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    gridWeekdayHeaderTextColor: e.target.value,
                  }))
                }
              />
            </label>

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

            <label className="text-sm text-slate-700">
              צבע קו תחתון לפס ימי השבוע
              <input
                className="mt-1 w-full h-10 rounded-md border border-slate-200 bg-white px-2"
                type="color"
                value={settings.gridWeekdayHeaderBorderBottomColor}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    gridWeekdayHeaderBorderBottomColor: e.target.value,
                  }))
                }
              />
            </label>

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

            <label className="text-sm text-slate-700">
              צבע קווי תאים
              <input
                className="mt-1 w-full h-10 rounded-md border border-slate-200 bg-white px-2"
                type="color"
                value={settings.cellBorderColor}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    cellBorderColor: e.target.value,
                  }))
                }
              />
            </label>

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

            <label className="text-sm text-slate-700">
              צבע אירועים (חגים/ר״ח/יום העצמאות וכו׳)
              <div id="settings-anchor-colors" className="scroll-mt-24" />
              <input
                className="mt-1 w-full h-10 rounded-md border border-slate-200 bg-white px-2"
                type="color"
                value={settings.eventBg}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, eventBg: e.target.value }))
                }
              />
            </label>

            <label className="text-sm text-slate-700">
              צבע שבת
              <input
                className="mt-1 w-full h-10 rounded-md border border-slate-200 bg-white px-2"
                type="color"
                value={settings.shabbatBg}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, shabbatBg: e.target.value }))
                }
              />
            </label>

            <label className="text-sm text-slate-700">
              צבע “היום”
              <input
                className="mt-1 w-full h-10 rounded-md border border-slate-200 bg-white px-2"
                type="color"
                value={settings.todayBg}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, todayBg: e.target.value }))
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
            <label className="text-sm text-slate-700">
              צבע רקע פס
              <input
                className="mt-1 w-full h-10 rounded-md border border-slate-200 bg-white px-2"
                type="color"
                value={
                  (settings.headerBarBg ?? '').startsWith('#')
                    ? (settings.headerBarBg as string)
                    : '#FFFFFF'
                }
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    headerBarBg: e.target.value,
                  }))
                }
              />
              <div className="mt-1 text-xs text-slate-500">
                שים לב: בחירת צבע תחליף לרקע אטום (לא שקוף).
              </div>
            </label>

            <label className="text-sm text-slate-700">
              צבע מסגרת פס
              <input
                className="mt-1 w-full h-10 rounded-md border border-slate-200 bg-white px-2"
                type="color"
                value={settings.headerBarBorderColor}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    headerBarBorderColor: e.target.value,
                  }))
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
                  setSettings((s) => ({
                    ...s,
                    headerBarBorderWidthPx: Number(e.target.value),
                  }))
                }
              />
            </label>

            <label className="text-sm text-slate-700">
              צבע כותרת ראשית
              <input
                className="mt-1 w-full h-10 rounded-md border border-slate-200 bg-white px-2"
                type="color"
                value={settings.headerBarTitleColor}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    headerBarTitleColor: e.target.value,
                  }))
                }
              />
            </label>

            <label className="text-sm text-slate-700">
              צבע כותרת משנה
              <input
                className="mt-1 w-full h-10 rounded-md border border-slate-200 bg-white px-2"
                type="color"
                value={settings.headerBarSubtitleColor}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    headerBarSubtitleColor: e.target.value,
                  }))
                }
              />
            </label>

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

            <label className="text-sm text-slate-700">
              צבע טקסט לועזי
              <input
                className="mt-1 w-full h-10 rounded-md border border-slate-200 bg-white px-2"
                type="color"
                value={settings.headerGregMonthTextColor}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    headerGregMonthTextColor: e.target.value,
                  }))
                }
              />
            </label>

            <label className="text-sm text-slate-700">
              צבע מסגרת תג עברי (מרכז)
              <input
                className="mt-1 w-full h-10 rounded-md border border-slate-200 bg-white px-2"
                type="color"
                value={settings.headerHebMonthBorderColor}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    headerHebMonthBorderColor: e.target.value,
                  }))
                }
              />
            </label>

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

            <label className="text-sm text-slate-700">
              רקע תג עברי (מרכז)
              <input
                className="mt-1 w-full h-10 rounded-md border border-slate-200 bg-white px-2"
                type="color"
                value={
                  (settings.headerHebMonthBg ?? '').startsWith('#')
                    ? (settings.headerHebMonthBg as string)
                    : '#FFFFFF'
                }
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    headerHebMonthBg: e.target.value,
                  }))
                }
              />
              <div className="mt-1 text-xs text-slate-500">
                שים לב: בחירת צבע תחליף לרקע אטום (לא שקוף).
              </div>
            </label>

            <label className="text-sm text-slate-700">
              צבע טקסט תג עברי (מרכז)
              <input
                className="mt-1 w-full h-10 rounded-md border border-slate-200 bg-white px-2"
                type="color"
                value={settings.headerHebMonthTextColor}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    headerHebMonthTextColor: e.target.value,
                  }))
                }
              />
            </label>

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
              צבע מסגרת קנבס
              <input
                className="mt-1 w-full h-10 rounded-md border border-slate-200 bg-white px-2"
                type="color"
                value={settings.canvasBorderColor}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    canvasBorderColor: e.target.value,
                  }))
                }
              />
            </label>
            </SettingsCategory>
          </div>
        </div>
      )}

      {/* Ornamental canvas around the table — גודל כמו עמוד PDF (ברירת מחדל A4 לרוחב) */}
      <div
        className={[
          'relative mx-auto shadow-sm',
          settings.layoutAutoFitToCanvas ? 'overflow-hidden' : 'overflow-auto',
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
                onClick={() => {
                  if (!settings.enableManualEdits) return;
                  pickImageForCell(m.gKey);
                }}
              >
                {manual?.imageDataUrl ? (
                  <>
                    <img
                      src={manual.imageDataUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full"
                      style={{
                        objectFit: manual.imageFit ?? 'cover',
                        objectPosition: `calc(50% + ${(Number(manual.imageOffsetX) || 0).toFixed(
                          1,
                        )}px) calc(50% + ${(Number(manual.imageOffsetY) || 0).toFixed(1)}px)`,
                        opacity:
                          typeof manual.imageOpacity === 'number' ? manual.imageOpacity : 1,
                        cursor: settings.enableManualEdits ? 'grab' : undefined,
                      }}
                      draggable={false}
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

          const gregPx = Math.max(1, Number(settings.gregDayFontPx) || 12);
          const hebPx = Math.max(1, Number(settings.hebDayFontPx) || 12);
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
                  <img
                    src={manual.imageDataUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full"
                    style={{
                      objectFit: manual.imageFit ?? 'cover',
                      objectPosition: `calc(50% + ${(Number(manual.imageOffsetX) || 0).toFixed(
                        1,
                      )}px) calc(50% + ${(Number(manual.imageOffsetY) || 0).toFixed(1)}px)`,
                      opacity:
                        typeof manual.imageOpacity === 'number' ? manual.imageOpacity : 1,
                      cursor: settings.enableManualEdits ? 'grab' : undefined,
                    }}
                    draggable={false}
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
                    fontSize: scaledPx(settings.gregDayFontPx),
                    lineHeight: 1,
                  }}
                >
                  {m.gDay}
                  {m.gDay === 1 ? (
                    <span className="text-[0.75em] text-slate-500">/{m.gMonth}</span>
                  ) : null}
                </span>
                <span
                  className="font-medium text-slate-700"
                  style={{ fontSize: scaledPx(settings.hebDayFontPx), lineHeight: 1 }}
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
                    fontSize: Math.max(1, Math.round(Number(settings.eventTitleFontPx) * 0.55)),
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
                            fontSize: scaledPx(settings.eventTitleFontPx),
                          }
                        : {
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            fontSize: scaledPx(settings.eventTitleFontPx),
                            paddingTop:
                              centerPaddingTopPx +
                              (hasFast ? Math.round(Number(settings.eventTitleFontPx) * 0.2) : 0),
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
                  style={{ fontSize: scaledPx(settings.shabbatTimesFontPx) }}
                >
                  <div className="font-extrabold text-slate-900 whitespace-nowrap">
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
                  style={{ fontSize: scaledPx(settings.shabbatTimesFontPx) }}
                >
                  {settings.showParsha && m.parshaHe ? (
                    <div className="line-clamp-2 break-words font-semibold text-slate-900 leading-tight">
                      {formatParshaDisplayHe(m.parshaHe)}
                    </div>
                  ) : null}
                  {(m.havdalahJer || m.havdalahTA) ? (
                    <div className="space-y-0.5">
                      <div className="font-extrabold text-slate-900 whitespace-nowrap">
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
                  style={{ fontSize: scaledPx(settings.shabbatTimesFontPx) }}
                >
                  <div className="font-extrabold text-slate-900 whitespace-nowrap">
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
                        style={{ fontSize: scaledPx(settings.shabbatTimesFontPx) }}
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
    </section>
  );
}


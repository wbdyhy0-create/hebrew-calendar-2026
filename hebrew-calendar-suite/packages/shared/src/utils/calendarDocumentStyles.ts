/**
 * Shared layout/typography tokens for the on-screen calendar and printable HTML/PDF.
 * Keep pixel math here so UI and export stay aligned when sliders or themes change.
 */
import type { CalendarSettings, HeaderLayoutStyle } from './settings';
import { HEADER_DATE_SEPARATOR_BASELINE_Y_PX } from './settings';
import { calendarSurfaceDimensionsPx } from './pdfPage';

/** Horizontal padding inside the classic header bar (Tailwind `px-6` at sm). */
export const DOCUMENT_HEADER_BAR_INLINE_PAD_PX = 24;

/**
 * Google Fonts stack aligned with `index.html` (+ Heebo from default `fontFamily`).
 * Injected into printable HTML; `downloadPdfFromHtml` also copies these `<link>` nodes
 * into `document.head` so html2canvas resolves the same faces as the live preview.
 */
export const CALENDAR_PRINT_FONT_LINKS_HTML = `
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;600;700;800&family=Assistant:wght@400;600;700&family=David+Libre:wght@400;700&family=Frank+Ruhl+Libre:wght@400;700&family=Kalam:wght@400;700&family=Rubik:wght@400;600;700&display=swap" rel="stylesheet" />
`;

export function resolveCalendarLayoutZoomPercent(settings: CalendarSettings): number {
  return Math.min(100, Math.max(40, Number(settings.calendarLayoutScalePercent) || 100));
}

/** Outer canvas corner radius — aligns with `rounded-2xl` and scales slightly with theme. */
export function resolveCanvasOuterRadiusPx(settings: CalendarSettings): number {
  return Math.min(28, Math.max(0, Math.round(Number(settings.canvasOuterRadiusPx) || 0)));
}

/** Detached month grid shell — aligns with `rounded-xl`, scaled from header radius. */
export function resolveDetachedGridBorderRadiusPx(_settings: CalendarSettings): number {
  return 12;
}

/** Classic / right-block primary title row (Tailwind `text-lg` / `sm:text-xl` midpoint). */
export function resolveHeaderBarPrimaryTitleFontPx(settings: CalendarSettings): number {
  // header bar removed; keep a stable, readable fallback
  return Math.max(17, Math.min(22, Math.round(settings.fontSizePx * 1.28)));
}

/** Classic / right-block subtitle row (`text-xs` / `sm:text-sm`). */
export function resolveHeaderBarSecondaryTitleFontPx(settings: CalendarSettings): number {
  // header bar removed; keep a stable, readable fallback
  return Math.max(11, Math.min(15, Math.round(settings.fontSizePx * 0.88)));
}

/** `minimal_text` — main catalog title (`text-2xl` / `sm:text-3xl`). */
export function resolveMinimalMainTitleFontPx(settings: CalendarSettings): number {
  return Math.max(22, Math.min(32, Math.round(settings.fontSizePx * 1.7)));
}

export function resolveMinimalSubtitleFontPx(settings: CalendarSettings): number {
  return Math.max(12, Math.min(17, Math.round(settings.fontSizePx * 0.95)));
}

/** Hebrew month line in minimal stack (`text-xl` / `sm:text-2xl`). */
export function resolveMinimalHebrewMonthFontPx(settings: CalendarSettings): number {
  return Math.max(19, Math.min(26, Math.round(settings.fontSizePx * 1.42)));
}

export function resolveMinimalGregorianFontPx(settings: CalendarSettings): number {
  // fallback to global font size (header bar removed)
  return Math.max(15, Math.min(19, Math.round(settings.fontSizePx * 1.05)));
}

/** Titles under the pill in `centered_pill` (`text-base` / `sm:text-lg`). */
export function resolveCenteredPillCatalogTitleFontPx(settings: CalendarSettings): number {
  return Math.max(15, Math.min(18, Math.round(settings.fontSizePx * 1.08)));
}

export function resolveCenteredPillCatalogSubtitleFontPx(settings: CalendarSettings): number {
  return Math.max(11, Math.min(14, Math.round(settings.fontSizePx * 0.86)));
}

export function resolveMinimalHeaderMarginBottomPx(_settings: CalendarSettings): number {
  return 16;
}

/**
 * Studio header offsets are authored against ~932px canvas width. Rescale for wider surfaces/PDF
 * so titles stay anchored like `CalendarMonthChrome` HeaderBarNew (`rightPx`).
 */
export const HEADER_BAR_LAYOUT_REFERENCE_WIDTH_PX = 932

export function computeHeaderBoxRightPx(offsetFromRightPx: number, barWidthPx: number): number {
  const w = Math.max(1, Math.round(Number(barWidthPx) || HEADER_BAR_LAYOUT_REFERENCE_WIDTH_PX))
  const off = Math.round(Number(offsetFromRightPx) || 0)
  if (off > HEADER_BAR_LAYOUT_REFERENCE_WIDTH_PX / 2) {
    const distFromLeft = HEADER_BAR_LAYOUT_REFERENCE_WIDTH_PX - off
    return Math.max(0, Math.round(w - distFromLeft))
  }
  return Math.max(0, off)
}

/** Pivot for `headerBox4OffsetXPx` when box4 is laid out as centered + translateX nudge (≈ half of reference canvas). */
export const HEADER_BOX4_CENTER_OFFSET_X_PX = Math.round(HEADER_BAR_LAYOUT_REFERENCE_WIDTH_PX / 2)

/**
 * Horizontal nudge (px) for Gregorian box4 around visual center: `translateX(calc(-50% + nudge))`.
 * Offsets are authored vs {@link HEADER_BAR_LAYOUT_REFERENCE_WIDTH_PX}; pivot = {@link HEADER_BOX4_CENTER_OFFSET_X_PX}.
 */
export function computeHeaderBox4CenterNudgeXPx(offsetFromRightXPx: number, barWidthPx: number): number {
  const w = Math.max(1, Math.round(Number(barWidthPx) || HEADER_BAR_LAYOUT_REFERENCE_WIDTH_PX))
  const off = Math.round(Number(offsetFromRightXPx) || 0)
  return Math.round((off - HEADER_BOX4_CENTER_OFFSET_X_PX) * (w / HEADER_BAR_LAYOUT_REFERENCE_WIDTH_PX))
}

/**
 * Horizontal layout for Hebrew vs Gregorian month labels (Studio + printable HTML).
 * Mirrors `CalendarMonthChrome` collision rules: reserve extra gap when a vertical separator is on.
 */
export function computeHeaderDatePairHorizontalLayoutPx(opts: {
  barWidthPx: number
  gregTextWidthPx: number
  hebrewTextWidthPx: number
  headerBox3OffsetXPx: number
  headerBox4OffsetXPx: number
  separatorEnabled: boolean
  separatorWidthPx: number
  /** Space between separator edge and adjacent text */
  separatorSidePadPx?: number
}): { gLeft: number; hLeft: number; midX: number } {
  const w = Math.max(1, Math.round(Number(opts.barWidthPx) || HEADER_BAR_LAYOUT_REFERENCE_WIDTH_PX))
  const gw = Math.max(1, Math.round(Number(opts.gregTextWidthPx) || 1))
  const hw = Math.max(1, Math.round(Number(opts.hebrewTextWidthPx) || 1))
  const sepW = Math.max(1, Math.round(Number(opts.separatorWidthPx) || 2))
  const sidePad = Math.max(0, Math.round(Number(opts.separatorSidePadPx ?? 6)))
  const layoutGap = opts.separatorEnabled ? Math.max(8, sepW + 2 * sidePad) : 8

  const insetHeb = computeHeaderBoxRightPx(opts.headerBox3OffsetXPx, w)
  const n4 = computeHeaderBox4CenterNudgeXPx(opts.headerBox4OffsetXPx, w)

  let hLeft = w - insetHeb - hw
  let gLeft = w / 2 + n4 - gw / 2

  const clampIntoBar = () => {
    gLeft = Math.max(0, Math.min(gLeft, w - gw))
    hLeft = Math.max(0, Math.min(hLeft, w - hw))
  }

  clampIntoBar()

  if (gLeft + gw + layoutGap > hLeft) {
    gLeft = hLeft - gw - layoutGap
  }
  if (gLeft < 0) {
    gLeft = 0
    if (gLeft + gw + layoutGap > hLeft) {
      hLeft = Math.min(w - hw, gLeft + gw + layoutGap)
    }
  }
  if (hLeft + hw > w) {
    hLeft = w - hw
    if (gLeft + gw + layoutGap > hLeft) {
      gLeft = Math.max(0, hLeft - gw - layoutGap)
    }
  }
  clampIntoBar()

  const midX = Math.round((gLeft + gw + hLeft) / 2)
  return { gLeft, hLeft, midX }
}

/** Rough width for header month strings when DOM measurement is unavailable (print HTML). */
export function estimateHeaderMonthLabelWidthPx(text: string, fontPx: number): number {
  const t = String(text ?? '')
  const fp = Math.max(1, Number(fontPx) || 14)
  if (!t.length) return Math.round(fp * 3)
  let acc = 0
  for (const ch of t) {
    const c = ch.codePointAt(0) ?? 0
    const heb = c >= 0x0590 && c <= 0x05ff
    acc += heb ? fp * 0.58 : fp * 0.48
  }
  return Math.max(28, Math.round(acc))
}

/**
 * Width used for `computeHeaderBoxRightPx` in print/PDF — must match `CalendarMonthChrome`
 * (`containerWidthPx` on the header bar): inner canvas width, capped by `headerBarMaxWidthPx`
 * when set, so titles (esp. Gregorian box 4) stay aligned with the visible bar, not the full page.
 */
export function resolveHeaderBarPositioningWidthPx(settings: CalendarSettings): number {
  const surf = calendarSurfaceDimensionsPx(settings)
  const pad = Number((settings as any).canvasPaddingPx) || 0
  const border = Number((settings as any).canvasBorderWidthPx) || 0
  const inner = Math.max(320, surf.widthPx - 2 * pad - 2 * border)
  const cap = Math.round(Number((settings as any).headerBarMaxWidthPx) || 0)
  if (cap > 0) return Math.min(inner, Math.max(320, cap))
  return inner
}

/** Brand logo strip above the header bar (RTL: logo on the visual right, like `BrandHeader`). */
export function buildPrintBrandLogoAboveBarHtml(
  settings: CalendarSettings,
  esc: (s: string) => string,
  opts?: { marginBottomPx?: number },
): string {
  const logo =
    typeof (settings as any).brandLogoDataUrl === 'string' ? String((settings as any).brandLogoDataUrl).trim() : ''
  if (!logo || !logo.startsWith('data:image/')) return ''
  const mb = Math.max(0, Math.round(Number(opts?.marginBottomPx) || 10))
  return `<div dir="rtl" style="display:flex;justify-content:flex-start;margin-bottom:${mb}px;line-height:0;">
    <img alt="" src="${esc(logo)}" style="max-height:48px;height:auto;width:auto;max-width:280px;object-fit:contain;object-position:100% 50%;display:block;opacity:0.98;" />
  </div>`
}

/**
 * Month chrome HTML (header + grid) for printable month, mirroring `CalendarMonthChrome` layouts.
 */
export function buildPrintMonthChromeHtml(
  settings: CalendarSettings,
  headerLayoutRaw: unknown,
  esc: (s: string) => string,
  parts: { gregTitle: string; hebTitle: string; gMonthDays: number; gridHtml: string; pdfFontMul?: number },
): string {
  const { gregTitle, hebTitle, gMonthDays, gridHtml, pdfFontMul } = parts;
  void gMonthDays;
  const layoutFontMul =
    typeof pdfFontMul === 'number' && Number.isFinite(pdfFontMul) && pdfFontMul > 0 ? pdfFontMul : 1
  const pfs = (px: number) => Math.max(1, Math.round(Number(px) * layoutFontMul))
  const headerLayout = (headerLayoutRaw === 'grid_integrated'
    ? 'grid_integrated'
    : (headerLayoutRaw as HeaderLayoutStyle)) as HeaderLayoutStyle;

  if (headerLayout === 'grid_integrated') {
    // In integrated mode, the header lives inside the grid as its first row (mirrors Studio).
    return `<div class="pageWrap"><div class="gridWrap">${gridHtml}</div></div>`;
  }

  const logoStrip = buildPrintBrandLogoAboveBarHtml(settings, esc)

  const barW = resolveHeaderBarPositioningWidthPx(settings)
  const r1 = computeHeaderBoxRightPx(settings.headerBox1OffsetXPx, barW)
  const r2 = computeHeaderBoxRightPx(settings.headerBox2OffsetXPx, barW)

  const headerStackClamp =
    settings.headerBarMaxWidthPx > 0
      ? `max-width:${settings.headerBarMaxWidthPx}px;margin-left:auto;margin-right:auto;`
      : ''

  const headerBar = `
    <div style="
      position: relative;
      width: 100%;
      height: ${settings.headerBarHeightPx}px;
      background: ${settings.headerBarBg};
      border: ${settings.headerBarBorderWidthPx}px solid ${settings.headerBarBorderColor};
      border-radius: ${settings.headerBarRadiusPx}px;
      overflow: hidden;
      margin-bottom: ${settings.headerBarMarginBottomPx}px;
      transform: translateY(${settings.headerBarOffsetYPx}px);
      box-sizing: border-box;
    ">
      ${(() => {
        const sxPct = Number((settings as any).headerTextScaleXPercent ?? 100)
        const syPct = Number((settings as any).headerTextScaleYPercent ?? 100)
        const sx = Number.isFinite(sxPct) && sxPct > 0 ? sxPct / 100 : 1
        const sy = Number.isFinite(syPct) && syPct > 0 ? syPct / 100 : 1
        const needs = Math.abs(sx - 1) > 0.0001 || Math.abs(sy - 1) > 0.0001
        const span = (text: string, origin: string) =>
          needs
            ? `<span style="display:inline-block;transform:scale(${sx},${sy});transform-origin:${origin};">${text}</span>`
            : text
        const hebDisplayed = String((settings as any).headerBox3TextOverride ?? '').trim() || hebTitle
        const gregDisplayed = String((settings as any).headerBox4TextOverride ?? '').trim() || gregTitle
        const b1 = span(esc(String((settings as any).headerBox1TextOverride ?? '').trim() || settings.titleMain), 'right top')
        const b2 = span(esc(String((settings as any).headerBox2TextOverride ?? '').trim() || settings.titleSub), 'right top')
        const b3 = span(esc(hebDisplayed), 'right top')
        const b4 = span(esc(gregDisplayed), 'center top')
        const sepOn = settings.headerDatePairSeparatorEnabled === true
        const sepW = Math.max(1, Math.round(Number(settings.headerDatePairSeparatorWidthPx) || 2))
        const sepColor =
          typeof settings.headerDatePairSeparatorColor === 'string' && settings.headerDatePairSeparatorColor.trim()
            ? settings.headerDatePairSeparatorColor.trim()
            : '#94a3b8'
        const insetYR = Math.max(0, Math.round(Number(settings.headerDatePairSeparatorInsetYPx) || 0))
        const offYR =
          HEADER_DATE_SEPARATOR_BASELINE_Y_PX + Math.round(Number(settings.headerDatePairSeparatorOffsetYPx) || 0)
        const gwEst = estimateHeaderMonthLabelWidthPx(gregDisplayed, pfs(settings.headerBox4FontPx))
        const hwEst = estimateHeaderMonthLabelWidthPx(hebDisplayed, pfs(settings.headerBox3FontPx))
        const pair = computeHeaderDatePairHorizontalLayoutPx({
          barWidthPx: barW,
          gregTextWidthPx: gwEst,
          hebrewTextWidthPx: hwEst,
          headerBox3OffsetXPx: settings.headerBox3OffsetXPx,
          headerBox4OffsetXPx: settings.headerBox4OffsetXPx,
          separatorEnabled: sepOn,
          separatorWidthPx: sepW,
          separatorSidePadPx: 6,
        })
        const y3 = settings.headerBox3OffsetYPx
        const y4 = settings.headerBox4OffsetYPx
        const barMidY = Math.max(0, Math.round((Number(settings.headerBarHeightPx) || 0) / 2))
        const topPad = 2
        const bot3 = y3 + topPad + pfs(settings.headerBox3FontPx) * 1.2
        const bot4 = y4 + topPad + pfs(settings.headerBox4FontPx) * 1.2
        const lineH = Math.max(8, Math.round(Math.max(bot3, bot4) - (Math.min(y3, y4) + topPad) - 2 * insetYR))
        // Separator Y is independent from the labels (no magnet / no auto-centering).
        const lineTopRel = Math.round(Number(offYR))
        const sepLeft = Math.round(pair.midX - sepW / 2)
        const sepTopPx = Math.round(barMidY + lineTopRel)
        const sepHtml = sepOn
          ? `<div style="position:absolute;left:${sepLeft}px;top:${sepTopPx}px;transform:translateY(-50%);width:${sepW}px;height:${lineH}px;background:${sepColor};pointer-events:none;border-radius:1px;"></div>`
          : ''
        return `
      <div style="position:absolute;right:${r1}px;top:${barMidY}px;transform:translateY(calc(-50% + ${settings.headerBox1OffsetYPx}px));font-size:${pfs(settings.headerBox1FontPx)}px;font-weight:${settings.headerBox1FontWeight};color:${settings.headerBox1Color};white-space:nowrap;line-height:1.2;direction:rtl;">${b1}</div>
      <div style="position:absolute;right:${r2}px;top:${barMidY}px;transform:translateY(calc(-50% + ${settings.headerBox2OffsetYPx}px));font-size:${pfs(settings.headerBox2FontPx)}px;font-weight:${settings.headerBox2FontWeight};color:${settings.headerBox2Color};white-space:nowrap;line-height:1.2;direction:rtl;">${b2}</div>
      ${sepHtml}
      <div style="position:absolute;left:${pair.hLeft}px;top:${barMidY}px;transform:translateY(calc(-50% + ${settings.headerBox3OffsetYPx}px));font-size:${pfs(settings.headerBox3FontPx)}px;font-weight:${settings.headerBox3FontWeight};color:${settings.headerBox3Color};white-space:nowrap;line-height:1.2;direction:rtl;">${b3}</div>
      <div style="position:absolute;left:${pair.gLeft}px;top:${barMidY}px;transform:translateY(calc(-50% + ${settings.headerBox4OffsetYPx}px));font-size:${pfs(settings.headerBox4FontPx)}px;font-weight:${settings.headerBox4FontWeight};color:${settings.headerBox4Color};white-space:nowrap;line-height:1.2;direction:ltr;text-align:center;max-width:none;overflow:visible;">${b4}</div>
        `
      })()}
    </div>
  `

  const headerChrome = `<div style="width:100%;box-sizing:border-box;${headerStackClamp}">${logoStrip}${headerBar}</div>`

  return `<div class="pageWrap"><div class="headerWrap">${headerChrome}</div><div class="gridWrap">${gridHtml}</div></div>`;
}

export type PrintMonthStyleParams = {
  settings: CalendarSettings;
  headerLayout: HeaderLayoutStyle;
  pageWidthMm: number;
  pageHeightMm: number;
  /** Baked `.canvas` background-image stack (pattern + optional photo). */
  canvasBackgroundSnippet: string;
  /**
   * `100 / calendarLayoutZoomPercent` — counters the printable HTML `zoom: var(--layoutScale)` on
   * `.calendarLayoutZoom` so html2canvas/PDF glyph sizes match Studio on-screen typography.
   */
  pdfLayoutFontMul?: number;
};

/**
 * All rules for the printable month `<style>` block except the outer `<style>` tags.
 */
export function buildPrintMonthStylesheetContent(p: PrintMonthStyleParams): string {
  const { settings, headerLayout, pageWidthMm, pageHeightMm, canvasBackgroundSnippet, pdfLayoutFontMul } = p;
  const pad = DOCUMENT_HEADER_BAR_INLINE_PAD_PX;
  void pad;
  const gridDetachedR = resolveDetachedGridBorderRadiusPx(settings);
  const canvasR = resolveCanvasOuterRadiusPx(settings);
  const titlePx = resolveHeaderBarPrimaryTitleFontPx(settings);
  const subPx = resolveHeaderBarSecondaryTitleFontPx(settings);
  const minMain = resolveMinimalMainTitleFontPx(settings);
  const minSub = resolveMinimalSubtitleFontPx(settings);
  const minHeb = resolveMinimalHebrewMonthFontPx(settings);
  const minGreg = resolveMinimalGregorianFontPx(settings);
  const pillMain = resolveCenteredPillCatalogTitleFontPx(settings);
  const pillSub = resolveCenteredPillCatalogSubtitleFontPx(settings);
  void titlePx;
  void subPx;
  void minMain;
  void minSub;
  void minHeb;
  void minGreg;
  void pillMain;
  void pillSub;

  const zoomPct = resolveCalendarLayoutZoomPercent(settings)
  const layoutFontMul =
    typeof pdfLayoutFontMul === 'number' && Number.isFinite(pdfLayoutFontMul) && pdfLayoutFontMul > 0
      ? pdfLayoutFontMul
      : zoomPct > 0
        ? 100 / zoomPct
        : 1
  /** Undo `.calendarLayoutZoom { zoom: zoomPct/100 }` for pdfMode font overrides (html2canvas). */
  const scalePdfFontPx = (px: number) => Math.max(1, Math.round(Number(px) * layoutFontMul))
  const pdfBaseFontPx = scalePdfFontPx(settings.fontSizePx);
  const pdfDowFontPx = scalePdfFontPx(settings.gridWeekdayHeaderFontPx);
  const pdfHebDayFontPx = scalePdfFontPx(settings.hebDayFontPx);
  const pdfGregDayFontPx = scalePdfFontPx(settings.gregDayFontPx);
  const pdfEventFontPx = scalePdfFontPx(settings.eventTitleFontPx);
  /** Match Studio zmanim: `font-size: (shabbatTimesFontPx/10)em` with em = `fontSizePx` (Calendar.tsx). */
  const shabbatTimesVisualPx = Math.max(
    4,
    Math.round(
      (Number(settings.shabbatTimesFontPx) / 10) * Math.max(1, Number(settings.fontSizePx) || 14),
    ),
  )
  const pdfTimesFontPx = Math.max(4, Math.round(shabbatTimesVisualPx * layoutFontMul))
  const pdfHebDayOffsetXPx = Math.round(Number((settings as any).hebDayOffsetXPx ?? 0))
  const pdfHebDayOffsetYPx = Math.round(Number((settings as any).hebDayOffsetYPx ?? 0))
  const pdfCanvasExtraTopPadPx = 0;

  const cellCssColor = (raw: unknown, fallback: string) => {
    const s = typeof raw === 'string' ? raw.trim() : ''
    return s && s.length <= 128 ? s : fallback
  }
  const gregDayTextColor = cellCssColor((settings as any).gregDayTextColor, '#334155')
  const hebDayTextColor = cellCssColor((settings as any).hebDayTextColor, '#0f172a')
  const eventTitleTextColor = cellCssColor((settings as any).eventTitleTextColor, '#1e293b')
  const shabbatTimesTextColor = cellCssColor((settings as any).shabbatTimesTextColor, '#1e293b')

  // Compute the event text band's top offset based on actual date font sizes.
  // This prevents cutting event lines when users increase date fonts.
  const hebPx = Number(settings.hebDayFontPx) || 12;
  const gregPx = Number(settings.gregDayFontPx) || 12;
  const datesBandPx = Math.ceil(Math.max(hebPx, gregPx) * 1.32);
  const topPx = 6 + datesBandPx + 4; // padding + dates + gap
  const zmanimLineH = Math.ceil(shabbatTimesVisualPx * 1.35);
  const zmanimBlockPx = zmanimLineH * 3 + 12; // 3 lines + padding

  const wysiwygClassicCss = '';
  void wysiwygClassicCss;

  const rightBlockRules = '';

  const centeredPillRules = '';
  const cornerMode = (settings as any).cellCornerLayout === 'bottom_left' ? 'bottom_left' : 'default';
  const isIntegrated = headerLayout === 'grid_integrated';

  return `
      @page { size: ${pageWidthMm}mm ${pageHeightMm}mm; margin: ${settings.pdfMarginMm}mm; }
      html, body { margin:0; padding:0; width:100%; height:100%; }
      *{
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        color-adjust: exact;
      }
      body {
        font-family:${settings.fontFamily};
        font-size:${settings.fontSizePx}px;
        background:#fff;
        color:#0f172a;
        direction: ltr;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      @media print{
        *{
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        /* Force crisp, non-stretched glyphs in Chrome print */
        *{
          text-rendering: optimizeLegibility !important;
          -webkit-font-smoothing: antialiased !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          font-stretch: normal !important;
          letter-spacing: normal !important;
          font-kerning: normal !important;
        }
        body, .printRoot, .canvas, .grid, .cell, .dow{
          font-family:${settings.fontFamily} !important;
        }
        body{ font-size:${settings.fontSizePx}px !important; }
        .dow{ font-size:${settings.gridWeekdayHeaderFontPx}px !important; }
        .topRight .heb{ font-size:${settings.hebDayFontPx}px !important; }
        .topRight .greg{ font-size:${settings.gregDayFontPx}px !important; }
        .mid{ font-size:${settings.eventTitleFontPx}px !important; }
        .times{ font-size:${shabbatTimesVisualPx}px !important; }
        /* header bar font rules removed */
        .headerPillCatalogMain{ font-size:${pillMain}px !important; }
        .headerPillCatalogSub{ font-size:${pillSub}px !important; }
        /* Keep text crisp: avoid transform scaling during browser print */
        html, body { height:auto !important; }
        .layoutStage{ display:block !important; height:auto !important; }
        .calendarLayoutZoom{
          position: static !important;
          left: auto !important;
          top: auto !important;
          transform: none !important;
          /* Chrome supports zoom and keeps glyphs sharp compared to transform */
          zoom: var(--layoutScale, 1) !important;
        }
        /* Fix absolute-positioned elements inside cells after zoom reset.
           zoom changes the containing-block size so midWrap/times positions
           must be recalculated explicitly. */
        .cell {
          overflow: visible !important;
          page-break-inside: avoid !important;
        }
        .midWrap {
          position: absolute !important;
          top: 28px !important;
          bottom: 44px !important;
          left: 4px !important;
          right: 4px !important;
          padding: 0 !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: stretch !important;
          justify-content: flex-start !important;
          overflow: visible !important;
        }
        .mid {
          overflow: visible !important;
          white-space: normal !important;
          word-break: break-word !important;
          overflow-wrap: anywhere !important;
          line-height: 1.3 !important;
        }
        /* Keep RTL stability without forcing every node to text-align:right (that breaks centered titles). */
        .cell{ direction: rtl !important; unicode-bidi: embed !important; }
        .cell .topRight, .cell .times, .cell .zmanim{ text-align: right !important; unicode-bidi: isolate !important; }
        .cell .mid{ unicode-bidi: isolate !important; }
        .cellDst .midWrap {
          top: 50px !important;
        }
        .cellFast .midWrap {
          bottom: 88px !important;
        }
        .times {
          position: absolute !important;
          bottom: 4px !important;
          left: 6px !important;
          right: 6px !important;
          top: auto !important;
          direction: rtl !important;
          unicode-bidi: isolate !important;
          padding-right: 4px !important;
          padding-left: 2px !important;
        }
      }
      .printRoot {
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        direction: ltr;
        font-family: ${settings.fontFamily};
        font-size: ${settings.fontSizePx}px;
        color: #0f172a;
        min-height: 100%;
        background-color: ${settings.calendarCanvasFill};
        ${canvasBackgroundSnippet}
        background-size: 24px 24px, 24px 24px, cover, cover;
        background-position: 0 0, 0 0, center, center;
        background-repeat: repeat, repeat, no-repeat, no-repeat;
      }
      .layoutStage{
        width: 100%;
        height: 100%;
        min-height: 0;
        overflow: visible;
        display:flex;
        align-items:center;
        justify-content:center;
      }
      .calendarLayoutZoom{
        /* IMPORTANT: html2canvas captures layout boxes; CSS transform scale can drift.
           Use zoom so the scaled size participates in layout and remains centered. */
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        transform: none;
        zoom: var(--layoutScale, 1);
        margin-left: 0;
        margin-right: 0;
        overflow: visible;
        backface-visibility: hidden;
      }
      .tableOffsetWrap {
        width: 100%;
        height: 100%;
        min-height: 0;
        max-width: 100%;
        box-sizing: border-box;
        overflow: visible;
        display: flex;
        flex-direction: column;
      }
      .pageWrap{
        display:flex;
        flex-direction:column;
        width:100%;
        height:100%;
        min-height:0;
        box-sizing:border-box;
      }
      .headerWrap{
        flex-shrink:0;
        width:100%;
        box-sizing:border-box;
      }
      .gridWrap{
        flex:1;
        min-height:0;
        display:flex;
        flex-direction:column;
        box-sizing:border-box;
      }
      .canvas {
        position: relative;
        height: 100%;
        min-height: 0;
        padding-left: ${settings.canvasPaddingPx}px;
        padding-right: ${settings.canvasPaddingPx}px;
        padding-bottom: ${settings.canvasPaddingPx}px;
        padding-top: 0px;
        border: ${settings.canvasBorderWidthPx}px solid ${settings.canvasBorderColor};
        border-radius: ${canvasR}px;
        overflow: hidden;
        background-color: transparent;
        background-image: none;
      }
      /* header bar CSS removed */
      .grid{
        border:${settings.gridBorderWidthPx}px solid ${settings.gridBorderColor};
        border-radius: ${gridDetachedR}px;
        overflow:hidden;
        background: ${isIntegrated ? '#ffffff' : settings.gridShellBg};
        display:grid;
        grid-template-columns: repeat(7, 1fr);
        ${isIntegrated ? 'gap:4px; padding:4px; box-sizing:border-box;' : ''}
        flex:1;
        min-height:0;
        direction: ltr;
      }
      ${isIntegrated ? `
      .integratedHeaderBox{ pointer-events:none; user-select:none; }
      ` : ''}
      /* header variants removed */
      ${rightBlockRules}
      ${centeredPillRules}
      .dow{
        background:${settings.gridWeekdayHeaderBg};
        text-align:center;
        padding: 0 8px;
        font-size: ${settings.gridWeekdayHeaderFontPx}px;
        font-weight: ${settings.gridWeekdayHeaderFontWeight};
        color: ${settings.gridWeekdayHeaderTextColor};
        border-bottom: ${settings.gridWeekdayHeaderBorderBottomWidthPx}px solid ${settings.gridWeekdayHeaderBorderBottomColor};
        display:flex;
        align-items:center;
        justify-content:center;
        line-height:1;
        height: ${settings.gridWeekdayHeaderHeightPx}px;
        transform: translateY(${settings.gridWeekdayHeaderRowOffsetYPx}px);
        box-sizing: border-box;
      }
      .cell{
        position:relative;
        min-width: 0;
        /* Printable/PDF cell height should respect the computed pdfExportCellHeightPx (printMonth.ts).
           Do not clamp to 150px, otherwise auto-fit (up to ~170px) cannot take effect. */
        min-height: ${Math.max(60, Math.round(Number(settings.pdfExportCellHeightPx) || 92))}px;
        padding: 8px 10px;
        box-sizing:border-box;
        overflow-x: hidden;
      }
      .cellImg{
        position:absolute;
        inset:0;
        width:100%;
        height:100%;
        background-repeat:no-repeat;
        background-position:center;
        background-size:cover;
        z-index:0;
        pointer-events:none;
        user-select:none;
      }
      .cell.dim{ color:#94a3b8; }
      .topRight{
        position:absolute;
        right:10px;
        top:8px;
        display:flex;
        gap:8px;
        align-items:baseline;
        z-index: 3;
      }
      ${cornerMode === 'bottom_left' ? `
      .topRight{
        right:auto;
        top:auto;
        left:10px;
        bottom:8px;
      }
      ` : ''}
      .topRight .heb{ font-size:${settings.hebDayFontPx}px; font-weight:${Number((settings as any).hebDayFontWeight ?? settings.fontWeight)}; color:${hebDayTextColor}; line-height:1; display:inline-block; transform: translate(${Number((settings as any).hebDayOffsetXPx ?? 0)}px, ${Number((settings as any).hebDayOffsetYPx ?? 0)}px); }
      .topRight .greg{ font-size:${settings.gregDayFontPx}px; font-weight:${Number((settings as any).gregDayFontWeight ?? settings.fontWeight)}; color:${gregDayTextColor}; line-height:1; }
      .dstBanner{
        position:absolute;
        left:6px;
        right:6px;
        top: 34px;
        z-index: 4;
        text-align:center;
        font-size: max(6px, calc(${settings.eventTitleFontPx}px * 0.22));
        line-height:1.15;
        font-weight:${settings.fontWeight};
        color:#78350f;
        background: rgba(254,243,199,0.95);
        border:1px solid rgba(251,191,36,0.85);
        border-radius:6px;
        padding:2px 4px;
        box-sizing:border-box;
      }
      .mini{ font-size:0.75em; color:#64748b; }
      .midWrap{
        position:absolute;
        inset:0;
        display:flex;
        flex-direction: column;
        align-items: stretch;
        justify-content: flex-start;
        padding: 30px 12px 54px 12px;
      }
      .cellDst .midWrap{
        padding-top: 52px;
      }
      .cellFast .midWrap{
        align-items: stretch;
        justify-content: flex-start;
        padding-top: 34px;
        padding-bottom: 88px;
      }
      .cellTimes .midWrap{
        /* Reserve more room for the bottom times block (כניסה/יציאה/פרשה). */
        padding-bottom: 96px;
      }
      .cellFast.cellDst .midWrap{
        padding-top: 58px;
      }
      .cellFast .mid{
        text-align: right !important;
        width: 100%;
      }
      .mid{
        width:100%;
        font-size:${settings.eventTitleFontPx}px;
        font-weight:${settings.fontWeight};
        color: ${eventTitleTextColor};
        text-align: right;
        overflow: visible;
        white-space: normal;
        word-break: break-word;
        overflow-wrap: anywhere;
        line-height: 1.3;
      }
      .mid .ln{ line-height: 1.3; }
      .midInner{
        max-height: none;
        overflow: visible;
        word-break: break-word;
        overflow-wrap: anywhere;
      }
      .mid .ln:nth-child(1){ color: ${eventTitleTextColor}; }
      .mid .ln:nth-child(n+2){ color: ${eventTitleTextColor}; font-weight:${settings.fontWeight}; }
      .mid .blank{ opacity:0.5; }
      .times{
        position:absolute;
        left:10px;
        right:10px;
        bottom:8px;
        max-width:100%;
        min-width:0;
        font-size:${shabbatTimesVisualPx}px;
        color: ${shabbatTimesTextColor};
        text-align:right;
        direction: rtl;
        unicode-bidi: isolate;
        padding-right: 4px;
        padding-left: 2px;
        line-height:1.2;
        box-sizing:border-box;
      }
      .times .fastTitle{ font-weight:${settings.fontWeight}; color:${eventTitleTextColor}; margin-bottom:2px; }
      .nowrap{ white-space:nowrap; }

      .pdfMode, .pdfMode * { box-sizing: border-box; }
      .pdfMode,
      .pdfMode .cell,
      .pdfMode .dow,
      .pdfMode .mid,
      .pdfMode .times,
      .pdfMode .topRight {
        font-family: ${settings.fontFamily} !important;
      }
      /* html2canvas captures "screen" CSS, not @media print. Mirror print font scaling in pdfMode. */
      .pdfMode{ font-size:${pdfBaseFontPx}px !important; }
      .pdfMode .dow{ font-size:${pdfDowFontPx}px !important; }
      .pdfMode .topRight .heb{ font-size:${pdfHebDayFontPx}px !important; font-weight:${Number((settings as any).hebDayFontWeight ?? settings.fontWeight)} !important; color:${hebDayTextColor} !important; display:inline-block !important; transform: translate(${pdfHebDayOffsetXPx}px, ${pdfHebDayOffsetYPx}px) !important; }
      .pdfMode .topRight .greg{ font-size:${pdfGregDayFontPx}px !important; font-weight:${Number((settings as any).gregDayFontWeight ?? settings.fontWeight)} !important; color:${gregDayTextColor} !important; }
      .pdfMode .mid{ font-size:${pdfEventFontPx}px !important; }
      .pdfMode .times{ font-size:${pdfTimesFontPx}px !important; }
      .pdfMode .grid{
        display: grid !important;
        grid-template-columns: repeat(7, 1fr) !important;
        width: 100% !important;
        margin-left: auto !important;
        margin-right: auto !important;
        direction: ltr !important;
      }
      .pdfMode .grid.gridIntegrated{
        gap: 4px !important;
        row-gap: 4px !important;
        column-gap: 4px !important;
        padding: 4px !important;
        box-sizing: border-box !important;
        background: #ffffff !important;
      }
      .pdfMode .grid:not(.gridIntegrated){
        gap: 0 !important;
        row-gap: 0 !important;
        column-gap: 0 !important;
      }
      /* Avoid visual gaps between weekday header and cells in PDF:
         CSS transforms move paint but not layout height, so they can create a “floating” row. */
      .pdfMode .dow{
        transform: none !important;
      }
      .pdfMode.pdfAutoFit .grid{
        /* Grid row sizes are set explicitly in pdf.ts on clone. */
        grid-auto-rows: unset !important;
        align-content: stretch !important;
      }
      .pdfMode.pdfAutoFit .cell{
        min-height: var(--pdfAutoCellHeightPx) !important;
        height: var(--pdfAutoCellHeightPx) !important;
      }
      ${cornerMode === 'bottom_left'
        ? `.pdfMode .topRight{ bottom: 6px !important; left: 6px !important; right: auto !important; top: auto !important; z-index: 3 !important; }`
        : `.pdfMode .topRight{ top: -2px !important; right: 3px !important; z-index: 3 !important; }`}
      .pdfMode .midWrap{
        position: absolute !important;
        top: ${topPx}px !important;
        right: 4px !important;
        left: 4px !important;
        /* Keep a consistent vertical window for the year-events block across all cells,
           so it doesn't shift based on whether a cell has zmanim/fast blocks. */
        bottom: ${zmanimBlockPx}px !important;
        padding: 0 !important;
        overflow: visible !important;
        transform: none !important;
        direction: rtl !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        text-align: center !important;
      }
      /* Keep bottom window stable; do not override per-cell. */
      .pdfMode .midInner{
        /* In the interactive app, some themes/layouts make midInner a flex box that centers content.
           For PDF capture we must force top alignment. */
        display: block !important;
        max-height: none !important;
        overflow: visible !important;
        line-height: 1.15;
      }
      .pdfMode .mid{
        position: relative !important;
        width: 100% !important;
        direction: rtl !important;
        unicode-bidi: isolate !important;
        text-align: center !important;
        font-size: ${pdfEventFontPx}px !important;
        font-weight: ${settings.fontWeight} !important;
        color: ${eventTitleTextColor} !important;
        line-height: 1.35 !important;
        overflow: visible !important;
        padding-top: 1px !important;
        padding-bottom: 2px !important;
        transform: none !important;
      }
      .pdfMode .mid .ln{ line-height: 1.35 !important; }
      .pdfMode .mid .ln:nth-child(1){ color: ${eventTitleTextColor} !important; }
      .pdfMode .mid .ln:nth-child(n+2){ color: ${eventTitleTextColor} !important; font-weight: ${settings.fontWeight} !important; }
      .pdfMode .times{
        left: 6px !important;
        right: 6px !important;
        bottom: 10px !important;
        max-width: none !important;
        min-width: 0 !important;
        line-height: 1.15 !important;
        direction: rtl !important;
        unicode-bidi: isolate !important;
        padding-right: 4px !important;
        padding-left: 2px !important;
        color: ${shabbatTimesTextColor} !important;
      }
      .pdfMode .times .fastTitle{
        font-weight: ${settings.fontWeight} !important;
        color: ${eventTitleTextColor} !important;
        margin-bottom: 2px !important;
      }
      /* Force stable RTL for cell content in PDF capture, but preserve per-area text alignment. */
      .pdfMode .cell{ direction: rtl !important; unicode-bidi: embed !important; }
      .pdfMode .cell .topRight, .pdfMode .cell .times, .pdfMode .cell .zmanim{ text-align: right !important; unicode-bidi: isolate !important; }
      .pdfMode .cell .topRight *{ unicode-bidi: isolate !important; }
      .pdfMode .cell .mid{ unicode-bidi: isolate !important; }
      .pdfMode.printRoot{
        width: ${pageWidthMm}mm;
        min-height: ${pageHeightMm}mm;
        height: ${pageHeightMm}mm !important;
        margin: 0 auto;
        overflow: visible !important;
      }
      .pdfMode .layoutStage,
      .pdfMode .calendarLayoutZoom,
      .pdfMode .tableOffsetWrap{
        overflow: visible !important;
      }
      /*
        ב־html2canvas, overflow:hidden + border-radius על הקנבס חותכים את המסגרת העליונה של בלוק
        החודש (right_block / כותרת). ריווח נוסף + overflow גלוי מונעים «חצי מכוסה».
      */
      .pdfMode .canvas{
        width: ${pageWidthMm}mm;
        min-height: ${pageHeightMm}mm;
        height: auto !important;
        overflow: visible !important;
        padding-top: ${isIntegrated ? settings.canvasPaddingTopPx : pdfCanvasExtraTopPadPx}px !important;
      }
  `;
}

/** Year-at-a-glance: grid shell should match detached month grid. */
export function resolveYearPdfGridRadiusPx(settings: CalendarSettings): number {
  return resolveDetachedGridBorderRadiusPx(settings);
}


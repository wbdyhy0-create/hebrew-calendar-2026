/**
 * Shared layout/typography tokens for the on-screen calendar and printable HTML/PDF.
 * Keep pixel math here so UI and export stay aligned when sliders or themes change.
 */
import type { CalendarSettings, HeaderLayoutStyle } from './settings';

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
// (header bar helpers removed)

/**
 * Month chrome HTML (header + grid) for printable month, mirroring `CalendarMonthChrome` layouts.
 */
export function buildPrintMonthChromeHtml(
  settings: CalendarSettings,
  headerLayoutRaw: unknown,
  esc: (s: string) => string,
  parts: { gregTitle: string; hebTitle: string; gMonthDays: number; gridHtml: string },
): string {
  void headerLayoutRaw;
  const { gregTitle, hebTitle, gMonthDays, gridHtml } = parts;
  void gMonthDays;

  const headerHtml = `
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
      ${settings.headerBarMaxWidthPx > 0 ? `max-width: ${settings.headerBarMaxWidthPx}px; margin-left: auto; margin-right: auto;` : ''}
    ">
      <div style="position:absolute;right:${settings.headerBox1OffsetXPx}px;top:${settings.headerBox1OffsetYPx}px;font-size:${settings.headerBox1FontPx}px;font-weight:${settings.headerBox1FontWeight};color:${settings.headerBox1Color};white-space:nowrap;line-height:1.2;direction:rtl;">${esc(settings.titleMain)}</div>
      <div style="position:absolute;right:${settings.headerBox2OffsetXPx}px;top:${settings.headerBox2OffsetYPx}px;font-size:${settings.headerBox2FontPx}px;font-weight:${settings.headerBox2FontWeight};color:${settings.headerBox2Color};white-space:nowrap;line-height:1.2;direction:rtl;">${esc(settings.titleSub)}</div>
      <div style="position:absolute;right:${settings.headerBox3OffsetXPx}px;top:${settings.headerBox3OffsetYPx}px;font-size:${settings.headerBox3FontPx}px;font-weight:${settings.headerBox3FontWeight};color:${settings.headerBox3Color};white-space:nowrap;line-height:1.2;direction:rtl;">${esc(hebTitle)}</div>
      <div style="position:absolute;right:${settings.headerBox4OffsetXPx}px;top:${settings.headerBox4OffsetYPx}px;font-size:${settings.headerBox4FontPx}px;font-weight:${settings.headerBox4FontWeight};color:${settings.headerBox4Color};white-space:nowrap;line-height:1.2;direction:ltr;">${esc(gregTitle)}</div>
    </div>
  `;

  return `${headerHtml}${gridHtml}`;
}

export type PrintMonthStyleParams = {
  settings: CalendarSettings;
  headerLayout: HeaderLayoutStyle;
  pageWidthMm: number;
  pageHeightMm: number;
  /** Baked `.canvas` background-image stack (pattern + optional photo). */
  canvasBackgroundSnippet: string;
};

/**
 * All rules for the printable month `<style>` block except the outer `<style>` tags.
 */
export function buildPrintMonthStylesheetContent(p: PrintMonthStyleParams): string {
  const { settings, headerLayout, pageWidthMm, pageHeightMm, canvasBackgroundSnippet } = p;
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

  // A4 landscape reference area: 297×210mm. Scale fonts down proportionally for smaller pages.
  const A4_AREA = 297 * 210;
  const pageArea = pageWidthMm * pageHeightMm;
  const pageScale = Math.min(1, Math.sqrt(pageArea / A4_AREA));

  const pxToPt = (px: number) => `${(px * 0.75 * pageScale).toFixed(2)}pt`;
  const pdfCanvasExtraTopPadPx = headerLayout === 'right_block' ? 28 : 0;

  const wysiwygClassicCss = '';
  void wysiwygClassicCss;

  const rightBlockRules = '';

  const centeredPillRules = '';

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
        body{ font-size:${pxToPt(settings.fontSizePx)} !important; }
        .dow{ font-size:${pxToPt(settings.gridWeekdayHeaderFontPx)} !important; }
        .topRight .heb{ font-size:${pxToPt(settings.hebDayFontPx)} !important; }
        .topRight .greg{ font-size:${pxToPt(settings.gregDayFontPx)} !important; }
        .mid{ font-size:${pxToPt(settings.eventTitleFontPx)} !important; }
        .times{ font-size:${pxToPt(settings.shabbatTimesFontPx)} !important; }
        /* header bar font rules removed */
        .headerPillCatalogMain{ font-size:${pxToPt(pillMain)} !important; }
        .headerPillCatalogSub{ font-size:${pxToPt(pillSub)} !important; }
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
          overflow: hidden !important;
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
          align-items: center !important;
          justify-content: center !important;
        }
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
        }
      }
      .printRoot {
        width: 100%;
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
      .tableOffsetWrap { width: 100%; max-width: 100%; box-sizing: border-box; overflow: visible; }
      .canvas {
        position: relative;
        padding-left: ${settings.canvasPaddingPx}px;
        padding-right: ${settings.canvasPaddingPx}px;
        padding-bottom: ${settings.canvasPaddingPx}px;
        padding-top: ${settings.canvasPaddingTopPx}px;
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
        background: ${settings.gridShellBg};
        display:grid;
        grid-template-columns: repeat(7, 1fr);
        direction: ltr;
      }
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
        min-height: ${Math.min(150, Math.max(90, Math.round(Number(settings.pdfExportCellHeightPx) || 92)))}px;
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
        align-items:center;
        z-index: 3;
      }
      .topRight .heb{ font-size:${settings.hebDayFontPx}px; font-weight:${settings.fontWeight}; color:#0f172a; line-height:1; }
      .topRight .greg{ font-size:${settings.gregDayFontPx}px; font-weight:${settings.fontWeight}; color:#334155; line-height:1; }
      .dstBanner{
        position:absolute;
        left:6px;
        right:6px;
        top: 34px;
        z-index: 4;
        text-align:center;
        font-size: max(9px, calc(${settings.eventTitleFontPx}px * 0.55));
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
        align-items:center;
        justify-content:center;
        padding: 32px 24px 40px 24px;
      }
      .cellDst .midWrap{
        padding-top: 52px;
      }
      .cellFast .midWrap{
        align-items:center;
        justify-content:center;
        padding-top: 34px;
        padding-bottom: 88px;
      }
      .cellFast.cellDst .midWrap{
        padding-top: 58px;
      }
      .cellFast .mid{
        text-align: center !important;
        width: 100%;
      }
      .mid{
        width:100%;
        font-size:${settings.eventTitleFontPx}px;
        font-weight:${settings.fontWeight};
        color: rgba(15,23,42,0.80);
      }
      .mid .ln{ line-height: 1.15; }
      .midInner{
        max-height: none;
        overflow: visible;
        word-break: break-word;
        overflow-wrap: anywhere;
      }
      .mid .ln:nth-child(1){ color: rgba(15,23,42,0.88); }
      .mid .ln:nth-child(n+2){ color: rgba(51,65,85,0.92); font-weight:${settings.fontWeight}; }
      .mid .blank{ opacity:0.5; }
      .times{
        position:absolute;
        left:10px;
        right:10px;
        bottom:8px;
        max-width:100%;
        min-width:0;
        font-size:${settings.shabbatTimesFontPx}px;
        color: rgba(15,23,42,0.78);
        text-align:right;
        line-height:1.2;
        box-sizing:border-box;
      }
      .times .fastTitle{ font-weight:${settings.fontWeight}; color:#0f172a; margin-bottom:2px; }
      .nowrap{ white-space:nowrap; }

      .pdfMode, .pdfMode * { box-sizing: border-box; }
      /* pdfMode header CSS removed */
        min-width: 0 !important;
        overflow: visible !important;
      }
      .pdfMode .grid{
        display: grid !important;
        grid-template-columns: repeat(7, 1fr) !important;
        width: 100% !important;
        margin-left: auto !important;
        margin-right: auto !important;
        direction: ltr !important;
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
      .pdfMode .topRight{ top: -2px !important; right: 3px !important; z-index: 3 !important; }
      .pdfMode .midWrap{ padding-top: 32px !important; }
      .pdfMode .midInner{
        max-height: none !important;
        overflow: visible !important;
        line-height: 1.15;
      }
      .pdfMode .times{
        left: 6px !important;
        right: 6px !important;
        bottom: 10px !important;
        max-width: none !important;
        min-width: 0 !important;
      }
      .pdfMode.printRoot{
        width: ${pageWidthMm}mm;
        min-height: ${pageHeightMm}mm;
        height: auto !important;
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
        padding-top: calc(${settings.canvasPaddingTopPx}px + ${pdfCanvasExtraTopPadPx}px) !important;
      }
  `;
}

/** Year-at-a-glance: grid shell should match detached month grid. */
export function resolveYearPdfGridRadiusPx(settings: CalendarSettings): number {
  return resolveDetachedGridBorderRadiusPx(settings);
}

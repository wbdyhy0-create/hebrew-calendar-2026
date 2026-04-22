/**
 * Shared layout/typography tokens for the on-screen calendar and printable HTML/PDF.
 * Keep pixel math here so UI and export stay aligned when sliders or themes change.
 */
import type { CalendarSettings, HeaderLayoutStyle } from './settings';
import { sanitizeHeaderLayoutStyle } from './settings';
import { buildHeaderWysiwygClassicPrintCss } from './headerWysiwyg';

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
export function resolveDetachedGridBorderRadiusPx(settings: CalendarSettings): number {
  return Math.min(16, Math.max(10, Math.round(settings.headerBarRadiusPx * 0.75)));
}

/** Classic / right-block primary title row (Tailwind `text-lg` / `sm:text-xl` midpoint). */
export function resolveHeaderBarPrimaryTitleFontPx(settings: CalendarSettings): number {
  const n = Number((settings as any).headerTitleMainFontPx);
  if (Number.isFinite(n) && n > 0) return Math.round(n);
  return Math.max(17, Math.min(22, Math.round(settings.fontSizePx * 1.28)));
}

/** Classic / right-block subtitle row (`text-xs` / `sm:text-sm`). */
export function resolveHeaderBarSecondaryTitleFontPx(settings: CalendarSettings): number {
  const n = Number((settings as any).headerTitleSubFontPx);
  if (Number.isFinite(n) && n > 0) return Math.round(n);
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
  return Math.max(15, Math.min(19, Math.round(settings.headerGregMonthFontPx * 0.98)));
}

/** Titles under the pill in `centered_pill` (`text-base` / `sm:text-lg`). */
export function resolveCenteredPillCatalogTitleFontPx(settings: CalendarSettings): number {
  return Math.max(15, Math.min(18, Math.round(settings.fontSizePx * 1.08)));
}

export function resolveCenteredPillCatalogSubtitleFontPx(settings: CalendarSettings): number {
  return Math.max(11, Math.min(14, Math.round(settings.fontSizePx * 0.86)));
}

export function resolveMinimalHeaderMarginBottomPx(settings: CalendarSettings): number {
  return Math.max(settings.headerBarMarginBottomPx, 16);
}

function escAttr(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Greg month chip — same inline recipe as `GregChip` in `CalendarMonthChrome`. */
export function buildGregChipPrintHtml(
  settings: CalendarSettings,
  esc: (s: string) => string,
  label: string,
): string {
  return `<span class="gregChipPrint" style="font-size:${settings.headerGregMonthFontPx}px;color:${escAttr(
    settings.headerGregMonthTextColor,
  )};font-weight:${settings.headerGregMonthFontWeight};border:none;background:transparent;border-radius:0;padding:0;white-space:nowrap;display:inline-flex;align-items:center;line-height:1;box-sizing:border-box;max-width:100%;">${esc(
    label,
  )}</span>`;
}

/** Hebrew month title chip — same as `HebMonthTitle` in live preview. */
export function buildHebMonthTitlePrintHtml(
  settings: CalendarSettings,
  esc: (s: string) => string,
  text: string,
): string {
  return `<span class="hebPill" style="font-size:${settings.headerHebMonthFontPx}px;font-weight:${
    settings.headerHebMonthFontWeight
  };color:${escAttr(settings.headerHebMonthTextColor)};border:none;background:transparent;border-radius:0;padding:0;white-space:nowrap;display:inline-flex;align-items:center;line-height:1;box-sizing:border-box;max-width:100%;">${esc(
    text,
  )}</span>`;
}

function headerMaxWidthStyle(settings: CalendarSettings): string {
  return settings.headerBarMaxWidthPx > 0 ? `max-width:${settings.headerBarMaxWidthPx}px;` : '';
}

/**
 * Month chrome HTML (header + grid) for printable month, mirroring `CalendarMonthChrome` layouts.
 */
export function buildPrintMonthChromeHtml(
  settings: CalendarSettings,
  headerLayoutRaw: unknown,
  esc: (s: string) => string,
  parts: { gregTitle: string; hebTitle: string; gMonthDays: number; gridHtml: string },
): string {
  const layout = sanitizeHeaderLayoutStyle(headerLayoutRaw);
  const { gregTitle, hebTitle, gMonthDays, gridHtml } = parts;
  const titlesDx = (settings as any).headerBarTitlesOffsetXMm ?? 0;
  const titlesDy = (settings as any).headerBarTitlesOffsetYMm ?? 0;
  const monthDx = (settings as any).headerBarMonthOffsetXMm ?? 0;
  const monthDy = (settings as any).headerBarMonthOffsetYMm ?? 0;

  const classicInner = `
        <div class="titles">
          <div class="main">${esc(settings.titleMain)}</div>
          <div class="sub">${esc(settings.titleSub)} • ${gMonthDays} ימים בחודש</div>
        </div>
        <span class="hebPill">${esc(hebTitle)}</span>
        <div class="gregLabel" style="color:${esc(settings.headerGregMonthTextColor)}">${esc(
    gregTitle,
  )}</div>`;
  const useWysiwygPrint =
    Boolean(settings.headerWysiwygManualActive) &&
    settings.headerWysiwygClassicPct !== null &&
    (layout === 'floating' || layout === 'seamless');
  const classicHeaderBar = `<div class="headerBar calendarHeader${
    useWysiwygPrint ? ' headerWysiwyg' : ''
  }">${classicInner}</div>`;

  if (layout === 'minimal_text') {
    return `<div class="headerMinimal calendarHeader" style="margin-bottom:${resolveMinimalHeaderMarginBottomPx(
      settings,
    )}px;">
          <div style="transform:translate(${titlesDx}mm,${titlesDy}mm);">
            <div class="minimalMain">${esc(settings.titleMain)}</div>
            <div class="minimalSub">${esc(settings.titleSub)} • ${gMonthDays} ימים בחודש</div>
          </div>
          <div style="transform:translate(${monthDx}mm,${monthDy}mm);">
            <div class="minimalHeb">${esc(hebTitle)}</div>
            <div class="minimalGreg">${esc(gregTitle)}</div>
          </div>
        </div>${gridHtml}`;
  }
  if (layout === 'seamless') {
    return `<div class="chromeJoined">${classicHeaderBar}${gridHtml}</div>`;
  }
  if (layout === 'right_block') {
    const r = settings.headerBarRadiusPx;
    return `<div class="headerRightBlockShell calendarHeader" style="margin-bottom:${
      settings.headerBarMarginBottomPx
    }px;transform:translateY(${settings.headerBarOffsetYPx}px);${headerMaxWidthStyle(settings)}">
        <div class="headerRightBlockBar" style="min-height:${settings.headerBarHeightPx}px;background:${escAttr(
      settings.headerBarBg,
    )};border-color:${escAttr(settings.headerBarBorderColor)};border-width:${
      settings.headerBarBorderWidthPx
    }px;border-style:solid;border-radius:${r}px;">
          <div class="headerRightBlockMonthCol" style="border-color:${escAttr(
            settings.headerBarBorderColor,
          )};background:${escAttr(settings.headerHebMonthBg)};transform:translate(${
            monthDx
          }mm,${monthDy}mm);">
            ${buildHebMonthTitlePrintHtml(settings, esc, hebTitle)}
            <div style="margin-top:8px;">${buildGregChipPrintHtml(settings, esc, gregTitle)}</div>
          </div>
          <div class="headerRightBlockTitlesCol" style="transform:translate(${titlesDx}mm,${titlesDy}mm);">
            <div class="headerRightMain">${esc(settings.titleMain)}</div>
            <div class="headerRightSub">${esc(settings.titleSub)}</div>
          </div>
        </div>
      </div>${gridHtml}`;
  }
  if (layout === 'centered_pill') {
    return `<div class="headerCenteredPillShell calendarHeader" style="margin-bottom:${
      settings.headerBarMarginBottomPx
    }px;transform:translateY(${settings.headerBarOffsetYPx}px);${headerMaxWidthStyle(settings)}">
        <div class="headerPillRow" style="background:${escAttr(settings.headerBarBg)};border-color:${escAttr(
      settings.headerBarBorderColor,
    )};border-width:${settings.headerBarBorderWidthPx}px;border-style:solid;transform:translate(${
      monthDx
    }mm,${monthDy}mm);">
          ${buildGregChipPrintHtml(settings, esc, gregTitle)}
          <span style="display:inline-block;width:12px;"></span>
          ${buildHebMonthTitlePrintHtml(settings, esc, hebTitle)}
        </div>
        <div class="headerPillCatalogBlock" style="transform:translate(${titlesDx}mm,${titlesDy}mm);">
          <div class="headerPillCatalogMain">${esc(settings.titleMain)}</div>
          <div class="headerPillCatalogSub">${esc(settings.titleSub)}</div>
        </div>
      </div>${gridHtml}`;
  }

  return `${classicHeaderBar}${gridHtml}`;
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

  // A4 landscape reference area: 297×210mm. Scale fonts down proportionally for smaller pages.
  const A4_AREA = 297 * 210;
  const pageArea = pageWidthMm * pageHeightMm;
  const pageScale = Math.min(1, Math.sqrt(pageArea / A4_AREA));

  const pxToPt = (px: number) => `${(px * 0.75 * pageScale).toFixed(2)}pt`;
  const pdfCanvasExtraTopPadPx = headerLayout === 'right_block' ? 28 : 0;

  const wysiwygClassicCss =
    settings.headerWysiwygManualActive &&
    settings.headerWysiwygClassicPct &&
    (headerLayout === 'floating' || headerLayout === 'seamless')
      ? buildHeaderWysiwygClassicPrintCss(
          settings.headerWysiwygClassicPct,
          settings.headerWysiwygClassicAlign,
        )
      : '';

  const rightBlockRules =
    headerLayout === 'right_block'
      ? `
      .headerRightBlockShell{
        position:relative;
        margin-left:auto;
        margin-right:auto;
        width:100%;
        max-width:100%;
        box-sizing:border-box;
        overflow:visible;
      }
      .headerRightBlockBar{
        display:flex;
        flex-direction:row;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        padding:12px ${Math.max(20, pad)}px;
        box-sizing:border-box;
        width:100%;
        max-width:100%;
        min-width:0;
        overflow:visible;
      }
      .headerRightBlockMonthCol{
        flex-shrink:0;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        gap:8px;
        border-style:solid;
        border-width:${Math.max(1, settings.headerBarBorderWidthPx)}px;
        border-radius:8px;
        padding:12px 14px;
        text-align:center;
        box-shadow:0 1px 2px rgba(15,23,42,0.06);
        min-width:max-content;
        max-width:min(100%,45%);
        overflow:visible;
      }
      .headerRightBlockTitlesCol{
        min-width:0;
        flex:1 1 auto;
        max-width:100%;
        display:flex;
        flex-direction:column;
        align-items:flex-end;
        gap:4px;
        text-align:right;
        overflow:visible;
      }
      .headerRightMain{
        font-weight:${settings.fontWeight};
        font-size:${titlePx}px;
        color:${settings.headerBarTitleColor};
        white-space:normal;
        word-break:break-word;
        overflow:visible;
        max-width:100%;
        line-height:1.3;
      }
      .headerRightSub{
        font-size:${subPx}px;
        color:${settings.headerBarSubtitleColor};
        white-space:normal;
        word-break:break-word;
        overflow:visible;
        max-width:100%;
        line-height:1.35;
      }
      `
      : '';

  const centeredPillRules =
    headerLayout === 'centered_pill'
      ? `
      .headerCenteredPillShell{
        position:relative;
        margin-left:auto;
        margin-right:auto;
        width:100%;
        max-width:100%;
        min-width:0;
        box-sizing:border-box;
        display:flex;
        flex-direction:column;
        align-items:center;
        padding:0 20px;
        overflow:visible;
      }
      .headerPillRow{
        margin-top:24px;
        display:inline-flex;
        flex-wrap:wrap;
        align-items:center;
        justify-content:center;
        gap:12px;
        padding:12px 20px;
        border-radius:9999px;
        box-shadow:0 4px 14px rgba(15,23,42,0.12);
        box-sizing:border-box;
        width:max-content;
        max-width:100%;
        min-width:0;
        overflow:visible;
      }
      .headerPillCatalogBlock{
        margin-top:12px;
        width:100%;
        max-width:100%;
        min-width:0;
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:4px;
        text-align:center;
        padding:0 16px;
        box-sizing:border-box;
        overflow:visible;
      }
      .headerPillCatalogMain{
        font-weight:${settings.fontWeight};
        font-size:${pillMain}px;
        color:${settings.headerBarTitleColor};
        max-width:100%;
        word-break:break-word;
        overflow:visible;
      }
      .headerPillCatalogSub{
        font-size:${pillSub}px;
        color:${settings.headerBarSubtitleColor};
        max-width:100%;
        word-break:break-word;
        overflow:visible;
      }
      `
      : '';

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
        body, .printRoot, .canvas, .grid, .cell, .dow, .headerBar, .headerMinimal, .headerRightBlockShell, .headerCenteredPillShell{
          font-family:${settings.fontFamily} !important;
        }
        body{ font-size:${pxToPt(settings.fontSizePx)} !important; }
        .dow{ font-size:${pxToPt(settings.gridWeekdayHeaderFontPx)} !important; }
        .topRight .heb{ font-size:${pxToPt(settings.hebDayFontPx)} !important; }
        .topRight .greg{ font-size:${pxToPt(settings.gregDayFontPx)} !important; }
        .mid{ font-size:${pxToPt(settings.eventTitleFontPx)} !important; }
        .times{ font-size:${pxToPt(settings.shabbatTimesFontPx)} !important; }
        .headerBar .main{ font-size:${pxToPt(titlePx)} !important; }
        .headerBar .sub{ font-size:${pxToPt(subPx)} !important; }
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
      .headerBar{
        position: relative;
        margin-top:0;
        margin-bottom: ${settings.headerBarMarginBottomPx}px;
        min-height:${settings.headerBarHeightPx}px;
        height:auto;
        background:${settings.headerBarBg};
        border:${settings.headerBarBorderWidthPx}px solid ${settings.headerBarBorderColor};
        border-radius:${settings.headerBarRadiusPx}px;
        padding: 0 ${Math.max(20, pad)}px;
        box-sizing:border-box;
        width: 100%;
        max-width: ${settings.headerBarMaxWidthPx > 0 ? `${settings.headerBarMaxWidthPx}px` : 'none'};
        min-width: 0;
        margin-left: auto;
        margin-right: auto;
        transform: translateY(${settings.headerBarOffsetYPx}px);
        overflow: visible;
      }
      .headerBar:not(.headerWysiwyg){
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
        align-items: center;
        column-gap: 10px;
      }
      .headerBar:not(.headerWysiwyg) .titles{
        position: static;
        grid-column: 1;
        justify-self: end;
        align-self: center;
        transform: translate(${(settings as any).headerBarTitlesOffsetXMm ?? 0}mm, ${(settings as any).headerBarTitlesOffsetYMm ?? 0}mm);
        text-align:right;
        min-width: 0;
        max-width: 100%;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 4px;
        overflow: visible;
      }
      .headerBar:not(.headerWysiwyg) .main{
        font-weight:${settings.headerTitleMainFontWeight};
        font-size:${titlePx}px;
        color:${settings.headerBarTitleColor};
        white-space:normal;
        word-break:break-word;
        overflow:visible;
        max-width:100%;
        line-height:1.3;
      }
      .headerBar:not(.headerWysiwyg) .sub{
        font-size:${subPx}px;
        font-weight:${settings.headerTitleSubFontWeight};
        color:${settings.headerBarSubtitleColor};
        white-space:normal;
        word-break:break-word;
        overflow:visible;
        max-width:100%;
        line-height:1.35;
      }
      .headerBar:not(.headerWysiwyg) .hebPill{
        font-weight: ${settings.headerHebMonthFontWeight};
        color: ${settings.headerHebMonthTextColor};
        border: none;
        background: transparent;
        border-radius: 0;
        padding: 0;
        white-space:nowrap;
        font-size: ${settings.headerHebMonthFontPx}px;
        line-height: 1;
        position: static;
        grid-column: 2;
        justify-self: center;
        align-self: center;
        transform: translate(${(settings as any).headerBarMonthOffsetXMm ?? 0}mm, ${(settings as any).headerBarMonthOffsetYMm ?? 0}mm);
        box-sizing: border-box;
        display:inline-flex;
        align-items:center;
        max-width:100%;
        overflow: visible;
      }
      .headerBar:not(.headerWysiwyg) .gregLabel{
        border:none;
        background: transparent;
        border-radius:0;
        padding: 0;
        white-space:nowrap;
        font-size: ${settings.headerGregMonthFontPx}px;
        color: ${settings.headerGregMonthTextColor};
        position: static;
        grid-column: 3;
        justify-self: start;
        align-self: center;
        transform: translate(${(settings as any).headerGregLabelOffsetXMm ?? 0}mm, ${(settings as any).headerGregLabelOffsetYMm ?? 0}mm);
        box-sizing: border-box;
        display:inline-flex;
        align-items:center;
        max-width:100%;
        overflow:visible;
      }
      .headerBar.headerWysiwyg .main{
        font-weight:${settings.headerTitleMainFontWeight};
        font-size:${titlePx}px;
        color:${settings.headerBarTitleColor};
        white-space:normal;
        word-break:break-word;
        overflow:visible;
        max-width:100%;
        line-height:1.3;
      }
      .headerBar.headerWysiwyg .sub{
        font-size:${subPx}px;
        font-weight:${settings.headerTitleSubFontWeight};
        color:${settings.headerBarSubtitleColor};
        white-space:normal;
        word-break:break-word;
        overflow:visible;
        max-width:100%;
        line-height:1.35;
      }
      ${wysiwygClassicCss}
      .headerBar.headerWysiwyg{
        /* children are absolute in WYSIWYG → force bar height so it doesn't collapse in PDF */
        min-height:${settings.headerBarHeightPx}px;
      }
      .grid{
        border:${settings.gridBorderWidthPx}px solid ${settings.gridBorderColor};
        border-radius: ${gridDetachedR}px;
        overflow:hidden;
        background: ${settings.gridShellBg};
        display:grid;
        grid-template-columns: repeat(7, 1fr);
        direction: ltr;
      }
      ${
        headerLayout === 'seamless'
          ? `
      .chromeJoined{
        margin-top:0;
        border:${settings.gridBorderWidthPx}px solid ${settings.gridBorderColor};
        border-radius:${settings.headerBarRadiusPx}px;
        overflow-x:visible;
        overflow-y:visible;
        width:100%;
        max-width: ${settings.headerBarMaxWidthPx > 0 ? `${settings.headerBarMaxWidthPx}px` : 'none'};
        min-width:0;
        margin-left:auto;
        margin-right:auto;
        box-sizing:border-box;
      }
      .chromeJoined .headerBar{
        margin-top:0;
        margin-bottom:0;
        border-radius: ${settings.headerBarRadiusPx}px ${settings.headerBarRadiusPx}px 0 0;
        border-left:none;
        border-right:none;
        border-top:none;
        border-bottom-width: ${settings.gridWeekdayHeaderBorderBottomWidthPx}px;
        border-bottom-style: solid;
        border-bottom-color: ${settings.gridWeekdayHeaderBorderBottomColor};
      }
      .chromeJoined .grid{
        border:none;
        border-radius: 0 0 ${settings.headerBarRadiusPx}px ${settings.headerBarRadiusPx}px;
      }
      `
          : ''
      }
      ${
        headerLayout === 'minimal_text'
          ? `
      .headerMinimal{
        position:relative;
        margin-top:0;
        margin-bottom: 0;
        text-align:center;
        padding: 8px 20px 4px;
        width:100%;
        max-width:100%;
        min-width:0;
        box-sizing:border-box;
        overflow:visible;
      }
      .headerMinimal .minimalMain{
        font-weight:${settings.fontWeight};
        font-size:${minMain}px;
        color:${settings.headerBarTitleColor};
        max-width:100%;
        word-break:break-word;
        overflow:visible;
      }
      .headerMinimal .minimalSub{
        font-size:${minSub}px;
        color:${settings.headerBarSubtitleColor};
        margin-top:4px;
        max-width:100%;
        word-break:break-word;
        overflow:visible;
      }
      .headerMinimal .minimalHeb{ font-weight:${settings.fontWeight}; font-size:${minHeb}px; color:${settings.headerHebMonthTextColor}; margin-top:10px;}
      .headerMinimal .minimalGreg{ font-size:${minGreg}px; color:${settings.headerGregMonthTextColor}; margin-top:4px;}
      `
          : ''
      }
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
      .pdfMode .headerBar:not(.headerWysiwyg){
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) !important;
        align-items: center !important;
        position: relative !important;
        margin-left: auto !important;
        margin-right: auto !important;
        overflow: visible !important;
        /* Keep parity with the live header bar height so offsets match. */
        min-height: ${settings.headerBarHeightPx}px !important;
        height: auto !important;
      }
      .pdfMode .headerBar.headerWysiwyg{
        display: block !important;
        position: relative !important;
        margin-left: auto !important;
        margin-right: auto !important;
        overflow: visible !important;
        min-height: ${settings.headerBarHeightPx}px !important;
        height: auto !important;
      }
      .pdfMode .headerBar:not(.headerWysiwyg) .hebPill{
        line-height: 1 !important;
      }
      .pdfMode .headerBar.headerWysiwyg .hebPill{
        line-height: 1 !important;
      }
      .pdfMode .headerMinimal,
      .pdfMode .headerRightBlockShell,
      .pdfMode .headerCenteredPillShell{
        display: block !important;
      }
      .pdfMode .headerRightBlockShell{
        overflow: visible !important;
      }
      .pdfMode .headerRightBlockBar{
        display: flex !important;
        overflow: visible !important;
        padding-top: 22px !important;
        padding-bottom: 22px !important;
      }
      .pdfMode .headerRightBlockTitlesCol{
        overflow: visible !important;
      }
      .pdfMode .headerRightMain{
        padding-top: 3px !important;
        line-height: 1.38 !important;
      }
      .pdfMode .headerRightSub{
        line-height: 1.35 !important;
      }
      .pdfMode .headerPillRow{
        display: inline-flex !important;
        flex-wrap: wrap !important;
        max-width: 100% !important;
        width: 100% !important;
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

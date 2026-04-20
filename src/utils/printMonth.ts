import { getDaysInMonth, isSameMonth } from 'date-fns';
import {
  isCenterContentSuppressedByOverride,
  resolveDayTextOverride,
  type OverridesMap,
} from './overrides';
import { sanitizeHeaderLayoutStyle, type CalendarSettings } from './settings';
import {
  buildPrintMonthChromeHtml,
  buildPrintMonthStylesheetContent,
  CALENDAR_PRINT_FONT_LINKS_HTML,
  resolveCalendarLayoutZoomPercent,
} from './calendarDocumentStyles';
import { getMonthGridWeeks } from './calendarGrid';
import {
  abbreviateRoshChodeshHeTitle,
  formatParshaDisplayHe,
  hebrewTitleLooksLikeParshaLine,
  getDayEventsByGregorianDate,
  formatTodayYmdJerusalem,
  formatYmdJerusalem,
  getGregorianDayMonthJerusalem,
  getIsoWeekdaySun0Jerusalem,
  isTaanitEstherFastNameHe,
  mergeTitlesWithFastNameIfMissing,
  getHebrewDayAndMonth,
  getHebrewDayGematriya,
  formatHebrewHeaderText,
  getHebrewHeaderForGregorianMonth,
  isErevPesachGregorian,
  isErevSheviShelPesachGregorian,
  isPesachIGregorian,
  isSheviShelPesachGregorian,
  isRoshHashanaHolidayTitleHe as isRoshHashanaDay,
  isYomKippurHolidayTitleHe as isYomKippurDay,
} from './hebrewDate';
import { formatGregorianMonthYearHebrew } from './gregorianHebrew';
import { resolvePdfPageDimensionsMm } from './pdfPage';
import { mixHexWithWhite } from './color';
import { getWeekdayHeaderLabels } from './weekdayHeaders';
import { getBackgroundImageForMonth } from './backgroundImage';
import { getJerusalemDstTransitionLabel } from './jerusalemDst';
import { hebcalJerTaPairHtml } from './ltrClockHtml';
import { HAVDALAH_MINS_AFTER_SUNSET } from './zmanimConstants';

function esc(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildPrintableMonthHtml(
  viewDate: Date,
  settings: CalendarSettings,
  overrides: OverridesMap,
  _opts?: { location?: 'Jerusalem' | 'TelAviv' },
) {
  const weeks = getMonthGridWeeks(viewDate);
  // Auto-fit PDF: when enabled, compute a cell height that fills the page vertically.
  const weekCount = Math.max(5, Math.min(6, weeks.length || 6));
  const pagePxH = Math.round((resolvePdfPageDimensionsMm(settings).heightMm / 25.4) * 96);
  const approxHeaderH =
    settings.headerLayoutStyle === 'minimal_text' ? 120 : settings.headerBarHeightPx + settings.headerBarMarginBottomPx;
  const approxDowH = settings.gridWeekdayHeaderHeightPx + settings.gridWeekdayHeaderRowOffsetYPx;
  const approxCanvasPad = settings.canvasPaddingTopPx + settings.canvasPaddingPx * 2;
  const approxBorders = settings.canvasBorderWidthPx * 2 + settings.gridBorderWidthPx * 2 + 8;
  const availForCells = Math.max(220, pagePxH - approxHeaderH - approxDowH - approxCanvasPad - approxBorders);
  const autoCellH = Math.round(availForCells / weekCount);
  const effectiveSettings =
    settings.layoutAutoFitToCanvas
      ? { ...settings, pdfExportCellHeightPx: Math.min(170, Math.max(90, autoCellH)) }
      : settings;
  const paddingStrength = Number(effectiveSettings.paddingCellStrength);
  const paddingBg = mixHexWithWhite(
    effectiveSettings.paddingCellColor,
    Number.isFinite(paddingStrength) ? paddingStrength : 0.22,
  );
  const gridStart = weeks[0]?.[0] ?? viewDate;
  const gridEnd = weeks.at(-1)?.at(-1) ?? viewDate;

  const candleMins = effectiveSettings.candleLightingMins === 20 ? 20 : 40;
  const dayEventsJer = getDayEventsByGregorianDate(gridStart, gridEnd, {
    il: true,
    location: 'Jerusalem',
    havdalahMins: HAVDALAH_MINS_AFTER_SUNSET,
    candleLightingMins: candleMins,
    fastTzaitStyle: effectiveSettings.fastTzaitStyle,
    fastSunsetOffsetMins: effectiveSettings.fastSunsetOffsetMins,
  });
  const dayEventsTA = getDayEventsByGregorianDate(gridStart, gridEnd, {
    il: true,
    location: 'TelAviv',
    havdalahMins: HAVDALAH_MINS_AFTER_SUNSET,
    candleLightingMins: candleMins,
    fastTzaitStyle: effectiveSettings.fastTzaitStyle,
    fastSunsetOffsetMins: effectiveSettings.fastSunsetOffsetMins,
  });

  const headerHd = getHebrewHeaderForGregorianMonth(viewDate);
  const gregTitle = formatGregorianMonthYearHebrew(viewDate);
  const hebTitle = formatHebrewHeaderText(headerHd);
  const monthTitle = `${gregTitle} / ${hebTitle}`;

  const bgUrl = getBackgroundImageForMonth(effectiveSettings, viewDate.getMonth());
  // Bake background into the canvas layer (avoid separate opacity layers that html2canvas can
  // composite differently in PDF vs preview).
  const bgOpacity = Math.min(1, Math.max(0, Number(effectiveSettings.backgroundOpacity) || 0));
  const photoWhiteOverlay = Math.min(1, Math.max(0, 1 - bgOpacity));
  const bgImg = bgUrl
    ? `background-image:
          radial-gradient(circle at 1px 1px, rgba(148,163,184,0.35) 1px, transparent 1px),
          radial-gradient(circle at 12px 12px, rgba(148,163,184,0.20) 1px, transparent 1px),
          linear-gradient(rgba(255,255,255,${photoWhiteOverlay}), rgba(255,255,255,${photoWhiteOverlay})),
          url(${bgUrl});`
    : `background-image:
          radial-gradient(circle at 1px 1px, rgba(148,163,184,0.35) 1px, transparent 1px),
          radial-gradient(circle at 12px 12px, rgba(148,163,184,0.20) 1px, transparent 1px);`;

  const gMonthDays = getDaysInMonth(viewDate);

  const { widthMm: pageWidthMm, heightMm: pageHeightMm } = resolvePdfPageDimensionsMm(settings);
  // Note: previously used for @media print fitting. Kept calculation out to avoid stale warnings.

  const dowLabels = getWeekdayHeaderLabels(effectiveSettings.weekdayHeaderMode);
  const headerLayout = sanitizeHeaderLayoutStyle(effectiveSettings.headerLayoutStyle);

  const cells: string[] = [];
  for (const week of weeks) {
    for (const g of [...week].reverse()) {
      const key = formatYmdJerusalem(g);
      const dstLabel = getJerusalemDstTransitionLabel(key);
      const evJer = dayEventsJer.get(key);
      const evTA = dayEventsTA.get(key);
      const titlesRaw = evJer?.titles ?? [];
      const parshaNormalized = formatParshaDisplayHe(evJer?.parshaHe);
      const titles = titlesRaw.filter((t) => {
        if (!parshaNormalized) return true;
        if (!hebrewTitleLooksLikeParshaLine(t)) return true;
        return formatParshaDisplayHe(String(t ?? '')) !== parshaNormalized;
      });
      const parshaHe = settings.showParsha ? evJer?.parshaHe : undefined;

      const fastNameHe = evJer?.fastNameHe;
      const isEstherFast = isTaanitEstherFastNameHe(fastNameHe);
      const primaryTitle = fastNameHe ? titles.find((t) => t !== fastNameHe) : titles[0];

      const inMonth = isSameMonth(g, viewDate);
      const isShabbat = getIsoWeekdaySun0Jerusalem(g) === 6;
      const isEventDay = titles.length > 0;
      const isFriday = getIsoWeekdaySun0Jerusalem(g) === 5;
      const isToday = formatYmdJerusalem(g) === formatTodayYmdJerusalem();
      const isErevPesach = isErevPesachGregorian(g);
      const isPesachI = isPesachIGregorian(g);
      const isErevSheviShelPesach = isErevSheviShelPesachGregorian(g);
      const isSheviShelPesach = isSheviShelPesachGregorian(g);
      const hasFastTimes =
        Boolean(fastNameHe) &&
        !isEstherFast &&
        !isErevPesach &&
        !isErevSheviShelPesach &&
        Boolean(evJer?.fastBegins || evJer?.fastEnds);

      const manual = resolveDayTextOverride(overrides, key);
      const suppressEventHighlight = isCenterContentSuppressedByOverride(manual);

      const bg = !inMonth
        ? paddingBg
        : isToday
          ? settings.todayBg
          : isShabbat
            ? settings.shabbatBg
            : isEventDay && !suppressEventHighlight
              ? settings.eventBg
              : '#ffffff';

      const borderStyle = settings.showCellBorders
        ? `border-left: ${settings.cellBorderWidthPx}px solid ${settings.cellBorderColor}; border-bottom: ${settings.cellBorderWidthPx}px solid ${settings.cellBorderColor};`
        : 'border: none;';

      const hebDay = getHebrewDayGematriya(g);
      const hebMonth = getHebrewDayAndMonth(g).month;
      const { day: gDay, month: gMonth } = getGregorianDayMonthJerusalem(g);

      const manualLines = manual?.centerLines;
      const manualHasVisibleCenter =
        Array.isArray(manualLines) &&
        manualLines.some((l) => String(l).trim().length > 0);
      const autoLines =
        isEstherFast || hasFastTimes
          ? mergeTitlesWithFastNameIfMissing(titles, fastNameHe)
          : [primaryTitle ?? ''].filter(Boolean);
      const lines =
        manual !== undefined
          ? manualHasVisibleCenter
            ? (manualLines as string[])
            : []
          : autoLines;
      const offX = manual?.centerOffsetX ?? 0;
      const offY = manual?.centerOffsetY ?? 0;
      const align = manual?.centerAlign ?? 'center';
      const midAlign = hasFastTimes ? 'center' : align;
      const imgUrl = manual?.imageDataUrl;
      const imgFit = manual?.imageFit ?? 'cover';
      const imgOpacity = typeof manual?.imageOpacity === 'number' ? manual.imageOpacity : 1;
      const imgOffX = Number(manual?.imageOffsetX) || 0;
      const imgOffY = Number(manual?.imageOffsetY) || 0;
      const imgHtml =
        typeof imgUrl === 'string' && imgUrl.trim()
          ? `<div class="cellImg" style="background-image:url(${esc(
              imgUrl,
            )});background-size:${esc(imgFit)};background-position:calc(50% + ${imgOffX.toFixed(
              1,
            )}px) calc(50% + ${imgOffY.toFixed(
              1,
            )}px);opacity:${String(Math.max(0, Math.min(1, imgOpacity)))};"></div>`
          : '';
      const midHtml =
        lines.length > 0
          ? lines
              .map((s) =>
                s === ''
                  ? `<div class="blank">&nbsp;</div>`
                  : `<div class="ln">${esc(abbreviateRoshChodeshHeTitle(s))}</div>`,
              )
              .join('')
          : '';

      const times: string[] = [];
      if (
        (isFriday ||
          isErevPesach ||
          isErevSheviShelPesach ||
          isRoshHashanaDay(titles) ||
          isYomKippurDay(titles)) &&
        evJer?.candleLighting
      ) {
        const taCandle = evTA?.candleLighting;
        const candleLabel = isShabbat
          ? 'יציאת השבת'
          : isYomKippurDay(titles) || isRoshHashanaDay(titles)
            ? 'כניסה'
            : isErevPesach || isErevSheviShelPesach
              ? 'כניסת החג'
              : 'כניסת השבת';
        times.push(
          `<div class="nowrap">${candleLabel}:</div>` +
            hebcalJerTaPairHtml(
              esc(evJer.candleLighting),
              taCandle ? esc(taCandle) : '—',
              'labels',
            ),
        );
      }
      if (isShabbat && (evJer?.havdalah || (settings.showParsha && parshaHe))) {
        if (settings.showParsha && parshaHe) {
          const p = formatParshaDisplayHe(parshaHe);
          times.push(`<div class="nowrap" style="text-align:right;font-weight:650;">${esc(p)}</div>`);
        }
        if (evJer?.havdalah) {
          const taHav = evTA?.havdalah;
          const havLabel = isPesachI || isSheviShelPesach ? 'יציאת החג' : 'יציאת השבת';
          times.push(
            `<div class="nowrap">${havLabel}:</div>` +
              hebcalJerTaPairHtml(
                esc(evJer.havdalah),
                taHav ? esc(taHav) : '—',
                'labels',
              ),
          );
        }
      }
      if (
        (isPesachI || isSheviShelPesach || isRoshHashanaDay(titles) || isYomKippurDay(titles)) &&
        !isShabbat &&
        evJer?.havdalah
      ) {
        const taHav = evTA?.havdalah;
        times.push(
          `<div class="nowrap">${isYomKippurDay(titles) || isRoshHashanaDay(titles) ? 'יציאה' : 'יציאת החג'}:</div>` +
            hebcalJerTaPairHtml(
              esc(evJer.havdalah),
              taHav ? esc(taHav) : '—',
              'labels',
            ),
        );
      }

      cells.push(`
        <div class="cell ${inMonth ? '' : 'dim'}${inMonth && hasFastTimes ? ' cellFast' : ''}${inMonth && dstLabel ? ' cellDst' : ''}" style="background:${bg};${borderStyle}">
          ${imgHtml}
          ${
            !inMonth
              ? ''
              : `<div class="topRight">
            <span class="greg">${gDay}${gDay === 1 ? `<span class="mini">/${gMonth}</span>` : ''}</span>
            <span class="heb">${esc(hebDay)}${
              hebDay === 'א׳' && hebMonth ? ` <span class="mini">${esc(hebMonth)}</span>` : ''
            }</span>
          </div>${dstLabel ? `<div class="dstBanner">${esc(dstLabel)}</div>` : ''}`
          }
          ${
            !inMonth ? '' : midHtml
              ? `<div class="midWrap"><div class="mid" style="transform: translate(${offX}px, ${offY}px); text-align:${midAlign};"><div class="midInner">${midHtml}</div></div></div>`
              : ''
          }
          ${inMonth && times.length ? `<div class="times">${times.join('')}</div>` : ''}
          ${
            inMonth && !isFriday && hasFastTimes
              ? `<div class="times">
                  ${
                    !isErevPesach &&
                    !isErevSheviShelPesach &&
                    (evJer?.fastBegins || evTA?.fastBegins)
                      ? `<div class="nowrap">כניסה: ${hebcalJerTaPairHtml(
                          evJer?.fastBegins ? esc(evJer.fastBegins) : '—',
                          evTA?.fastBegins ? esc(evTA.fastBegins) : '—',
                          'fast',
                        )}</div>`
                      : ''
                  }
                  ${
                    (evJer?.fastEnds || evTA?.fastEnds)
                      ? `<div class="nowrap">יציאה: ${hebcalJerTaPairHtml(
                          evJer?.fastEnds ? esc(evJer.fastEnds) : '—',
                          evTA?.fastEnds ? esc(evTA.fastEnds) : '—',
                          'fast',
                        )}</div>`
                      : ''
                  }
                </div>`
              : ''
          }
        </div>
      `);
    }
  }

  const gridDowRow = dowLabels
    .map(
      (d) =>
        `<div class="dow"><span style="display:inline-block;transform:translateY(${Number(settings.gridWeekdayHeaderTextOffsetYPx) || 0}px);line-height:1;">${esc(d)}</span></div>`,
    )
    .join('');
  const gridHtml = `<div class="grid">${gridDowRow}${cells.join('')}</div>`;

  const zoomPct = resolveCalendarLayoutZoomPercent(effectiveSettings);
  const chromeHtml = buildPrintMonthChromeHtml(effectiveSettings, effectiveSettings.headerLayoutStyle, esc, {
    gregTitle,
    hebTitle,
    gMonthDays,
    gridHtml,
  });

  return `<!doctype html>
<html lang="he" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(settings.titleMain)} — ${esc(monthTitle)}</title>
    ${CALENDAR_PRINT_FONT_LINKS_HTML}
    <style>
      ${buildPrintMonthStylesheetContent({
        settings: effectiveSettings,
        headerLayout,
        pageWidthMm,
        pageHeightMm,
        canvasBackgroundSnippet: bgImg,
      })}
    </style>
  </head>
  <body>
    <div id="calendar-container" class="printRoot">
      <div class="canvas">
      <div class="layoutStage">
      <div class="calendarLayoutZoom" style="--layoutScale:${(zoomPct / 100).toFixed(4)};">
      <div class="tableOffsetWrap" style="margin-top: ${settings.tableOffsetYPx}px;">
      ${chromeHtml}
      </div>
      </div>
      </div>
      </div>
    </div>
  </body>
</html>`;
}


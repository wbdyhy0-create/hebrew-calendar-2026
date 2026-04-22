import { isSameMonth } from 'date-fns';

import { getMonthGridWeeks } from './calendarGrid';
import {
  abbreviateRoshChodeshHeTitle,
  addJerusalemCivilDays,
  getDayEventsByGregorianDate,
  formatYmdJerusalem,
  getGregorianDayMonthJerusalem,
  getIsoWeekdaySun0Jerusalem,
  getHebrewDayGematriya,
  formatHebrewHeaderText,
  getHebrewHeaderForGregorianMonth,
} from './hebrewDate';
import { getJerusalemDstTransitionLabel } from './jerusalemDst';
import { formatGregorianMonthYearHebrew } from './gregorianHebrew';
import { resolveYearPdfGridRadiusPx } from './calendarDocumentStyles';
import type { CalendarSettings } from './settings';
import {
  isCenterContentSuppressedByOverride,
  resolveDayTextOverride,
  type OverridesMap,
} from './overrides';
import { getWeekdayHeaderLabels } from './weekdayHeaders';
import { getBackgroundImageForMonth } from './backgroundImage';
import { mixHexWithWhite } from './color';
import { hebcalYearFridayLineHtml } from './ltrClockHtml';
import { HAVDALAH_MINS_AFTER_SUNSET } from './zmanimConstants';

function esc(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildPrintableYearHtml(
  year: number,
  settings: CalendarSettings,
  _opts?: { location?: 'Jerusalem' | 'BeitShemesh' | 'TelAviv' },
  overrides?: OverridesMap,
) {
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  const candleMins = settings.candleLightingMins === 20 ? 20 : 40;
  const dayEventsJer = getDayEventsByGregorianDate(start, end, {
    il: true,
    location: 'Jerusalem',
    havdalahMins: HAVDALAH_MINS_AFTER_SUNSET,
    candleLightingMins: candleMins,
    fastTzaitStyle: settings.fastTzaitStyle,
    fastSunsetOffsetMins: settings.fastSunsetOffsetMins,
  });
  const dayEventsTA = getDayEventsByGregorianDate(start, end, {
    il: true,
    location: 'TelAviv',
    havdalahMins: HAVDALAH_MINS_AFTER_SUNSET,
    candleLightingMins: candleMins,
    fastTzaitStyle: settings.fastTzaitStyle,
    fastSunsetOffsetMins: settings.fastSunsetOffsetMins,
  });

  const yearBgUrl = getBackgroundImageForMonth(settings, 0);
  const bgImg =
    settings.backgroundImageMode === 'year' && yearBgUrl
      ? `background-image: url(${yearBgUrl});`
      : '';

  const dowLabels = getWeekdayHeaderLabels(settings.weekdayHeaderMode);
  const paddingStrength = Number(settings.paddingCellStrength);
  const paddingBg = mixHexWithWhite(
    settings.paddingCellColor,
    Number.isFinite(paddingStrength) ? paddingStrength : 0.22,
  );

  const monthsHtml: string[] = [];

  for (let m = 0; m < 12; m++) {
    const viewDate = new Date(year, m, 1);
    const weeks = getMonthGridWeeks(viewDate);

    const headerHd = getHebrewHeaderForGregorianMonth(viewDate);
    const title = `${formatGregorianMonthYearHebrew(viewDate)} / ${formatHebrewHeaderText(headerHd)}`;
    const monthBgUrl = getBackgroundImageForMonth(settings, m);

    const cells: string[] = [];
    for (const week of weeks) {
      for (const g of week) {
        const inMonth = isSameMonth(g, viewDate);
        if (!inMonth) {
          const borderStyle = settings.showCellBorders
            ? `border: ${settings.cellBorderWidthPx}px solid ${settings.cellBorderColor};`
            : 'border: none;';
          cells.push(
            `<div class="cell dim" style="background:${paddingBg};${borderStyle}"></div>`,
          );
          continue;
        }

        const key = formatYmdJerusalem(g);
        const dstLabel = getJerusalemDstTransitionLabel(key);
        const evJer = dayEventsJer.get(key);
        const evTA = dayEventsTA.get(key);
        const titles = evJer?.titles ?? [];

        const isShabbat = getIsoWeekdaySun0Jerusalem(g) === 6;
        const isEventDay = titles.length > 0;
        const isFriday = getIsoWeekdaySun0Jerusalem(g) === 5;

        const manualEntry = resolveDayTextOverride(overrides, key);
        const suppressEventHighlight = isCenterContentSuppressedByOverride(manualEntry);
        const bg =
          isShabbat
            ? settings.shabbatBg
            : isEventDay && !suppressEventHighlight
              ? settings.eventBg
              : '#fff';

        const borderStyle = settings.showCellBorders
          ? `border: ${settings.cellBorderWidthPx}px solid ${settings.cellBorderColor};`
          : 'border: none;';

        const { day: gDay } = getGregorianDayMonthJerusalem(g);
        const hebDay = getHebrewDayGematriya(g);

        const timeLines: string[] = [];
        if (isFriday) {
          const next = addJerusalemCivilDays(g, 1);
          const nextKey = formatYmdJerusalem(next);
          const nextJer = dayEventsJer.get(nextKey);
          const nextTA = dayEventsTA.get(nextKey);

          if (evJer?.candleLighting || nextJer?.havdalah) {
            timeLines.push(
              hebcalYearFridayLineHtml(
                'jer',
                esc(evJer?.candleLighting ?? ''),
                esc(nextJer?.havdalah ?? ''),
              ),
            );
            const taEntry = evTA?.candleLighting ?? '';
            const taExit = nextTA?.havdalah ?? '';
            timeLines.push(
              hebcalYearFridayLineHtml('ta', esc(taEntry), esc(taExit)),
            );
          }
        }

        const manual = manualEntry?.centerLines;
        const offX = manualEntry?.centerOffsetX ?? 0;
        const offY = manualEntry?.centerOffsetY ?? 0;
        const align = manualEntry?.centerAlign ?? 'center';
        const imgUrl = manualEntry?.imageDataUrl;
        const imgFit = manualEntry?.imageFit ?? 'cover';
        const imgOpacity =
          typeof manualEntry?.imageOpacity === 'number' ? manualEntry.imageOpacity : 1;
        const imgOffX = Number(manualEntry?.imageOffsetX) || 0;
        const imgOffY = Number(manualEntry?.imageOffsetY) || 0;
        const imgHtml =
          typeof imgUrl === 'string' && imgUrl.trim()
            ? `<div class="cellImg" style="background-image:url(${esc(
                imgUrl,
              )});background-size:${esc(imgFit)};background-position:calc(50% + ${imgOffX.toFixed(
                1,
              )}px) calc(50% + ${imgOffY.toFixed(1)}px);opacity:${String(
                Math.max(0, Math.min(1, imgOpacity)),
              )};"></div>`
            : '';
        const midLines =
          manualEntry !== undefined
            ? (manual ?? [])
            : [titles[0] ? titles[0] : ''].filter(Boolean);
        const midHtml =
          midLines.length > 0
            ? midLines.map((ln) => esc(abbreviateRoshChodeshHeTitle(ln))).join('<br/>')
            : '';

        cells.push(`
          <div class="cell ${inMonth ? '' : 'dim'}${dstLabel ? ' cellDst' : ''}" style="background:${bg};${borderStyle}">
            ${imgHtml}
            <div class="g">${gDay}</div>
            ${
              dstLabel
                ? `<div class="dst" title="לפי Asia/Jerusalem">${esc(dstLabel)}</div>`
                : ''
            }
            <div class="mid" style="transform: translate(${offX}px, ${offY}px); text-align: ${align};">${midHtml}</div>
            <div class="h">${esc(hebDay)}</div>
            ${
              timeLines.length
                ? `<div class="times">${timeLines.map((t) => `<div>${t}</div>`).join('')}</div>`
                : ''
            }
          </div>
        `);
      }
    }

    monthsHtml.push(`
      <section class="month">
        ${
          monthBgUrl
            ? `<div class="mbg" style="background-image:url(${esc(monthBgUrl)}); opacity:${settings.backgroundOpacity};"></div>`
            : ''
        }
        <div class="monthTitle">${esc(title)}</div>
        <div class="grid">
          ${dowLabels
            .map(
              (d) =>
                `<div class="dow" style="background:${esc(
                  settings.gridWeekdayHeaderBg,
                )};color:${esc(settings.gridWeekdayHeaderTextColor)};height:${Number(settings.gridWeekdayHeaderHeightPx) || 34}px;display:flex;align-items:center;justify-content:center;line-height:1;padding:0 6px;box-sizing:border-box;"><span style="display:inline-block;line-height:1;transform:${
                  Number(settings.gridWeekdayHeaderTextOffsetYPx) ? `translateY(${Number(settings.gridWeekdayHeaderTextOffsetYPx)}px)` : 'none'
                }">${esc(d)}</span></div>`,
            )
            .join('')}
          ${cells.join('')}
        </div>
      </section>
    `);
  }

  return `<!doctype html>
<html lang="he" dir="ltr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>לוח שנה ${year}</title>
    <style>
      @page { margin: 10mm; }
      body {
        margin: 0;
        font-family: ${settings.fontFamily};
        font-size: ${settings.fontSizePx}px;
        color: #0f172a;
        background: #fff;
      }
      .wrap {
        padding: 10mm;
        ${bgImg}
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
      }
      .overlay {
        /* Keep background visible; table tiles handle readability */
        background: rgba(255,255,255,0.0);
        border-radius: 10px;
        padding: 8mm;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 6mm;
      }
      .header h1 { margin: 0; font-size: 18px; color: ${settings.headerBarTitleColor}; }
      .header .sub { font-size: 12px; color: ${settings.headerBarSubtitleColor}; }
      .months {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8mm;
      }
      .month {
        position: relative;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .mbg{
        position: absolute;
        inset: 0;
        background-size: cover;
        background-position: center;
        pointer-events: none;
        border-radius: ${resolveYearPdfGridRadiusPx(settings)}px;
        z-index: 0;
      }
      .monthTitle, .grid { position: relative; z-index: 1; }
      .monthTitle {
        display: inline-block;
        padding: 6px 10px;
        border: 2px solid ${settings.gridBorderColor};
        border-radius: 999px;
        background: rgba(255,255,255,0.86);
        font-weight: 700;
        margin-bottom: 6px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        border: ${settings.gridBorderWidthPx}px solid ${settings.gridBorderColor};
        border-radius: ${resolveYearPdfGridRadiusPx(settings)}px;
        overflow: hidden;
        background: ${settings.gridShellBg};
      }
      .dow {
        background: ${settings.gridWeekdayHeaderBg};
        text-align: center;
        padding: 0 6px;
        font-weight: 700;
        color: ${settings.gridWeekdayHeaderTextColor};
        border-bottom: 1px solid ${settings.gridBorderColor};
        display:flex;
        align-items:center;
        justify-content:center;
        line-height:1;
        height: 26px;
      }
      .cell {
        position: relative;
        min-height: 70px;
        padding: 6px 8px;
        box-sizing: border-box;
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
      .cell.dim { color: #94a3b8; }
      .cell .dst {
        position: absolute;
        left: 3px;
        right: 3px;
        top: 22px;
        z-index: 2;
        text-align: center;
        font-size: 7px;
        line-height: 1.1;
        font-weight: 650;
        color: #78350f;
        background: rgba(254,243,199,0.92);
        border: 1px solid rgba(251,191,36,0.75);
        border-radius: 4px;
        padding: 1px 2px;
        max-height: 28px;
        overflow: hidden;
      }
      .cellDst .mid {
        padding-top: 10px;
        max-height: 22px;
      }
      .cell .g {
        position: absolute;
        left: 8px;
        top: 6px;
        font-weight: 700;
        font-size: ${settings.gregDayFontPx}px;
      }
      .cell .h {
        position: absolute;
        right: 8px;
        bottom: 6px;
        font-size: ${settings.hebDayFontPx}px;
        color: rgba(15,23,42,0.78);
        font-weight: 600;
      }
      .cell .mid {
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 0 24px;
        font-size: ${settings.eventTitleFontPx}px;
        line-height: 1.2;
        color: rgba(15,23,42,0.72);
        max-height: 34px;
        overflow: hidden;
      }
      .cell .times {
        position: absolute;
        left: 8px;
        bottom: 6px;
        font-size: ${settings.shabbatTimesFontPx}px;
        color: rgba(15,23,42,0.68);
        text-align: left;
      }
      @media print {
        .wrap { padding: 0; }
        .overlay { padding: 0; background: transparent; }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="overlay">
        <div class="header">
          <div>
            <h1>${esc(settings.titleMain)} — ${year}</h1>
            <div class="sub">${esc(settings.titleSub)}</div>
          </div>
          <div class="sub">מוכן להדפסה (אפשר “הדפס ל‑PDF”)</div>
        </div>
        <div class="months">
          ${monthsHtml.join('')}
        </div>
      </div>
    </div>
  </body>
</html>`;
}


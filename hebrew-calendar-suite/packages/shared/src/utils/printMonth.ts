import { getDaysInMonth, isSameMonth } from 'date-fns'
import {
  isCenterContentSuppressedByOverride,
  resolveDayTextOverride,
  type OverridesMap,
} from '../overrides'
import { type CalendarSettings } from './settings'
import {
  buildPrintMonthChromeHtml,
  buildPrintMonthStylesheetContent,
  CALENDAR_PRINT_FONT_LINKS_HTML,
  resolveCalendarLayoutZoomPercent,
  computeHeaderBoxRightPx,
  computeHeaderDatePairHorizontalLayoutPx,
  estimateHeaderMonthLabelWidthPx,
  resolveHeaderBarPositioningWidthPx,
  buildPrintBrandLogoAboveBarHtml,
} from './calendarDocumentStyles'
import { HEADER_DATE_SEPARATOR_BASELINE_Y_PX } from './settings'
import { getMonthGridWeeks } from './calendarGrid'
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
} from './hebrewDate'
import { formatGregorianMonthYearHebrew } from './gregorianHebrew'
import { resolvePdfPageDimensionsMm } from './pdfPage'
import { mixHexWithWhite } from '../color'
import { getWeekdayHeaderLabels } from './weekdayHeaders'
import { getBackgroundImageForMonth } from './backgroundImage'
import { getJerusalemDstTransitionLabel } from './jerusalemDst'
import { hebcalJerTaPairHtml } from './ltrClockHtml'
import { HAVDALAH_MINS_AFTER_SUNSET } from './zmanimConstants'

function esc(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function buildPrintableMonthHtml(
  viewDate: Date,
  settings: CalendarSettings,
  overrides: OverridesMap,
  _opts?: { location?: 'Jerusalem' | 'TelAviv' },
) {
  const weeks = getMonthGridWeeks(viewDate)
  // Auto-fit PDF: when enabled, compute a cell height that fills the page vertically.
  const weekCount = Math.max(5, Math.min(6, weeks.length || 6))
  const pagePxH = Math.round((resolvePdfPageDimensionsMm(settings).heightMm / 25.4) * 96)
  const approxHeaderH = 0
  const approxDowH = settings.gridWeekdayHeaderHeightPx + settings.gridWeekdayHeaderRowOffsetYPx
  const approxCanvasPad = settings.canvasPaddingTopPx + settings.canvasPaddingPx * 2
  const approxBorders = settings.canvasBorderWidthPx * 2 + settings.gridBorderWidthPx * 2 + 8
  const availForCells = Math.max(220, pagePxH - approxHeaderH - approxDowH - approxCanvasPad - approxBorders)
  const autoCellH = Math.round(availForCells / weekCount)
  // Chrome print-to-PDF can paginate inside CSS grids. In 6-week months, this may push the last row
  // to the next page (leaving a blank gap). Ensure the printable HTML uses a cell height that fits
  // a full month into a single page.
  // After switching zmanim to two stacked lines (י-ם / ת״א), some special days need extra room.
  const fittedCellH = Math.min(170, Math.max(96, autoCellH))
  // Printable/PDF should always auto-fit the cell height to the page, so the calendar fills the page
  // (especially for 5-week months where fixed heights leave large blank areas).
  const effectiveSettings = { ...settings, pdfExportCellHeightPx: fittedCellH }
  const printLayoutZoomPct = resolveCalendarLayoutZoomPercent(effectiveSettings)
  const pdfFontMul = printLayoutZoomPct > 0 ? 100 / printLayoutZoomPct : 1
  const pdfFs = (px: number) => Math.max(1, Math.round(Number(px) * pdfFontMul))
  const paddingStrength = Number(effectiveSettings.paddingCellStrength)
  const paddingBg = mixHexWithWhite(
    effectiveSettings.paddingCellColor,
    Number.isFinite(paddingStrength) ? paddingStrength : 0.22,
  )
  const gridStart = weeks[0]?.[0] ?? viewDate
  const gridEnd = weeks.at(-1)?.at(-1) ?? viewDate

  const candleMins = effectiveSettings.candleLightingMins === 20 ? 20 : 40
  const dayEventsJer = getDayEventsByGregorianDate(gridStart, gridEnd, {
    il: true,
    location: 'Jerusalem',
    havdalahMins: HAVDALAH_MINS_AFTER_SUNSET,
    candleLightingMins: candleMins,
    fastTzaitStyle: effectiveSettings.fastTzaitStyle,
    fastSunsetOffsetMins: effectiveSettings.fastSunsetOffsetMins,
  })
  const dayEventsTA = getDayEventsByGregorianDate(gridStart, gridEnd, {
    il: true,
    location: 'TelAviv',
    havdalahMins: HAVDALAH_MINS_AFTER_SUNSET,
    candleLightingMins: candleMins,
    fastTzaitStyle: effectiveSettings.fastTzaitStyle,
    fastSunsetOffsetMins: effectiveSettings.fastSunsetOffsetMins,
  })

  const headerHd = getHebrewHeaderForGregorianMonth(viewDate)
  const gregTitle = formatGregorianMonthYearHebrew(viewDate)
  const hebTitle = formatHebrewHeaderText(headerHd)
  const monthTitle = `${gregTitle} / ${hebTitle}`

  const bgUrl = getBackgroundImageForMonth(effectiveSettings, viewDate.getMonth())
  // Bake background into the canvas layer (avoid separate opacity layers that html2canvas can
  // composite differently in PDF vs preview).
  const bgOpacity = Math.min(1, Math.max(0, Number(effectiveSettings.backgroundOpacity) || 0))
  const photoWhiteOverlay = Math.min(1, Math.max(0, 1 - bgOpacity))
  const bgImg = bgUrl
    ? `background-image:
          radial-gradient(circle at 1px 1px, rgba(148,163,184,0.35) 1px, transparent 1px),
          radial-gradient(circle at 12px 12px, rgba(148,163,184,0.20) 1px, transparent 1px),
          linear-gradient(rgba(255,255,255,${photoWhiteOverlay}), rgba(255,255,255,${photoWhiteOverlay})),
          url(${bgUrl});`
    : `background-image:
          radial-gradient(circle at 1px 1px, rgba(148,163,184,0.35) 1px, transparent 1px),
          radial-gradient(circle at 12px 12px, rgba(148,163,184,0.20) 1px, transparent 1px);`

  const gMonthDays = getDaysInMonth(viewDate)

  const { widthMm: pageWidthMm, heightMm: pageHeightMm } = resolvePdfPageDimensionsMm(settings)
  // Note: previously used for @media print fitting. Kept calculation out to avoid stale warnings.

  const dowLabels = getWeekdayHeaderLabels(effectiveSettings.weekdayHeaderMode)
  const dowEn = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const headerLayout = effectiveSettings.headerLayoutStyle

  const cells: string[] = []
  const paddingLogoDayKey = (() => {
    for (const week of weeks) {
      for (const g of week) {
        if (!isSameMonth(g, viewDate)) return formatYmdJerusalem(g)
      }
    }
    return null
  })()

  for (const week of weeks) {
    for (const g of week) {
      const key = formatYmdJerusalem(g)
      const dstLabel = getJerusalemDstTransitionLabel(key)
      const evJer = dayEventsJer.get(key)
      const evTA = dayEventsTA.get(key)
      const titlesRaw = evJer?.titles ?? []
      const parshaNormalized = formatParshaDisplayHe(evJer?.parshaHe)
      const titles = titlesRaw.filter((t) => {
        if (!parshaNormalized) return true
        if (!hebrewTitleLooksLikeParshaLine(t)) return true
        return formatParshaDisplayHe(String(t ?? '')) !== parshaNormalized
      })
      const parshaHe = effectiveSettings.showParsha ? evJer?.parshaHe : undefined

      const fastNameHe = evJer?.fastNameHe
      const isEstherFast = isTaanitEstherFastNameHe(fastNameHe)
      const primaryTitle = fastNameHe ? titles.find((t) => t !== fastNameHe) : titles[0]

      const inMonth = isSameMonth(g, viewDate)
      const isShabbat = getIsoWeekdaySun0Jerusalem(g) === 6
      const isEventDay = titles.length > 0
      const isFriday = getIsoWeekdaySun0Jerusalem(g) === 5
      const isToday = formatYmdJerusalem(g) === formatTodayYmdJerusalem()
      const isErevPesach = isErevPesachGregorian(g)
      const isPesachI = isPesachIGregorian(g)
      const isErevSheviShelPesach = isErevSheviShelPesachGregorian(g)
      const isSheviShelPesach = isSheviShelPesachGregorian(g)
      const hasFastTimes =
        Boolean(fastNameHe) &&
        !isEstherFast &&
        !isErevPesach &&
        !isErevSheviShelPesach &&
        Boolean(evJer?.fastBegins || evJer?.fastEnds)

      const manual = resolveDayTextOverride(overrides, key)
      const suppressEventHighlight = isCenterContentSuppressedByOverride(manual)

      const bg = !inMonth
        ? paddingBg
        : isToday
          ? effectiveSettings.todayBg
          : isShabbat
            ? effectiveSettings.shabbatBg
            : isEventDay && !suppressEventHighlight
              ? effectiveSettings.eventBg
              : '#ffffff'

      const borderStyle = effectiveSettings.showCellBorders
        ? effectiveSettings.headerLayoutStyle === 'grid_integrated'
          ? `border: ${effectiveSettings.cellBorderWidthPx}px solid ${effectiveSettings.cellBorderColor};`
          : `border-left: ${effectiveSettings.cellBorderWidthPx}px solid ${effectiveSettings.cellBorderColor}; border-bottom: ${effectiveSettings.cellBorderWidthPx}px solid ${effectiveSettings.cellBorderColor};`
        : 'border: none;'

      const hebDay = getHebrewDayGematriya(g)
      const hebMonth = getHebrewDayAndMonth(g).month
      const { day: gDay, month: gMonth } = getGregorianDayMonthJerusalem(g)

      const gregSpan = `<span class="greg">${gDay}${gDay === 1 ? `<span class="mini">/${gMonth}</span>` : ''}</span>`
      const hebSpan = `<span class="heb">${esc(hebDay)}${
        hebDay === 'א׳' && hebMonth ? ` <span class="mini">${esc(hebMonth)}</span>` : ''
      }</span>`
      const dateHtml =
        settings.cellDateOrder === 'heb_first' ? `${hebSpan}${gregSpan}` : `${gregSpan}${hebSpan}`

      const manualLines = manual?.centerLines
      const manualHasVisibleCenter =
        Array.isArray(manualLines) &&
        manualLines.some((l) => String(l).trim().length > 0)
      const autoLines =
        isEstherFast || hasFastTimes
          ? mergeTitlesWithFastNameIfMissing(titles, fastNameHe)
          : [primaryTitle ?? ''].filter(Boolean)
      const lines =
        manual !== undefined
          ? manualHasVisibleCenter
            ? (manualLines as string[])
            : []
          : autoLines
      // Match Studio/Display: honor global + per-day offsets for the center block in printable exports.
      const centerOffX =
        (Number.isFinite(Number((settings as any).eventOffsetXPx)) ? Number((settings as any).eventOffsetXPx) : 0) +
        (Number.isFinite(Number(manual?.centerOffsetX)) ? Number(manual?.centerOffsetX) : 0)
      const centerOffY =
        (Number.isFinite(Number((settings as any).eventOffsetYPx)) ? Number((settings as any).eventOffsetYPx) : 0) +
        (Number.isFinite(Number(manual?.centerOffsetY)) ? Number(manual?.centerOffsetY) : 0)
      const align = manual?.centerAlign ?? 'center'
      const midAlign = hasFastTimes ? 'center' : align
      const imgUrl = manual?.imageDataUrl
      const imgFit = manual?.imageFit ?? 'cover'
      const imgOpacity = typeof manual?.imageOpacity === 'number' ? manual.imageOpacity : 1
      const imgOffX = Number(manual?.imageOffsetX) || 0
      const imgOffY = Number(manual?.imageOffsetY) || 0
      const isPaddingLogoCell = !inMonth && paddingLogoDayKey && key === paddingLogoDayKey
      const monthPadKey = `__pad__:${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`
      const padMonth = (overrides as any)?.[monthPadKey] as any
      const padGlobal = (overrides as any)?.__all__ as any
      const padImgSrc =
        isPaddingLogoCell && typeof padMonth?.imageDataUrl === 'string' && String(padMonth.imageDataUrl).trim()
          ? padMonth
          : isPaddingLogoCell && typeof padGlobal?.imageDataUrl === 'string' && String(padGlobal.imageDataUrl).trim()
            ? padGlobal
            : null

      const effectiveImgSrc = imgUrl ? manual : padImgSrc
      const effectiveImgUrl =
        effectiveImgSrc && typeof effectiveImgSrc?.imageDataUrl === 'string' ? String(effectiveImgSrc.imageDataUrl).trim() : ''
      const effectiveFitRaw = String(effectiveImgSrc?.imageFit ?? imgFit) || imgFit
      // Match on-screen calendars (Display): use explicit imageFit instead of forcing "contain"
      // in PDF for padding-logo cells, which shrank portraits vs the live preview.
      const normalizedImgFit =
        String(effectiveFitRaw ?? '').toLowerCase().trim() === 'contain' ? 'contain' : 'cover'
      const effectiveOpacity =
        typeof effectiveImgSrc?.imageOpacity === 'number' ? effectiveImgSrc.imageOpacity : imgOpacity
      const effectiveOffX = Number(effectiveImgSrc?.imageOffsetX) || imgOffX
      const effectiveOffY = Number(effectiveImgSrc?.imageOffsetY) || imgOffY
      const imgHtml =
        typeof effectiveImgUrl === 'string' && effectiveImgUrl.trim()
          ? `<div class="cellImg" style="background-image:url(${esc(
              effectiveImgUrl,
            )});background-size:${esc(normalizedImgFit)};background-position:calc(50% + ${effectiveOffX.toFixed(
              1,
            )}px) calc(50% + ${effectiveOffY.toFixed(
              1,
            )}px);opacity:${String(Math.max(0, Math.min(1, effectiveOpacity)))};"></div>`
          : ''
      const midHtml =
        lines.length > 0
          ? lines
              .map((s) =>
                s === ''
                  ? `<div class="blank">&nbsp;</div>`
                  : `<div class="ln">${esc(abbreviateRoshChodeshHeTitle(s))}</div>`,
              )
              .join('')
          : ''

      const times: string[] = []
      if (
        (isFriday ||
          isErevPesach ||
          isErevSheviShelPesach ||
          isRoshHashanaDay(titles) ||
          isYomKippurDay(titles)) &&
        evJer?.candleLighting
      ) {
        const taCandle = evTA?.candleLighting
        const candleLabel = isShabbat
          ? 'יציאת השבת'
          : isYomKippurDay(titles) || isRoshHashanaDay(titles)
            ? 'כניסה'
            : isErevPesach || isErevSheviShelPesach
              ? 'כניסת החג'
              : 'כניסת השבת'
        times.push(
          `<div class="nowrap" style="font-weight:650;">${candleLabel}&rlm;:</div>` +
            hebcalJerTaPairHtml(
              esc(evJer.candleLighting),
              taCandle ? esc(taCandle) : '—',
              'labels',
            ),
        )
      }
      if (isShabbat && (evJer?.havdalah || (settings.showParsha && parshaHe))) {
        if (settings.showParsha && parshaHe) {
          const p = formatParshaDisplayHe(parshaHe)
          times.push(`<div class="nowrap" style="text-align:right;font-weight:650;">${esc(p)}</div>`)
        }
        if (evJer?.havdalah) {
          const taHav = evTA?.havdalah
          const havLabel = isPesachI || isSheviShelPesach ? 'יציאת החג' : 'יציאת השבת'
          times.push(
            `<div class="nowrap" style="font-weight:650;">${havLabel}&rlm;:</div>` +
              hebcalJerTaPairHtml(
                esc(evJer.havdalah),
                taHav ? esc(taHav) : '—',
                'labels',
              ),
          )
        }
      }
      if (
        (isPesachI || isSheviShelPesach || isRoshHashanaDay(titles) || isYomKippurDay(titles)) &&
        !isShabbat &&
        evJer?.havdalah
      ) {
        const taHav = evTA?.havdalah
        times.push(
          `<div class="nowrap" style="font-weight:650;">${isYomKippurDay(titles) || isRoshHashanaDay(titles) ? 'יציאה' : 'יציאת החג'}&rlm;:</div>` +
            hebcalJerTaPairHtml(
              esc(evJer.havdalah),
              taHav ? esc(taHav) : '—',
              'labels',
            ),
        )
      }

      cells.push(`
        <div dir="rtl" class="cell ${inMonth ? '' : 'dim'}${
          inMonth && (times.length > 0 || (!isFriday && hasFastTimes))
            ? ' cellTimes has-zmanim'
            : inMonth
              ? ' no-zmanim'
              : ''
        }${inMonth && hasFastTimes ? ' cellFast' : ''}${inMonth && dstLabel ? ' cellDst' : ''}" style="background:${bg};${borderStyle}">
          ${imgHtml}
          ${
            !inMonth
              ? ''
              : `<div class="topRight">${dateHtml}</div>${dstLabel ? `<div class="dstBanner">${esc(dstLabel)}</div>` : ''}`
          }
          ${
            !inMonth ? '' : midHtml
              ? `<div class="midWrap"><div class="mid" style="text-align:${midAlign};"><div class="midInner" style="transform:translate(${centerOffX.toFixed(
                  1,
                )}px, ${centerOffY.toFixed(1)}px);">${midHtml}</div></div></div>`
              : ''
          }
          ${inMonth && times.length ? `<div class="times zmanim">${times.join('')}</div>` : ''}
          ${
            inMonth && !isFriday && hasFastTimes
              ? `<div class="times zmanim">
                  ${
                    !isErevPesach &&
                    !isErevSheviShelPesach &&
                    (evJer?.fastBegins || evTA?.fastBegins)
                      ? `<div class="nowrap" style="font-weight:650;">כניסה&rlm;: ${hebcalJerTaPairHtml(
                          evJer?.fastBegins ? esc(evJer.fastBegins) : '—',
                          evTA?.fastBegins ? esc(evTA.fastBegins) : '—',
                          'fast',
                        )}</div>`
                      : ''
                  }
                  ${
                    (evJer?.fastEnds || evTA?.fastEnds)
                      ? `<div class="nowrap" style="font-weight:650;">יציאה&rlm;: ${hebcalJerTaPairHtml(
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
      `)
    }
  }

  const gridDowRow = dowLabels
    .map((d, idx) => {
      const off = Number(settings.gridWeekdayHeaderTextOffsetYPx) || 0
      const content = effectiveSettings.weekdayHeaderShowEnglish
        ? `<span style="display:inline-flex;gap:6px;align-items:center;line-height:1;white-space:nowrap;direction:rtl;transform:translateY(${off}px);">
            <span>${esc(d)}</span>
            <span dir="ltr" style="font-weight:800;opacity:0.9;">${esc(dowEn[idx] ?? '')}</span>
          </span>`
        : `<span style="display:inline-block;transform:translateY(${off}px);line-height:1;">${esc(d)}</span>`
      return `<div class="dow">${content}</div>`
    })
    .join('')
  const integratedLogoStripe =
    headerLayout === 'grid_integrated'
      ? buildPrintBrandLogoAboveBarHtml(effectiveSettings, esc, { marginBottomPx: 8 })
      : ''

  const integratedHeaderHtml =
    headerLayout === 'grid_integrated'
      ? (() => {
          const barW = resolveHeaderBarPositioningWidthPx(effectiveSettings)
          const r1 = computeHeaderBoxRightPx(effectiveSettings.headerBox1OffsetXPx, barW)
          const r2 = computeHeaderBoxRightPx(effectiveSettings.headerBox2OffsetXPx, barW)

          const box1Text =
            String((effectiveSettings as any).headerBox1TextOverride ?? '').trim() ||
            String((effectiveSettings as any).titleMain ?? '')
          const box2Text =
            String((effectiveSettings as any).headerBox2TextOverride ?? '').trim() ||
            String((effectiveSettings as any).titleSub ?? '')
          const box3Text = String((effectiveSettings as any).headerBox3TextOverride ?? '').trim() || hebTitle
          const box4Text = String((effectiveSettings as any).headerBox4TextOverride ?? '').trim() || gregTitle

          const sepOnI = effectiveSettings.headerDatePairSeparatorEnabled === true
          const sepWI = Math.max(1, Math.round(Number(effectiveSettings.headerDatePairSeparatorWidthPx) || 2))
          const sepColorI =
            typeof effectiveSettings.headerDatePairSeparatorColor === 'string' &&
            effectiveSettings.headerDatePairSeparatorColor.trim()
              ? effectiveSettings.headerDatePairSeparatorColor.trim()
              : '#94a3b8'
          const insetYI = Math.max(0, Math.round(Number(effectiveSettings.headerDatePairSeparatorInsetYPx) || 0))
          const offYI =
            HEADER_DATE_SEPARATOR_BASELINE_Y_PX +
            Math.round(Number(effectiveSettings.headerDatePairSeparatorOffsetYPx) || 0)
          const gwI = estimateHeaderMonthLabelWidthPx(box4Text, pdfFs(effectiveSettings.headerBox4FontPx))
          const hwI = estimateHeaderMonthLabelWidthPx(box3Text, pdfFs(effectiveSettings.headerBox3FontPx))
          const pairI = computeHeaderDatePairHorizontalLayoutPx({
            barWidthPx: barW,
            gregTextWidthPx: gwI,
            hebrewTextWidthPx: hwI,
            headerBox3OffsetXPx: effectiveSettings.headerBox3OffsetXPx,
            headerBox4OffsetXPx: effectiveSettings.headerBox4OffsetXPx,
            separatorEnabled: sepOnI,
            separatorWidthPx: sepWI,
            separatorSidePadPx: 6,
          })
          const y3i = effectiveSettings.headerBox3OffsetYPx
          const y4i = effectiveSettings.headerBox4OffsetYPx
          const barMidYi = Math.max(0, Math.round((Number(effectiveSettings.headerBarHeightPx) || 0) / 2))
          const topPadI = 2
          const bot3i = y3i + topPadI + pdfFs(effectiveSettings.headerBox3FontPx) * 1.2
          const bot4i = y4i + topPadI + pdfFs(effectiveSettings.headerBox4FontPx) * 1.2
          const lineHI = Math.max(8, Math.round(Math.max(bot3i, bot4i) - (Math.min(y3i, y4i) + topPadI) - 2 * insetYI))
          // Separator Y is independent from the labels (no magnet / no auto-centering).
          const lineTopRelI = Math.round(Number(offYI))
          const sepLeftI = Math.round(pairI.midX - sepWI / 2)
          const sepTopPxI = Math.round(barMidYi + lineTopRelI)
          const sepHtmlI = sepOnI
            ? `<div style="position:absolute;left:${sepLeftI}px;top:${sepTopPxI}px;transform:translateY(-50%);width:${sepWI}px;height:${lineHI}px;background:${sepColorI};pointer-events:none;border-radius:1px;"></div>`
            : ''

          return `<div class="integratedHeader" style="
              grid-column: 1 / -1;
              height: ${Math.max(44, Math.round(Number(effectiveSettings.headerBarHeightPx) || 78))}px;
              border-radius: ${Math.max(0, Math.round(Number(effectiveSettings.headerBarRadiusPx) || 0))}px;
              background: ${effectiveSettings.headerBarBg};
              border: ${Number(effectiveSettings.headerBarBorderWidthPx) || 0}px solid ${effectiveSettings.headerBarBorderColor};
              position: relative;
              overflow: hidden;
              box-sizing: border-box;
            ">
              <div class="integratedHeaderBox box1" style="position:absolute;right:${r1}px;top:${barMidYi}px;transform:translateY(calc(-50% + ${effectiveSettings.headerBox1OffsetYPx}px));font-size:${pdfFs(effectiveSettings.headerBox1FontPx)}px;font-weight:${effectiveSettings.headerBox1FontWeight};color:${effectiveSettings.headerBox1Color};white-space:nowrap;line-height:1.2;direction:rtl;max-width:56%;overflow:hidden;text-overflow:ellipsis;">${esc(
                box1Text,
              )}</div>
              <div class="integratedHeaderBox box2" style="position:absolute;right:${r2}px;top:${barMidYi}px;transform:translateY(calc(-50% + ${effectiveSettings.headerBox2OffsetYPx}px));font-size:${pdfFs(effectiveSettings.headerBox2FontPx)}px;font-weight:${effectiveSettings.headerBox2FontWeight};color:${effectiveSettings.headerBox2Color};white-space:nowrap;line-height:1.2;direction:rtl;max-width:56%;overflow:hidden;text-overflow:ellipsis;">${esc(
                box2Text,
              )}</div>
              ${sepHtmlI}
              <div class="integratedHeaderBox box3" style="position:absolute;left:${pairI.hLeft}px;top:${barMidYi}px;transform:translateY(calc(-50% + ${effectiveSettings.headerBox3OffsetYPx}px));font-size:${pdfFs(effectiveSettings.headerBox3FontPx)}px;font-weight:${effectiveSettings.headerBox3FontWeight};color:${effectiveSettings.headerBox3Color};white-space:nowrap;line-height:1.2;direction:rtl;max-width:none;overflow:visible;">${esc(
                box3Text,
              )}</div>
              <div class="integratedHeaderBox box4" style="position:absolute;left:${pairI.gLeft}px;top:${barMidYi}px;transform:translateY(calc(-50% + ${effectiveSettings.headerBox4OffsetYPx}px));font-size:${pdfFs(effectiveSettings.headerBox4FontPx)}px;font-weight:${effectiveSettings.headerBox4FontWeight};color:${effectiveSettings.headerBox4Color};white-space:nowrap;line-height:1.2;direction:ltr;text-align:center;max-width:none;overflow:visible;">${esc(
                box4Text,
              )}</div>
            </div>`
        })()
      : ''

  const gridHtml = `${integratedLogoStripe}<div class="grid ${headerLayout === 'grid_integrated' ? 'gridIntegrated' : ''}">${
    headerLayout === 'grid_integrated' ? integratedHeaderHtml : ''
  }${gridDowRow}${cells.join('')}</div>`

  const chromeHtml = buildPrintMonthChromeHtml(effectiveSettings, effectiveSettings.headerLayoutStyle, esc, {
    gregTitle,
    hebTitle,
    gMonthDays,
    gridHtml,
    pdfFontMul,
  })

  const pdfTableOffsetYPx = Math.max(0, Number((effectiveSettings as any).tableOffsetYPx ?? 0))

  return `<!doctype html>
<html lang="he" dir="ltr" style="height:100%;">
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
        pdfLayoutFontMul: pdfFontMul,
      })}
    </style>
  </head>
  <body style="height:100%;margin:0;padding:0;">
    <div id="calendar-container" class="printRoot">
      <div class="canvas">
      <div class="layoutStage">
      <div class="calendarLayoutZoom" style="--layoutScale:${(printLayoutZoomPct / 100).toFixed(4)};">
      <div class="tableOffsetWrap" style="margin-top: ${pdfTableOffsetYPx}px;">
      ${chromeHtml}
      </div>
      </div>
      </div>
      </div>
    </div>
  </body>
</html>`
}

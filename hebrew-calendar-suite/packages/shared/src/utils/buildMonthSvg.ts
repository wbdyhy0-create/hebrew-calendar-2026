import { isSameMonth } from 'date-fns'
import {
  isCenterContentSuppressedByOverride,
  resolveDayTextOverride,
  type OverridesMap,
} from '../overrides'
import { type CalendarSettings } from './settings'
import {
  abbreviateRoshChodeshHeTitle,
  formatParshaDisplayHe,
  formatHebrewHeaderText,
  getDayEventsByGregorianDate,
  getGregorianDayMonthJerusalem,
  getHebrewDayAndMonth,
  getHebrewDayGematriya,
  getHebrewHeaderForGregorianMonth,
  getIsoWeekdaySun0Jerusalem,
  hebrewTitleLooksLikeParshaLine,
  isRoshHashanaHolidayTitleHe as isRoshHashanaDay,
  isYomKippurHolidayTitleHe as isYomKippurDay,
  isPesachIGregorian,
  isSheviShelPesachGregorian,
  isErevPesachGregorian,
  isErevSheviShelPesachGregorian,
  formatYmdJerusalem,
} from './hebrewDate'
import { formatGregorianMonthYearHebrew } from './gregorianHebrew'
import { getMonthGridWeeks } from './calendarGrid'
import { mixHexWithWhite } from '../color'
import { getWeekdayHeaderLabels } from './weekdayHeaders'
import { HAVDALAH_MINS_AFTER_SUNSET } from './zmanimConstants'
import { computeHeaderBoxRightPx, HEADER_BAR_LAYOUT_REFERENCE_WIDTH_PX } from './calendarDocumentStyles'

function esc(s: string): string {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** Extract the primary font name from a CSS font stack like '"Heebo", "Assistant", sans-serif'. */
function primaryFontName(fontStack: string): string {
  const first = fontStack.split(',')[0] ?? ''
  return first.replace(/['"]/g, '').trim() || 'Heebo'
}

interface SvgTextOpts {
  x: number
  y: number
  text: string
  fontSize: number
  fontFamily: string
  fontWeight?: number | string
  fill?: string
  textAnchor?: 'start' | 'middle' | 'end'
  direction?: 'rtl' | 'ltr'
  dominantBaseline?: string
  clipId?: string
  opacity?: number
  letterSpacing?: number
}

function svgText(o: SvgTextOpts): string {
  const {
    x, y, text, fontSize, fontFamily,
    fontWeight = 400, fill = '#000000',
    textAnchor = 'start', direction,
    dominantBaseline, clipId, opacity, letterSpacing,
  } = o
  const clip = clipId ? ` clip-path="url(#${clipId})"` : ''
  const dir = direction ? ` direction="${direction}"` : ''
  const baseline = dominantBaseline ? ` dominant-baseline="${dominantBaseline}"` : ''
  const opAttr = opacity !== undefined && opacity < 1 ? ` opacity="${opacity.toFixed(2)}"` : ''
  const ls = letterSpacing !== undefined ? ` letter-spacing="${letterSpacing}"` : ''
  return `<text x="${x}" y="${y}" font-family="${esc(fontFamily)}, sans-serif" font-size="${fontSize}" font-weight="${fontWeight}" fill="${fill}" text-anchor="${textAnchor}"${dir}${baseline}${clip}${opAttr}${ls}>${esc(text)}</text>`
}

/**
 * Build a vector SVG of the calendar month.
 * Suitable for import into Illustrator → InDesign.
 * All text is real SVG <text> — fully editable after import.
 * Fonts resolve by name: install Heebo/Assistant on the system for correct rendering.
 */
export function buildPrintableMonthSvg(
  viewDate: Date,
  settings: CalendarSettings,
  overrides: OverridesMap,
): string {
  const weeks = getMonthGridWeeks(viewDate)
  const weekCount = weeks.length // 5 or 6

  // ── Dimensions ─────────────────────────────────────────────────────────────
  // A4 landscape at 96 dpi: 297mm × 210mm
  const SVG_W = 1122
  const SVG_H = 794
  const PAD = 6 // outer margin

  const font = primaryFontName(settings.fontFamily)

  // Scale factor: settings are authored for ~932px reference width
  const scaleFactor = SVG_W / HEADER_BAR_LAYOUT_REFERENCE_WIDTH_PX

  // ── Header ──────────────────────────────────────────────────────────────────
  const headerH = Math.max(44, Math.round(Number(settings.headerBarHeightPx) || 78))
  const headerMarginB = Math.max(0, Math.round(Number(settings.headerBarMarginBottomPx) || 4))
  const headerRadius = Math.max(0, Math.round(Number(settings.headerBarRadiusPx) || 0))
  const headerBorderW = Math.max(0, Number(settings.headerBarBorderWidthPx) || 0)
  const headerBg = settings.headerBarBg || '#1e4d2b'
  const headerBorderColor = settings.headerBarBorderColor || 'transparent'

  const headerX = PAD
  const headerY = PAD
  const headerW = SVG_W - PAD * 2

  // ── Grid area ───────────────────────────────────────────────────────────────
  const dowH = Math.max(24, Math.round(Number(settings.gridWeekdayHeaderHeightPx) || 36))
  const gridTop = PAD + headerH + headerMarginB
  const gridH = SVG_H - gridTop - PAD
  const cellW = Math.floor((SVG_W - PAD * 2) / 7)
  const gridActualW = cellW * 7
  const gridLeft = PAD
  const dateCellH = Math.floor((gridH - dowH) / weekCount)

  const gridBorderW = Math.max(0, Number(settings.gridBorderWidthPx) || 1)
  const gridBorderColor = settings.gridBorderColor || '#94a3b8'
  const cellBorderW = Math.max(0, Number(settings.cellBorderWidthPx) || 1)
  const cellBorderColor = settings.cellBorderColor || '#cbd5e1'
  const gridShellBg = settings.gridShellBg || '#ffffff'

  // ── Font sizes ──────────────────────────────────────────────────────────────
  // Header-area fonts scale with SVG canvas size; cell content fonts use settings values directly.
  const scalePx = (px: number) => Math.max(1, Math.round(Number(px) * scaleFactor))

  const dowFontPx = scalePx(Number(settings.gridWeekdayHeaderFontPx) || 11)
  const dowFontWeight = Number(settings.weekdayHeaderFontWeight) || 700
  const dowColor = settings.weekdayHeaderColor || '#ffffff'
  const dowBg = settings.weekdayHeaderBg || '#1e4d2b'

  // Cell content — use settings px values directly (matches the HTML CSS which uses them at 1:1)
  const hebDayFontPx = Math.max(1, Math.round(Number(settings.hebDayFontPx) || 14))
  const gregDayFontPx = Math.max(1, Math.round(Number(settings.gregDayFontPx) || 11))
  const hebDayFontWeight = Number((settings as any).hebDayFontWeight) || 600
  const gregDayFontWeight = Number((settings as any).gregDayFontWeight) || 600
  const hebDayColor = String((settings as any).hebDayTextColor || '#0f172a')
  const gregDayColor = String((settings as any).gregDayTextColor || '#334155')

  const eventFontPx = Math.max(1, Math.round(Number((settings as any).eventTitleFontPx) || 10))
  const eventTitleColor = String((settings as any).eventTitleTextColor || '#1e293b')

  const parshaFontPx = Math.max(1, Math.round(Number((settings as any).parshaTitleFontPx) || 9))

  const timesFontPx = Math.max(5, Math.round(Number(settings.shabbatTimesFontPx) || 8))
  const timesColor = String((settings as any).shabbatTimesTextColor || '#1e293b')

  // ── Calendar data ───────────────────────────────────────────────────────────
  const candleMins = settings.candleLightingMins === 20 ? 20 : 40
  const gridStart = weeks[0]?.[0] ?? viewDate
  const gridEnd = weeks.at(-1)?.at(-1) ?? viewDate

  const dayEventsJer = getDayEventsByGregorianDate(gridStart, gridEnd, {
    il: true,
    location: 'Jerusalem',
    havdalahMins: HAVDALAH_MINS_AFTER_SUNSET,
    candleLightingMins: candleMins,
    fastTzaitStyle: settings.fastTzaitStyle,
    fastSunsetOffsetMins: settings.fastSunsetOffsetMins,
  })
  const dayEventsTA = getDayEventsByGregorianDate(gridStart, gridEnd, {
    il: true,
    location: 'TelAviv',
    havdalahMins: HAVDALAH_MINS_AFTER_SUNSET,
    candleLightingMins: candleMins,
    fastTzaitStyle: settings.fastTzaitStyle,
    fastSunsetOffsetMins: settings.fastSunsetOffsetMins,
  })

  // ── Header text ─────────────────────────────────────────────────────────────
  const headerHd = getHebrewHeaderForGregorianMonth(viewDate)
  const gregTitle = formatGregorianMonthYearHebrew(viewDate)
  const hebTitle = formatHebrewHeaderText(headerHd).replace(/״/g, '')

  const box1Text = (settings.headerBox1TextOverride ?? '').trim() || settings.titleMain
  const box2Text = (settings.headerBox2TextOverride ?? '').trim() || settings.titleSub
  const box3Text = (settings.headerBox3TextOverride ?? '').trim() || hebTitle
  const box4Text = (settings.headerBox4TextOverride ?? '').trim() || gregTitle

  const box1FontPx = scalePx(Number(settings.headerBox1FontPx) || 16)
  const box2FontPx = scalePx(Number(settings.headerBox2FontPx) || 12)
  const box3FontPx = scalePx(Number(settings.headerBox3FontPx) || 22)
  const box4FontPx = scalePx(Number(settings.headerBox4FontPx) || 22)

  // ── Assemble SVG ─────────────────────────────────────────────────────────────
  const els: string[] = []

  // Background
  els.push(`<rect x="0" y="0" width="${SVG_W}" height="${SVG_H}" fill="white"/>`)

  // ── Header bar ───────────────────────────────────────────────────────────────
  const hBorder = headerBorderW > 0 ? ` stroke="${esc(headerBorderColor)}" stroke-width="${headerBorderW}"` : ''
  els.push(`<rect x="${headerX}" y="${headerY}" width="${headerW}" height="${headerH}" fill="${esc(headerBg)}" rx="${headerRadius}"${hBorder}/>`)

  // Header box positions: settings use `right:` CSS on reference canvas 932px
  // Remap to actual SVG header width
  const hBarRef = HEADER_BAR_LAYOUT_REFERENCE_WIDTH_PX
  const remapRight = (offsetFromRightPx: number) =>
    headerX + headerW - Math.round(computeHeaderBoxRightPx(offsetFromRightPx, headerW) * (headerW / hBarRef))

  // Box 3: Hebrew month (right side, large)
  // No direction attribute — rely on Unicode Bidi (Hebrew chars are inherently RTL).
  // text-anchor='end' = right edge of text at x; Illustrator & browsers handle Hebrew RTL via Unicode.
  const b3X = remapRight(Number(settings.headerBox3OffsetXPx) || 20)
  const b3Y = headerY + Math.round(Number(settings.headerBox3OffsetYPx) || 0) + box3FontPx
  els.push(svgText({ x: b3X, y: b3Y, text: box3Text, fontSize: box3FontPx, fontFamily: font, fontWeight: settings.headerBox3FontWeight, fill: settings.headerBox3Color || '#ffffff', textAnchor: 'end' }))

  // Box 1: titleMain (right side, below box3 usually)
  const b1X = remapRight(Number(settings.headerBox1OffsetXPx) || 20)
  const b1Y = headerY + Math.round(Number(settings.headerBox1OffsetYPx) || 0) + box1FontPx
  els.push(svgText({ x: b1X, y: b1Y, text: box1Text, fontSize: box1FontPx, fontFamily: font, fontWeight: settings.headerBox1FontWeight, fill: settings.headerBox1Color || '#f59e0b', textAnchor: 'end' }))

  // Box 2: titleSub
  const b2X = remapRight(Number(settings.headerBox2OffsetXPx) || 20)
  const b2Y = headerY + Math.round(Number(settings.headerBox2OffsetYPx) || 0) + box2FontPx
  els.push(svgText({ x: b2X, y: b2Y, text: box2Text, fontSize: box2FontPx, fontFamily: font, fontWeight: settings.headerBox2FontWeight, fill: settings.headerBox2Color || '#ffffff', textAnchor: 'end' }))

  // Box 4: Gregorian label — right-anchored (matches CalendarMonthChrome live preview)
  const b4X = remapRight(Number(settings.headerBox4OffsetXPx) || 0)
  const b4Y = headerY + Math.round(Number(settings.headerBox4OffsetYPx) || 0) + box4FontPx
  els.push(svgText({ x: b4X, y: b4Y, text: box4Text, fontSize: box4FontPx, fontFamily: font, fontWeight: settings.headerBox4FontWeight, fill: settings.headerBox4Color || '#ffffff', textAnchor: 'end' }))

  // ── Grid shell ───────────────────────────────────────────────────────────────
  const gBorder = gridBorderW > 0 ? ` stroke="${esc(gridBorderColor)}" stroke-width="${gridBorderW}"` : ''
  els.push(`<rect x="${gridLeft}" y="${gridTop}" width="${gridActualW}" height="${gridH}" fill="${esc(gridShellBg)}"${gBorder}/>`)

  // ── Weekday headers ──────────────────────────────────────────────────────────
  // RTL column order: שבת on the left (col 0), ראשון on the right (col 6)
  const weekdayLabels = getWeekdayHeaderLabels(settings.weekdayHeaderMode).slice().reverse()
  const dowShowEn = settings.weekdayHeaderShowEnglish
  const dowEnLabels = ['SAT', 'FRI', 'THU', 'WED', 'TUE', 'MON', 'SUN']
  for (let col = 0; col < 7; col++) {
    const colX = gridLeft + col * cellW
    els.push(`<rect x="${colX}" y="${gridTop}" width="${cellW}" height="${dowH}" fill="${esc(dowBg)}"/>`)
    const label = weekdayLabels[col] ?? ''
    const midX = colX + cellW / 2
    const midY = gridTop + dowH / 2
    const lineH = dowFontPx * 1.25
    if (dowShowEn) {
      const enY = midY - lineH / 2 + dowFontPx * 0.35
      const heY = midY + lineH / 2 + dowFontPx * 0.35
      els.push(svgText({ x: midX, y: enY, text: dowEnLabels[col] ?? '', fontSize: Math.round(dowFontPx * 0.75), fontFamily: font, fontWeight: dowFontWeight, fill: dowColor, textAnchor: 'middle', dominantBaseline: 'central' }))
      els.push(svgText({ x: midX, y: heY, text: label, fontSize: dowFontPx, fontFamily: font, fontWeight: dowFontWeight, fill: dowColor, textAnchor: 'middle', dominantBaseline: 'central' }))
    } else {
      els.push(svgText({ x: midX, y: midY, text: label, fontSize: dowFontPx, fontFamily: font, fontWeight: dowFontWeight, fill: dowColor, textAnchor: 'middle', dominantBaseline: 'central' }))
    }
  }

  // ── Cell grid ────────────────────────────────────────────────────────────────
  const paddingStrength = Number(settings.paddingCellStrength)
  const paddingBg = mixHexWithWhite(
    settings.paddingCellColor,
    Number.isFinite(paddingStrength) ? paddingStrength : 0.22,
  )

  // Clip paths per cell column to prevent text overflow
  const clipDefs: string[] = []
  for (let col = 0; col < 7; col++) {
    const clipX = gridLeft + col * cellW
    for (let row = 0; row < weekCount; row++) {
      const clipY = gridTop + dowH + row * dateCellH
      const id = `cc${col}r${row}`
      clipDefs.push(`<clipPath id="${id}"><rect x="${clipX + 1}" y="${clipY + 1}" width="${cellW - 2}" height="${dateCellH - 2}"/></clipPath>`)
    }
  }

  weeks.forEach((week, rowIdx) => {
    const cellY = gridTop + dowH + rowIdx * dateCellH

    week.forEach((_day, colIdx) => {
      // RTL layout: visual col 0 (leftmost) = SAT = week[6], col 6 (rightmost) = SUN = week[0]
      const g = week[6 - colIdx]!
      const cellX = gridLeft + colIdx * cellW
      const inMonth = isSameMonth(g, viewDate)
      const key = formatYmdJerusalem(g)
      const isShabbat = getIsoWeekdaySun0Jerusalem(g) === 6
      const isFriday = getIsoWeekdaySun0Jerusalem(g) === 5
      const evJer = dayEventsJer.get(key)
      const evTA = dayEventsTA.get(key)
      const titlesRaw = evJer?.titles ?? []
      const parshaHe = settings.showParsha ? evJer?.parshaHe : undefined
      const parshaNormalized = formatParshaDisplayHe(evJer?.parshaHe)
      const titles = titlesRaw.filter((t) => {
        if (!parshaNormalized) return true
        if (!hebrewTitleLooksLikeParshaLine(t)) return true
        return formatParshaDisplayHe(String(t ?? '')) !== parshaNormalized
      })
      const isEventDay = titles.length > 0
      const isErevPesach = isErevPesachGregorian(g)
      const isPesachI = isPesachIGregorian(g)
      const isErevSheviShelPesach = isErevSheviShelPesachGregorian(g)
      const isSheviShelPesach = isSheviShelPesachGregorian(g)
      const fastNameHe = evJer?.fastNameHe
      const primaryTitle = fastNameHe ? titles.find((t) => t !== fastNameHe) : titles[0]

      const manual = resolveDayTextOverride(overrides, key)
      const suppressEventHighlight = isCenterContentSuppressedByOverride(manual)

      const bg = !inMonth
        ? paddingBg
        : isShabbat
          ? settings.shabbatBg
          : isEventDay && !suppressEventHighlight
            ? settings.eventBg
            : '#ffffff'

      // Cell background
      els.push(`<rect x="${cellX}" y="${cellY}" width="${cellW}" height="${dateCellH}" fill="${esc(bg)}"/>`)

      // Cell borders
      if (settings.showCellBorders && cellBorderW > 0) {
        els.push(`<line x1="${cellX}" y1="${cellY}" x2="${cellX}" y2="${cellY + dateCellH}" stroke="${esc(cellBorderColor)}" stroke-width="${cellBorderW}"/>`)
        els.push(`<line x1="${cellX}" y1="${cellY + dateCellH}" x2="${cellX + cellW}" y2="${cellY + dateCellH}" stroke="${esc(cellBorderColor)}" stroke-width="${cellBorderW}"/>`)
      }

      if (!inMonth) return

      const clipId = `cc${colIdx}r${rowIdx}`
      const hebDayRaw = getHebrewDayGematriya(g)
      const hebDay = hebDayRaw.replace(/״/g, '')
      const { day: gDay, month: gMonth } = getGregorianDayMonthJerusalem(g)
      const hebMonthData = getHebrewDayAndMonth(g)

      // Date offsets
      const hebOffX = Math.round(Number((settings as any).hebDayOffsetXPx) || 0)
      const hebOffY = Math.round(Number((settings as any).hebDayOffsetYPx) || 0)
      const gregOffX = Math.round(Number((settings as any).gregDayOffsetXPx) || 0)
      const gregOffY = Math.round(Number((settings as any).gregDayOffsetYPx) || 0)

      // Both dates at top-right, side by side — mirrors .topRight { right:10px; top:8px; display:flex; gap:8px; align-items:center }
      const dateBaselineY = cellY + 8 + Math.max(hebDayFontPx, gregDayFontPx)
      const hebDateX = cellX + cellW - 10 + hebOffX

      // Hebrew date (rightmost in RTL flex row)
      els.push(svgText({ x: hebDateX, y: dateBaselineY + hebOffY, text: hebDay, fontSize: hebDayFontPx, fontFamily: font, fontWeight: hebDayFontWeight, fill: hebDayColor, textAnchor: 'end', clipId }))

      // First of Hebrew month — mini month name below heb date
      if (hebDayRaw === 'א׳' && hebMonthData.month) {
        const miniY = dateBaselineY + hebOffY + Math.round(hebDayFontPx * 0.75) + 1
        els.push(svgText({ x: hebDateX, y: miniY, text: hebMonthData.month, fontSize: Math.max(5, Math.round(hebDayFontPx * 0.62)), fontFamily: font, fontWeight: 400, fill: hebDayColor, textAnchor: 'end', clipId }))
      }

      // Gregorian date — to the left of Hebrew date, gap:8px (estimate heb gematria width ≈ 1.8em)
      const hebEstW = Math.round(hebDayFontPx * 1.8)
      const gregDateX = hebDateX - hebEstW - 8 + gregOffX
      const gregText = String(gDay) + (gDay === 1 ? `/${gMonth}` : '')
      els.push(svgText({ x: gregDateX, y: dateBaselineY + gregOffY, text: gregText, fontSize: gregDayFontPx, fontFamily: font, fontWeight: gregDayFontWeight, fill: gregDayColor, textAnchor: 'end', clipId }))

      // ── Center content (event title / parsha) ──
      const manualLines = manual?.centerLines
      const manualHasContent = Array.isArray(manualLines) && manualLines.some((l) => String(l).trim())
      const contentLines: string[] = manualHasContent
        ? (manualLines as string[]).filter((l) => String(l).trim())
        : primaryTitle
          ? [abbreviateRoshChodeshHeTitle(primaryTitle)]
          : []

      // Mirror .midWrap { padding: 32px 24px 40px 24px; align-items:center; justify-content:center }
      const midTopY = cellY + 32
      const midBotY = cellY + dateCellH - 40
      const availH = midBotY - midTopY

      // Parsha on Shabbat
      if (isShabbat && parshaHe && !suppressEventHighlight) {
        const p = formatParshaDisplayHe(parshaHe)
        const pCX = cellX + cellW / 2
        els.push(svgText({ x: pCX, y: midTopY + parshaFontPx, text: p, fontSize: parshaFontPx, fontFamily: font, fontWeight: 600, fill: eventTitleColor, textAnchor: 'middle', clipId }))
      }

      if (contentLines.length > 0 && !suppressEventHighlight) {
        const lineH = eventFontPx * 1.35
        const totalTextH = contentLines.length * lineH
        const startY = midTopY + Math.max(0, (availH - totalTextH) / 2) + eventFontPx
        const cX = cellX + cellW / 2
        contentLines.forEach((line, li) => {
          els.push(svgText({ x: cX, y: startY + li * lineH, text: abbreviateRoshChodeshHeTitle(line), fontSize: eventFontPx, fontFamily: font, fontWeight: 600, fill: eventTitleColor, textAnchor: 'middle', clipId }))
        })
      }

      // ── Zmanim (Shabbat/Yom Tov times) ──
      const times: Array<{ label: string; jer: string; ta: string }> = []

      if (
        (isFriday || isErevPesach || isErevSheviShelPesach || isRoshHashanaDay(titles) || isYomKippurDay(titles)) &&
        evJer?.candleLighting
      ) {
        const label = isYomKippurDay(titles) || isRoshHashanaDay(titles)
          ? 'כניסה'
          : isErevPesach || isErevSheviShelPesach
            ? 'כניסת החג'
            : 'כניסת השבת'
        times.push({ label, jer: evJer.candleLighting, ta: evTA?.candleLighting ?? '—' })
      }

      if (isShabbat && evJer?.havdalah) {
        const label = isPesachI || isSheviShelPesach ? 'יציאת החג' : 'יציאת השבת'
        times.push({ label, jer: evJer.havdalah, ta: evTA?.havdalah ?? '—' })
      }

      if (
        (isPesachI || isSheviShelPesach || isRoshHashanaDay(titles) || isYomKippurDay(titles)) &&
        !isShabbat && evJer?.havdalah && !evJer?.candleLighting
      ) {
        const label = isYomKippurDay(titles) || isRoshHashanaDay(titles) ? 'יציאה' : 'יציאת החג'
        times.push({ label, jer: evJer.havdalah, ta: evTA?.havdalah ?? '—' })
      }

      if (times.length > 0) {
        // Mirror .times { bottom:8px; right:10px; line-height:1.2 }
        const zmLineH = timesFontPx * 1.2
        const zmEntryH = zmLineH * 2   // each entry = label line + times line
        const blockH = times.length * zmEntryH
        const zmStartY = cellY + dateCellH - 8 - blockH
        const zmX = cellX + cellW - 10
        times.forEach(({ label, jer, ta }, ti) => {
          const baseY = zmStartY + ti * zmEntryH
          els.push(svgText({ x: zmX, y: baseY + timesFontPx, text: `${label}:`, fontSize: timesFontPx, fontFamily: font, fontWeight: 700, fill: timesColor, textAnchor: 'end', clipId }))
          els.push(svgText({ x: zmX, y: baseY + timesFontPx + zmLineH, text: `י-ם: ${jer}  ת"א: ${ta}`, fontSize: Math.max(5, Math.round(timesFontPx * 0.92)), fontFamily: font, fontWeight: 400, fill: timesColor, textAnchor: 'end', clipId }))
        })
      }
    })
  })

  // ── Grid outer border on top ──────────────────────────────────────────────
  if (gridBorderW > 0) {
    els.push(`<rect x="${gridLeft}" y="${gridTop}" width="${gridActualW}" height="${gridH}" fill="none" stroke="${esc(gridBorderColor)}" stroke-width="${gridBorderW}"/>`)
  }

  const defsContent = clipDefs.join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
  width="${SVG_W}" height="${SVG_H}" viewBox="0 0 ${SVG_W} ${SVG_H}">
<defs>
${defsContent}
</defs>
${els.join('\n')}
</svg>`
}

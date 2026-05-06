import type { CalendarSettings } from './settings'

export type PdfPageDimensionsMm = {
  widthMm: number
  heightMm: number
}

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

/** Canvas size in pixels (96dpi), matching the PDF page mm dimensions. */
export function calendarSurfaceDimensionsPx(settings: CalendarSettings): {
  widthPx: number
  heightPx: number
} {
  const { widthMm, heightMm } = resolvePdfPageDimensionsMm(settings)
  return {
    widthPx: Math.round((widthMm / 25.4) * 96),
    heightPx: Math.round((heightMm / 25.4) * 96),
  }
}

export function resolvePdfPageDimensionsMm(settings: CalendarSettings): PdfPageDimensionsMm {
  const orientation = settings.pdfOrientation

  let baseW = 297
  let baseH = 210

  if (settings.pdfPagePreset === 'A4') {
    baseW = 297
    baseH = 210
  } else if (settings.pdfPagePreset === 'A5') {
    baseW = 210
    baseH = 148
  } else {
    // Custom sizes may be missing/undefined in older configs. Fallback to A4.
    const w = Number((settings as any).pdfCustomWidthMm)
    const h = Number((settings as any).pdfCustomHeightMm)
    baseW = clamp(Number.isFinite(w) ? w : 297, 80, 420)
    baseH = clamp(Number.isFinite(h) ? h : 210, 80, 420)
  }

  // Presets are defined in long-edge x short-edge order; orientation rotates accordingly.
  if (settings.pdfPagePreset === 'A4' || settings.pdfPagePreset === 'A5') {
    if (orientation === 'landscape') {
      return { widthMm: Math.max(baseW, baseH), heightMm: Math.min(baseW, baseH) }
    }
    return { widthMm: Math.min(baseW, baseH), heightMm: Math.max(baseW, baseH) }
  }

  // Custom: treat the two numbers as user page dims, then orient.
  if (orientation === 'landscape') {
    return baseW >= baseH ? { widthMm: baseW, heightMm: baseH } : { widthMm: baseH, heightMm: baseW }
  }
  return baseH >= baseW ? { widthMm: baseW, heightMm: baseH } : { widthMm: baseH, heightMm: baseW }
}


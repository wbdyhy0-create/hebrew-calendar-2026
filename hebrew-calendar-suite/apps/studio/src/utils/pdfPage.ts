import type { CalendarSettings } from './settings';

export type PdfPageDimensionsMm = {
  widthMm: number;
  heightMm: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** גודל קנבס התצוגה בפיקסלים (96dpi), לפי אותן מילימטרים כמו עמוד PDF — לרוב A4 לרוחב. */
export function calendarSurfaceDimensionsPx(settings: CalendarSettings): {
  widthPx: number;
  heightPx: number;
} {
  const { widthMm, heightMm } = resolvePdfPageDimensionsMm(settings);
  return {
    widthPx: Math.round((widthMm / 25.4) * 96),
    heightPx: Math.round((heightMm / 25.4) * 96),
  };
}

export function resolvePdfPageDimensionsMm(settings: CalendarSettings): PdfPageDimensionsMm {
  const orientation = settings.pdfOrientation;

  let baseW = 297;
  let baseH = 210;

  if (settings.pdfPagePreset === 'A4') {
    baseW = 297;
    baseH = 210;
  } else if (settings.pdfPagePreset === 'A5') {
    baseW = 210;
    baseH = 148;
  } else {
    baseW = clamp(settings.pdfCustomWidthMm, 80, 420);
    baseH = clamp(settings.pdfCustomHeightMm, 80, 420);
  }

  // For presets, A4/A5 are commonly defined in "long edge x short edge" order.
  // The user-facing orientation should still rotate between landscape/portrait.
  if (settings.pdfPagePreset === 'A4' || settings.pdfPagePreset === 'A5') {
    if (orientation === 'landscape') {
      return { widthMm: Math.max(baseW, baseH), heightMm: Math.min(baseW, baseH) };
    }
    return { widthMm: Math.min(baseW, baseH), heightMm: Math.max(baseW, baseH) };
  }

  // custom: treat the two numbers as the user's chosen page dimensions, then orient.
  if (orientation === 'landscape') {
    return baseW >= baseH ? { widthMm: baseW, heightMm: baseH } : { widthMm: baseH, heightMm: baseW };
  }
  return baseH >= baseW ? { widthMm: baseW, heightMm: baseH } : { widthMm: baseH, heightMm: baseW };
}

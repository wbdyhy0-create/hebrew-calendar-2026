import type { CalendarSettings } from './settings';

export function getBackgroundImageForMonth(
  settings: CalendarSettings,
  monthIndex0: number, // 0..11
): string | undefined {
  if (settings.backgroundImageMode === 'perMonth') {
    const arr = settings.backgroundImagesByMonth;
    if (!Array.isArray(arr) || monthIndex0 < 0 || monthIndex0 > 11) return undefined;
    const v = arr[monthIndex0];
    return typeof v === 'string' && v.length > 0 ? v : undefined;
  }
  const v = settings.backgroundImageDataUrl;
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}


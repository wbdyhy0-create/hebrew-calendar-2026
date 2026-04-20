function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.trim().replace('#', '');
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    if ([r, g, b].some((x) => Number.isNaN(x))) return null;
    return { r, g, b };
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    if ([r, g, b].some((x) => Number.isNaN(x))) return null;
    return { r, g, b };
  }
  return null;
}

/**
 * Mix `color` on top of `white` with alpha in [0..1].
 * Returns an `rgba(...)` string.
 */
export function mixHexWithWhite(colorHex: string, alpha: number) {
  const a = clamp01(alpha);
  const rgb = hexToRgb(colorHex);
  if (!rgb) return `rgba(148, 163, 184, ${a})`;
  const r = Math.round(rgb.r * a + 255 * (1 - a));
  const g = Math.round(rgb.g * a + 255 * (1 - a));
  const b = Math.round(rgb.b * a + 255 * (1 - a));
  return `rgba(${r}, ${g}, ${b}, 1)`;
}

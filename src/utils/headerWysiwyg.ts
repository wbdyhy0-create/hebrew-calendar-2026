/**
 * WYSIWYG header layout: zones are stored as % of the classic header bar box
 * so the same values apply in web (zoom) and PDF (mm page) without px drift.
 */

export type HeaderManualRectPct = {
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
};

export type HeaderWysiwygClassicPct = {
  titles: HeaderManualRectPct;
  hebrew: HeaderManualRectPct;
  gregorian: HeaderManualRectPct;
};

export type HeaderWysiwygTextAlign = 'right' | 'center' | 'left';

export type HeaderWysiwygClassicAlign = {
  titles: HeaderWysiwygTextAlign;
  hebrew: HeaderWysiwygTextAlign;
  gregorian: HeaderWysiwygTextAlign;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function clampHeaderManualRectPct(r: HeaderManualRectPct): HeaderManualRectPct {
  return {
    xPct: clamp(r.xPct, 0, 92),
    yPct: clamp(r.yPct, 0, 92),
    wPct: clamp(r.wPct, 6, 100),
    hPct: clamp(r.hPct, 8, 100),
  };
}

/** Approximate classic 3-zone layout in physical % (LTR box; RTL text inside). */
export const DEFAULT_HEADER_WYSIWYG_CLASSIC_PCT: HeaderWysiwygClassicPct = {
  gregorian: { xPct: 3, yPct: 12, wPct: 28, hPct: 76 },
  hebrew: { xPct: 36, yPct: 14, wPct: 24, hPct: 72 },
  titles: { xPct: 60, yPct: 8, wPct: 37, hPct: 84 },
};

export const DEFAULT_HEADER_WYSIWYG_CLASSIC_ALIGN: HeaderWysiwygClassicAlign = {
  titles: 'right',
  hebrew: 'center',
  gregorian: 'left',
};

export function coerceHeaderWysiwygClassicPct(v: unknown): HeaderWysiwygClassicPct | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const zone = (key: string): HeaderManualRectPct | null => {
    const z = o[key];
    if (!z || typeof z !== 'object' || Array.isArray(z)) return null;
    const r = z as Record<string, unknown>;
    const rect: HeaderManualRectPct = {
      xPct: Number(r.xPct),
      yPct: Number(r.yPct),
      wPct: Number(r.wPct),
      hPct: Number(r.hPct),
    };
    if (![rect.xPct, rect.yPct, rect.wPct, rect.hPct].every((n) => Number.isFinite(n))) return null;
    return clampHeaderManualRectPct(rect);
  };
  const titles = zone('titles');
  const hebrew = zone('hebrew');
  const gregorian = zone('gregorian');
  if (!titles || !hebrew || !gregorian) return null;
  return { titles, hebrew, gregorian };
}

export function coerceHeaderWysiwygClassicAlign(v: unknown): HeaderWysiwygClassicAlign | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const pick = (key: string): HeaderWysiwygTextAlign | null => {
    const s = o[key];
    return s === 'right' || s === 'center' || s === 'left' ? s : null;
  };
  const titles = pick('titles');
  const hebrew = pick('hebrew');
  const gregorian = pick('gregorian');
  if (!titles || !hebrew || !gregorian) return null;
  return { titles, hebrew, gregorian };
}

export function alignRectToParentX(r: HeaderManualRectPct, align: HeaderWysiwygTextAlign): HeaderManualRectPct {
  const margin = 2;
  if (align === 'left') return clampHeaderManualRectPct({ ...r, xPct: margin });
  if (align === 'center') return clampHeaderManualRectPct({ ...r, xPct: 50 - r.wPct / 2 });
  return clampHeaderManualRectPct({ ...r, xPct: 100 - r.wPct - margin });
}

export function rectsToPct(parent: DOMRectReadOnly, child: DOMRectReadOnly): HeaderManualRectPct {
  const pw = Math.max(1, parent.width);
  const ph = Math.max(1, parent.height);
  return clampHeaderManualRectPct({
    xPct: ((child.left - parent.left) / pw) * 100,
    yPct: ((child.top - parent.top) / ph) * 100,
    wPct: (child.width / pw) * 100,
    hPct: (child.height / ph) * 100,
  });
}

export function pctToPxRect(
  pct: HeaderManualRectPct,
  pw: number,
  ph: number,
): { x: number; y: number; width: number; height: number } {
  return {
    x: (pct.xPct / 100) * pw,
    y: (pct.yPct / 100) * ph,
    width: (pct.wPct / 100) * pw,
    height: (pct.hPct / 100) * ph,
  };
}

export function snapPositionToParentCenter(
  x: number,
  y: number,
  w: number,
  h: number,
  pw: number,
  ph: number,
  thresholdPct: number,
): { x: number; y: number } {
  const tcx = pw / 2 - w / 2;
  const tcy = ph / 2 - h / 2;
  const thrX = (thresholdPct / 100) * pw;
  const thrY = (thresholdPct / 100) * ph;
  let nx = x;
  let ny = y;
  if (Math.abs(x - tcx) <= thrX) nx = tcx;
  if (Math.abs(y - tcy) <= thrY) ny = tcy;
  return { x: nx, y: ny };
}

/** Snap zone center to 50%/50% of parent when within threshold (percentage points). */
export function snapHeaderManualRectPct(r: HeaderManualRectPct, thr = 2.5): HeaderManualRectPct {
  const cx = r.xPct + r.wPct / 2;
  const cy = r.yPct + r.hPct / 2;
  let x = r.xPct;
  let y = r.yPct;
  if (Math.abs(cx - 50) <= thr) x = 50 - r.wPct / 2;
  if (Math.abs(cy - 50) <= thr) y = 50 - r.hPct / 2;
  return clampHeaderManualRectPct({ ...r, xPct: x, yPct: y });
}

export function buildHeaderWysiwygClassicPrintCss(
  pct: HeaderWysiwygClassicPct,
  align?: HeaderWysiwygClassicAlign | null,
): string {
  const a = align ?? DEFAULT_HEADER_WYSIWYG_CLASSIC_ALIGN;
  const z = (sel: string, r: HeaderManualRectPct) =>
    `.headerBar.headerWysiwyg ${sel}{position:absolute!important;left:${r.xPct}%;top:${r.yPct}%;width:${r.wPct}%;height:${r.hPct}%;box-sizing:border-box!important;min-width:0!important;overflow:visible!important;}`;
  const titlesAlign =
    a.titles === 'center'
      ? 'align-items:center!important;text-align:center!important;'
      : a.titles === 'left'
        ? 'align-items:flex-start!important;text-align:left!important;'
        : 'align-items:flex-end!important;text-align:right!important;';
  const gregJustify =
    a.gregorian === 'center'
      ? 'justify-content:center!important;'
      : a.gregorian === 'right'
        ? 'justify-content:flex-end!important;'
        : 'justify-content:flex-start!important;';
  const hebJustify =
    a.hebrew === 'center'
      ? 'justify-content:center!important;'
      : a.hebrew === 'right'
        ? 'justify-content:flex-end!important;'
        : 'justify-content:flex-start!important;';
  return `
      .headerBar.headerWysiwyg{
        display:block!important;
        position:relative!important;
        overflow:visible!important;
        min-width:0!important;
      }
      ${z('.titles', pct.titles)}
      ${z('.hebPill', pct.hebrew)}
      ${z('.gregLabel', pct.gregorian)}
      .headerBar.headerWysiwyg .titles{
        display:flex!important;
        flex-direction:column!important;
        justify-content:flex-start!important;
        ${titlesAlign}
        padding:0 8px!important;
      }
      .headerBar.headerWysiwyg .hebPill{
        display:flex!important;
        align-items:center!important;
        ${hebJustify}
        margin:0!important;
        transform:none!important;
      }
      .headerBar.headerWysiwyg .gregLabel{
        display:inline-flex!important;
        transform:none!important;
        ${gregJustify}
      }
    `;
}

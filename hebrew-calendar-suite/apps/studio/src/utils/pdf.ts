import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

import type { CalendarSettings } from './settings';
import { resolvePdfPageDimensionsMm } from './pdfPage';

// NOTE: We intentionally do not use html2pdf.js for exports anymore.
// We render via html2canvas (with `onclone`) and embed into jsPDF to match screen layout.

type TransformSnapshot = { el: HTMLElement; transformInline: string; zoomInline: string };
type TransformOriginSnapshot = { el: HTMLElement; transformOriginInline: string };
type OverflowSnapshot = { el: HTMLElement; overflowInline: string; overflowXInline: string; overflowYInline: string };
type ImportantOverflowSnapshot = { el: HTMLElement; overflowInline: string; overflowPriority: string };

function safeGetComputedTransform(el: HTMLElement): string {
  try {
    return window.getComputedStyle(el).transform || 'none';
  } catch {
    return 'none';
  }
}

function safeGetComputedLayoutScale(el: HTMLElement): number {
  // Our zoom wrapper uses `--layoutScale` (set in CSS). Prefer that if present.
  try {
    const s = window.getComputedStyle(el);
    const raw = s.getPropertyValue('--layoutScale') || '';
    const v = parseFloat(String(raw).trim());
    if (Number.isFinite(v) && v > 0) return v;
  } catch {
    // ignore
  }
  return 1;
}

async function captureElementWithoutTransform(
  el: HTMLElement,
  opts: { scale: number; widthMm?: number; heightMm?: number; label?: string },
): Promise<HTMLCanvasElement> {
  const { scale, widthMm, heightMm } = opts;
  const rect = el.getBoundingClientRect();
  const rectW = Math.max(1, Math.ceil(rect.width));
  const rectH = Math.max(1, Math.ceil(rect.height));

  // IMPORTANT: transforms can exist on ancestors of `el` (layout zoom wrappers),
  // and cloning would lose our temporary overrides. So we capture `el` as-is,
  // while temporarily overriding transforms on BOTH ancestors + descendants.
  const saved: TransformSnapshot[] = [];
  const savedOrigins: TransformOriginSnapshot[] = [];
  const savedOverflow: OverflowSnapshot[] = [];
  const savedMidWrapOverflow: ImportantOverflowSnapshot[] = [];

  function markOverflowVisible(candidates: HTMLElement[]) {
    const seen = new Set<HTMLElement>();
    for (const e of candidates) {
      if (!e || seen.has(e)) continue;
      seen.add(e);
      let style: CSSStyleDeclaration | null = null;
      try {
        style = window.getComputedStyle(e);
      } catch {
        style = null;
      }
      const ox = style?.overflowX || '';
      const oy = style?.overflowY || '';
      const o = style?.overflow || '';
      const clips =
        o === 'hidden' ||
        o === 'clip' ||
        ox === 'hidden' ||
        ox === 'clip' ||
        oy === 'hidden' ||
        oy === 'clip';
      if (!clips) continue;
      savedOverflow.push({
        el: e,
        overflowInline: e.style.overflow || '',
        overflowXInline: e.style.overflowX || '',
        overflowYInline: e.style.overflowY || '',
      });
      e.style.overflow = 'visible';
      e.style.overflowX = 'visible';
      e.style.overflowY = 'visible';
    }
  }

  const toWalk: HTMLElement[] = [];
  // Walk ancestors (including self)
  for (let p: HTMLElement | null = el; p; p = p.parentElement) {
    toWalk.push(p);
  }
  // Walk descendants
  toWalk.push(
    ...Array.from(el.querySelectorAll('*')).filter((n): n is HTMLElement => n instanceof HTMLElement),
  );

  const seen = new Set<HTMLElement>();
  for (const e of toWalk) {
    if (seen.has(e)) continue;
    seen.add(e);

    const computedTransform = safeGetComputedTransform(e);
    const hasTransform = computedTransform && computedTransform !== 'none';
    const isZoomWrap = e.classList.contains('calendarLayoutZoom');
    if (!hasTransform && !isZoomWrap) continue;

    saved.push({
      el: e,
      transformInline: e.style.transform || '',
      zoomInline: (e.style as any).zoom || '',
    });
    savedOrigins.push({
      el: e,
      transformOriginInline: e.style.transformOrigin || '',
    });

    // Prefer zoom over transform for layout scaling.
    if (isZoomWrap) {
      const layoutScale = safeGetComputedLayoutScale(e);
      (e.style as any).zoom = String(layoutScale || 1);
    }
    e.style.transform = 'none';
    e.style.transformOrigin = 'top left';
  }

  // Prevent clipping in capture when layout uses overflow hidden/clip.
  markOverflowVisible(toWalk);

  // Critical: event text clipping happens in `.midWrap`. Force it visible with !important
  // during capture (plain inline style can lose against stylesheet !important).
  const midWraps = toWalk.filter((e) => e.classList?.contains('midWrap'));
  for (const mw of midWraps) {
    savedMidWrapOverflow.push({
      el: mw,
      overflowInline: mw.style.overflow || '',
      overflowPriority: mw.style.getPropertyPriority('overflow') || '',
    });
    mw.style.setProperty('overflow', 'visible', 'important');
  }

  // Allow layout to settle after removing transforms.
  await new Promise<void>((r) => requestAnimationFrame(() => r()));

  const stage: HTMLDivElement | null =
    widthMm && heightMm
      ? (() => {
          const s = document.createElement('div');
          s.style.position = 'fixed';
          s.style.left = '0';
          s.style.top = '0';
          // Keep the same rendered geometry as the live element, so slider-driven absolute
          // positions (right/top in px) match Studio exactly in the captured PDF.
          s.style.width = `${rectW}px`;
          s.style.height = `${rectH}px`;
          s.style.minHeight = `${rectH}px`;
          s.style.background = '#ffffff';
          s.style.pointerEvents = 'none';
          // IMPORTANT: opacity:0 makes the capture all-white.
          s.style.opacity = '1';
          // IMPORTANT: keep it *above* the app during capture.
          // Some browsers/layouts do not paint z-index:-1 content reliably for html2canvas,
          // resulting in an all-white canvas even when the DOM exists.
          s.style.zIndex = '2147483647';
          s.style.overflow = 'visible';
          s.style.transform = 'none';
          s.style.boxSizing = 'border-box';
          return s;
        })()
      : null;

  // If a stage is requested, mount a clone of the element into the stage so it's guaranteed
  // to be inside the viewport for capture (html2canvas can return blank for far-offscreen targets).
  // Note: we still removed transforms on the original ancestors/descendants so layout matches.
  const target = stage ? stage : el;
  let cloneMounted = false;
  if (stage) {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.style.width = `${rectW}px`;
    clone.style.minWidth = `${rectW}px`;
    clone.style.maxWidth = `${rectW}px`;
    clone.style.boxSizing = 'border-box';
    stage.appendChild(clone);
    cloneMounted = true;
    document.body.appendChild(stage);

    // Also strip transforms inside the staged clone itself (since clone re-evaluates class-based transforms).
    const stagedEls = [stage, ...Array.from(stage.querySelectorAll('*'))].filter(
      (n): n is HTMLElement => n instanceof HTMLElement,
    );
    for (const e of stagedEls) {
      const computedTransform = safeGetComputedTransform(e);
      const hasTransform = computedTransform && computedTransform !== 'none';
      const isZoomWrap = e.classList.contains('calendarLayoutZoom');
      if (!hasTransform && !isZoomWrap) continue;

      saved.push({
        el: e,
        transformInline: e.style.transform || '',
        zoomInline: (e.style as any).zoom || '',
      });
      savedOrigins.push({
        el: e,
        transformOriginInline: e.style.transformOrigin || '',
      });
      if (isZoomWrap) {
        const layoutScale = safeGetComputedLayoutScale(e);
        (e.style as any).zoom = String(layoutScale || 1);
      }
      e.style.transform = 'none';
      e.style.transformOrigin = 'top left';
    }

    // Also prevent clipping in the staged clone subtree.
    markOverflowVisible(stagedEls);
    const stagedMidWraps = stagedEls.filter((e) => e.classList?.contains('midWrap'));
    for (const mw of stagedMidWraps) {
      savedMidWrapOverflow.push({
        el: mw,
        overflowInline: mw.style.overflow || '',
        overflowPriority: mw.style.getPropertyPriority('overflow') || '',
      });
      mw.style.setProperty('overflow', 'visible', 'important');
    }
  }

  // Allow the stage/clone to paint before capture (prevents occasional all-white captures).
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  await new Promise<void>((r) => requestAnimationFrame(() => r()));

  try {
    return await html2canvas(target as any, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    });
  } finally {
    if (stage) {
      try {
        stage.remove();
      } catch {
        // ignore
      }
    }
    void cloneMounted;
    for (const s of saved) {
      s.el.style.transform = s.transformInline;
      (s.el.style as any).zoom = s.zoomInline;
    }
    for (const o of savedOrigins) {
      o.el.style.transformOrigin = o.transformOriginInline;
    }
    for (const o of savedOverflow) {
      o.el.style.overflow = o.overflowInline;
      o.el.style.overflowX = o.overflowXInline;
      o.el.style.overflowY = o.overflowYInline;
    }
    for (const o of savedMidWrapOverflow) {
      if (o.overflowInline) {
        o.el.style.setProperty('overflow', o.overflowInline, o.overflowPriority || '');
      } else {
        o.el.style.removeProperty('overflow');
      }
    }
  }
}

export async function exportPdfBlobFromHtml(
  html: string,
  settings: CalendarSettings,
  opts?: { multiPage?: boolean },
) {
  const parsed = new DOMParser().parseFromString(html, 'text/html');

  const { widthMm, heightMm } = resolvePdfPageDimensionsMm(settings);
  // html2canvas uses `windowWidth` as a CSS-pixel width hint. Convert mm -> px at 96dpi.
  const windowWidthPx = Math.max(900, Math.ceil((widthMm / 25.4) * 96));
  const windowHeightPx = Math.max(600, Math.ceil((heightMm / 25.4) * 96));

  const container = document.createElement('div');
  container.style.position = 'fixed';
  // Keep the render target inside the viewport; some html2canvas modes can return a blank canvas
  // when the element is positioned far off-screen.
  container.style.left = '0';
  container.style.top = '0';
  container.style.width = `${widthMm}mm`;
  container.style.height = `${heightMm}mm`;
  container.style.minHeight = `${heightMm}mm`;
  container.style.background = '#ffffff';
  container.style.opacity = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '-1';
  /* overflow:hidden חותך transform/אותיות מעל הקנבס ב־html2canvas */
  container.style.overflow = 'visible';
  container.setAttribute('dir', parsed.documentElement.getAttribute('dir') ?? 'ltr');
  container.innerHTML = parsed.body.innerHTML;
  document.body.appendChild(container);
  const calendarElement = container.querySelector('#calendar-container') as HTMLElement | null;

  const tempStyles: HTMLStyleElement[] = [];
  parsed.head.querySelectorAll('style').forEach((styleNode) => {
    const style = document.createElement('style');
    style.textContent = styleNode.textContent;
    style.setAttribute('data-pdf-temp-style', '1');
    document.head.appendChild(style);
    tempStyles.push(style);
  });

  /** Printable HTML may include Google Fonts `<link>`s; they are not in `innerHTML`, so clone them here. */
  const tempLinks: HTMLLinkElement[] = [];
  const existingLinkHrefs = new Set(
    Array.from(document.querySelectorAll('link[href]')).map((n) => (n as HTMLLinkElement).href),
  );
  parsed.head.querySelectorAll('link[rel="stylesheet"], link[rel="preconnect"]').forEach((node) => {
    const link = node as HTMLLinkElement;
    if (!link.href || existingLinkHrefs.has(link.href)) return;
    existingLinkHrefs.add(link.href);
    const clone = link.cloneNode(true) as HTMLLinkElement;
    clone.setAttribute('data-pdf-temp-link', '1');
    document.head.appendChild(clone);
    tempLinks.push(clone);
  });

  await Promise.all(
    tempLinks
      .filter((l) => l.rel === 'stylesheet')
      .map(
        (l) =>
          new Promise<void>((resolve) => {
            if (l.sheet) return resolve();
            l.onload = () => resolve();
            l.onerror = () => resolve();
            setTimeout(resolve, 4000);
          }),
      ),
  );

  try {
    await document.fonts.ready;
  } catch {
    // ignore font wait failures
  }

  const images = Array.from(container.querySelectorAll('img'));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) return resolve();
          img.onload = () => resolve();
          img.onerror = () => resolve();
        }),
    ),
  );

  if (calendarElement) {
    calendarElement.style.display = 'block';
    calendarElement.style.width = `${widthMm}mm`;
    calendarElement.style.overflow = 'visible';
    if (!opts?.multiPage) {
      /* גובה קשיח חותך תוכן עם translateY שלילי; min-height שומר על עמוד מלא */
      calendarElement.style.height = 'auto';
      calendarElement.style.minHeight = `${heightMm}mm`;
    }
    calendarElement.style.direction = 'ltr';
    calendarElement.classList.add('pdfMode');
    const canvases = Array.from(calendarElement.querySelectorAll('.canvas')) as HTMLElement[];
    canvases.forEach((canvas) => {
      canvas.style.display = 'block';
      canvas.style.width = `${widthMm}mm`;
      canvas.style.overflow = 'visible';
      if (!opts?.multiPage) {
        canvas.style.height = 'auto';
        canvas.style.minHeight = `${heightMm}mm`;
      }
    });
    const grids = Array.from(calendarElement.querySelectorAll('.grid')) as HTMLElement[];
    grids.forEach((grid) => {
      // html2canvas renders "screen" media, so enforce the 7-column layout inline.
      // RTL keeps Sunday on the right, matching the live preview.
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = 'repeat(7, 1fr)';
      grid.style.width = '100%';
      grid.style.direction = 'rtl';
    });
  }

  const target = calendarElement ?? container;

  const jsPdfFormat = [widthMm, heightMm] as [number, number];
  const jsPdfOrientation: 'landscape' | 'portrait' = widthMm >= heightMm ? 'landscape' : 'portrait';

  const marginMmRaw = Number(settings.pdfMarginMm);
  const marginMm = Number.isFinite(marginMmRaw) ? Math.max(0, marginMmRaw) : 0;

  function wrapPdfStage<T>(stage: string, fn: () => T): T {
    try {
      return fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`PDF: stage "${stage}" failed. ${msg}`);
    }
  }

  async function wrapPdfStageAsync<T>(stage: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`PDF: stage "${stage}" failed. ${msg}`);
    }
  }

  function addImageToPdfSafe(
    doc: jsPDF,
    canvas: HTMLCanvasElement,
    x: number,
    y: number,
    w: number,
    h: number,
    pageIndex: number,
  ) {
    const alias = `page-${pageIndex}`;
    const attempts: Array<{ label: string; run: () => void }> = [
      // Newer jsPDF versions support an options object.
      {
        label: "addImage({ imageData: canvas, format: 'PNG' })",
        run: () =>
          (doc as any).addImage({
            imageData: canvas,
            format: 'PNG',
            x,
            y,
            w,
            h,
            alias,
          }),
      },
      // Clean overloads (avoid passing undefined + compression, which can trigger internal parser bugs).
      {
        label: "addImage(canvas, 'PNG')",
        run: () => doc.addImage(canvas as unknown as HTMLCanvasElement, 'PNG', x, y, w, h),
      },
      {
        label: 'addImage(canvas)',
        run: () => (doc as any).addImage(canvas, x, y, w, h),
      },
      // Fallbacks: dataURL.
      {
        label: "addImage(dataURL, 'PNG')",
        run: () => {
          const dataUrl = canvas.toDataURL('image/png', 1.0);
          doc.addImage(dataUrl, 'PNG', x, y, w, h);
        },
      },
      {
        label: 'addImage(dataURL)',
        run: () => {
          const dataUrl = canvas.toDataURL('image/png', 1.0);
          (doc as any).addImage(dataUrl, x, y, w, h);
        },
      },
    ];

    const failures: Array<{ label: string; message: string }> = [];
    for (const a of attempts) {
      try {
        a.run();
        return;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        failures.push({ label: a.label, message: msg });
      }
    }
    const details = failures
      .map((f) => `${f.label}: ${f.message}`)
      .join(' | ');
    throw new Error(`PDF: jsPDF addImage failed after ${failures.length} attempts. ${details}`);
  }

  async function renderWithHtml2CanvasThenPdf() {
    const pageW = widthMm;
    const pageH = heightMm;
    const contentW = Math.max(1, pageW - marginMm * 2);
    const contentH = Math.max(1, pageH - marginMm * 2);

    const doc = wrapPdfStage('jsPDF ctor', () => {
      return new jsPDF({
        unit: 'mm',
        format: jsPdfFormat,
        orientation: jsPdfOrientation,
        compress: true,
      });
    });

    const nodes: HTMLElement[] = opts?.multiPage
      ? Array.from((calendarElement ?? container).querySelectorAll('.canvas')) as HTMLElement[]
      : [target as HTMLElement];

    const scale = Math.min(3, Math.max(1, Math.round(Number(settings.pdfHtml2CanvasScale) || 2)));

    function assertCanvasNotBlank(canvas: HTMLCanvasElement, label: string) {
      const w = canvas.width;
      const h = canvas.height;
      if (!w || !h) throw new Error(`Blank canvas (${label}): zero size ${w}x${h}.`);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return; // can't verify; assume ok
      let img: ImageData;
      try {
        img = ctx.getImageData(0, 0, w, h);
      } catch {
        return;
      }
      const data = img.data;
      const samplePoints = [
        [Math.floor(w * 0.1), Math.floor(h * 0.1)],
        [Math.floor(w * 0.5), Math.floor(h * 0.2)],
        [Math.floor(w * 0.5), Math.floor(h * 0.5)],
        [Math.floor(w * 0.8), Math.floor(h * 0.5)],
        [Math.floor(w * 0.9), Math.floor(h * 0.9)],
      ] as const;
      for (const [sx, sy] of samplePoints) {
        const x = Math.min(w - 1, Math.max(0, sx));
        const y = Math.min(h - 1, Math.max(0, sy));
        const i = (y * w + x) * 4;
        const [r, g, b, a] = [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!];
        // Treat fully transparent or non-white as non-blank.
        if (a !== 255) return;
        if (r !== 255 || g !== 255 || b !== 255) return;
      }
      throw new Error(`Blank canvas (${label}): rendered all-white sample.`);
    }

    const buildOnClone = () => (clonedDoc: Document) => {
      const root = clonedDoc.querySelector('#calendar-container') as HTMLElement | null;
      const scope = root ?? clonedDoc.body;

      if (root) {
        // Force full-page box in the clone so the background fills the capture.
        root.style.setProperty('width', `${widthMm}mm`, 'important');
        root.style.setProperty('height', `${heightMm}mm`, 'important');
        root.style.setProperty('min-height', `${heightMm}mm`, 'important');
      }

      // Some CSS features can trip html2canvas parsers in certain builds/browsers.
      // Remove backdrop filters and other effects in the clone.
      scope.querySelectorAll<HTMLElement>('*').forEach((n) => {
        const s = (n.style as any);
        if (s?.backdropFilter) n.style.removeProperty('backdrop-filter');
        if (s?.webkitBackdropFilter) n.style.removeProperty('-webkit-backdrop-filter');
      });

      // PDF auto-fit: make grid row heights deterministic across browsers.
      // Some browsers (notably Edge) can report 0/incorrect DOMRect heights in html2canvas clones,
      // which collapses the weekday row and "cuts" the first week.
      if (root) {
        // Always auto-fit for PDF exports so the calendar fills the page (A4 landscape, etc),
        // regardless of the interactive setting. This avoids “folding”/excess whitespace in 5-week months,
        // and handles `grid_integrated` which adds an extra header row inside the grid.
        root.classList.add('pdfAutoFit');
        const canv = root.querySelector('.canvas') as HTMLElement | null;
        const grids = Array.from(root.querySelectorAll('.grid')) as HTMLElement[];
        const canvasRect = canv?.getBoundingClientRect();

        grids.forEach((gridEl) => {
          const gridRect = gridEl.getBoundingClientRect();
          const gridStyle = getComputedStyle(gridEl);
          const padT = Number.parseFloat(gridStyle.paddingTop || '0') || 0;
          const padB = Number.parseFloat(gridStyle.paddingBottom || '0') || 0;
          const rowGap = Number.parseFloat((gridStyle as any).rowGap || gridStyle.gap || '0') || 0;

          const cellEls = Array.from(gridEl.querySelectorAll('.cell')) as HTMLElement[];
          const weeks = Math.max(5, Math.min(6, Math.round((cellEls.length / 7) || 6)));
          const dowEl = gridEl.querySelector('.dow') as HTMLElement | null;
          const dowH = Math.max(18, Math.round(dowEl?.getBoundingClientRect().height || 0));

          const integratedHeaderEl = gridEl.querySelector('.integratedHeader') as HTMLElement | null;
          const integratedHeaderH = integratedHeaderEl
            ? Math.max(30, Math.round(integratedHeaderEl.getBoundingClientRect().height || 0))
            : 0;

          // Use the real available vertical space inside the canvas for this grid.
          // Prefer the canvas box if present; otherwise fall back to the page box.
          const avail = canvasRect
            ? Math.max(120, canvasRect.height - (gridRect.top - canvasRect.top))
            : Math.max(120, gridRect.height);

          const totalRows = (integratedHeaderH ? 1 : 0) + 1 + weeks; // header + dow + weeks
          const gapsTotal = Math.max(0, totalRows - 1) * rowGap;
          const usable = Math.max(120, avail - padT - padB - gapsTotal);
          const cellH = Math.max(60, Math.floor((usable - integratedHeaderH - dowH) / weeks));

          root.style.setProperty('--pdfAutoCellHeightPx', `${cellH}px`);
          gridEl.style.gridAutoRows = 'unset';
          gridEl.style.gridTemplateRows = `${
            integratedHeaderH ? `${integratedHeaderH}px ` : ''
          }${dowH}px repeat(${weeks}, ${cellH}px)`;
        });
      }

      if (root && !opts?.multiPage) {
        root.style.setProperty('overflow', 'visible', 'important');
        root.style.setProperty('height', 'auto', 'important');
        root.style.setProperty('min-height', `${heightMm}mm`, 'important');
      }
      scope.querySelectorAll<HTMLElement>('.canvas').forEach((c) => {
        c.style.setProperty('overflow', 'visible', 'important');
        if (!opts?.multiPage) {
          c.style.setProperty('height', 'auto', 'important');
          c.style.setProperty('min-height', `${heightMm}mm`, 'important');
        }
      });

      // Force grid layout and centered headers in the clone before capture.
      // RTL keeps Sunday on the right, matching the live preview.
      scope.querySelectorAll<HTMLElement>('.grid').forEach((grid) => {
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(7, 1fr)';
        grid.style.width = '100%';
        grid.style.direction = 'rtl';
        (grid.style as any).alignContent = 'center';
      });

      // Avoid `transform: scale()` during capture: html2canvas lays out by DOM boxes,
      // and transform scale can visually move content without affecting layout.
      // Use `zoom` so the scaled size participates in layout and stays centered.
      scope.querySelectorAll<HTMLElement>('.calendarLayoutZoom').forEach((el) => {
        const rawScale = el.style.getPropertyValue('--layoutScale');
        const scale = parseFloat(rawScale) || 1;
        el.style.removeProperty('--layoutScale');
        (el.style as any).zoom = String(scale);
        el.style.width = '100%';
        el.style.transform = 'none';
        el.style.margin = '0';
        el.style.boxSizing = 'border-box';
      });

      // Center the zoom wrapper within the page.
      scope.querySelectorAll<HTMLElement>('.layoutStage').forEach((st) => {
        st.style.setProperty('display', 'flex', 'important');
        st.style.setProperty('justify-content', 'center', 'important');
        st.style.setProperty('align-items', 'center', 'important');
      });

      scope.querySelectorAll<HTMLElement>('.tableOffsetWrap').forEach((w) => {
        w.style.setProperty('width', '100%', 'important');
        w.style.setProperty('box-sizing', 'border-box', 'important');
        w.style.removeProperty('margin-left');
        w.style.removeProperty('margin-right');
      });

      scope.querySelectorAll<HTMLElement>('.dow').forEach((dow) => {
        dow.style.display = 'flex';
        dow.style.alignItems = 'center';
        dow.style.justifyContent = 'center';
      });

      scope
        .querySelectorAll<HTMLElement>('.headerMinimal, .headerRightBlockShell, .headerCenteredPillShell')
        .forEach((hb) => {
          hb.style.setProperty('display', 'block', 'important');
          hb.style.setProperty('position', 'relative', 'important');
        });
      scope.querySelectorAll<HTMLElement>('.headerBar.headerWysiwyg').forEach((hb) => {
        hb.style.setProperty('display', 'block', 'important');
        hb.style.setProperty('position', 'relative', 'important');
      });
      scope.querySelectorAll<HTMLElement>('.headerBar:not(.headerWysiwyg)').forEach((hb) => {
        hb.style.setProperty('display', 'grid', 'important');
        hb.style.setProperty(
          'grid-template-columns',
          'minmax(0, 1fr) auto minmax(0, 1fr)',
          'important',
        );
        hb.style.setProperty('align-items', 'center', 'important');
        hb.style.setProperty('position', 'relative', 'important');
      });

    };

    async function renderElementToCanvas(el: HTMLElement, pageIndex: number) {
      const stageBase = `html2canvas (page ${pageIndex + 1}/${nodes.length})`;
      const onclone = buildOnClone();
      const backgroundColor = '#ffffff';

      // Strategy A: default renderer (best fidelity).
      try {
        const canvas = await wrapPdfStageAsync(`${stageBase} [default]`, async () => {
          return await html2canvas(el, {
            scale,
            useCORS: true,
            backgroundColor,
            windowWidth: windowWidthPx,
            windowHeight: windowHeightPx,
            scrollX: 0,
            scrollY: 0,
            onclone,
          });
        });
        assertCanvasNotBlank(canvas, `${stageBase} [default]`);
        return canvas;
      } catch {
        // Strategy B: foreignObject renderer is less strict with CSS parsing in some environments.
        const canvas = await wrapPdfStageAsync(`${stageBase} [foreignObjectRendering]`, async () => {
          return await html2canvas(el, {
            scale: 1, // foreignObject is already expensive; keep it stable
            useCORS: true,
            foreignObjectRendering: true,
            backgroundColor,
            windowWidth: windowWidthPx,
            windowHeight: windowHeightPx,
            scrollX: 0,
            scrollY: 0,
            onclone,
          } as any);
        });
        assertCanvasNotBlank(canvas, `${stageBase} [foreignObjectRendering]`);
        return canvas;
      }
    }

    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i]!;
      const canvas = await renderElementToCanvas(el, i);

      if (i > 0) doc.addPage();
      wrapPdfStage(`jsPDF addImage (page ${i + 1}/${nodes.length})`, () => {
        // Stretch capture to the PDF page content box.
        addImageToPdfSafe(doc, canvas, marginMm, marginMm, contentW, contentH, i);
      });
    }

    return wrapPdfStage('jsPDF output(blob)', () => {
      // jsPDF supports blob output; avoids Chrome async download gesture issues.
      return doc.output('blob') as Blob;
    });
  }

  try {
    try {
      // Prefer explicit html2canvas -> jsPDF pipeline to match on-screen layout/alignment.
      // Keeps layout stable by using `onclone` before capture.
      return await renderWithHtml2CanvasThenPdf();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Always wrap so the UI message is consistent and includes context,
      // even if the failure happens before `addImageToPdfSafe`.
      throw new Error(`PDF: export failed. ${msg}`);
    }
  } finally {
    container.remove();
    tempStyles.forEach((style) => style.remove());
    tempLinks.forEach((link) => link.remove());
  }
}

function buildCaptureOnClone(
  sourceEl: HTMLElement,
  opts: { widthMm: number; heightMm: number },
): (clonedDoc: Document) => void {
  const { widthMm, heightMm } = opts;
  const liveCapRoot = sourceEl.querySelector<HTMLElement>('[data-pdf-capture-root="true"]');
  const liveCaptureTransform = liveCapRoot?.style.transform ?? '';
  const scaleM = /scale\(([\d.]+)\)/.exec(liveCaptureTransform);
  const captureScale = scaleM ? Math.max(0.05, parseFloat(scaleM[1]!)) : 1;

  const liveBgRect = sourceEl.getBoundingClientRect();
  const liveGrid = sourceEl.querySelector<HTMLElement>('[data-inspect="month-grid"]');
  const liveDow = liveGrid?.querySelector<HTMLElement>('[data-inspect="weekdays"]');

  const dowHVisual = liveDow ? Math.max(20 * captureScale, liveDow.getBoundingClientRect().height) : 40 * captureScale;
  const dowH = Math.max(30, Math.round(dowHVisual / captureScale));

  const liveCells = liveGrid ? Array.from(liveGrid.querySelectorAll('[data-inspect="cell"]')) : [];
  const weekRows = Math.max(5, Math.min(6, Math.round(liveCells.length / 7) || 6));

  const liveGridRect = liveGrid?.getBoundingClientRect();
  const spaceAboveVisualPx = liveGridRect
    ? Math.max(0, Math.round(liveGridRect.top - liveBgRect.top))
    : 80 * captureScale;
  const spaceAbovePx = Math.round(spaceAboveVisualPx / captureScale);

  const a4HeightPx = Math.round((heightMm / 25.4) * 96);
  const a4WidthPx = Math.round((widthMm / 25.4) * 96);
  const gridHeightPx = Math.max(300, a4HeightPx - spaceAbovePx);

  // ────────────────────────────────────────────────────────────────────────────
  // Live measurements for html2canvas compensation.
  //
  // html2canvas mis-renders two common patterns:
  //   1) `transform: translateY(calc(-50% + Ypx))` on absolutely-positioned
  //      header boxes. The library can't resolve `-50%` correctly against the
  //      box height, so the title appears to "drop" toward the bottom of the
  //      bar in the PDF.
  //   2) `display: flex; align-items: center` with inline transforms on the
  //      weekday header cells. The text drifts toward the bottom of the green
  //      band, even though the cell is asked to center its content.
  //
  // Strategy: measure each tricky element's final, browser-rendered geometry
  // live (before the clone). Then in the clone, REPLACE the calc()/flex centering
  // with simple, html2canvas-friendly CSS that mathematically reproduces the
  // same visual position — but uses only properties html2canvas reliably handles
  // (pixel `top`, padding, `align-items: flex-start`). The user's slider Y
  // offsets are naturally preserved because they were already baked into the
  // measured rect.
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Pre-computed absolute pixel coordinates for each header box, replacing
   * the `top: barMidY + transform: translate(Xpx, calc(-50% + Ypx))` recipe
   * with plain `top`/`left` values html2canvas can render without arithmetic.
   */
  type HeaderBoxMeta = {
    index: number;
    bakedTopPx: number;
    bakedLeftPx: number;
    widthPx: number;
  };

  const liveHeader = sourceEl.querySelector<HTMLElement>('[data-inspect="header"]');
  const headerRect = liveHeader?.getBoundingClientRect();
  const headerBoxesMeta: HeaderBoxMeta[] = [];
  if (liveHeader && headerRect) {
    const liveBoxes = Array.from(liveHeader.children) as HTMLElement[];
    liveBoxes.forEach((box, idx) => {
      if (box.style.position !== 'absolute') return;
      const r = box.getBoundingClientRect();
      const bakedTopPx = Math.round((r.top - headerRect.top) / captureScale);
      const bakedLeftPx = Math.round((r.left - headerRect.left) / captureScale);
      const widthPx = Math.max(0, Math.round(r.width / captureScale));
      headerBoxesMeta.push({ index: idx, bakedTopPx, bakedLeftPx, widthPx });
    });
  }

  /**
   * Pre-computed padding values for each weekday cell so html2canvas can
   * vertically center the day name without relying on `align-items: center`.
   * Uses the live-measured offset of the inner text wrapper.
   */
  type WeekdayMeta = {
    cellIdx: number;
    paddingTopPx: number;
    paddingBottomPx: number;
  };
  const weekdayMeta: WeekdayMeta[] = [];
  if (liveGrid) {
    const liveWeekdays = Array.from(
      liveGrid.querySelectorAll('[data-inspect="weekdays"]'),
    ) as HTMLElement[];
    liveWeekdays.forEach((cell, idx) => {
      const cellRect = cell.getBoundingClientRect();
      const inner = cell.firstElementChild as HTMLElement | null;
      const innerRect = inner?.getBoundingClientRect();
      if (!innerRect) return;
      const innerTopPx = (innerRect.top - cellRect.top) / captureScale;
      const innerBottomPx = (cellRect.bottom - innerRect.bottom) / captureScale;
      weekdayMeta.push({
        cellIdx: idx,
        paddingTopPx: Math.max(0, Math.round(innerTopPx)),
        paddingBottomPx: Math.max(0, Math.round(innerBottomPx)),
      });
    });
  }

  return (clonedDoc: Document) => {
    const bg = clonedDoc.querySelector<HTMLElement>('[data-pdf-target="true"]');
    if (bg) {
      bg.style.setProperty('width', `${a4WidthPx}px`, 'important');
      bg.style.setProperty('height', `${a4HeightPx}px`, 'important');
      bg.style.setProperty('min-height', `${a4HeightPx}px`, 'important');
      bg.style.setProperty('overflow', 'visible', 'important');
    }

    const captureRoot = clonedDoc.querySelector<HTMLElement>('[data-pdf-capture-root="true"]');
    if (captureRoot) {
      captureRoot.style.setProperty('transform', 'none', 'important');
      captureRoot.style.setProperty('transform-origin', 'unset', 'important');
      captureRoot.style.setProperty('width', '100%', 'important');
      captureRoot.style.setProperty('overflow', 'visible', 'important');
    }

    const clonedHeader = clonedDoc.querySelector<HTMLElement>('[data-inspect="header"]');
    if (clonedHeader) {
      // Replace each header box's `top + right + transform(translateX, calc(-50%+Y))`
      // recipe with a single pair of `top/left` absolute coordinates. html2canvas
      // mis-evaluates `calc(-50% + Ypx)` (drops the half-height term) so the box
      // sinks toward the bottom of the bar; using pre-baked pixel coordinates
      // sidesteps that math entirely. The user's Y slider is preserved because
      // the live `getBoundingClientRect` already incorporated it.
      const clonedBoxes = Array.from(clonedHeader.children) as HTMLElement[];
      headerBoxesMeta.forEach((meta) => {
        const cloneBox = clonedBoxes[meta.index];
        if (!cloneBox) return;
        cloneBox.style.setProperty('top', `${meta.bakedTopPx}px`, 'important');
        cloneBox.style.setProperty('left', `${meta.bakedLeftPx}px`, 'important');
        cloneBox.style.setProperty('right', 'auto', 'important');
        cloneBox.style.setProperty('bottom', 'auto', 'important');
        cloneBox.style.setProperty('transform', 'none', 'important');
      });
    }

    // Center the weekday header text using padding instead of `align-items: center`.
    // html2canvas reliably honors padding + `align-items: flex-start`, but its
    // flex-center implementation drops the text toward the bottom of the green band.
    if (weekdayMeta.length > 0) {
      const clonedWeekdayCells = clonedDoc.querySelectorAll<HTMLElement>(
        '[data-inspect="weekdays"]',
      );
      weekdayMeta.forEach((meta) => {
        const cell = clonedWeekdayCells[meta.cellIdx];
        if (!cell) return;
        cell.style.setProperty('align-items', 'flex-start', 'important');
        cell.style.setProperty('padding-top', `${meta.paddingTopPx}px`, 'important');
        cell.style.setProperty('padding-bottom', `${meta.paddingBottomPx}px`, 'important');
        cell.style.setProperty('box-sizing', 'border-box', 'important');
      });
    }

    const monthGrid = clonedDoc.querySelector<HTMLElement>('[data-inspect="month-grid"]');
    if (monthGrid) {
      monthGrid.style.setProperty('width', '100%', 'important');
      monthGrid.style.setProperty('height', `${gridHeightPx}px`, 'important');
      monthGrid.style.setProperty('min-height', `${gridHeightPx}px`, 'important');
      monthGrid.style.setProperty('display', 'grid', 'important');
      monthGrid.style.setProperty('grid-template-columns', 'repeat(7, minmax(0, 1fr))', 'important');
      monthGrid.style.setProperty('grid-template-rows', `${dowH}px repeat(${weekRows}, 1fr)`, 'important');
      monthGrid.style.setProperty('align-content', 'stretch', 'important');
    }

    const scope = bg ?? clonedDoc.body;
    // html2canvas renders absolutely-positioned children of a padded box noticeably LOWER than the
    // live browser does. The legacy printMonth path compensates with `.pdfMode .topRight { top: -2px }`
    // (overriding the live `top: 8`). Studio cells use `data-pdf-date-block` (live `top: 1`) and need
    // an even larger compensation so the exported date sits at the cell roof — not floating mid-cell.
    // Empirically, the delta is ~15px for studio cell typography; push the clone date block up to
    // `top: -14px` (1px live → -14px in clone) so the printed dates kiss the cell roof, matching the
    // on-screen preview as closely as html2canvas allows.
    scope.querySelectorAll<HTMLElement>('[data-pdf-date-block="true"]').forEach((n) => {
      n.style.setProperty('top', '-14px', 'important');
      n.style.setProperty('bottom', 'auto', 'important');
      n.style.setProperty('padding-top', '0', 'important');
      n.style.setProperty('margin-top', '0', 'important');
      // html2canvas does not honor `align-items: baseline` correctly for inline-block flex items
      // that carry transforms — it falls back to top-alignment, which makes the smaller Hebrew
      // letter "float" above the larger Gregorian number. Force bottom-alignment in the clone:
      // for short text without descenders (numerals + Hebrew letters), `flex-end` is visually
      // identical to baseline alignment, so the Hebrew date sits flush with the bottom of the
      // Gregorian digits — matching the Studio's live preview.
      n.style.setProperty('align-items', 'flex-end', 'important');

      // Hebrew font metrics report a slightly higher visual bottom than Latin digits in the
      // same point size, so `align-items: flex-end` leaves the Hebrew letter sitting a couple
      // pixels above the baseline of the Gregorian number. Append a small downward translate
      // to the Hebrew span (`.font-medium`) so it visually rests on the same baseline.
      n.querySelectorAll<HTMLElement>('span.font-medium').forEach((hebSpan) => {
        const existing = hebSpan.style.transform || '';
        if (!existing.includes('__pdfHebShift')) {
          // Mark the appended transform so we don't double-apply if onclone runs twice.
          hebSpan.style.setProperty(
            'transform',
            `${existing} translateY(3px) /* __pdfHebShift */`,
            'important',
          );
        }
      });
    });

    scope.querySelectorAll<HTMLElement>('.overflow-hidden, .overflow-auto, .overflow-scroll, .overflow-clip').forEach((n) => {
      n.style.setProperty('overflow', 'visible', 'important');
    });

    Array.from(scope.querySelectorAll<HTMLElement>('*')).forEach((n) => {
      try {
        const cs = (clonedDoc.defaultView ?? window).getComputedStyle(n);
        if (
          cs.overflow === 'hidden' || cs.overflow === 'clip' ||
          cs.overflowX === 'hidden' || cs.overflowX === 'clip' ||
          cs.overflowY === 'hidden' || cs.overflowY === 'clip'
        ) {
          n.style.setProperty('overflow', 'visible', 'important');
        }
      } catch {
        // ignore
      }
    });

    clonedDoc.querySelectorAll<HTMLElement>('*').forEach((n) => {
      if ((n.style as any).backdropFilter) n.style.removeProperty('backdrop-filter');
      if ((n.style as any).webkitBackdropFilter) n.style.removeProperty('-webkit-backdrop-filter');
    });

    void sourceEl;
  };
}

export async function exportPdfBlobFromCalendarElement(
  calendarElement: HTMLElement,
  settings: CalendarSettings,
  opts?: { multiPage?: boolean },
) {
  const { widthMm, heightMm } = resolvePdfPageDimensionsMm(settings);
  const jsPdfFormat = [widthMm, heightMm] as [number, number];
  const jsPdfOrientation: 'landscape' | 'portrait' = widthMm >= heightMm ? 'landscape' : 'portrait';

  const marginMmRaw = Number(settings.pdfMarginMm);
  const marginMm = Number.isFinite(marginMmRaw) ? Math.max(0, marginMmRaw) : 0;
  const contentW = Math.max(1, widthMm - marginMm * 2);
  const contentH = Math.max(1, heightMm - marginMm * 2);

  const doc = new jsPDF({
    unit: 'mm',
    format: jsPdfFormat,
    orientation: jsPdfOrientation,
    compress: true,
  });

  function addImageToPdfSafe(
    canvas: HTMLCanvasElement,
    x: number,
    y: number,
    w: number,
    h: number,
    pageIndex: number,
  ) {
    const alias = `page-${pageIndex}`;
    const attempts: Array<{ label: string; run: () => void }> = [
      {
        label: "addImage({ imageData: canvas, format: 'PNG' })",
        run: () =>
          (doc as any).addImage({
            imageData: canvas,
            format: 'PNG',
            x,
            y,
            w,
            h,
            alias,
          }),
      },
      {
        label: "addImage(canvas, 'PNG')",
        run: () => doc.addImage(canvas as unknown as HTMLCanvasElement, 'PNG', x, y, w, h),
      },
      {
        label: 'addImage(canvas)',
        run: () => (doc as any).addImage(canvas, x, y, w, h),
      },
      {
        label: "addImage(dataURL, 'PNG')",
        run: () => {
          const dataUrl = canvas.toDataURL('image/png', 1.0);
          doc.addImage(dataUrl, 'PNG', x, y, w, h);
        },
      },
      {
        label: 'addImage(dataURL)',
        run: () => {
          const dataUrl = canvas.toDataURL('image/png', 1.0);
          (doc as any).addImage(dataUrl, x, y, w, h);
        },
      },
    ];
    const failures: Array<{ label: string; message: string }> = [];
    for (const a of attempts) {
      try {
        a.run();
        return;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        failures.push({ label: a.label, message: msg });
      }
    }
    const details = failures.map((f) => `${f.label}: ${f.message}`).join(' | ');
    throw new Error(`PDF: jsPDF addImage failed after ${failures.length} attempts. ${details}`);
  }

  function fitCanvasToContentBox(_canvas: HTMLCanvasElement): { x: number; y: number; w: number; h: number } {
    // Stretch to fill the full page — calendar pages should always fill A4.
    return { x: marginMm, y: marginMm, w: contentW, h: contentH };
  }

  const nodes: HTMLElement[] = opts?.multiPage
    ? (Array.from(calendarElement.querySelectorAll('.canvas')) as HTMLElement[])
    : [calendarElement];

  const scale = Math.min(3, Math.max(1, Math.round(Number(settings.pdfHtml2CanvasScale) || 2)));

  // Dynamic top offset for the mid (events) area based on date font sizes.
  const gregPx = Number(settings.gregDayFontPx) || 12;
  const hebPx = Number(settings.hebDayFontPx) || 12;
  const datesBandPx = Math.ceil(Math.max(gregPx, hebPx) * 1.32);
  const midWrapTopPx = 6 + datesBandPx + 4; // padding + dates + gap

  function assertCanvasNotBlank(canvas: HTMLCanvasElement, label: string) {
    const w = canvas.width;
    const h = canvas.height;
    if (!w || !h) throw new Error(`Blank canvas (${label}): zero size ${w}x${h}.`);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    let img: ImageData;
    try {
      img = ctx.getImageData(0, 0, w, h);
    } catch {
      return;
    }
    const data = img.data;
    const samplePoints = [
      [Math.floor(w * 0.1), Math.floor(h * 0.1)],
      [Math.floor(w * 0.5), Math.floor(h * 0.2)],
      [Math.floor(w * 0.5), Math.floor(h * 0.5)],
      [Math.floor(w * 0.8), Math.floor(h * 0.5)],
      [Math.floor(w * 0.9), Math.floor(h * 0.9)],
    ] as const;
    for (const [sx, sy] of samplePoints) {
      const x = Math.min(w - 1, Math.max(0, sx));
      const y = Math.min(h - 1, Math.max(0, sy));
      const i = (y * w + x) * 4;
      const [r, g, b, a] = [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!];
      if (a !== 255) return;
      if (r !== 255 || g !== 255 || b !== 255) return;
    }
    throw new Error(`Blank canvas (${label}): rendered all-white sample.`);
  }

  // windowWidth must match the calendar's expected layout width so html2canvas
  // doesn't reflow the grid into a narrower viewport.
  const windowWidthPx = Math.max(900, Math.ceil((widthMm / 25.4) * 96));
  const windowHeightPx = Math.max(600, Math.ceil((heightMm / 25.4) * 96));

  async function renderElementToCanvasWithStage(el: HTMLElement, label: string) {
    const onclone = buildCaptureOnClone(el, { widthMm, heightMm });

    const render = async (target: HTMLElement) =>
      await html2canvas(target, {
        scale,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: windowWidthPx,
        windowHeight: windowHeightPx,
        onclone,
      });

    // First try direct (fastest; best fidelity when stable).
    try {
      const direct = await render(el);
      assertCanvasNotBlank(direct, `${label}[direct]`);
      return direct;
    } catch {
      // Fallback: clone into a fixed stage at (0,0) and force PDF-friendly alignment in the clone.
      const stage = document.createElement('div');
      stage.style.position = 'fixed';
      stage.style.left = '0';
      stage.style.top = '0';
      stage.style.width = `${widthMm}mm`;
      stage.style.height = `${heightMm}mm`;
      stage.style.minHeight = `${heightMm}mm`;
      stage.style.background = '#ffffff';
      stage.style.pointerEvents = 'none';
      stage.style.opacity = '0';
      stage.style.zIndex = '-1';
      stage.style.overflow = 'visible';

      const clone = el.cloneNode(true) as HTMLElement;
      clone.style.position = 'static';
      clone.style.left = 'auto';
      clone.style.top = 'auto';
      clone.style.transform = 'none';
      clone.style.margin = '0';
      clone.style.width = '100%';
      clone.style.boxSizing = 'border-box';

      // Align the cell center text to the top in PDF capture (avoid flex centering in some themes).
      clone.querySelectorAll<HTMLElement>('.midWrap').forEach((mw) => {
        mw.style.position = 'absolute';
        mw.style.top = `${midWrapTopPx}px`;
        mw.style.left = '4px';
        mw.style.right = '4px';
        mw.style.bottom = '56px';
        mw.style.padding = '0';
        mw.style.display = 'block';
        mw.style.justifyContent = 'flex-start';
        mw.style.alignItems = 'stretch';
        mw.style.overflow = 'hidden';
        mw.style.transform = 'none';
        (mw.style as any).direction = 'rtl';
        (mw.style as any).textAlign = 'right';
      });
      clone.querySelectorAll<HTMLElement>('.midInner').forEach((mi) => {
        mi.style.display = 'block';
        mi.style.maxHeight = 'none';
        mi.style.overflow = 'visible';
      });
      clone.querySelectorAll<HTMLElement>('.mid').forEach((m) => {
        m.style.lineHeight = '1.15';
        m.style.marginTop = '0';
      });

      stage.appendChild(clone);
      document.body.appendChild(stage);
      try {
        const staged = await render(stage);
        assertCanvasNotBlank(staged, `${label}[staged]`);
        return staged;
      } finally {
        try {
          stage.remove();
        } catch {
          // ignore
        }
      }
    }
  }

  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i]!;
    const canvas = await renderElementToCanvasWithStage(el, `exportCalendarElement page ${i + 1}/${nodes.length}`);

    if (i > 0) doc.addPage();
    const fit = fitCanvasToContentBox(canvas);
    addImageToPdfSafe(canvas, fit.x, fit.y, fit.w, fit.h, i);
  }

  const blob = doc.output('blob') as Blob;
  if (!blob || typeof (blob as any).size !== 'number' || blob.size <= 0) {
    throw new Error('PDF: נוצר קובץ ריק (0 bytes)');
  }
  return blob;
}

export async function exportYearPdfBlobFromCalendarCapture(opts: {
  /** The element to capture (usually the on-screen calendar container). */
  getElement: () => HTMLElement | null
  /** Called for each target month to update the UI before capture. */
  setMonth: (monthIndex0: number, gregorianYear?: number) => void | Promise<void>
  /** Settings for page size / margins / scale. */
  settings: CalendarSettings
  /** Optional month indexes to export (default: 0..11). */
  monthIndices?: number[]
  /** Optional explicit month targets (supports crossing Gregorian year boundaries). */
  monthTargets?: Array<{ year: number; month: number }>
}) {
  console.info(
    '[hebrew-calendar-studio] exportYearPdfBlobFromCalendarCapture() · git',
    typeof __APP_BUILD__ === 'string' ? __APP_BUILD__ : 'unknown',
  )

  const { getElement, setMonth, settings } = opts
  const monthIndices =
    Array.isArray(opts.monthIndices) && opts.monthIndices.length
      ? opts.monthIndices.filter((m) => Number.isInteger(m) && m >= 0 && m <= 11)
      : Array.from({ length: 12 }, (_, i) => i)
  const monthTargets =
    Array.isArray(opts.monthTargets) && opts.monthTargets.length
      ? opts.monthTargets
          .map((t) => ({ year: Number(t.year), month: Number(t.month) }))
          .filter((t) => Number.isInteger(t.year) && Number.isInteger(t.month) && t.month >= 0 && t.month <= 11)
      : monthIndices.map((m) => ({ year: NaN, month: m }))

  const { widthMm, heightMm } = resolvePdfPageDimensionsMm(settings)
  const jsPdfFormat = [widthMm, heightMm] as [number, number]
  const jsPdfOrientation: 'landscape' | 'portrait' = widthMm >= heightMm ? 'landscape' : 'portrait'

  const marginMmRaw = Number(settings.pdfMarginMm)
  const marginMm = Number.isFinite(marginMmRaw) ? Math.max(0, marginMmRaw) : 0
  const contentW = Math.max(1, widthMm - marginMm * 2)
  const contentH = Math.max(1, heightMm - marginMm * 2)

  const doc = new jsPDF({
    unit: 'mm',
    format: jsPdfFormat,
    orientation: jsPdfOrientation,
    compress: true,
  })

  const scale = Math.min(3, Math.max(1, Math.round(Number(settings.pdfHtml2CanvasScale) || 2)))
  const windowWidthPx = Math.max(900, Math.ceil((widthMm / 25.4) * 96))
  const windowHeightPx = Math.max(600, Math.ceil((heightMm / 25.4) * 96))

  function assertCanvasNotBlank(canvas: HTMLCanvasElement, label: string) {
    const w = canvas.width
    const h = canvas.height
    if (!w || !h) throw new Error(`PDF שנה: קנבס ריק (${label}) — גודל ${w}x${h}`)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    let img: ImageData
    try {
      img = ctx.getImageData(0, 0, w, h)
    } catch {
      return
    }
    const data = img.data
    const tol = 3
    const cols = 10
    const rows = 6
    for (let ry = 1; ry <= rows; ry++) {
      for (let cx = 1; cx <= cols; cx++) {
        const x = Math.min(w - 1, Math.max(0, Math.floor((w * cx) / (cols + 1))))
        const y = Math.min(h - 1, Math.max(0, Math.floor((h * ry) / (rows + 1))))
        const i = (y * w + x) * 4
        const r = data[i]!
        const g = data[i + 1]!
        const b = data[i + 2]!
        const a = data[i + 3]!
        if (a !== 255) return
        if (Math.abs(r - 255) > tol || Math.abs(g - 255) > tol || Math.abs(b - 255) > tol) return
      }
    }
    throw new Error(`PDF שנה: קנבס ריק (${label}) — כל הדגימות לבנות`)
  }

  // Same dynamic offset used by single-month export so the staged-clone fallback aligns events identically.
  const gregPx = Number(settings.gregDayFontPx) || 12
  const hebPx = Number(settings.hebDayFontPx) || 12
  const datesBandPx = Math.ceil(Math.max(gregPx, hebPx) * 1.32)
  const midWrapTopPx = 6 + datesBandPx + 4

  async function renderWithStageFallback(el: HTMLElement, label: string) {
    const onclone = buildCaptureOnClone(el, { widthMm, heightMm })

    const render = async (target: HTMLElement) =>
      await html2canvas(target, {
        scale,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: windowWidthPx,
        windowHeight: windowHeightPx,
        onclone,
      })

    // Fast path: direct capture (matches single-month export's primary strategy).
    try {
      const direct = await render(el)
      assertCanvasNotBlank(direct, `${label}[direct]`)
      return direct
    } catch {
      // Fallback: clone into a fixed stage at (0,0) — identical to the single-month export pipeline,
      // so the year capture produces the same visual result as a per-month capture.
      const stage = document.createElement('div')
      stage.style.position = 'fixed'
      stage.style.left = '0'
      stage.style.top = '0'
      stage.style.width = `${widthMm}mm`
      stage.style.height = `${heightMm}mm`
      stage.style.minHeight = `${heightMm}mm`
      stage.style.background = '#ffffff'
      stage.style.pointerEvents = 'none'
      stage.style.opacity = '0'
      stage.style.zIndex = '-1'
      stage.style.overflow = 'visible'

      const clone = el.cloneNode(true) as HTMLElement
      clone.style.position = 'static'
      clone.style.left = 'auto'
      clone.style.top = 'auto'
      clone.style.transform = 'none'
      clone.style.margin = '0'
      clone.style.width = '100%'
      clone.style.boxSizing = 'border-box'

      // Align event text within cells the same way single-month export does.
      clone.querySelectorAll<HTMLElement>('.midWrap').forEach((mw) => {
        mw.style.position = 'absolute'
        mw.style.top = `${midWrapTopPx}px`
        mw.style.left = '4px'
        mw.style.right = '4px'
        mw.style.bottom = '56px'
        mw.style.padding = '0'
        mw.style.display = 'block'
        mw.style.justifyContent = 'flex-start'
        mw.style.alignItems = 'stretch'
        mw.style.overflow = 'hidden'
        mw.style.transform = 'none'
        ;(mw.style as any).direction = 'rtl'
        ;(mw.style as any).textAlign = 'right'
      })
      clone.querySelectorAll<HTMLElement>('.midInner').forEach((mi) => {
        mi.style.display = 'block'
        mi.style.maxHeight = 'none'
        mi.style.overflow = 'visible'
      })
      clone.querySelectorAll<HTMLElement>('.mid').forEach((m) => {
        m.style.lineHeight = '1.15'
        m.style.marginTop = '0'
      })

      stage.appendChild(clone)
      document.body.appendChild(stage)
      try {
        const staged = await render(stage)
        assertCanvasNotBlank(staged, `${label}[staged]`)
        return staged
      } finally {
        try {
          stage.remove()
        } catch {
          // ignore
        }
      }
    }
  }

  function fitCanvasToContentBox(_canvas: HTMLCanvasElement): { x: number; y: number; w: number; h: number } {
    // Stretch to fill the full page — identical to single-month export so fonts/positions match the
    // screen exactly. The captured element is `[data-inspect="background"]`, which already has the
    // PDF page aspect ratio, so stretching cannot distort it.
    return { x: marginMm, y: marginMm, w: contentW, h: contentH }
  }

  function addImageToPdfSafe(canvas: HTMLCanvasElement, x: number, y: number, w: number, h: number, pageIndex: number) {
    const alias = `page-${pageIndex}`
    const attempts: Array<{ label: string; run: () => void }> = [
      {
        label: "addImage({ imageData: canvas, format: 'PNG' })",
        run: () =>
          (doc as any).addImage({
            imageData: canvas,
            format: 'PNG',
            x,
            y,
            w,
            h,
            alias,
          }),
      },
      { label: "addImage(canvas, 'PNG')", run: () => doc.addImage(canvas as any, 'PNG', x, y, w, h) },
      { label: 'addImage(canvas)', run: () => (doc as any).addImage(canvas, x, y, w, h) },
      {
        label: "addImage(dataURL, 'PNG')",
        run: () => {
          const dataUrl = canvas.toDataURL('image/png', 1.0)
          doc.addImage(dataUrl, 'PNG', x, y, w, h)
        },
      },
      {
        label: 'addImage(dataURL)',
        run: () => {
          const dataUrl = canvas.toDataURL('image/png', 1.0)
          ;(doc as any).addImage(dataUrl, x, y, w, h)
        },
      },
    ]
    const failures: Array<{ label: string; message: string }> = []
    for (const a of attempts) {
      try {
        a.run()
        return
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        failures.push({ label: a.label, message: msg })
      }
    }
    const details = failures.map((f) => `${f.label}: ${f.message}`).join(' | ')
    throw new Error(`PDF: jsPDF addImage failed after ${failures.length} attempts. ${details}`)
  }

  async function waitForStableRender() {
    // Two rAFs tends to catch state->layout->paint, plus a small delay for fonts/images.
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    try {
      await (document as any).fonts?.ready
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 300))
  }

  async function waitForImagesAndBackgrounds(el: HTMLElement) {
    // 1) <img> tags
    const imgs = Array.from(el.querySelectorAll('img')) as HTMLImageElement[]
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) return resolve()
            img.onload = () => resolve()
            img.onerror = () => resolve()
            setTimeout(resolve, 2500)
          }),
      ),
    )

    // 2) background-image urls (common for month background photos)
    const nodes = [el, ...Array.from(el.querySelectorAll('*'))].filter(
      (n): n is HTMLElement => n instanceof HTMLElement,
    )
    const urls = new Set<string>()
    for (const n of nodes) {
      let bg = ''
      try {
        bg = window.getComputedStyle(n).backgroundImage || ''
      } catch {
        bg = ''
      }
      if (!bg || bg === 'none') continue
      // Extract url("...") occurrences
      const re = /url\((?:'|")?(.*?)(?:'|")?\)/g
      let m: RegExpExecArray | null
      while ((m = re.exec(bg))) {
        const u = String(m[1] || '').trim()
        if (!u) continue
        // Skip gradients
        if (u.startsWith('data:') || u.startsWith('http') || u.startsWith('blob:') || u.startsWith('/') || u.startsWith('.')) {
          urls.add(u)
        }
      }
    }

    await Promise.all(
      Array.from(urls).map(
        (u) =>
          new Promise<void>((resolve) => {
            const img = new Image()
            // best effort; data urls don't need CORS
            try {
              if (!u.startsWith('data:')) img.crossOrigin = 'anonymous'
            } catch {
              // ignore
            }
            img.onload = () => resolve()
            img.onerror = () => resolve()
            img.src = u
            setTimeout(resolve, 2500)
          }),
      ),
    )
  }

  for (let i = 0; i < monthTargets.length; i++) {
    const t = monthTargets[i]!
    const m = t.month
    // DEBUG year-PDF blanks: remove when resolved
    console.log(
      `חודש ${i + 1}/${monthTargets.length}: לפני setMonth (יעד Gregorian monthIndex=${m}, year=${Number.isFinite(t.year) ? t.year : 'default'})`,
    )
    await setMonth(m, Number.isFinite(t.year) ? t.year : undefined)
    await waitForStableRender()

    const el = getElement()
    if (!el) throw new Error('PDF: calendar element missing for capture')
    await waitForImagesAndBackgrounds(el)

    const canvas = await renderWithStageFallback(
      el,
      `month ${m + 1}/12 (step ${i + 1}/${monthTargets.length})`,
    )

    let dataUrlLen = -1
    try {
      dataUrlLen = canvas.toDataURL('image/png', 1.0).length
    } catch (e) {
      console.warn(`חודש ${i + 1}: toDataURL failed`, e)
    }
    console.log(
      `חודש ${i + 1}: קנבס ${canvas.width}x${canvas.height}, dataURL length: ${dataUrlLen}`,
    )

    if (i > 0) doc.addPage()
    const fit = fitCanvasToContentBox(canvas)
    addImageToPdfSafe(canvas, fit.x, fit.y, fit.w, fit.h, i)
  }

  const blob = doc.output('blob') as Blob
  if (!blob || typeof (blob as any).size !== 'number' || blob.size <= 0) {
    throw new Error('PDF שנה: נוצר קובץ ריק (0 bytes)')
  }
  return blob
}

if (typeof window !== 'undefined') {
  ;(window as Window & {
    __HEBREW_CALENDAR_STUDIO_PDF__?: {
      bundle: string
      buildShort: string
      exportYearPdfBlobFromCalendarCapture: typeof exportYearPdfBlobFromCalendarCapture
    }
  }).__HEBREW_CALENDAR_STUDIO_PDF__ = {
    bundle: 'hebrew-calendar-suite/apps/studio (Vite)',
    buildShort: typeof __APP_BUILD__ === 'string' ? __APP_BUILD__ : 'unknown',
    exportYearPdfBlobFromCalendarCapture,
  }
  console.info(
    '[hebrew-calendar-studio] pdf.ts loaded — year capture lives here · git',
    typeof __APP_BUILD__ === 'string' ? __APP_BUILD__ : 'unknown',
    '· try: window.__HEBREW_CALENDAR_STUDIO_PDF__.exportYearPdfBlobFromCalendarCapture?.toString().slice(0,200)',
  )
}

export async function downloadPdfFromHtml(
  filename: string,
  html: string,
  settings: CalendarSettings,
  opts?: { multiPage?: boolean },
) {
  const blob = await exportPdfBlobFromHtml(html, settings, opts);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  try {
    a.click();
  } finally {
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 250);
  }
}

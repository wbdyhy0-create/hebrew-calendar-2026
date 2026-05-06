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
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = 'repeat(7, 1fr)';
      grid.style.width = '100%';
      grid.style.direction = 'ltr';
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
      scope.querySelectorAll<HTMLElement>('.grid').forEach((grid) => {
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(7, 1fr)';
        grid.style.width = '100%';
        grid.style.direction = 'ltr';
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

  function fitCanvasToContentBox(canvas: HTMLCanvasElement): { x: number; y: number; w: number; h: number } {
    // Keep aspect ratio (contain) so we don't stretch fonts/boxes.
    const cw = Math.max(1, canvas.width);
    const ch = Math.max(1, canvas.height);
    const canvasRatio = cw / ch;
    const boxRatio = contentW / contentH;
    const w = boxRatio >= canvasRatio ? contentH * canvasRatio : contentW;
    const h = boxRatio >= canvasRatio ? contentH : contentW / canvasRatio;
    const x = marginMm + (contentW - w) / 2;
    const y = marginMm + (contentH - h) / 2;
    return { x, y, w, h };
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

  async function renderElementToCanvasWithStage(el: HTMLElement, label: string) {
    const render = async (target: HTMLElement) =>
      await html2canvas(target, {
        scale,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
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
    // Use a denser grid of samples with a small tolerance. A calendar page can be mostly white,
    // and sparse sampling can false-positive as blank (especially on months with large white areas).
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
        // Treat fully transparent or any non-white-ish pixel as non-blank.
        if (a !== 255) return
        if (Math.abs(r - 255) > tol || Math.abs(g - 255) > tol || Math.abs(b - 255) > tol) return
      }
    }
    throw new Error(`PDF שנה: קנבס ריק (${label}) — כל הדגימות לבנות`)
  }

  async function renderWithStageFallback(el: HTMLElement, label: string) {
    const render = async (target: HTMLElement) =>
      await captureElementWithoutTransform(target, { scale, widthMm, heightMm, label })

    // Fast path: direct capture
    try {
      const direct = await render(el)
      assertCanvasNotBlank(direct, `${label}[direct]`)
      return direct
    } catch {
      // Retry once after a paint tick (layout/assets can still settle between months).
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
      const retry = await render(el)
      assertCanvasNotBlank(retry, `${label}[retry]`)
      return retry
    }
  }

  function fitCanvasToContentBox(canvas: HTMLCanvasElement): { x: number; y: number; w: number; h: number } {
    const cw = Math.max(1, canvas.width)
    const ch = Math.max(1, canvas.height)
    const canvasRatio = cw / ch
    const boxRatio = contentW / contentH
    const w = boxRatio >= canvasRatio ? contentH * canvasRatio : contentW
    const h = boxRatio >= canvasRatio ? contentH : contentW / canvasRatio
    const x = marginMm + (contentW - w) / 2
    const y = marginMm + (contentH - h) / 2
    return { x, y, w, h }
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

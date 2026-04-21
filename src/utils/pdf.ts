import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

import type { CalendarSettings } from './settings';
import { resolvePdfPageDimensionsMm } from './pdfPage';

// NOTE: We intentionally do not use html2pdf.js for exports anymore.
// We render via html2canvas (with `onclone`) and embed into jsPDF to match screen layout.

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
  container.setAttribute('dir', parsed.documentElement.getAttribute('dir') ?? 'rtl');
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
    calendarElement.style.direction = 'rtl';
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

      // When exporting multi-page (year), we capture `.canvas` nodes. The printable HTML background
      // is applied to `.printRoot`, not `.canvas`, so the photo can disappear in PDF.
      // Copy the computed background from the root into each canvas in the clone.
      if (root) {
        const win = clonedDoc.defaultView;
        const cs = win ? win.getComputedStyle(root) : null;
        if (cs) {
          const bgImage = cs.backgroundImage;
          const bgSize = cs.backgroundSize;
          const bgPosition = cs.backgroundPosition;
          const bgRepeat = cs.backgroundRepeat;
          const bgColor = cs.backgroundColor;
          scope.querySelectorAll<HTMLElement>('.canvas').forEach((c) => {
            if (bgImage && bgImage !== 'none') c.style.setProperty('background-image', bgImage, 'important');
            if (bgSize) c.style.setProperty('background-size', bgSize, 'important');
            if (bgPosition) c.style.setProperty('background-position', bgPosition, 'important');
            if (bgRepeat) c.style.setProperty('background-repeat', bgRepeat, 'important');
            if (bgColor && bgColor !== 'transparent') c.style.setProperty('background-color', bgColor, 'important');
          });
        }
      }

      // Some CSS features can trip html2canvas parsers in certain builds/browsers.
      // Remove backdrop filters and other effects in the clone.
      scope.querySelectorAll<HTMLElement>('*').forEach((n) => {
        const s = (n.style as any);
        if (s?.backdropFilter) n.style.removeProperty('backdrop-filter');
        if (s?.webkitBackdropFilter) n.style.removeProperty('-webkit-backdrop-filter');
      });

      // Precise PDF auto-fit: compute a cell height that makes the grid touch the bottom.
      if (root && settings.layoutAutoFitToCanvas) {
        root.classList.add('pdfAutoFit');
        const canvasEl = root.querySelector('.canvas') as HTMLElement | null;
        const gridEl = root.querySelector('.grid') as HTMLElement | null;
        const dowEl = root.querySelector('.dow') as HTMLElement | null;
        if (canvasEl && gridEl && dowEl) {
          const canvasRect = canvasEl.getBoundingClientRect();
          const gridRect = gridEl.getBoundingClientRect();
          const padB = Number.parseFloat(getComputedStyle(canvasEl).paddingBottom || '0') || 0;
          const dowH = dowEl.getBoundingClientRect().height || 0;
          const children = Array.from(gridEl.children);
          const total = children.length;
          const weeks = Math.max(5, Math.min(6, Math.round((total - 7) / 7) || 6));
          const avail = Math.max(120, canvasRect.height - (gridRect.top - canvasRect.top) - padB);
          const cellH = Math.max(60, Math.ceil((avail - dowH) / weeks));
          root.style.setProperty('--pdfAutoCellHeightPx', `${cellH}px`);
          gridEl.style.gridAutoRows = 'unset';
          gridEl.style.gridTemplateRows = `${Math.round(dowH)}px repeat(${weeks}, ${cellH}px)`;
        }
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

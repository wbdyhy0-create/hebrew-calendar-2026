import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

import type { CalendarSettings } from './settings';
import { resolvePdfPageDimensionsMm } from './pdfPage';

// NOTE: We intentionally do not use html2pdf.js for exports anymore.
// We render via html2canvas (with `onclone`) and embed into jsPDF to match screen layout.

export async function downloadPdfFromHtml(
  filename: string,
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
  container.style.left = '-100000px';
  container.style.top = '0';
  container.style.width = `${widthMm}mm`;
  if (!opts?.multiPage) container.style.height = `${heightMm}mm`;
  container.style.background = '#ffffff';
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

  function addImageToPdfSafe(
    doc: jsPDF,
    canvas: HTMLCanvasElement,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    const attempts: Array<{ label: string; run: () => void }> = [
      // Some jsPDF builds handle canvas best without specifying format.
      {
        label: 'addImage(canvas, no format)',
        run: () => (doc as any).addImage(canvas, x, y, w, h, undefined, 'FAST'),
      },
      {
        label: "addImage(canvas, 'PNG')",
        run: () => doc.addImage(canvas as unknown as HTMLCanvasElement, 'PNG', x, y, w, h, undefined, 'FAST'),
      },
      // Fallbacks: dataURL, sometimes with/without format.
      {
        label: 'addImage(dataURL, no format)',
        run: () => {
          const dataUrl = canvas.toDataURL('image/png', 1.0);
          (doc as any).addImage(dataUrl, x, y, w, h, undefined, 'FAST');
        },
      },
      {
        label: "addImage(dataURL, 'PNG')",
        run: () => {
          const dataUrl = canvas.toDataURL('image/png', 1.0);
          doc.addImage(dataUrl, 'PNG', x, y, w, h, undefined, 'FAST');
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

    const doc = new jsPDF({
      unit: 'mm',
      format: jsPdfFormat,
      orientation: jsPdfOrientation,
      compress: true,
    });

    const nodes: HTMLElement[] = opts?.multiPage
      ? Array.from((calendarElement ?? container).querySelectorAll('.canvas')) as HTMLElement[]
      : [target as HTMLElement];

    const scale = Math.min(3, Math.max(1, Math.round(Number(settings.pdfHtml2CanvasScale) || 2)));

    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i]!;
      const canvas = await html2canvas(el, {
        scale,
        useCORS: true,
        backgroundColor: '#ffffff',
        windowWidth: windowWidthPx,
        windowHeight: windowHeightPx,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc) => {
          const root = clonedDoc.querySelector('#calendar-container') as HTMLElement | null;
          const scope = root ?? clonedDoc.body;

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
              // Use `ceil` to avoid leaving a visible gap at the bottom due to rounding.
              // This may slightly overfill (by <1 row worth of pixels), which is preferable
              // for “fill the page” PDF output.
              const cellH = Math.max(60, Math.ceil((avail - dowH) / weeks));
              root.style.setProperty('--pdfAutoCellHeightPx', `${cellH}px`);
              // Important: `grid-auto-rows` would also apply to the weekday row (dow) and create
              // a big visual gap before the first week. Use explicit rows instead.
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
            hb.style.setProperty('grid-template-columns', 'minmax(0, 1fr) auto minmax(0, 1fr)', 'important');
            hb.style.setProperty('align-items', 'center', 'important');
            hb.style.setProperty('position', 'relative', 'important');
          });
        },
      });

      // Fit captured image into the PDF content box while preserving aspect ratio.
      const imgPxW = canvas.width || 1;
      const imgPxH = canvas.height || 1;
      const imgRatio = imgPxW / imgPxH;
      const boxRatio = contentW / contentH;
      const drawW = imgRatio > boxRatio ? contentW : contentH * imgRatio;
      const drawH = imgRatio > boxRatio ? contentW / imgRatio : contentH;
      const x = marginMm + (contentW - drawW) / 2;
      const y = marginMm + (contentH - drawH) / 2;

      if (i > 0) doc.addPage();
      addImageToPdfSafe(doc, canvas, x, y, drawW, drawH);
    }

    doc.save(filename);
  }

  try {
    // Prefer explicit html2canvas -> jsPDF pipeline to match on-screen layout/alignment.
    // Keeps layout stable by using `onclone` before capture.
    await renderWithHtml2CanvasThenPdf();
  } finally {
    container.remove();
    tempStyles.forEach((style) => style.remove());
    tempLinks.forEach((link) => link.remove());
  }
}

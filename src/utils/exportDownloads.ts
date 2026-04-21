import html2canvas from 'html2canvas';

import type { CalendarSettings } from './settings';
import { downloadBlobFile, downloadTextFile } from './download';
import { resolvePdfPageDimensionsMm } from './pdfPage';

function extractFirstStyleTagContent(html: string): string | null {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const style = parsed.head.querySelector('style');
  return style?.textContent ?? null;
}

export function downloadHtmlFromPrintableHtml(filename: string, html: string) {
  downloadTextFile(filename, html, 'text/html;charset=utf-8');
}

export function downloadCssFromPrintableHtml(filename: string, html: string) {
  const css = extractFirstStyleTagContent(html);
  if (!css) throw new Error('לא נמצא CSS בתוך ה‑HTML (style tag חסר).');
  downloadTextFile(filename, css.trim() + '\n', 'text/css;charset=utf-8');
}

export async function exportPngBlobFromPrintableHtml(
  html: string,
  settings: CalendarSettings,
  opts?: { scale?: number },
) {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const { widthMm, heightMm } = resolvePdfPageDimensionsMm(settings);
  const scale = Math.max(1, Math.min(4, Number(opts?.scale) || 2));

  // html2canvas uses `windowWidth/Height` as CSS-pixel hints. Convert mm -> px at 96dpi.
  const windowWidthPx = Math.max(900, Math.ceil((widthMm / 25.4) * 96));
  const windowHeightPx = Math.max(600, Math.ceil((heightMm / 25.4) * 96));

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '0';
  container.style.top = '0';
  container.style.width = `${widthMm}mm`;
  container.style.height = `${heightMm}mm`;
  container.style.minHeight = `${heightMm}mm`;
  container.style.background = '#ffffff';
  container.style.opacity = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '-1';
  container.style.overflow = 'visible';
  container.setAttribute('dir', parsed.documentElement.getAttribute('dir') ?? 'rtl');
  container.innerHTML = parsed.body.innerHTML;
  document.body.appendChild(container);

  const calendarElement = container.querySelector('#calendar-container') as HTMLElement | null;

  const tempStyles: HTMLStyleElement[] = [];
  parsed.head.querySelectorAll('style').forEach((styleNode) => {
    const style = document.createElement('style');
    style.textContent = styleNode.textContent;
    style.setAttribute('data-export-temp-style', '1');
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
    clone.setAttribute('data-export-temp-link', '1');
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
    calendarElement.style.height = 'auto';
    calendarElement.style.minHeight = `${heightMm}mm`;
    calendarElement.style.overflow = 'visible';
    calendarElement.style.direction = 'rtl';
    calendarElement.classList.add('pdfMode');
  }

  const target = calendarElement ?? container;

  try {
    const applyBaseCloneFixes = (scope: Element) => {
      scope.querySelectorAll<HTMLElement>('.grid').forEach((grid) => {
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(7, 1fr)';
        grid.style.width = '100%';
        grid.style.direction = 'rtl';
      });
      // Keep wrappers stretched (avoid shrink-to-fit in capture).
      scope.querySelectorAll<HTMLElement>('.calendarLayoutZoom').forEach((el) => {
        el.style.width = '100%';
        el.style.maxWidth = '100%';
        el.style.marginLeft = '0';
        el.style.marginRight = '0';
      });
      scope.querySelectorAll<HTMLElement>('.tableOffsetWrap').forEach((w) => {
        w.style.width = '100%';
        w.style.maxWidth = '100%';
      });
    };

    const render = async (mode: 'full' | 'safe') => {
      return await html2canvas(target, {
        backgroundColor: '#ffffff',
        scale,
        useCORS: true,
        // If cross-origin images are present without CORS headers, the canvas can become
        // "tainted" and PNG export will fail. In safe mode we disable images to guarantee a file.
        allowTaint: false,
        windowWidth: windowWidthPx,
        windowHeight: windowHeightPx,
        onclone: (doc) => {
          const scope = (doc.querySelector('#calendar-container') ?? doc.body) as Element;
          applyBaseCloneFixes(scope);

          if (mode === 'safe') {
            scope.querySelectorAll<HTMLElement>('.printRoot, .canvas').forEach((el) => {
              el.style.backgroundImage = 'none';
            });
            scope.querySelectorAll<HTMLElement>('.cellImg').forEach((el) => {
              el.style.backgroundImage = 'none';
            });
          }
        },
      });
    };

    let canvas: HTMLCanvasElement;
    try {
      canvas = await render('full');
    } catch (e) {
      // Retry without any external images (stable export).
      canvas = await render('safe');
      // eslint-disable-next-line no-console
      console.warn('PNG export fell back to safe mode (images disabled).', e);
    }

    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('יצוא PNG נכשל: canvas.toBlob החזיר null'))),
        'image/png',
        1.0,
      );
    });

    return blob;
  } finally {
    // cleanup
    try {
      container.remove();
    } catch {
      // ignore
    }
    tempStyles.forEach((s) => {
      try {
        s.remove();
      } catch {
        // ignore
      }
    });
    tempLinks.forEach((l) => {
      try {
        l.remove();
      } catch {
        // ignore
      }
    });
  }
}

export async function downloadPngFromPrintableHtml(
  filename: string,
  html: string,
  settings: CalendarSettings,
  opts?: { scale?: number },
) {
  const blob = await exportPngBlobFromPrintableHtml(html, settings, opts);
  downloadBlobFile(filename, blob);
}


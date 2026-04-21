import type { CalendarSettings } from './settings';
import type { OverridesMap } from './overrides';
import { buildPrintableMonthHtml } from './printMonth';

function extractBetween(haystack: string, startNeedle: string, endNeedle: string) {
  const start = haystack.indexOf(startNeedle);
  if (start < 0) return null;
  const end = haystack.indexOf(endNeedle, start + startNeedle.length);
  if (end < 0) return null;
  return haystack.slice(start + startNeedle.length, end);
}

function extractStyleBlock(html: string) {
  const style = extractBetween(html, '<style>', '</style>');
  return style ?? '';
}

function extractCalendarContainer(html: string) {
  const marker = '<div id="calendar-container"';
  const start = html.indexOf(marker);
  if (start < 0) return null;
  const end = html.indexOf('</div>\n    </div>\n  </body>', start);
  if (end < 0) return null;
  // Grab the container div (and its inner content) up to its matching closing.
  // `printMonth` ends with: <div id="calendar-container" class="printRoot"> ... </div>
  const closeIdx = html.lastIndexOf('</div>', end);
  if (closeIdx < 0) return null;
  return html.slice(start, closeIdx + '</div>'.length);
}

export function buildPrintableYearPdfHtml(
  year: number,
  settings: CalendarSettings,
  overrides: OverridesMap,
) {
  const monthDocs = Array.from({ length: 12 }, (_, m) => {
    const viewDate = new Date(year, m, 1);
    return buildPrintableMonthHtml(viewDate, settings, overrides, { location: 'Jerusalem' });
  });

  const style = extractStyleBlock(monthDocs[0] ?? '') || '';
  const pages = monthDocs
    .map((doc, idx) => {
      const container = extractCalendarContainer(doc);
      if (!container) return `<div class="yearPage">שגיאה ביצירת חודש ${idx + 1}</div>`;
      // Remove duplicate IDs; the outer year container holds the single id.
      const normalized = container.replace('id="calendar-container" ', '');
      return `<div class="yearPage">${normalized}</div>`;
    })
    .join('\n');

  // Add page breaks between months; html2pdf can respect CSS page breaks.
  const yearCss = `
    .yearDoc { direction: rtl; }
    .yearPage { display: block; }
    @media print {
      /* Ensure each month starts on a fresh printed page (Chrome print-to-PDF). */
      .yearPage { break-after: page; page-break-after: always; break-inside: avoid; page-break-inside: avoid; }
      .yearPage:last-child { break-after: auto; page-break-after: auto; }
    }
  `;

  return `<!doctype html>
<html lang="he" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${settings.titleMain} — ${year}</title>
    <style>
${style}
${yearCss}
    </style>
  </head>
  <body>
    <div id="calendar-container" class="yearDoc">
${pages}
    </div>
  </body>
</html>`;
}


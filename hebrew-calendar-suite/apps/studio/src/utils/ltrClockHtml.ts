/** י-ם ות״א בשורה אחת ב-PDF; כל שעה ב-LTR isolate. */
export function hebcalJerTaPairHtml(
  jerEsc: string,
  taEsc: string,
  variant: 'labels' | 'fast',
): string {
  const colon = variant === 'labels' ? ': ' : ' ';
  const pair = (city: string, t: string) =>
    `<span style="white-space:nowrap" dir="rtl">${city}${colon}<span dir="ltr" style="unicode-bidi:isolate;display:inline-block">${t}</span></span>`;
  return (
    `<div class="tabular-nums" style="max-width:100%;line-height:1.25">` +
    `<div style="display:flex;width:100%;min-width:0;flex-wrap:nowrap;align-items:baseline;justify-content:flex-end;gap:6px;direction:ltr">` +
    pair('י-ם', jerEsc) +
    pair('ת״א', taEsc) +
    `</div></div>`
  );
}

/** Friday mini-row in year PDF: כניסה + מוצאי (escaped segments). */
export function hebcalYearFridayLineHtml(
  city: 'jer' | 'ta',
  entryEsc: string,
  exitEsc: string,
): string {
  const label = city === 'jer' ? 'י-ם' : 'ת״א';
  return (
    `<div class="tabular-nums" style="white-space:nowrap;text-align:right;direction:rtl">` +
    `${label} כניסה: <span dir="ltr" style="unicode-bidi:isolate;display:inline-block">${entryEsc}</span> ` +
    `יציאה: <span dir="ltr" style="unicode-bidi:isolate;display:inline-block">${exitEsc}</span>` +
    `</div>`
  );
}

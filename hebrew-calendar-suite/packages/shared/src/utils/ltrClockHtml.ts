/** י-ם ות״א בשתי שורות ב-PDF; כל שעה ב-LTR isolate. */
export function hebcalJerTaPairHtml(
  jerEsc: string,
  taEsc: string,
  variant: 'labels' | 'fast',
): string {
  // In LTR documents (PDF capture), punctuation like ":" can flip to the "wrong" side for Hebrew.
  // Use an explicit RTL mark before the colon to keep it after the label.
  const colon = variant === 'labels' ? '&rlm;: ' : ' '
  const line = (city: string, t: string) =>
    `<div style="white-space:nowrap;text-align:right;direction:rtl">${city}${colon}<span dir="ltr" style="unicode-bidi:isolate;display:inline-block">${t}</span></div>`
  return (
    `<div class="tabular-nums" style="max-width:100%;line-height:1.25">` +
    `<div style="display:block;width:100%;min-width:0;direction:rtl">` +
    line('י-ם', jerEsc) +
    line('ת״א', taEsc) +
    `</div></div>`
  )
}

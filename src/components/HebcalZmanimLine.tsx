function ClockSpan({ v }: { v: string }) {
  return (
    <span
      dir="ltr"
      className="tabular-nums inline-block"
      style={{ unicodeBidi: 'isolate' }}
    >
      {v}
    </span>
  );
}

/** Hebcal wall times — each clock isolated LTR inside RTL row (fixes missing “1” near ת״א). */
export function HebcalZmanimLine({
  jer,
  ta,
  variant = 'labels',
}: {
  jer?: string | null;
  ta?: string | null;
  variant?: 'labels' | 'fast';
}) {
  const j = (jer ?? '').trim() || '—';
  const t = (ta ?? '').trim() || '—';
  const cityPrefixJer = variant === 'labels' ? 'י-ם:' : 'י-ם:';
  const cityPrefixTa = variant === 'labels' ? 'ת״א:' : 'ת״א:';
  /* Two stacked lines: first י-ם then ת״א. */
  return (
    <div
      className="w-full min-w-0 max-w-full leading-tight"
      dir="rtl"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        rowGap: 2,
      }}
    >
      <span className="whitespace-nowrap tabular-nums text-right" dir="rtl">
        <span style={{ direction: 'rtl', unicodeBidi: 'isolate' }}>{cityPrefixJer}</span>&nbsp;
        <ClockSpan v={j} />
      </span>
      <span className="whitespace-nowrap tabular-nums text-right" dir="rtl">
        <span style={{ direction: 'rtl', unicodeBidi: 'isolate' }}>{cityPrefixTa}</span>&nbsp;
        <ClockSpan v={t} />
      </span>
    </div>
  );
}

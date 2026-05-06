function ClockSpan({ v }: { v: string }) {
  return (
    <span
      dir="ltr"
      className="tabular-nums inline-block"
      style={{
        unicodeBidi: 'isolate',
        display: 'inline-block',
        fontVariantNumeric: 'tabular-nums',
      }}
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
  /* Two stacked lines: י-ם then ת״א (each clock isolated LTR inside RTL text). */
  return (
    <div
      className="w-full min-w-0 max-w-full leading-tight"
      dir="rtl"
      style={{
        display: 'grid',
        width: '100%',
        minWidth: 0,
        maxWidth: '100%',
        gridTemplateColumns: '1fr',
        rowGap: 2,
        lineHeight: 1.1,
      }}
    >
      <span
        className="whitespace-nowrap tabular-nums"
        dir="rtl"
        style={{
          whiteSpace: 'nowrap',
          fontVariantNumeric: 'tabular-nums',
          textAlign: 'right',
        }}
      >
        <span style={{ direction: 'rtl', unicodeBidi: 'isolate' }}>{cityPrefixJer}</span>&nbsp;
        <ClockSpan v={j} />
      </span>
      <span
        className="whitespace-nowrap tabular-nums"
        dir="rtl"
        style={{
          whiteSpace: 'nowrap',
          fontVariantNumeric: 'tabular-nums',
          textAlign: 'right',
        }}
      >
        <span style={{ direction: 'rtl', unicodeBidi: 'isolate' }}>{cityPrefixTa}</span>&nbsp;
        <ClockSpan v={t} />
      </span>
    </div>
  );
}


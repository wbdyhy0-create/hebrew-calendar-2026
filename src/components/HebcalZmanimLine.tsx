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
  const sep = variant === 'labels' ? ': ' : ' ';
  /* One LTR row + justify-end = flush right; י-ם then ת״א leftward (RTL spans keep clocks correct). */
  return (
    <div
      className="flex w-full min-w-0 max-w-full flex-row flex-nowrap items-baseline justify-end gap-x-2 leading-tight"
      dir="ltr"
    >
      <span className="whitespace-nowrap tabular-nums" dir="rtl">
        י-ם{sep}
        <ClockSpan v={j} />
      </span>
      <span className="whitespace-nowrap tabular-nums" dir="rtl">
        ת״א{sep}
        <ClockSpan v={t} />
      </span>
    </div>
  );
}

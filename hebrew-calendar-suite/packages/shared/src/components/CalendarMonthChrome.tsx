import type { CSSProperties, ReactNode, Ref } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { CalendarSettings, HeaderLayoutStyle } from '../utils/settings';
import { HEADER_DATE_SEPARATOR_BASELINE_Y_PX } from '../utils/settings';
import {
  resolveDetachedGridBorderRadiusPx,
  computeHeaderBox4CenterNudgeXPx,
  computeHeaderDatePairHorizontalLayoutPx,
  computeHeaderBoxRightPx,
} from '../utils/calendarDocumentStyles';

type Props = {
  settings: CalendarSettings;
  hebrewMonthTitle: string;
  gregorianLabel: string;
  onEditHeader: () => void;
  gridChildren: ReactNode;
  /** Optional ref to the underlying grid shell (month-grid) */
  gridRef?: Ref<HTMLDivElement>;
  /** Optional font-family override applied to header area only */
  headerFontFamily?: string;
  /** number of week rows in month grid (5 or 6) */
  gridWeekCount?: number;
  /**
   * When the month chrome sits under `transform: scale(s)`, pass `1/s` so header font px
   * match nominal settings after scaling (same idea as Studio `cellScaledPx`).
   */
  layoutInvScale?: number;
};

function HeaderBarNew({
  settings,
  hebrewMonthTitle,
  gregorianLabel,
  onEditHeader,
  containerWidthPx,
  headerRef,
  layoutInvScale,
}: {
  settings: CalendarSettings;
  hebrewMonthTitle: string;
  gregorianLabel: string;
  onEditHeader: () => void;
  containerWidthPx: number;
  headerRef: Ref<HTMLDivElement>;
  layoutInvScale?: number;
}) {
  const inv =
    typeof layoutInvScale === 'number' &&
    Number.isFinite(layoutInvScale) &&
    layoutInvScale > 0 &&
    Math.abs(layoutInvScale - 1) > 0.0001
      ? layoutInvScale
      : 1;
  const hfs = (px: number) => Math.max(0.01, Number(px) * inv);
  const w = Math.max(1, Math.round(Number(containerWidthPx) || 932));
  const rightPx = (offsetFromRightPx: number) => computeHeaderBoxRightPx(offsetFromRightPx, w);
  // In Studio preview the whole calendar is scaled via a parent `transform: scale(s)`.
  // Font px are counter-scaled via `layoutInvScale`, but offsets must be counter-scaled too,
  // otherwise the screen preview drifts from the printable/PDF coordinate system.
  const invShift = (layoutPx: number) => (inv === 1 ? 0 : Math.round(Number(layoutPx) * (inv - 1)));
  const box4NudgePx = computeHeaderBox4CenterNudgeXPx(settings.headerBox4OffsetXPx, w);
  const sxPct = Number((settings as any).headerTextScaleXPercent ?? 100);
  const syPct = Number((settings as any).headerTextScaleYPercent ?? 100);
  const sx = Number.isFinite(sxPct) && sxPct > 0 ? sxPct / 100 : 1;
  const sy = Number.isFinite(syPct) && syPct > 0 ? syPct / 100 : 1;
  const textScaleStyle = (origin: string): CSSProperties =>
    Math.abs(sx - 1) < 0.0001 && Math.abs(sy - 1) < 0.0001
      ? {}
      : {
          display: 'inline-block',
          transformOrigin: origin as any,
          transform: `scale(${sx}, ${sy})`,
        };

  const gWidthRef = useRef<HTMLSpanElement | null>(null);
  const hWidthRef = useRef<HTMLSpanElement | null>(null);
  const [pairX, setPairX] = useState<{ gLeft: number; hLeft: number; midX: number } | null>(null);

  useLayoutEffect(() => {
    const gw = Math.round(gWidthRef.current?.getBoundingClientRect().width ?? 0);
    const hw = Math.round(hWidthRef.current?.getBoundingClientRect().width ?? 0);
    if (gw < 1 || hw < 1 || w < 1) return;

    const sepOn = settings.headerDatePairSeparatorEnabled === true;
    const sepW = Math.max(1, Math.round(Number(settings.headerDatePairSeparatorWidthPx) || 2));
    const { gLeft, hLeft, midX } = computeHeaderDatePairHorizontalLayoutPx({
      barWidthPx: w,
      gregTextWidthPx: gw,
      hebrewTextWidthPx: hw,
      headerBox3OffsetXPx: settings.headerBox3OffsetXPx,
      headerBox4OffsetXPx: settings.headerBox4OffsetXPx,
      separatorEnabled: sepOn,
      separatorWidthPx: sepW,
      separatorSidePadPx: 6,
    });

    setPairX((prev) =>
      prev &&
      Math.abs(prev.gLeft - gLeft) < 0.5 &&
      Math.abs(prev.hLeft - hLeft) < 0.5 &&
      Math.abs(prev.midX - midX) < 0.5
        ? prev
        : { gLeft, hLeft, midX },
    );
  }, [
    w,
    hebrewMonthTitle,
    gregorianLabel,
    settings.headerBox3OffsetXPx,
    settings.headerBox4OffsetXPx,
    settings.headerBox3FontPx,
    settings.headerBox4FontPx,
    settings.headerBox3FontWeight,
    settings.headerBox4FontWeight,
    settings.headerDatePairSeparatorEnabled,
    settings.headerDatePairSeparatorWidthPx,
    inv,
    sxPct,
    syPct,
  ]);

  const sepOn = settings.headerDatePairSeparatorEnabled === true;
  const sepW = Math.max(1, Math.round(Number(settings.headerDatePairSeparatorWidthPx) || 2));
  const sepInsetY = Math.max(0, Math.round(Number(settings.headerDatePairSeparatorInsetYPx) || 0));
  const sepOffsetY =
    HEADER_DATE_SEPARATOR_BASELINE_Y_PX + Math.round(Number(settings.headerDatePairSeparatorOffsetYPx) || 0);
  const sepColor =
    typeof settings.headerDatePairSeparatorColor === 'string' && settings.headerDatePairSeparatorColor.trim()
      ? settings.headerDatePairSeparatorColor.trim()
      : '#94a3b8';
  const yPair3 = settings.headerBox3OffsetYPx;
  const yPair4 = settings.headerBox4OffsetYPx;
  const pairBandTopPad = 2;
  const sepBot3 = yPair3 + pairBandTopPad + hfs(settings.headerBox3FontPx) * 1.2;
  const sepBot4 = yPair4 + pairBandTopPad + hfs(settings.headerBox4FontPx) * 1.2;
  const sepHeight = Math.max(8, Math.round(Math.max(sepBot3, sepBot4) - (Math.min(yPair3, yPair4) + pairBandTopPad) - 2 * sepInsetY));
  const sepLeft =
    pairX != null ? Math.round(pairX.midX - sepW / 2) : Math.round(w / 2 - sepW / 2);
  const barMidY = Math.max(0, Math.round((Number(settings.headerBarHeightPx) || 0) / 2));
  // Separator Y is independent from the labels (no magnet / no auto-centering).
  // `headerDatePairSeparatorOffsetYPx` controls the line position inside the bar (applied via sepOffsetY).
  const sepTopRelToMid = Math.round(Number(sepOffsetY));
  const sepTopPx = Math.round(barMidY + sepTopRelToMid + invShift(sepTopRelToMid));

  const headerIntegrated = settings.headerLayoutStyle === 'grid_integrated';
  const r = Math.max(0, Math.round(Number(settings.headerBarRadiusPx) || 0));
  const bw = Math.max(0, Math.round(Number(settings.headerBarBorderWidthPx) || 0));
  const bc = settings.headerBarBorderColor;
  const headerBarMarginBottom = Math.max(0, Math.round(Number(settings.headerBarMarginBottomPx) || 0));

  return (
    <div
      dir="ltr"
      data-inspect="header"
      ref={headerRef}
      style={{
        position: 'relative',
        width: '100%',
        // Keep the authored baseline height, but allow the bar to grow when users
        // stretch/enlarge header text (otherwise overflowY hidden clips and looks like a “white shelf”).
        minHeight: settings.headerBarHeightPx,
        height: 'auto',
        background: settings.headerBarBg,
        ...(headerIntegrated
          ? {
              borderTopWidth: bw,
              borderLeftWidth: bw,
              borderRightWidth: bw,
              borderBottomWidth: 0,
              borderStyle: 'solid',
              borderColor: bc,
              borderRadius: r > 0 ? `${r}px ${r}px 0 0` : 0,
              marginBottom: headerBarMarginBottom,
            }
          : {
              border: `${bw}px solid ${bc}`,
              borderRadius: settings.headerBarRadiusPx,
              marginBottom: headerBarMarginBottom,
            }),
        // Keep vertical clipping for neat header bar,
        // but allow horizontal overflow so long Hebrew titles aren't truncated.
        overflowY: 'visible',
        overflowX: 'visible',
        transform: `translateY(${settings.headerBarOffsetYPx}px)`,
        maxWidth: settings.headerBarMaxWidthPx > 0 ? settings.headerBarMaxWidthPx : undefined,
        marginLeft: 'auto',
        marginRight: 'auto',
        boxSizing: 'border-box',
      }}
    >
      {/* תיבה 1: כותרת ראשית */}
      <div
        style={{
          position: 'absolute',
          right: rightPx(settings.headerBox1OffsetXPx),
          top: barMidY,
          transform: `translate(${-invShift(rightPx(settings.headerBox1OffsetXPx))}px, calc(-50% + ${settings.headerBox1OffsetYPx + invShift(settings.headerBox1OffsetYPx)}px))`,
          paddingTop: 2,
          paddingBottom: 2,
          fontSize: hfs(settings.headerBox1FontPx),
          fontWeight: settings.headerBox1FontWeight,
          color: settings.headerBox1Color,
          whiteSpace: 'nowrap',
          lineHeight: 1.2,
          direction: 'rtl',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <span style={textScaleStyle('right top')}>
          {String((settings as any).headerBox1TextOverride ?? '').trim() || settings.titleMain}
        </span>
      </div>

      {/* תיבה 2: כותרת משנה */}
      <div
        style={{
          position: 'absolute',
          right: rightPx(settings.headerBox2OffsetXPx),
          top: barMidY,
          transform: `translate(${-invShift(rightPx(settings.headerBox2OffsetXPx))}px, calc(-50% + ${settings.headerBox2OffsetYPx + invShift(settings.headerBox2OffsetYPx)}px))`,
          paddingTop: 2,
          paddingBottom: 2,
          fontSize: hfs(settings.headerBox2FontPx),
          fontWeight: settings.headerBox2FontWeight,
          color: settings.headerBox2Color,
          whiteSpace: 'nowrap',
          lineHeight: 1.2,
          direction: 'rtl',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <span style={textScaleStyle('right top')}>
          {String((settings as any).headerBox2TextOverride ?? '').trim() || settings.titleSub}
        </span>
      </div>

      {/* מדידה שקופה למניעת חפיפה בין תיבות 3+4 */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          width: '100%',
          height: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
          opacity: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
        }}
      >
        <span
          ref={gWidthRef}
          style={{
            display: 'inline-block',
            paddingTop: 2,
            paddingBottom: 2,
            fontSize: hfs(settings.headerBox4FontPx),
            fontWeight: settings.headerBox4FontWeight,
            color: settings.headerBox4Color,
            whiteSpace: 'nowrap',
            lineHeight: 1.2,
            direction: 'ltr',
          }}
        >
          <span style={textScaleStyle('center top')}>{gregorianLabel}</span>
        </span>
        <span
          ref={hWidthRef}
          style={{
            display: 'inline-block',
            paddingTop: 2,
            paddingBottom: 2,
            fontSize: hfs(settings.headerBox3FontPx),
            fontWeight: settings.headerBox3FontWeight,
            color: settings.headerBox3Color,
            whiteSpace: 'nowrap',
            lineHeight: 1.2,
            direction: 'rtl',
          }}
        >
          <span style={textScaleStyle('right top')}>{hebrewMonthTitle}</span>
        </span>
      </div>

      {/* קו מפריד אנכי בין חודש עברי ללועזי */}
      {sepOn && pairX != null ? (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: sepLeft,
            top: sepTopPx,
            transform: `translateX(${invShift(sepLeft)}px) translateY(-50%)`,
            width: sepW,
            height: sepHeight,
            background: sepColor,
            borderRadius: 1,
            pointerEvents: 'none',
          }}
        />
      ) : null}

      {/* תיבה 3: חודש עברי */}
      <div
        style={{
          position: 'absolute',
          right: rightPx(settings.headerBox3OffsetXPx),
          top: barMidY,
          transform: `translate(${-invShift(rightPx(settings.headerBox3OffsetXPx))}px, calc(-50% + ${settings.headerBox3OffsetYPx + invShift(settings.headerBox3OffsetYPx)}px))`,
          paddingTop: 2,
          paddingBottom: 2,
          fontSize: hfs(settings.headerBox3FontPx),
          fontWeight: settings.headerBox3FontWeight,
          color: settings.headerBox3Color,
          whiteSpace: 'nowrap',
          lineHeight: 1.2,
          direction: 'rtl',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <span style={textScaleStyle('right top')}>{hebrewMonthTitle}</span>
      </div>

      {/* תיבה 4: חודש לועזי */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          transform: `translateX(calc(-50% + ${Math.round(box4NudgePx * inv)}px)) translateY(calc(-50% + ${settings.headerBox4OffsetYPx + invShift(settings.headerBox4OffsetYPx)}px))`,
          top: barMidY,
          paddingTop: 2,
          paddingBottom: 2,
          fontSize: hfs(settings.headerBox4FontPx),
          fontWeight: settings.headerBox4FontWeight,
          color: settings.headerBox4Color,
          whiteSpace: 'nowrap',
          lineHeight: 1.2,
          direction: 'ltr',
          textAlign: 'center',
          // Do not clip: users can stretch the header text horizontally, and the bar already
          // allows horizontal overflow (overflowX: visible).
          maxWidth: '100%',
          overflow: 'visible',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <span style={textScaleStyle('center top')}>{gregorianLabel}</span>
      </div>

      {/* כפתור עריכה */}
      {settings.headerBarShowEditButton ? (
        <button
          type="button"
          style={{
            position: 'absolute',
            left: 12,
            top: 12,
            zIndex: 10,
          }}
          className="rounded-md border border-slate-200 bg-white/90 px-2 py-1 text-xs text-slate-700 hover:bg-white"
          onClick={onEditHeader}
        >
          ערוך
        </button>
      ) : null}
    </div>
  );
}

function gridShellProps(
  layout: HeaderLayoutStyle,
  settings: CalendarSettings,
): { className: string; style: CSSProperties } {
  const isIntegrated = layout === 'grid_integrated';
  /** Small gutters so cells read as separate; gutters use neutral white—not `gridShellBg`. */
  const gapPx = 4;
  const padPx = 4;
  return {
    // Keep className for Studio (Tailwind), but also provide full inline styles so
    // Display can render correctly without Tailwind.
    className: 'relative grid grid-cols-7 overflow-hidden backdrop-blur-[1px] shadow-sm',
    style: {
      position: 'relative',
      display: 'grid',
      gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
      overflow: 'hidden',
      // Tailwind's `backdrop-blur-[1px]` equivalent:
      backdropFilter: 'blur(1px)',
      // Keep a subtle outer shadow, but also enforce a crisp outer outline so the
      // full grid border remains visible in `grid_integrated` (gap between cells).
      boxShadow: `0 1px 2px 0 rgba(15, 23, 42, 0.08), inset 0 0 0 ${settings.gridBorderWidthPx}px ${settings.gridBorderColor}`,
      border: `${settings.gridBorderWidthPx}px solid ${settings.gridBorderColor}`,
      background: settings.gridShellBg,
      borderRadius: isIntegrated
        ? (() => {
            const br = resolveDetachedGridBorderRadiusPx(settings);
            return `0 0 ${br}px ${br}px`;
          })()
        : resolveDetachedGridBorderRadiusPx(settings),
      ...(isIntegrated
        ? {
            gap: gapPx,
            padding: padPx,
            // In integrated header mode, padding creates a white strip above the weekday row.
            // Remove only the top padding so the grid starts immediately at the weekday headers.
            paddingTop: 0,
            background: '#ffffff',
          }
        : null),
    },
  };
}

export function CalendarMonthChrome({
  settings,
  hebrewMonthTitle,
  gregorianLabel,
  onEditHeader,
  gridChildren,
  gridRef,
  headerFontFamily,
  gridWeekCount,
  layoutInvScale,
}: Props) {
  const layout: HeaderLayoutStyle = settings.headerLayoutStyle;

  const headerElRef = useRef<HTMLDivElement | null>(null);
  const [headerWidthPx, setHeaderWidthPx] = useState<number>(932);

  useEffect(() => {
    const el = headerElRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.round(el.clientWidth || rect.width || 0);
      if (w > 0) setHeaderWidthPx((prev) => (prev === w ? prev : w));
    };
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const weekRows = Math.max(5, Math.min(6, Number(gridWeekCount) || 6));
  const weekdayRowOffsetY = Number(settings.gridWeekdayHeaderRowOffsetYPx) || 0;
  const weekdayTrackH =
    settings.gridWeekdayHeaderHeightPx + Math.max(0, Math.round(weekdayRowOffsetY));
  const minWeekRowH = Math.max(72, Math.round((Number(settings.pdfExportCellHeightPx) || 92) * 0.82));

  const shell = gridShellProps(layout, settings);
  const headerFontStyle = headerFontFamily ? ({ fontFamily: headerFontFamily } as const) : null;
  const gridOffsetY = Math.round(Number((settings as any).gridOffsetYPx ?? 0));
  const grid = (
    <div
      ref={gridRef}
      {...shell}
      dir="ltr"
      data-inspect="month-grid"
      style={{
        ...(shell.style ?? {}),
        ...(layout !== 'grid_integrated' && gridOffsetY !== 0 ? { transform: `translateY(${gridOffsetY}px)` } : null),
        ...(settings.layoutFillHeight
          ? {
              height: '100%',
              flex: 1,
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
              gridTemplateRows: `${weekdayTrackH}px repeat(${weekRows}, minmax(${minWeekRowH}px, 1fr))`,
              gridAutoRows: '1fr',
              alignContent: 'stretch',
            }
          : null),
      }}
    >
      {gridChildren}
    </div>
  );

  const wrapperStyle: CSSProperties | undefined = settings.layoutFillHeight
    ? { height: '100%', display: 'flex', flexDirection: 'column' }
    : undefined;

  return (
    <div
      className={['relative w-full'].join(' ')}
      style={{ ...(wrapperStyle ?? null), ...(headerFontStyle ?? null) } as CSSProperties}
    >
      <HeaderBarNew
        settings={settings}
        hebrewMonthTitle={hebrewMonthTitle}
        gregorianLabel={gregorianLabel}
        onEditHeader={onEditHeader}
        containerWidthPx={headerWidthPx}
        headerRef={headerElRef as any}
        layoutInvScale={layoutInvScale}
      />
      {grid}
    </div>
  );
}


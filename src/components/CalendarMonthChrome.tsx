import type { CSSProperties, ReactNode } from 'react';
import type { CalendarSettings, HeaderLayoutStyle } from '../utils/settings';
import {
  resolveCalendarLayoutZoomPercent,
  resolveCenteredPillCatalogSubtitleFontPx,
  resolveCenteredPillCatalogTitleFontPx,
  resolveDetachedGridBorderRadiusPx,
  resolveHeaderBarPrimaryTitleFontPx,
  resolveHeaderBarSecondaryTitleFontPx,
  resolveMinimalGregorianFontPx,
  resolveMinimalHebrewMonthFontPx,
  resolveMinimalMainTitleFontPx,
  resolveMinimalSubtitleFontPx,
} from '../utils/calendarDocumentStyles';
import type { HeaderWysiwygClassicAlign, HeaderWysiwygClassicPct } from '../utils/headerWysiwyg';
import { HeaderWysiwygClassicStage } from './HeaderWysiwygClassicStage';
import { DEFAULT_HEADER_WYSIWYG_CLASSIC_ALIGN } from '../utils/headerWysiwyg';

type Props = {
  settings: CalendarSettings;
  hebrewMonthTitle: string;
  gregorianLabel: string;
  onEditHeader: () => void;
  gridChildren: ReactNode;
  /** Optional font-family override applied to header area only */
  headerFontFamily?: string;
  /** מצב עריכת פריסה (גרירה/שינוי גודל) — לא נשמר ב־localStorage כהגדרה נפרדת */
  headerLayoutEditMode?: boolean;
  onHeaderWysiwygClassicPctChange?: (pct: HeaderWysiwygClassicPct) => void;
  onHeaderWysiwygClassicAlignChange?: (align: HeaderWysiwygClassicAlign) => void;
  /** number of week rows in month grid (5 or 6) */
  gridWeekCount?: number;
};

function HeaderEditButton({
  show,
  className,
  onClick,
}: {
  show: boolean;
  className?: string;
  onClick: () => void;
}) {
  if (!show) return null;
  return (
    <button
      type="button"
      className={[
        'rounded-md border border-slate-200 bg-white/90 px-2 py-1 text-xs text-slate-700 hover:bg-white',
        className ?? '',
      ].join(' ')}
      onClick={onClick}
    >
      ערוך
    </button>
  );
}

function GregChip({ settings, children }: { settings: CalendarSettings; children: ReactNode }) {
  return (
    <div
      className="leading-none"
      style={{
        fontSize: settings.headerGregMonthFontPx,
        color: settings.headerGregMonthTextColor,
        borderStyle: 'solid',
        borderColor: settings.headerGregMonthBorderColor,
        borderWidth: settings.headerGregMonthBorderWidthPx,
        background: settings.headerGregMonthBg,
        borderRadius: settings.headerGregMonthRadiusPx,
        paddingLeft: settings.headerGregMonthPaddingXPx,
        paddingRight: settings.headerGregMonthPaddingXPx,
        paddingTop: settings.headerGregMonthPaddingYPx,
        paddingBottom: settings.headerGregMonthPaddingYPx,
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        lineHeight: 1,
        boxSizing: 'border-box',
        maxWidth: '100%',
      }}
    >
      {children}
    </div>
  );
}

/** כותרת חודש עברי במרכז — טקסט בלבד (בלי תג/מסגרת). */
function HebMonthTitle({ settings, children }: { settings: CalendarSettings; children: ReactNode }) {
  return (
    <span
      className="hebPill leading-none"
      style={{
        fontSize: settings.headerHebMonthFontPx,
        fontWeight: settings.headerHebMonthFontWeight,
        color: settings.headerHebMonthTextColor,
        whiteSpace: 'nowrap',
        lineHeight: 1,
      }}
    >
      {children}
    </span>
  );
}

/** פס כותרת מלא עם שלושת האזורים (ימין / מרכז / שמאל) — מתאים ל־floating ול־seamless */
function HeaderBarClassic({
  settings,
  hebrewMonthTitle,
  gregorianLabel,
  onEditHeader,
  barStyle,
  outerClassName,
  layoutEditMode = false,
  onHeaderWysiwygClassicPctChange,
  onHeaderWysiwygClassicAlignChange,
}: {
  settings: CalendarSettings;
  hebrewMonthTitle: string;
  gregorianLabel: string;
  onEditHeader: () => void;
  barStyle: CSSProperties;
  outerClassName: string;
  layoutEditMode?: boolean;
  onHeaderWysiwygClassicPctChange?: (pct: HeaderWysiwygClassicPct) => void;
  onHeaderWysiwygClassicAlignChange?: (align: HeaderWysiwygClassicAlign) => void;
}) {
  const barMinH =
    typeof barStyle.minHeight === 'number'
      ? barStyle.minHeight
      : settings.headerBarHeightPx;

  const useWysiwyg =
    settings.headerWysiwygManualActive &&
    settings.headerWysiwygClassicPct !== null &&
    (settings.headerLayoutStyle === 'floating' || settings.headerLayoutStyle === 'seamless');

  if (useWysiwyg && settings.headerWysiwygClassicPct) {
    const dragScale = resolveCalendarLayoutZoomPercent(settings) / 100;
    const align = settings.headerWysiwygClassicAlign ?? DEFAULT_HEADER_WYSIWYG_CLASSIC_ALIGN;
    return (
      <div className={[outerClassName, 'overflow-visible'].join(' ')} data-inspect="header" style={barStyle}>
        <HeaderWysiwygClassicStage
          pct={settings.headerWysiwygClassicPct}
          align={align}
          layoutEditMode={layoutEditMode}
          barMinHeightPx={barMinH}
          dragScale={dragScale}
          onPctChange={onHeaderWysiwygClassicPctChange ?? (() => {})}
          onAlignChange={onHeaderWysiwygClassicAlignChange ?? (() => {})}
          titlesContent={
            <>
              <div
                className="break-words font-normal leading-snug tracking-tight"
                style={{
                  color: settings.headerBarTitleColor,
                  fontSize: resolveHeaderBarPrimaryTitleFontPx(settings),
                }}
              >
                {settings.titleMain}
              </div>
              <div
                className="break-words leading-snug"
                style={{
                  color: settings.headerBarSubtitleColor,
                  fontSize: resolveHeaderBarSecondaryTitleFontPx(settings),
                }}
              >
                {settings.titleSub}
              </div>
            </>
          }
          hebrewContent={<HebMonthTitle settings={settings}>{hebrewMonthTitle}</HebMonthTitle>}
          gregorianContent={<GregChip settings={settings}>{gregorianLabel}</GregChip>}
        />
        <HeaderEditButton
          show={settings.headerBarShowEditButton}
          className="absolute left-3 top-3 z-40"
          onClick={onEditHeader}
        />
      </div>
    );
  }

  return (
    <div className={[outerClassName, 'overflow-visible'].join(' ')} data-inspect="header" style={barStyle}>
      <div className="relative grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 overflow-visible px-5 py-1.5 sm:px-6">
        <div
          className="min-w-0 max-w-full justify-self-end overflow-visible text-right"
          style={{
            transform: `translate(${settings.headerBarTitlesOffsetXPx}px, ${settings.headerBarTitlesOffsetYPx}px)`,
          }}
        >
          <div className="flex flex-col items-end gap-0.5">
            <div
              className="break-words text-right font-normal leading-snug tracking-tight"
              style={{
                color: settings.headerBarTitleColor,
                fontSize: resolveHeaderBarPrimaryTitleFontPx(settings),
              }}
            >
              {settings.titleMain}
            </div>
            <div
              className="break-words text-right leading-snug"
              style={{
                color: settings.headerBarSubtitleColor,
                fontSize: resolveHeaderBarSecondaryTitleFontPx(settings),
              }}
            >
              {settings.titleSub}
            </div>
          </div>
        </div>

        <div
          className="flex shrink-0 justify-center overflow-visible px-1"
          style={{
            transform: `translate(${settings.headerBarMonthPillOffsetXPx}px, ${settings.headerBarMonthPillOffsetYPx}px)`,
          }}
        >
          <HebMonthTitle settings={settings}>{hebrewMonthTitle}</HebMonthTitle>
        </div>

        <div className="min-w-0 justify-self-start overflow-visible">
          <GregChip settings={settings}>{gregorianLabel}</GregChip>
        </div>

        <HeaderEditButton
          show={settings.headerBarShowEditButton}
          className="absolute left-3 top-3 z-20"
          onClick={onEditHeader}
        />
      </div>
    </div>
  );
}

function gridShellProps(
  layout: HeaderLayoutStyle,
  settings: CalendarSettings,
): { className: string; style: CSSProperties } {
  const base = 'relative grid grid-cols-7 overflow-hidden backdrop-blur-[1px]';
  if (layout === 'seamless') {
    return {
      className: base,
      style: {
        background: settings.gridShellBg,
        border: 'none',
        borderBottomLeftRadius: settings.headerBarRadiusPx,
        borderBottomRightRadius: settings.headerBarRadiusPx,
      },
    };
  }
  return {
    className: [base, 'shadow-sm'].join(' '),
    style: {
      border: `${settings.gridBorderWidthPx}px solid ${settings.gridBorderColor}`,
      background: settings.gridShellBg,
      borderRadius: resolveDetachedGridBorderRadiusPx(settings),
    },
  };
}

export function CalendarMonthChrome({
  settings,
  hebrewMonthTitle,
  gregorianLabel,
  onEditHeader,
  gridChildren,
  headerFontFamily,
  headerLayoutEditMode = false,
  onHeaderWysiwygClassicPctChange,
  onHeaderWysiwygClassicAlignChange,
  gridWeekCount,
}: Props) {
  const headerFontStyle = headerFontFamily ? ({ fontFamily: headerFontFamily } as const) : null;
  const layout: HeaderLayoutStyle = settings.headerLayoutStyle;
  const weekRows = Math.max(5, Math.min(6, Number(gridWeekCount) || 6));
  const weekdayRowOffsetY = Number(settings.gridWeekdayHeaderRowOffsetYPx) || 0;
  // If the weekday header row is nudged downward, it can visually overlap the first week.
  // Make the first grid track tall enough to accommodate that nudge.
  const weekdayTrackH =
    settings.gridWeekdayHeaderHeightPx + Math.max(0, Math.round(weekdayRowOffsetY));
  // When filling height, week rows must not shrink too much; otherwise cell content can visually
  // overlap. Keep a conservative minimum that still allows stretching.
  const minWeekRowH = Math.max(72, Math.round((Number(settings.pdfExportCellHeightPx) || 92) * 0.82));
  const shell = gridShellProps(layout, settings);
  const grid = (
    <div
      {...shell}
      data-inspect="month-grid"
      style={{
        ...(shell.style ?? {}),
        ...(settings.layoutFillHeight
          ? {
              height: '100%',
              flex: 1,
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
              // Keep the weekday header at a stable px height; otherwise, when the grid is
              // stretched with `fr` rows, the header can become shorter than its fixed
              // inner height and overflow into the first week row (visual overlap).
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

  // When filling height, keep header + grid in a flex column so the grid can stretch.
  const wrapIfFill = (node: ReactNode) =>
    settings.layoutFillHeight ? (
      <div className="flex h-full w-full min-w-0 flex-col overflow-visible">{node}</div>
    ) : (
      <>{node}</>
    );

  if (layout === 'minimal_text') {
    return wrapIfFill(
      <div className="relative w-full">
        <div
          data-inspect="header"
          className="relative mx-auto mb-6 mt-0 w-full max-w-full overflow-visible px-5 text-center sm:px-6"
          style={{
            marginBottom: Math.max(settings.headerBarMarginBottomPx, 16),
            ...(headerFontStyle ?? {}),
          }}
        >
          {settings.headerBarShowEditButton ? (
            <HeaderEditButton
              show
              className="absolute left-3 top-0 z-20 sm:left-4"
              onClick={onEditHeader}
            />
          ) : null}
          <div
            style={{
              transform: `translate(${settings.headerBarTitlesOffsetXPx}px, ${settings.headerBarTitlesOffsetYPx}px)`,
            }}
          >
            <div
              className="font-normal tracking-tight"
              style={{
                color: settings.headerBarTitleColor,
                fontSize: resolveMinimalMainTitleFontPx(settings),
              }}
            >
              {settings.titleMain}
            </div>
            <div
              className="mt-1"
              style={{
                color: settings.headerBarSubtitleColor,
                fontSize: resolveMinimalSubtitleFontPx(settings),
              }}
            >
              {settings.titleSub}
            </div>
          </div>
          <div
            style={{
              transform: `translate(${settings.headerBarMonthPillOffsetXPx}px, ${settings.headerBarMonthPillOffsetYPx}px)`,
            }}
          >
            <div
              className="mt-4 font-normal"
              style={{
                color: settings.headerHebMonthTextColor,
                fontSize: resolveMinimalHebrewMonthFontPx(settings),
              }}
            >
              {hebrewMonthTitle}
            </div>
            <div
              className="mt-2 text-slate-600"
              style={{
                color: settings.headerGregMonthTextColor,
                fontSize: resolveMinimalGregorianFontPx(settings),
              }}
            >
              {gregorianLabel}
            </div>
          </div>
        </div>
        {grid}
      </div>
    );
  }

  if (layout === 'right_block') {
    const r = settings.headerBarRadiusPx;
    return wrapIfFill(
      <div className="relative w-full">
        <div
          data-inspect="header"
          className="relative mx-auto mb-0 w-full max-w-full overflow-visible shadow-sm"
          style={{
            marginBottom: settings.headerBarMarginBottomPx,
            transform: `translateY(${settings.headerBarOffsetYPx}px)`,
            maxWidth:
              settings.headerBarMaxWidthPx > 0 ? `${settings.headerBarMaxWidthPx}px` : undefined,
            ...(headerFontStyle ?? {}),
          }}
        >
          <div
            className="flex w-full min-w-0 max-w-full flex-row items-center justify-between gap-3 overflow-visible px-5 py-3 sm:px-6"
            style={{
              minHeight: settings.headerBarHeightPx,
              background: settings.headerBarBg,
              borderColor: settings.headerBarBorderColor,
              borderWidth: settings.headerBarBorderWidthPx,
              borderStyle: 'solid',
              borderRadius: r,
            }}
          >
            {/* ב־RTL פריט ראשון מיושר לימין — בלוק חודש/שנה */}
            <div
              className="flex max-w-[min(100%,45%)] shrink-0 flex-col items-center justify-center gap-2 overflow-visible rounded-lg border p-3 text-center shadow-sm sm:p-4"
              style={{
                borderColor: settings.headerBarBorderColor,
                background: settings.headerHebMonthBg,
                minWidth: 'max-content',
                transform: `translate(${settings.headerBarMonthPillOffsetXPx}px, ${settings.headerBarMonthPillOffsetYPx}px)`,
              }}
            >
              <HebMonthTitle settings={settings}>{hebrewMonthTitle}</HebMonthTitle>
              <GregChip settings={settings}>{gregorianLabel}</GregChip>
            </div>
            <div
              className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col items-end gap-0.5 overflow-visible text-right"
              style={{
                transform: `translate(${settings.headerBarTitlesOffsetXPx}px, ${settings.headerBarTitlesOffsetYPx}px)`,
              }}
            >
              <div
                className="max-w-full break-words font-normal leading-snug tracking-tight"
                style={{
                  color: settings.headerBarTitleColor,
                  fontSize: resolveHeaderBarPrimaryTitleFontPx(settings),
                }}
              >
                {settings.titleMain}
              </div>
              <div
                className="max-w-full break-words leading-snug"
                style={{
                  color: settings.headerBarSubtitleColor,
                  fontSize: resolveHeaderBarSecondaryTitleFontPx(settings),
                }}
              >
                {settings.titleSub}
              </div>
            </div>
          </div>
          {settings.headerBarShowEditButton ? (
            <HeaderEditButton
              show
              className="absolute left-3 top-3 z-20"
              onClick={onEditHeader}
            />
          ) : null}
        </div>
        {grid}
      </div>
    );
  }

  if (layout === 'centered_pill') {
    return wrapIfFill(
      <div className="relative w-full">
        <div
          data-inspect="header"
          className="relative mx-auto flex w-full max-w-full min-w-0 flex-col items-center overflow-visible px-5 sm:px-6"
          style={{
            marginBottom: settings.headerBarMarginBottomPx,
            transform: `translateY(${settings.headerBarOffsetYPx}px)`,
            maxWidth:
              settings.headerBarMaxWidthPx > 0 ? `${settings.headerBarMaxWidthPx}px` : undefined,
            ...(headerFontStyle ?? {}),
          }}
        >
          {settings.headerBarShowEditButton ? (
            <HeaderEditButton
              show
              className="absolute left-3 top-2 z-20 sm:left-4"
              onClick={onEditHeader}
            />
          ) : null}
          <div
            className="mt-6 inline-flex max-w-full min-w-0 flex-wrap items-center justify-center gap-3 px-5 py-3 shadow-md sm:gap-4 sm:px-8 sm:py-3.5"
            style={{
              background: settings.headerBarBg,
              borderColor: settings.headerBarBorderColor,
              borderWidth: settings.headerBarBorderWidthPx,
              borderStyle: 'solid',
              borderRadius: 9999,
              transform: `translate(${settings.headerBarMonthPillOffsetXPx}px, ${settings.headerBarMonthPillOffsetYPx}px)`,
              width: 'max-content',
              maxWidth: '100%',
            }}
          >
            <GregChip settings={settings}>{gregorianLabel}</GregChip>
            <HebMonthTitle settings={settings}>{hebrewMonthTitle}</HebMonthTitle>
          </div>
          <div
            className="mt-3 flex w-full max-w-full min-w-0 flex-col items-center gap-1 overflow-visible px-4 text-center sm:px-5"
            style={{
              transform: `translate(${settings.headerBarTitlesOffsetXPx}px, ${settings.headerBarTitlesOffsetYPx}px)`,
            }}
          >
            <div
              className="max-w-full break-words font-normal tracking-tight"
              style={{
                color: settings.headerBarTitleColor,
                fontSize: resolveCenteredPillCatalogTitleFontPx(settings),
              }}
            >
              {settings.titleMain}
            </div>
            <div
              className="max-w-full break-words"
              style={{
                color: settings.headerBarSubtitleColor,
                fontSize: resolveCenteredPillCatalogSubtitleFontPx(settings),
              }}
            >
              {settings.titleSub}
            </div>
          </div>
        </div>
        {grid}
      </div>
    );
  }

  if (layout === 'seamless') {
    const r = settings.headerBarRadiusPx;
    const barStyle: CSSProperties = {
      minHeight: settings.headerBarHeightPx,
      height: 'auto',
      background: settings.headerBarBg,
      border: 'none',
      borderBottom: `${settings.gridWeekdayHeaderBorderBottomWidthPx}px solid ${settings.gridWeekdayHeaderBorderBottomColor}`,
      borderRadius: `${r}px ${r}px 0 0`,
      marginBottom: 0,
      transform: `translateY(${settings.headerBarOffsetYPx}px)`,
      maxWidth:
        settings.headerBarMaxWidthPx > 0 ? `${settings.headerBarMaxWidthPx}px` : undefined,
      ...(headerFontStyle ?? {}),
    };
    return wrapIfFill(
      <div
        data-inspect="header-chrome"
        className="mx-auto w-full max-w-full min-w-0 overflow-x-visible overflow-y-visible shadow-sm backdrop-blur-[1px]"
        style={{
          border: `${settings.gridBorderWidthPx}px solid ${settings.gridBorderColor}`,
          borderRadius: r,
          maxWidth:
            settings.headerBarMaxWidthPx > 0 ? `${settings.headerBarMaxWidthPx}px` : undefined,
        }}
      >
        <HeaderBarClassic
          settings={settings}
          hebrewMonthTitle={hebrewMonthTitle}
          gregorianLabel={gregorianLabel}
          onEditHeader={onEditHeader}
          barStyle={barStyle}
          outerClassName="relative w-full min-w-0 overflow-visible"
          layoutEditMode={headerLayoutEditMode}
          onHeaderWysiwygClassicPctChange={onHeaderWysiwygClassicPctChange}
          onHeaderWysiwygClassicAlignChange={onHeaderWysiwygClassicAlignChange}
        />
        {grid}
      </div>
    );
  }

  // floating (default): כרטיס צף נפרד מהרשת
  const barStyle: CSSProperties = {
    minHeight: settings.headerBarHeightPx,
    height: 'auto',
    background: settings.headerBarBg,
    borderColor: settings.headerBarBorderColor,
    borderWidth: settings.headerBarBorderWidthPx,
    borderStyle: 'solid',
    borderRadius: settings.headerBarRadiusPx,
    marginBottom: settings.headerBarMarginBottomPx,
    transform: `translateY(${settings.headerBarOffsetYPx}px)`,
    maxWidth:
      settings.headerBarMaxWidthPx > 0 ? `${settings.headerBarMaxWidthPx}px` : undefined,
    ...(headerFontStyle ?? {}),
  };

  return wrapIfFill(
    <div className="relative w-full">
      <HeaderBarClassic
        settings={settings}
        hebrewMonthTitle={hebrewMonthTitle}
        gregorianLabel={gregorianLabel}
        onEditHeader={onEditHeader}
        barStyle={barStyle}
        outerClassName="relative mx-auto mt-0 w-full min-w-0 max-w-full overflow-visible rounded-xl shadow-md backdrop-blur-[1px]"
        layoutEditMode={headerLayoutEditMode}
        onHeaderWysiwygClassicPctChange={onHeaderWysiwygClassicPctChange}
        onHeaderWysiwygClassicAlignChange={onHeaderWysiwygClassicAlignChange}
      />
      {grid}
    </div>
  );
}

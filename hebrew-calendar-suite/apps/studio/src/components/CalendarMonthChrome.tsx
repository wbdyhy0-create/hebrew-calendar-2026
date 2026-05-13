import type { CSSProperties, ReactNode } from 'react';

import type { CalendarSettings, HeaderLayoutStyle } from '@hebrew-calendar/shared';
import { resolveDetachedGridBorderRadiusPx } from '../utils/calendarDocumentStyles';

type Props = {
  settings: CalendarSettings;
  hebrewMonthTitle: string;
  gregorianLabel: string;
  onEditHeader: () => void;
  gridChildren: ReactNode;
  /** Optional font-family override applied to header area only */
  headerFontFamily?: string;
  /** number of week rows in month grid (5 or 6) */
  gridWeekCount?: number;
};

function HeaderBarNew({
  settings,
  hebrewMonthTitle,
  gregorianLabel,
  onEditHeader,
}: {
  settings: CalendarSettings;
  hebrewMonthTitle: string;
  gregorianLabel: string;
  onEditHeader: () => void;
}) {
  const box1Text = (settings.headerBox1TextOverride ?? '').trim() || settings.titleMain;
  const box2Text = (settings.headerBox2TextOverride ?? '').trim() || settings.titleSub;
  const box3Text = (settings.headerBox3TextOverride ?? '').trim() || hebrewMonthTitle;
  const box4Text = (settings.headerBox4TextOverride ?? '').trim() || gregorianLabel;
  return (
    <div
      dir="ltr"
      data-inspect="header"
      style={{
        position: 'relative',
        width: '100%',
        height: settings.headerBarHeightPx,
        background: settings.headerBarBg,
        border: `${settings.headerBarBorderWidthPx}px solid ${settings.headerBarBorderColor}`,
        borderRadius: settings.headerBarRadiusPx,
        overflow: 'visible',
        marginBottom: settings.headerBarMarginBottomPx,
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
          right: settings.headerBox1OffsetXPx,
          top: settings.headerBox1OffsetYPx,
          fontSize: settings.headerBox1FontPx,
          fontWeight: settings.headerBox1FontWeight,
          color: settings.headerBox1Color,
          whiteSpace: 'nowrap',
          lineHeight: 1.2,
          direction: 'rtl',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {box1Text}
      </div>

      {/* תיבה 2: כותרת משנה */}
      <div
        style={{
          position: 'absolute',
          right: settings.headerBox2OffsetXPx,
          top: settings.headerBox2OffsetYPx,
          fontSize: settings.headerBox2FontPx,
          fontWeight: settings.headerBox2FontWeight,
          color: settings.headerBox2Color,
          whiteSpace: 'nowrap',
          lineHeight: 1.2,
          direction: 'rtl',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {box2Text}
      </div>

      {/* תיבה 3: חודש עברי */}
      <div
        style={{
          position: 'absolute',
          right: settings.headerBox3OffsetXPx,
          top: settings.headerBox3OffsetYPx,
          fontSize: settings.headerBox3FontPx,
          fontWeight: settings.headerBox3FontWeight,
          color: settings.headerBox3Color,
          whiteSpace: 'nowrap',
          lineHeight: 1.2,
          direction: 'rtl',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {box3Text}
      </div>

      {/* תיבה 4: חודש לועזי */}
      <div
        style={{
          position: 'absolute',
          right: settings.headerBox4OffsetXPx,
          top: settings.headerBox4OffsetYPx,
          fontSize: settings.headerBox4FontPx,
          fontWeight: settings.headerBox4FontWeight,
          color: settings.headerBox4Color,
          whiteSpace: 'nowrap',
          lineHeight: 1.2,
          direction: 'ltr',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {box4Text}
      </div>

      {/* כפתור "ערוך" הוסר מהממשק — העריכה מתבצעת מתפריט ההגדרות. */}
      {false && settings.headerBarShowEditButton ? (
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
  // Match printed-style calendars: tight spacing between cells.
  const gapPx = 4;
  const padPx = 4;
  return {
    className: [
      'relative grid grid-cols-7 overflow-hidden backdrop-blur-[1px] shadow-sm',
      isIntegrated ? 'p-0' : '',
    ].join(' '),
    style: {
      border: `${settings.gridBorderWidthPx}px solid ${settings.gridBorderColor}`,
      // In integrated mode we use `gap` between cells. Keep the gap area transparent so it does
      // not act like a “painted frame” (cell borders are controlled elsewhere by existing settings).
      background: isIntegrated ? 'transparent' : settings.gridShellBg,
      borderRadius: resolveDetachedGridBorderRadiusPx(settings),
      ...(isIntegrated
        ? {
            gap: gapPx,
            padding: padPx,
            boxSizing: 'border-box',
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
  headerFontFamily,
  gridWeekCount,
}: Props) {
  const layout: HeaderLayoutStyle = settings.headerLayoutStyle;
  const isIntegrated = layout === 'grid_integrated';
  const box1Text = (settings.headerBox1TextOverride ?? '').trim() || settings.titleMain;
  const box2Text = (settings.headerBox2TextOverride ?? '').trim() || settings.titleSub;
  const box3Text = (settings.headerBox3TextOverride ?? '').trim() || hebrewMonthTitle;
  const box4Text = (settings.headerBox4TextOverride ?? '').trim() || gregorianLabel;
  const weekRows = Math.max(5, Math.min(6, Number(gridWeekCount) || 6));
  const weekdayRowOffsetY = Number(settings.gridWeekdayHeaderRowOffsetYPx) || 0;
  const weekdayTrackH =
    settings.gridWeekdayHeaderHeightPx + Math.max(0, Math.round(weekdayRowOffsetY));
  const minWeekRowH = Math.max(72, Math.round((Number(settings.pdfExportCellHeightPx) || 92) * 0.82));
  const integratedGapPx = 4;
  const integratedPadPx = 4;
  const horizontalOverheadPx = isIntegrated ? integratedGapPx * 6 + integratedPadPx * 2 : 0;
  const squareWeekRowFromWidth = `calc((100% - ${horizontalOverheadPx}px) / 7)`;
  // In integrated mode, use the same header height/box offsets as the regular header bar
  // so the existing sliders apply 1:1.
  const integratedHeaderH = Math.max(44, Math.round(Number(settings.headerBarHeightPx) || 78));

  const shell = gridShellProps(layout, settings);
  const headerFontStyle = headerFontFamily ? ({ fontFamily: headerFontFamily } as const) : null;
  const grid = (
    <div
      {...shell}
      dir="ltr"
      data-inspect="month-grid"
      style={{
        ...(shell.style ?? {}),
        ...(settings.layoutFillHeight
          ? {
              height: '100%',
              flex: 1,
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
              gridTemplateRows: isIntegrated
                ? `${integratedHeaderH}px ${weekdayTrackH}px repeat(${weekRows}, minmax(${minWeekRowH}px, ${squareWeekRowFromWidth}))`
                : `${weekdayTrackH}px repeat(${weekRows}, minmax(${minWeekRowH}px, ${squareWeekRowFromWidth}))`,
              alignContent: 'start',
            }
          : null),
      }}
    >
      {isIntegrated ? (
        <div
          dir="ltr"
          data-inspect="integrated-header"
          style={{
            gridColumn: '1 / -1',
            borderRadius: Math.max(0, Math.round(Number(settings.headerBarRadiusPx) || 0)),
            background: settings.headerBarBg,
            border: `${Number(settings.headerBarBorderWidthPx) || 0}px solid ${settings.headerBarBorderColor}`,
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: 'stretch',
            padding: 0,
            boxSizing: 'border-box',
            overflow: 'visible',
            position: 'relative',
          }}
        >
          {/* תיבה 1: כותרת ראשית */}
          <div
            style={{
              position: 'absolute',
              right: settings.headerBox1OffsetXPx,
              top: settings.headerBox1OffsetYPx,
              fontSize: settings.headerBox1FontPx,
              fontWeight: settings.headerBox1FontWeight,
              color: settings.headerBox1Color,
              whiteSpace: 'nowrap',
              lineHeight: 1.2,
              direction: 'rtl',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {box1Text}
          </div>

          {/* תיבה 2: כותרת משנה */}
          <div
            style={{
              position: 'absolute',
              right: settings.headerBox2OffsetXPx,
              top: settings.headerBox2OffsetYPx,
              fontSize: settings.headerBox2FontPx,
              fontWeight: settings.headerBox2FontWeight,
              color: settings.headerBox2Color,
              whiteSpace: 'nowrap',
              lineHeight: 1.2,
              direction: 'rtl',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {box2Text}
          </div>

          {/* תיבה 3: חודש עברי */}
          <div
            style={{
              position: 'absolute',
              right: settings.headerBox3OffsetXPx,
              top: settings.headerBox3OffsetYPx,
              fontSize: settings.headerBox3FontPx,
              fontWeight: settings.headerBox3FontWeight,
              color: settings.headerBox3Color,
              whiteSpace: 'nowrap',
              lineHeight: 1.2,
              direction: 'rtl',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {box3Text}
          </div>

          {/* תיבה 4: חודש לועזי */}
          <div
            style={{
              position: 'absolute',
              right: settings.headerBox4OffsetXPx,
              top: settings.headerBox4OffsetYPx,
              fontSize: settings.headerBox4FontPx,
              fontWeight: settings.headerBox4FontWeight,
              color: settings.headerBox4Color,
              whiteSpace: 'nowrap',
              lineHeight: 1.2,
              direction: 'ltr',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {box4Text}
          </div>
        </div>
      ) : null}
      {gridChildren}
    </div>
  );

  return (
    <div
      className={[
        'relative w-full',
        settings.layoutFillHeight ? 'h-full flex flex-col' : '',
      ].join(' ')}
      style={headerFontStyle ?? undefined}
    >
      {isIntegrated ? null : (
        <HeaderBarNew
          settings={settings}
          hebrewMonthTitle={hebrewMonthTitle}
          gregorianLabel={gregorianLabel}
          onEditHeader={onEditHeader}
        />
      )}
      {grid}
    </div>
  );
}

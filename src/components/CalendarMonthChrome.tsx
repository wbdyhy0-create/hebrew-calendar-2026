import type { CSSProperties, ReactNode } from 'react';

import type { CalendarSettings, HeaderLayoutStyle } from '../utils/settings';
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
        overflow: 'hidden',
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
        {settings.titleMain}
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
        {settings.titleSub}
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
        {hebrewMonthTitle}
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
        {gregorianLabel}
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
  _layout: HeaderLayoutStyle,
  settings: CalendarSettings,
): { className: string; style: CSSProperties } {
  return {
    className: 'relative grid grid-cols-7 overflow-hidden backdrop-blur-[1px] shadow-sm',
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
  gridWeekCount,
}: Props) {
  const layout: HeaderLayoutStyle = settings.headerLayoutStyle;
  const weekRows = Math.max(5, Math.min(6, Number(gridWeekCount) || 6));
  const weekdayRowOffsetY = Number(settings.gridWeekdayHeaderRowOffsetYPx) || 0;
  const weekdayTrackH =
    settings.gridWeekdayHeaderHeightPx + Math.max(0, Math.round(weekdayRowOffsetY));
  const minWeekRowH = Math.max(72, Math.round((Number(settings.pdfExportCellHeightPx) || 92) * 0.82));

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

  return (
    <div
      className={[
        'relative w-full',
        settings.layoutFillHeight ? 'h-full flex flex-col' : '',
      ].join(' ')}
      style={headerFontStyle ?? undefined}
    >
      <HeaderBarNew
        settings={settings}
        hebrewMonthTitle={hebrewMonthTitle}
        gregorianLabel={gregorianLabel}
        onEditHeader={onEditHeader}
      />
      {grid}
    </div>
  );
}

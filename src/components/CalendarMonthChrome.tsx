import type { CSSProperties, ReactNode } from 'react';

import type { CalendarSettings, HeaderLayoutStyle } from '../utils/settings';
import { resolveDetachedGridBorderRadiusPx } from '../utils/calendarDocumentStyles';

type Props = {
  settings: CalendarSettings;
  gridChildren: ReactNode;
  /** number of week rows in month grid (5 or 6) */
  gridWeekCount?: number;
};

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

export function CalendarMonthChrome({ settings, gridChildren, gridWeekCount }: Props) {
  const layout: HeaderLayoutStyle = settings.headerLayoutStyle;
  const weekRows = Math.max(5, Math.min(6, Number(gridWeekCount) || 6));
  const weekdayRowOffsetY = Number(settings.gridWeekdayHeaderRowOffsetYPx) || 0;
  const weekdayTrackH =
    settings.gridWeekdayHeaderHeightPx + Math.max(0, Math.round(weekdayRowOffsetY));
  const minWeekRowH = Math.max(72, Math.round((Number(settings.pdfExportCellHeightPx) || 92) * 0.82));

  const shell = gridShellProps(layout, settings);
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

  return settings.layoutFillHeight ? (
    <div className="flex h-full w-full min-w-0 flex-col overflow-visible">{grid}</div>
  ) : (
    <div className="relative w-full">{grid}</div>
  );
}

import { isSameMonth } from 'date-fns'
import type { CSSProperties } from 'react'

import type { CalendarSettings } from '../settings'
import { getMonthGridWeeks } from '../calendarGrid'
import { formatTodayYmdJerusalem, formatYmdJerusalem, getHebrewDayGematriya } from '../hebrewDate'

type Props = {
  viewDate: Date
  settings: CalendarSettings
}

const DOW_HE_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'שבת'] as const

export function MonthView({ viewDate, settings }: Props) {
  const weeks = getMonthGridWeeks(viewDate)
  const todayKey = formatTodayYmdJerusalem()

  const shellStyle: CSSProperties = {
    border: `${settings.gridBorderWidthPx}px solid ${settings.gridBorderColor}`,
    borderRadius: 16,
    overflow: 'hidden',
    background: settings.gridShellBg,
  }

  const headerCellStyle: CSSProperties = {
    height: settings.gridWeekdayHeaderHeightPx,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: settings.gridWeekdayHeaderBg,
    color: settings.gridWeekdayHeaderTextColor,
    // Studio does not multiply header/cell fonts by `fontSizePx` (it is a general UI font size).
    fontSize: settings.gridWeekdayHeaderFontPx,
    fontWeight: settings.gridWeekdayHeaderFontWeight as number,
    borderBottom: `${settings.gridBorderWidthPx}px solid ${settings.gridBorderColor}`,
    boxSizing: 'border-box',
    userSelect: 'none',
  }

  const cellBaseStyle: CSSProperties = {
    minHeight: 110,
    position: 'relative',
    padding: 8,
    boxSizing: 'border-box',
    fontFamily: settings.fontFamily,
  }

  const cellBorder = settings.showCellBorders
    ? `${settings.cellBorderWidthPx}px solid ${settings.cellBorderColor}`
    : 'none'

  return (
    <div dir="ltr" style={shellStyle}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
        }}
      >
        {DOW_HE_SHORT.map((t) => (
          <div key={t} style={headerCellStyle}>
            <div dir="rtl">{t}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
        }}
      >
        {weeks.flat().map((g) => {
          const inMonth = isSameMonth(g, viewDate)
          const key = formatYmdJerusalem(g)
          const isToday = key === todayKey
          const isShabbat = g.getDay() === 6

          const hebDay = getHebrewDayGematriya(g)

          const bg = !inMonth
            ? `rgba(148,163,184,${Math.max(0, Math.min(1, settings.paddingCellStrength))})`
            : isToday
              ? settings.todayBg
              : isShabbat
                ? settings.shabbatBg
                : 'transparent'

          return (
            <div
              key={key}
              style={{
                ...cellBaseStyle,
                background: bg,
                borderLeft: cellBorder,
                borderTop: cellBorder,
              }}
            >
              {inMonth ? (
                <>
                  <div
                    dir="rtl"
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 6,
                      fontWeight: settings.fontWeight,
                    }}
                  >
                    <div style={{ fontSize: settings.gregDayFontPx }}>
                      {g.getDate()}
                    </div>
                    <div
                      style={{
                        fontSize: settings.hebDayFontPx,
                        opacity: 0.95,
                      }}
                    >
                      {hebDay}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}


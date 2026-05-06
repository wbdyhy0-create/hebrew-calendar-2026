import { isSameMonth } from 'date-fns'
import type { CSSProperties } from 'react'

import type { CalendarSettings } from '../settings'
import type { DayEvents } from '../hebcalEvents'
import { getMonthGridWeeks } from '../calendarGrid'
import { formatTodayYmdJerusalem, formatYmdJerusalem, getHebrewDayGematriya } from '../hebrewDate'
import { mixHexWithWhite } from '../color'
import type { OverridesMap } from '../overrides'
import { resolveDayTextOverride } from '../overrides'

type Props = {
  viewDate: Date
  settings: CalendarSettings & {
    weekdayHeaderMode?: 'shortLetter' | 'fullName'
    showParsha?: boolean
    zmanimCity?: 'Jerusalem' | 'TelAviv'
  }
  dayEventsJer: Map<string, DayEvents>
  dayEventsTA: Map<string, DayEvents>
  overrides?: OverridesMap
}

function weekdayLabels(mode: string | undefined) {
  if (mode === 'fullName') return ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
  return ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'שבת']
}

export function MonthViewRich({ viewDate, settings, dayEventsJer, dayEventsTA, overrides }: Props) {
  const weeks = getMonthGridWeeks(viewDate)
  const todayKey = formatTodayYmdJerusalem()
  const dow = weekdayLabels(settings.weekdayHeaderMode)

  // Important: Studio style configs are meant to render as-authored.
  // Do not clamp baseline px values here; if a style uses small numbers it likely relies on
  // overall layout scaling/zoom upstream.
  const gregPx = Math.max(1, Math.round(Number(settings.gregDayFontPx) || 12))
  const hebPx = Math.max(1, Math.round(Number(settings.hebDayFontPx) || 15))
  const eventPx = Math.max(1, Math.round(Number(settings.eventTitleFontPx) || 10))
  const timesPx = Math.max(1, Math.round(Number(settings.shabbatTimesFontPx) || 10))

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
    fontSize: settings.gridWeekdayHeaderFontPx,
    fontWeight: settings.gridWeekdayHeaderFontWeight as number,
    borderBottom: `${settings.gridBorderWidthPx}px solid ${settings.gridBorderColor}`,
    boxSizing: 'border-box',
    userSelect: 'none',
  }

  const cellBorder = settings.showCellBorders
    ? `${settings.cellBorderWidthPx}px solid ${settings.cellBorderColor}`
    : 'none'

  const paddingBg = mixHexWithWhite(
    (settings as any).paddingCellColor ?? '#94a3b8',
    Number.isFinite(Number(settings.paddingCellStrength)) ? Number(settings.paddingCellStrength) : 0.22,
  )

  const useTA = (settings as any).zmanimCity === 'TelAviv'
  const byDay = useTA ? dayEventsTA : dayEventsJer

  return (
    <div dir="ltr" style={shellStyle}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
        {dow.map((t) => (
          <div key={t} style={headerCellStyle}>
            <div dir="rtl">{t}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
        {weeks.flat().map((g) => {
          const inMonth = isSameMonth(g, viewDate)
          const key = formatYmdJerusalem(g)
          const isToday = key === todayKey
          const isShabbat = g.getDay() === 6

          const hebDay = getHebrewDayGematriya(g)
          const ev = byDay.get(key)
          const ovr = resolveDayTextOverride(overrides, key)

          const isEventDay = (ev?.titles?.length ?? 0) > 0
          const bg = !inMonth
            ? paddingBg
            : isToday
              ? settings.todayBg
              : isShabbat
                ? settings.shabbatBg
                : isEventDay
                  ? (settings as any).eventBg ?? 'transparent'
                : 'transparent'

          const titles = (ovr?.centerLines?.length ? ovr.centerLines : ev?.titles ?? []).slice(0, 4)
          const parsha = settings.showParsha ? ev?.parshaHe : undefined

          return (
            <div
              key={key}
              style={{
                minHeight: 110,
                position: 'relative',
                padding: 8,
                boxSizing: 'border-box',
                fontFamily: settings.fontFamily,
                background: bg,
                borderLeft: cellBorder,
                borderTop: cellBorder,
                overflow: 'hidden',
              }}
            >
              {inMonth ? (
                <>
                  {ovr?.imageDataUrl ? (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: `url(${ovr.imageDataUrl})`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: `${50 + (Number(ovr.imageOffsetX) || 0)}% ${50 + (Number(ovr.imageOffsetY) || 0)}%`,
                        backgroundSize: ovr.imageFit === 'contain' ? 'contain' : 'cover',
                        opacity: typeof ovr.imageOpacity === 'number' ? ovr.imageOpacity : 1,
                        pointerEvents: 'none',
                      }}
                    />
                  ) : null}
                  <div dir="rtl" style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <div style={{ fontSize: gregPx, fontWeight: 700 }}>
                      {g.getDate()}
                    </div>
                    <div style={{ fontSize: hebPx, opacity: 0.95, fontWeight: 600 }}>
                      {hebDay}
                    </div>
                  </div>

                  <div
                    dir="rtl"
                    style={{
                      marginTop: 6,
                      fontSize: eventPx,
                      lineHeight: 1.15,
                      textAlign: (ovr?.centerAlign ?? 'center') as any,
                      opacity: 0.98,
                      minHeight: 44,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      gap: 2,
                      paddingInline: 2,
                      transform: `translate(${Number(ovr?.centerOffsetX) || 0}px, ${Number(ovr?.centerOffsetY) || 0}px)`,
                    }}
                  >
                    {titles.map((t) => (
                      <div key={t} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {t}
                      </div>
                    ))}
                    {parsha ? (
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {parsha}
                      </div>
                    ) : null}
                  </div>

                  {(ev?.candleLighting || ev?.havdalah || ev?.fastBegins || ev?.fastEnds) && (
                    <div
                      dir="rtl"
                      style={{
                        position: 'absolute',
                        left: 8,
                        right: 8,
                        bottom: 8,
                        fontSize: timesPx,
                        lineHeight: 1.15,
                        opacity: 0.95,
                      }}
                    >
                      {ev?.candleLighting ? <div>כניסת שבת {ev.candleLighting}</div> : null}
                      {ev?.havdalah ? <div>צאת שבת {ev.havdalah}</div> : null}
                      {ev?.fastBegins ? <div>תחילת צום {ev.fastBegins}</div> : null}
                      {ev?.fastEnds ? <div>צאת צום {ev.fastEnds}</div> : null}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}


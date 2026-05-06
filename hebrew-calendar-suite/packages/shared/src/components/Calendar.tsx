import type { CSSProperties, ReactNode } from 'react'

/** Same outer frame as Display (`apps/display`) and bank stations. */
export const DISPLAY_CALENDAR_SCREEN_MIN_WIDTH_VW = 90
export const DISPLAY_CALENDAR_SCREEN_MAX_WIDTH_PX = 1400

type Props = {
  children: ReactNode
  /**
   * Screen layout:
   * - use at least `screenMinWidthVw` of viewport width
   * - cap at `screenMaxWidthPx`
   */
  screenMinWidthVw?: number
  screenMaxWidthPx?: number
  /**
   * Print layout:
   * Use A4-like aspect ratio only when printing.
   * Default: 'landscape' (fits wide month grids better).
   */
  printOrientation?: 'portrait' | 'landscape'
  /** Prevent overflow bleed (default: false on screen; true in print rules). */
  overflowHidden?: boolean
  style?: CSSProperties
}

/**
 * Shared container for Display/Admin so the calendar does not stretch full-width.
 * Keeps an A4-portrait-like ratio and centers within the page.
 */
export function CalendarContainer({
  children,
  screenMinWidthVw = DISPLAY_CALENDAR_SCREEN_MIN_WIDTH_VW,
  screenMaxWidthPx = DISPLAY_CALENDAR_SCREEN_MAX_WIDTH_PX,
  printOrientation = 'landscape',
  overflowHidden = false,
  style,
}: Props) {
  const printAspect =
    printOrientation === 'portrait' ? '1 / 1.41421356' : '1.41421356 / 1'
  const printMaxWidthPx = printOrientation === 'portrait' ? 794 : 1123
  return (
    <>
      <style>{`
        @media print {
          .hc-calendar-container {
            width: 100% !important;
            max-width: ${printMaxWidthPx}px !important;
            margin: 0 auto !important;
            aspect-ratio: ${printAspect} !important;
            overflow: hidden !important;
          }
        }
      `}</style>
      <div
        className="hc-calendar-container"
        style={{
          width: `${Math.max(10, Math.min(100, screenMinWidthVw))}vw`,
          maxWidth: screenMaxWidthPx,
          margin: '0 auto',
          // On-screen: do NOT force an aspect ratio. Let content define height.
          height: 'auto',
          overflow: overflowHidden ? 'hidden' : 'visible',
          ...style,
        }}
      >
        {children}
      </div>
    </>
  )
}


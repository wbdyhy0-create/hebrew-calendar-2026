import type { CSSProperties } from 'react'

import type { CalendarSettings } from '../utils/settings'

export function BrandHeader({
  settings,
}: {
  settings: CalendarSettings
}) {
  const name = String((settings as any).brandName ?? '').trim()
  const logo = String((settings as any).brandLogoDataUrl ?? '').trim()
  const accent = String((settings as any).brandAccentColor ?? '').trim() || '#E31B23'
  const maxW = Number((settings as any).headerBarMaxWidthPx ?? 0) || 0
  // Prevent accidentally collapsing the top brand bar to an unusably narrow width
  // (some saved presets may contain very small values).
  const safeMaxW = maxW >= 640 ? maxW : 0

  if (!name && !logo) return null

  const barStyle: CSSProperties = {
    width: '100%',
    maxWidth: safeMaxW > 0 ? safeMaxW : undefined,
    marginInline: 'auto',
    borderRadius: 14,
    border: '1px solid rgba(148,163,184,0.35)',
    background: 'rgba(255,255,255,0.86)',
    boxShadow: '0 10px 24px rgba(2,6,23,0.06)',
    overflow: 'hidden',
    boxSizing: 'border-box',
  }

  return (
    <div dir="rtl" style={barStyle}>
      <div style={{ height: 4, background: accent }} />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '10px 16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {logo ? (
            <img
              src={logo}
              alt={name ? `לוגו ${name}` : 'לוגו'}
              style={{
                height: 28,
                width: 'auto',
                maxWidth: 140,
                objectFit: 'contain',
                borderRadius: 6,
              }}
            />
          ) : null}
          {name ? (
            <div
              style={{
                fontWeight: 900,
                color: '#0f172a',
                whiteSpace: 'normal',
                overflow: 'visible',
                textOverflow: 'clip',
                lineHeight: 1.15,
              }}
              title={name}
            >
              {name}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            aria-hidden="true"
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: accent,
              boxShadow: '0 0 0 3px rgba(226,232,240,0.7)',
            }}
          />
        </div>
      </div>
    </div>
  )
}


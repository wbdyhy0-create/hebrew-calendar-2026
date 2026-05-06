import type { CalendarSettings } from '@hebrew-calendar/shared'

export type StylePreset = {
  id: string
  name: string
  settings: CalendarSettings
  overrides: any
}

import { PRESET_CATALOG } from './presetsCatalog'

function baseKey(): string {
  try {
    if (typeof window === 'undefined') return 'hebrew-calendar:style-presets:v1:server'
    const p = new URLSearchParams(window.location.search)
    const tenant = String(p.get('tenant') ?? '').trim().toLowerCase()
    const scope = `${window.location.origin}${window.location.pathname}`
    return `hebrew-calendar:style-presets:v1:${scope}${tenant ? `?tenant=${tenant}` : ''}`
  } catch {
    return 'hebrew-calendar:style-presets:v1:unknown'
  }
}

export function loadPresets(): { presets: StylePreset[]; selectedId: string | null } {
  const key = baseKey()
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return { presets: [], selectedId: null }
    const parsed = JSON.parse(raw) as any
    if (!parsed || typeof parsed !== 'object') return { presets: [], selectedId: null }
    const presets = Array.isArray(parsed.presets) ? (parsed.presets as any[]) : []
    const selectedId = typeof parsed.selectedId === 'string' ? parsed.selectedId : null
    const normalized: StylePreset[] = presets
      .map((p) => {
        if (!p || typeof p !== 'object') return null
        const id = typeof p.id === 'string' ? p.id : ''
        const name = typeof p.name === 'string' ? p.name : ''
        const settings = p.settings as CalendarSettings
        const overrides = p.overrides ?? {}
        if (!id || !name || !settings) return null
        return { id, name, settings, overrides } as StylePreset
      })
      .filter(Boolean)
      .slice(0, 30) as StylePreset[]
    return { presets: normalized, selectedId }
  } catch {
    return { presets: [], selectedId: null }
  }
}

export function savePresets(presets: StylePreset[], selectedId: string | null) {
  const key = baseKey()
  try {
    localStorage.setItem(key, JSON.stringify({ presets, selectedId }))
  } catch {
    // ignore
  }
}

export function ensureDefaultPreset(
  currentSettings: CalendarSettings,
  currentOverrides: any,
): { presets: StylePreset[]; selectedId: string } {
  const { presets, selectedId } = loadPresets()
  if (presets.length) {
    return { presets, selectedId: selectedId || presets[0]!.id }
  }
  const fallback: StylePreset = {
    id: 'default',
    name: 'ברירת מחדל',
    settings: currentSettings,
    overrides: currentOverrides ?? {},
  }
  const catalog = Array.isArray(PRESET_CATALOG) ? PRESET_CATALOG : []
  const seeded = catalog.length ? catalog : [fallback]
  const next = seeded.map((p) =>
    p.id === 'default' && (!p.settings || Object.keys(p.settings as any).length === 0)
      ? { ...p, settings: currentSettings, overrides: currentOverrides ?? {} }
      : p,
  )
  const id = next[0]!.id
  savePresets(next, id)
  return { presets: next, selectedId: id }
}


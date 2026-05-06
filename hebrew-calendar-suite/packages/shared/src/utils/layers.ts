export type LayerId = string

export function normalizeLayerId(v: unknown): LayerId | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s ? s : null
}

export function sanitizeActiveLayers(v: unknown): LayerId[] {
  if (!Array.isArray(v)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of v) {
    const id = normalizeLayerId(item)
    if (!id) continue
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export function isLayerActive(activeLayers: unknown, layer: unknown): boolean {
  const id = normalizeLayerId(layer)
  if (!id) return false
  const layers = sanitizeActiveLayers(activeLayers)
  return layers.includes(id)
}


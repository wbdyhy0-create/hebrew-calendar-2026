import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sanitizeTenantId, tenantKvKey } from './tenant.js'

type PublishPayload = {
  settings: unknown
  overrides: unknown
  viewDate?: unknown
  themeCatalog?: unknown
  tenantId?: unknown
}

const KV_KEY = 'current_config'
const KV_CATALOG_KEY = 'theme_catalog'

function overridesStats(overrides: Record<string, unknown>) {
  let keys = 0
  let withImages = 0
  let maxImageLen = 0
  for (const v of Object.values(overrides)) {
    keys++
    const url = typeof (v as any)?.imageDataUrl === 'string' ? String((v as any).imageDataUrl) : ''
    if (url) {
      withImages++
      maxImageLen = Math.max(maxImageLen, url.length)
    }
  }
  return { keys, withImages, maxImageLen }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function sanitizeThemeCatalog(raw: unknown): unknown[] | null {
  if (!Array.isArray(raw)) return null
  const out: any[] = []
  for (const it of raw) {
    if (!it || typeof it !== 'object' || Array.isArray(it)) continue
    const id = typeof (it as any).id === 'string' ? String((it as any).id).trim() : ''
    const kind = typeof (it as any).kind === 'string' ? String((it as any).kind).trim() : ''
    const nameHe = typeof (it as any).nameHe === 'string' ? String((it as any).nameHe).trim() : ''
    const patch = (it as any).patch
    if (!id || (kind !== 'color' && kind !== 'style') || !nameHe) continue
    if (!isPlainObject(patch)) continue
    out.push({ id, kind, nameHe, patch })
  }
  return out
}

function setCors(req: VercelRequest, res: VercelResponse) {
  const origin = String(req.headers.origin ?? '')
  const allow =
    origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')
      ? origin
      : ''

  // For browser-based publishing from local Studio to Vercel Display.
  if (allow) res.setHeader('Access-Control-Allow-Origin', allow)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'content-type, x-publish-secret',
  )
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    setCors(req, res)

    if (req.method === 'OPTIONS') {
      res.status(204).end()
      return
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' })
      return
    }

    const secret = process.env.PUBLISH_SECRET
    if (secret && req.headers['x-publish-secret'] !== secret) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const body = req.body as PublishPayload | undefined
    const settings = body?.settings
    const overrides = body?.overrides
    const viewDate = body?.viewDate
    const themeCatalog = body?.themeCatalog
    const tenantId = sanitizeTenantId((body as any)?.tenantId ?? (req.query as any)?.tenant)

    if (!isPlainObject(settings) || !isPlainObject(overrides)) {
      res.status(400).json({ error: 'Invalid payload. Expected { settings: object, overrides: object }' })
      return
    }

    if (viewDate !== undefined && typeof viewDate !== 'string') {
      res.status(400).json({ error: 'Invalid payload. Expected viewDate: ISO string (optional)' })
      return
    }

    const payload = {
      settings,
      overrides,
      ...(typeof viewDate === 'string' ? { viewDate } : null),
      overridesStats: overridesStats(overrides),
      publishedAt: new Date().toISOString(),
    }

    const { kv } = await import('@vercel/kv')

    const cat = sanitizeThemeCatalog(themeCatalog)
    if (cat && cat.length) {
      await kv.set(
        tenantKvKey(tenantId, KV_CATALOG_KEY),
        JSON.stringify({ items: cat, publishedAt: payload.publishedAt }),
      )
    }
    await kv.set(tenantKvKey(tenantId, KV_KEY), JSON.stringify(payload))
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({
      ok: true,
      storage: 'kv',
      key: tenantKvKey(tenantId, KV_KEY),
      overridesStats: payload.overridesStats,
      themeCatalogSaved: cat ? cat.length : 0,
      themeCatalogKey: tenantKvKey(tenantId, KV_CATALOG_KEY),
      tenantId,
    })
  } catch (e: any) {
    try {
      setCors(req, res)
    } catch {
      // ignore
    }
    res.status(500).json({
      error: 'publish-config failed',
      detail: String(e?.message ?? e),
      name: typeof e?.name === 'string' ? e.name : undefined,
      stack: typeof e?.stack === 'string' ? e.stack : undefined,
    })
  }
}


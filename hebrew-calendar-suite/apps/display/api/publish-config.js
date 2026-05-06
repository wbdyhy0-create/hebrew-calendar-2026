import { sanitizeTenantId } from './_tenant.js'
import { readJsonObjectBody } from './_readJsonBody.js'

const KV_KEY = 'current_config'
const KV_CATALOG_KEY = 'theme_catalog'

function tenantKvKey(tenantId, key) {
  const t = sanitizeTenantId(tenantId)
  return `${t}:${key}`
}

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function sanitizeThemeCatalog(raw) {
  if (!Array.isArray(raw)) return null
  const out = []
  for (const it of raw) {
    if (!it || typeof it !== 'object' || Array.isArray(it)) continue
    const id = typeof it.id === 'string' ? String(it.id).trim() : ''
    const kind = typeof it.kind === 'string' ? String(it.kind).trim() : ''
    const nameHe = typeof it.nameHe === 'string' ? String(it.nameHe).trim() : ''
    const patch = it.patch
    if (!id || (kind !== 'color' && kind !== 'style') || !nameHe) continue
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) continue
    out.push({ id, kind, nameHe, patch })
  }
  return out
}

function overridesStats(overrides) {
  try {
    const values = overrides && typeof overrides === 'object' ? Object.values(overrides) : []
    let keys = 0
    let withImages = 0
    let maxImageLen = 0
    for (const v of values) {
      keys++
      const url = v && typeof v.imageDataUrl === 'string' ? String(v.imageDataUrl) : ''
      if (url) {
        withImages++
        maxImageLen = Math.max(maxImageLen, url.length)
      }
    }
    return { keys, withImages, maxImageLen }
  } catch {
    return { keys: 0, withImages: 0, maxImageLen: 0 }
  }
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-publish-secret')
  res.setHeader('Access-Control-Max-Age', '600')
}

export default async function handler(req, res) {
  try {
    setCors(res)

    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }

    if (req.method !== 'POST') {
      res.statusCode = 405
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ error: 'Method Not Allowed' }))
      return
    }

    const secret = process.env.PUBLISH_SECRET
    if (secret && req.headers['x-publish-secret'] !== secret) {
      res.statusCode = 401
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ error: 'Unauthorized' }))
      return
    }

    const body = await readJsonObjectBody(req)
    const tenantId = sanitizeTenantId(body.tenantId || (req.query && req.query.tenant))
    const settings = body.settings
    const overrides = body.overrides
    const viewDate = body.viewDate
    const themeCatalog = body.themeCatalog
    const clearThemeCatalog = body.clearThemeCatalog
    const fonts = body.fonts

    if (!isPlainObject(settings) || !isPlainObject(overrides)) {
      res.statusCode = 400
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ error: 'Invalid payload. Expected { settings: object, overrides: object }' }))
      return
    }

    if (viewDate !== undefined && typeof viewDate !== 'string') {
      res.statusCode = 400
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ error: 'Invalid payload. Expected viewDate: ISO string (optional)' }))
      return
    }

    const publishedAt = new Date().toISOString()
    const payload = {
      settings,
      overrides,
      ...(typeof viewDate === 'string' ? { viewDate } : null),
      ...(Array.isArray(fonts) ? { fonts } : null),
      overridesStats: overridesStats(overrides),
      publishedAt,
    }

    const { kv } = await import('@vercel/kv')

    const cat = sanitizeThemeCatalog(themeCatalog)
    const themeCatalogUserItems =
      cat && cat.length ? cat.filter((it) => typeof it.id === 'string' && it.id.startsWith('user:')).length : 0
    const shouldClearCatalog = clearThemeCatalog === true || (Array.isArray(themeCatalog) && themeCatalog.length === 0)
    if (shouldClearCatalog) {
      await kv.del(tenantKvKey(tenantId, KV_CATALOG_KEY))
    } else if (cat && cat.length) {
      await kv.set(tenantKvKey(tenantId, KV_CATALOG_KEY), JSON.stringify({ items: cat, publishedAt }))
    }

    await kv.set(tenantKvKey(tenantId, KV_KEY), JSON.stringify(payload))

    res.statusCode = 200
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('content-type', 'application/json')
    res.end(
      JSON.stringify({
        ok: true,
        storage: 'kv',
        tenantId,
        key: tenantKvKey(tenantId, KV_KEY),
        themeCatalogKey: tenantKvKey(tenantId, KV_CATALOG_KEY),
        themeCatalogSaved: cat ? cat.length : 0,
        themeCatalogUserItems,
        overridesStats: payload.overridesStats,
      }),
    )
  } catch (e) {
    try {
      setCors(res)
    } catch {
      // ignore
    }
    res.statusCode = 500
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ error: 'publish-config failed', detail: String((e && e.message) || e) }))
  }
}

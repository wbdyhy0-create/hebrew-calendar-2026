import { sanitizeTenantId } from './_tenant.js'

const KV_CATALOG_KEY = 'theme_catalog'

function tenantKvKey(tenantId, key) {
  const t = sanitizeTenantId(tenantId)
  return `${t}:${key}`
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
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

    if (req.method !== 'GET') {
      res.statusCode = 405
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ error: 'Method Not Allowed' }))
      return
    }

    const tenantId = sanitizeTenantId(req.query && req.query.tenant)
    let kv = null
    try {
      kv = (await import('@vercel/kv')).kv
    } catch (e) {
      res.statusCode = 200
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('content-type', 'application/json')
      res.end(
        JSON.stringify({
          items: [],
          tenantId,
          source: 'kv-missing',
          hasKvEnv: false,
          detail: String((e && e.message) || e),
        }),
      )
      return
    }

    const key = tenantKvKey(tenantId, KV_CATALOG_KEY)
    let raw = null
    try {
      raw = await kv.get(key)
    } catch (e) {
      res.statusCode = 200
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('content-type', 'application/json')
      res.end(
        JSON.stringify({
          items: [],
          tenantId,
          source: 'kv-error',
          hasKvEnv: true,
          detail: String((e && e.message) || e),
        }),
      )
      return
    }

    let parsed = null
    try {
      if (typeof raw === 'string') parsed = raw.trim() ? JSON.parse(raw) : null
      else if (raw && typeof raw === 'object') parsed = raw
      else parsed = null
    } catch {
      parsed = null
    }

    const items = parsed && Array.isArray(parsed.items) ? parsed.items : []
    res.statusCode = 200
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('content-type', 'application/json')
    res.end(
      JSON.stringify({
        items,
        publishedAt: parsed && typeof parsed.publishedAt === 'string' ? parsed.publishedAt : undefined,
        tenantId,
        source: raw ? 'kv' : 'none',
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
    res.end(JSON.stringify({ error: 'get-theme-catalog failed', detail: String((e && e.message) || e) }))
  }
}

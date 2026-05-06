import { sanitizeTenantId } from './_tenant.js'

const KV_KEY = 'current_config'
/** Legacy single-tenant blob (pre-namespaced keys). Only used as fallback for `default`. */
const LEGACY_GLOBAL_KEY = 'current_config'

function tenantKvKey(tenantId, key) {
  const t = sanitizeTenantId(tenantId)
  return `${t}:${key}`
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'content-type')
  res.setHeader('Access-Control-Max-Age', '600')
}

function respondJson(res, obj, tenantId) {
  res.statusCode = 200
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify({ ...obj, tenantId }))
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

    res.setHeader('Cache-Control', 'no-store')

    const tenantId = sanitizeTenantId(req.query && req.query.tenant)

    let kv = null
    try {
      kv = (await import('@vercel/kv')).kv
    } catch {
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ settings: {}, overrides: {}, source: 'kv-import-failed', tenantId }))
      return
    }

    const trySend = (raw) => {
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        respondJson(res, raw, tenantId)
        return true
      }
      if (typeof raw === 'string' && raw.trim()) {
        try {
          respondJson(res, JSON.parse(raw), tenantId)
          return true
        } catch {
          res.statusCode = 200
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ settings: {}, overrides: {}, source: 'kv-string', tenantId }))
          return true
        }
      }
      return false
    }

    try {
      const scoped = await kv.get(tenantKvKey(tenantId, KV_KEY))
      if (trySend(scoped)) return

      if (tenantId === 'default') {
        const legacy = await kv.get(LEGACY_GLOBAL_KEY)
        if (trySend(legacy)) return
      }
    } catch {
      // fall through
    }

    res.statusCode = 200
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ settings: {}, overrides: {}, source: 'default', tenantId }))
  } catch (e) {
    try {
      setCors(res)
    } catch {
      // ignore
    }
    res.statusCode = 500
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ error: 'get-runtime-config failed', detail: String((e && e.message) || e) }))
  }
}

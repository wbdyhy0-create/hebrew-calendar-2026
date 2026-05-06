import { sanitizeTenantId } from './_tenant.js'
import { readJsonObjectBody } from './_readJsonBody.js'

const KV_CATALOG_KEY = 'theme_catalog'

function tenantKvKey(tenantId, key) {
  const t = sanitizeTenantId(tenantId)
  return `${t}:${key}`
}

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v)
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

    const body = await readJsonObjectBody(req)
    const tenantId = sanitizeTenantId(body.tenantId || (req.query && req.query.tenant))
    const namesToRemove = Array.isArray(body.namesToRemove) ? body.namesToRemove : []
    const idsToRemove = Array.isArray(body.idsToRemove) ? body.idsToRemove : []

    const nameSet = new Set(namesToRemove.filter((x) => typeof x === 'string').map((s) => String(s).trim()).filter(Boolean))
    const idSet = new Set(idsToRemove.filter((x) => typeof x === 'string').map((s) => String(s).trim()).filter(Boolean))

    const secret = process.env.PUBLISH_SECRET
    const hasValidSecret = !secret || req.headers['x-publish-secret'] === secret
    if (!hasValidSecret) {
      const unsafeIds = Array.from(idSet).filter((id) => !String(id).startsWith('user:'))
      const wouldDeleteByName = Array.from(nameSet).length > 0
      if (unsafeIds.length > 0 || wouldDeleteByName) {
        res.statusCode = 401
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ error: 'Unauthorized' }))
        return
      }
    }

    const { kv } = await import('@vercel/kv')
    const key = tenantKvKey(tenantId, KV_CATALOG_KEY)
    const raw = await kv.get(key)

    let parsed = null
    try {
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) parsed = raw
      else if (typeof raw === 'string' && raw.trim()) parsed = JSON.parse(raw)
      else parsed = null
    } catch {
      parsed = null
    }

    const items = parsed && Array.isArray(parsed.items) ? parsed.items : []
    const before = items.length
    const nextItems = items.filter((it) => {
      const id = it && typeof it.id === 'string' ? String(it.id) : ''
      const nameHe = it && typeof it.nameHe === 'string' ? String(it.nameHe).trim() : ''
      if (id && idSet.has(id)) return false
      if (nameHe && nameSet.has(nameHe)) return false
      return true
    })
    const removed = before - nextItems.length

    if (!raw || !isPlainObject(parsed)) {
      res.statusCode = 200
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ ok: true, tenantId, removed: 0, note: 'no catalog to prune' }))
      return
    }

    await kv.set(key, JSON.stringify({ ...parsed, items: nextItems, prunedAt: new Date().toISOString() }))
    res.statusCode = 200
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ ok: true, tenantId, removed, remaining: nextItems.length, key }))
  } catch (e) {
    try {
      setCors(res)
    } catch {
      // ignore
    }
    res.statusCode = 500
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ error: 'prune-theme-catalog failed', detail: String((e && e.message) || e) }))
  }
}

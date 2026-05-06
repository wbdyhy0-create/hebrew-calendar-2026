import type { VercelRequest, VercelResponse } from '@vercel/node'

import { sanitizeTenantId, tenantKvKey } from './tenant'

const KV_CATALOG_KEY = 'theme_catalog'

function setCors(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-publish-secret')
  res.setHeader('Access-Control-Max-Age', '600')
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
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

    const body = (req.body ?? {}) as any
    const tenantId = sanitizeTenantId(body?.tenantId ?? req.query?.tenant)
    const namesToRemove = Array.isArray(body?.namesToRemove) ? (body.namesToRemove as unknown[]) : []
    const idsToRemove = Array.isArray(body?.idsToRemove) ? (body.idsToRemove as unknown[]) : []
    const nameSet = new Set(
      namesToRemove
        .filter((x) => typeof x === 'string')
        .map((s) => String(s).trim())
        .filter(Boolean),
    )
    const idSet = new Set(
      idsToRemove
        .filter((x) => typeof x === 'string')
        .map((s) => String(s).trim())
        .filter(Boolean),
    )

    const secret = process.env.PUBLISH_SECRET
    const hasValidSecret = !secret || req.headers['x-publish-secret'] === secret
    // Without the publish secret, only allow deleting explicitly listed `user:` items.
    if (!hasValidSecret) {
      const unsafeIds = Array.from(idSet).filter((id) => !String(id).startsWith('user:'))
      const wouldDeleteAllUsers = nameSet.size > 0
      if (unsafeIds.length > 0 || wouldDeleteAllUsers) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }
    }

    const { kv } = await import('@vercel/kv')
    const key = tenantKvKey(tenantId, KV_CATALOG_KEY)
    const raw = await kv.get<string>(key)

    let parsed: any = null
    try {
      parsed = raw ? JSON.parse(raw) : null
    } catch {
      parsed = null
    }

    const items = Array.isArray(parsed?.items) ? parsed.items : []
    const before = items.length
    const nextItems = items.filter((it: any) => {
      const id = typeof it?.id === 'string' ? String(it.id) : ''
      const nameHe = typeof it?.nameHe === 'string' ? String(it.nameHe).trim() : ''
      if (id && idSet.has(id)) return false
      if (id.startsWith('user:')) return false
      if (nameHe && nameSet.has(nameHe)) return false
      return true
    })
    const removed = before - nextItems.length

    if (!raw || !isPlainObject(parsed)) {
      res.setHeader('Cache-Control', 'no-store')
      res.status(200).json({ ok: true, tenantId, removed: 0, note: 'no catalog to prune' })
      return
    }

    await kv.set(key, JSON.stringify({ ...parsed, items: nextItems, prunedAt: new Date().toISOString() }))
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({ ok: true, tenantId, removed, remaining: nextItems.length, key })
  } catch (e: any) {
    try {
      setCors(req, res)
    } catch {
      // ignore
    }
    res.status(500).json({
      error: 'prune-theme-catalog failed',
      detail: String(e?.message ?? e),
      name: typeof e?.name === 'string' ? e.name : undefined,
    })
  }
}


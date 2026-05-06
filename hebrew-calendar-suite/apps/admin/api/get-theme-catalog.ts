import type { VercelRequest, VercelResponse } from '@vercel/node'

import { sanitizeTenantId, tenantKvKey } from './tenant.js'

const KV_CATALOG_KEY = 'theme_catalog'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  res.setHeader('Cache-Control', 'no-store')

  const debug = String(req.query?.debug ?? '') === '1'
  const tenantId = sanitizeTenantId(req.query?.tenant)
  const hasKvEnv = Boolean(
    process.env.KV_REST_API_URL &&
      process.env.KV_REST_API_TOKEN &&
      process.env.KV_REST_API_READ_ONLY_TOKEN,
  )

  let kv: any
  try {
    ;({ kv } = await import('@vercel/kv'))
  } catch (e: any) {
    res.status(200).json({
      items: [],
      source: 'kv-import-failed',
      hasKvEnv,
      tenantId,
      ...(debug ? { error: 'KV import failed', detail: String(e?.message ?? e) } : null),
    })
    return
  }

  try {
    const raw = await kv.get<any>(tenantKvKey(tenantId, KV_CATALOG_KEY))
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      res.status(200).json({ ...raw, source: (raw as any).source ?? 'kv', hasKvEnv, tenantId })
      return
    }
    if (typeof raw === 'string' && raw.trim()) {
      try {
        res.status(200).json({ ...(JSON.parse(raw) as any), source: 'kv-string', hasKvEnv, tenantId })
        return
      } catch {
        // fall through
      }
    }
  } catch (e: any) {
    res.status(200).json({
      items: [],
      source: 'kv-error',
      hasKvEnv,
      tenantId,
      ...(debug
        ? { error: 'KV read failed', detail: String(e?.message ?? e) }
        : null),
    })
    return
  }

  res.status(200).json({ items: [], source: 'empty', hasKvEnv, tenantId })
}


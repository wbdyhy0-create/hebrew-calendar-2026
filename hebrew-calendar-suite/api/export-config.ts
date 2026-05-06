import type { VercelRequest, VercelResponse } from '@vercel/node'

import { sanitizeTenantId, tenantKvKey } from './tenant'

const KV_KEY = 'current_config'
const KV_CATALOG_KEY = 'theme_catalog'

function setCors(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'content-type')
  res.setHeader('Access-Control-Max-Age', '600')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    setCors(req, res)

    if (req.method === 'OPTIONS') {
      res.status(204).end()
      return
    }

    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method Not Allowed' })
      return
    }

    const tenantId = sanitizeTenantId(req.query?.tenant)

    const { kv } = await import('@vercel/kv')

    const raw = await kv.get<string>(tenantKvKey(tenantId, KV_KEY))
    const rawCatalog = await kv.get<string>(tenantKvKey(tenantId, KV_CATALOG_KEY))

    let parsed: any = null
    try {
      parsed = raw ? JSON.parse(raw) : null
    } catch {
      parsed = null
    }

    let catalog: any = null
    try {
      catalog = rawCatalog ? JSON.parse(rawCatalog) : null
    } catch {
      catalog = null
    }

    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({
      ...(parsed && typeof parsed === 'object' ? parsed : { settings: {}, overrides: {}, source: 'kv-empty' }),
      ...(catalog && typeof catalog === 'object' ? { themeCatalog: catalog } : null),
      tenantId,
      storage: 'kv',
    })
  } catch (e: any) {
    try {
      setCors(req, res)
    } catch {
      // ignore
    }
    res.status(500).json({
      error: 'export-config failed',
      detail: String(e?.message ?? e),
      name: typeof e?.name === 'string' ? e.name : undefined,
    })
  }
}


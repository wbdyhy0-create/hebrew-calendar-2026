import type { VercelRequest, VercelResponse } from '@vercel/node'

import { sanitizeTenantId, tenantKvKey } from './tenant.js'

const ECB_DAILY_XML = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml'
const CACHE_KEY = 'fx_rates_cache'
const CACHE_TTL_SECONDS = 10 * 60

type FxRatesResponse = {
  ok: boolean
  tenantId: string
  source: 'cache' | 'ecb' | 'fetch-failed' | 'parse-failed' | 'kv-import-failed'
  asOf?: string
  base?: 'EUR'
  rates?: Record<string, number>
  cross?: {
    usdIls?: number
    eurIls?: number
    gbpIls?: number
  }
  detail?: string
}

function setCors(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'content-type')
  res.setHeader('Access-Control-Max-Age', '600')
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function parseEcbDaily(xml: string): { asOf: string | null; rates: Record<string, number> } | null {
  // Minimal parsing (no XML libs in serverless).
  const timeMatch = xml.match(/time=['"]([^'"]+)['"]/i)
  const asOf = timeMatch?.[1] ? String(timeMatch[1]) : null

  const rates: Record<string, number> = { EUR: 1 }
  const cubeRe = /<Cube\s+currency=['"]([A-Z]{3})['"]\s+rate=['"]([0-9.]+)['"]\s*\/>/g
  let m: RegExpExecArray | null = null
  while ((m = cubeRe.exec(xml))) {
    const c = m[1]
    const r = Number(m[2])
    if (!c || !Number.isFinite(r) || r <= 0) continue
    rates[c] = r
  }
  if (!Object.keys(rates).length) return null
  return { asOf, rates }
}

function round(n: number, digits: number) {
  const d = clamp(digits, 0, 8)
  const p = 10 ** d
  return Math.round(n * p) / p
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  res.setHeader('Cache-Control', 'no-store')

  const tenantId = sanitizeTenantId(req.query?.tenant)
  const cacheKey = tenantKvKey(tenantId, CACHE_KEY)

  let kv: any
  try {
    ;({ kv } = await import('@vercel/kv'))
  } catch (e: any) {
    const out: FxRatesResponse = {
      ok: false,
      tenantId,
      source: 'kv-import-failed',
      detail: String(e?.message ?? e),
    }
    res.status(200).json(out)
    return
  }

  // Try cache first (KV)
  try {
    const cached = await kv.get<any>(cacheKey)
    const obj = typeof cached === 'string' ? (() => { try { return JSON.parse(cached) } catch { return null } })() : cached
    if (obj && typeof obj === 'object' && !Array.isArray(obj) && obj.rates && typeof obj.rates === 'object') {
      res.status(200).json({ ...(obj as any), ok: true, tenantId, source: 'cache' } satisfies FxRatesResponse)
      return
    }
  } catch {
    // ignore cache errors
  }

  try {
    const r = await fetch(ECB_DAILY_XML, {
      headers: {
        'user-agent': 'hebrew-calendar-suite/fx-sidebar (+vercel)',
        accept: 'application/xml, text/xml;q=0.9, */*;q=0.1',
      },
    })
    if (!r.ok) {
      res.status(200).json({ ok: false, tenantId, source: 'fetch-failed', detail: String(r.status) } satisfies FxRatesResponse)
      return
    }
    const xml = await r.text()
    const parsed = parseEcbDaily(xml)
    if (!parsed) {
      res.status(200).json({ ok: false, tenantId, source: 'parse-failed' } satisfies FxRatesResponse)
      return
    }

    // Compute cross rates relevant for Israel (ILS).
    const eurIls = parsed.rates.ILS
    const eurUsd = parsed.rates.USD
    const eurGbp = parsed.rates.GBP
    const usdIls =
      Number.isFinite(eurIls) && eurIls > 0 && Number.isFinite(eurUsd) && eurUsd > 0 ? eurIls / eurUsd : undefined
    const gbpIls =
      Number.isFinite(eurIls) && eurIls > 0 && Number.isFinite(eurGbp) && eurGbp > 0 ? eurIls / eurGbp : undefined

    const out: FxRatesResponse = {
      ok: true,
      tenantId,
      source: 'ecb',
      asOf: parsed.asOf ?? undefined,
      base: 'EUR',
      rates: {
        USD: parsed.rates.USD,
        EUR: 1,
        ILS: parsed.rates.ILS,
        GBP: parsed.rates.GBP,
      },
      cross: {
        usdIls: typeof usdIls === 'number' ? round(usdIls, 4) : undefined,
        eurIls: typeof eurIls === 'number' ? round(eurIls, 4) : undefined,
        gbpIls: typeof gbpIls === 'number' ? round(gbpIls, 4) : undefined,
      },
    }

    try {
      await kv.set(cacheKey, JSON.stringify(out), { ex: CACHE_TTL_SECONDS } as any)
    } catch {
      // ignore cache writes
    }

    res.status(200).json(out)
  } catch (e: any) {
    res.status(200).json({ ok: false, tenantId, source: 'fetch-failed', detail: String(e?.message ?? e) } satisfies FxRatesResponse)
  }
}


import type { VercelRequest, VercelResponse } from '@vercel/node'

import { sanitizeTenantId, tenantKvKey } from './tenant.js'

const DEFAULT_RSS_URL = 'https://www.globes.co.il/webservice/rss/rssfeeder.asmx/TelegramFeed'
const CACHE_KEY = 'finance_news_cache'
const CACHE_TTL_SECONDS = 45

type FinanceHeadline = {
  title: string
  link: string
  pubDate?: string
  source?: string
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function escapeXmlText(s: string) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8226;/g, '•')
    .replace(/&#8217;/g, '’')
}

function parseRss(xml: string, maxItems: number): FinanceHeadline[] {
  const items: FinanceHeadline[] = []
  const itemRe = /<item\b[\s\S]*?<\/item>/gi
  const titleRe = /<title>([\s\S]*?)<\/title>/i
  const linkRe = /<link>([\s\S]*?)<\/link>/i
  const pubRe = /<pubDate>([\s\S]*?)<\/pubDate>/i
  const sourceRe = /<source[^>]*>([\s\S]*?)<\/source>/i

  const matches = xml.match(itemRe) ?? []
  for (const chunk of matches) {
    const title = escapeXmlText((chunk.match(titleRe)?.[1] ?? '').trim())
    const link = escapeXmlText((chunk.match(linkRe)?.[1] ?? '').trim())
    const pubDate = escapeXmlText((chunk.match(pubRe)?.[1] ?? '').trim())
    const source = escapeXmlText((chunk.match(sourceRe)?.[1] ?? '').trim())
    if (!title || !link) continue
    items.push({ title, link, pubDate: pubDate || undefined, source: source || undefined })
    if (items.length >= maxItems) break
  }
  return items
}

function isAllowedRssUrl(u: string): boolean {
  try {
    const url = new URL(u)
    const host = url.hostname.toLowerCase()
    if (host === 'www.globes.co.il' || host.endsWith('.globes.co.il')) return true
    return false
  } catch {
    return false
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  res.setHeader('Cache-Control', 'no-store')

  const tenantId = sanitizeTenantId(req.query?.tenant)
  const limit = clamp(Number(req.query?.limit ?? 8) || 8, 5, 12)
  const rssUrlRaw = String(req.query?.url ?? '').trim() || DEFAULT_RSS_URL
  const rssUrl = isAllowedRssUrl(rssUrlRaw) ? rssUrlRaw : DEFAULT_RSS_URL

  const cacheKey = tenantKvKey(tenantId, CACHE_KEY)
  let kv: any
  try {
    ;({ kv } = await import('@vercel/kv'))
  } catch {
    // If KV import fails, continue without cache.
    kv = null
  }
  try {
    const cached = kv ? await kv.get<any>(cacheKey) : null
    if (cached && typeof cached === 'object' && Array.isArray((cached as any).items)) {
      res.status(200).json({ ok: true, tenantId, source: 'cache', rssUrl, items: (cached as any).items })
      return
    }
    if (typeof cached === 'string' && cached.trim()) {
      try {
        const parsed = JSON.parse(cached) as any
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.items)) {
          res.status(200).json({ ok: true, tenantId, source: 'cache', rssUrl, items: parsed.items })
          return
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore cache errors
  }

  try {
    const r = await fetch(rssUrl, {
      headers: {
        'user-agent': 'hebrew-calendar-suite/finance-sidebar (+vercel)',
        accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.1',
      },
    })
    if (!r.ok) {
      res.status(200).json({ ok: false, tenantId, source: 'rss-error', status: r.status, items: [] })
      return
    }
    const xml = await r.text()
    const items = parseRss(xml, limit)
    try {
      if (kv) {
        await kv.set(cacheKey, JSON.stringify({ items, fetchedAt: new Date().toISOString(), rssUrl }), {
          ex: CACHE_TTL_SECONDS,
        } as any)
      }
    } catch {
      // ignore cache writes
    }
    res.status(200).json({ ok: true, tenantId, source: 'rss', rssUrl, items })
  } catch (e: any) {
    res.status(200).json({ ok: false, tenantId, source: 'fetch-failed', items: [], detail: String(e?.message ?? e) })
  }
}


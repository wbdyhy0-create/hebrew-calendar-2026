import type { VercelRequest, VercelResponse } from '@vercel/node'

import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

export const config = {
  runtime: 'nodejs',
  maxDuration: 60,
  memory: 1024,
}

type Payload = {
  html: string
  widthMm: number
  heightMm: number
}

/**
 * Fetch Google Fonts CSS on the Node.js side and inject it as an inline <style> block.
 * This avoids Puppeteer having to resolve the font CSS itself (which can time out or fail
 * in a restricted serverless network). The actual WOFF2 files are still downloaded by
 * Chromium, but those are fast binary fetches that networkidle0 catches reliably.
 */
async function inlineGoogleFontsCss(html: string): Promise<string> {
  const linkRe = /<link[^>]+href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"[^>]*>/gi
  const urls: string[] = []
  let m: RegExpExecArray | null
  while ((m = linkRe.exec(html)) !== null) urls.push(m[1])
  if (!urls.length) return html

  const cssChunks: string[] = []
  for (const url of urls) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 6000)
      const resp = await fetch(url, {
        headers: {
          // Use a real Chrome UA so Google serves WOFF2 (not TTF fallback)
          'User-Agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/css,*/*;q=0.1',
        },
        signal: controller.signal,
      })
      clearTimeout(timer)
      if (resp.ok) cssChunks.push(await resp.text())
    } catch {
      // Font CSS fetch failed — keep the <link> tag so Puppeteer can try itself.
    }
  }

  if (!cssChunks.length) return html

  // Remove the <link> tags that we've inlined (keep any that failed).
  let out = html
  for (const url of urls) {
    out = out.replace(new RegExp(`<link[^>]+${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^>]*>`, 'i'), '')
  }
  // Remove preconnect hints for Google Fonts — no longer needed for the inlined CSS.
  out = out.replace(/<link[^>]+rel="preconnect"[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>/gi, '')
  // Inject the font CSS right before </head>
  out = out.replace('</head>', `<style>\n${cssChunks.join('\n')}\n</style>\n</head>`)
  return out
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const body = req.body as Payload | undefined
  if (
    !body ||
    typeof body.html !== 'string' ||
    !body.html.trim() ||
    !Number.isFinite(Number(body.widthMm)) ||
    !Number.isFinite(Number(body.heightMm))
  ) {
    res.status(400).json({ error: 'Invalid payload. Expected { html: string, widthMm: number, heightMm: number }' })
    return
  }
  const widthMm = Number(body.widthMm)
  const heightMm = Number(body.heightMm)

  // Pre-fetch Google Fonts CSS in Node.js so Puppeteer doesn't need to resolve it.
  const html = await inlineGoogleFontsCss(body.html)

  try {
    const executablePath = await chromium.executablePath()
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: {
        width: Math.max(800, Math.round((widthMm / 25.4) * 96)),
        height: Math.max(600, Math.round((heightMm / 25.4) * 96)),
        deviceScaleFactor: 2,
      },
      executablePath,
      headless: chromium.headless,
    })

    try {
      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: ['load', 'domcontentloaded', 'networkidle0'] })

      // Force font files to finish downloading before we render the PDF.
      await page.evaluate(async () => {
        if (!document.fonts) return
        await document.fonts.ready
        // Actively request the font weights we know are used so the browser
        // actually downloads the WOFF2 files (fonts load lazily otherwise).
        const families = ['Heebo', 'Assistant', 'David Libre', 'Frank Ruhl Libre', 'Kalam', 'Rubik']
        const weights = [400, 600, 700, 800]
        await Promise.allSettled(
          families.flatMap((f) => weights.map((w) => document.fonts.load(`${w} 16px "${f}"`))),
        )
        // Final settle — let the render engine apply the loaded glyphs.
        await new Promise<void>((r) => requestAnimationFrame(() => r()))
        await new Promise<void>((r) => setTimeout(() => r(), 200))
      })

      const pdf = await page.pdf({
        printBackground: true,
        preferCSSPageSize: true,
        width: `${widthMm}mm`,
        height: `${heightMm}mm`,
        margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
        pageRanges: '1',
      })

      const buf = Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf as unknown as Uint8Array)

      res.statusCode = 200
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', 'inline; filename="calendar.pdf"')
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('Content-Length', String(buf.byteLength))
      res.end(buf)
    } finally {
      await browser.close().catch(() => {})
    }
  } catch (e: any) {
    res.status(500).json({ error: 'PDF export failed', detail: String(e?.message ?? e) })
  }
}

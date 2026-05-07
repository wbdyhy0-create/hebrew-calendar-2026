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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const body = req.body as Payload | undefined
  const html = typeof body?.html === 'string' ? body.html : ''
  const widthMm = Number((body as any)?.widthMm)
  const heightMm = Number((body as any)?.heightMm)

  if (!html.trim() || !Number.isFinite(widthMm) || !Number.isFinite(heightMm)) {
    res.status(400).json({ error: 'Invalid payload. Expected { html: string, widthMm: number, heightMm: number }' })
    return
  }

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
      await page.evaluate(async () => {
        // @ts-expect-error fonts exists in browser
        await (document.fonts?.ready ?? Promise.resolve())
        await new Promise<void>((r) => requestAnimationFrame(() => r()))
        await new Promise<void>((r) => setTimeout(() => r(), 50))
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


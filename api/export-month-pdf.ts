import type { VercelRequest, VercelResponse } from '@vercel/node'

import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

import { buildPrintableMonthHtml } from '../hebrew-calendar-suite/packages/shared/src/utils/printMonth'
import { resolvePdfPageDimensionsMm } from '../hebrew-calendar-suite/packages/shared/src/utils/pdfPage'
import type { CalendarSettings } from '../hebrew-calendar-suite/packages/shared/src/utils/settings'
import type { OverridesMap } from '../hebrew-calendar-suite/packages/shared/src/overrides'

type Payload = {
  viewDateIso: string
  settings: CalendarSettings
  overrides: OverridesMap
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const body = req.body as Payload | undefined
  if (!body || typeof body.viewDateIso !== 'string' || !isPlainObject(body.settings) || !isPlainObject(body.overrides)) {
    res.status(400).json({ error: 'Invalid payload. Expected { viewDateIso: string, settings: object, overrides: object }' })
    return
  }

  const viewDate = new Date(body.viewDateIso)
  if (!Number.isFinite(viewDate.getTime())) {
    res.status(400).json({ error: 'Invalid viewDateIso. Expected ISO date string.' })
    return
  }

  const settings = body.settings as CalendarSettings
  const overrides = body.overrides as OverridesMap
  const html = buildPrintableMonthHtml(viewDate, settings, overrides, { location: 'Jerusalem' })
  const { widthMm, heightMm } = resolvePdfPageDimensionsMm(settings)

  try {
    const executablePath = await chromium.executablePath()
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: {
        // Use a viewport that matches the PDF page aspect ratio; Chromium will still print using page size.
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
      // Ensure fonts are ready before print-to-PDF for stable text metrics.
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

      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Cache-Control', 'no-store')
      res.status(200).send(pdf)
    } finally {
      await browser.close().catch(() => {})
    }
  } catch (e: any) {
    res.status(500).json({ error: 'PDF export failed', detail: String(e?.message ?? e) })
  }
}


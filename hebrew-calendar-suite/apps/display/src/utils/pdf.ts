import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

import { type CalendarSettings, resolvePdfPageDimensionsMm } from '@hebrew-calendar/shared'

// Display Accessibility Mode (`display-accessibility.css`) is never injected into PDF/export HTML —
// exported documents use print styles + settings only (white/paper targets).

// NOTE: We intentionally do not use html2pdf.js for exports anymore.
// We render via html2canvas (with `onclone`) and embed into jsPDF to match screen layout.

function resolvePageMmSafe(settings: CalendarSettings): { widthMm: number; heightMm: number } {
  return resolvePdfPageDimensionsMm(settings as any) as { widthMm: number; heightMm: number }
}

function resolveJsPdfFormatMm(settings: CalendarSettings, widthMm: number, heightMm: number): [number, number] {
  // Use explicit mm dimensions so jsPDF never falls back to pt assumptions.
  // Preset/custom mm come from resolvePdfPageDimensionsMm via resolvePageMmSafe.
  const preset = settings.pdfPagePreset ?? 'A4'
  if (preset === 'A4' || preset === 'A5') return [widthMm, heightMm]
  return [widthMm, heightMm]
}

async function settlePaintForPdf(extraMs: number) {
  await new Promise<void>((r) => requestAnimationFrame(() => r()))
  await new Promise<void>((r) => requestAnimationFrame(() => r()))
  await new Promise<void>((r) => setTimeout(r, extraMs))
}

/** Month backgrounds are often CSS `background-image`, not <img>; wait best-effort before html2canvas. */
/**
 * Mirrors Display on-screen auto-fit logic (container vs natural scroll size).
 * Combines horizontal and vertical fit so crowded text / 6-week months participate.
 * Returns shrink factor ∈ (0,1]; 1 means no tightening needed along both axes.
 */
function measurePdfCanvasLayoutFitFactor(canvasEl: HTMLElement): number {
  try {
    const inner = canvasEl.querySelector('.calendarLayoutZoom') as HTMLElement | null
    if (!inner) return 1
    const cw = Math.max(1, Math.ceil(canvasEl.clientWidth))
    const ch = Math.max(1, Math.ceil(canvasEl.clientHeight))
    const nw = Math.max(1, Math.ceil(inner.scrollWidth))
    const nh = Math.max(1, Math.ceil(inner.scrollHeight))
    const rx = cw / nw
    const ry = ch / nh
    const factor = Number.isFinite(rx) && Number.isFinite(ry) ? Math.min(rx, ry) : 1
    return factor > 0 ? factor : 1
  } catch {
    return 1
  }
}

/**
 * `foreignObjectRendering` can succeed but paint an all-white bitmap on some browsers.
 * Uses the same sample grid as `assertCanvasNotBlank`.
 */
function canvasSamplingLooksAllWhite(canvas: HTMLCanvasElement): boolean {
  const w = canvas.width
  const h = canvas.height
  if (!w || !h) return true
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return false
  let img: ImageData
  try {
    img = ctx.getImageData(0, 0, w, h)
  } catch {
    return false
  }
  const data = img.data
  const samplePoints = [
    [Math.floor(w * 0.1), Math.floor(h * 0.1)],
    [Math.floor(w * 0.5), Math.floor(h * 0.2)],
    [Math.floor(w * 0.5), Math.floor(h * 0.5)],
    [Math.floor(w * 0.8), Math.floor(h * 0.5)],
    [Math.floor(w * 0.9), Math.floor(h * 0.9)],
  ] as const
  for (const [sx, sy] of samplePoints) {
    const x = Math.min(w - 1, Math.max(0, sx))
    const y = Math.min(h - 1, Math.max(0, sy))
    const i = (y * w + x) * 4
    const [r, g, b, a] = [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!]
    if (a !== 255) return false
    if (r !== 255 || g !== 255 || b !== 255) return false
  }
  return true
}

/**
 * `backdrop-filter` on the printable shell (see CalendarMonthChrome) often makes html2canvas return
 * an all-white bitmap; Chrome is especially flaky on successive month exports without a reload.
 */
function neutralizeBackdropOnSubtree(root: HTMLElement): () => void {
  const touched: HTMLElement[] = []
  try {
    const nodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]
    for (const el of nodes) {
      let bf = ''
      let wb = ''
      try {
        const cs = window.getComputedStyle(el)
        bf = cs.backdropFilter || ''
        wb = (cs as CSSStyleDeclaration & { webkitBackdropFilter?: string }).webkitBackdropFilter ?? ''
      } catch {
        continue
      }
      if ((!bf || bf === 'none') && (!wb || wb === 'none')) continue
      el.style.setProperty('backdrop-filter', 'none', 'important')
      el.style.setProperty('-webkit-backdrop-filter', 'none', 'important')
      touched.push(el)
    }
  } catch {
    // ignore
  }
  return () => {
    for (const el of touched) {
      try {
        el.style.removeProperty('backdrop-filter')
        el.style.removeProperty('-webkit-backdrop-filter')
      } catch {
        // ignore
      }
    }
  }
}

async function preloadCssBackgroundImages(root: HTMLElement) {
  const nodes = [root, ...Array.from(root.querySelectorAll('*'))].filter(
    (n): n is HTMLElement => n instanceof HTMLElement,
  )
  const urls = new Set<string>()
  for (const n of nodes) {
    let bg = ''
    try {
      bg = window.getComputedStyle(n).backgroundImage || ''
    } catch {
      bg = ''
    }
    if (!bg || bg === 'none') continue
    const re = /url\((?:'|")?(.*?)(?:'|")?\)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(bg))) {
      const u = String(m[1] || '').trim()
      if (!u || u.startsWith('linear-gradient') || u.startsWith('radial-gradient')) continue
      if (u.startsWith('data:') || u.startsWith('http') || u.startsWith('blob:') || u.startsWith('/') || u.startsWith('.')) {
        urls.add(u)
      }
    }
  }
  await Promise.all(
    Array.from(urls).map(
      (u) =>
        new Promise<void>((resolve) => {
          const img = new Image()
          try {
            if (!u.startsWith('data:')) img.crossOrigin = 'anonymous'
          } catch {
            // ignore
          }
          img.onload = () => resolve()
          img.onerror = () => resolve()
          img.src = u
          setTimeout(resolve, 2500)
        }),
    ),
  )
}

export async function exportPdfBlobFromHtml(
  html: string,
  settings: CalendarSettings,
  opts?: { multiPage?: boolean },
) {
  const parsed = new DOMParser().parseFromString(html, 'text/html')

  const { widthMm, heightMm } = resolvePageMmSafe(settings)
  /** html2canvas capture scale for year PDF (raster density). */
  const YEAR_PDF_HTML2CANVAS_FIXED_SCALE = 2
  /** CSS snap width = PDF page long edge at 96dpi (e.g. A4 landscape 297 mm → css px). */
  const pdfCaptureCssWidthPx = Math.floor((widthMm / 25.4) * 96)
  /**
   * Capture height slightly below full page px height (~25px) so dense 6-row months (e.g. יוני 2026)
   * shrink the grid a touch and the bottom row is not clipped by html2canvas.
   */
  const pdfCaptureCssHeightRawPx = Math.round((heightMm / 25.4) * 96)
  /** Extra bottom breathing room for grid border (~25px dense-fit + ~8px border gutter). */
  const PDF_CAPTURE_SNAP_HEIGHT_TRIM_PX = 33
  const pdfCaptureCssHeightPx = Math.max(400, pdfCaptureCssHeightRawPx - PDF_CAPTURE_SNAP_HEIGHT_TRIM_PX)
  /** Clone-only: space below the grid so the bottom border isn’t clipped by html2canvas (5- and 6-row months). */
  const PDF_CAPTURE_CLONE_PAD_BOTTOM_PX = 9

  const container = document.createElement('div')
  container.style.position = 'fixed'
  // Keep the render target inside the viewport; some html2canvas modes can return a blank canvas
  // when the element is positioned far off-screen.
  container.style.left = '0'
  container.style.top = '0'
  container.style.width = `${widthMm}mm`
  container.style.height = `${heightMm}mm`
  container.style.minHeight = `${heightMm}mm`
  container.style.background = '#ffffff'
  container.style.opacity = '1'
  container.style.pointerEvents = 'none'
  /* Opacity 0 on the wrapper was breaking target 2/2 retries: nested finally restored opacity
     between html2canvas fallbacks → all-white canvases on #calendar-container. */
  container.style.visibility = 'hidden'
  container.style.clipPath = 'inset(50%)'
  container.style.zIndex = '-1'
  /* overflow:hidden חותך transform/אותיות מעל הקנבס ב־html2canvas */
  container.style.overflow = 'visible'
  container.setAttribute('dir', parsed.documentElement.getAttribute('dir') ?? 'ltr')
  container.innerHTML = parsed.body.innerHTML
  document.body.appendChild(container)
  const calendarElement = container.querySelector('#calendar-container') as HTMLElement | null

  const tempStyles: HTMLStyleElement[] = []
  parsed.head.querySelectorAll('style').forEach((styleNode) => {
    const style = document.createElement('style')
    style.textContent = styleNode.textContent
    style.setAttribute('data-pdf-temp-style', '1')
    document.head.appendChild(style)
    tempStyles.push(style)
  })

  /** Printable HTML may include Google Fonts `<link>`s; they are not in `innerHTML`, so clone them here. */
  const tempLinks: HTMLLinkElement[] = []
  const existingLinkHrefs = new Set(
    Array.from(document.querySelectorAll('link[href]')).map((n) => (n as HTMLLinkElement).href),
  )
  parsed.head.querySelectorAll('link[rel="stylesheet"], link[rel="preconnect"]').forEach((node) => {
    const link = node as HTMLLinkElement
    if (!link.href || existingLinkHrefs.has(link.href)) return
    existingLinkHrefs.add(link.href)
    const clone = link.cloneNode(true) as HTMLLinkElement
    clone.setAttribute('data-pdf-temp-link', '1')
    document.head.appendChild(clone)
    tempLinks.push(clone)
  })

  await Promise.all(
    tempLinks
      .filter((l) => l.rel === 'stylesheet')
      .map(
        (l) =>
          new Promise<void>((resolve) => {
            if (l.sheet) return resolve()
            l.onload = () => resolve()
            l.onerror = () => resolve()
            setTimeout(resolve, 4000)
          }),
      ),
  )

  try {
    await document.fonts.ready
  } catch {
    // ignore font wait failures
  }

  const images = Array.from(container.querySelectorAll('img'))
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) return resolve()
          img.onload = () => resolve()
          img.onerror = () => resolve()
          setTimeout(resolve, 3500)
        }),
    ),
  )

  await preloadCssBackgroundImages(calendarElement ?? container)

  if (calendarElement) {
    calendarElement.style.display = 'block'
    calendarElement.style.width =
      opts?.multiPage === true ? `${pdfCaptureCssWidthPx}px` : `${widthMm}mm`
    calendarElement.style.overflow = 'visible'
    if (!opts?.multiPage) {
      /* גובה קשיח חותך תוכן עם translateY שלילי; min-height שומר על עמוד מלא */
      calendarElement.style.height = 'auto'
      calendarElement.style.minHeight = `${heightMm}mm`
    }
    calendarElement.style.direction = 'ltr'
    calendarElement.classList.add('pdfMode')
    const canvases = Array.from(calendarElement.querySelectorAll('.canvas')) as HTMLElement[]
    canvases.forEach((canvas) => {
      canvas.style.display = 'block'
      canvas.style.overflow = 'visible'
      if (opts?.multiPage === true) {
        canvas.style.boxSizing = 'border-box'
        canvas.style.width = `${pdfCaptureCssWidthPx}px`
        canvas.style.height = `${pdfCaptureCssHeightPx}px`
        canvas.style.minHeight = `${pdfCaptureCssHeightPx}px`
        canvas.style.maxHeight = `${pdfCaptureCssHeightPx}px`
      } else {
        canvas.classList.add('pdfMode')
        canvas.style.width = `${widthMm}mm`
        canvas.style.height = 'auto'
        canvas.style.minHeight = `${heightMm}mm`
      }
    })
    const grids = Array.from(calendarElement.querySelectorAll('.grid')) as HTMLElement[]
    grids.forEach((grid) => {
      // html2canvas renders "screen" media, so enforce the 7-column layout inline.
      grid.style.display = 'grid'
      grid.style.gridTemplateColumns = 'repeat(7, 1fr)'
      grid.style.width = '100%'
      grid.style.direction = 'ltr'
      if (grid.classList.contains('gridIntegrated')) {
        grid.style.boxSizing = 'border-box'
        grid.style.gap = '4px'
        grid.style.rowGap = '4px'
        grid.style.columnGap = '4px'
        grid.style.padding = '4px'
        grid.style.backgroundColor = '#ffffff'
      } else {
        grid.style.gap = '0'
        grid.style.rowGap = '0'
        grid.style.columnGap = '0'
      }
    })
  }

  const pdfRoot = calendarElement ?? container
  const target: HTMLElement =
    opts?.multiPage === true
      ? pdfRoot
      : ((pdfRoot.querySelector('.canvas') as HTMLElement | null) ?? pdfRoot)

  const jsPdfFormat = resolveJsPdfFormatMm(settings, widthMm, heightMm)
  const jsPdfOrientation: 'landscape' | 'portrait' = widthMm >= heightMm ? 'landscape' : 'portrait'

  const marginMmRaw = Number(settings.pdfMarginMm)
  const marginMm = Number.isFinite(marginMmRaw) ? Math.max(0, marginMmRaw) : 0

  function wrapPdfStage<T>(stage: string, fn: () => T): T {
    try {
      return fn()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      throw new Error(`PDF: stage "${stage}" failed. ${msg}`)
    }
  }

  async function wrapPdfStageAsync<T>(stage: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      throw new Error(`PDF: stage "${stage}" failed. ${msg}`)
    }
  }

  function addImageToPdfSafe(
    doc: jsPDF,
    canvas: HTMLCanvasElement,
    x: number,
    y: number,
    w: number,
    h: number,
    pageIndex: number,
  ) {
    const alias = `page-${pageIndex}`
    const attempts: Array<{ label: string; run: () => void }> = [
      {
        label: "addImage({ imageData: canvas, format: 'PNG' })",
        run: () =>
          (doc as any).addImage({
            imageData: canvas,
            format: 'PNG',
            x,
            y,
            w,
            h,
            alias,
          }),
      },
      {
        label: "addImage(canvas, 'PNG')",
        run: () => doc.addImage(canvas as unknown as HTMLCanvasElement, 'PNG', x, y, w, h),
      },
      {
        label: 'addImage(canvas)',
        run: () => (doc as any).addImage(canvas, x, y, w, h),
      },
      {
        label: "addImage(dataURL, 'PNG')",
        run: () => {
          const dataUrl = canvas.toDataURL('image/png', 1.0)
          doc.addImage(dataUrl, 'PNG', x, y, w, h)
        },
      },
      {
        label: 'addImage(dataURL)',
        run: () => {
          const dataUrl = canvas.toDataURL('image/png', 1.0)
          ;(doc as any).addImage(dataUrl, x, y, w, h)
        },
      },
    ]

    const failures: Array<{ label: string; message: string }> = []
    for (const a of attempts) {
      try {
        a.run()
        return
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        failures.push({ label: a.label, message: msg })
      }
    }
    const details = failures.map((f) => `${f.label}: ${f.message}`).join(' | ')
    throw new Error(`PDF: jsPDF addImage failed after ${failures.length} attempts. ${details}`)
  }

  async function renderWithHtml2CanvasThenPdf() {
    const pageW = widthMm
    const pageH = heightMm
    const contentW = Math.max(1, pageW - marginMm * 2)
    const contentH = Math.max(1, pageH - marginMm * 2)

    /** Letterboxes inside margins; x/y mirror so each page stays centered within the printable box. */
    function fitCanvasToContentBox(canvas: HTMLCanvasElement): { x: number; y: number; w: number; h: number } {
      // Keep aspect ratio (contain) to avoid subtle stretching of fonts/boxes.
      const cw = Math.max(1, canvas.width)
      const ch = Math.max(1, canvas.height)
      const canvasRatio = cw / ch
      const boxRatio = contentW / contentH
      const w = boxRatio >= canvasRatio ? contentH * canvasRatio : contentW
      const h = boxRatio >= canvasRatio ? contentH : contentW / canvasRatio
      const x = marginMm + (contentW - w) / 2
      const y = marginMm + (contentH - h) / 2
      return { x, y, w, h }
    }

    const doc = wrapPdfStage('jsPDF ctor', () => {
      return new jsPDF({
        unit: 'mm',
        format: jsPdfFormat,
        orientation: jsPdfOrientation,
        compress: true,
      })
    })

    const nodes: HTMLElement[] = opts?.multiPage
      ? (Array.from((calendarElement ?? container).querySelectorAll('.canvas')) as HTMLElement[])
      : [target as HTMLElement]

    /**
     * Year PDF: compute one auto-fit scale for all 12 months.
     * We use the minimal factor so every page is rendered at the same visual size,
     * then we center the resulting bitmap on the PDF page in jsPDF.
     */
    let multiPageAutoFitScaleMin = 1 as number

    const pdfUserScaleRaw = Number(settings.pdfHtml2CanvasScale)
    const scale = Math.min(3, Math.max(1, Math.round(Number.isFinite(pdfUserScaleRaw) && pdfUserScaleRaw > 0 ? pdfUserScaleRaw : 2)))

    function assertCanvasNotBlank(canvas: HTMLCanvasElement, label: string) {
      const w = canvas.width
      const h = canvas.height
      if (!w || !h) throw new Error(`Blank canvas (${label}): zero size ${w}x${h}.`)
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return
      let img: ImageData
      try {
        img = ctx.getImageData(0, 0, w, h)
      } catch {
        return
      }
      const data = img.data
      const samplePoints = [
        [Math.floor(w * 0.1), Math.floor(h * 0.1)],
        [Math.floor(w * 0.5), Math.floor(h * 0.2)],
        [Math.floor(w * 0.5), Math.floor(h * 0.5)],
        [Math.floor(w * 0.8), Math.floor(h * 0.5)],
        [Math.floor(w * 0.9), Math.floor(h * 0.9)],
      ] as const
      for (const [sx, sy] of samplePoints) {
        const x = Math.min(w - 1, Math.max(0, sx))
        const y = Math.min(h - 1, Math.max(0, sy))
        const i = (y * w + x) * 4
        const [r, g, b, a] = [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!]
        if (a !== 255) return
        if (r !== 255 || g !== 255 || b !== 255) return
      }
      throw new Error(`Blank canvas (${label}): rendered all-white sample.`)
    }

    const PDF_CAPTURE_ATTR = 'data-pdf-capture-active'

    const buildOnClone = () => (clonedDoc: Document) => {
      const root = clonedDoc.querySelector('#calendar-container') as HTMLElement | null
      const scope = root ?? clonedDoc.body

      if (root) {
        root.style.setProperty('display', 'block', 'important')
        root.style.setProperty('visibility', 'visible', 'important')
        root.style.setProperty('opacity', '1', 'important')
        root.style.setProperty('width', `${widthMm}mm`, 'important')
        if (opts?.multiPage) {
          // Year HTML stacks 12 `.canvas` pages under one `#calendar-container`. Forcing one page height
          // on the wrapper can confuse layout/readback for later months during per-canvas captures.
          root.style.setProperty('height', 'auto', 'important')
          root.style.setProperty('min-height', '0', 'important')
          root.style.setProperty('overflow', 'visible', 'important')
        } else {
          root.style.setProperty('height', `${heightMm}mm`, 'important')
          root.style.setProperty('min-height', `${heightMm}mm`, 'important')
        }
      }

      scope.querySelectorAll<HTMLElement>('*').forEach((n) => {
        const s = n.style as any
        if (s?.backdropFilter) n.style.removeProperty('backdrop-filter')
        if (s?.webkitBackdropFilter) n.style.removeProperty('-webkit-backdrop-filter')
      })

      // Scope auto-fit math to the canvas being captured (year PDF markup has 12 `.canvas` siblings).
      const canvasActive = clonedDoc.querySelector(`[${PDF_CAPTURE_ATTR}="1"]`) as HTMLElement | null
      if (canvasActive && settings.layoutAutoFitToCanvas) {
        canvasActive.classList.add('pdfAutoFit')
        const gridEl = canvasActive.querySelector('.grid') as HTMLElement | null
        const dowEl = canvasActive.querySelector('.dow') as HTMLElement | null
        if (gridEl && dowEl) {
          const canvasRect = canvasActive.getBoundingClientRect()
          const gridRect = gridEl.getBoundingClientRect()
          const padB = Number.parseFloat(getComputedStyle(canvasActive).paddingBottom || '0') || 0
          const dowH = dowEl.getBoundingClientRect().height || 0
          const integratedHeaderEl = gridEl.querySelector('.integratedHeader') as HTMLElement | null
          const integratedH = integratedHeaderEl?.getBoundingClientRect().height || 0
          const children = Array.from(gridEl.children)
          const total = children.length
          const headerCells = integratedHeaderEl ? 1 : 0
          const remaining = Math.max(0, total - headerCells - 7)
          const weeks = Math.max(5, Math.min(6, Math.round(remaining / 7) || 6))
          const avail = Math.max(120, canvasRect.height - (gridRect.top - canvasRect.top) - padB)
          const cellH = Math.max(60, Math.ceil((avail - integratedH - dowH) / weeks))
          canvasActive.style.setProperty('--pdfAutoCellHeightPx', `${cellH}px`)
          gridEl.style.gridAutoRows = 'unset'
          gridEl.style.gridTemplateRows = integratedHeaderEl
            ? `${Math.round(integratedH)}px ${Math.round(dowH)}px repeat(${weeks}, ${cellH}px)`
            : `${Math.round(dowH)}px repeat(${weeks}, ${cellH}px)`
        }
      }

      if (root && !opts?.multiPage) {
        root.style.setProperty('overflow', 'visible', 'important')
        root.style.setProperty('height', 'auto', 'important')
        root.style.setProperty('min-height', `${heightMm}mm`, 'important')
      }
      scope.querySelectorAll<HTMLElement>('.canvas').forEach((c) => {
        const isActiveLeaf = c.getAttribute(PDF_CAPTURE_ATTR) === '1'
        c.style.setProperty('display', 'block', 'important')
        c.style.setProperty('visibility', 'visible', 'important')
        c.style.setProperty('opacity', '1', 'important')
        c.style.setProperty('overflow', 'visible', 'important')

        /** CSS snap; height is trimmed (see PDF_CAPTURE_SNAP_HEIGHT_TRIM_PX). Raster = css px × html2canvas scale. */
        const pdfSnapCssWpx = pdfCaptureCssWidthPx
        const pdfSnapCssHpx = pdfCaptureCssHeightPx

        if (opts?.multiPage && isActiveLeaf) {
          const snap = pdfCaptureCssHeightPx
          c.style.setProperty('box-sizing', 'border-box', 'important')
          c.style.setProperty('width', `${pdfSnapCssWpx}px`, 'important')
          c.style.setProperty('height', `${snap}px`, 'important')
          c.style.setProperty('min-height', `${snap}px`, 'important')
          c.style.setProperty('max-height', `${snap}px`, 'important')
          c.style.setProperty('padding-bottom', `${PDF_CAPTURE_CLONE_PAD_BOTTOM_PX}px`, 'important')
        } else if (opts?.multiPage) {
          /* inactive year pages */
        } else {
          const monthSnap =
            isActiveLeaf ||
            (canvasActive?.id === 'calendar-container' && Boolean(canvasActive?.contains?.(c)))
          if (monthSnap) {
            c.style.setProperty('box-sizing', 'border-box', 'important')
            c.style.setProperty('width', `${pdfSnapCssWpx}px`, 'important')
            c.style.setProperty('height', `${pdfSnapCssHpx}px`, 'important')
            c.style.setProperty('min-height', `${pdfSnapCssHpx}px`, 'important')
            c.style.setProperty('max-height', `${pdfSnapCssHpx}px`, 'important')
            c.style.setProperty('padding-bottom', `${PDF_CAPTURE_CLONE_PAD_BOTTOM_PX}px`, 'important')
          } else {
            c.style.setProperty('height', 'auto', 'important')
            c.style.setProperty('min-height', `${heightMm}mm`, 'important')
          }
        }
      })

      /** Year multipage: chain fills fixed capture height (layoutStage centering is fixed below). */
      if (opts?.multiPage && canvasActive) {
        canvasActive.querySelectorAll<HTMLElement>('.calendarLayoutZoom').forEach((z) => {
          z.style.setProperty('min-height', '100%', 'important')
          z.style.setProperty('height', '100%', 'important')
          z.style.setProperty('flex', '1 1 auto', 'important')
        })
        canvasActive.querySelectorAll<HTMLElement>('.tableOffsetWrap').forEach((w) => {
          w.style.setProperty('flex', '1 1 auto', 'important')
          w.style.setProperty('min-height', '0', 'important')
          w.style.setProperty('height', '100%', 'important')
        })
        canvasActive.querySelectorAll<HTMLElement>('.pageWrap').forEach((pw) => {
          pw.style.setProperty('flex', '1 1 auto', 'important')
          pw.style.setProperty('min-height', '0', 'important')
          pw.style.setProperty('height', '100%', 'important')
        })
        canvasActive.querySelectorAll<HTMLElement>('.gridWrap').forEach((gw) => {
          gw.style.setProperty('flex', '1 1 auto', 'important')
          gw.style.setProperty('min-height', '0', 'important')
        })
      }

      scope.querySelectorAll<HTMLElement>('.grid').forEach((grid) => {
        grid.style.display = 'grid'
        grid.style.gridTemplateColumns = 'repeat(7, 1fr)'
        grid.style.width = '100%'
        grid.style.direction = 'ltr'
        if (grid.classList.contains('gridIntegrated')) {
          grid.style.setProperty('box-sizing', 'border-box', 'important')
          grid.style.setProperty('gap', '4px', 'important')
          grid.style.setProperty('row-gap', '4px', 'important')
          grid.style.setProperty('column-gap', '4px', 'important')
          grid.style.setProperty('padding', '4px', 'important')
          grid.style.setProperty('background', '#ffffff', 'important')
        } else {
          grid.style.setProperty('gap', '0', 'important')
          grid.style.setProperty('row-gap', '0', 'important')
          grid.style.setProperty('column-gap', '0', 'important')
        }
        const yearActiveGrid = opts?.multiPage && canvasActive && canvasActive.contains(grid)
        ;(grid.style as any).alignContent = yearActiveGrid ? 'stretch' : 'start'
        if (yearActiveGrid) {
          grid.style.setProperty('flex', '1 1 auto', 'important')
          grid.style.setProperty('min-height', '0', 'important')
          grid.style.setProperty('height', '100%', 'important')
        }
      })

      scope.querySelectorAll<HTMLElement>('.calendarLayoutZoom').forEach((el) => {
        const rawScale = el.style.getPropertyValue('--layoutScale')
        let scaleVal = parseFloat(rawScale)
        if (!Number.isFinite(scaleVal) || scaleVal <= 0) scaleVal = 1
        el.style.removeProperty('--layoutScale')
        let unified = opts?.multiPage ? scaleVal * multiPageAutoFitScaleMin : scaleVal
        if (!Number.isFinite(unified) || unified <= 0) unified = 1
        unified = Math.max(0.05, Math.min(unified, 200))
        ;(el.style as any).zoom = String(unified)
        el.style.width = '100%'
        el.style.transform = 'none'
        el.style.margin = '0'
        el.style.boxSizing = 'border-box'
      })

      scope.querySelectorAll<HTMLElement>('.layoutStage').forEach((st) => {
        st.style.setProperty('display', 'flex', 'important')
        const yearActiveStage = opts?.multiPage && canvasActive && canvasActive.contains(st)
        if (yearActiveStage) {
          st.style.setProperty('justify-content', 'flex-start', 'important')
          st.style.setProperty('align-items', 'stretch', 'important')
          st.style.setProperty('width', '100%', 'important')
          st.style.setProperty('min-height', '100%', 'important')
          st.style.setProperty('height', '100%', 'important')
        } else {
          st.style.setProperty('justify-content', 'center', 'important')
          st.style.setProperty('align-items', 'center', 'important')
        }
      })

      scope.querySelectorAll<HTMLElement>('.tableOffsetWrap').forEach((w) => {
        w.style.setProperty('width', '100%', 'important')
        w.style.setProperty('box-sizing', 'border-box', 'important')
        w.style.removeProperty('margin-left')
        w.style.removeProperty('margin-right')
      })

      scope.querySelectorAll<HTMLElement>('.dow').forEach((dow) => {
        dow.style.display = 'flex'
        dow.style.alignItems = 'center'
        dow.style.justifyContent = 'center'
      })

      scope
        .querySelectorAll<HTMLElement>('.headerMinimal, .headerRightBlockShell, .headerCenteredPillShell')
        .forEach((hb) => {
          hb.style.setProperty('display', 'block', 'important')
          hb.style.setProperty('position', 'relative', 'important')
        })
      scope.querySelectorAll<HTMLElement>('.headerBar.headerWysiwyg').forEach((hb) => {
        hb.style.setProperty('display', 'block', 'important')
        hb.style.setProperty('position', 'relative', 'important')
      })
      scope.querySelectorAll<HTMLElement>('.headerBar:not(.headerWysiwyg)').forEach((hb) => {
        hb.style.setProperty('display', 'grid', 'important')
        hb.style.setProperty(
          'grid-template-columns',
          'minmax(0, 1fr) auto minmax(0, 1fr)',
          'important',
        )
        hb.style.setProperty('align-items', 'center', 'important')
        hb.style.setProperty('position', 'relative', 'important')
      })
    }

    async function renderElementToCanvas(el: HTMLElement, pageIndex: number) {
      const onclone = buildOnClone()
      const backgroundColor = '#ffffff'

      const isYearMulti = Boolean(opts?.multiPage)
      /** Capture box matches pdfCaptureCss* from page mm (year + month snap). */
      const captureScale = Math.max(
        1,
        Number(isYearMulti ? YEAR_PDF_HTML2CANVAS_FIXED_SCALE : scale) ||
          (isYearMulti ? YEAR_PDF_HTML2CANVAS_FIXED_SCALE : 2),
      )
      const h2cWindowW = pdfCaptureCssWidthPx
      const h2cWindowH = pdfCaptureCssHeightPx

      type BoxSnap = { w: string; h: string; minH: string; maxH: string; overflow: string; box: string }
      let restoreBox: BoxSnap | null = null
      let restoreMonthSnap: BoxSnap | null = null
      if (isYearMulti) {
        restoreBox = {
          w: el.style.width,
          h: el.style.height,
          minH: el.style.minHeight,
          maxH: el.style.maxHeight,
          overflow: el.style.overflow,
          box: el.style.boxSizing,
        }
        el.style.boxSizing = 'border-box'
        el.style.width = `${pdfCaptureCssWidthPx}px`
        el.style.height = `${pdfCaptureCssHeightPx}px`
        el.style.minHeight = `${pdfCaptureCssHeightPx}px`
        el.style.maxHeight = `${pdfCaptureCssHeightPx}px`
        el.style.overflow = 'visible'
        await new Promise<void>((r) => requestAnimationFrame(() => r()))
        console.log(
          '[year-pdf-debug-temp] preCapture ' +
            JSON.stringify({
              offsetHeight: el.offsetHeight,
              clientHeight: el.clientHeight,
              scrollHeight: el.scrollHeight,
              snapCssPxH: pdfCaptureCssHeightPx,
            }),
        )
      } else if (el.classList.contains('canvas')) {
        restoreMonthSnap = {
          w: el.style.width,
          h: el.style.height,
          minH: el.style.minHeight,
          maxH: el.style.maxHeight,
          overflow: el.style.overflow,
          box: el.style.boxSizing,
        }
        el.style.boxSizing = 'border-box'
        el.style.width = `${pdfCaptureCssWidthPx}px`
        el.style.height = `${pdfCaptureCssHeightPx}px`
        el.style.minHeight = `${pdfCaptureCssHeightPx}px`
        el.style.maxHeight = `${pdfCaptureCssHeightPx}px`
        el.style.overflow = 'visible'
        await new Promise<void>((r) => requestAnimationFrame(() => r()))
      }

      /** `.canvas` is preferred for layout; `#calendar-container` fallback avoids all-white canvases after repeat exports on some Chromes. */
      const captureTargets: HTMLElement[] = isYearMulti
        ? [el]
        : (() => {
            const uniq: HTMLElement[] = []
            const add = (n: HTMLElement | null | undefined) => {
              if (!n || uniq.includes(n)) return
              uniq.push(n)
            }
            add(el)
            add(calendarElement)
            return uniq
          })()

      let rolloutLastFailure: unknown

      const prevExportVisibility = container.style.visibility
      const prevExportClip = container.style.clipPath
      const prevExportZIndex = container.style.zIndex
      let undoBackdropFilters: (() => void) | undefined

      try {
        container.style.visibility = 'visible'
        container.style.clipPath = 'none'
        container.style.zIndex = '2147483646'
        if (!isYearMulti) undoBackdropFilters = neutralizeBackdropOnSubtree(container)
        await new Promise<void>((r) =>
          requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
        )
        if (!isYearMulti) await settlePaintForPdf(280)
        else await new Promise<void>((r) => requestAnimationFrame(() => r()))

        try {
          for (let si = 0; si < captureTargets.length; si++) {
            const capEl = captureTargets[si]!
            const stageBase =
              `html2canvas (page ${pageIndex + 1}/${nodes.length}; ` +
              (captureTargets.length > 1 ? `target ${si + 1}/${captureTargets.length}` : `target 1/1`) +
              ')'

            capEl.setAttribute(PDF_CAPTURE_ATTR, '1')
            try {
              if (!isYearMulti) {
                try {
                  capEl.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' })
                } catch {
                  /* ignore */
                }
                void container.offsetHeight
                void capEl.offsetHeight
                await settlePaintForPdf(si === 0 ? 120 : 180)
              }

              const commonOpts = {
                scale: captureScale,
                useCORS: true,
                backgroundColor,
                windowWidth: h2cWindowW,
                windowHeight: h2cWindowH,
                scrollX: 0,
                scrollY: 0,
                onclone,
                width: pdfCaptureCssWidthPx,
                height: pdfCaptureCssHeightPx,
              }
              const h2cPhases: Array<{ label: string; extra: Record<string, unknown> }> = [
                { label: 'default', extra: {} },
                { label: 'foreignObjectRendering', extra: { foreignObjectRendering: true } },
                {
                  label: 'foreignObjectRendering-off-fallback',
                  extra: { foreignObjectRendering: false, useCORS: true },
                },
                ...(!isYearMulti ? [{ label: 'fallback-scale-1', extra: { scale: 1 as number } }] : []),
              ]

              let lastFailure: unknown
              for (const phase of h2cPhases) {
                try {
                  const canvas = await wrapPdfStageAsync(`${stageBase} [${phase.label}]`, async () => {
                    const merged = { ...commonOpts, ...phase.extra } as {
                      scale?: number
                      [k: string]: unknown
                    }
                    const raw = merged.scale
                    const safeScale = Math.max(
                      1,
                      typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : captureScale,
                    )
                    return await html2canvas(capEl, { ...merged, scale: safeScale } as any)
                  })
                  if (canvasSamplingLooksAllWhite(canvas)) {
                    lastFailure = new Error(
                      `Blank canvas (${stageBase}) [${phase.label}]: rendered all-white sample`,
                    )
                    continue
                  }
                  assertCanvasNotBlank(canvas, `${stageBase} [${phase.label}]`)
                  if (!isYearMulti) {
                    const snapCssPxW = pdfCaptureCssWidthPx
                    const snapCssPxH = pdfCaptureCssHeightPx
                    console.log(`[month-pdf-debug] snapCssPxH: ${snapCssPxH}`)
                    console.log(`[month-pdf-debug] snapCssPxW: ${snapCssPxW}`)
                    console.log(`[month-pdf-debug] canvas raster: ${canvas.width}x${canvas.height}`)
                    console.log(`[month-pdf-debug] scrollHeight: ${el.scrollHeight}`)
                    console.log(`[month-pdf-debug] offsetHeight: ${el.offsetHeight}`)
                  }
                  return canvas
                } catch (e) {
                  lastFailure = e
                  continue
                }
              }
              rolloutLastFailure = lastFailure
            } finally {
              capEl.removeAttribute(PDF_CAPTURE_ATTR)
            }
            if (!isYearMulti && si + 1 < captureTargets.length) await settlePaintForPdf(120)
          }

          const msg =
            rolloutLastFailure instanceof Error ? rolloutLastFailure.message : String(rolloutLastFailure)
          throw new Error(
            `All html2canvas targets/phases failed (page ${pageIndex + 1}/${nodes.length}). Last: ${msg}`,
          )
        } finally {
          undoBackdropFilters?.()
          if (prevExportVisibility) container.style.visibility = prevExportVisibility
          else container.style.removeProperty('visibility')
          if (prevExportClip) container.style.clipPath = prevExportClip
          else container.style.removeProperty('clip-path')
          if (prevExportZIndex) container.style.zIndex = prevExportZIndex
          else container.style.removeProperty('z-index')
        }
      } finally {
        if (restoreBox) {
          el.style.width = restoreBox.w
          el.style.height = restoreBox.h
          el.style.minHeight = restoreBox.minH
          el.style.maxHeight = restoreBox.maxH
          el.style.overflow = restoreBox.overflow
          el.style.boxSizing = restoreBox.box
        }
        if (restoreMonthSnap) {
          el.style.width = restoreMonthSnap.w
          el.style.height = restoreMonthSnap.h
          el.style.minHeight = restoreMonthSnap.minH
          el.style.maxHeight = restoreMonthSnap.maxH
          el.style.overflow = restoreMonthSnap.overflow
          el.style.boxSizing = restoreMonthSnap.box
        }
      }
    }

    if (opts?.multiPage) {
      await settlePaintForPdf(300)
      if (nodes.length) {
        const factors = nodes.map((n) => measurePdfCanvasLayoutFitFactor(n))
        const densestRaw = factors.length ? Math.min(...factors) : 1
        const densest =
          Number.isFinite(densestRaw) && densestRaw > 0 ? densestRaw : 1
        multiPageAutoFitScaleMin = Math.min(1, densest)
      }
    } else {
      await settlePaintForPdf(420)
    }

    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i]!
      const canvas = await renderElementToCanvas(el, i)
      if (i + 1 < nodes.length && opts?.multiPage) await settlePaintForPdf(48)

      if (i > 0) doc.addPage()
      wrapPdfStage(`jsPDF addImage (page ${i + 1}/${nodes.length})`, () => {
        if (opts?.multiPage) {
          const fit = fitCanvasToContentBox(canvas)
          // TEMP year-PDF sizing — stringify so DevTools does not collapse nested fields to {…}
          console.log(
            '[year-pdf-debug-temp] ' +
              JSON.stringify({
                monthPage: `${i + 1}/${nodes.length}`,
                canvas_px: { width: canvas.width, height: canvas.height },
                minWidthRasterAtScale2: pdfCaptureCssWidthPx * YEAR_PDF_HTML2CANVAS_FIXED_SCALE,
                addImageContain_mm: { x: fit.x, y: fit.y, w: fit.w, h: fit.h },
                pdfPageMm: { width: pageW, height: pageH },
                marginMm,
              }),
          )
          addImageToPdfSafe(doc, canvas, fit.x, fit.y, fit.w, fit.h, i)
          return
        }
        const fit = fitCanvasToContentBox(canvas)
        console.log(`[month-pdf-debug] addImage: x=${fit.x} y=${fit.y} w=${fit.w} h=${fit.h}`)
        addImageToPdfSafe(doc, canvas, fit.x, fit.y, fit.w, fit.h, i)
      })
    }

    return wrapPdfStage('jsPDF output(blob)', () => {
      return doc.output('blob') as Blob
    })
  }

  try {
    try {
      return await renderWithHtml2CanvasThenPdf()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      throw new Error(`PDF: export failed. ${msg}`)
    }
  } finally {
    container.remove()
    tempStyles.forEach((style) => style.remove())
    tempLinks.forEach((link) => link.remove())
  }
}

export async function exportPdfBlobFromElement(
  element: HTMLElement,
  settings: CalendarSettings,
  _opts?: { multiPage?: boolean },
) {
  const { widthMm, heightMm } = resolvePageMmSafe(settings)

  // Capture at the element's natural screen size so layout/fonts match the screen exactly.
  // Do NOT use PDF mm dimensions as the capture viewport — that would reflow the grid
  // into a different cell height, making fonts look different from what's on screen.
  const rect = element.getBoundingClientRect()
  const windowWidthPx = Math.max(900, Math.ceil(rect.width || (widthMm / 25.4) * 96))
  const windowHeightPx = Math.max(600, Math.ceil(rect.height || (heightMm / 25.4) * 96))

  try {
    await document.fonts.ready
  } catch {
    // ignore
  }

  const images = Array.from(element.querySelectorAll('img'))
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) return resolve()
          img.onload = () => resolve()
          img.onerror = () => resolve()
        }),
    ),
  )

  const jsPdfFormat = resolveJsPdfFormatMm(settings, widthMm, heightMm)
  const jsPdfOrientation: 'landscape' | 'portrait' = widthMm >= heightMm ? 'landscape' : 'portrait'

  const marginMmRaw = Number(settings.pdfMarginMm)
  const marginMm = Number.isFinite(marginMmRaw) ? Math.max(0, marginMmRaw) : 0

  const pageW = widthMm
  const pageH = heightMm
  const contentW = Math.max(1, pageW - marginMm * 2)
  const contentH = Math.max(1, pageH - marginMm * 2)

  function fitCanvasToContentBox(canvas: HTMLCanvasElement): { x: number; y: number; w: number; h: number } {
    // Keep aspect ratio (contain) to avoid subtle stretching of fonts/boxes.
    const cw = Math.max(1, canvas.width)
    const ch = Math.max(1, canvas.height)
    const canvasRatio = cw / ch
    const boxRatio = contentW / contentH
    const w = boxRatio >= canvasRatio ? contentH * canvasRatio : contentW
    const h = boxRatio >= canvasRatio ? contentH : contentW / canvasRatio
    const x = marginMm + (contentW - w) / 2
    const y = marginMm + (contentH - h) / 2
    return { x, y, w, h }
  }

  const doc = new jsPDF({
    unit: 'mm',
    format: jsPdfFormat,
    orientation: jsPdfOrientation,
    compress: true,
  })

  const pdfElScaleRaw = Number(settings.pdfHtml2CanvasScale)
  const scale = Math.min(
    3,
    Math.max(1, Math.round(Number.isFinite(pdfElScaleRaw) && pdfElScaleRaw > 0 ? pdfElScaleRaw : 2)),
  )

  const onclone = (clonedDoc: Document) => {
    // Locate the element in the clone via id; fall back to body scope.
    const root = clonedDoc.getElementById((element as any).id) as HTMLElement | null
    const scope = root ?? clonedDoc.body

    // Do NOT force PDF dimensions on root — that reflows the layout and changes font sizes.
    // Only fix overflow so content isn't clipped during capture.
    if (root) {
      root.style.setProperty('overflow', 'visible', 'important')
    }

    // Remove CSS effects that can break html2canvas parsing.
    scope.querySelectorAll<HTMLElement>('*').forEach((n) => {
      const s = n.style as any
      if (s?.backdropFilter) n.style.removeProperty('backdrop-filter')
      if (s?.webkitBackdropFilter) n.style.removeProperty('-webkit-backdrop-filter')
    })

    // Avoid transform scale drift during capture: use zoom so scaled size participates in layout.
    scope.querySelectorAll<HTMLElement>('[style*="--layoutScale"], .calendarLayoutZoom').forEach((el) => {
      const rawScale = el.style.getPropertyValue('--layoutScale')
      const scaleVal = parseFloat(rawScale) || 1
      el.style.removeProperty('--layoutScale')
      ;(el.style as any).zoom = String(scaleVal)
      el.style.width = '100%'
      el.style.transform = 'none'
      el.style.margin = '0'
      el.style.boxSizing = 'border-box'
    })

    // Unhide any overflow-hidden elements that could clip cell content.
    scope.querySelectorAll<HTMLElement>('.midWrap, .midInner').forEach((n) => {
      n.style.setProperty('overflow', 'visible', 'important')
    })
  }

  // Two rAFs to let layout settle before capture (matches Studio approach).
  await new Promise<void>((r) => requestAnimationFrame(() => r()))
  await new Promise<void>((r) => requestAnimationFrame(() => r()))

  const canvas = await html2canvas(element, {
    scale,
    useCORS: true,
    backgroundColor: '#ffffff',
    windowWidth: windowWidthPx,
    windowHeight: windowHeightPx,
    scrollX: 0,
    scrollY: 0,
    onclone,
  })

  const fit = fitCanvasToContentBox(canvas)
  doc.addImage(canvas as any, 'PNG', fit.x, fit.y, fit.w, fit.h)
  return doc.output('blob') as Blob
}

if (typeof window !== 'undefined') {
  ;(window as Window & { __HEBREW_CALENDAR_DISPLAY_APP__?: Record<string, string> }).__HEBREW_CALENDAR_DISPLAY_APP__ =
    {
      bundle: 'hebrew-calendar-suite/apps/display',
      gitShort: typeof __APP_BUILD__ === 'string' ? __APP_BUILD__ : 'unknown',
      yearPdf: 'Display: month capture via exportPdfBlobFromElement (Studio parity) + printable HTML fallback',
    }
  console.info(
    '[hebrew-calendar-display] pdf.ts loaded · git',
    typeof __APP_BUILD__ === 'string' ? __APP_BUILD__ : 'unknown',
  )
}

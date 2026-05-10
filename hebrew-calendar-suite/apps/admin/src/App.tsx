import { Component, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_SETTINGS,
  HAVDALAH_MINS_AFTER_SUNSET,
  CalendarMonthChrome,
  QuickNotesSidebar,
  formatHebrewHeaderText,
  getDayEventsByGregorianDate,
  getHebrewHeaderForGregorianMonth,
  getMonthGridWeeks,
  formatYmdJerusalem,
  getHebrewDayGematriya,
  mixHexWithWhite,
  normalizeOverridesMapToRecurring,
  recurringDayKeyFromIsoYmd,
  resolveDayTextOverride,
  buildCalendarDayMetas,
  formatParshaDisplayHe,
  CalendarContainer,
  HebcalZmanimLine,
  resolveCalendarLayoutZoomPercent,
  resolveCanvasOuterRadiusPx,
  isErevPesachGregorian,
  isErevSheviShelPesachGregorian,
  isPesachIGregorian,
  isSheviShelPesachGregorian,
  isRoshHashanaHolidayTitleHe as isRoshHashanaDay,
  isYomKippurHolidayTitleHe as isYomKippurDay,
  type OverridesMap,
} from '@hebrew-calendar/shared'
// Tenant branding is used in Display only.

function weekdayLabels(mode: string | undefined) {
  if (mode === 'fullName') return ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
  return ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'שבת']
}

type ViewMode = 'month' | 'day'

const GREGORIAN_MONTHS_HE = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
] as const

function monthPaddingKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `__pad__:${y}-${m}`
}

function formatGregorianMonthYearHebrew(date: Date) {
  const monthIndex = date.getMonth()
  const monthNum = monthIndex + 1
  const m = GREGORIAN_MONTHS_HE[monthIndex] ?? ''
  return `${monthNum}/ ${m} ${date.getFullYear()}`.trim()
}

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: unknown; errorInfo?: { componentStack?: string } | null }
> {
  state: { error: unknown; errorInfo?: { componentStack?: string } | null } = {
    error: null,
    errorInfo: null,
  }

  static getDerivedStateFromError(error: unknown) {
    return { error, errorInfo: null }
  }

  componentDidCatch(error: unknown, errorInfo: any) {
    this.setState({ error, errorInfo })
  }

  render() {
    if (this.state.error) {
      const msg =
        this.state.error instanceof Error
          ? this.state.error.message
          : String(this.state.error)
      return (
        <div
          dir="rtl"
          style={{
            padding: 16,
            borderRadius: 16,
            border: '1px solid rgba(239,68,68,0.35)',
            background: 'rgba(239,68,68,0.08)',
            color: '#7f1d1d',
            whiteSpace: 'pre-wrap',
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6 }}>שגיאה בתצוגה</div>
          <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize: 12 }}>
            {msg}
            {this.state.errorInfo?.componentStack ? `\n\n${this.state.errorInfo.componentStack}` : ''}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function formatClockHe(d: Date) {
  return new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit' }).format(d)
}

function formatDateHe(d: Date) {
  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

type TransferFont = {
  id: string
  family: string
  fileName: string
  weight?: string
  style?: string
  mime: string
  dataBase64: string
  createdAt: number
}

type StoredFont = {
  id: string
  family: string
  fileName: string
  weight?: string
  style?: string
  mime: string
  data: ArrayBuffer
  createdAt: number
}

const FONT_DB_NAME = 'hebrew-calendar-fonts'
const FONT_DB_VERSION = 1
const FONT_STORE = 'fonts'

function openFontDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FONT_DB_NAME, FONT_DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(FONT_STORE)) db.createObjectStore(FONT_STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'))
  })
}

async function putStoredFont(font: StoredFont): Promise<void> {
  const db = await openFontDb()
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(FONT_STORE, 'readwrite')
    const store = t.objectStore(FONT_STORE)
    const req = store.put(font)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'))
    t.oncomplete = () => db.close()
  })
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64)
  const len = bin.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

async function registerFontFace(font: StoredFont): Promise<void> {
  try {
    const face = new FontFace(font.family, font.data, {
      style: font.style || 'normal',
      weight: font.weight || '400',
    })
    const loaded = await face.load()
    ;(document as any).fonts?.add?.(loaded)
  } catch {
    // ignore
  }
}

async function ensureTransferFontsLoaded(fonts: TransferFont[] | null | undefined): Promise<void> {
  if (!fonts || !Array.isArray(fonts) || !fonts.length) return
  await Promise.all(
    fonts.map(async (f) => {
      if (!f || typeof f !== 'object') return
      if (typeof f.id !== 'string' || typeof f.family !== 'string' || typeof f.dataBase64 !== 'string') return
      const stored: StoredFont = {
        id: f.id,
        family: f.family,
        fileName: typeof f.fileName === 'string' ? f.fileName : 'font',
        weight: typeof f.weight === 'string' ? f.weight : undefined,
        style: typeof f.style === 'string' ? f.style : undefined,
        mime: typeof f.mime === 'string' ? f.mime : 'font/ttf',
        data: base64ToArrayBuffer(f.dataBase64),
        createdAt: typeof f.createdAt === 'number' ? f.createdAt : Date.now(),
      }
      await putStoredFont(stored)
      await registerFontFace(stored)
    }),
  )
}

function getBackgroundImageForMonth(settings: any, monthIndex0: number): string | null {
  try {
    const mode = String(settings?.backgroundImageMode ?? 'year')
    if (mode === 'perMonth') {
      const arr = settings?.backgroundImagesByMonth
      if (Array.isArray(arr)) {
        const v = arr[monthIndex0]
        if (typeof v === 'string' && v.trim()) return v
      }
      return null
    }
    const v = settings?.backgroundImageDataUrl
    if (typeof v === 'string' && v.trim()) return v
    return null
  } catch {
    return null
  }
}

export default function App() {
  // Display defaults to "prod" (bank-safe).
  // We hard-separate Admin vs Bank by hostname (so two Vercel projects can share the same code/branch):
  // - hostname containing "admin" => admin
  // - otherwise => prod
  // Optional overrides (for debugging):
  // - `?mode=admin|prod` or `?admin=1`
  const displayMode = (() => {
    try {
      const p = new URLSearchParams(window.location.search)
      const mode = String(p.get('mode') ?? '').toLowerCase()
      const admin = String(p.get('admin') ?? '').toLowerCase()
      if (mode === 'admin' || admin === '1' || admin === 'true') return 'admin'
      if (mode === 'prod') return 'prod'

      const host = String(window.location.hostname ?? '').toLowerCase()
      if (host.includes('admin')) return 'admin'
      return 'prod'
    } catch {
      // ignore
    }
    return String((import.meta as any).env?.VITE_DISPLAY_MODE ?? 'prod').toLowerCase()
  })()
  const isProdMode = displayMode === 'prod'

  /** פריסת `hebrew-calendar-admin.*` היא כלי עריכה — לא מצב \"בנק\" של סניף. */
  const isStaffCalendarAdminHost = (() => {
    try {
      const h = window.location.hostname.toLowerCase()
      return h.includes('calendar-admin') || h === 'localhost'
    } catch {
      return false
    }
  })()

  const [now, setNow] = useState(() => new Date())
  const [displayDate, setDisplayDate] = useState(() => new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [settings, setSettings] = useState(() => DEFAULT_SETTINGS)
  const [overrides, setOverrides] = useState<OverridesMap>(() => ({}))
  // Style presets are bank-only UI; keep admin clean.
  // Tenant branding is bank-only (Display). Admin doesn't render branding.

  // Branding header is intentionally not shown in Admin.

  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [remoteUrl, setRemoteUrl] = useState(() => {
    const tenant = (() => {
      try {
        const p = new URLSearchParams(window.location.search)
        return String(p.get('tenant') ?? '').trim()
      } catch {
        return ''
      }
    })()

    const envUrl = String((import.meta as any).env?.VITE_REMOTE_CONFIG_URL ?? '').trim()
    const defaultProdUrl = 'https://hebrew-calendar-suite-display.vercel.app/api/get-runtime-config'
    const base = envUrl || (window.location.hostname.toLowerCase().includes('localhost') ? '/api/get-runtime-config' : defaultProdUrl)
    if (!tenant) return base
    return base.includes('?') ? `${base}&tenant=${encodeURIComponent(tenant)}` : `${base}?tenant=${encodeURIComponent(tenant)}`
  })
  const lastPublishedAtRef = useRef<string | null>(null)
  const didApplyRemoteRef = useRef(false)
  // Bank/display (prod) — ללא סרגל אדמין. אתר האדמין בשם `-admin` נשאר מצב עריכה גם עם VITE_DISPLAY_MODE=prod.
  const isViewerOnly = isProdMode && !isStaffCalendarAdminHost
  const monthGridRef = useRef<HTMLDivElement | null>(null)
  const [monthCellPx, setMonthCellPx] = useState<number | null>(null)
  const canvasInnerRef = useRef<HTMLDivElement | null>(null)
  const calendarContentRef = useRef<HTMLDivElement | null>(null)
  const [autoFitScale, setAutoFitScale] = useState(1)

  const REMINDERS_KEY = 'hebrew-gregorian-calendar:display:reminders:v1'
  const REMINDER_SHOWN_PREFIX = 'hebrew-gregorian-calendar:display:reminders:shown:'
  const [remindersByDay, setRemindersByDay] = useState<Record<string, string>>(() => ({}))
  const [reminderEditorOpen, setReminderEditorOpen] = useState(false)
  const [reminderEditorDayKey, setReminderEditorDayKey] = useState<string | null>(null)
  const [reminderEditorText, setReminderEditorText] = useState('')
  const [reminderPopupOpen, setReminderPopupOpen] = useState(false)
  const [reminderPopupDayKey, setReminderPopupDayKey] = useState<string | null>(null)

  const [overrideEditorOpen, setOverrideEditorOpen] = useState(false)
  const [overrideEditorIsoKey, setOverrideEditorIsoKey] = useState<string | null>(null)
  const [overrideEditorText, setOverrideEditorText] = useState('')

  useEffect(() => {
    // Display runs on a different origin/port than Studio, so Studio localStorage is not readable here.
    // We keep a separate key for display-side imported/selected styles.
    const STORAGE_KEY = 'hebrew-gregorian-calendar:display:settings:v1'
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as any
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return

      // Back-compat: allow importing either {settings, overrides} or raw settings object
      const nextSettings = parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : parsed
      const nextOverrides = parsed.overrides && typeof parsed.overrides === 'object' ? parsed.overrides : {}

      // Important: prefer the published runtime config when available.
      // In Admin, localStorage is a fallback only (otherwise refresh can "jump" to remote then back).
      const t = window.setTimeout(() => {
        if (didApplyRemoteRef.current) return
        void ensureTransferFontsLoaded(parsed?.fonts)
        setSettings({ ...DEFAULT_SETTINGS, ...nextSettings })
        setOverrides(normalizeOverridesMapToRecurring(nextOverrides))
      }, 800)
      return () => window.clearTimeout(t)
    } catch {
      // ignore
    }
  }, [])

  // (style preset switching intentionally not available in Admin)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(REMINDERS_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as any
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return
      const next: Record<string, string> = {}
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof k === 'string' && typeof v === 'string') next[k] = v
      }
      setRemindersByDay(next)
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const applyRemote = (parsed: any) => {
      void ensureTransferFontsLoaded(parsed?.fonts)
      const parsedViewDate = parsed && typeof parsed.viewDate === 'string' ? parsed.viewDate : null
      const nextSettings =
        parsed && parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : parsed
      const nextOverrides =
        parsed && parsed.overrides && typeof parsed.overrides === 'object' ? parsed.overrides : {}

      setSettings({ ...DEFAULT_SETTINGS, ...nextSettings })
      setOverrides(normalizeOverridesMapToRecurring(nextOverrides))
      didApplyRemoteRef.current = true

      const publishedAt = parsed && typeof parsed.publishedAt === 'string' ? parsed.publishedAt : null
      if (publishedAt) lastPublishedAtRef.current = publishedAt

      if (parsedViewDate) {
        const d = new Date(parsedViewDate)
        if (!Number.isNaN(d.getTime())) setDisplayDate(d)
      }
    }

    const pullOnce = async () => {
      try {
        const r = await fetch(remoteUrl, { cache: 'no-store' })
        if (!r.ok) return
        const parsed = await r.json()

        const publishedAt = parsed && typeof parsed.publishedAt === 'string' ? parsed.publishedAt : null
        if (publishedAt && lastPublishedAtRef.current === publishedAt) return

        applyRemote(parsed)
      } catch {
        // ignore
      }
    }

    // Auto-pull published runtime config on load + periodically.
    // This enables bank Display to update after Studio Publish without requiring a manual refresh.
    void pullOnce()

    const onVisible = () => {
      if (!document.hidden) void pullOnce()
    }

    const intervalMs = isProdMode ? 10_000 : 15_000
    const id = window.setInterval(() => void pullOnce(), intervalMs)
    window.addEventListener('focus', pullOnce)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', pullOnce)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [remoteUrl, isProdMode])

  useEffect(() => {
    if (viewMode !== 'month') return
    const el = monthGridRef.current
    if (!el) return

    const compute = () => {
      // Use layout width (clientWidth) rather than bounding box:
      // the month grid can be visually scaled with CSS transforms (auto-fit/zoom),
      // and getBoundingClientRect() would include that transform which breaks 1:1 cell sizing.
      const w = el.clientWidth || el.offsetWidth || el.getBoundingClientRect().width
      if (!Number.isFinite(w) || w <= 0) return
      // 7 columns; round down to avoid overflow.
      const cell = Math.floor(w / 7)
      if (cell >= 40) setMonthCellPx(cell)
    }

    compute()
    const ro = new ResizeObserver(() => compute())
    ro.observe(el)
    window.addEventListener('resize', compute)
    return () => {
      window.removeEventListener('resize', compute)
      ro.disconnect()
    }
  }, [viewMode])

  useEffect(() => {
    if (!(settings as any).layoutAutoFitToCanvas) {
      setAutoFitScale(1)
      return
    }
    const container = canvasInnerRef.current
    const content = calendarContentRef.current
    if (!container || !content) return

    const compute = () => {
      const cw = Math.max(1, container.clientWidth)
      const naturalW = Math.max(
        1,
        content.clientWidth || (content as any).offsetWidth || (content as any).scrollWidth,
      )
      // Skip unstable early layout (RTL / flex width can be tiny for one frame → microscopic zoom).
      if (cw < 360) return
      // Screen behavior: fit to width. Clamp so auto-fit never shrinks the grid to an unreadable dot.
      const raw = cw / naturalW
      if (!Number.isFinite(raw) || raw <= 0) return
      const next = Math.min(1.4, Math.max(0.62, raw))
      setAutoFitScale((prev) => (Math.abs(prev - next) < 0.01 ? prev : next))
    }

    compute()
    const ro = new ResizeObserver(() => compute())
    ro.observe(container)
    ro.observe(content)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    (settings as any).layoutAutoFitToCanvas,
    (settings as any).calendarLayoutScalePercent,
    (settings as any).headerLayoutStyle,
    (settings as any).tableOffsetYPx,
    (settings as any).gridWeekdayHeaderHeightPx,
    (settings as any).pdfPagePreset,
    (settings as any).pdfOrientation,
    (settings as any).pdfCustomWidthMm,
    (settings as any).pdfCustomHeightMm,
    (settings as any).gregDayFontPx,
    (settings as any).hebDayFontPx,
    (settings as any).eventTitleFontPx,
    (settings as any).shabbatTimesFontPx,
  ])

  // Bank (prod) and Admin must share the exact same layout.
  // Only behavior differences are feature gating (e.g. no "pull config" in bank).

  const maybeShowTodayReminderPopup = (date: Date, reminders: Record<string, string>) => {
    const todayKey = formatYmdJerusalem(date)
    const text = reminders[todayKey]
    if (!text || !String(text).trim()) return
    try {
      const shownKey = `${REMINDER_SHOWN_PREFIX}${todayKey}`
      if (localStorage.getItem(shownKey) === '1') return
      localStorage.setItem(shownKey, '1')
    } catch {
      // ignore
    }
    setReminderPopupDayKey(todayKey)
    setReminderPopupOpen(true)
  }

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const tick = () => {
      const next = new Date()
      setNow(next)
      setDisplayDate(next)
    }

    let timeoutId = 0
    const schedule = () => {
      const n = new Date()
      const nextMidnight = new Date(n)
      nextMidnight.setHours(24, 0, 0, 50)
      const ms = Math.max(500, nextMidnight.getTime() - n.getTime())
      timeoutId = window.setTimeout(() => {
        tick()
        schedule()
      }, ms)
    }
    schedule()
    return () => window.clearTimeout(timeoutId)
  }, [])

  useEffect(() => {
    // On load + whenever reminders change, show today's reminder once.
    maybeShowTodayReminderPopup(new Date(), remindersByDay)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remindersByDay])

  const clock = useMemo(() => formatClockHe(now), [now])
  const fullDate = useMemo(() => formatDateHe(displayDate), [displayDate])

  const weeks = useMemo(() => getMonthGridWeeks(displayDate), [displayDate])
  const paddingMonthKey = useMemo(() => monthPaddingKey(displayDate), [displayDate])
  const gridStart = weeks[0]?.[0] ?? displayDate
  const lastWeek = weeks.length ? weeks[weeks.length - 1] : null
  const gridEnd = lastWeek && lastWeek.length ? lastWeek[lastWeek.length - 1] : displayDate

  const candleLightingMinsResolved = (settings as any).candleLightingMins === 40 ? 40 : 20

  const dayEventsJer = useMemo(() => {
    return getDayEventsByGregorianDate(gridStart, gridEnd, {
      il: true,
      location: 'Jerusalem',
      havdalahMins: HAVDALAH_MINS_AFTER_SUNSET,
      candleLightingMins: candleLightingMinsResolved,
      fastTzaitStyle: (settings as any).fastTzaitStyle,
      fastSunsetOffsetMins: (settings as any).fastSunsetOffsetMins,
    })
  }, [
    gridStart,
    gridEnd,
    candleLightingMinsResolved,
    (settings as any).fastTzaitStyle,
    (settings as any).fastSunsetOffsetMins,
  ])

  const dayEventsTA = useMemo(() => {
    return getDayEventsByGregorianDate(gridStart, gridEnd, {
      il: true,
      location: 'TelAviv',
      havdalahMins: HAVDALAH_MINS_AFTER_SUNSET,
      candleLightingMins: candleLightingMinsResolved,
      fastTzaitStyle: (settings as any).fastTzaitStyle,
      fastSunsetOffsetMins: (settings as any).fastSunsetOffsetMins,
    })
  }, [
    gridStart,
    gridEnd,
    candleLightingMinsResolved,
    (settings as any).fastTzaitStyle,
    (settings as any).fastSunsetOffsetMins,
  ])

  const isLikelyLightBg = (bg: unknown) => {
    const s = String(bg ?? '').trim().toLowerCase()
    if (!s) return false
    if (s === 'white') return true
    if (s === '#fff' || s === '#ffffff') return true

    const hex = s.startsWith('#') ? s.slice(1) : s
    if (hex.length === 3 || hex.length === 6) {
      const full =
        hex.length === 3
          ? hex
              .split('')
              .map((c) => c + c)
              .join('')
          : hex
      const r = parseInt(full.slice(0, 2), 16)
      const g = parseInt(full.slice(2, 4), 16)
      const b = parseInt(full.slice(4, 6), 16)
      if ([r, g, b].some((n) => Number.isNaN(n))) return false
      // Relative luminance (approx). Threshold tuned for beige backgrounds too.
      const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
      return luminance > 0.7
    }

    if (s.startsWith('rgb(') || s.startsWith('rgba(')) {
      const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
      if (!m) return false
      const r = Number(m[1])
      const g = Number(m[2])
      const b = Number(m[3])
      const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
      return luminance > 0.7
    }

    // unknown string like gradients: assume light is false
    return false
  }

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch {
      // ignore (browser policy)
    }
  }

  const applyImportedStyle = () => {
    try {
      const parsed = JSON.parse(importText) as any
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return
      void ensureTransferFontsLoaded(parsed?.fonts)
      const nextSettings = parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : parsed
      const nextOverrides = parsed.overrides && typeof parsed.overrides === 'object' ? parsed.overrides : {}
      const merged = { ...DEFAULT_SETTINGS, ...nextSettings }
      setSettings(merged)
      setOverrides(normalizeOverridesMapToRecurring(nextOverrides))
      try {
        localStorage.setItem(
          'hebrew-gregorian-calendar:display:settings:v1',
          JSON.stringify(parsed),
        )
      } catch {
        // ignore
      }
      setImportOpen(false)
    } catch {
      // ignore
    }
  }

  const pullFromStudio = async () => {
    try {
      const r = await fetch(remoteUrl, { cache: 'no-store' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const parsed = await r.json()
      const parsedViewDate = parsed && typeof parsed.viewDate === 'string' ? parsed.viewDate : null
      const nextSettings =
        parsed && parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : parsed
      const nextOverrides =
        parsed && parsed.overrides && typeof parsed.overrides === 'object' ? parsed.overrides : {}
      const merged = { ...DEFAULT_SETTINGS, ...nextSettings }
      setSettings(merged)
      setOverrides(normalizeOverridesMapToRecurring(nextOverrides))
      if (parsedViewDate) {
        const d = new Date(parsedViewDate)
        if (!Number.isNaN(d.getTime())) setDisplayDate(d)
      }
    } catch (e) {
      // ignore for now; user will see no change
      if (!isProdMode) console.error(e)
    }
  }

  const hebHeader = useMemo(() => getHebrewHeaderForGregorianMonth(displayDate), [displayDate])
  const hebMonthTitle = useMemo(() => formatHebrewHeaderText(hebHeader), [hebHeader])
  const gregLabel = useMemo(() => {
    return formatGregorianMonthYearHebrew(displayDate)
  }, [displayDate])

  const bgUrl = useMemo(() => getBackgroundImageForMonth(settings as any, displayDate.getMonth()), [
    displayDate,
    (settings as any).backgroundImageMode,
    (settings as any).backgroundImageDataUrl,
    (settings as any).backgroundImagesByMonth,
  ])
  const canvasBgStyle = useMemo(() => {
    const opacity = Math.min(1, Math.max(0, Number((settings as any).backgroundOpacity) || 0))
    const overlay = Math.min(1, Math.max(0, 1 - opacity))
    const lace1 = 'radial-gradient(circle at 1px 1px, rgba(148,163,184,0.35) 1px, transparent 1px)'
    const lace2 = 'radial-gradient(circle at 12px 12px, rgba(148,163,184,0.20) 1px, transparent 1px)'
    if (bgUrl) {
      return {
        backgroundImage: `${lace1}, ${lace2}, linear-gradient(rgba(255,255,255,${overlay}), rgba(255,255,255,${overlay})), url(${bgUrl})`,
        backgroundSize: '24px 24px, 24px 24px, cover, cover',
        backgroundPosition: '0 0, 0 0, center, center',
        backgroundRepeat: 'repeat, repeat, no-repeat, no-repeat',
      } as const
    }
    return {
      backgroundImage: `${lace1}, ${lace2}`,
      backgroundSize: '24px 24px, 24px 24px',
      backgroundPosition: '0 0, 0 0',
      backgroundRepeat: 'repeat, repeat',
    } as const
  }, [bgUrl, (settings as any).backgroundOpacity])

  const dayMetas = useMemo(() => {
    const gridDays = weeks.flat()
    return buildCalendarDayMetas({
      viewDate: displayDate,
      gridDays,
      dayEventsJer: dayEventsJer as any,
      dayEventsTA: dayEventsTA as any,
      todayKey: formatYmdJerusalem(new Date()),
    })
  }, [weeks, displayDate, dayEventsJer, dayEventsTA])

  // A single deterministic padding cell per month used for the "logo" slot.
  const paddingLogoDayKey = useMemo(() => {
    const firstPad = dayMetas.find((m) => !m.inMonth) ?? null
    if (!firstPad) return null
    return formatYmdJerusalem(firstPad.g)
  }, [dayMetas])

  const openReminderEditorForDay = (dayKey: string, date: Date) => {
    setDisplayDate(date)
    setReminderEditorDayKey(dayKey)
    setReminderEditorText(remindersByDay[dayKey] ?? '')
    setReminderEditorOpen(true)
  }

  const openDayCenterOverrideEditor = (isoKey: string, titles: string[], date: Date) => {
    setReminderEditorOpen(false)
    setDisplayDate(date)
    setOverrideEditorIsoKey(isoKey)
    const ovr = resolveDayTextOverride(overrides, isoKey)
    const seed = ovr?.centerLines?.length ? ovr.centerLines : titles
    setOverrideEditorText((Array.isArray(seed) ? seed : []).join('\n'))
    setOverrideEditorOpen(true)
  }

  const persistDisplaySettingsBundle = (nextOverrides: OverridesMap) => {
    const DISPLAY_BUNDLE_KEY = 'hebrew-gregorian-calendar:display:settings:v1'
    try {
      const raw = localStorage.getItem(DISPLAY_BUNDLE_KEY)
      const parsed = raw ? JSON.parse(raw) : {}
      const base = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
      const fonts = base.fonts
      localStorage.setItem(
        DISPLAY_BUNDLE_KEY,
        JSON.stringify({
          ...base,
          settings,
          overrides: nextOverrides,
          ...(fonts ? { fonts } : {}),
        }),
      )
    } catch {
      // ignore
    }
  }

  const saveDayCenterOverride = () => {
    const iso = overrideEditorIsoKey
    if (!iso) return
    const rk = recurringDayKeyFromIsoYmd(iso)
    if (!rk) return

    const lines = overrideEditorText.replace(/\r\n/g, '\n').split('\n').map((l) => l.trimEnd())
    const compact = lines.map((l) => l.trim()).filter(Boolean)

    const next: OverridesMap = { ...overrides }
    if (!compact.length) {
      delete next[rk]
    } else {
      next[rk] = { ...(next[rk] || {}), centerLines: compact }
    }

    const normalized = normalizeOverridesMapToRecurring(next)
    setOverrides(normalized)
    persistDisplaySettingsBundle(normalized)
    setOverrideEditorOpen(false)
    setOverrideEditorIsoKey(null)
  }

  const saveReminder = () => {
    const key = reminderEditorDayKey
    if (!key) return
    const next = { ...remindersByDay, [key]: reminderEditorText }
    setRemindersByDay(next)
    try {
      localStorage.setItem(REMINDERS_KEY, JSON.stringify(next))
    } catch {
      // ignore
    }
    setReminderEditorOpen(false)
  }

  return (
    <div
      dir="rtl"
      style={{
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        minHeight: '100vh',
        background: settings.calendarCanvasFill ?? '#0b1220',
        color: isLikelyLightBg(settings.calendarCanvasFill) ? '#0f172a' : '#e2e8f0',
        fontFamily: settings.fontFamily ?? DEFAULT_SETTINGS.fontFamily,
        // Neutralize global `index.css` typography (Display app shell) so the imported Studio
        // typography renders 1:1 (sizes/line-height/letter-spacing).
        fontSize: 16,
        lineHeight: 'normal',
        letterSpacing: 0,
      }}
    >
      {(() => {
        const light = isLikelyLightBg(settings.calendarCanvasFill)
        return (
          <style>{`
            .display-topbar { color: ${light ? '#0f172a' : '#e2e8f0'}; }
            .display-topbar .muted { color: ${light ? '#475569' : '#94a3b8'}; }
            .display-topbar .chip { 
              background: ${light ? 'rgba(255,255,255,0.72)' : 'rgba(15,23,42,0.60)'}; 
              border: 1px solid ${light ? 'rgba(148,163,184,0.35)' : 'rgba(148,163,184,0.25)'}; 
              color: ${light ? '#0f172a' : '#e2e8f0'};
            }
            .display-topbar .chip-active { 
              background: ${light ? 'rgba(59,130,246,0.14)' : 'rgba(56,189,248,0.18)'}; 
              color: ${light ? '#0f172a' : '#e0f2fe'};
            }
          `}</style>
        )
      })()}
      {!isViewerOnly ? (
        <header
          className="display-topbar"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: '14px 16px',
            borderBottom: '1px solid rgba(148,163,184,0.25)',
            background: isLikelyLightBg(settings.calendarCanvasFill)
              ? 'rgba(255,255,255,0.55)'
              : 'rgba(2,6,23,0.6)',
            position: 'sticky',
            top: 0,
            zIndex: 5,
            backdropFilter: 'blur(10px)',
            width: '100%',
            maxWidth: '100%',
            marginInline: 0,
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div
              className="chip"
              style={{
                fontVariantNumeric: 'tabular-nums',
                fontWeight: 800,
                padding: '8px 10px',
                borderRadius: 10,
              }}
              title="שעה"
            >
              {clock}
            </div>

            <>
              <button
                type="button"
                onClick={() => setViewMode('month')}
                className={['chip', viewMode === 'month' ? 'chip-active' : ''].join(' ')}
                style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  fontWeight: 800,
                }}
              >
                חודש
              </button>
              <button
                type="button"
                onClick={() => setViewMode('day')}
                className={['chip', viewMode === 'day' ? 'chip-active' : ''].join(' ')}
                style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  fontWeight: 800,
                }}
              >
                יום
              </button>
              <button
                type="button"
                onClick={toggleFullscreen}
                className="chip"
                style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  fontWeight: 800,
                }}
                title="מסך מלא"
              >
                מסך מלא
              </button>
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="chip"
                style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  fontWeight: 800,
                }}
                title="ייבוא סגנון (JSON)"
              >
                ייבוא סגנון
              </button>
              <button
                type="button"
                onClick={pullFromStudio}
                className="chip"
                style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  fontWeight: 800,
                }}
                title="משיכת הגדרות מהסטודיו"
              >
                משוך קונפיג
              </button>
            </>
          </div>
        </header>
      ) : null}

      <main style={{ padding: 16, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        {isViewerOnly ? (
          <div
            className="display-topbar"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginBottom: 12,
              flexWrap: 'wrap',
              // In bank (prod), keep the controls visually centered with the canvas width.
              width: '100%',
              maxWidth: '100%',
              marginInline: 0,
            }}
          >
            <button
              type="button"
              onClick={toggleFullscreen}
              className="chip"
              style={{
                padding: '8px 10px',
                borderRadius: 10,
                fontWeight: 800,
              }}
              title="מסך מלא"
            >
              מסך מלא
            </button>
            <button
              type="button"
              onClick={() => setViewMode('day')}
              className={['chip', viewMode === 'day' ? 'chip-active' : ''].join(' ')}
              style={{
                padding: '8px 10px',
                borderRadius: 10,
                fontWeight: 800,
              }}
            >
              יום
            </button>
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={['chip', viewMode === 'month' ? 'chip-active' : ''].join(' ')}
              style={{
                padding: '8px 10px',
                borderRadius: 10,
                fontWeight: 800,
              }}
            >
              חודש
            </button>
            <div
              className="chip"
              style={{
                fontVariantNumeric: 'tabular-nums',
                fontWeight: 900,
                padding: '8px 10px',
                borderRadius: 10,
                minWidth: 68,
                textAlign: 'center',
                direction: 'ltr',
              }}
              title="שעה"
            >
              {clock}
            </div>
          </div>
        ) : null}

        {viewMode === 'day' ? (
          <ErrorBoundary>
            {(() => {
              const key = formatYmdJerusalem(displayDate)
              const useTA = (settings as any).zmanimCity === 'TelAviv'
              const byDay = useTA ? dayEventsTA : dayEventsJer
              const ev = byDay.get(key)
              const ovr = resolveDayTextOverride(overrides, key)

              const isShabbat = displayDate.getDay() === 6
              const bg = isShabbat ? settings.shabbatBg ?? '#fff7e6' : '#ffffff'
              const titles = (ovr?.centerLines?.length ? ovr.centerLines : ev?.titles ?? []).slice(
                0,
                8,
              )
              const hebDay = getHebrewDayGematriya(displayDate)

              const timeLine =
                isShabbat || ev?.havdalah || ev?.candleLighting
                  ? [
                      ev?.candleLighting ? `כניסת שבת: ${ev.candleLighting}` : null,
                      ev?.havdalah ? `יציאת שבת: ${ev.havdalah}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : null

              const fastLine =
                ev?.fastBegins || ev?.fastEnds
                  ? [
                      ev?.fastNameHe ? ev.fastNameHe : 'צום',
                      ev?.fastBegins ? `כניסה: ${ev.fastBegins}` : null,
                      ev?.fastEnds ? `יציאה: ${ev.fastEnds}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : null

              return (
                <div
                  dir="rtl"
                  style={{
                    border: '1px solid rgba(148,163,184,0.35)',
                    borderRadius: 18,
                    padding: 18,
                    background: bg,
                    color: '#0f172a',
                    boxSizing: 'border-box',
                    minHeight: 'min(70vh, 900px)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ fontWeight: 900, fontSize: 18 }}>{fullDate}</div>
                    <div style={{ fontWeight: 900, fontSize: 22, direction: 'rtl' }}>
                      {displayDate.getDate()} · {hebDay}
                    </div>
                  </div>

                  {ev?.parshaHe ? (
                    <div style={{ color: '#334155', marginBottom: 8, fontWeight: 800 }}>
                      {ev.parshaHe}
                    </div>
                  ) : null}

                  {timeLine ? (
                    <div style={{ color: '#334155', marginBottom: 6, fontWeight: 700 }}>
                      {timeLine}
                    </div>
                  ) : null}
                  {fastLine ? (
                    <div style={{ color: '#334155', marginBottom: 10, fontWeight: 700 }}>
                      {fastLine}
                    </div>
                  ) : null}

                  <div
                    style={{
                      borderTop: '1px dashed rgba(148,163,184,0.45)',
                      paddingTop: 12,
                      display: 'grid',
                      gap: 8,
                      justifyItems: 'center',
                      textAlign: 'center',
                    }}
                  >
                    {titles.length ? (
                      titles.map((t: string, i: number) => (
                        <div
                          key={`${i}-${t}`}
                          style={{
                            fontSize: Math.max(12, Number(settings.eventTitleFontPx) || 16),
                            fontWeight: 800,
                            lineHeight: 1.25,
                          }}
                        >
                          {t}
                        </div>
                      ))
                    ) : (
                      <div style={{ color: '#64748b' }}>אין אירועים ליום זה</div>
                    )}
                  </div>
                </div>
              )
            })()}
          </ErrorBoundary>
        ) : (
          <ErrorBoundary>
            <div
              style={{
                // Create the same "framed" feel as Admin/Studio.
                padding: 16,
                background: 'transparent',
                boxSizing: 'border-box',
              }}
            >
              <CalendarContainer
                // On-screen should be wide and readable (bank clerk). A4 constraints are print-only.
                printOrientation={(settings as any).pdfOrientation === 'portrait' ? 'portrait' : 'landscape'}
                screenMinWidthVw={100}
                screenMaxWidthPx={3200}
                // Avoid `100vw` inside padded `<main>` (causes horizontal overflow / “split” layout).
                style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}
              >
                {(() => {
                  const rawScale =
                    (((settings as any).layoutAutoFitToCanvas ? autoFitScale : 1) *
                      (resolveCalendarLayoutZoomPercent(settings as any) / 100)) ||
                    1
                  const safeScale = Math.min(
                    2,
                    Math.max(0.52, Number.isFinite(rawScale) && rawScale > 0 ? rawScale : 1),
                  )
                  const hPct = (100 / safeScale).toFixed(4)
                  return (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'row',
                        direction: 'ltr',
                        gap: 16,
                        alignItems: 'flex-start',
                        justifyContent: 'flex-start',
                        flexWrap: 'nowrap',
                        overflowX: 'auto',
                        paddingBottom: 8,
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    >
                      <div
                        style={{
                          // Grow with the row (sidebar fixed); minWidth:0 avoids flex overflow quirks in RTL.
                          flex: '1 1 0%',
                          minWidth: 0,
                          width: '100%',
                          maxWidth: '100%',
                          position: 'relative',
                          overflow: 'visible',
                          boxSizing: 'border-box',
                        }}
                      >
                      {/* Branding header is bank-only (Display/prod). Keep Admin clean. */}
                      <div
                        style={{
                          border: `${Number((settings as any).canvasBorderWidthPx ?? 2)}px solid ${(settings as any).canvasBorderColor ?? '#E2E8F0'}`,
                          borderRadius: resolveCanvasOuterRadiusPx(settings as any),
                          padding: Number((settings as any).canvasPaddingPx ?? 16),
                          paddingTop: Number((settings as any).canvasPaddingTopPx ?? (settings as any).canvasPaddingPx ?? 16),
                          backgroundColor: (settings as any).calendarCanvasFill ?? '#0b1220',
                          ...canvasBgStyle,
                          width: '100%',
                          height: 'auto',
                          boxSizing: 'border-box',
                          // Keep the visual frame clean, but don't clip popovers/shadows at the wrapper level.
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                      >
                      {(() => {
                        // Screen mode: do not stretch rows to fill a fixed canvas height.
                        // This keeps month cells stable (and prevents internal scroll).
                        const effectiveFillHeight = false

                        return (
                      <div
                        ref={canvasInnerRef}
                        style={
                          (settings as any).layoutCenterVertically && !effectiveFillHeight
                            ? {
                                height: '100%',
                                width: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'stretch',
                                justifyContent: 'center',
                              }
                            : { height: '100%', width: '100%' }
                        }
                      >
                        <div
                          ref={calendarContentRef}
                          style={{
                            width: '100%',
                            transformOrigin: 'center center',
                            ...(effectiveFillHeight
                              ? {
                                  height: `${hPct}%`,
                                  minHeight: `${hPct}%`,
                                  transform: 'none',
                                  zoom: safeScale,
                                }
                              : {
                                  transform: 'none',
                                  zoom: safeScale,
                                }),
                          }}
                        >
                          <div
                            style={{
                              width: '100%',
                              ...(effectiveFillHeight
                                ? {
                                    height: '100%',
                                    paddingTop: Number((settings as any).tableOffsetYPx ?? 0),
                                    boxSizing: 'border-box',
                                  }
                                : { marginTop: Number((settings as any).tableOffsetYPx ?? 0) }),
                            }}
                          >
                            <CalendarMonthChrome
                              settings={
                                {
                                  ...(settings as any),
                                  layoutFillHeight: effectiveFillHeight,
                                  headerBarShowEditButton: false,
                                } as any
                              }
                              hebrewMonthTitle={hebMonthTitle}
                              gregorianLabel={gregLabel}
                              onEditHeader={() => {}}
                              gridWeekCount={weeks.length}
                              gridRef={monthGridRef as any}
                              gridChildren={
                                <>
                                  {weekdayLabels((settings as any).weekdayHeaderMode).map((t) => (
                                    <div
                                      key={t}
                                      style={{
                                        height: (settings as any).gridWeekdayHeaderHeightPx ?? 34,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: (settings as any).gridWeekdayHeaderBg ?? '#f3ead8',
                                        color: (settings as any).gridWeekdayHeaderTextColor ?? '#3b2a1b',
                                        fontSize: Math.max(
                                          10,
                                          Number((settings as any).gridWeekdayHeaderFontPx ?? 12),
                                        ),
                                        fontWeight: Number(
                                          (settings as any).gridWeekdayHeaderFontWeight ?? 700,
                                        ),
                                        borderBottom: `${(settings as any).gridWeekdayHeaderBorderBottomWidthPx ?? (settings as any).gridBorderWidthPx ?? 2}px solid ${(settings as any).gridWeekdayHeaderBorderBottomColor ?? (settings as any).gridBorderColor ?? '#bfa67a'}`,
                                        boxSizing: 'border-box',
                                        userSelect: 'none',
                                      }}
                                    >
                                      <div dir="rtl">{t}</div>
                                    </div>
                                  ))}

                                  {dayMetas.map((m) => {
                    const key = m.gKey
                    const ovr = resolveDayTextOverride(overrides, key)
                    const isToday = m.isToday
                    const isShabbat = m.isShabbat
                    const inMonth = m.inMonth
                    const paddingBg = mixHexWithWhite(
                      (settings as any).paddingCellColor ?? '#94a3b8',
                      Number.isFinite(Number((settings as any).paddingCellStrength))
                        ? Number((settings as any).paddingCellStrength)
                        : 0.22,
                    )
                    const bg = !inMonth
                      ? paddingBg
                      : isToday
                        ? (settings as any).todayBg ?? '#EAF2FF'
                        : isShabbat
                          ? (settings as any).shabbatBg ?? '#FFF7E6'
                          : m.isEventDay
                            ? (settings as any).eventBg ?? 'transparent'
                            : 'transparent'

                    const titles = (ovr?.centerLines?.length ? ovr.centerLines : m.titles).slice(0, 4)
                    const parsha = (settings as any).showParsha ? formatParshaDisplayHe(m.parshaHe) : ''

                    const isErevPesach = isErevPesachGregorian(m.g)
                    const isErevSheviShelPesach = isErevSheviShelPesachGregorian(m.g)
                    const isPesachI = isPesachIGregorian(m.g)
                    const isSheviShelPesach = isSheviShelPesachGregorian(m.g)
                    const isRhPanelDay = isRoshHashanaDay(m.titles)
                    const isYkPanelDay = isYomKippurDay(m.titles)

                    const showCandle = Boolean(m.candleLightingJer || m.candleLightingTA)
                    const showHavdalah = Boolean(m.havdalahJer || m.havdalahTA)

                    const candleLabel = m.isShabbat
                      ? 'יציאת השבת:'
                      : isYkPanelDay || isRhPanelDay
                        ? 'כניסה:'
                        : isErevPesach || isErevSheviShelPesach
                          ? 'כניסת החג:'
                          : 'כניסת השבת:'

                    const havdalahLabel = m.isShabbat
                      ? (isPesachI || isSheviShelPesach ? 'יציאת החג:' : 'יציאת השבת:')
                      : isYkPanelDay || isRhPanelDay
                        ? 'יציאה:'
                        : 'יציאת החג:'

                    const monthPad = (overrides as any)?.[paddingMonthKey] as any
                    const globalOvr = (overrides as any)?.__all__ as any
                    const disabled = (ovr as any)?.imageDisabled === true
                    const isPaddingLogoCell = !inMonth && paddingLogoDayKey && key === paddingLogoDayKey
                    const sourceOvr =
                      disabled
                        ? null
                        : (typeof (ovr as any)?.imageDataUrl === 'string' && String((ovr as any).imageDataUrl).trim()
                            ? (ovr as any)
                            : isPaddingLogoCell &&
                                typeof monthPad?.imageDataUrl === 'string' &&
                                String(monthPad.imageDataUrl).trim()
                              ? monthPad
                            : isPaddingLogoCell &&
                                typeof globalOvr?.imageDataUrl === 'string' &&
                                String(globalOvr.imageDataUrl).trim()
                              ? globalOvr
                              : null)
                    const cellImgUrl =
                      sourceOvr && typeof sourceOvr?.imageDataUrl === 'string' && String(sourceOvr.imageDataUrl).trim()
                        ? String(sourceOvr.imageDataUrl).trim()
                        : ''
                    const cellImgFit = String(sourceOvr?.imageFit ?? 'contain') || 'contain'
                    const cellImgOffX = Number(sourceOvr?.imageOffsetX) || 0
                    const cellImgOffY = Number(sourceOvr?.imageOffsetY) || 0
                    const cellImgOpacity =
                      typeof sourceOvr?.imageOpacity === 'number' ? sourceOvr.imageOpacity : 1

                    return (
                      <div
                        key={key}
                        onPointerDown={(ev) => {
                          if (!inMonth || ev.button !== 0) return
                          if (isStaffCalendarAdminHost) {
                            ev.preventDefault()
                            openDayCenterOverrideEditor(key, m.titles, m.g)
                            return
                          }
                          openReminderEditorForDay(key, m.g)
                        }}
                        style={{
                                          minHeight: monthCellPx ?? Number((settings as any).pdfExportCellHeightPx ?? 110),
                                          height: monthCellPx ?? 'auto',
                          position: 'relative',
                          padding: 8,
                          boxSizing: 'border-box',
                          fontFamily: (settings as any).fontFamily ?? DEFAULT_SETTINGS.fontFamily,
                          background: bg,
                          boxShadow: isToday && inMonth ? 'inset 0 0 0 3px rgba(16,185,129,0.55)' : undefined,
                          borderRadius:
                            Number((settings as any).cellCornerRadiusPx ?? 0) > 0
                              ? `${Number((settings as any).cellCornerRadiusPx)}px`
                              : undefined,
                          borderLeft:
                            (settings as any).showCellBorders === false
                              ? 'none'
                              : `${(settings as any).cellBorderWidthPx ?? 2}px solid ${(settings as any).cellBorderColor ?? '#9a7b52'}`,
                          borderTop:
                            (settings as any).showCellBorders === false
                              ? 'none'
                              : `${(settings as any).cellBorderWidthPx ?? 2}px solid ${(settings as any).cellBorderColor ?? '#9a7b52'}`,
                          cursor: inMonth ? 'pointer' : 'default',
                        }}
                      >
                        {cellImgUrl && inMonth ? (
                          <div
                            aria-hidden
                            style={{
                              position: 'absolute',
                              inset: 0,
                              pointerEvents: 'none',
                              backgroundImage: `url(${cellImgUrl})`,
                              backgroundSize: cellImgFit as any,
                              backgroundRepeat: 'no-repeat',
                              backgroundPosition: `calc(50% + ${cellImgOffX.toFixed(1)}px) calc(50% + ${cellImgOffY.toFixed(1)}px)`,
                              opacity: cellImgOpacity,
                              borderRadius: 'inherit',
                              zIndex: 0,
                            }}
                          />
                        ) : null}
                        {inMonth ? (
                          <div style={{ position: 'relative', zIndex: 1, height: '100%', minHeight: '100%' }}>
                            {((settings as any).cellSplitEnabled === true) ? (
                              <div
                                aria-hidden
                                style={{
                                  position: 'absolute',
                                  top: 0,
                                  bottom: 0,
                                  right: 0,
                                  width: `${Math.round((Number((settings as any).cellSplitRatio ?? 0.28) || 0.28) * 100)}%`,
                                  borderLeft: '1px solid rgba(148,163,184,0.35)',
                                  pointerEvents: 'none',
                                  zIndex: 2,
                                }}
                              />
                            ) : null}

                            {(settings as any).cellCornerLayout === 'bottom_left' ? (
                              <>
                                <div
                                  dir="rtl"
                                  style={{
                                    position: 'absolute',
                                    top: 6,
                                    right: 8,
                                    left: (settings as any).cellSplitEnabled
                                      ? `${Math.round((Number((settings as any).cellSplitRatio ?? 0.28) || 0.28) * 100)}%`
                                      : 8,
                                    fontSize: Number((settings as any).eventTitleFontPx ?? 10),
                                    lineHeight: 1.15,
                                    textAlign: 'right',
                                    opacity: 0.98,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 2,
                                    paddingInline: 2,
                                    transform: `translate(${Number(ovr?.centerOffsetX) || 0}px, ${Number(ovr?.centerOffsetY) || 0}px)`,
                                  }}
                                >
                                  {titles.slice(0, 4).map((t) => (
                                    <div
                                      key={t}
                                      style={{
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                      }}
                                    >
                                      {t}
                                    </div>
                                  ))}
                                  {parsha ? (
                                    <div
                                      style={{
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                      }}
                                    >
                                      {parsha}
                                    </div>
                                  ) : null}
                                </div>

                                <div
                                  style={{
                                    position: 'absolute',
                                    left: 8,
                                    bottom: 8,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-start',
                                    gap: 3,
                                    fontWeight: Number((settings as any).fontWeight ?? 700),
                                    zIndex: 3,
                                  }}
                                >
                                  <div
                                    style={{
                                      fontSize: Number((settings as any).gregDayFontPx ?? 12),
                                      lineHeight: 1,
                                    }}
                                  >
                                    {m.gDay}
                                    {m.gDay === 1 ? (
                                      <span style={{ fontSize: '0.75em', color: '#64748b' }}>
                                        /{m.gMonth}
                                      </span>
                                    ) : null}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: Number((settings as any).hebDayFontPx ?? 15),
                                      lineHeight: 1,
                                      opacity: 0.95,
                                    }}
                                  >
                                    {m.hebDay}
                                  </div>
                                </div>
                              </>
                            ) : (
                              <>
                                <div
                                  dir="rtl"
                                  style={{
                                    display: 'flex',
                                    alignItems: 'baseline',
                                    justifyContent: 'flex-start',
                                    gap: 6,
                                    fontWeight: Number((settings as any).fontWeight ?? 700),
                                  }}
                                >
                                  <div
                                    style={{
                                      fontSize: Number((settings as any).gregDayFontPx ?? 12),
                                      lineHeight: 1,
                                    }}
                                  >
                                    {m.gDay}
                                    {m.gDay === 1 ? (
                                      <span style={{ fontSize: '0.75em', color: '#64748b' }}>
                                        /{m.gMonth}
                                      </span>
                                    ) : null}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: Number((settings as any).hebDayFontPx ?? 15),
                                      lineHeight: 1,
                                      opacity: 0.95,
                                    }}
                                  >
                                    {m.hebDay}
                                  </div>
                                </div>

                                <div
                                  dir="rtl"
                                  style={{
                                    marginTop: 6,
                                    fontSize: Number((settings as any).eventTitleFontPx ?? 10),
                                    lineHeight: 1.15,
                                    textAlign: (ovr?.centerAlign ?? 'center') as any,
                                    opacity: 0.98,
                                    minHeight: 44,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    gap: 2,
                                    paddingInline: 2,
                                    transform: `translate(${Number(ovr?.centerOffsetX) || 0}px, ${Number(ovr?.centerOffsetY) || 0}px)`,
                                  }}
                                >
                                  {titles.map((t) => (
                                    <div
                                      key={t}
                                      style={{
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                      }}
                                    >
                                      {t}
                                    </div>
                                  ))}
                                  {parsha ? (
                                    <div
                                      style={{
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                      }}
                                    >
                                      {parsha}
                                    </div>
                                  ) : null}
                                </div>
                              </>
                            )}
                          </div>
                        ) : null}

                        {(showCandle || showHavdalah) && inMonth ? (
                          <div
                            dir="rtl"
                            style={{
                              position: 'absolute',
                              ...(String((settings as any).cellCornerLayout) === 'bottom_left'
                                ? {
                                    right: 8,
                                    left: 'auto',
                                    bottom: 8,
                                    maxWidth: '56%',
                                  }
                                : {
                                    insetInline: 8,
                                    bottom: 8,
                                  }),
                              zIndex: 5,
                              color: '#0f172a',
                              textAlign: 'right',
                              lineHeight: 1.2,
                              fontSize: Number((settings as any).shabbatTimesFontPx ?? 9),
                              opacity: 0.95,
                            }}
                          >
                            {showCandle ? (
                              <div style={{ marginBottom: showHavdalah ? 4 : 0 }}>
                                <div style={{ fontWeight: 400, whiteSpace: 'nowrap' }}>{candleLabel}</div>
                                <HebcalZmanimLine jer={m.candleLightingJer} ta={m.candleLightingTA} />
                              </div>
                            ) : null}
                            {showHavdalah ? (
                              <div>
                                <div style={{ fontWeight: 400, whiteSpace: 'nowrap' }}>{havdalahLabel}</div>
                                <HebcalZmanimLine jer={m.havdalahJer} ta={m.havdalahTA} />
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                                </>
                              }
                            />
                          </div>
                        </div>
                      </div>
                        )
                      })()}
                      </div>
                      </div>

                      <div style={{ flex: '0 0 auto' }}>
                        <QuickNotesSidebar />
                      </div>
                    </div>
                  )
                })()}
              </CalendarContainer>
            </div>
          </ErrorBoundary>
        )}
      </main>

      {reminderEditorOpen && reminderEditorDayKey ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2,6,23,0.55)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            zIndex: 60,
          }}
          onMouseDown={() => setReminderEditorOpen(false)}
        >
          <div
            dir="rtl"
            style={{
              width: 'min(560px, 100%)',
              background: isLikelyLightBg(settings.calendarCanvasFill) ? '#ffffff' : '#0b1220',
              border: '1px solid rgba(148,163,184,0.25)',
              borderRadius: 16,
              padding: 14,
              color: isLikelyLightBg(settings.calendarCanvasFill) ? '#0f172a' : '#e2e8f0',
              boxSizing: 'border-box',
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 900, marginBottom: 8 }}>תזכורת ליום</div>
            <div style={{ color: isLikelyLightBg(settings.calendarCanvasFill) ? '#475569' : '#94a3b8', fontSize: 12, marginBottom: 10 }}>
              {reminderEditorDayKey}
            </div>
            <textarea
              value={reminderEditorText}
              onChange={(e) => setReminderEditorText(e.target.value)}
              placeholder="כתוב כאן תזכורת…"
              style={{
                width: '100%',
                minHeight: 120,
                resize: 'vertical',
                padding: 10,
                borderRadius: 12,
                border: '1px solid rgba(148,163,184,0.25)',
                background: isLikelyLightBg(settings.calendarCanvasFill) ? 'rgba(248,250,252,1)' : 'rgba(15,23,42,0.6)',
                color: isLikelyLightBg(settings.calendarCanvasFill) ? '#0f172a' : '#e2e8f0',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
              <button
                type="button"
                onClick={() => setReminderEditorOpen(false)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid rgba(148,163,184,0.25)',
                  background: 'transparent',
                  color: isLikelyLightBg(settings.calendarCanvasFill) ? '#0f172a' : '#e2e8f0',
                  fontWeight: 800,
                }}
              >
                סגור
              </button>
              <button
                type="button"
                onClick={saveReminder}
                style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid rgba(148,163,184,0.25)',
                  background: 'rgba(16,185,129,0.16)',
                  color: isLikelyLightBg(settings.calendarCanvasFill) ? '#064e3b' : '#d1fae5',
                  fontWeight: 900,
                }}
              >
                שמור
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {overrideEditorOpen && overrideEditorIsoKey ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2,6,23,0.55)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            zIndex: 65,
          }}
          onMouseDown={() => {
            setOverrideEditorOpen(false)
            setOverrideEditorIsoKey(null)
          }}
        >
          <div
            dir="rtl"
            style={{
              width: 'min(620px, 100%)',
              background: isLikelyLightBg(settings.calendarCanvasFill) ? '#ffffff' : '#0b1220',
              border: '1px solid rgba(148,163,184,0.25)',
              borderRadius: 16,
              padding: 14,
              color: isLikelyLightBg(settings.calendarCanvasFill) ? '#0f172a' : '#e2e8f0',
              boxSizing: 'border-box',
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 900, marginBottom: 6 }}>עריכת טקסט מרכזי ביום (חוזר מדי שנה)</div>
            <div style={{ color: isLikelyLightBg(settings.calendarCanvasFill) ? '#475569' : '#94a3b8', fontSize: 12, marginBottom: 6 }}>
              תאריך:{' '}
              <span dir="ltr" style={{ fontFamily: 'ui-monospace, monospace' }}>
                {overrideEditorIsoKey}
              </span>
              {' · '}מפתח חוזר:{' '}
              <span dir="ltr" style={{ fontFamily: 'ui-monospace, monospace' }}>
                {recurringDayKeyFromIsoYmd(overrideEditorIsoKey) ?? ''}
              </span>
            </div>
            <div style={{ color: isLikelyLightBg(settings.calendarCanvasFill) ? '#64748b' : '#94a3b8', fontSize: 12, marginBottom: 10, lineHeight: 1.35 }}>
              כל חודש/שנה שבה התאריך הלועזי חוזר (למשל 10 למאי) יציג את אותן שורות. ריק ובשמור — מוחק התאמה
              ומחזיר טקסט אוטומטי מהשעון העברי.
            </div>
            <textarea
              value={overrideEditorText}
              onChange={(e) => setOverrideEditorText(e.target.value)}
              placeholder="שורה אחת לכל שורה במרכז התא…"
              style={{
                width: '100%',
                minHeight: 140,
                resize: 'vertical',
                padding: 10,
                borderRadius: 12,
                border: '1px solid rgba(148,163,184,0.25)',
                background: isLikelyLightBg(settings.calendarCanvasFill) ? 'rgba(248,250,252,1)' : 'rgba(15,23,42,0.6)',
                color: isLikelyLightBg(settings.calendarCanvasFill) ? '#0f172a' : '#e2e8f0',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
              <button
                type="button"
                onClick={() => {
                  setOverrideEditorOpen(false)
                  setOverrideEditorIsoKey(null)
                }}
                style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid rgba(148,163,184,0.25)',
                  background: 'transparent',
                  color: isLikelyLightBg(settings.calendarCanvasFill) ? '#0f172a' : '#e2e8f0',
                  fontWeight: 800,
                }}
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={saveDayCenterOverride}
                style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid rgba(148,163,184,0.25)',
                  background: 'rgba(16,185,129,0.16)',
                  color: isLikelyLightBg(settings.calendarCanvasFill) ? '#064e3b' : '#d1fae5',
                  fontWeight: 900,
                }}
              >
                שמור
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {reminderPopupOpen && reminderPopupDayKey ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2,6,23,0.40)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            zIndex: 70,
          }}
          onMouseDown={() => setReminderPopupOpen(false)}
        >
          <div
            dir="rtl"
            style={{
              width: 'min(520px, 100%)',
              background: '#ffffff',
              border: '1px solid rgba(148,163,184,0.35)',
              borderRadius: 16,
              padding: 14,
              color: '#0f172a',
              boxSizing: 'border-box',
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 900, marginBottom: 8 }}>תזכורת להיום</div>
            <div style={{ color: '#475569', fontSize: 12, marginBottom: 10 }}>{reminderPopupDayKey}</div>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.35, fontWeight: 700 }}>
              {remindersByDay[reminderPopupDayKey] ?? ''}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button
                type="button"
                onClick={() => setReminderPopupOpen(false)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid rgba(148,163,184,0.35)',
                  background: 'rgba(59,130,246,0.10)',
                  color: '#0f172a',
                  fontWeight: 900,
                }}
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!isProdMode && importOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2,6,23,0.55)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            zIndex: 50,
          }}
          onMouseDown={() => setImportOpen(false)}
        >
          <div
            style={{
              width: 'min(900px, 100%)',
              background: '#0b1220',
              border: '1px solid rgba(148,163,184,0.25)',
              borderRadius: 16,
              padding: 14,
              color: '#e2e8f0',
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 900, marginBottom: 8 }}>ייבוא סגנון (JSON)</div>
            <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 10 }}>
              בסטודיו: לחץ <code>ייצוא סגנון (JSON)</code>, העתק את ה־JSON, והדבק כאן.
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <input
                value={remoteUrl}
                onChange={(e) => setRemoteUrl(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid rgba(148,163,184,0.25)',
                  background: 'rgba(15,23,42,0.6)',
                  color: '#e2e8f0',
                }}
                placeholder="כתובת API לקונפיג (למשל: https://.../api/get-runtime-config?tenant=default)"
              />
              <button
                type="button"
                onClick={pullFromStudio}
                style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid rgba(148,163,184,0.25)',
                  background: 'rgba(56,189,248,0.18)',
                  color: '#e0f2fe',
                  fontWeight: 900,
                  whiteSpace: 'nowrap',
                }}
              >
                משוך
              </button>
            </div>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              spellCheck={false}
              style={{
                width: '100%',
                minHeight: 220,
                resize: 'vertical',
                background: 'rgba(15,23,42,0.6)',
                color: '#e2e8f0',
                border: '1px solid rgba(148,163,184,0.25)',
                borderRadius: 12,
                padding: 10,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                fontSize: 12,
                lineHeight: 1.35,
                boxSizing: 'border-box',
              }}
              placeholder='הדבק כאן JSON של ההגדרות מהסטודיו...'
            />

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid rgba(148,163,184,0.25)',
                  background: 'transparent',
                  color: '#e2e8f0',
                  fontWeight: 800,
                }}
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={applyImportedStyle}
                style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid rgba(148,163,184,0.25)',
                  background: 'rgba(56,189,248,0.18)',
                  color: '#e0f2fe',
                  fontWeight: 900,
                }}
              >
                החל סגנון
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


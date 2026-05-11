import { Component, type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
  formatHebrewDateFullGematriya,
  uniqAbbrevHebrewTitleLines,
  mixHexWithWhite,
  normalizeOverridesMapToRecurring,
  resolveDayTextOverride,
  buildCalendarDayMetas,
  formatParshaDisplayHe,
  CalendarContainer,
  DISPLAY_CALENDAR_SCREEN_MIN_WIDTH_VW,
  DISPLAY_CALENDAR_SCREEN_MAX_WIDTH_PX,
  HebcalZmanimLine,
  BrandHeader,
  calendarSurfaceDimensionsPx,
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
import { getTenantFromUrlSearch } from './tenants'
import { sanitizeTenantQueryIdFromSearch } from './sanitizeTenantQueryId'
import { type StylePreset } from './stylePresets'
import { buildPrintableMonthHtml, buildPrintableYearPdfHtml } from '@hebrew-calendar/shared'
import { exportPdfBlobFromElement, exportPdfBlobFromHtml } from './utils/pdf'
import { downloadBlobFile } from './utils/download'

type CloudThemeCatalogItem = {
  id: string
  kind: 'color' | 'style'
  nameHe: string
  patch: Record<string, unknown>
}

function monthPaddingKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `__pad__:${y}-${m}`
}

function monthPaddingKeyFromYmd(ymd: string) {
  const m = String(ymd ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return '__pad__:invalid'
  return `__pad__:${m[1]}-${m[2]}`
}

function weekdayLabels(mode: string | undefined) {
  if (mode === 'fullName') return ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
  return ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'שבת']
}

type ViewMode = 'month' | 'day'

/** Low-glare accessibility palette (screen only; PDF uses separate HTML). */
const DISPLAY_PDF_EXPORT_PATH_LS_KEY = 'hebrew-calendar-display:pdf-export-path:v1'
const DISPLAY_ACCESSIBILITY_LS_KEY = 'hebrew-calendar-display:accessibility-low-brightness:v1'
const DISPLAY_A11Y = {
  pageBg: '#1a1a1a',
  gridCellBg: '#002b36',
  textPrimary: '#fdf6e3',
  textAccent: '#b58900',
  line: '#586e75',
} as const

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

function formatGregorianMonthYearHebrew(date: Date) {
  const monthIndex = date.getMonth()
  const m = GREGORIAN_MONTHS_HE[monthIndex] ?? ''
  return `${m} ${date.getFullYear()}`.trim()
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
  return new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(d)
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
      // The suite "display" project is used operationally with the full toolbar.
      // Default it to admin-mode unless explicitly forced to prod via ?mode=prod.
      if (host.includes('suite-display') || host.includes('calendar-suite-display')) return 'admin'
      return 'prod'
    } catch {
      // ignore
    }
    return String((import.meta as any).env?.VITE_DISPLAY_MODE ?? 'prod').toLowerCase()
  })()
  const isProdMode = displayMode === 'prod'
  const debug = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get('debug') === '1'
    } catch {
      return false
    }
  }, [])

  const [now, setNow] = useState(() => new Date())
  const [displayDate, setDisplayDate] = useState(() => new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [accessibilityLowBrightnessMode, setAccessibilityLowBrightnessMode] = useState(() => {
    try {
      return localStorage.getItem(DISPLAY_ACCESSIBILITY_LS_KEY) === '1'
    } catch {
      return false
    }
  })
  const [baseSettings, setBaseSettings] = useState(() => DEFAULT_SETTINGS)

  useLayoutEffect(() => {
    try {
      localStorage.setItem(DISPLAY_ACCESSIBILITY_LS_KEY, accessibilityLowBrightnessMode ? '1' : '0')
    } catch {
      // ignore
    }
    document.documentElement.classList.toggle('accessibility-mode', accessibilityLowBrightnessMode)
  }, [accessibilityLowBrightnessMode])

  /** Alt+A — toggle high-contrast mode (skip when typing in form fields). */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.code !== 'KeyA' || e.repeat) return
      const el = e.target as HTMLElement | null
      if (el?.closest('input, textarea, select, [contenteditable="true"]')) return
      e.preventDefault()
      setAccessibilityLowBrightnessMode((v) => !v)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const [overrides, setOverrides] = useState<OverridesMap>(() => ({}))
  const [lastRemoteInfo, setLastRemoteInfo] = useState<{
    source?: string
    settingsKeys?: number
    gregDayFontPx?: number
    headerBox2OffsetXPx?: number
    publishedAt?: string | null
  } | null>(null)
  const [debugComputed, setDebugComputed] = useState<{
    gregFontPx?: string
    hebFontPx?: string
  } | null>(null)
  const [_stylePresets, _setStylePresets] = useState<StylePreset[]>([])
  const [_selectedPresetId, _setSelectedPresetId] = useState<string | null>(null)
  const [_undoSnapshot, _setUndoSnapshot] = useState<{ settings: any; overrides: any } | null>(null)
  const tenant = useMemo(() => {
    return typeof window === 'undefined' ? null : getTenantFromUrlSearch(window.location.search)
  }, [])

  /** Normalized `?tenant=` for KV / publish APIs (must match Studio + `api/_tenant.js`). */
  const kvTenantId = useMemo(
    () => sanitizeTenantQueryIdFromSearch(typeof window !== 'undefined' ? window.location.search : ''),
    [],
  )

  type LocalCellImage = {
    imageDataUrl: string
    imageFit?: 'cover' | 'contain'
    imageOpacity?: number
    imageOffsetX?: number
    imageOffsetY?: number
    /** When true, hide any published image for this cell on this workstation. */
    imageDisabled?: boolean
  }
  const localCellImagesStorageKey = useMemo(() => {
    try {
      const t = kvTenantId
      const origin = String(window.location.origin || '')
      const path = String(window.location.pathname || '')
      const search = String(window.location.search || '')
      return `hebrew-gregorian-calendar:display:local-cell-images:v1:${t}:${origin}${path}${search}`
    } catch {
      return 'hebrew-gregorian-calendar:display:local-cell-images:v1:default'
    }
  }, [tenant, kvTenantId])
  const localSlotImagesStorageKey = useMemo(() => `${localCellImagesStorageKey}:slots:v1`, [localCellImagesStorageKey])
  const localPaddingLogoStorageKey = useMemo(() => {
    try {
      const t = kvTenantId
      const origin = String(window.location.origin || '')
      const path = String(window.location.pathname || '')
      const search = String(window.location.search || '')
      return `hebrew-gregorian-calendar:display:padding-logo:v1:${t}:${origin}${path}${search}`
    } catch {
      return 'hebrew-gregorian-calendar:display:padding-logo:v1:default'
    }
  }, [tenant, kvTenantId])

  const quickNotesStorageKey = useMemo(() => {
    try {
      const t = kvTenantId
      const origin = String(window.location.origin || '')
      const path = String(window.location.pathname || '')
      const search = String(window.location.search || '')
      // Scope notes per tenant so they don't leak across bank links.
      return `hebrew-calendar:quick-notes:v2:${t}:${origin}${path}${search}`
    } catch {
      return 'hebrew-calendar:quick-notes:v2:default'
    }
  }, [tenant, kvTenantId])
  const [localCellImages, setLocalCellImages] = useState<Record<string, LocalCellImage>>(() => ({}))
  const [localSlotImages, setLocalSlotImages] = useState<Record<string, LocalCellImage>>(() => ({}))
  const [cellImgDialogOpen, setCellImgDialogOpen] = useState(false)
  const [cellImgDialogDayKey, setCellImgDialogDayKey] = useState<string | null>(null)
  const [cellImgDialogSlotKey, setCellImgDialogSlotKey] = useState<string | null>(null)
  const [cellImgDialogSlotIndex, setCellImgDialogSlotIndex] = useState<number | null>(null)
  const [cellImgDialogViewYm, setCellImgDialogViewYm] = useState<string | null>(null)
  const [cellImgDialogScope, setCellImgDialogScope] = useState<'month' | 'slot'>('month')
  const [cellImgDraftUrl, setCellImgDraftUrl] = useState<string>('')
  const [cellImgSavedAt, setCellImgSavedAt] = useState<number | null>(null)

  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [remoteUrl, setRemoteUrl] = useState(() => '/api/get-runtime-config')
  const [cloudCatalog, setCloudCatalog] = useState<CloudThemeCatalogItem[]>([])
  const [selectedCloudColorId, setSelectedCloudColorId] = useState<string>('default')
  const [selectedCloudStyleId, setSelectedCloudStyleId] = useState<string>('default')
  const [lockLayoutToStylePack, setLockLayoutToStylePack] = useState<boolean>(false)
  const [cloudSelectionOrigin, setCloudSelectionOrigin] = useState<'published' | 'local' | 'pinned'>('published')
  const [hiddenCloudCatalogIds, setHiddenCloudCatalogIds] = useState<Record<string, true>>(() => ({}))
  const [manageCatalogOpen, setManageCatalogOpen] = useState(false)
  const [paddingLogoDialogOpen, setPaddingLogoDialogOpen] = useState(false)
  const [paddingLogoDraftUrl, setPaddingLogoDraftUrl] = useState<string>('')
  const [paddingLogoScope, setPaddingLogoScope] = useState<'month' | 'global'>('global')
  const [localPaddingLogo, setLocalPaddingLogo] = useState<Record<string, any>>({})
  const [pdfBusy, setPdfBusy] = useState<'idle' | 'month' | 'year'>('idle')
  /** `server` = Puppeteer (like Studio, default); `capture` = DOM/html2canvas; `printable` = client-side jsPDF fallback. */
  const [pdfExportPath, setPdfExportPath] = useState<'server' | 'capture' | 'printable'>(() => {
    if (typeof window === 'undefined') return 'server'
    try {
      const v = window.localStorage.getItem(DISPLAY_PDF_EXPORT_PATH_LS_KEY)
      if (v === 'capture' || v === 'printable' || v === 'server') return v
      return 'server'
    } catch {
      return 'capture'
    }
  })
  const [saveFlash, setSaveFlash] = useState<string | null>(null)
  const [yearRangeOpen, setYearRangeOpen] = useState(false)
  const [yearRangeTab, setYearRangeTab] = useState<'heb' | 'greg'>('heb')
  const [yearRangeFromYm, setYearRangeFromYm] = useState(() => {
    const y = new Date().getFullYear()
    return `${y}-01`
  })
  const [yearRangeToYm, setYearRangeToYm] = useState(() => {
    const y = new Date().getFullYear()
    return `${y}-12`
  })
  const [yearRangeHebFromYear, setYearRangeHebFromYear] = useState<number>(() => {
    try {
      const fmt = new Intl.DateTimeFormat('he-u-ca-hebrew', { year: 'numeric' })
      return Number(fmt.format(new Date())) || 5786
    } catch {
      return 5786
    }
  })
  const [yearRangeHebFromMonth, setYearRangeHebFromMonth] = useState<string>('תשרי')
  const [yearRangeHebToYear, setYearRangeHebToYear] = useState<number>(() => {
    try {
      const fmt = new Intl.DateTimeFormat('he-u-ca-hebrew', { year: 'numeric' })
      return Number(fmt.format(new Date())) || 5786
    } catch {
      return 5786
    }
  })
  const [yearRangeHebToMonth, setYearRangeHebToMonth] = useState<string>('אלול')
  const lastPublishedAtRef = useRef<string | null>(null)
  const didApplyRemoteRef = useRef(false)
  const fullscreenTargetRef = useRef<HTMLDivElement | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const updateSnoozeStorageKey = useMemo(() => {
    try {
      const t = kvTenantId
      const origin = String(window.location.origin || '')
      const path = String(window.location.pathname || '')
      const search = String(window.location.search || '')
      return `hebrew-gregorian-calendar:display:update-snooze:v1:${t}:${origin}${path}${search}`
    } catch {
      return 'hebrew-gregorian-calendar:display:update-snooze:v1:default'
    }
  }, [tenant, kvTenantId])

  const currentVersionRef = useRef<string | null>(null)
  const [updatePromptOpen, setUpdatePromptOpen] = useState(false)
  const [latestVersion, setLatestVersion] = useState<string | null>(null)
  // Bank (prod) should look identical to Admin.
  // We only hide specific admin-only actions (e.g. pull config).
  const monthGridRef = useRef<HTMLDivElement | null>(null)
  const [monthCellPx, setMonthCellPx] = useState<number | null>(null)
  const canvasInnerRef = useRef<HTMLDivElement | null>(null)
  /** Framed calendar area (Studio `canvasOuterRef` equivalent) for WYSIWYG PDF capture. */
  const pdfCaptureFrameRef = useRef<HTMLDivElement | null>(null)
  const calendarContentRef = useRef<HTMLDivElement | null>(null)
  const [autoFitScale, setAutoFitScale] = useState(1)
  const [viewport, setViewport] = useState(() => {
    try {
      return { w: window.innerWidth || 0, h: window.innerHeight || 0 }
    } catch {
      return { w: 0, h: 0 }
    }
  })
  const isNarrow = viewport.w > 0 ? viewport.w <= 640 : false
  const isPortrait = viewport.w > 0 && viewport.h > 0 ? viewport.h >= viewport.w : false

  const REMINDERS_KEY = 'hebrew-gregorian-calendar:display:reminders:v1'
  const REMINDER_SHOWN_PREFIX = 'hebrew-gregorian-calendar:display:reminders:shown:'
  const [remindersByDay, setRemindersByDay] = useState<Record<string, string>>(() => ({}))
  const [reminderEditorOpen, setReminderEditorOpen] = useState(false)
  const [reminderEditorDayKey, setReminderEditorDayKey] = useState<string | null>(null)
  const [reminderEditorText, setReminderEditorText] = useState('')
  const [reminderPopupOpen, setReminderPopupOpen] = useState(false)
  const [reminderPopupDayKey, setReminderPopupDayKey] = useState<string | null>(null)
  const [debugOverridesInfo, setDebugOverridesInfo] = useState<{
    keys: number
    withImages: number
    maxImageLen: number
    source: string
  } | null>(null)

  const computeOverridesInfo = (ovr: any, source: string) => {
    try {
      if (!ovr || typeof ovr !== 'object') {
        setDebugOverridesInfo({ keys: 0, withImages: 0, maxImageLen: 0, source })
        return
      }
      let keys = 0
      let withImages = 0
      let maxImageLen = 0
      for (const v of Object.values(ovr)) {
        keys++
        const url = typeof (v as any)?.imageDataUrl === 'string' ? String((v as any).imageDataUrl) : ''
        if (url) {
          withImages++
          maxImageLen = Math.max(maxImageLen, url.length)
        }
      }
      setDebugOverridesInfo({ keys, withImages, maxImageLen, source })
    } catch {
      setDebugOverridesInfo({ keys: 0, withImages: 0, maxImageLen: 0, source: 'error' })
    }
  }

  useEffect(() => {
    if (!debug) return
    computeOverridesInfo(overrides as any, 'state')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debug, overrides])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(localCellImagesStorageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as any
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return
      const next: Record<string, LocalCellImage> = {}
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof k !== 'string') continue
        if (!v || typeof v !== 'object' || Array.isArray(v)) continue
        const disabled = (v as any).imageDisabled === true
        const url =
          typeof (v as any).imageDataUrl === 'string' && String((v as any).imageDataUrl).trim()
            ? String((v as any).imageDataUrl).trim()
            : ''
        if (!disabled && !url) continue
        next[k] = {
          imageDataUrl: url,
          imageFit:
            (String((v as any).imageFit ?? 'contain') as any) === 'cover' ? 'cover' : 'contain',
          imageOpacity:
            typeof (v as any).imageOpacity === 'number'
              ? Math.max(0, Math.min(1, (v as any).imageOpacity))
              : 1,
          imageOffsetX: Number((v as any).imageOffsetX) || 0,
          imageOffsetY: Number((v as any).imageOffsetY) || 0,
          imageDisabled: disabled,
        }
      }
      setLocalCellImages(next)
    } catch {
      // ignore
    }
  }, [localCellImagesStorageKey])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(localSlotImagesStorageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as any
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return
      const next: Record<string, LocalCellImage> = {}
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof k !== 'string') continue
        if (!v || typeof v !== 'object' || Array.isArray(v)) continue
        const disabled = (v as any).imageDisabled === true
        const url =
          typeof (v as any).imageDataUrl === 'string' && String((v as any).imageDataUrl).trim()
            ? String((v as any).imageDataUrl).trim()
            : ''
        if (!disabled && !url) continue
        next[k] = {
          imageDataUrl: url,
          imageFit:
            (String((v as any).imageFit ?? 'contain') as any) === 'cover' ? 'cover' : 'contain',
          imageOpacity:
            typeof (v as any).imageOpacity === 'number'
              ? Math.max(0, Math.min(1, (v as any).imageOpacity))
              : 1,
          imageOffsetX: Number((v as any).imageOffsetX) || 0,
          imageOffsetY: Number((v as any).imageOffsetY) || 0,
          imageDisabled: disabled,
        }
      }
      setLocalSlotImages(next)
    } catch {
      // ignore
    }
  }, [localSlotImagesStorageKey])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(localPaddingLogoStorageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as any
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return
      setLocalPaddingLogo(parsed)
    } catch {
      // ignore
    }
  }, [localPaddingLogoStorageKey])

  useEffect(() => {
    try {
      localStorage.setItem(localPaddingLogoStorageKey, JSON.stringify(localPaddingLogo))
    } catch {
      // ignore
    }
  }, [localPaddingLogo, localPaddingLogoStorageKey])

  useEffect(() => {
    try {
      localStorage.setItem(localCellImagesStorageKey, JSON.stringify(localCellImages))
    } catch {
      // ignore
    }
  }, [localCellImages, localCellImagesStorageKey])

  useEffect(() => {
    try {
      localStorage.setItem(localSlotImagesStorageKey, JSON.stringify(localSlotImages))
    } catch {
      // ignore
    }
  }, [localSlotImages, localSlotImagesStorageKey])

  const openLocalCellImageDialog = (dayKey: string, slotKey?: string | null, slotIndex?: number | null) => {
    setCellImgDialogDayKey(dayKey)
    setCellImgDialogSlotKey(slotKey ?? null)
    setCellImgDialogSlotIndex(typeof slotIndex === 'number' && Number.isFinite(slotIndex) ? slotIndex : null)
    setCellImgDialogViewYm(() => {
      const y = displayDate.getFullYear()
      const m = String(displayDate.getMonth() + 1).padStart(2, '0')
      return `${y}-${m}`
    })
    // Default scope: prefer slot if it already has an image and this month doesn't.
    const hasMonth =
      Boolean(String(localCellImages[dayKey]?.imageDataUrl ?? '').trim()) ||
      localCellImages[dayKey]?.imageDisabled === true
    const hasSlot =
      slotKey &&
      (Boolean(String(localSlotImages[String(slotKey)]?.imageDataUrl ?? '').trim()) ||
        localSlotImages[String(slotKey)]?.imageDisabled === true)
    setCellImgDialogScope(!hasMonth && hasSlot ? 'slot' : 'month')
    setCellImgDialogOpen(true)
  }

  const closeLocalCellImageDialog = () => {
    setCellImgDialogOpen(false)
    setCellImgDialogDayKey(null)
    setCellImgDialogSlotKey(null)
    setCellImgDialogSlotIndex(null)
    setCellImgDialogViewYm(null)
    setCellImgDialogScope('month')
    setCellImgDraftUrl('')
    setCellImgSavedAt(null)
  }

  const closePaddingLogoDialog = () => {
    setPaddingLogoDialogOpen(false)
    setPaddingLogoDraftUrl('')
    setPaddingLogoScope('global')
  }

  const openPaddingLogoDialog = (scope: 'month' | 'global') => {
    setPaddingLogoScope(scope)
    setPaddingLogoDialogOpen(true)
    setPaddingLogoDraftUrl('')
  }

  const downloadMonthPdf = async () => {
    if (pdfBusy !== 'idle') return
    setPdfBusy('month')
    try {
      const mergedOverridesForPdf = (() => {
        const base = (overrides ?? {}) as any
        const out: any = { ...base }
        for (const [k, v] of Object.entries(localCellImages ?? {})) {
          if (!v) continue
          out[k] = { ...(out[k] ?? {}), ...(v as any) }
        }
        for (const [k, v] of Object.entries(localPaddingLogo ?? {})) {
          if (!v) continue
          out[k] = { ...(out[k] ?? {}), ...(v as any) }
        }
        return out
      })()

      const monthPadKey = monthPaddingKey(displayDate)
      const hasPaddingLogoImage =
        Boolean(String((mergedOverridesForPdf as any)?.[monthPadKey]?.imageDataUrl ?? '').trim()) ||
        Boolean(String((mergedOverridesForPdf as any)?.__all__?.imageDataUrl ?? '').trim())
      const pdfSettingsBase = hasPaddingLogoImage
        ? ({ ...(brandSettings as any), brandLogoDataUrl: '' } as any)
        : brandSettings

      if (pdfExportPath === 'capture') {
        if (viewMode !== 'month') {
          window.alert('כדי לייצא PDF מצילום המסך (כמו בסטודיו), עבור לתצוגת חודש.')
          return
        }
        const el = pdfCaptureFrameRef.current
        if (!el) throw new Error('לא נמצאה מסגרת הקנבס לצילום PDF.')
        const blob = await exportPdfBlobFromElement(el, settingsForStudioLikePdfExport as any)
        const y = displayDate.getFullYear()
        const m = String(displayDate.getMonth() + 1).padStart(2, '0')
        downloadBlobFile(`calendar-${y}-${m}.pdf`, blob)
        return
      }

      const pdfSettings = {
        ...(pdfSettingsBase as any),
        pdfPagePreset: 'A4',
        pdfCustomWidthMm: 297,
        pdfCustomHeightMm: 210,
        pdfOrientation: 'landscape',
      } as any
      const baseCellH = Number((pdfSettings as any).pdfExportCellHeightPx ?? 110)
      const fittedCellH = monthCellPx ? Math.max(baseCellH, monthCellPx) : baseCellH
      ;(pdfSettings as any).pdfExportCellHeightPx = fittedCellH
      const html = buildPrintableMonthHtml(displayDate, pdfSettings as any, mergedOverridesForPdf as any)

      if (pdfExportPath === 'server') {
        try {
          const resp = await fetch('/api/export-month-pdf', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              html,
              widthMm: pdfSettings.pdfCustomWidthMm,
              heightMm: pdfSettings.pdfCustomHeightMm,
            }),
          })
          if (resp.ok) {
            const ab = await resp.arrayBuffer()
            const serverBlob = new Blob([ab], { type: 'application/pdf' })
            const isPdf = await (async () => {
              try {
                if (serverBlob.size < 5) return false
                const sig = new TextDecoder('ascii').decode(new Uint8Array(await serverBlob.slice(0, 5).arrayBuffer()))
                return sig === '%PDF-'
              } catch { return false }
            })()
            if (isPdf) {
              const y = displayDate.getFullYear()
              const m = String(displayDate.getMonth() + 1).padStart(2, '0')
              downloadBlobFile(`calendar-${y}-${m}.pdf`, serverBlob)
              return
            }
          }
        } catch { /* fall through to client-side */ }
      }

      const blob = await exportPdfBlobFromHtml(html, pdfSettings as any)
      const y = displayDate.getFullYear()
      const m = String(displayDate.getMonth() + 1).padStart(2, '0')
      downloadBlobFile(`calendar-${y}-${m}.pdf`, blob)
    } catch (e: any) {
      window.alert(`שגיאה בהורדת PDF: ${String(e?.message ?? e)}`)
    } finally {
      setPdfBusy('idle')
    }
  }

  const downloadYearPdf = async () => {
    if (pdfBusy !== 'idle') return
    setPdfBusy('year')
    try {
      const year = displayDate.getFullYear()
      const mergedOverridesForPdf = (() => {
        const base = (overrides ?? {}) as any
        const out: any = { ...base }
        for (const [k, v] of Object.entries(localCellImages ?? {})) {
          if (!v) continue
          out[k] = { ...(out[k] ?? {}), ...(v as any) }
        }
        for (const [k, v] of Object.entries(localPaddingLogo ?? {})) {
          if (!v) continue
          out[k] = { ...(out[k] ?? {}), ...(v as any) }
        }
        return out
      })()

      // Same double-logo avoidance for year export: if any padding-logo exists (global or per-month),
      // suppress the header brand logo in printable HTML.
      const hasAnyPaddingLogoImage =
        Object.keys(mergedOverridesForPdf as any).some(
          (k) =>
            (k === '__all__' || String(k).startsWith('__pad__:')) &&
            Boolean(String((mergedOverridesForPdf as any)?.[k]?.imageDataUrl ?? '').trim()),
        ) || false
      const pdfSettingsBase = hasAnyPaddingLogoImage
        ? ({ ...(brandSettings as any), brandLogoDataUrl: '' } as any)
        : brandSettings
      const pdfSettings = {
        ...(pdfSettingsBase as any),
        pdfPagePreset: 'A4',
        pdfCustomWidthMm: 297,
        pdfCustomHeightMm: 210,
        pdfOrientation: 'landscape',
      } as any
      const baseCellH = Number((pdfSettings as any).pdfExportCellHeightPx ?? 110)
      const fittedCellH = monthCellPx ? Math.max(baseCellH, monthCellPx) : baseCellH
      ;(pdfSettings as any).pdfExportCellHeightPx = fittedCellH

      const html = buildPrintableYearPdfHtml(year, pdfSettings as any, mergedOverridesForPdf as any)
      const blob = await exportPdfBlobFromHtml(html, pdfSettings as any, { multiPage: true })
      downloadBlobFile(`calendar-${year}.pdf`, blob)
    } catch (e: any) {
      window.alert(`שגיאה בהורדת PDF: ${String(e?.message ?? e)}`)
    } finally {
      setPdfBusy('idle')
    }
  }

  const buildYearRangePdfHtmlFromMonthDocs = (monthDocs: string[]) => {
    const extractBetween = (haystack: string, startNeedle: string, endNeedle: string) => {
      const start = haystack.indexOf(startNeedle)
      if (start < 0) return null
      const end = haystack.indexOf(endNeedle, start + startNeedle.length)
      if (end < 0) return null
      return haystack.slice(start + startNeedle.length, end)
    }
    const extractStyleBlock = (html: string) => extractBetween(html, '<style>', '</style>') ?? ''
    const extractCalendarContainer = (html: string) => {
      try {
        const parsed = new DOMParser().parseFromString(html, 'text/html')
        const el = parsed.querySelector('#calendar-container') as HTMLElement | null
        return el ? el.outerHTML : null
      } catch {
        return null
      }
    }
    const style = extractStyleBlock(monthDocs[0] ?? '') || ''
    const pages = monthDocs
      .map((doc, idx) => {
        const container = extractCalendarContainer(doc)
        if (!container) return `<div class="yearPage">שגיאה ביצירת חודש ${idx + 1}</div>`
        const normalized = container.replace('id="calendar-container" ', '')
        return `<div class="yearPage">${normalized}</div>`
      })
      .join('\n')
    const yearCss = `
      .yearDoc { direction: ltr; }
      .yearPage { display: block; }
      @media print {
        .yearPage { break-after: page; page-break-after: always; break-inside: avoid; page-break-inside: avoid; }
        .yearPage:last-child { break-after: auto; page-break-after: auto; }
      }
    `
    return `<!doctype html>
<html lang="he" dir="ltr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Calendar — range</title>
    <style>
${style}
${yearCss}
    </style>
  </head>
  <body>
    <div id="calendar-container" class="yearDoc">
${pages}
    </div>
  </body>
</html>`
  }

  const resolveGregorianYmFromHebrew = (hebYear: number, hebMonth: string): string | null => {
    try {
      const normalizeHebrewMonthName = (s: string) =>
        String(s ?? '')
          .normalize('NFKC')
          .trim()
          // Unify quotation marks onto Hebrew geresh (אדר א׳ / אדר ב׳)
          .replace(/\u05F4/g, '\u05F3')
          .replace(/\u2019/g, '\u05F3')
          .replace(/\u0027/g, '\u05F3')

      const targetMonth = normalizeHebrewMonthName(hebMonth)
      const fmt = new Intl.DateTimeFormat('he-u-ca-hebrew', { year: 'numeric', month: 'long', day: 'numeric' })
      const partsOf = (d: Date) => {
        const probe = new Date(d)
        probe.setHours(12, 0, 0, 0)
        const parts = fmt.formatToParts(probe)
        const y = parts.find((p) => p.type === 'year')?.value ?? ''
        const m = parts.find((p) => p.type === 'month')?.value ?? ''
        const day = parts.find((p) => p.type === 'day')?.value ?? ''
        return {
          y: Number(y),
          m: normalizeHebrewMonthName(String(m)),
          day: Number(day),
        }
      }

      const hy = Number(hebYear)
      if (!Number.isFinite(hy)) return null

      // Anchor the Gregorian scan to the approximate civil year span of Hebrew year HY.
      // Narrow windows miss late months such as Elul (can fall ~August of the NEXT Gregorian year),
      // which broke "תשרי → אלול" exports for the SAME Hebrew year.
      const anchorGregorianYearStart = hy - 3761
      const windowStart = new Date(anchorGregorianYearStart, 6, 1)
      windowStart.setHours(12, 0, 0, 0)
      const windowEnd = new Date(anchorGregorianYearStart + 2, 11, 31)
      windowEnd.setHours(12, 0, 0, 0)

      for (let d = new Date(windowStart); d.getTime() <= windowEnd.getTime(); d.setDate(d.getDate() + 1)) {
        const p = partsOf(d)
        if (p.y === hy && p.m === targetMonth && p.day === 1) {
          const y = d.getFullYear()
          const m = String(d.getMonth() + 1).padStart(2, '0')
          return `${y}-${m}`
        }
      }
      return null
    } catch {
      return null
    }
  }

  const downloadYearPdfRange = async (fromYm: string, toYm: string) => {
    if (pdfBusy !== 'idle') return
    setPdfBusy('year')
    try {
      const parseYm = (s: string) => {
        const m = String(s || '').match(/^(\d{4})-(\d{2})$/)
        if (!m) return null
        const y = Number(m[1])
        const mm = Number(m[2])
        if (!Number.isFinite(y) || !Number.isFinite(mm) || mm < 1 || mm > 12) return null
        return { y, m: mm }
      }
      const a = parseYm(fromYm)
      const b = parseYm(toYm)
      if (!a || !b) throw new Error('טווח חודשים לא תקין.')
      const from = new Date(a.y, a.m - 1, 1)
      const to = new Date(b.y, b.m - 1, 1)
      if (from.getTime() > to.getTime()) throw new Error('תאריך "מ-" חייב להיות לפני "עד".')

      const mergedOverridesForPdf = (() => {
        const base = (overrides ?? {}) as any
        const out: any = { ...base }
        for (const [k, v] of Object.entries(localCellImages ?? {})) {
          if (!v) continue
          out[k] = { ...(out[k] ?? {}), ...(v as any) }
        }
        for (const [k, v] of Object.entries(localPaddingLogo ?? {})) {
          if (!v) continue
          out[k] = { ...(out[k] ?? {}), ...(v as any) }
        }
        return out
      })()

      const hasAnyPaddingLogoImage =
        Object.keys(mergedOverridesForPdf as any).some(
          (k) =>
            (k === '__all__' || String(k).startsWith('__pad__:')) &&
            Boolean(String((mergedOverridesForPdf as any)?.[k]?.imageDataUrl ?? '').trim()),
        ) || false
      const pdfSettingsBase = hasAnyPaddingLogoImage
        ? ({ ...(brandSettings as any), brandLogoDataUrl: '' } as any)
        : brandSettings
      const pdfSettings = {
        ...(pdfSettingsBase as any),
        pdfPagePreset: 'A4',
        pdfCustomWidthMm: 297,
        pdfCustomHeightMm: 210,
        pdfOrientation: 'landscape',
      } as any

      const monthDocs: string[] = []
      const cursor = new Date(from)
      while (cursor.getTime() <= to.getTime()) {
        monthDocs.push(buildPrintableMonthHtml(cursor, pdfSettings as any, mergedOverridesForPdf as any))
        cursor.setMonth(cursor.getMonth() + 1)
      }
      const html = buildYearRangePdfHtmlFromMonthDocs(monthDocs)
      const blob = await exportPdfBlobFromHtml(html, pdfSettings as any, { multiPage: true })
      downloadBlobFile(`calendar-${fromYm}_to_${toYm}.pdf`, blob)
    } catch (e: any) {
      window.alert(`שגיאה בהורדת PDF: ${String(e?.message ?? e)}`)
    } finally {
      setPdfBusy('idle')
    }
  }

  useEffect(() => {
    if (!cellImgDialogOpen || !cellImgDialogDayKey) return
    const existing = localCellImages[cellImgDialogDayKey]?.imageDataUrl ?? ''
    setCellImgDraftUrl(existing)
  }, [cellImgDialogOpen, cellImgDialogDayKey, localCellImages])

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
        setBaseSettings({ ...DEFAULT_SETTINGS, ...nextSettings })
        setOverrides(normalizeOverridesMapToRecurring(nextOverrides))
      }, 800)
      return () => window.clearTimeout(t)
    } catch {
      // ignore
    }
  }, [])

  // Legacy display-side presets removed from UI (cloud catalog is used instead).

  const shiftMonth = (deltaMonths: -1 | 1) => {
    setViewMode('month')
    setDisplayDate((prev) => {
      const d = new Date(prev)
      const day = d.getDate()
      d.setDate(1)
      d.setMonth(d.getMonth() + deltaMonths)
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
      d.setDate(Math.min(day, daysInMonth))
      return d
    })
  }

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

  const cloudCatalogStorageKey = useMemo(() => {
    try {
      const t = kvTenantId
      const origin = String(window.location.origin || '')
      const path = String(window.location.pathname || '')
      const search = String(window.location.search || '')
      return `hebrew-gregorian-calendar:display:cloud-catalog-selection:v1:${t}:${origin}${path}${search}`
    } catch {
      return 'hebrew-gregorian-calendar:display:cloud-catalog-selection:v1:default'
    }
  }, [tenant, kvTenantId])

  const cloudCatalogPinnedDefaultKey = useMemo(() => {
    try {
      const t = kvTenantId
      const origin = String(window.location.origin || '')
      const path = String(window.location.pathname || '')
      const search = String(window.location.search || '')
      return `hebrew-gregorian-calendar:display:cloud-catalog-default:v1:${t}:${origin}${path}${search}`
    } catch {
      return 'hebrew-gregorian-calendar:display:cloud-catalog-default:v1:default'
    }
  }, [tenant, kvTenantId])

  const cloudSelectionHydratedRef = useRef(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(cloudCatalogStorageKey)
      if (raw) {
        const parsed = JSON.parse(raw) as any
        const colorId = typeof parsed?.colorId === 'string' ? parsed.colorId : null
        const styleId = typeof parsed?.styleId === 'string' ? parsed.styleId : null
        const lock = parsed?.lockLayoutToStylePack === true
        if (colorId) setSelectedCloudColorId(colorId)
        if (styleId) setSelectedCloudStyleId(styleId)
        setLockLayoutToStylePack(lock)
        setCloudSelectionOrigin('local')
        cloudSelectionHydratedRef.current = true
        return
      }

      // If no per-browser selection exists, allow a pinned "default" choice per tenant/workstation.
      // This stays in effect until the user changes it.
      const pinnedRaw = localStorage.getItem(cloudCatalogPinnedDefaultKey)
      if (!pinnedRaw) return
      const pinned = JSON.parse(pinnedRaw) as any
      const pinnedColorId = typeof pinned?.colorId === 'string' ? pinned.colorId : null
      const pinnedStyleId = typeof pinned?.styleId === 'string' ? pinned.styleId : null
      const pinnedLock = pinned?.lockLayoutToStylePack === true
      if (pinnedColorId) setSelectedCloudColorId(pinnedColorId)
      if (pinnedStyleId) setSelectedCloudStyleId(pinnedStyleId)
      setLockLayoutToStylePack(pinnedLock)
      setCloudSelectionOrigin('pinned')
      cloudSelectionHydratedRef.current = true
    } catch {
      // ignore
    }
  }, [cloudCatalogStorageKey, cloudCatalogPinnedDefaultKey])

  // If there is no per-browser saved selection, default to what was published for this tenant.
  // This makes "Publish config" apply immediately on new machines/browsers.
  useEffect(() => {
    if (cloudSelectionHydratedRef.current) return
    const publishedColor = String((baseSettings as any)?.designThemeId ?? 'default') || 'default'
    const publishedStyle = String((baseSettings as any)?.stylePackId ?? 'default') || 'default'
    if (publishedColor !== 'default') setSelectedCloudColorId(publishedColor)
    if (publishedStyle !== 'default') setSelectedCloudStyleId(publishedStyle)
    setCloudSelectionOrigin('published')
  }, [baseSettings])

  useEffect(() => {
    try {
      // Only persist when the user explicitly picked a style/color on this machine.
      // Published defaults should not be written as local overrides (prevents flicker after catalog loads).
      if (cloudSelectionOrigin !== 'local') return
      localStorage.setItem(
        cloudCatalogStorageKey,
        JSON.stringify({
          colorId: selectedCloudColorId,
          styleId: selectedCloudStyleId,
          lockLayoutToStylePack: lockLayoutToStylePack === true,
        }),
      )
    } catch {
      // ignore
    }
  }, [cloudCatalogStorageKey, selectedCloudColorId, selectedCloudStyleId, lockLayoutToStylePack, cloudSelectionOrigin])

  const cloudCatalogHiddenStorageKey = useMemo(() => {
    try {
      const t = kvTenantId
      const origin = String(window.location.origin || '')
      const path = String(window.location.pathname || '')
      const search = String(window.location.search || '')
      return `hebrew-gregorian-calendar:display:cloud-catalog-hidden:v1:${t}:${origin}${path}${search}`
    } catch {
      return 'hebrew-gregorian-calendar:display:cloud-catalog-hidden:v1:default'
    }
  }, [tenant, kvTenantId])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(cloudCatalogHiddenStorageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as any
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return
      const next: Record<string, true> = {}
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof k === 'string' && v === true) next[k] = true
      }
      setHiddenCloudCatalogIds(next)
    } catch {
      // ignore
    }
  }, [cloudCatalogHiddenStorageKey])

  useEffect(() => {
    try {
      localStorage.setItem(cloudCatalogHiddenStorageKey, JSON.stringify(hiddenCloudCatalogIds))
    } catch {
      // ignore
    }
  }, [cloudCatalogHiddenStorageKey, hiddenCloudCatalogIds])

  useEffect(() => {
    const load = async () => {
      try {
        const tenantId = kvTenantId
        const r = await fetch(`/api/get-theme-catalog?tenant=${encodeURIComponent(tenantId)}`, { cache: 'no-store' })
        if (!r.ok) return
        const parsed = (await r.json()) as any
        const items = Array.isArray(parsed?.items) ? parsed.items : []
        const next: CloudThemeCatalogItem[] = items
          .map((it: any) => {
            const id = typeof it?.id === 'string' ? it.id : ''
            const kind = it?.kind === 'style' ? 'style' : it?.kind === 'color' ? 'color' : null
            const nameHe = typeof it?.nameHe === 'string' ? it.nameHe : ''
            const patch = it?.patch && typeof it.patch === 'object' && !Array.isArray(it.patch) ? it.patch : null
            if (!id || !kind || !nameHe || !patch) return null
            return { id, kind, nameHe, patch } as CloudThemeCatalogItem
          })
          .filter(Boolean) as any
        setCloudCatalog(next)
      } catch {
        // ignore
      }
    }
    void load()
    const t = window.setInterval(load, 30_000)
    return () => window.clearInterval(t)
  }, [kvTenantId])

  const visibleCloudCatalog = useMemo(() => {
    const hidden = hiddenCloudCatalogIds || {}
    return cloudCatalog.filter((x) => !hidden[x.id])
  }, [cloudCatalog, hiddenCloudCatalogIds])

  const effectiveSettings = useMemo(() => {
    const current: any = baseSettings as any
    const shouldApplyPickerPatches = cloudSelectionOrigin === 'local' || cloudSelectionOrigin === 'pinned'
    const color = shouldApplyPickerPatches
      ? visibleCloudCatalog.find((x) => x.kind === 'color' && x.id === selectedCloudColorId) ?? null
      : null
    const style = shouldApplyPickerPatches
      ? visibleCloudCatalog.find((x) => x.kind === 'style' && x.id === selectedCloudStyleId) ?? null
      : null

    // Apply style packs as "look" changes without shrinking the calendar.
    // Some packs (e.g. pocket/A5) include page preset + small typography/layout values.
    // Users expect the selector to change theme, not permanently switch to a small format.
    const keepSizingKeys: string[] = [
      // Page / export preset (also influences on-screen sizing in some layouts)
      'pdfPagePreset',
      'pdfOrientation',
      'pdfCustomWidthMm',
      'pdfCustomHeightMm',
      'pdfCustomScalePercent',
      // Global scale / padding
      'calendarLayoutScalePercent',
      'layoutAutoFitToCanvas',
      'layoutFillHeight',
      'layoutCenterVertically',
      'tableOffsetYPx',
      'canvasPaddingPx',
      'canvasPaddingTopPx',
      // Header + grid sizing
      'headerBarHeightPx',
      'headerBarMarginBottomPx',
      'headerHebMonthFontPx',
      'headerGregMonthFontPx',
      'gridWeekdayHeaderHeightPx',
      'gridWeekdayHeaderFontPx',
      // Cell typography sizing
      'fontSizePx',
      'gregDayFontPx',
      'hebDayFontPx',
      'eventTitleFontPx',
      'shabbatTimesFontPx',
      'pdfExportCellHeightPx',
    ]

    const merged: any = { ...current, ...(style?.patch ?? {}), ...(color?.patch ?? {}) }
    if (!lockLayoutToStylePack) {
      for (const k of keepSizingKeys) {
        if (current[k] !== undefined) merged[k] = current[k]
      }
    }
    merged.designThemeId = selectedCloudColorId || 'default'
    merged.stylePackId = selectedCloudStyleId || 'default'
    return merged
  }, [
    baseSettings,
    visibleCloudCatalog,
    selectedCloudColorId,
    selectedCloudStyleId,
    lockLayoutToStylePack,
    cloudSelectionOrigin,
  ])

  // Use effective settings everywhere below (render-only; base settings remain from publish/import).
  const settings = effectiveSettings as any

  /** Studio `settingsForA4PdfExport`: fixed A4 landscape; margins/html2canvas scale still follow `settings`. */
  const settingsForStudioLikePdfExport = useMemo(
    () =>
      ({
        ...(settings as any),
        pdfPagePreset: 'A4',
        pdfCustomWidthMm: 297,
        pdfCustomHeightMm: 210,
        pdfOrientation: 'landscape',
      }) as any,
    [settings],
  )

  useEffect(() => {
    if (!debug) return
    const measure = () => {
      try {
        const gEl = document.querySelector('[data-debug-greg-day="1"]') as HTMLElement | null
        const hEl = document.querySelector('[data-debug-heb-day="1"]') as HTMLElement | null
        const gregFontPx = gEl ? window.getComputedStyle(gEl).fontSize : undefined
        const hebFontPx = hEl ? window.getComputedStyle(hEl).fontSize : undefined
        setDebugComputed({ gregFontPx, hebFontPx })
      } catch {
        // ignore
      }
    }
    // Measure after layout settles.
    const t = window.setTimeout(measure, 80)
    return () => window.clearTimeout(t)
  }, [debug, settings, viewMode, displayDate, selectedCloudColorId, selectedCloudStyleId, lockLayoutToStylePack])

  const debugLayoutProbe = useMemo(() => {
    if (!debug) return null
    try {
      const layoutAutoFitToCanvas = Boolean((settings as any).layoutAutoFitToCanvas)
      const allowAutoFit = Boolean(isProdMode && layoutAutoFitToCanvas)
      const zoomPct = resolveCalendarLayoutZoomPercent(settings as any)
      const combined =
        ((((allowAutoFit ? autoFitScale : 1) * (zoomPct / 100)) as number) || 1) as number
      const safeScale = isNarrow ? 1 : Math.max(0.01, Number.isFinite(combined) ? combined : 1)
      return {
        build: typeof __APP_BUILD__ === 'string' ? __APP_BUILD__ : 'unknown',
        displayMode,
        tenant: kvTenantId,
        layoutAutoFitToCanvas,
        allowAutoFit,
        autoFitScale,
        zoomPercent: zoomPct,
        combinedScale: combined,
        safeScale,
        isNarrowViewport: isNarrow,
        monthCellPx,
      }
    } catch {
      return null
    }
  }, [
    debug,
    settings,
    isProdMode,
    autoFitScale,
    isNarrow,
    displayMode,
    kvTenantId,
    monthCellPx,
  ])

  const brandSettings = useMemo(() => {
    const base = settings as any
    // Generic Display (no tenant / `?tenant=default`) must not show bank branding from published
    // defaults — only stations opened with `?tenant=<id>` (the KV slot you publish to) get logo/name.
    if (kvTenantId === 'default') {
      return {
        ...base,
        brandName: '',
        brandLogoDataUrl: '',
        departmentName: '',
      } as any
    }
    if (!tenant) return base
    return {
      ...base,
      brandName: tenant.brandName,
      brandLogoDataUrl: tenant.brandLogoUrl ?? '',
      brandAccentColor: tenant.brandAccentColor,
      departmentName: tenant.departmentName ?? base.departmentName,
      departmentColor: tenant.brandAccentColor,
    } as any
  }, [settings, tenant, kvTenantId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(DISPLAY_PDF_EXPORT_PATH_LS_KEY, pdfExportPath)
    } catch {
      // ignore
    }
  }, [pdfExportPath])

  useEffect(() => {
    const applyRemote = (parsed: any) => {
      void ensureTransferFontsLoaded(parsed?.fonts)
      const parsedViewDate = parsed && typeof parsed.viewDate === 'string' ? parsed.viewDate : null
      const nextSettings =
        parsed && parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : parsed
      const nextOverrides =
        parsed && parsed.overrides && typeof parsed.overrides === 'object' ? parsed.overrides : {}

      const wasApplied = didApplyRemoteRef.current
      if (debug) computeOverridesInfo(nextOverrides, 'remote')
      setBaseSettings({ ...DEFAULT_SETTINGS, ...nextSettings })
      setOverrides(normalizeOverridesMapToRecurring(nextOverrides))
      didApplyRemoteRef.current = true

      if (debug) {
        try {
          const s =
            nextSettings && typeof nextSettings === 'object' && !Array.isArray(nextSettings) ? (nextSettings as any) : {}
          setLastRemoteInfo({
            source: typeof (parsed as any)?.source === 'string' ? String((parsed as any).source) : undefined,
            settingsKeys: Object.keys(s).length,
            gregDayFontPx: Number(s.gregDayFontPx) || 0,
            headerBox2OffsetXPx: Number(s.headerBox2OffsetXPx) || 0,
            publishedAt: typeof (parsed as any)?.publishedAt === 'string' ? String((parsed as any).publishedAt) : null,
          })
        } catch {
          // ignore
        }
      }

      // Keep Display's cloud style/color selectors aligned with the published Studio selection.
      // Otherwise the top bar/header can look "different" (localStorage selection overriding publish).
      try {
        const publishedColorId =
          typeof (nextSettings as any)?.designThemeId === 'string' ? String((nextSettings as any).designThemeId) : ''
        const publishedStyleId =
          typeof (nextSettings as any)?.stylePackId === 'string' ? String((nextSettings as any).stylePackId) : ''

        // In prod (bank display), "Publish" must win so all stations (including the main display)
        // reflect the latest Studio config even if a browser previously saved a local picker choice.
        if (isProdMode && (cloudSelectionOrigin === 'local' || cloudSelectionOrigin === 'pinned')) {
          if (publishedColorId) setSelectedCloudColorId(publishedColorId)
          if (publishedStyleId) setSelectedCloudStyleId(publishedStyleId)
          setCloudSelectionOrigin('published')
          cloudSelectionHydratedRef.current = false
          try {
            localStorage.removeItem(cloudCatalogStorageKey)
            localStorage.removeItem(cloudCatalogPinnedDefaultKey)
          } catch {
            // ignore
          }
        } else if (!cloudSelectionHydratedRef.current) {
          // Published settings should only become the default when there is no local selection.
          if (publishedColorId) setSelectedCloudColorId(publishedColorId)
          if (publishedStyleId) setSelectedCloudStyleId(publishedStyleId)
        }
      } catch {
        // ignore
      }

      const publishedAt = parsed && typeof parsed.publishedAt === 'string' ? parsed.publishedAt : null
      if (publishedAt) lastPublishedAtRef.current = publishedAt

      // Bank behavior: on first load, always start on "today" (not the published viewDate),
      // so each clerk opening in the morning lands on the current month/day.
      if (isProdMode) {
        if (!wasApplied) setDisplayDate(new Date())
        return
      }

      if (parsedViewDate) {
        const d = new Date(parsedViewDate)
        if (!Number.isNaN(d.getTime())) setDisplayDate(d)
      }
    }

    const pullOnce = async () => {
      try {
        const tenantId = kvTenantId
        const sep = remoteUrl.includes('?') ? '&' : '?'
        const url = `${remoteUrl}${sep}tenant=${encodeURIComponent(tenantId)}`
        const r = await fetch(url, { cache: 'no-store' })
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
  }, [remoteUrl, isProdMode, kvTenantId])

  useEffect(() => {
    if (viewMode !== 'month') return
    if (isNarrow) {
      setMonthCellPx(null)
      return
    }
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
  }, [viewMode, isNarrow])

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
      const ch = Math.max(1, container.clientHeight)
      const naturalW = Math.max(
        1,
        content.clientWidth || (content as any).offsetWidth || (content as any).scrollWidth,
      )
      const naturalH = Math.max(
        1,
        content.clientHeight || (content as any).offsetHeight || (content as any).scrollHeight,
      )

      // Screen behavior:
      // - At zoom 100%, prefer full "dashboard" view: fit BOTH width and height (avoid scrolling for 6th row).
      // - Otherwise, keep the legacy behavior: fit to width only.
      const zoomPct = resolveCalendarLayoutZoomPercent(settings as any)
      const fitBoth = viewMode === 'month' && !isNarrow && zoomPct === 100

      const next = fitBoth ? Math.min(cw / naturalW, ch / naturalH) : cw / naturalW
      if (!Number.isFinite(next) || next <= 0) return
      setAutoFitScale((prev) => (Math.abs(prev - next) < 0.01 ? prev : next))
    }

    compute()
    const ro = new ResizeObserver(() => compute())
    ro.observe(container)
    ro.observe(content)
    window.addEventListener('resize', compute)
    return () => {
      window.removeEventListener('resize', compute)
      ro.disconnect()
    }
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
    viewMode,
    isNarrow,
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
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    let alive = true

    const getSnoozeUntil = () => {
      try {
        const raw = localStorage.getItem(updateSnoozeStorageKey)
        const n = Number(raw)
        return Number.isFinite(n) ? n : 0
      } catch {
        return 0
      }
    }

    const fetchVersionString = async (): Promise<string | null> => {
      try {
        const r = await fetch('/api/version', { cache: 'no-store' })
        if (!r.ok) return null
        const ct = String(r.headers.get('content-type') ?? '')
        if (ct.includes('application/json')) {
          const j = (await r.json()) as any
          const commit = typeof j?.commit === 'string' ? j.commit : null
          const ver = typeof j?.version === 'string' ? j.version : null
          const v = commit || ver || (typeof j?.sha === 'string' ? j.sha : null) || JSON.stringify(j)
          return typeof v === 'string' && v.trim() ? v.trim() : null
        }
        const txt = (await r.text()) ?? ''
        return String(txt).trim() || null
      } catch {
        return null
      }
    }

    const check = async () => {
      const v = await fetchVersionString()
      if (!alive || !v) return
      if (!currentVersionRef.current) {
        currentVersionRef.current = v
        return
      }
      if (v === currentVersionRef.current) return

      setLatestVersion(v)
      const snoozeUntil = getSnoozeUntil()
      if (Date.now() < snoozeUntil) return
      setUpdatePromptOpen(true)
    }

    void check()
    const t = window.setInterval(() => void check(), 60_000)
    return () => {
      alive = false
      window.clearInterval(t)
    }
  }, [updateSnoozeStorageKey])

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth || 0, h: window.innerHeight || 0 })
    onResize()
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize as any)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize as any)
    }
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

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    try {
      document.addEventListener('fullscreenchange', onFsChange)
      onFsChange()
      return () => document.removeEventListener('fullscreenchange', onFsChange)
    } catch {
      return
    }
  }, [])

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        try {
          await (screen as any)?.orientation?.unlock?.()
        } catch {
          // ignore
        }
        await document.exitFullscreen()
      } else {
        const target = fullscreenTargetRef.current ?? document.documentElement
        await (target as any).requestFullscreen()
        // Best-effort: some mobile browsers allow orientation lock only in fullscreen
        try {
          await (screen as any)?.orientation?.lock?.('landscape')
        } catch {
          // ignore
        }
      }
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
      if (debug) computeOverridesInfo(nextOverrides, 'manual-import')
      setBaseSettings(merged)
      setOverrides(normalizeOverridesMapToRecurring(nextOverrides))

      // Ensure imported settings render 1:1 by disabling any local cloud picker overlays.
      // Otherwise a previously-selected cloud color/style can override large parts of the imported look.
      try {
        setSelectedCloudColorId('default')
        setSelectedCloudStyleId('default')
        setLockLayoutToStylePack(false)
        try {
          localStorage.setItem(
            cloudCatalogStorageKey,
            JSON.stringify({ colorId: 'default', styleId: 'default', lockLayoutToStylePack: false }),
          )
          localStorage.removeItem(cloudCatalogPinnedDefaultKey)
        } catch {
          // ignore
        }
        cloudSelectionHydratedRef.current = true
      } catch {
        // ignore
      }
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
      const sep = remoteUrl.includes('?') ? '&' : '?'
      const url = `${remoteUrl}${sep}tenant=${encodeURIComponent(kvTenantId)}`
      const r = await fetch(url, { cache: 'no-store' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const parsed = await r.json()
      const parsedViewDate = parsed && typeof parsed.viewDate === 'string' ? parsed.viewDate : null
      const nextSettings =
        parsed && parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : parsed
      const nextOverrides =
        parsed && parsed.overrides && typeof parsed.overrides === 'object' ? parsed.overrides : {}
      const merged = { ...DEFAULT_SETTINGS, ...nextSettings }
      if (debug) computeOverridesInfo(nextOverrides, 'pull-from-studio')
      setBaseSettings(merged)
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

  /**
   * Clears workstation-local layout/style overrides and reloads published settings from the API.
   * "נעילת מבנה": when ON, cloud style-pack patches apply fully (incl. typography/sizing); when OFF,
   * sizing keys from the published base stay and only non-sizing theme fields from the pack apply.
   */
  const releaseLayoutToPublishedDefaults = async () => {
    const ok = window.confirm(
      'שחרור מבנה ימחק מהדפדפן הזה:\n' +
        '• ייבוא JSON מקומי\n' +
        '• בחירת ערכת צבע/סגנון מהענן ונעילת מבנה\n' +
        '• תמונות מקומיות בתאים / משבצות / לוגו ריפוד\n' +
        '• הסתרות בקטלוג הענן\n\n' +
        'הלוח ייטען מחדש מההגדרות שפורסמו מהסטודיו (אם השרת זמין).\n' +
        'תזכורות יומיות לא יימחקו.\n\n' +
        'להמשיך?',
    )
    if (!ok) return

    try {
      localStorage.removeItem('hebrew-gregorian-calendar:display:settings:v1')
      localStorage.removeItem(cloudCatalogStorageKey)
      localStorage.removeItem(cloudCatalogPinnedDefaultKey)
      localStorage.removeItem(cloudCatalogHiddenStorageKey)
      localStorage.removeItem(localCellImagesStorageKey)
      localStorage.removeItem(localSlotImagesStorageKey)
      localStorage.removeItem(localPaddingLogoStorageKey)
    } catch {
      // ignore
    }

    setLocalCellImages({})
    setLocalSlotImages({})
    setLocalPaddingLogo({})
    setHiddenCloudCatalogIds({})
    setLockLayoutToStylePack(false)
    setCloudSelectionOrigin('published')
    cloudSelectionHydratedRef.current = true

    try {
      const sep = remoteUrl.includes('?') ? '&' : '?'
      const url = `${remoteUrl}${sep}tenant=${encodeURIComponent(kvTenantId)}`
      const r = await fetch(url, { cache: 'no-store' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const parsed = await r.json()
      void ensureTransferFontsLoaded(parsed?.fonts)
      const nextSettings =
        parsed && parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : parsed
      const nextOverrides =
        parsed && parsed.overrides && typeof parsed.overrides === 'object' ? parsed.overrides : {}
      const merged = { ...DEFAULT_SETTINGS, ...nextSettings }
      if (debug) computeOverridesInfo(nextOverrides, 'release-layout')
      setBaseSettings(merged)
      setOverrides(normalizeOverridesMapToRecurring(nextOverrides))
      didApplyRemoteRef.current = true

      const publishedColorId = String((nextSettings as any)?.designThemeId ?? 'default') || 'default'
      const publishedStyleId = String((nextSettings as any)?.stylePackId ?? 'default') || 'default'
      setSelectedCloudColorId(publishedColorId)
      setSelectedCloudStyleId(publishedStyleId)
    } catch {
      setBaseSettings({ ...DEFAULT_SETTINGS })
      setOverrides(normalizeOverridesMapToRecurring({}))
      setSelectedCloudColorId('default')
      setSelectedCloudStyleId('default')
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
      className="display-app-root"
      style={{
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
      {debug && debugLayoutProbe ? (
        <div
          className="display-debug-chip"
          dir="ltr"
          style={{
            position: 'fixed',
            bottom: 10,
            insetInlineEnd: 10,
            zIndex: 99999,
            maxWidth: 'min(96vw, 440px)',
            padding: '8px 10px',
            borderRadius: 10,
            fontSize: 11,
            lineHeight: 1.35,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            textAlign: 'left',
            background: 'rgba(15,23,42,0.92)',
            color: '#e2e8f0',
            border: '1px solid rgba(148,163,184,0.35)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 4 }}>
            Display debug (?debug=1) · git {debugLayoutProbe.build}
          </div>
          <div style={{ opacity: 0.95 }}>
            tenant={debugLayoutProbe.tenant} · mode={debugLayoutProbe.displayMode}
            {debugLayoutProbe.isNarrowViewport ? ' · narrow' : ''}
          </div>
          <div style={{ marginTop: 4 }}>
            autoFit setting={debugLayoutProbe.layoutAutoFitToCanvas ? 'on' : 'off'} · allow=
            {debugLayoutProbe.allowAutoFit ? 'yes' : 'no'} · autoFitScale=
            {Number(debugLayoutProbe.autoFitScale.toFixed(4))}
          </div>
          <div style={{ marginTop: 2 }}>
            zoom%={debugLayoutProbe.zoomPercent} · combined={Number(debugLayoutProbe.combinedScale.toFixed(4))} · safe=
            {Number(debugLayoutProbe.safeScale.toFixed(4))}
            {typeof debugLayoutProbe.monthCellPx === 'number' ? ` · cellPx=${debugLayoutProbe.monthCellPx}` : ''}
          </div>
          {debugComputed ? (
            <div style={{ marginTop: 4, opacity: 0.92 }}>
              measured greg={debugComputed.gregFontPx ?? '—'} heb={debugComputed.hebFontPx ?? '—'}
            </div>
          ) : null}
          {debugOverridesInfo ? (
            <div style={{ marginTop: 4, opacity: 0.88, wordBreak: 'break-all' }}>
              overrides keys={debugOverridesInfo.keys} images={debugOverridesInfo.withImages} maxLen=
              {debugOverridesInfo.maxImageLen} ({debugOverridesInfo.source})
            </div>
          ) : null}
        </div>
      ) : null}
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
            @media (max-width: 640px) {
              .display-topbar { padding-inline: 10px !important; }
              .display-topbar .chip { font-size: 13px !important; padding: 7px 9px !important; border-radius: 10px !important; }
              /* On workstations with low resolution / zoom, keep the full toolbar visible by wrapping instead of horizontal scrolling. */
              .display-topbar-row { flex-wrap: wrap !important; overflow-x: visible !important; justify-content: center !important; width: 100% !important; }
              .display-topbar-clock { position: static !important; min-width: 0 !important; }
            }
          `}</style>
        )
      })()}
      {null}

      <main
        style={{
          padding: isFullscreen ? 0 : 16,
          paddingRight:
            isFullscreen
              ? 0
              : // Reserve space for the fixed right controls column.
                16 + (isNarrow ? 0 : 280 + 12),
        }}
      >
        {yearRangeOpen ? (
          <div
            role="dialog"
            aria-modal="true"
            dir="rtl"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 95,
              background: 'rgba(2,6,23,0.55)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setYearRangeOpen(false)
            }}
          >
            <div
              style={{
                width: 'min(560px, 96vw)',
                borderRadius: 18,
                border: '1px solid rgba(148,163,184,0.28)',
                background: 'rgba(255,255,255,0.96)',
                boxShadow: '0 18px 48px rgba(2,6,23,0.26)',
                padding: 14,
                boxSizing: 'border-box',
                color: '#0f172a',
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ fontWeight: 950, fontSize: 14 }}>בחירת טווח ייצוא שנה PDF</div>
                <button
                  type="button"
                  className="chip"
                  style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 900 }}
                  onClick={() => setYearRangeOpen(false)}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
                <button
                  type="button"
                  className={['chip', yearRangeTab === 'heb' ? 'chip-active' : ''].join(' ')}
                  style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 900 }}
                  onClick={() => setYearRangeTab('heb')}
                >
                  עברי
                </button>
                <button
                  type="button"
                  className={['chip', yearRangeTab === 'greg' ? 'chip-active' : ''].join(' ')}
                  style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 900 }}
                  onClick={() => setYearRangeTab('greg')}
                >
                  לועזי
                </button>
              </div>

              {(() => {
                const hebMonthsNonLeap = ['תשרי', 'חשוון', 'כסלו', 'טבת', 'שבט', 'אדר', 'ניסן', 'אייר', 'סיוון', 'תמוז', 'אב', 'אלול']
                const hebMonthsLeap = ['תשרי', 'חשוון', 'כסלו', 'טבת', 'שבט', 'אדר א׳', 'אדר ב׳', 'ניסן', 'אייר', 'סיוון', 'תמוז', 'אב', 'אלול']
                const isLeapHebYear = (y: number) => ((7 * y + 1) % 19) < 7
                const fromMonths = isLeapHebYear(yearRangeHebFromYear) ? hebMonthsLeap : hebMonthsNonLeap
                const toMonths = isLeapHebYear(yearRangeHebToYear) ? hebMonthsLeap : hebMonthsNonLeap

                if (yearRangeTab === 'greg') {
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                      <label style={{ display: 'grid', gap: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>מ־</div>
                        <input
                          type="month"
                          value={yearRangeFromYm}
                          onChange={(e) => setYearRangeFromYm(String(e.target.value || ''))}
                          className="chip"
                          style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 800, cursor: 'pointer' }}
                        />
                      </label>
                      <label style={{ display: 'grid', gap: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>עד</div>
                        <input
                          type="month"
                          value={yearRangeToYm}
                          onChange={(e) => setYearRangeToYm(String(e.target.value || ''))}
                          className="chip"
                          style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 800, cursor: 'pointer' }}
                        />
                      </label>
                    </div>
                  )
                }

                return (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <label style={{ display: 'grid', gap: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>משנה עברית (מספר)</div>
                        <input
                          type="number"
                          value={String(yearRangeHebFromYear)}
                          onChange={(e) => setYearRangeHebFromYear(Number(e.target.value || 0) || yearRangeHebFromYear)}
                          className="chip"
                          style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 800, direction: 'ltr' }}
                        />
                      </label>
                      <label style={{ display: 'grid', gap: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>מחודש עברי</div>
                        <select
                          value={yearRangeHebFromMonth}
                          onChange={(e) => setYearRangeHebFromMonth(String(e.target.value || ''))}
                          className="chip"
                          style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 800, cursor: 'pointer' }}
                        >
                          {fromMonths.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div style={{ height: 10 }} />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <label style={{ display: 'grid', gap: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>עד שנה עברית (מספר)</div>
                        <input
                          type="number"
                          value={String(yearRangeHebToYear)}
                          onChange={(e) => setYearRangeHebToYear(Number(e.target.value || 0) || yearRangeHebToYear)}
                          className="chip"
                          style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 800, direction: 'ltr' }}
                        />
                      </label>
                      <label style={{ display: 'grid', gap: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>עד חודש עברי</div>
                        <select
                          value={yearRangeHebToMonth}
                          onChange={(e) => setYearRangeHebToMonth(String(e.target.value || ''))}
                          className="chip"
                          style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 800, cursor: 'pointer' }}
                        >
                          {toMonths.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                )
              })()}

              <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="chip"
                  style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 900 }}
                  onClick={() => setYearRangeOpen(false)}
                >
                  ביטול
                </button>
                <button
                  type="button"
                  className="chip chip-active"
                  style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 950 }}
                  disabled={pdfBusy !== 'idle'}
                  onClick={async () => {
                    setYearRangeOpen(false)
                    if (yearRangeTab === 'greg') {
                      await downloadYearPdfRange(yearRangeFromYm, yearRangeToYm)
                      return
                    }
                    const hebMonthsNonLeap = [
                      'תשרי',
                      'חשוון',
                      'כסלו',
                      'טבת',
                      'שבט',
                      'אדר',
                      'ניסן',
                      'אייר',
                      'סיוון',
                      'תמוז',
                      'אב',
                      'אלול',
                    ]
                    const hebMonthsLeap = [
                      'תשרי',
                      'חשוון',
                      'כסלו',
                      'טבת',
                      'שבט',
                      'אדר א׳',
                      'אדר ב׳',
                      'ניסן',
                      'אייר',
                      'סיוון',
                      'תמוז',
                      'אב',
                      'אלול',
                    ]
                    const isLeapHebrewYearInline = (y: number) => ((7 * y + 1) % 19) < 7

                    if (yearRangeHebFromYear > yearRangeHebToYear) {
                      window.alert('שנה עברית ב־“מ־” חייבת להיות קטנה או שווה לשנה ב־“עד”.')
                      return
                    }

                    if (yearRangeHebFromYear === yearRangeHebToYear) {
                      const order = isLeapHebrewYearInline(yearRangeHebFromYear) ? hebMonthsLeap : hebMonthsNonLeap
                      const fromIdx = order.indexOf(yearRangeHebFromMonth)
                      const toIdx = order.indexOf(yearRangeHebToMonth)
                      if (fromIdx === -1 || toIdx === -1) {
                        window.alert('נבחר חודש עברי לא נתמך בטווח נוכחי. נסה שוב.')
                        return
                      }
                      if (fromIdx > toIdx) {
                        window.alert('באותה שנה עברית: חודש “מ־” חייב להיות לפני או שווה לחודש “עד” (למשל מתשרי ועד אלול).')
                        return
                      }
                    }

                    const fromYm = resolveGregorianYmFromHebrew(yearRangeHebFromYear, yearRangeHebFromMonth)
                    const toYm = resolveGregorianYmFromHebrew(yearRangeHebToYear, yearRangeHebToMonth)
                    if (!fromYm || !toYm) {
                      window.alert('לא הצלחתי להמיר את הטווח העברי ללועזי. נסה טווח אחר.')
                      return
                    }

                    await downloadYearPdfRange(fromYm, toYm)
                  }}
                >
                  {pdfBusy === 'year' ? 'מכין…' : 'הורד'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {updatePromptOpen ? (
          <div
            role="dialog"
            aria-modal="false"
            dir="rtl"
            style={{
              position: 'fixed',
              top: 12,
              left: 12,
              right: 12,
              zIndex: 90,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '10px 12px',
              borderRadius: 14,
              border: '1px solid rgba(148,163,184,0.35)',
              background: 'rgba(255,255,255,0.92)',
              boxShadow: '0 12px 28px rgba(2,6,23,0.14)',
              color: '#0f172a',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 14 }}>יצא עדכון למערכת</div>
              <div
                style={{
                  fontSize: 12,
                  opacity: 0.75,
                  marginTop: 2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                מומלץ לרענן כדי לקבל את השינויים{latestVersion ? ` (${latestVersion.slice(0, 12)})` : ''}.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '0 0 auto' }}>
              <button
                type="button"
                className="chip"
                onClick={() => window.location.reload()}
                style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 900 }}
                title="רענן"
              >
                רענן עכשיו
              </button>
              <button
                type="button"
                className="chip"
                onClick={() => {
                  try {
                    localStorage.setItem(updateSnoozeStorageKey, String(Date.now() + 10 * 60_000))
                  } catch {
                    // ignore
                  }
                  setUpdatePromptOpen(false)
                }}
                style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 800, opacity: 0.9 }}
                title="לא עכשיו"
              >
                לא עכשיו
              </button>
            </div>
          </div>
        ) : null}

        {!isFullscreen ? (
          <>
            {/* Right-side controls column (one category button + sub-actions). */}
            <aside
              className="display-fixed-sidebar"
              dir="rtl"
              style={{
                position: 'fixed',
                top: 12,
                right: 12,
                width: 280,
                maxHeight: 'calc(100vh - 24px)',
                borderRadius: 14,
                border: '1px solid rgba(148,163,184,0.25)',
                background: 'rgba(255,255,255,0.84)',
                color: '#0f172a',
                padding: 10,
                boxSizing: 'border-box',
                overflow: 'auto',
                zIndex: 8,
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
              }}
            >
              <details open>
                <summary className="chip" style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 900, cursor: 'pointer', listStyle: 'none' }}>
                  הורדות
                </summary>
                <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.85, lineHeight: 1.35 }}>
                    ייצוא חודש PDF
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
                    <input
                      type="radio"
                      name="display-pdf-month-path"
                      checked={pdfExportPath === 'server'}
                      onChange={() => setPdfExportPath('server')}
                    />
                    שרת Puppeteer — מדויק ביותר (ברירת מחדל)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
                    <input
                      type="radio"
                      name="display-pdf-month-path"
                      checked={pdfExportPath === 'capture'}
                      onChange={() => setPdfExportPath('capture')}
                    />
                    צילום מסך (html2canvas)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
                    <input
                      type="radio"
                      name="display-pdf-month-path"
                      checked={pdfExportPath === 'printable'}
                      onChange={() => setPdfExportPath('printable')}
                    />
                    תבנית מודפסת (גיבוי)
                  </label>
                  <button
                    type="button"
                    onClick={downloadMonthPdf}
                    className="chip"
                    style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 900 }}
                    disabled={pdfBusy !== 'idle'}
                    title={
                      pdfExportPath === 'capture'
                        ? 'הורד חודש PDF — צילום מסך A4 כמו בסטודיו'
                        : 'הורד חודש PDF — HTML מודפס (גיבוי)'
                    }
                  >
                    {pdfBusy === 'month' ? 'מכין…' : 'הורד חודש'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const y = displayDate.getFullYear()
                      setYearRangeFromYm(`${y}-01`)
                      setYearRangeToYm(`${y}-12`)
                      setYearRangeTab('heb')
                      setYearRangeOpen(true)
                    }}
                    className="chip"
                    style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 900 }}
                    disabled={pdfBusy !== 'idle'}
                    title="הורד שנה PDF"
                  >
                    {pdfBusy === 'year' ? 'מכין…' : 'הורד שנה'}
                  </button>
                  <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.72, lineHeight: 1.35 }}>
                    שנה וטווח: PDF מהתבנית המודפסת, עמוד A4 לרוחב (כמו בסטודיו).
                  </div>
                </div>
              </details>

              <div style={{ height: 10 }} />

              <details open>
                <summary className="chip" style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 900, cursor: 'pointer', listStyle: 'none' }}>
                  תצוגה
                </summary>
                <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                  <button type="button" onClick={toggleFullscreen} className="chip" style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 900 }}>
                    מסך מלא
                  </button>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setViewMode('day')}
                      className={['chip', viewMode === 'day' ? 'chip-active' : ''].join(' ')}
                      style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 900 }}
                    >
                      יום
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('month')}
                      className={['chip', viewMode === 'month' ? 'chip-active' : ''].join(' ')}
                      style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 900 }}
                    >
                      חודש
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button type="button" onClick={() => shiftMonth(-1)} className="chip" style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 800 }}>
                      חודש ◀
                    </button>
                    <button type="button" onClick={() => shiftMonth(1)} className="chip" style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 800 }}>
                      ▶ חודש
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAccessibilityLowBrightnessMode((v) => !v)}
                    className={[
                      'chip',
                      accessibilityLowBrightnessMode ? 'chip-active' : '',
                      accessibilityLowBrightnessMode ? 'display-acc-toggle-on' : '',
                    ].join(' ')}
                    style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 900 }}
                    aria-pressed={accessibilityLowBrightnessMode}
                    aria-label={
                      accessibilityLowBrightnessMode
                        ? 'כבה מצב ניגודיות גבוהה לרגישות לאור — תצוגת מסך בלבד, ללא שינוי ב־PDF'
                        : 'הפעל מצב ניגודיות גבוהה לרגישות לאור — תצוגת מסך בלבד, ללא שינוי ב־PDF'
                    }
                    title="מצב ניגישות Solarized כהה (מסך בלבד; PDF נשאר לבן להדפסה). קיצור מקלדת: Alt+A"
                  >
                    ניגודיות
                  </button>
                </div>
              </details>

              <div style={{ height: 10 }} />

              <details>
                <summary className="chip" style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 900, cursor: 'pointer', listStyle: 'none' }}>
                  סגנון (ענן)
                </summary>
                <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                  <select
                    value={selectedCloudColorId}
                    onChange={(e) => {
                      setCloudSelectionOrigin('local')
                      setSelectedCloudColorId(String(e.target.value || 'default'))
                    }}
                    className="chip"
                    style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 800, cursor: 'pointer', width: '100%', maxWidth: '100%' }}
                    title="ערכת צבע (ענן)"
                  >
                    <option value="default">ערכת צבע: ברירת מחדל</option>
                    {visibleCloudCatalog
                      .filter((x) => x.kind === 'color')
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {`ערכת צבע: ${x.nameHe}`}
                        </option>
                      ))}
                  </select>

                  <select
                    value={selectedCloudStyleId}
                    onChange={(e) => {
                      setCloudSelectionOrigin('local')
                      setSelectedCloudStyleId(String(e.target.value || 'default'))
                    }}
                    className="chip"
                    style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 800, cursor: 'pointer', width: '100%', maxWidth: '100%' }}
                    title="ערכת סגנון (ענן)"
                  >
                    <option value="default">ערכת סגנון: ברירת מחדל</option>
                    {visibleCloudCatalog
                      .filter((x) => x.kind === 'style')
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {`ערכת סגנון: ${x.nameHe}`}
                        </option>
                      ))}
                  </select>

                  <button
                    type="button"
                    className={['chip', lockLayoutToStylePack ? 'chip-active' : ''].join(' ')}
                    onClick={() => {
                      setCloudSelectionOrigin('local')
                      if (!lockLayoutToStylePack) {
                        const ok = window.confirm(
                          'נעילת מבנה מפעילה את ערכת הסגנון מהענן במלואה — כולל גדלי טקסט, רשת וטיפוגרפיה (לא רק צבעים).\n\n' +
                            'בלי נעילה, הגדלים נשמרים מההגדרות שפורסמו מהסטודיו.\n\nלהפעיל נעילת מבנה?',
                        )
                        if (!ok) return
                        setLockLayoutToStylePack(true)
                        window.alert('המבנה ננעל. ערכת הסגנון מהענן חלה כעת גם על מידות וטיפוגרפיה.')
                      } else {
                        setLockLayoutToStylePack(false)
                      }
                    }}
                    style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 900 }}
                    title={
                      lockLayoutToStylePack
                        ? 'דלוק: ערכת הסגנון מהענן משנה גם גדלים וטיפוגרפיה. כבוי: נשמרים הגדלים מהפרסום.'
                        : 'כבוי: גדלי טקסט ורשת נשמרים מההגדרות שפורסמו; ערכת הצבע/סגנון משנה בעיקר מראה.'
                    }
                  >
                    נעילת מבנה
                  </button>

                  <button
                    type="button"
                    onClick={() => void releaseLayoutToPublishedDefaults()}
                    className="chip"
                    style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 900 }}
                    title="מחיקת כל העקיפים המקומיים וטעינה מחדש מהסטודיו המפורסם"
                  >
                    שחרור מבנה
                  </button>

                  <button
                    type="button"
                    onClick={() => setManageCatalogOpen(true)}
                    className="chip"
                    style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 900 }}
                  >
                    ניהול ערכות
                  </button>

                  <button
                    type="button"
                    onClick={() => setImportOpen(true)}
                    className="chip"
                    style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 900 }}
                  >
                    ייבוא JSON
                  </button>
                </div>
              </details>
            </aside>
          </>
        ) : null}

        {viewMode === 'day' ? (
          <ErrorBoundary>
            {(() => {
              const key = formatYmdJerusalem(displayDate)
              const useTA = (settings as any).zmanimCity === 'TelAviv'
              const byDay = useTA ? dayEventsTA : dayEventsJer
              const ev = byDay.get(key)
              const ovr = resolveDayTextOverride(overrides, key)

              const s = settings as any
              const gregTC =
                String(s.gregDayTextColor ?? DEFAULT_SETTINGS.gregDayTextColor).trim() ||
                DEFAULT_SETTINGS.gregDayTextColor
              const hebTC =
                String(s.hebDayTextColor ?? DEFAULT_SETTINGS.hebDayTextColor).trim() ||
                DEFAULT_SETTINGS.hebDayTextColor
              const eventTC =
                String(s.eventTitleTextColor ?? DEFAULT_SETTINGS.eventTitleTextColor).trim() ||
                DEFAULT_SETTINGS.eventTitleTextColor
              const zmanTC =
                String(s.shabbatTimesTextColor ?? DEFAULT_SETTINGS.shabbatTimesTextColor).trim() ||
                DEFAULT_SETTINGS.shabbatTimesTextColor
              const baseFont = s.fontFamily ?? DEFAULT_SETTINGS.fontFamily
              const byTarget = s.fontFamilyByTarget ?? {}
              const fontHeader = byTarget.calendarHeader ?? baseFont
              const fontDates = byTarget.cellDates ?? baseFont
              const fontTimes = byTarget.cellTimes ?? baseFont
              const fontEvents = byTarget.cellEvents ?? baseFont

              const scale = 2.35
              const gregPx = Math.max(22, Math.round((Number(s.gregDayFontPx) || 8) * scale))
              const hebPx = Math.max(26, Math.round((Number(s.hebDayFontPx) || 7) * scale))
              const eventPx = Math.max(17, Math.round((Number(s.eventTitleFontPx) || 6) * scale))
              const zmanPx = Math.max(15, Math.round((Number(s.shabbatTimesFontPx) || 6) * scale))

              const isShabbat = displayDate.getDay() === 6
              const todayKey = formatYmdJerusalem(new Date())
              const isToday = key === todayKey

              const innerBgNorm = isShabbat
                ? s.shabbatBg ?? '#fff7e6'
                : isToday
                  ? s.todayBg ?? '#e8f4fc'
                  : s.gridShellBg ?? '#ffffff'

              const rawTitles = ovr?.centerLines?.length ? ovr.centerLines : ev?.titles ?? []
              const titles = (
                ovr?.centerLines?.length
                  ? rawTitles.map((t: string) => String(t).trim()).filter(Boolean)
                  : uniqAbbrevHebrewTitleLines(rawTitles as string[])
              ).slice(0, 24)

              const hebrewFull = formatHebrewDateFullGematriya(displayDate)
              const gregNum = displayDate.getDate()
              const canvasRadius = resolveCanvasOuterRadiusPx(s)
              const pad = Number(s.canvasPaddingPx ?? 16)
              const padTop = Number(s.canvasPaddingTopPx ?? s.canvasPaddingPx ?? 16)
              const headerH = Math.max(40, Number(s.gridWeekdayHeaderHeightPx ?? 40))
              const acc = accessibilityLowBrightnessMode
              const dayUi = acc
                ? {
                    outerBg: DISPLAY_A11Y.pageBg,
                    canvasBorderCss: `2px solid ${DISPLAY_A11Y.line}`,
                    outlineToday: `${Math.max(2, Number(s.todayOutlineWidthPx ?? 2))}px solid ${DISPLAY_A11Y.textAccent}`,
                    innerPanelBg: DISPLAY_A11Y.gridCellBg,
                    shellText: DISPLAY_A11Y.textPrimary,
                    secondaryText: DISPLAY_A11Y.textPrimary,
                    headerBg: DISPLAY_A11Y.gridCellBg,
                    headerFg: DISPLAY_A11Y.textAccent,
                    headerRule: `${Number(s.gridWeekdayHeaderBorderBottomWidthPx ?? 0) || 1}px solid ${DISPLAY_A11Y.line}`,
                    cardBg: 'rgba(253,246,227,0.07)',
                    cardBorder: `1px solid ${DISPLAY_A11Y.line}`,
                    muted: DISPLAY_A11Y.textPrimary,
                    eventFill: 'rgba(181, 137, 0, 0.22)',
                    eventBorder: `1px solid rgba(181,137,0,0.5)`,
                    zmanStripeBg: 'rgba(253,246,227,0.06)',
                    zmanStripeBorder: `1px solid ${DISPLAY_A11Y.line}`,
                    parshaBg: 'rgba(253,246,227,0.07)',
                    parshaBorder: `1px solid ${DISPLAY_A11Y.line}`,
                    emptyBg: 'rgba(253,246,227,0.05)',
                  }
                : {
                    outerBg: s.calendarCanvasFill ?? '#0b1220',
                    canvasBorderCss: `${Number(s.canvasBorderWidthPx ?? 2)}px solid ${s.canvasBorderColor ?? '#E2E8F0'}`,
                    outlineToday: `${Math.max(1, Number(s.todayOutlineWidthPx ?? 2))}px solid ${s.todayOutlineColor ?? '#2563eb'}`,
                    innerPanelBg: innerBgNorm,
                    shellText: '#0f172a',
                    secondaryText: '#1e293b',
                    headerBg: s.gridWeekdayHeaderBg ?? '#f3ead8',
                    headerFg: s.gridWeekdayHeaderTextColor ?? '#3b2a1b',
                    headerRule: `${Number(s.gridWeekdayHeaderBorderBottomWidthPx ?? 0) || 1}px solid ${s.gridWeekdayHeaderBorderBottomColor ?? 'rgba(148,163,184,0.35)'}`,
                    cardBg: 'rgba(255,255,255,0.92)',
                    cardBorder: '1px solid rgba(148,163,184,0.45)',
                    muted: '#64748b',
                    eventFill: s.eventBg ?? '#dbeafe',
                    eventBorder: '1px solid rgba(59,130,246,0.22)',
                    zmanStripeBg: 'rgba(255,255,255,0.75)',
                    zmanStripeBorder: '1px solid rgba(148,163,184,0.4)',
                    parshaBg: 'rgba(241,245,249,0.95)',
                    parshaBorder: '1px solid rgba(148,163,184,0.35)',
                    emptyBg: 'rgba(248,250,252,0.9)',
                  }
              const zmanRows: { label: string; value: string }[] = []
              if (ev?.candleLighting) zmanRows.push({ label: 'כניסת שבת / נרות', value: ev.candleLighting })
              if (ev?.havdalah) zmanRows.push({ label: 'יציאת שבת / הבדלה', value: ev.havdalah })
              if (ev?.fastBegins || ev?.fastEnds || ev?.fastNameHe) {
                zmanRows.push({
                  label: ev?.fastNameHe ? `צום — ${ev.fastNameHe}` : 'צום',
                  value: [ev?.fastBegins ? `כניסה ${ev.fastBegins}` : '', ev?.fastEnds ? `יציאה ${ev.fastEnds}` : '']
                    .filter(Boolean)
                    .join(' · '),
                })
              }

              const cityLabel = useTA ? 'תל אביב' : 'ירושלים'

              return (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    padding: '0 16px 32px',
                    boxSizing: 'border-box',
                  }}
                >
                  <div
                    dir="rtl"
                    style={{
                      width: '100%',
                      maxWidth: 920,
                      border: dayUi.canvasBorderCss,
                      borderRadius: canvasRadius,
                      padding: pad,
                      paddingTop: padTop,
                      backgroundColor: dayUi.outerBg,
                      boxSizing: 'border-box',
                      boxShadow: '0 18px 48px rgba(2,6,23,0.12)',
                      outline: isToday ? dayUi.outlineToday : undefined,
                      outlineOffset: 3,
                    }}
                  >
                    <div
                      style={{
                        borderRadius: Math.max(10, canvasRadius - 6),
                        background: dayUi.innerPanelBg,
                        color: dayUi.shellText,
                        overflow: 'hidden',
                        minHeight: 'min(72vh, 880px)',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <div
                        style={{
                          minHeight: headerH,
                          padding: '12px 16px',
                          background: dayUi.headerBg,
                          color: dayUi.headerFg,
                          fontFamily: fontHeader,
                          fontWeight: Number(s.gridWeekdayHeaderFontWeight ?? 700),
                          fontSize: Math.max(15, Number(s.gridWeekdayHeaderFontPx ?? 15) * 1.15),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textAlign: 'center',
                          borderBottom: dayUi.headerRule,
                        }}
                      >
                        {fullDate}
                        <span style={{ opacity: 0.55, marginInline: 10 }}>|</span>
                        <span style={{ fontWeight: 800 }}>תצוגת יום</span>
                        <span style={{ opacity: 0.55, marginInline: 10 }}>|</span>
                        <span style={{ opacity: 0.9 }}>זמנים: {cityLabel}</span>
                      </div>

                      <div style={{ padding: '20px 18px 22px', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: 14,
                            alignItems: 'stretch',
                          }}
                        >
                          <div
                            style={{
                              borderRadius: 14,
                              border: dayUi.cardBorder,
                              background: dayUi.cardBg,
                              padding: '16px 14px',
                              textAlign: 'center',
                              boxShadow: acc ? undefined : 'inset 0 1px 0 rgba(255,255,255,0.75)',
                            }}
                          >
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 800,
                                color: dayUi.muted,
                                marginBottom: 8,
                                letterSpacing: 0.02,
                              }}
                            >
                              לועזי
                            </div>
                            <div
                              style={{
                                fontFamily: fontDates,
                                fontSize: gregPx,
                                fontWeight: Number(s.gregDayFontWeight ?? 600),
                                lineHeight: 1.05,
                                color: acc ? dayUi.shellText : gregTC,
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {gregNum}
                            </div>
                            <div
                              style={{
                                marginTop: 8,
                                fontSize: Math.max(15, Math.round(gregPx * 0.42)),
                                fontWeight: 700,
                                color: acc ? dayUi.secondaryText : gregTC,
                                opacity: acc ? 1 : 0.88,
                                lineHeight: 1.35,
                              }}
                            >
                              {fullDate}
                            </div>
                          </div>

                          <div
                            style={{
                              borderRadius: 14,
                              border: dayUi.cardBorder,
                              background: dayUi.cardBg,
                              padding: '16px 14px',
                              textAlign: 'center',
                              boxShadow: acc ? undefined : 'inset 0 1px 0 rgba(255,255,255,0.75)',
                            }}
                          >
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 800,
                                color: dayUi.muted,
                                marginBottom: 8,
                                letterSpacing: 0.02,
                              }}
                            >
                              עברי
                            </div>
                            <div
                              style={{
                                fontFamily: fontDates,
                                fontSize: hebPx,
                                fontWeight: Number(s.hebDayFontWeight ?? 600),
                                lineHeight: 1.15,
                                color: acc ? dayUi.shellText : hebTC,
                              }}
                            >
                              {getHebrewDayGematriya(displayDate)}
                            </div>
                            <div
                              style={{
                                marginTop: 10,
                                fontSize: Math.max(16, Math.round(hebPx * 0.38)),
                                fontWeight: 700,
                                color: acc ? dayUi.secondaryText : hebTC,
                                opacity: acc ? 1 : 0.88,
                                lineHeight: 1.45,
                              }}
                            >
                              {hebrewFull}
                            </div>
                          </div>
                        </div>

                        {ev?.parshaHe && (s.showParsha !== false) ? (
                          <div
                            style={{
                              textAlign: 'center',
                              padding: '12px 14px',
                              borderRadius: 12,
                              background: dayUi.parshaBg,
                              border: dayUi.parshaBorder,
                              fontWeight: 800,
                              fontSize: Math.max(16, Math.round(eventPx * 0.88)),
                              color: dayUi.muted,
                              fontFamily: fontHeader,
                            }}
                          >
                            {formatParshaDisplayHe(ev.parshaHe)}
                          </div>
                        ) : null}

                        {zmanRows.length ? (
                          <div>
                            <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 10, color: dayUi.shellText }}>
                              זמנים ליום
                            </div>
                            <div style={{ display: 'grid', gap: 8 }}>
                              {zmanRows.map((row) => (
                                <div
                                  key={row.label + row.value}
                                  style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    alignItems: 'baseline',
                                    justifyContent: 'space-between',
                                    gap: 10,
                                    padding: '10px 12px',
                                    borderRadius: 12,
                                    background: dayUi.zmanStripeBg,
                                    border: dayUi.zmanStripeBorder,
                                    fontFamily: fontTimes,
                                  }}
                                >
                                  <span
                                    style={{
                                      fontWeight: 800,
                                      color: acc ? dayUi.muted : zmanTC,
                                      opacity: acc ? 1 : 0.9,
                                      fontSize: zmanPx,
                                    }}
                                  >
                                    {row.label}
                                  </span>
                                  <span
                                    style={{
                                      fontWeight: 900,
                                      color: acc ? dayUi.shellText : zmanTC,
                                      fontSize: Math.round(zmanPx * 1.05),
                                      direction: 'ltr',
                                      fontVariantNumeric: 'tabular-nums',
                                    }}
                                  >
                                    {row.value}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                          <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10, color: dayUi.shellText }}>
                            אירועים וחגים
                          </div>
                          <div
                            style={{
                              flex: 1,
                              borderTop: acc ? `1px dashed ${DISPLAY_A11Y.line}` : '1px dashed rgba(148,163,184,0.5)',
                              paddingTop: 12,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 10,
                              overflow: 'auto',
                            }}
                          >
                            {titles.length ? (
                              titles.map((t: string, i: number) => (
                                <div
                                  key={`${i}-${t}`}
                                  style={{
                                    fontFamily: fontEvents,
                                    fontSize: eventPx,
                                    fontWeight: 800,
                                    lineHeight: 1.35,
                                    textAlign: 'center',
                                    padding: '12px 14px',
                                    borderRadius: 12,
                                    background: dayUi.eventFill,
                                    color: acc ? dayUi.shellText : eventTC,
                                    border: dayUi.eventBorder,
                                    boxShadow: acc ? undefined : '0 2px 8px rgba(15,23,42,0.06)',
                                  }}
                                >
                                  {t}
                                </div>
                              ))
                            ) : (
                              <div
                                style={{
                                  textAlign: 'center',
                                  padding: '28px 16px',
                                  color: dayUi.secondaryText,
                                  fontSize: Math.max(16, Math.round(eventPx * 0.95)),
                                  fontWeight: 700,
                                  background: dayUi.emptyBg,
                                  borderRadius: 12,
                                  border: dayUi.cardBorder,
                                }}
                              >
                                אין אירועים ליום זה
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </ErrorBoundary>
        ) : (
          <ErrorBoundary>
            <div
              ref={fullscreenTargetRef}
              style={{
                // Create the same "framed" feel as Admin/Studio.
                padding: isFullscreen ? 0 : 16,
                background: 'transparent',
                boxSizing: 'border-box',
                width: isFullscreen ? '100vw' : undefined,
                height: isFullscreen ? '100vh' : undefined,
              }}
            >
              <CalendarContainer
                // On-screen should be wide and readable (bank clerk). A4 constraints are print-only.
                printOrientation={(settings as any).pdfOrientation === 'portrait' ? 'portrait' : 'landscape'}
                screenMinWidthVw={DISPLAY_CALENDAR_SCREEN_MIN_WIDTH_VW}
                screenMaxWidthPx={DISPLAY_CALENDAR_SCREEN_MAX_WIDTH_PX}
              >
                {(() => {
                  const surface = calendarSurfaceDimensionsPx(settings as any)
                  // In admin Display we prefer Studio parity (exact px sizing) over auto-fit scaling.
                  const allowAutoFit = Boolean(isProdMode && (settings as any).layoutAutoFitToCanvas)
                  const scale =
                    (((allowAutoFit ? autoFitScale : 1) * (resolveCalendarLayoutZoomPercent(settings as any) / 100)) as any) ||
                    1
                  // Mobile browsers (esp. iOS) don't reliably support CSS `zoom`, which causes cell/text mismatch.
                  // On narrow screens we prefer natural layout + horizontal scroll rather than scaling.
                  const safeScale = isNarrow ? 1 : Math.max(0.01, Number.isFinite(scale) ? scale : 1)
                  /** Match Studio `cellScaledPx`: undo CSS `scale(s)` so nominal px match settings. */
                  const layoutScalePx = (px: number) => {
                    const n = Number(px)
                    if (!Number.isFinite(n)) return px
                    return Math.max(0.01, n / safeScale)
                  }
                  const chromeLayoutInv =
                    safeScale > 0.001 && Math.abs(safeScale - 1) > 0.0001 ? 1 / safeScale : undefined
                  const hPct = (100 / safeScale).toFixed(4)
                  return (
                    <div
                      data-display-calendar-host
                      style={{
                        display: 'flex',
                        gap: 16,
                        alignItems: 'flex-start',
                        justifyContent: 'center',
                        flexWrap: 'nowrap',
                        overflowX: 'auto',
                        paddingBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          // This wrapper is the reference width for the month header's absolute positioning.
                          // Do not allow shrinking: shrinking triggers auto-fit scaling and makes
                          // large configured fonts (e.g. gregDayFontPx) appear tiny.
                          // Prefer horizontal scroll to keep Studio parity.
                          flex: `0 0 ${surface.widthPx}px`,
                          width: `${surface.widthPx}px`,
                          maxWidth: `${surface.widthPx}px`,
                          position: 'relative',
                          overflow: 'visible',
                          boxSizing: 'border-box',
                        }}
                      >
                      <div
                        style={{
                          marginBottom: 12,
                          // Align brand strip with calendar inner frame (canvas border + padding);
                          // without this, the logo sits flush to the column edge while the grid is inset.
                          paddingInline:
                            Number((settings as any).canvasBorderWidthPx ?? 2) +
                            Number((settings as any).canvasPaddingPx ?? 16),
                          boxSizing: 'border-box',
                        }}
                      >
                        <BrandHeader settings={brandSettings as any} />
                      </div>
                      <div
                        id="display-pdf-capture-root"
                        ref={pdfCaptureFrameRef}
                        data-display-canvas-frame
                        style={{
                          border: `${Number((settings as any).canvasBorderWidthPx ?? 2)}px solid ${(settings as any).canvasBorderColor ?? '#E2E8F0'}`,
                          borderRadius: resolveCanvasOuterRadiusPx(settings as any),
                          padding: Number((settings as any).canvasPaddingPx ?? 16),
                          // Keep the top edge tight: a top padding creates an empty “shelf” above the weekday row,
                          // and can overlap the header when moving the table up/down.
                          paddingTop: 0,
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
                        // Match Studio rendering: respect the configured fill-height behavior.
                        // This is critical for 1:1 text positioning between Studio and Display.
                        const effectiveFillHeight = Boolean((settings as any).layoutFillHeight === true)

                        return (
                      <div
                        ref={canvasInnerRef}
                        style={
                          (settings as any).layoutCenterVertically && !effectiveFillHeight
                            ? {
                                height: '100%',
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
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
                                  transform: `scale(${safeScale})`,
                                }
                              : {
                                  transform: `scale(${safeScale})`,
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
                              layoutInvScale={chromeLayoutInv}
                              hebrewMonthTitle={hebMonthTitle}
                              gregorianLabel={gregLabel}
                              onEditHeader={() => {}}
                              gridWeekCount={weeks.length}
                              gridRef={monthGridRef as any}
                              gridChildren={
                                <>
                                  {weekdayLabels((settings as any).weekdayHeaderMode).map((t, idx) => (
                                    <div
                                      key={t}
                                      data-display-weekday-header
                                      style={{
                                        height: (settings as any).gridWeekdayHeaderHeightPx ?? 34,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: (settings as any).gridWeekdayHeaderBg ?? '#f3ead8',
                                        color: (settings as any).gridWeekdayHeaderTextColor ?? '#3b2a1b',
                                        fontSize: layoutScalePx(
                                          Math.max(10, Number((settings as any).gridWeekdayHeaderFontPx ?? 12)),
                                        ),
                                        fontWeight: Number(
                                          (settings as any).gridWeekdayHeaderFontWeight ?? 700,
                                        ),
                                        borderBottom: `${(settings as any).gridWeekdayHeaderBorderBottomWidthPx ?? (settings as any).gridBorderWidthPx ?? 2}px solid ${(settings as any).gridWeekdayHeaderBorderBottomColor ?? (settings as any).gridBorderColor ?? '#bfa67a'}`,
                                        boxSizing: 'border-box',
                                        userSelect: 'none',
                                      }}
                                    >
                                      {(settings as any).weekdayHeaderShowEnglish ? (
                                        <div
                                          dir="rtl"
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            transform:
                                              Number((settings as any).gridWeekdayHeaderTextOffsetYPx ?? 0) === 0
                                                ? undefined
                                                : `translateY(${Number((settings as any).gridWeekdayHeaderTextOffsetYPx ?? 0)}px)`,
                                            lineHeight: 1,
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          <span>{t}</span>
                                          <span dir="ltr" style={{ fontWeight: 800, opacity: 0.9 }}>
                                            {(['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][idx] ?? '') as any}
                                          </span>
                                        </div>
                                      ) : (
                                        <span
                                          style={{
                                            transform:
                                              Number((settings as any).gridWeekdayHeaderTextOffsetYPx ?? 0) === 0
                                                ? undefined
                                                : `translateY(${Number((settings as any).gridWeekdayHeaderTextOffsetYPx ?? 0)}px)`,
                                            display: 'inline-block',
                                            lineHeight: 1,
                                          }}
                                        >
                                          <span dir="rtl">{t}</span>
                                        </span>
                                      )}
                                    </div>
                                  ))}

                                  {dayMetas.map((m, cellIndex) => {
                    // Always use a stable day key (Jerusalem YMD) for overrides, reminders, and local-only cell images.
                    // Using m.gKey is not reliable for padding cells in all view-model variants.
                    const key = formatYmdJerusalem(m.g)
                    const dayReminder = String(remindersByDay[key] ?? '').trim()
                    const baseOvr = resolveDayTextOverride(overrides, key)
                    const localImg = localCellImages[key]
                    const slotKeyAll = `__slot__:${cellIndex}`
                    const viewYm = `${displayDate.getFullYear()}-${String(displayDate.getMonth() + 1).padStart(2, '0')}`
                    const slotKeyMonth = `__slot__:${viewYm}:${cellIndex}`
                    const slotImg = (!m.inMonth ? localSlotImages[slotKeyMonth] ?? localSlotImages[slotKeyAll] : undefined) as any
                    const mergedLocal = (localImg ? { ...(localImg as any) } : null) ?? null
                    const mergedSlot = (!m.inMonth && slotImg ? { ...(slotImg as any) } : null) ?? null
                    const ovr = (mergedLocal || mergedSlot
                      ? { ...(baseOvr as any), ...(mergedSlot as any), ...(mergedLocal as any) }
                      : baseOvr) as any
                    const isToday = m.isToday
                    const isShabbat = m.isShabbat
                    const inMonth = m.inMonth
                    const gregTextColor =
                      String((settings as any).gregDayTextColor ?? DEFAULT_SETTINGS.gregDayTextColor).trim() ||
                      DEFAULT_SETTINGS.gregDayTextColor
                    const hebTextColor =
                      String((settings as any).hebDayTextColor ?? DEFAULT_SETTINGS.hebDayTextColor).trim() ||
                      DEFAULT_SETTINGS.hebDayTextColor
                    const eventTextColor =
                      String((settings as any).eventTitleTextColor ?? DEFAULT_SETTINGS.eventTitleTextColor).trim() ||
                      DEFAULT_SETTINGS.eventTitleTextColor
                    const zmanTextColor =
                      String(
                        (settings as any).shabbatTimesTextColor ?? DEFAULT_SETTINGS.shabbatTimesTextColor,
                      ).trim() || DEFAULT_SETTINGS.shabbatTimesTextColor
                    const dateFade = inMonth ? 1 : 0.45
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
                    const localMonthPad = (localPaddingLogo as any)?.[monthPaddingKeyFromYmd(key)] as any
                    const localGlobalPad = (localPaddingLogo as any)?.__all__ as any
                    const disabled = (ovr as any)?.imageDisabled === true
                    const isPaddingLogoCell = !inMonth && paddingLogoDayKey && key === paddingLogoDayKey
                    const sourceOvr =
                      disabled
                        ? null
                        : (typeof (ovr as any)?.imageDataUrl === 'string' && String((ovr as any).imageDataUrl).trim()
                            ? (ovr as any)
                            : isPaddingLogoCell &&
                                typeof localMonthPad?.imageDataUrl === 'string' &&
                                String(localMonthPad.imageDataUrl).trim()
                              ? localMonthPad
                            : isPaddingLogoCell &&
                                typeof monthPad?.imageDataUrl === 'string' &&
                                String(monthPad.imageDataUrl).trim()
                              ? monthPad
                            : isPaddingLogoCell &&
                                typeof localGlobalPad?.imageDataUrl === 'string' &&
                                String(localGlobalPad.imageDataUrl).trim()
                              ? localGlobalPad
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
                        role="button"
                        tabIndex={0}
                        className="display-day-cell-focusable"
                        data-display-day-cell={inMonth ? 'in' : 'pad'}
                        data-display-today-cell={isToday && inMonth ? '1' : undefined}
                        aria-label={
                          inMonth
                            ? `תא לוח: ${new Intl.DateTimeFormat('he-IL', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                              }).format(m.g)}`
                            : `תא מילוי לוח, ${key}`
                        }
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter' && e.key !== ' ') return
                          e.preventDefault()
                          ;(e.currentTarget as HTMLDivElement).click()
                        }}
                        onClick={() => {
                          if (!inMonth) {
                            // Padding cells: always allow local image import (prod + suite-display/admin).
                            if (paddingLogoDayKey && key === paddingLogoDayKey) {
                              openPaddingLogoDialog('global')
                              return
                            }
                            openLocalCellImageDialog(key, slotKeyAll, cellIndex)
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
                          // Base for `em` in zmanim blocks — matches Studio `<section style={{ fontSize: fontSizePx }}>`.
                          fontSize: Number((settings as any).fontSizePx ?? DEFAULT_SETTINGS.fontSizePx),
                          fontWeight: Number((settings as any).fontWeight ?? DEFAULT_SETTINGS.fontWeight),
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
                          cursor: 'pointer',
                        }}
                      >
                        {debug && localImg ? (
                          <div
                            style={{
                              position: 'absolute',
                              top: 4,
                              left: 4,
                              zIndex: 6,
                              background: 'rgba(16,185,129,0.85)',
                              color: '#064e3b',
                              fontWeight: 900,
                              fontSize: layoutScalePx(10),
                              padding: '2px 5px',
                              borderRadius: 999,
                              direction: 'ltr',
                            }}
                            title={`local img for ${key}`}
                          >
                            local
                          </div>
                        ) : null}
                        {cellImgUrl ? (
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
                                  data-display-event-stack
                                  style={{
                                    position: 'absolute',
                                    top: 6,
                                    right: 8,
                                    left: (settings as any).cellSplitEnabled
                                      ? `${Math.round((Number((settings as any).cellSplitRatio ?? 0.28) || 0.28) * 100)}%`
                                      : 8,
                                    fontSize: layoutScalePx(Number((settings as any).eventTitleFontPx ?? 10)),
                                    lineHeight: 1.15,
                                    textAlign: 'right',
                                    color: eventTextColor,
                                    opacity: 0.98 * dateFade,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 2,
                                    paddingInline: 2,
                                    transform: `translate(${Number(ovr?.centerOffsetX) || 0}px, ${Number(ovr?.centerOffsetY) || 0}px)`,
                                  }}
                                >
                                  {titles.slice(0, 4).map((t: string) => (
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
                                  {dayReminder ? (
                                    <div
                                      title={dayReminder}
                                      style={{
                                        marginTop: 4,
                                        fontSize: layoutScalePx(
                                          Math.max(9, Number((settings as any).eventTitleFontPx ?? 10) - 1),
                                        ),
                                        fontWeight: 700,
                                        color: '#0f766e',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        maxWidth: '100%',
                                      }}
                                    >
                                      {dayReminder}
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
                                      fontSize: layoutScalePx(Number((settings as any).gregDayFontPx ?? 12)),
                                      lineHeight: 1,
                                      fontWeight: Number(
                                        (settings as any).gregDayFontWeight ??
                                          (settings as any).fontWeight ??
                                          600,
                                      ),
                                      color: gregTextColor,
                                      opacity: dateFade,
                                    }}
                                    data-debug-greg-day="1"
                                    data-type="greg-day"
                                  >
                                    {m.gDay}
                                    {m.gDay === 1 ? (
                                      <span
                                        style={{
                                          fontSize: layoutScalePx(Number((settings as any).gregDayFontPx ?? 12)),
                                          color: gregTextColor,
                                          opacity: 0.62,
                                        }}
                                      >
                                        /{m.gMonth}
                                      </span>
                                    ) : null}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: layoutScalePx(Number((settings as any).hebDayFontPx ?? 15)),
                                      lineHeight: 1,
                                      opacity: 0.95 * dateFade,
                                      fontWeight: Number((settings as any).hebDayFontWeight ?? 500),
                                      display: 'inline-block',
                                      transform: `translate(${Number((settings as any).hebDayOffsetXPx ?? 0)}px, ${Number(
                                        (settings as any).hebDayOffsetYPx ?? 0,
                                      )}px)`,
                                      color: hebTextColor,
                                    }}
                                    data-debug-heb-day="1"
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
                                  {(settings as any).cellDateOrder === 'heb_first' ? (
                                    <>
                                      <div
                                        style={{
                                          fontSize: layoutScalePx(Number((settings as any).hebDayFontPx ?? 15)),
                                          lineHeight: 1,
                                          opacity: 0.95 * dateFade,
                                          fontWeight: Number((settings as any).hebDayFontWeight ?? 500),
                                          display: 'inline-block',
                                          transform: `translate(${Number((settings as any).hebDayOffsetXPx ?? 0)}px, ${Number(
                                            (settings as any).hebDayOffsetYPx ?? 0,
                                          )}px)`,
                                          color: hebTextColor,
                                        }}
                                        data-debug-heb-day="1"
                                      >
                                        {m.hebDay}
                                      </div>
                                      <div
                                        style={{
                                          fontSize: layoutScalePx(Number((settings as any).gregDayFontPx ?? 12)),
                                          lineHeight: 1,
                                          fontWeight: Number(
                                            (settings as any).gregDayFontWeight ??
                                              (settings as any).fontWeight ??
                                              600,
                                          ),
                                          color: gregTextColor,
                                          opacity: dateFade,
                                        }}
                                        data-debug-greg-day="1"
                                        data-type="greg-day"
                                      >
                                        {m.gDay}
                                        {m.gDay === 1 ? (
                                          <span
                                            style={{
                                              fontSize: layoutScalePx(Number((settings as any).gregDayFontPx ?? 12)),
                                              color: gregTextColor,
                                              opacity: 0.62,
                                            }}
                                          >
                                            /{m.gMonth}
                                          </span>
                                        ) : null}
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <div
                                        style={{
                                          fontSize: layoutScalePx(Number((settings as any).gregDayFontPx ?? 12)),
                                          lineHeight: 1,
                                          fontWeight: Number(
                                            (settings as any).gregDayFontWeight ??
                                              (settings as any).fontWeight ??
                                              600,
                                          ),
                                          color: gregTextColor,
                                          opacity: dateFade,
                                        }}
                                        data-debug-greg-day="1"
                                        data-type="greg-day"
                                      >
                                        {m.gDay}
                                        {m.gDay === 1 ? (
                                          <span
                                            style={{
                                              fontSize: layoutScalePx(Number((settings as any).gregDayFontPx ?? 12)),
                                              color: gregTextColor,
                                              opacity: 0.62,
                                            }}
                                          >
                                            /{m.gMonth}
                                          </span>
                                        ) : null}
                                      </div>
                                      <div
                                        style={{
                                          fontSize: layoutScalePx(Number((settings as any).hebDayFontPx ?? 15)),
                                          lineHeight: 1,
                                          opacity: 0.95 * dateFade,
                                          fontWeight: Number((settings as any).hebDayFontWeight ?? 500),
                                          display: 'inline-block',
                                          transform: `translate(${Number((settings as any).hebDayOffsetXPx ?? 0)}px, ${Number(
                                            (settings as any).hebDayOffsetYPx ?? 0,
                                          )}px)`,
                                          color: hebTextColor,
                                        }}
                                        data-debug-heb-day="1"
                                      >
                                        {m.hebDay}
                                      </div>
                                    </>
                                  )}
                                </div>

                                <div
                                  dir="rtl"
                                  data-display-event-stack
                                  style={{
                                    marginTop: 6,
                                    fontSize: layoutScalePx(Number((settings as any).eventTitleFontPx ?? 10)),
                                    lineHeight: 1.15,
                                    textAlign: (ovr?.centerAlign ?? 'center') as any,
                                    color: eventTextColor,
                                    opacity: 0.98 * dateFade,
                                    minHeight: 44,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    gap: 2,
                                    paddingInline: 2,
                                    transform: `translate(${Number(ovr?.centerOffsetX) || 0}px, ${Number(ovr?.centerOffsetY) || 0}px)`,
                                  }}
                                >
                                  {titles.map((t: string) => (
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
                                    {dayReminder ? (
                                    <div
                                      title={dayReminder}
                                      style={{
                                        marginTop: 4,
                                        fontSize: layoutScalePx(
                                          Math.max(9, Number((settings as any).eventTitleFontPx ?? 10) - 1),
                                        ),
                                        fontWeight: 700,
                                        color: '#0f766e',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        maxWidth: '100%',
                                      }}
                                    >
                                      {dayReminder}
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
                            data-display-zmanim-block
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
                              color: zmanTextColor,
                              textAlign: 'right',
                              lineHeight: 1.2,
                              // Match Studio: `${shabbatTimesFontPx / 10}em` relative to cell `fontSizePx` base.
                              fontSize: `${Number((settings as any).shabbatTimesFontPx ?? DEFAULT_SETTINGS.shabbatTimesFontPx) / 10}em`,
                              opacity: 0.95 * dateFade,
                            }}
                          >
                            {showCandle ? (
                              <div style={{ marginBottom: showHavdalah ? 4 : 0 }}>
                                <div style={{ fontWeight: 650, whiteSpace: 'nowrap' }}>{candleLabel}</div>
                                <HebcalZmanimLine jer={m.candleLightingJer} ta={m.candleLightingTA} />
                              </div>
                            ) : null}
                            {showHavdalah ? (
                              <div>
                                <div style={{ fontWeight: 650, whiteSpace: 'nowrap' }}>{havdalahLabel}</div>
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

                      <div style={{ flex: '0 0 auto' }} data-export-exclude="1">
                        <div
                          className="display-floating-clock"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 12,
                          }}
                        >
                          <div
                            className="chip"
                            style={{
                              fontVariantNumeric: 'tabular-nums',
                              fontWeight: 950,
                              padding: '8px 12px',
                              borderRadius: 12,
                              minWidth: 132,
                              textAlign: 'center',
                              direction: 'ltr',
                              fontFamily:
                                '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                              fontSize: 20,
                              letterSpacing: 0.7,
                              border: '1px solid rgba(148,163,184,0.35)',
                              background:
                                'linear-gradient(135deg, rgba(59,130,246,0.22), rgba(236,72,153,0.16), rgba(16,185,129,0.16))',
                            }}
                            title="שעה"
                          >
                            {clock}
                          </div>
                        </div>
                        <QuickNotesSidebar storageKey={quickNotesStorageKey} />
                      </div>
                    </div>
                  )
                })()}
              </CalendarContainer>
            </div>
          </ErrorBoundary>
        )}
      </main>

      {manageCatalogOpen ? (
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
            zIndex: 80,
          }}
          onMouseDown={() => setManageCatalogOpen(false)}
        >
          <div
            dir="rtl"
            style={{
              width: 'min(720px, 100%)',
              background: isLikelyLightBg(settings.calendarCanvasFill) ? '#ffffff' : '#0b1220',
              border: '1px solid rgba(148,163,184,0.25)',
              borderRadius: 16,
              padding: 14,
              color: isLikelyLightBg(settings.calendarCanvasFill) ? '#0f172a' : '#e2e8f0',
              boxSizing: 'border-box',
              maxHeight: 'min(78vh, 720px)',
              overflow: 'auto',
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>ניהול ערכות (מקומי לעמדה)</div>
              <button
                type="button"
                className="chip"
                onClick={() => setManageCatalogOpen(false)}
                style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 800 }}
                title="סגור"
              >
                סגור
              </button>
            </div>

            <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
              מחיקה כאן = הסתרה מקומית בלבד. למחיקה מהענן (טוטאלית) השתמש בכפתור "מחק מהענן".
            </div>

            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
              {cloudCatalog
                .slice()
                .sort((a, b) => {
                  if (a.kind !== b.kind) return a.kind === 'style' ? -1 : 1
                  return a.nameHe.localeCompare(b.nameHe)
                })
                .map((x) => {
                  const hidden = Boolean(hiddenCloudCatalogIds?.[x.id])
                  const canDeleteFromCloud = x.kind === 'style' && String(x.id).startsWith('user:')
                  return (
                    <div
                      key={x.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: 10,
                        borderRadius: 12,
                        border: '1px solid rgba(148,163,184,0.25)',
                        opacity: hidden ? 0.55 : 1,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {x.nameHe}
                        </div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 2, direction: 'ltr' }}>
                          {x.kind} · {x.id}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
                        {canDeleteFromCloud ? (
                          <button
                            type="button"
                            className="chip"
                            onClick={async () => {
                              const ok = window.confirm(
                                `למחוק מהענן לצמיתות את הסגנון "${x.nameHe}"?\n\nזה ימחק אותו מהקטלוג בענן לטננט הנוכחי והוא לא יופיע יותר ברשימה.`,
                              )
                              if (!ok) return
                              try {
                                const r = await fetch('/api/prune-theme-catalog', {
                                  method: 'POST',
                                  headers: { 'content-type': 'application/json' },
                                  body: JSON.stringify({ tenantId: kvTenantId, idsToRemove: [x.id] }),
                                })
                                if (!r.ok) throw new Error(`HTTP ${r.status}`)
                              } catch (e: any) {
                                window.alert(`מחיקה מהענן נכשלה: ${String(e?.message ?? e)}`)
                                return
                              }

                              // Update local UI immediately.
                              setCloudCatalog((prev) => prev.filter((it) => it.id !== x.id))
                              setHiddenCloudCatalogIds((prev) => {
                                const next = { ...(prev || {}) }
                                delete (next as any)[x.id]
                                return next
                              })
                              if (selectedCloudStyleId === x.id) {
                                setSelectedCloudStyleId('default')
                                try {
                                  localStorage.removeItem(cloudCatalogStorageKey)
                                } catch {
                                  // ignore
                                }
                              }
                            }}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 10,
                              fontWeight: 900,
                              background: 'rgba(239,68,68,0.12)',
                              border: '1px solid rgba(239,68,68,0.35)',
                            }}
                            title="מחק מהענן (לצמיתות)"
                          >
                            מחק מהענן
                          </button>
                        ) : null}
                        {hidden ? (
                          <button
                            type="button"
                            className="chip"
                            onClick={() =>
                              setHiddenCloudCatalogIds((prev) => {
                                const next = { ...(prev || {}) }
                                delete (next as any)[x.id]
                                return next
                              })
                            }
                            style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 800 }}
                            title="הצג שוב"
                          >
                            הצג
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="chip"
                            onClick={() => {
                              const ok = window.confirm(`להסתיר את "${x.nameHe}" מהרשימה בבנק בעמדה הזו?`)
                              if (!ok) return
                              setHiddenCloudCatalogIds((prev) => ({ ...(prev || {}), [x.id]: true }))
                              if (selectedCloudColorId === x.id) setSelectedCloudColorId('default')
                              if (selectedCloudStyleId === x.id) setSelectedCloudStyleId('default')
                            }}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 10,
                              fontWeight: 900,
                              background: 'rgba(239,68,68,0.12)',
                              border: '1px solid rgba(239,68,68,0.30)',
                            }}
                            title="הסר מהרשימה (מקומי)"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      ) : null}

      {reminderEditorOpen && reminderEditorDayKey ? (
        <div
          role="dialog"
          aria-modal="true"
          data-export-exclude="1"
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
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 10, flexWrap: 'wrap' }}>
              {(() => {
                const k = reminderEditorDayKey
                const local = k ? localCellImages[k] : null
                const hasLocalImg = Boolean(String(local?.imageDataUrl ?? '').trim())
                return hasLocalImg ? (
                  <button
                    type="button"
                    onClick={() => {
                      const ok = window.confirm('למחוק את התמונה שהוכנסה לתא הזה בעמדה הזו?')
                      if (!ok) return
                      setLocalCellImages((prev) => {
                        const copy = { ...prev }
                        delete copy[k]
                        return copy
                      })
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '1px solid rgba(239,68,68,0.35)',
                      background: 'rgba(239,68,68,0.12)',
                      color: isLikelyLightBg(settings.calendarCanvasFill) ? '#7f1d1d' : '#fecaca',
                      fontWeight: 900,
                    }}
                    title="מחק תמונה מקומית לתא"
                  >
                    מחק תמונה בתא
                  </button>
                ) : (
                  <span />
                )
              })()}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
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
        </div>
      ) : null}

      {reminderPopupOpen && reminderPopupDayKey ? (
        <div
          role="dialog"
          aria-modal="true"
          data-export-exclude="1"
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

      {cellImgDialogOpen && cellImgDialogDayKey ? (
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
            zIndex: 80,
          }}
          onMouseDown={closeLocalCellImageDialog}
        >
          <div
            dir="rtl"
            style={{
              width: 'min(640px, 100%)',
              background: '#ffffff',
              border: '1px solid rgba(148,163,184,0.25)',
              borderRadius: 16,
              padding: 16,
              boxSizing: 'border-box',
              color: '#0f172a',
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontWeight: 900 }}>תמונה לתא ריק</div>
              <button
                type="button"
                className="chip"
                onClick={closeLocalCellImageDialog}
                style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 800 }}
              >
                סגור
              </button>
            </div>

            <div style={{ marginTop: 10, color: '#475569', fontWeight: 700, fontSize: 12 }}>
              העלה תמונה מהמחשב והיא תיכנס לתא הריק. אפשר למחוק בכל רגע. נשמר רק בעמדה הזו.
            </div>
            <div style={{ marginTop: 6, color: '#64748b', fontWeight: 700, fontSize: 12, direction: 'ltr' }}>
              cell: {cellImgDialogDayKey}
              {cellImgSavedAt ? ` · saved` : ''}
            </div>

            <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
              {(() => {
                const local = localCellImages[cellImgDialogDayKey]
                const slotIndex = cellImgDialogSlotIndex
                const viewYm = cellImgDialogViewYm
                const slotKeyAll = typeof slotIndex === 'number' ? `__slot__:${slotIndex}` : null
                const slotKeyMonth =
                  typeof slotIndex === 'number' && viewYm ? `__slot__:${viewYm}:${slotIndex}` : null
                const slotAll = slotKeyAll ? localSlotImages[String(slotKeyAll)] : undefined
                const slotMonth = slotKeyMonth ? localSlotImages[String(slotKeyMonth)] : undefined

                const existing = local?.imageDataUrl ?? ''
                const baseExisting =
                  cellImgDialogScope === 'slot'
                    ? String((slotMonth?.imageDataUrl ?? '').trim() || (slotAll?.imageDataUrl ?? '').trim() || '')
                    : String(existing || '').trim()
                const effectiveUrl = String(cellImgDraftUrl || '').trim() || baseExisting
                const canApply = Boolean(String(cellImgDraftUrl || '').trim() || baseExisting)
                const apply = () => {
                  const target = cellImgDialogScope === 'slot' && slotIndex !== null ? 'slot' : 'month'
                  const draft = String(cellImgDraftUrl || '').trim()
                  if (target === 'slot') {
                    setLocalSlotImages((prev) => {
                      const copy = { ...prev }
                      const k =
                        cellImgDialogScope === 'slot'
                          ? String(slotKeyMonth || slotKeyAll || '')
                          : String(slotKeyAll || '')
                      if (!k) return copy
                      if (!draft) {
                        delete copy[k]
                        return copy
                      }
                      copy[k] = {
                        imageDataUrl: draft,
                        imageFit: copy[k]?.imageFit ?? 'contain',
                        imageOpacity: copy[k]?.imageOpacity ?? 1,
                        imageOffsetX: copy[k]?.imageOffsetX ?? 0,
                        imageOffsetY: copy[k]?.imageOffsetY ?? 0,
                      }
                      return copy
                    })
                  } else {
                    setLocalCellImages((prev) => {
                      const copy = { ...prev }
                      if (!draft) {
                        delete copy[cellImgDialogDayKey]
                        return copy
                      }
                      copy[cellImgDialogDayKey] = {
                        imageDataUrl: draft,
                        imageFit: copy[cellImgDialogDayKey]?.imageFit ?? 'contain',
                        imageOpacity: copy[cellImgDialogDayKey]?.imageOpacity ?? 1,
                        imageOffsetX: copy[cellImgDialogDayKey]?.imageOffsetX ?? 0,
                        imageOffsetY: copy[cellImgDialogDayKey]?.imageOffsetY ?? 0,
                      }
                      return copy
                    })
                  }
                  setCellImgSavedAt(Date.now())
                }
                return (
                  <>
                    {slotIndex !== null ? (
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ fontWeight: 800, fontSize: 12, color: '#334155' }}>החל על:</div>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 800 }}>
                          <input
                            type="radio"
                            checked={cellImgDialogScope === 'month'}
                            onChange={() => setCellImgDialogScope('month')}
                          />
                          חודש זה בלבד
                        </label>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 800 }}>
                          <input
                            type="radio"
                            checked={cellImgDialogScope === 'slot'}
                            onChange={() => setCellImgDialogScope('slot')}
                          />
                          כל חודש (אותה משבצת)
                        </label>
                      </div>
                    ) : null}
              <input
                id="local-cell-img-file"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  const r = new FileReader()
                  r.onload = () => {
                    const url = typeof r.result === 'string' ? r.result : ''
                    if (!url) return
                    setCellImgDraftUrl(url)
                  }
                  r.readAsDataURL(f)
                }}
              />

              {effectiveUrl ? (
                <>
                  <div
                    style={{
                      height: 220,
                      borderRadius: 12,
                      border: '1px solid rgba(148,163,184,0.35)',
                      backgroundImage: `url(${effectiveUrl})`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'center',
                      backgroundSize: (localCellImages[cellImgDialogDayKey]?.imageFit ?? 'contain') as any,
                    }}
                  />

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                    <button
                      type="button"
                      className="chip"
                      style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 800 }}
                      onClick={() => {
                        setCellImgDraftUrl('')
                      }}
                      title="מחיקת תמונה"
                    >
                      מחק תמונה
                    </button>
                    <button
                      type="button"
                      className="chip"
                      style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 800 }}
                      onClick={() => {
                        const el = document.getElementById('local-cell-img-file') as HTMLInputElement | null
                        el?.click()
                      }}
                      title="החלפת תמונה"
                    >
                      החלף/בחר תמונה
                    </button>
                    <button
                      type="button"
                      className="chip"
                      style={{
                        padding: '8px 10px',
                        borderRadius: 10,
                        fontWeight: 900,
                        background: 'rgba(16,185,129,0.16)',
                        border: '1px solid rgba(148,163,184,0.35)',
                        color: '#064e3b',
                      }}
                      disabled={!canApply}
                      onClick={apply}
                      title="החל"
                    >
                      החל
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ color: '#64748b' }}>אין תמונה לתא הזה עדיין.</div>
                  <button
                    type="button"
                    className="chip"
                    style={{
                      padding: '8px 10px',
                      borderRadius: 10,
                      fontWeight: 900,
                      background: 'rgba(16,185,129,0.16)',
                      border: '1px solid rgba(148,163,184,0.35)',
                      color: '#064e3b',
                    }}
                    disabled={!canApply}
                    onClick={apply}
                    title="החל"
                  >
                    החל
                  </button>
                </div>
              )}
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      ) : null}

      {paddingLogoDialogOpen ? (
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
            zIndex: 81,
          }}
          onMouseDown={closePaddingLogoDialog}
        >
          <div
            dir="rtl"
            style={{
              width: 'min(640px, 100%)',
              background: '#ffffff',
              border: '1px solid rgba(148,163,184,0.25)',
              borderRadius: 16,
              padding: 16,
              boxSizing: 'border-box',
              color: '#0f172a',
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontWeight: 900 }}>לוגו בתא האפור</div>
              <button type="button" className="chip" onClick={closePaddingLogoDialog} style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 800 }}>
                סגור
              </button>
            </div>
            <div style={{ marginTop: 8, color: '#475569', fontWeight: 700, fontSize: 12 }}>
              נשמר רק במחשב הזה. משפיע רק על תא אפור אחד בכל חודש.
            </div>

            <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
              <label style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontWeight: 800, color: '#0f172a' }}>
                החל
                <select
                  className="chip"
                  value={paddingLogoScope}
                  onChange={(e) => setPaddingLogoScope(e.target.value === 'month' ? 'month' : 'global')}
                  style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 900 }}
                >
                  <option value="global">על כל החודשים</option>
                  <option value="month">רק על החודש הזה</option>
                </select>
              </label>

              <input
                id="padding-logo-file"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  const r = new FileReader()
                  r.onload = () => {
                    const url = typeof r.result === 'string' ? r.result : ''
                    if (!url) return
                    setPaddingLogoDraftUrl(url)
                  }
                  r.readAsDataURL(f)
                }}
              />

              {paddingLogoDraftUrl ? (
                <>
                  <div
                    style={{
                      height: 220,
                      borderRadius: 12,
                      border: '1px solid rgba(148,163,184,0.35)',
                      backgroundImage: `url(${paddingLogoDraftUrl})`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'center',
                      backgroundSize: 'contain',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                    <button
                      type="button"
                      className="chip"
                      style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 800 }}
                      onClick={() => setPaddingLogoDraftUrl('')}
                    >
                      מחק
                    </button>
                    <button
                      type="button"
                      className="chip"
                      style={{ padding: '8px 10px', borderRadius: 10, fontWeight: 800 }}
                      onClick={() => {
                        const el = document.getElementById('padding-logo-file') as HTMLInputElement | null
                        el?.click()
                      }}
                    >
                      החלף
                    </button>
                    <button
                      type="button"
                      className="chip"
                      style={{
                        padding: '8px 10px',
                        borderRadius: 10,
                        fontWeight: 900,
                        background: 'rgba(16,185,129,0.16)',
                        border: '1px solid rgba(148,163,184,0.35)',
                        color: '#064e3b',
                      }}
                      onClick={() => {
                        if (!paddingLogoDayKey) return
                        const k = paddingLogoScope === 'month' ? monthPaddingKeyFromYmd(paddingLogoDayKey) : '__all__'
                        setLocalPaddingLogo((prev) => ({ ...prev, [k]: { imageDataUrl: paddingLogoDraftUrl, imageFit: 'contain', imageOpacity: 1, imageOffsetX: 0, imageOffsetY: 0 } }))
                        closePaddingLogoDialog()
                      }}
                    >
                      החל
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ color: '#64748b' }}>בחר תמונה ללוגו.</div>
                  <button
                    type="button"
                    className="chip"
                    style={{
                      padding: '8px 10px',
                      borderRadius: 10,
                      fontWeight: 900,
                      background: 'rgba(16,185,129,0.16)',
                      border: '1px solid rgba(148,163,184,0.35)',
                      color: '#064e3b',
                    }}
                    disabled
                  >
                    החל
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {importOpen && (
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
                placeholder="כתובת API לקונפיג (ברירת מחדל: /api/get-runtime-config)"
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


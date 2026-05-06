import { useEffect, useMemo, useState } from 'react'

type QuickNote = {
  id: string
  text: string
  createdAt: number
  updatedAt: number
}

function newId(): string {
  try {
    const id = (globalThis as any)?.crypto?.randomUUID?.()
    if (typeof id === 'string' && id) return id
  } catch {
    // ignore
  }
  return `note_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function defaultStorageKey(): string {
  try {
    if (typeof window === 'undefined') return 'hebrew-calendar:quick-notes:v1:server'
    const url = `${window.location.origin}${window.location.pathname}`
    return `hebrew-calendar:quick-notes:v1:${url}`
  } catch {
    return 'hebrew-calendar:quick-notes:v1:unknown'
  }
}

function loadNotes(key: string): QuickNote[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as any
    if (!Array.isArray(parsed)) return []
    const out: QuickNote[] = []
    const seen = new Set<string>()
    for (const n of parsed) {
      if (!n || typeof n !== 'object' || Array.isArray(n)) continue
      const id = typeof n.id === 'string' ? n.id.trim() : ''
      const text = typeof n.text === 'string' ? n.text : ''
      if (!id || !text.trim()) continue
      if (seen.has(id)) continue
      seen.add(id)
      const createdAt = Number(n.createdAt)
      const updatedAt = Number(n.updatedAt)
      const now = Date.now()
      out.push({
        id,
        text,
        createdAt: Number.isFinite(createdAt) ? createdAt : now,
        updatedAt: Number.isFinite(updatedAt)
          ? updatedAt
          : Number.isFinite(createdAt)
            ? createdAt
            : now,
      })
    }
    return out.slice(0, 500)
  } catch {
    return []
  }
}

function saveNotes(key: string, notes: QuickNote[]) {
  try {
    localStorage.setItem(key, JSON.stringify(notes))
  } catch {
    // ignore
  }
}

export function QuickNotesSidebar({
  title,
  storageKey,
  accentColor,
}: {
  title?: string
  storageKey?: string
  /** Optional brand accent color (CSS color). */
  accentColor?: string
}) {
  const accent = String(accentColor ?? '').trim() || '#E31B23'
  const key = storageKey || defaultStorageKey()
  const [notes, setNotes] = useState<QuickNote[]>([])
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setNotes(loadNotes(key))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const sorted = useMemo(() => {
    return [...notes].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  }, [notes])

  const addNote = () => {
    const text = draft.trim()
    if (!text) return
    const now = Date.now()
    const n: QuickNote = { id: newId(), text, createdAt: now, updatedAt: now }
    const next = [n, ...notes]
    setNotes(next)
    saveNotes(key, next)
    setDraft('')
  }

  const updateNote = (id: string, text: string) => {
    const now = Date.now()
    const next = notes
      .map((n) => (n.id === id ? { ...n, text, updatedAt: now } : n))
      .filter((n) => String(n.text ?? '').trim())
    setNotes(next)
    saveNotes(key, next)
  }

  const deleteNote = (id: string) => {
    const next = notes.filter((n) => n.id !== id)
    setNotes(next)
    saveNotes(key, next)
  }

  return (
    <aside
      dir="rtl"
      style={{
        width: open ? 320 : 'auto',
        maxWidth: open ? 'min(92vw, 360px)' : 'min(92vw, 220px)',
        borderRadius: 16,
        border: '1px solid rgba(148,163,184,0.35)',
        background: 'rgba(255,255,255,0.86)',
        boxShadow: '0 10px 24px rgba(2,6,23,0.08)',
        overflow: 'hidden',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      <div
        style={{
          height: 4,
          background: accent,
        }}
      />

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '10px 12px',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          color: '#0f172a',
          fontWeight: 900,
          textAlign: 'right',
        }}
        aria-expanded={open}
        aria-controls="quick-notes-panel"
        title={open ? 'סגור פתקיות' : 'פתח פתקיות'}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span
            aria-hidden="true"
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: accent,
              boxShadow: '0 0 0 3px rgba(226,232,240,0.7)',
            }}
          />
          <span>{title ?? 'פתקיות'}</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 800 }}>
            {sorted.length ? `${sorted.length}` : '—'}
          </span>
          <span aria-hidden="true" style={{ color: '#64748b', fontWeight: 900 }}>
            {open ? '▾' : '▸'}
          </span>
        </span>
      </button>

      {!open ? null : (
        <div id="quick-notes-panel" style={{ padding: 12, paddingTop: 2 }}>
        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="הוסף פתקית קצרה…"
            style={{
              width: '100%',
              minHeight: 74,
              resize: 'vertical',
              borderRadius: 12,
              border: '1px solid rgba(148,163,184,0.35)',
              padding: 10,
              boxSizing: 'border-box',
              background: 'rgba(248,250,252,1)',
              color: '#0f172a',
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={addNote}
            disabled={!draft.trim()}
            style={{
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid rgba(148,163,184,0.35)',
              background: draft.trim() ? 'rgba(59,130,246,0.12)' : 'rgba(148,163,184,0.12)',
              color: '#0f172a',
              fontWeight: 900,
              cursor: draft.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            הוסף
          </button>
        </div>

        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          {sorted.length ? (
            sorted.map((n) => (
              <div
                key={n.id}
                style={{
                  borderRadius: 14,
                  border: '1px solid rgba(226,232,240,1)',
                  background: '#ffffff',
                  overflow: 'hidden',
                }}
              >
                <div style={{ padding: 10 }}>
                  <textarea
                    value={n.text}
                    onChange={(e) => updateNote(n.id, e.target.value)}
                    style={{
                      width: '100%',
                      minHeight: 64,
                      resize: 'vertical',
                      borderRadius: 10,
                      border: '1px solid rgba(226,232,240,1)',
                      padding: 8,
                      boxSizing: 'border-box',
                      background: 'rgba(248,250,252,1)',
                      color: '#0f172a',
                      outline: 'none',
                      fontWeight: 700,
                      lineHeight: 1.3,
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={() => deleteNote(n.id)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 10,
                        border: '1px solid rgba(239,68,68,0.30)',
                        background: 'rgba(239,68,68,0.10)',
                        color: '#7f1d1d',
                        fontWeight: 900,
                      }}
                      title="מחיקה"
                    >
                      מחק
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ color: '#64748b', fontSize: 13, padding: '6px 2px' }}>
              אין פתקיות עדיין.
            </div>
          )}
        </div>
        </div>
      )}
    </aside>
  )
}


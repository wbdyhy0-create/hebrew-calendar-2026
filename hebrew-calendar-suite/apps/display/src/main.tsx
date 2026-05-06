import { Component, StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './display-accessibility.css'
import App from './App.tsx'

class RootErrorBoundary extends Component<{ children: ReactNode }, { err: unknown }> {
  state = { err: null as unknown }

  static getDerivedStateFromError(err: unknown) {
    return { err }
  }

  componentDidCatch(err: unknown) {
    // eslint-disable-next-line no-console
    console.error('[display] root crash', err)
  }

  render() {
    if (!this.state.err) return this.props.children
    const msg =
      this.state.err instanceof Error ? `${this.state.err.name}: ${this.state.err.message}` : String(this.state.err)
    return (
      <div
        dir="rtl"
        style={{
          minHeight: '100vh',
          padding: 16,
          background: '#0b1220',
          color: '#e2e8f0',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 10 }}>שגיאה בתצוגה</div>
        <div style={{ opacity: 0.85, marginBottom: 12 }}>
          אם אתה רואה “מסך לבן”, זו השגיאה שגרמה לזה. אפשר לצלם ולשלוח.
        </div>
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            background: 'rgba(15,23,42,0.7)',
            border: '1px solid rgba(148,163,184,0.25)',
            borderRadius: 12,
            padding: 12,
            fontSize: 13,
            lineHeight: 1.4,
          }}
        >
          {msg}
        </pre>
      </div>
    )
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
)

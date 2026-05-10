import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

;(window as unknown as { __HC_SUITE_APP__?: string }).__HC_SUITE_APP__ = 'admin'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

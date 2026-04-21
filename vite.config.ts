import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_BUILD__: JSON.stringify(
      (() => {
        try {
          return execSync('git rev-parse --short HEAD').toString('utf8').trim()
        } catch {
          return 'unknown'
        }
      })(),
    ),
  },
  /** נדרש ל־Electron (טעינת index.html מ־file:// אחרי build). */
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
})

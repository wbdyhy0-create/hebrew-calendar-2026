import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

// In the `hebrew-calendar-2026` monorepo, shared web-trial UI lives under repo root `src/`
// (see `App.tsx` imports from `@hc2026-root/...`).
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const hc2026RootSrc = path.resolve(__dirname, '../../../src')
// Splash video is committed at repo root `public/splash.webm.mp4`, not under `apps/studio/public`.
const hc2026RootPublic = path.resolve(__dirname, '../../../public')
const publicDir = fs.existsSync(path.join(hc2026RootPublic, 'splash.webm.mp4'))
  ? hc2026RootPublic
  : 'public'

// https://vite.dev/config/
export default defineConfig({
  publicDir,
  resolve: {
    alias: {
      '@hc2026-root': hc2026RootSrc,
    },
    // Files under @hc2026-root live outside the workspace root. Rolldown
    // resolves their bare-specifier imports by traversing up from that path,
    // which misses the workspace node_modules. dedupe forces every one of
    // these packages to be resolved once from the studio's own node_modules.
    dedupe: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      '@hebcal/core',
      'hebcal',
      'date-fns',
      'html2canvas',
      'jspdf',
      'dompurify',
    ],
  },
  plugins: [
    react(),
    // Local-dev shim for `/api/*` so Publish works without `vercel dev`.
    {
      name: 'local-api-shim',
      configureServer(server) {
        let published: any = null

        server.middlewares.use(async (req, res, next) => {
          try {
            if (!req.url?.startsWith('/api/')) return next()

            if (req.url.startsWith('/api/publish-config')) {
              if (req.method !== 'POST') {
                res.statusCode = 405
                res.setHeader('content-type', 'application/json; charset=utf-8')
                res.end(JSON.stringify({ error: 'Method Not Allowed' }))
                return
              }

              const chunks: Buffer[] = []
              req.on('data', (c) => chunks.push(Buffer.from(c)))
              req.on('end', () => {
                try {
                  const raw = Buffer.concat(chunks).toString('utf8')
                  const parsed = JSON.parse(raw || '{}')
                  published = {
                    settings: parsed?.settings ?? {},
                    overrides: parsed?.overrides ?? {},
                    viewDate: typeof parsed?.viewDate === 'string' ? parsed.viewDate : undefined,
                    publishedAt: new Date().toISOString(),
                    source: 'vite-shim',
                  }
                  res.statusCode = 200
                  res.setHeader('content-type', 'application/json; charset=utf-8')
                  res.end(JSON.stringify({ ok: true, storage: 'vite-shim' }))
                } catch (e: any) {
                  res.statusCode = 400
                  res.setHeader('content-type', 'application/json; charset=utf-8')
                  res.end(JSON.stringify({ error: 'Bad JSON', detail: String(e?.message ?? e) }))
                }
              })
              return
            }

            if (req.url.startsWith('/api/export-config')) {
              if (req.method !== 'GET') {
                res.statusCode = 405
                res.setHeader('content-type', 'application/json; charset=utf-8')
                res.end(JSON.stringify({ error: 'Method Not Allowed' }))
                return
              }
              res.statusCode = 200
              res.setHeader('content-type', 'application/json; charset=utf-8')
              res.end(JSON.stringify(published ?? { settings: {}, overrides: {}, source: 'default' }))
              return
            }

            return next()
          } catch {
            return next()
          }
        })
      },
    },
  ],
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

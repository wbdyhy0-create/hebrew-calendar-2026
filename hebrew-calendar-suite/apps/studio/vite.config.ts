import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

// https://vite.dev/config/
export default defineConfig({
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

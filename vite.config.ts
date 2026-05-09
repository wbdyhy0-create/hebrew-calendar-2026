import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

function parseHc2026Codes(raw: string): Set<string> {
  const set = new Set<string>()
  if (!raw.trim()) return set
  for (const part of raw.split(',')) {
    const c = part.trim().replace(/\s+/g, '')
    if (c) set.add(c)
  }
  return set
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const devLicenseCodes = parseHc2026Codes(env.HC2026_PERPETUAL_CODES ?? '')

  return {
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

              if (req.url.startsWith('/api/validate-calendar-license')) {
                if (req.method !== 'POST') {
                  res.statusCode = 405
                  res.setHeader('content-type', 'application/json; charset=utf-8')
                  res.end(JSON.stringify({ ok: false, error: 'Method Not Allowed' }))
                  return
                }

                const chunks: Buffer[] = []
                req.on('data', (c) => chunks.push(Buffer.from(c)))
                req.on('end', () => {
                  try {
                    const raw = Buffer.concat(chunks).toString('utf8')
                    const parsed = JSON.parse(raw || '{}')
                    const codeStr =
                      typeof parsed?.code === 'string'
                        ? String(parsed.code).trim().replace(/\s+/g, '')
                        : ''
                    if (!codeStr) {
                      res.statusCode = 400
                      res.setHeader('content-type', 'application/json; charset=utf-8')
                      res.end(JSON.stringify({ ok: false, error: 'יש להזין קוד הפעלה' }))
                      return
                    }
                    if (devLicenseCodes.size === 0) {
                      res.statusCode = 503
                      res.setHeader('content-type', 'application/json; charset=utf-8')
                      res.end(
                        JSON.stringify({
                          ok: false,
                          error: 'השרת לא הוגדר לקבל קודים — הוסיפו HC2026_PERPETUAL_CODES ל־.env',
                        }),
                      )
                      return
                    }
                    if (!devLicenseCodes.has(codeStr)) {
                      res.statusCode = 403
                      res.setHeader('content-type', 'application/json; charset=utf-8')
                      res.end(JSON.stringify({ ok: false, error: 'קוד שגוי או לא פעיל' }))
                      return
                    }
                    res.statusCode = 200
                    res.setHeader('content-type', 'application/json; charset=utf-8')
                    res.end(JSON.stringify({ ok: true }))
                  } catch {
                    res.statusCode = 400
                    res.setHeader('content-type', 'application/json; charset=utf-8')
                    res.end(JSON.stringify({ ok: false, error: 'Bad JSON' }))
                  }
                })
                return
              }

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
    resolve: {
      alias: {
        // Calendar 2026 vendors the suite source tree; alias the workspace package so
        // studio imports (`@hebrew-calendar/shared`) work in a single-package Vercel build.
        '@hebrew-calendar/shared': path.resolve(
          path.dirname(fileURLToPath(import.meta.url)),
          'hebrew-calendar-suite/packages/shared/src/index.ts',
        ),
        // Production boots `studio`; license/trial shared modules live under repo `src/`.
        '@hc2026-root': path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'src'),
      },
    },
    /** נדרש ל־Electron (טעינת index.html מ־file:// אחרי build). */
    base: './',
    server: {
      port: 5173,
      strictPort: true,
    },
  }
})

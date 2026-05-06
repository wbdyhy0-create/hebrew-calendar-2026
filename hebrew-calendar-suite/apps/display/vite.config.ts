import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Local-dev shim for `/api/get-runtime-config` so Display works without `vercel dev`.
    {
      name: 'local-api-shim',
      configureServer(server) {
        const studioOrigin = (process.env.VITE_STUDIO_ORIGIN || 'http://localhost:5174').replace(
          /\/+$/,
          '',
        )

        server.middlewares.use(async (req, res, next) => {
          try {
            if (!req.url?.startsWith('/api/get-runtime-config')) return next()

            if (req.method && req.method !== 'GET') {
              res.statusCode = 405
              res.setHeader('content-type', 'application/json; charset=utf-8')
              res.end(JSON.stringify({ error: 'Method Not Allowed' }))
              return
            }

            const url = `${studioOrigin}/api/export-config`
            const r = await fetch(url, { headers: { accept: 'application/json' } })
            if (r.ok) {
              const text = await r.text()
              res.statusCode = 200
              res.setHeader('Cache-Control', 'no-store')
              res.setHeader('content-type', 'application/json; charset=utf-8')
              res.end(text || JSON.stringify({ settings: {}, overrides: {}, source: 'default' }))
              return
            }
          } catch {
            // fall through to default
          }

          res.statusCode = 200
          res.setHeader('Cache-Control', 'no-store')
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ settings: {}, overrides: {}, source: 'default' }))
        })
      },
    },
  ],
  define: {
    __APP_BUILD__: JSON.stringify(
      (() => {
        // Prefer Vercel-provided commit SHA in build environment.
        const sha =
          process.env.VERCEL_GIT_COMMIT_SHA ||
          process.env.GIT_COMMIT_SHA ||
          process.env.COMMIT_SHA ||
          ''
        return typeof sha === 'string' && sha ? sha.slice(0, 7) : 'unknown'
      })(),
    ),
  },
  server: {
    port: 5174,
    strictPort: true,
  },
})

/**
 * Vercel sometimes leaves `req.body` empty for JSON POST; without this, `tenantId` is lost and
 * every publish lands on the `default` tenant (all generic stations see it).
 */
export async function readJsonObjectBody(req) {
  const b = req.body
  if (b != null) {
    if (typeof b === 'string') {
      try {
        const o = JSON.parse(b)
        return o && typeof o === 'object' && !Array.isArray(o) ? o : {}
      } catch {
        return {}
      }
    }
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(b)) {
      try {
        const o = JSON.parse(b.toString('utf8'))
        return o && typeof o === 'object' && !Array.isArray(o) ? o : {}
      } catch {
        return {}
      }
    }
    if (typeof b === 'object' && !Array.isArray(b)) return b
  }

  if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH') return {}
  if (typeof req.on !== 'function') return {}
  // Body already consumed elsewhere; avoid waiting on a stream that will never emit.
  if (req.readableEnded === true || req.complete === true) return {}

  const chunks = []
  try {
    await new Promise((resolve, reject) => {
      req.on('data', (c) => {
        chunks.push(typeof c === 'string' ? Buffer.from(c) : Buffer.from(c))
      })
      req.on('end', resolve)
      req.on('error', reject)
    })
  } catch {
    return {}
  }
  if (!chunks.length) return {}
  try {
    const o = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {}
  } catch {
    return {}
  }
}

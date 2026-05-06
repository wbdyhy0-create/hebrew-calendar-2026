/** Same rules as Studio `sanitizeTenantIdForUi` — must match `api/_tenant.js` for KV keys. */
export function sanitizeTenantQueryId(raw: unknown): string {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (!s) return 'default'
  const cleaned = s
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
  return cleaned.slice(0, 64) || 'default'
}

export function sanitizeTenantQueryIdFromSearch(search: string): string {
  try {
    const raw = new URLSearchParams(search).get('tenant')
    return sanitizeTenantQueryId(raw)
  } catch {
    return 'default'
  }
}

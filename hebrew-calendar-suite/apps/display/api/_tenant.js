/**
 * Must match Studio `sanitizeTenantIdForUi` so publish keys align with Display `?tenant=`.
 */
export function sanitizeTenantId(raw) {
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

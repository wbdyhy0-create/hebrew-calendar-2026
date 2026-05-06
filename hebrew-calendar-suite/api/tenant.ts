export function sanitizeTenantId(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (!s) return 'default'
  // allow only safe URL/kv chars
  const cleaned = s.replace(/[^a-zA-Z0-9_-]/g, '')
  return cleaned || 'default'
}

export function tenantKvKey(tenantId: string, key: string) {
  const t = sanitizeTenantId(tenantId)
  return `${t}:${key}`
}


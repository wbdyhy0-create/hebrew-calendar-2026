export function sanitizeTenantId(raw: unknown): string {
  const s = String(raw ?? '').trim().toLowerCase()
  if (!s) return 'default'
  const cleaned = s.replace(/[^a-z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^[-_]+|[-_]+$/g, '')
  return cleaned.slice(0, 64) || 'default'
}

export function tenantKvKey(tenantId: string, key: string): string {
  const t = sanitizeTenantId(tenantId)
  return `tenant:${t}:${key}`
}


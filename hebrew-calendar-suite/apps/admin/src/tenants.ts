export type TenantBranding = {
  tenantId: string
  brandName: string
  brandAccentColor: string
  /** Can be a public URL or data URL */
  brandLogoUrl?: string
  departmentName?: string
}

// Simple static map (can later be replaced by KV/DB).
export const TENANTS: Record<string, TenantBranding> = {
  poalim: {
    tenantId: 'poalim',
    brandName: 'בנק הפועלים',
    brandAccentColor: '#E31B23',
    // brandLogoUrl: 'https://.../poalim-logo.png',
    departmentName: 'בנקאות',
  },
  leumi: {
    tenantId: 'leumi',
    brandName: 'בנק לאומי',
    brandAccentColor: '#1E40AF',
    // brandLogoUrl: 'https://.../leumi-logo.png',
    departmentName: 'בנקאות',
  },
}

export function getTenantFromUrlSearch(search: string): TenantBranding | null {
  try {
    const p = new URLSearchParams(search)
    const raw = String(p.get('tenant') ?? '').trim().toLowerCase()
    if (!raw) return null
    return TENANTS[raw] ?? null
  } catch {
    return null
  }
}


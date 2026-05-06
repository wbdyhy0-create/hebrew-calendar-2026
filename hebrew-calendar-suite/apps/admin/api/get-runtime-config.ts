import type { VercelRequest, VercelResponse } from '@vercel/node';

import { sanitizeTenantId, tenantKvKey } from './tenant.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  // Runtime config should reflect latest publish quickly.
  res.setHeader('Cache-Control', 'no-store');
  const tenantId = sanitizeTenantId((req.query as any)?.tenant);

  let kv: any;
  try {
    ({ kv } = await import('@vercel/kv'));
  } catch {
    res.status(200).json({ settings: {}, overrides: {}, source: 'kv-import-failed', tenantId });
    return;
  }

  try {
    const raw = await kv.get<any>(tenantKvKey(tenantId, 'current_config'));
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      res.status(200).json({ ...raw, tenantId });
      return;
    }
    if (typeof raw === 'string' && raw.trim()) {
      try {
        res.status(200).json({ ...(JSON.parse(raw) as any), tenantId });
      } catch {
        res.status(200).json({ settings: {}, overrides: {}, source: 'kv-string', tenantId });
      }
      return;
    }
  } catch {
    // ignore and fall back
  }

  res.status(200).json({
    settings: {},
    overrides: {},
    source: 'default',
    tenantId,
  });
}


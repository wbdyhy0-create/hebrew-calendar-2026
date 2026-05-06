import type { VercelRequest, VercelResponse } from '@vercel/node';

import { kv } from '@vercel/kv';
import { DEFAULT_SETTINGS } from '@hebrew-calendar/shared';

/**
 * Public endpoint used by Display to fetch the current config.
 *
 * Note: serverless functions cannot read browser localStorage.
 * For now we return the default settings, and allow an optional env override.
 *
 * If you set `EXPORT_CONFIG_JSON` in Vercel (Studio project), GET will return it.
 * Expected format: { "settings": { ... }, "overrides": { ... } }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  // First try published config from KV (preferred).
  // If KV isn't configured, it throws and we fall back to env/default.
  try {
    const raw = await kv.get<string>('current_config');
    if (typeof raw === 'string' && raw.trim()) {
      const parsed = JSON.parse(raw);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(parsed);
      return;
    }
  } catch {
    // ignore
  }

  const envJson = process.env.EXPORT_CONFIG_JSON;
  if (envJson && envJson.trim()) {
    try {
      const parsed = JSON.parse(envJson);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(parsed);
      return;
    } catch {
      // fall through
    }
  }

  // Best-effort default: settings only; overrides must be provided by a publishing mechanism.
  const settings = DEFAULT_SETTINGS;
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ settings, overrides: {}, source: 'default' });
}


import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

type PublishPayload = {
  settings: unknown;
  overrides: unknown;
  viewDate?: unknown;
};

const KV_KEY = 'current_config';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const secret = process.env.PUBLISH_SECRET;
  if (secret && req.headers['x-publish-secret'] !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const body = req.body as PublishPayload | undefined;
  const settings = body?.settings;
  const overrides = body?.overrides;
  const viewDate = body?.viewDate;

  if (!isPlainObject(settings) || !isPlainObject(overrides)) {
    res.status(400).json({ error: 'Invalid payload. Expected { settings: object, overrides: object }' });
    return;
  }
  if (viewDate !== undefined && typeof viewDate !== 'string') {
    res.status(400).json({ error: 'Invalid payload. Expected viewDate: ISO string (optional)' });
    return;
  }

  const payload = {
    settings,
    overrides,
    ...(typeof viewDate === 'string' ? { viewDate } : null),
    publishedAt: new Date().toISOString(),
  };

  try {
    await kv.set(KV_KEY, JSON.stringify(payload));
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: true, storage: 'kv', key: KV_KEY });
  } catch (e: any) {
    res.status(500).json({ error: 'KV write failed', detail: String(e?.message ?? e) });
  }
}


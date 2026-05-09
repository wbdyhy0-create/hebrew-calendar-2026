import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Env: HC2026_PERPETUAL_CODES — comma-separated perpetual unlock codes you issue to buyers.
 */
function parseAcceptedCodes(raw: string | undefined): Set<string> {
  const set = new Set<string>();
  if (!raw?.trim()) return set;
  for (const part of raw.split(',')) {
    const c = part.trim().replace(/\s+/g, '');
    if (c) set.add(c);
  }
  return set;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    return;
  }

  const body = req.body as unknown;
  const codeRaw = isPlainObject(body) && typeof body.code === 'string' ? body.code.trim() : '';
  const code = codeRaw.replace(/\s+/g, '');

  if (!code) {
    res.status(400).json({ ok: false, error: 'יש להזין קוד הפעלה' });
    return;
  }

  const accepted = parseAcceptedCodes(process.env.HC2026_PERPETUAL_CODES);
  if (accepted.size === 0) {
    res.status(503).json({ ok: false, error: 'השרת לא הוגדר לקבל קודים. פנה למנהל המערכת.' });
    return;
  }

  if (!accepted.has(code)) {
    res.status(403).json({ ok: false, error: 'קוד שגוי או לא פעיל' });
    return;
  }

  res.status(200).json({ ok: true });
}

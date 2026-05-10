import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Env: HC2026_PERPETUAL_CODES — comma-separated perpetual unlock codes you issue to buyers.
 * Env: HC2026_TRUSTED_EMBED_ORIGINS — comma-separated origins that can auto-unlock when embedded.
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

function parseTrustedOrigins(raw: string | undefined): Set<string> {
  const set = new Set<string>();
  if (!raw?.trim()) return set;
  for (const part of raw.split(',')) {
    const v = part.trim();
    if (!v) continue;
    // Normalize: keep only origin-like strings.
    // Allow inputs like "https://example.com" or "example.com" (we'll compare by prefix).
    set.add(v.replace(/\/+$/, ''));
  }
  return set;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function isTrustedEmbedRequest(req: VercelRequest, trusted: Set<string>): boolean {
  if (trusted.size === 0) return false;
  const origin = String(req.headers.origin ?? '').trim();
  const referer = String(req.headers.referer ?? '').trim();
  const src = origin || referer;
  if (!src) return false;

  for (const t of trusted) {
    if (!t) continue;
    // If admin entered a bare hostname, allow match on hostname occurrence.
    if (!t.startsWith('http://') && !t.startsWith('https://')) {
      if (src.includes(`://${t}`)) return true;
      if (src.includes(t)) return true;
      continue;
    }
    if (src.startsWith(t)) return true;
  }
  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    return;
  }

  const body = req.body as unknown;
  const codeRaw = isPlainObject(body) && typeof body.code === 'string' ? body.code.trim() : '';
  const code = codeRaw.replace(/\s+/g, '');

  // Trusted embed auto-unlock (no user code).
  if (!code) {
    const trusted = parseTrustedOrigins(process.env.HC2026_TRUSTED_EMBED_ORIGINS);
    if (isTrustedEmbedRequest(req, trusted)) {
      res.status(200).json({ ok: true, trustedEmbed: true });
      return;
    }
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

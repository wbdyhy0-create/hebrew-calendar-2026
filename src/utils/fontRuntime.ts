import type { StoredFont } from './fontStore';

function sanitizeFamily(name: string): string {
  const base = String(name || '').trim().slice(0, 60) || 'Uploaded Font';
  // Only keep simple characters to avoid CSS issues.
  return base.replace(/[^\p{L}\p{N}\s_-]+/gu, '').trim() || 'Uploaded Font';
}

export function makeUploadedFamilyName(fileName: string, id: string): string {
  const stem = fileName.replace(/\.[^.]+$/, '');
  return `${sanitizeFamily(stem)} (${id.slice(0, 6)})`;
}

export async function registerStoredFont(font: StoredFont): Promise<void> {
  // If already registered, skip.
  try {
    // Some browsers don't expose a direct lookup, so we attempt load+add and ignore duplicates.
    const face = new FontFace(font.family, font.data, { style: 'normal', weight: '400' });
    const loaded = await face.load();
    (document as any).fonts?.add?.(loaded);
  } catch {
    // ignore; the app can still work with fallbacks
  }
}


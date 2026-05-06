import type { StoredFont } from './fontStore';

function sanitizeFamily(name: string): string {
  const base = String(name || '').trim().slice(0, 60) || 'Uploaded Font';
  // Only keep simple characters to avoid CSS issues.
  return base.replace(/[^\p{L}\p{N}\s_-]+/gu, '').trim() || 'Uploaded Font';
}

export function makeUploadedFamilyName(fileName: string): string {
  const stem = fileName.replace(/\.[^.]+$/, '');
  // Try to normalize common "style/weight" suffixes so Regular/Bold files group under one family.
  const normalized = stem
    .replace(/[-_ ]?(regular|roman|book|normal)$/i, '')
    .replace(/[-_ ]?(bold|black|heavy|light|thin|medium|semibold|demibold|extrabold|ultrabold)$/i, '')
    .replace(/[-_ ]?(italic|oblique)$/i, '')
    .trim();
  return sanitizeFamily(normalized || stem);
}

export async function registerStoredFont(font: StoredFont): Promise<void> {
  // If already registered, skip.
  try {
    // Some browsers don't expose a direct lookup, so we attempt load+add and ignore duplicates.
    const face = new FontFace(font.family, font.data, {
      style: font.style || 'normal',
      weight: font.weight || '400',
    });
    const loaded = await face.load();
    (document as any).fonts?.add?.(loaded);
  } catch {
    // ignore; the app can still work with fallbacks
  }
}


export type DayTextOverride = {
  /** lines shown in the center of the cell (top-to-bottom) */
  centerLines: string[];
  /** pixel offsets inside the cell */
  centerOffsetX?: number; // -80..80
  centerOffsetY?: number; // -80..80
  centerAlign?: 'right' | 'center' | 'left';
  /** Optional image shown inside the cell (data URL). */
  imageDataUrl?: string;
  /** How the image fits the cell. */
  imageFit?: 'cover' | 'contain';
  /** 0..1 */
  imageOpacity?: number;
  /** pixel offsets for image focal point */
  imageOffsetX?: number; // px
  imageOffsetY?: number; // px
};

/** Keys are mostly `MM-dd` (same Gregorian month/day every year). Legacy `yyyy-MM-dd` keys are migrated on load. */
export type OverridesMap = Record<string, DayTextOverride>;

// Bump cache version to force a clean reset when data gets inconsistent.
const STORAGE_KEY = 'hebrew-gregorian-calendar:overrides:v2';

const ISO_FULL_KEY = /^\d{4}-\d{2}-\d{2}$/;
const MM_DD_KEY = /^\d{2}-\d{2}$/;

/** `MM-dd` recurring key from a full `yyyy-MM-dd` (any zero-padding). */
function toMmDdFromIsoYmd(isoYmd: string): string | null {
  const m = String(isoYmd ?? '')
    .trim()
    .match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  const mm = String(Number(m[2])).padStart(2, '0');
  const dd = String(Number(m[3])).padStart(2, '0');
  return `${mm}-${dd}`;
}

/** True when the user saved an override that intentionally shows no centered lines (hides auto holiday text). */
export function isCenterContentSuppressedByOverride(
  ovr: DayTextOverride | undefined,
): boolean {
  if (!ovr) return false;
  const lines = ovr.centerLines ?? [];
  if (lines.length === 0) return true;
  return lines.every((l) => !l.trim());
}

/** Storage key for recurring (all years) edits: `MM-dd` from a full `yyyy-MM-dd` day key. */
export function recurringOverrideKeyFromIsoDate(isoYmd: string): string {
  const md = toMmDdFromIsoYmd(isoYmd);
  if (md) return md;
  if (MM_DD_KEY.test(isoYmd)) return isoYmd;
  return isoYmd;
}

/** Resolve manual cell text for a concrete calendar day (full `yyyy-MM-dd`). */
export function resolveDayTextOverride(
  map: OverridesMap | undefined,
  isoYmd: string,
): DayTextOverride | undefined {
  if (!map) return undefined;
  const md = toMmDdFromIsoYmd(isoYmd);
  if (md) return map[md] ?? map[isoYmd];
  if (MM_DD_KEY.test(isoYmd)) return map[isoYmd];
  return map[isoYmd];
}

export function normalizeOverridesMapToRecurring(map: OverridesMap): OverridesMap {
  const out: OverridesMap = {};
  for (const [k, v] of Object.entries(map ?? {})) {
    if (MM_DD_KEY.test(k)) {
      out[k] = v;
    } else if (!ISO_FULL_KEY.test(k)) {
      out[k] = v;
    }
  }
  for (const [k, v] of Object.entries(map ?? {})) {
    const md = toMmDdFromIsoYmd(k);
    if (!md) continue;
    if (out[md] === undefined) out[md] = v;
  }
  return out;
}

export function loadOverrides(): OverridesMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as OverridesMap;
    const base = parsed && typeof parsed === 'object' ? parsed : {};
    const normalized = normalizeOverridesMapToRecurring(base);
    // Drop recurring / legacy entries that only had empty center lines — they suppressed
    // auto holiday text (e.g. הושענא רבה) every year; empty save now removes the key instead.
    // Keep image-only overrides.
    let changed = false;
    const emptySuppressorKeys: string[] = [];
    for (const [k, v] of Object.entries(normalized)) {
      const lines = Array.isArray(v?.centerLines) ? v.centerLines : [];
      const hasImg = typeof (v as any)?.imageDataUrl === 'string' && (v as any).imageDataUrl.length > 0;
      if (!hasImg && (lines.length === 0 || lines.every((ln) => !String(ln).trim()))) {
        emptySuppressorKeys.push(k);
      }
    }
    for (const k of emptySuppressorKeys) {
      delete normalized[k];
      changed = true;
    }
    // Cleanup: remove any saved "לעומר" lines from all recurring overrides (all years).
    for (const [k, v] of Object.entries(normalized)) {
      const lines = Array.isArray(v?.centerLines) ? v.centerLines : [];
      const nextLines = lines.filter((ln) => !String(ln).includes('לעומר'));
      if (nextLines.length !== lines.length) {
        normalized[k] = { ...v, centerLines: nextLines };
        changed = true;
      }
    }
    // One-time cleanup: drop legacy per-year keys from localStorage after migration.
    if (Object.keys(base).some((k) => ISO_FULL_KEY.test(k))) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      } catch {
        // ignore
      }
    }
    if (changed) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      } catch {
        // ignore
      }
    }
    return normalized;
  } catch {
    return {};
  }
}

export function saveOverrides(map: OverridesMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}


import type { CalendarSettings } from './settings';

export type StylePreset = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  settings: CalendarSettings;
};

const STORAGE_KEY = 'hebrew-gregorian-calendar:style-presets:v1';

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadStylePresets(): StylePreset[] {
  if (typeof window === 'undefined') return [];
  const parsed = safeParseJson<unknown>(window.localStorage.getItem(STORAGE_KEY));
  if (!Array.isArray(parsed)) return [];
  const items = parsed as any[];
  const out: StylePreset[] = [];
  for (const it of items) {
    if (!it || typeof it !== 'object') continue;
    if (typeof it.id !== 'string' || !it.id) continue;
    if (typeof it.name !== 'string' || !it.name.trim()) continue;
    if (typeof it.createdAt !== 'number' || !Number.isFinite(it.createdAt)) continue;
    if (typeof it.updatedAt !== 'number' || !Number.isFinite(it.updatedAt)) continue;
    if (!it.settings || typeof it.settings !== 'object') continue;
    out.push({
      id: it.id,
      name: it.name,
      createdAt: it.createdAt,
      updatedAt: it.updatedAt,
      settings: it.settings as CalendarSettings,
    });
  }
  // Newest first (more useful in UI).
  out.sort((a, b) => b.updatedAt - a.updatedAt);
  return out;
}

export function saveStylePresets(items: StylePreset[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

export function createPresetId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as any).randomUUID();
  }
  return `p_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}


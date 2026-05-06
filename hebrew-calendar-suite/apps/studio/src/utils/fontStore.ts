export type StoredFont = {
  id: string;
  family: string;
  fileName: string;
  /** CSS font-weight for this face (e.g. 400, 700). */
  weight?: string;
  /** CSS font-style for this face (normal/italic/oblique). */
  style?: string;
  mime: string;
  data: ArrayBuffer;
  createdAt: number;
};

const DB_NAME = 'hebrew-calendar-fonts';
const DB_VERSION = 1;
const STORE = 'fonts';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const store = t.objectStore(STORE);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
        t.oncomplete = () => db.close();
        t.onerror = () => {
          // ignore; request.onerror handles
        };
      }),
  );
}

export async function listStoredFonts(): Promise<Omit<StoredFont, 'data'>[]> {
  const db = await openDb();
  return await new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readonly');
    const store = t.objectStore(STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      const items = (req.result as StoredFont[]) ?? [];
      resolve(
        items
          .map((f) => ({
            id: f.id,
            family: f.family,
            fileName: f.fileName,
            weight: f.weight,
            style: f.style,
            mime: f.mime,
            createdAt: f.createdAt,
          }))
          .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)),
      );
    };
    req.onerror = () => reject(req.error ?? new Error('Failed to list fonts'));
    t.oncomplete = () => db.close();
  });
}

export async function getStoredFont(id: string): Promise<StoredFont | null> {
  const v = await tx<StoredFont | undefined>('readonly', (s) => s.get(id));
  return v ?? null;
}

export async function putStoredFont(font: StoredFont): Promise<void> {
  await tx('readwrite', (s) => s.put(font));
}

export async function deleteStoredFont(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
}

export async function deleteStoredFontsByFamily(family: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite');
    const store = t.objectStore(STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      const items = (req.result as StoredFont[]) ?? [];
      for (const it of items) {
        if (it.family === family) store.delete(it.id);
      }
    };
    req.onerror = () => reject(req.error ?? new Error('Failed to delete fonts by family'));
    t.oncomplete = () => {
      db.close();
      resolve();
    };
  });
}

export function cssFontFamilyForUploaded(family: string): string {
  // Keep same fallbacks as default.
  return `"${family.replaceAll('"', '')}", "Heebo", "Assistant", system-ui, -apple-system, "Segoe UI", Arial, sans-serif`;
}


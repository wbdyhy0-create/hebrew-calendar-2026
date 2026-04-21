export function downloadTextFile(
  filename: string,
  content: string,
  mime = 'text/plain;charset=utf-8',
) {
  const blob = new Blob([content], { type: mime });
  downloadBlobFile(filename, blob);
}

type SaveHandle = {
  createWritable: () => Promise<{
    write: (data: Blob | ArrayBuffer | ArrayBufferView | string) => Promise<void>;
    close: () => Promise<void>;
  }>;
};

declare global {
  interface Window {
    showSaveFilePicker?: (options?: unknown) => Promise<SaveHandle>;
  }
}

export async function requestSaveHandle(
  suggestedName: string,
  opts?: { mime?: string; description?: string; extensions?: string[] },
): Promise<SaveHandle | null> {
  const fn = window.showSaveFilePicker;
  if (typeof fn !== 'function') return null;
  const extensions = opts?.extensions?.length ? opts.extensions : [];
  const accept =
    opts?.mime && extensions.length
      ? {
          [opts.mime]: extensions.map((e) => (e.startsWith('.') ? e : `.${e}`)),
        }
      : undefined;
  try {
    return await fn({
      suggestedName,
      types: accept
        ? [
            {
              description: opts?.description ?? 'File',
              accept,
            },
          ]
        : undefined,
    });
  } catch (e) {
    // `showSaveFilePicker` is blocked in cross-origin iframes and some hardened Chrome setups.
    // Fall back to regular downloads instead of failing the action.
    const name = e instanceof Error ? e.name : '';
    if (name === 'SecurityError' || name === 'NotAllowedError') return null;
    return null;
  }
}

export async function saveBlobToHandle(handle: SaveHandle, blob: Blob) {
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}

export async function saveTextToHandle(
  handle: SaveHandle,
  content: string,
  mime = 'text/plain;charset=utf-8',
) {
  const blob = new Blob([content], { type: mime });
  await saveBlobToHandle(handle, blob);
}

export function isEmbeddedFrame(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function openInNewTab(url: string) {
  // Called directly from a user gesture (click) to avoid popup blockers.
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function openDownloadPopup(): Window | null {
  // Must be called synchronously from a click handler.
  // We intentionally do NOT set `noopener` so we can write into the popup.
  try {
    return window.open('', '_blank');
  } catch {
    return null;
  }
}

export function downloadBlobViaPopup(popup: Window, filename: string, blob: Blob) {
  if (!(blob instanceof Blob)) throw new Error('הורדה נכשלה: לא התקבל Blob תקין.');
  const url = URL.createObjectURL(blob);
  try {
    popup.document.open();
    popup.document.write(`<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>Downloading…</title></head>
  <body>
    <a id="dl" download="${String(filename).replaceAll('"', '&quot;')}" href="${url}">download</a>
    <script>
      const a = document.getElementById('dl');
      try { a.click(); } catch {}
      setTimeout(() => { try { window.close(); } catch {} }, 1200);
    </script>
  </body>
</html>`);
    popup.document.close();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}

export function downloadBlobFile(filename: string, blob: Blob) {
  if (!(blob instanceof Blob)) {
    throw new Error('הורדה נכשלה: לא התקבל Blob תקין.');
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  // Some Chrome configurations block `a.click()` without throwing; dispatch an event too.
  try {
    a.click();
  } catch {
    // ignore and try event dispatch below
  }
  try {
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  } catch {
    // ignore
  }
  a.remove();
  // Revoke after the click is dispatched.
  setTimeout(() => URL.revokeObjectURL(url), 250);
}


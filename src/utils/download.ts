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
}

export async function saveBlobToHandle(handle: SaveHandle, blob: Blob) {
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
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


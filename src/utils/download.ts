export function downloadTextFile(
  filename: string,
  content: string,
  mime = 'text/plain;charset=utf-8',
) {
  const blob = new Blob([content], { type: mime });
  downloadBlobFile(filename, blob);
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


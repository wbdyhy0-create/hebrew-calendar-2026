export function downloadBlobFile(filename: string, blob: Blob) {
  if (!(blob instanceof Blob)) {
    throw new Error('הורדה נכשלה: לא התקבל Blob תקין.')
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  try {
    a.click()
  } catch {
    // ignore and try event dispatch below
  }
  try {
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
  } catch {
    // ignore
  }
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 250)
}


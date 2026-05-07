const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('fs/promises');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    backgroundColor: '#ffffff',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL || process.env.ELECTRON_RENDERER_URL;
  if (devUrl) {
    win.loadURL(devUrl);
    win.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  const indexHtmlPath = path.join(__dirname, '..', 'dist', 'index.html');
  win.loadFile(indexHtmlPath);
}

app.whenReady().then(() => {
  ipcMain.handle('hg:save-json', async (_evt, payload) => {
    const suggestedName =
      payload && typeof payload.suggestedName === 'string' && payload.suggestedName.trim()
        ? payload.suggestedName.trim()
        : 'calendar-style.json';
    const content = payload && typeof payload.content === 'string' ? payload.content : '';
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'שמור JSON',
      defaultPath: suggestedName,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (canceled || !filePath) return { ok: true, canceled: true };
    await fs.writeFile(filePath, content, 'utf-8');
    return { ok: true, canceled: false, filePath };
  });

  ipcMain.handle('hg:open-json', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'פתח JSON',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (canceled || !filePaths || !filePaths[0]) return { ok: true, canceled: true };
    const filePath = filePaths[0];
    const content = await fs.readFile(filePath, 'utf-8');
    return { ok: true, canceled: false, filePath, content };
  });

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});


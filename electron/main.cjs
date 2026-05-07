const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');

const TRIAL_DAYS = 14;

function readAppMode() {
  try {
    const p = path.join(__dirname, 'appMode.json');
    const raw = fsSync.readFileSync(p, 'utf-8');
    const j = JSON.parse(raw);
    const mode = j && typeof j.mode === 'string' ? j.mode : 'full';
    return mode === 'trial' ? 'trial' : 'full';
  } catch {
    return 'full';
  }
}

function toYmdUtc(d) {
  const dt = new Date(d);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function getOrCreateTrialState() {
  const filePath = path.join(app.getPath('userData'), '.hg_trial.json');
  let raw = '';
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch {
    raw = '';
  }

  let installYmd = '';
  if (raw) {
    try {
      const j = JSON.parse(raw);
      if (j && typeof j.installYmd === 'string') installYmd = String(j.installYmd);
    } catch {
      // ignore
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(installYmd)) {
    installYmd = toYmdUtc(Date.now());
    try {
      await fs.writeFile(filePath, JSON.stringify({ installYmd }, null, 2), 'utf-8');
    } catch {
      // ignore
    }
  }

  return { filePath, installYmd };
}

function computeTrialStatus(installYmd) {
  // Compare in UTC to avoid DST/timezone drift.
  const installMs = Date.parse(`${installYmd}T00:00:00.000Z`);
  const nowYmd = toYmdUtc(Date.now());
  const nowMs = Date.parse(`${nowYmd}T00:00:00.000Z`);
  const daysUsed = Math.max(0, Math.floor((nowMs - installMs) / 86400000));
  const daysLeft = Math.max(0, TRIAL_DAYS - daysUsed);
  return {
    trialDays: TRIAL_DAYS,
    installYmd,
    nowYmd,
    daysUsed,
    daysLeft,
    expired: daysUsed >= TRIAL_DAYS,
  };
}

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
  ipcMain.handle('hg:trial-status', async () => {
    const mode = readAppMode();
    if (mode !== 'trial') return { ok: true, enabled: false };
    try {
      const st = await getOrCreateTrialState();
      const status = computeTrialStatus(st.installYmd);
      return { ok: true, enabled: true, ...status };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  });

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


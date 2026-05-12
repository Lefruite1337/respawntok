/**
 * main.js – Electron main process
 *
 * Responsibilities:
 *  - Enforce single instance (prevents port 3000 conflict)
 *  - Start the GSI HTTP server
 *  - Create the Dashboard window (always visible)
 *  - Create the TikTok Viewer window (hidden until death)
 *  - Show viewer on 'player-died', hide on 'player-respawn'
 *  - Register Alt+X global shortcut to dismiss viewer manually
 *  - System tray icon with context menu
 *  - Expose IPC endpoints so the renderer can trigger GSI install
 */

const { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, nativeImage, dialog } = require('electron');
const path = require('path');
const GSIServer = require('./gsi-server');
const { installGSIConfig, installDotaGSIConfig } = require('./gsi-installer');
const { autoUpdater } = require('electron-updater');

// ─── Single instance lock ─────────────────────────────────────────────────────

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  // Another instance is already running — focus it and exit immediately
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  if (dashboardWin) {
    if (dashboardWin.isMinimized()) dashboardWin.restore();
    dashboardWin.show();
    dashboardWin.focus();
  }
});

// ─── Icon path ────────────────────────────────────────────────────────────────

const ICON_PATH = path.join(__dirname, 'assets', 'icon.ico');

// ─── Windows ─────────────────────────────────────────────────────────────────

let dashboardWin = null;
let viewerWin    = null;
let tray         = null;

function createDashboard() {
  dashboardWin = new BrowserWindow({
    width: 900,
    height: 620,
    minWidth: 700,
    minHeight: 500,
    title: 'RespawnTok',
    icon: ICON_PATH,
    backgroundColor: '#0f0f0f',
    webPreferences: {
      preload: path.join(__dirname, 'renderer', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  dashboardWin.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Minimise to tray instead of closing
  dashboardWin.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      dashboardWin.hide();
    }
  });

  dashboardWin.on('closed', () => { dashboardWin = null; });
}

function createViewer() {
  viewerWin = new BrowserWindow({
    width: 720,
    height: 920,
    frame: false,
    alwaysOnTop: true,
    show: false,          // hidden until death
    skipTaskbar: true,
    icon: ICON_PATH,
    title: 'RespawnTok – TikTok',
    webPreferences: {
      webviewTag: true,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  viewerWin.loadFile(path.join(__dirname, 'renderer', 'viewer.html'));
  viewerWin.on('closed', () => { viewerWin = null; });
}

function createTray() {
  const icon = nativeImage.createFromPath(ICON_PATH).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('RespawnTok');

  const menu = Menu.buildFromTemplate([
    {
      label: 'Show Dashboard',
      click: () => {
        dashboardWin?.show();
        dashboardWin?.focus();
      },
    },
    { type: 'separator' },
    {
      label: 'Pause / Resume Popup',
      click: togglePause,
    },
    { type: 'separator' },
    {
      label: 'Quit RespawnTok',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(menu);
  tray.on('double-click', () => {
    dashboardWin?.show();
    dashboardWin?.focus();
  });
}

// ─── Fade helpers ─────────────────────────────────────────────────────────────

const FADE_STEPS    = 12;
const FADE_INTERVAL = 16; // ms per step (~60 fps), total ~200ms

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fadeIn(win) {
  win.setOpacity(0);
  win.setAlwaysOnTop(true, 'screen-saver');
  win.show();
  win.moveTop();
  win.focus();
  for (let i = 1; i <= FADE_STEPS; i++) {
    win.setOpacity(i / FADE_STEPS);
    await sleep(FADE_INTERVAL);
  }
}

async function fadeOut(win) {
  for (let i = FADE_STEPS - 1; i >= 0; i--) {
    if (!win || win.isDestroyed()) return;
    win.setOpacity(i / FADE_STEPS);
    await sleep(FADE_INTERVAL);
  }
  if (!win || win.isDestroyed()) return;
  win.hide();
  win.setOpacity(1);
}

// ─── GSI ─────────────────────────────────────────────────────────────────────

let gsiInstance = null;
let paused      = false;

function startGSI() {
  const gsi = new GSIServer();

  gsi.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      dialog.showErrorBox(
        'Port 3000 already in use',
        'Another app (or a previous RespawnTok instance) is using port 3000.\n\n' +
        'Close the other app and restart RespawnTok.'
      );
      app.quit();
    }
  });

  gsi.start();
  gsiInstance = gsi;

  let tiktokLoaded = false;

  function sendLog(source, message) {
    const entry = { time: new Date().toLocaleTimeString(), source, message };
    dashboardWin?.webContents.send('gsi-log', entry);
  }

  gsi.on('player-died', () => {
    sendLog('GSI', 'Player died – health reached 0');
    if (!viewerWin || paused) return;
    if (!tiktokLoaded) {
      tiktokLoaded = true;
      viewerWin.webContents.executeJavaScript(
        `document.getElementById('tiktok').src = 'https://www.tiktok.com/foryou';`
      );
    }
    fadeIn(viewerWin);
    dashboardWin?.webContents.send('gsi-status', 'DEAD');
  });

  gsi.on('player-respawn', () => {
    sendLog('GSI', 'Player respawned – health restored');
    if (viewerWin) fadeOut(viewerWin);
    dashboardWin?.webContents.send('gsi-status', paused ? 'PAUSED' : 'ALIVE');
  });

  gsiInstance._sendLog = sendLog;
}

// ─── IPC handlers ────────────────────────────────────────────────────────────

ipcMain.handle('install-gsi', async () => installGSIConfig());
ipcMain.handle('install-dota-gsi', async () => installDotaGSIConfig());

// Shared toggle used by both Alt+X and the dashboard button
function togglePause() {
  paused = !paused;
  if (paused) {
    if (viewerWin) fadeOut(viewerWin);
    dashboardWin?.webContents.send('gsi-status', 'PAUSED');
  } else {
    // If the player is still dead, show the viewer immediately on unpause
    if (gsiInstance?._isDead && viewerWin) {
      fadeIn(viewerWin);
      dashboardWin?.webContents.send('gsi-status', 'DEAD');
    } else {
      dashboardWin?.webContents.send('gsi-status', 'ALIVE');
    }
  }
}

ipcMain.handle('dismiss-viewer', togglePause);

ipcMain.handle('simulate-gsi', (_e, { health, game }) => {
  if (!gsiInstance) return { ok: false, error: 'GSI not started' };
  const hp = Number(health);
  if (isNaN(hp) || hp < 0 || hp > 100) return { ok: false, error: 'Health must be 0-100' };

  let fakePayload;
  if (game === 'dota2') {
    fakePayload = {
      provider: { steamid: 'TEST_MODE', appid: 570 },
      player:   { steamid: 'TEST_MODE' },
      hero:     { alive: hp > 0, health: hp, max_health: 100 },
    };
    gsiInstance._sendLog('SIM', `[Dota 2] hero.alive=${hp > 0} (hp=${hp})`);
  } else {
    fakePayload = {
      provider: { steamid: 'TEST_MODE', appid: 730 },
      player:   { steamid: 'TEST_MODE', state: { health: hp } },
    };
    gsiInstance._sendLog('SIM', `[CS2] health=${hp}`);
  }

  gsiInstance._handlePayload(fakePayload);
  return { ok: true };
});

// ─── Auto-updater ─────────────────────────────────────────────────────────────

function setupAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  const send = (event, data) => dashboardWin?.webContents.send(event, data);

  autoUpdater.on('checking-for-update',  ()     => send('update-status', { state: 'checking' }));
  autoUpdater.on('update-not-available', ()     => send('update-status', { state: 'up-to-date' }));
  autoUpdater.on('update-available',     (info) => send('update-status', { state: 'available', version: info.version }));
  autoUpdater.on('download-progress',    (prog) => send('update-status', { state: 'downloading', percent: Math.floor(prog.percent) }));
  autoUpdater.on('update-downloaded',    (info) => send('update-status', { state: 'ready', version: info.version }));
  autoUpdater.on('error',                (err)  => send('update-status', { state: 'error', message: err.message }));

  autoUpdater.checkForUpdates();
  setInterval(() => autoUpdater.checkForUpdates(), 2 * 60 * 60 * 1000);
}

ipcMain.handle('is-packaged',    () => app.isPackaged);
ipcMain.handle('install-update', () => autoUpdater.quitAndInstall(false, true));

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createDashboard();
  createViewer();
  createTray();
  startGSI();
  setupAutoUpdater();

  globalShortcut.register('Alt+X', togglePause);
});

app.on('before-quit', () => {
  app.isQuitting = true;
  globalShortcut.unregisterAll();
  gsiInstance?.stop();
});

app.on('will-quit', () => {
  // Force-exit so no ghost Electron process or occupied port lingers
  setImmediate(() => process.exit(0));
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (!dashboardWin) createDashboard();
});

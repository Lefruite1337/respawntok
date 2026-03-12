/**
 * main.js – Electron main process
 *
 * Responsibilities:
 *  - Start the GSI HTTP server
 *  - Create the Dashboard window (always visible)
 *  - Create the TikTok Viewer window (hidden until death)
 *  - Show viewer on 'player-died', hide on 'player-respawn'
 *  - Register Alt+X global shortcut to dismiss viewer manually
 *  - Expose IPC endpoints so the renderer can trigger GSI install
 */

const { app, BrowserWindow, globalShortcut, ipcMain, shell } = require('electron');
const path = require('path');
const GSIServer = require('./gsi-server');
const { installGSIConfig, installDotaGSIConfig } = require('./gsi-installer');
const { autoUpdater } = require('electron-updater');

// ─── Windows ─────────────────────────────────────────────────────────────────

let dashboardWin = null;
let viewerWin = null;

function createDashboard() {
  dashboardWin = new BrowserWindow({
    width: 900,
    height: 620,
    minWidth: 700,
    minHeight: 500,
    title: 'RespawnTok',
    backgroundColor: '#0f0f0f',
    webPreferences: {
      preload: path.join(__dirname, 'renderer', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  dashboardWin.loadFile(path.join(__dirname, 'renderer', 'index.html'));
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
    title: 'RespawnTok – TikTok',
    webPreferences: {
      // webviewTag must be true so the <webview> in viewer.html works
      webviewTag: true,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  viewerWin.loadFile(path.join(__dirname, 'renderer', 'viewer.html'));

  viewerWin.on('closed', () => { viewerWin = null; });
}

// ─── Fade helpers ─────────────────────────────────────────────────────────────

const FADE_STEPS = 12;
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
let paused = false;

function startGSI() {
  const gsi = new GSIServer().start();
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

  // Attach sendLog so the simulate-gsi IPC handler can call it
  gsiInstance._sendLog = sendLog;
}

// ─── IPC handlers ────────────────────────────────────────────────────────────

ipcMain.handle('install-gsi', async () => {
  return installGSIConfig();
});

ipcMain.handle('install-dota-gsi', async () => {
  return installDotaGSIConfig();
});

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

// ─── App lifecycle ────────────────────────────────────────────────────────────

// ─── Auto-updater ─────────────────────────────────────────────────────────────

function setupAutoUpdater() {
  // Only run in packaged builds — dev mode has no update server
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  const send = (event, data) => dashboardWin?.webContents.send(event, data);

  autoUpdater.on('checking-for-update',  ()      => send('update-status', { state: 'checking' }));
  autoUpdater.on('update-not-available', ()      => send('update-status', { state: 'up-to-date' }));
  autoUpdater.on('update-available',     (info)  => send('update-status', { state: 'available', version: info.version }));
  autoUpdater.on('download-progress',    (prog)  => send('update-status', { state: 'downloading', percent: Math.floor(prog.percent) }));
  autoUpdater.on('update-downloaded',    (info)  => send('update-status', { state: 'ready', version: info.version }));
  autoUpdater.on('error',                (err)   => send('update-status', { state: 'error', message: err.message }));

  // Check on launch, then every 2 hours
  autoUpdater.checkForUpdates();
  setInterval(() => autoUpdater.checkForUpdates(), 2 * 60 * 60 * 1000);
}

ipcMain.handle('is-packaged', () => app.isPackaged);

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall(false, true);
});

app.whenReady().then(() => {
  createDashboard();
  createViewer();
  startGSI();
  setupAutoUpdater();

  // Alt+X – toggle paused mode (disables auto-popup until pressed again)
  globalShortcut.register('Alt+X', togglePause);
});

app.on('before-quit', () => {
  gsiInstance?.stop();
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (!dashboardWin) createDashboard();
});

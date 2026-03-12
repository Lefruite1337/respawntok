/**
 * preload.js – Context bridge between renderer and main process
 * Exposes a safe, narrow API to the dashboard renderer.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('respawnTok', {
  installGSI: () => ipcRenderer.invoke('install-gsi'),
  installDotaGSI: () => ipcRenderer.invoke('install-dota-gsi'),
  dismissViewer: () => ipcRenderer.invoke('dismiss-viewer'),
  simulateGSI: (health, game) => ipcRenderer.invoke('simulate-gsi', { health, game }),
  onStatusChange: (callback) => ipcRenderer.on('gsi-status', (_e, status) => callback(status)),
  onLog: (callback) => ipcRenderer.on('gsi-log', (_e, entry) => callback(entry)),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_e, info) => callback(info)),
  installUpdate: () => ipcRenderer.invoke('install-update'),
});

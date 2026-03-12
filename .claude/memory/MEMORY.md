# RespawnTok – Project Memory

## Overview
Electron + Node.js desktop app (Windows target) that shows TikTok feed on CS2/Dota2 death via Valve Game State Integration (GSI). VAC-safe (no game memory reading).

## File Structure
```
respawntok/
├── package.json          # electron + express deps
├── main.js               # Electron main: window management, GSI events, globalShortcut
├── gsi-server.js         # Express server :3000, health transition detection, EventEmitter
├── gsi-installer.js      # Steam path via reg query + fallbacks, writes .cfg file
└── renderer/
    ├── preload.js        # contextBridge: installGSI, dismissViewer, onStatusChange
    ├── index.html        # Dashboard: Status / Setup Guide / Settings tabs
    ├── style.css         # TikTok-themed dark UI (red #fe2c55, teal #25f4ee)
    ├── renderer.js       # Tab nav, install button, live status updates
    └── viewer.html       # Frameless viewer: left ad | TikTok webview | right ad
```

## Key Design Decisions
- GSI server listens on 127.0.0.1:3000 only (security)
- Health transition tracked via `_prevHealth` / `_isDead` flags to avoid repeat events
- Viewer window: `frame:false, alwaysOnTop:true, show:false, skipTaskbar:true`
- TikTok webview uses `partition="persist:tiktok"` so login persists
- Alt+X globalShortcut registered in main.js for manual viewer dismiss
- contextIsolation:true + preload.js (no nodeIntegration in renderer)

## Install / Run
```bash
cd /home/lefruite/projects/respawntok
npm install
npm start          # launches Electron app
```

## PoC Gaps (not yet implemented)
- Dota 2 GSI support
- System volume muting (game mute on death)
- Real ads (AdSense/Carbon)
- Stripe license key validation (currently local regex stub)
- electron-store for settings persistence
- Startup autolaunch

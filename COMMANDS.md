# RespawnTok – Commands Reference

## Prerequisites

- **Node.js** v22+ — https://nodejs.org
- **npm** v10+ (bundled with Node)
- **Windows Developer Mode** ON — required for the full NSIS installer build
  - Settings → System → For developers → Developer Mode → On
  - Without it, `npm run build` will fail on the code-sign tooling step (symlinks)
  - `npx electron-builder --win --dir` works without it (unpacked only)

---

## Development

```bash
# First time / after pulling
npm install

# Run the app in dev mode (hot-reload not included, just launches Electron)
npm start

# Regenerate app icon from assets/icon.svg
npm run build-icon
```

**Dev notes:**
- Test Mode tab is visible in dev (`npm start`) and hidden in production builds
- GSI server starts automatically on port 3000
- Alt+X toggles pause globally while the app is running

---

## Build

### Option A — Full NSIS installer (requires Developer Mode)

```bash
npm run build
```

Output in `dist/`:
```
dist/
├── win-unpacked/          # portable, no install needed
│   └── RespawnTok.exe
└── RespawnTok Setup 1.0.0.exe   # one-click installer
```

> `npm run build` also auto-regenerates `assets/icon.ico` before building.

### Option B — Unpacked only (no Developer Mode needed)

```bash
npx electron-builder --win --dir
```

Output: `dist/win-unpacked/` only. No installer generated.

---

## Zip for R2 upload

```bash
cd dist
powershell -Command "Compress-Archive -Path win-unpacked -DestinationPath release.zip -Force"
```

Upload `dist/release.zip` to your R2 bucket at:
`https://download.respawntok.com/release.zip`

---

## Site (Cloudflare Pages)

The `site/` folder is plain HTML/CSS/JS — **no build step**.

Cloudflare Pages config:
| Field | Value |
|---|---|
| Repository | `Lefruite1337/respawntok` |
| Branch | `master` |
| Root directory | `site` |
| Build command | *(leave empty)* |
| Output directory | `site` |

**Deploys automatically on every `git push` to `master`.** No deploy command needed.

---

## Release checklist

1. Bump `"version"` in `package.json`
2. Update version badge in `renderer/index.html` sidebar footer
3. Run `npm run build` (or `--dir` + zip manually)
4. Upload `dist/release.zip` to R2
5. Update size/version text in `site/index.html` download section if needed
6. `git add`, `git commit`, `git push` → Cloudflare Pages auto-deploys

---

## File structure

```
respawntok/
├── main.js               # Electron main: windows, GSI events, shortcuts, IPC
├── gsi-server.js         # Express :3000, health transition detection
├── gsi-installer.js      # Steam path via registry, writes .cfg files
├── assets/
│   ├── icon.svg          # Source logo (edit this)
│   ├── icon.png          # Generated — do not edit directly
│   └── icon.ico          # Generated — do not edit directly
├── scripts/
│   └── build-icon.js     # SVG → PNG + ICO converter
├── renderer/
│   ├── preload.js        # contextBridge API surface
│   ├── index.html        # Dashboard UI
│   ├── style.css         # Dashboard styles
│   ├── renderer.js       # Dashboard logic
│   └── viewer.html       # Frameless TikTok viewer window
└── site/                 # Cloudflare Pages marketing site
    ├── index.html
    ├── style.css
    ├── main.js
    └── logo.png
```

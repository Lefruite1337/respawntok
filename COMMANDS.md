# RespawnTok – Commands Reference

## Development

```bash
npm install        # install dependencies (first time / after pulling)
npm start          # run the Electron app in dev mode (no build needed)
```

## Build (Windows installer + unpacked)

```bash
# Full NSIS installer — requires Developer Mode ON in Windows Settings
# (needed so electron-builder can create symlinks for its signing tools)
npm run build

# Output:
#   dist/win-unpacked/   – unpacked exe, ready to run
#   dist/RespawnTok Setup 1.0.0.exe  – NSIS installer

# Skip installer, just produce the unpacked folder (no symlink privilege needed)
npx electron-builder --win --dir
```

> **Note:** `node_modules/` and `dist/` are gitignored — never commit them.

## Zip for distribution (R2 / manual upload)

```bash
cd dist
powershell -Command "Compress-Archive -Path win-unpacked -DestinationPath release.zip -Force"
```

## Cloudflare Pages (site/)

The `site/` folder is a static site with no build step.

**Cloudflare Pages settings:**
| Field | Value |
|---|---|
| Root directory | `site` |
| Build command | *(leave empty)* |
| Output directory | `site` |

Connect your GitHub repo, set root to `site/`, and Pages will deploy on every push to `master`.

**To update the download link** after uploading a new `release.zip` to R2, edit `site/index.html` line 211:
```html
<a href="https://download.respawntok.com/release.zip" class="btn btn-primary btn-lg">
```

## Release checklist

1. Bump version in `package.json` → `"version"`
2. `npm run build` (or `--dir` + zip)
3. Upload `dist/release.zip` (or the `.exe`) to R2
4. Update the download `href` in `site/index.html`
5. Push to `master` → Cloudflare Pages auto-deploys the site

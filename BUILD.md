# Build Guide — Spooky's SkyrimNet Prompt Tuner

## Architecture

The desktop app is an **Electron** shell around a **Next.js** server:

```
┌─────────────────────────────────────────────────────┐
│  Electron (main process)                            │
│  • Sets SKYRIMNET_DATA_DIR, SKYRIMNET_ORIGINALS_DIR │
│  • require()s the Next.js standalone server.js      │
│  • Polls /api/health until server is ready          │
│  • Opens BrowserWindow → http://127.0.0.1:3737      │
└─────────────────────────────────────────────────────┘
         ↕ http (loopback only)
┌─────────────────────────────────────────────────────┐
│  Next.js standalone server (runs in same process)   │
│  • API routes handle all file I/O                   │
│  • Reads SKYRIMNET_DATA_DIR / SKYRIMNET_ORIGINALS_DIR│
└─────────────────────────────────────────────────────┘
```

### Data separation (enables in-place updates)

| Location | Contents | Updated? |
|---|---|---|
| `resources/server/` (inside app) | Next.js server bundle | Yes — overwritten on update |
| `resources/reference-docs/` (inside app) | Original SkyrimNet prompts | Yes — overwritten on update |
| `data/` (next to exe) | `edited-prompts/` — user's custom prompt sets | **Never** — preserved on update |
| Browser localStorage | UI settings, profiles, API keys | **Never** — stored in user profile |

---

## Prerequisites

Install once:

```
# From project root
npm install          # installs electron + electron-builder

# From prompt-tuner/
npm install          # installs Next.js app dependencies
```

---

## Build Steps

### 1. Full build (Next.js + package)

```bash
# From project root
npm run package
```

This runs:
1. `cd prompt-tuner && npm run build` — Next.js production build with `output: "standalone"`
2. `node scripts/copy-static.js` — copies `public/` and `.next/static/` into the standalone output
3. `electron-builder --win` — packages into `builds/`

### 2. Quick re-package (skip Next.js rebuild)

Use this when you only changed `electron/main.js` or `electron-builder.yml`:

```bash
npm run package:fast
```

---

## Output

```
builds/
├── SkyrimNet-Prompt-Tuner-{version}-win-x64.zip   ← distribute this
└── win-unpacked/                                   ← local test build
```

The zip contains everything needed to run — no install required.

---

## Preparing a Release

1. Update the version in **`package.json`** (root):
   ```json
   { "version": "1.0.1" }
   ```

2. Add an app icon (if not already done — see [Icon](#icon) below).

3. Build:
   ```bash
   npm run package
   ```

4. Copy the zip from `builds/` to `releases/`:
   ```bash
   cp "builds/SkyrimNet-Prompt-Tuner-1.0.1-win-x64.zip" "releases/"
   ```

5. Commit `releases/` and tag:
   ```bash
   git add releases/
   git commit -m "Release v1.0.1"
   git tag v1.0.1
   git push && git push --tags
   ```

6. Create a GitHub Release pointing to the tag and attach the zip.

---

## Icon

Place a `256×256` (or multi-size) `.ico` file at:

```
electron/assets/icon.ico
```

To convert `prompt-tuner/public/spookys-icon.png` → `icon.ico` you can use
[ImageMagick](https://imagemagick.org) or any online converter:

```bash
magick spookys-icon.png -resize 256x256 electron/assets/icon.ico
```

If `icon.ico` is missing, the app uses Electron's default icon — the build will
still succeed.

---

## Version Naming Convention

```
SkyrimNet-Prompt-Tuner-{MAJOR}.{MINOR}.{PATCH}-win-x64.zip
```

- **MAJOR** — breaking changes to prompt format or major feature rewrites
- **MINOR** — new features (new tabs, new tools, etc.)
- **PATCH** — bug fixes, tweaks, prompt updates

---

## Folder Reference

```
spookys-skyrimnet-prompt-tuner/
├── electron/
│   ├── main.js              Electron entry — starts server, opens window
│   ├── preload.js           Renderer preload (minimal)
│   └── assets/
│       └── icon.ico         App icon (add before releasing)
├── prompt-tuner/            Next.js app source
│   ├── next.config.ts       output: "standalone" enables packaging
│   └── src/
│       └── lib/files/paths.ts  Reads SKYRIMNET_* env vars at runtime
├── scripts/
│   └── copy-static.js       Copies static assets into standalone output
├── reference-docs/          Original SkyrimNet prompts (bundled in app)
├── builds/                  (gitignored) dev/test builds
├── releases/                (committed) GitHub release zips
├── package.json             Root — electron + electron-builder deps
└── electron-builder.yml     Packaging config
```

---

## How Updates Work (for end users)

1. Download the new `SkyrimNet-Prompt-Tuner-{version}-win-x64.zip`
2. Extract to a **temp folder** (e.g., Desktop)
3. Copy everything from the temp folder into the existing install folder,
   **overwriting** when prompted
4. The `data/` folder next to the exe is untouched — all prompt sets preserved

Alternatively: extract to a fresh folder and copy the `data/` folder over from
the old install.

---

## Troubleshooting

**"Server startup timed out" on launch**
The Next.js server failed to start. Check:
- Is `builds/win-unpacked/resources/server/server.js` present?
- Did the build complete without errors?
- Is port 3737 already in use? (another instance running)

**App opens to a blank page**
Static assets may be missing. Re-run the full build:
```bash
npm run package
```

**`electron` command not found**
```bash
npm install   # from project root
```

**Build fails: `Cannot create symbolic link` / winCodeSign exit status 2**
electron-builder v25 downloads `winCodeSign-2.6.0.7z` which contains macOS symlinks
(`libcrypto.dylib`, `libssl.dylib`). On Windows without Developer Mode, 7-zip can't
create symlinks and exits with code 2, which the Go binary treats as failure.

**Fix (already applied in this repo):** Two patches in `node_modules/`:

1. `node_modules/app-builder-lib/out/winPackager.js` — the `prepareWindowsExecutableArgs`
   method now tries `rcedit-x64.exe` from a pre-extracted winCodeSign cache directory
   (`%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\009839067`) before falling back to
   the Go binary's internal download. Set env var `WINCOSIGN_PATH` to override the cache dir.

2. `node_modules/app-builder-lib/out/binDownload.js` — `getBin("winCodeSign")` is
   short-circuited to return the pre-extracted path directly. Set env var `WINCOSIGN_PATH`
   to override.

The Windows tools (`rcedit-x64.exe`, `signtool.exe`) are fully extracted even when the
macOS symlinks fail. Only 2 macOS-specific symlinks are missing — irrelevant on Windows.

**If `node_modules/` is reinstalled** (these patches get wiped):
1. Run `npm run package:fast` once — it will fail but extract the Windows tools
2. Check `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\` for the newest hash dir
3. Update the hardcoded hash in `winPackager.js` and `binDownload.js` to match
4. OR enable Windows Developer Mode (Settings → Privacy & Security → Developer Mode)
   which allows 7-zip to create symlinks — no patch needed

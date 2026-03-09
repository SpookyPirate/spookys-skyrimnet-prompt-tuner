"use strict";

const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const http = require("http");
const fs = require("fs");

const isDev = !app.isPackaged;
const PORT = 3737;

// ── Resolve runtime paths ────────────────────────────────────────────────────
//
// DATA_DIR   — writable user data (edited-prompts, etc.). Survives updates.
//   Dev:      project root  (one level above electron/)
//   Packaged: data/ folder next to the exe
//
// RESOURCES_DIR — bundled read-only assets (Next.js server, reference-docs).
//   Dev:      project root
//   Packaged: Electron's process.resourcesPath

const exeDir =
  process.env.PORTABLE_EXECUTABLE_DIR || // portable .exe target
  path.dirname(app.getPath("exe"));       // zip/dir target

const DATA_DIR = isDev
  ? path.resolve(__dirname, "..")
  : path.join(exeDir, "data");

const RESOURCES_DIR = isDev
  ? path.resolve(__dirname, "..")
  : process.resourcesPath;

// Next.js standalone server
const SERVER_DIR = isDev
  ? path.join(__dirname, "..", "prompt-tuner", ".next", "standalone")
  : path.join(RESOURCES_DIR, "server");

const SERVER_ENTRY = path.join(SERVER_DIR, "server.js");

// Original SkyrimNet prompts (bundled read-only)
const ORIGINALS_DIR = path.join(
  RESOURCES_DIR,
  "reference-docs",
  "original-prompts"
);

// ── Start Next.js server (runs in main process) ──────────────────────────────
function startServer() {
  // Ensure user data directories exist on first run
  fs.mkdirSync(path.join(DATA_DIR, "edited-prompts"), { recursive: true });

  // Set env vars that paths.ts reads at server startup
  process.env.SKYRIMNET_DATA_DIR = DATA_DIR;
  process.env.SKYRIMNET_ORIGINALS_DIR = ORIGINALS_DIR;
  process.env.PORT = String(PORT);
  process.env.HOSTNAME = "127.0.0.1";
  process.env.NODE_ENV = "production";
  process.env.NEXT_TELEMETRY_DISABLED = "1";

  // Next.js standalone server requires cwd = its own directory
  process.chdir(SERVER_DIR);

  // Start server directly in main process (Electron IS Node.js)
  require(SERVER_ENTRY);
}

// ── Wait for server to accept connections ────────────────────────────────────
function waitForServer(timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const attempt = () => {
      http
        .get(`http://127.0.0.1:${PORT}/api/health`, (res) => {
          if (res.statusCode < 500) {
            resolve();
          } else if (Date.now() < deadline) {
            setTimeout(attempt, 400);
          } else {
            reject(new Error("Server startup timed out"));
          }
        })
        .on("error", () => {
          if (Date.now() < deadline) setTimeout(attempt, 400);
          else reject(new Error("Server startup timed out"));
        });
    };
    // Give the server a moment to bind before first poll
    setTimeout(attempt, 800);
  });
}

// ── Create browser window ────────────────────────────────────────────────────
function createWindow() {
  const iconPath = path.join(__dirname, "assets", "icon.ico");
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    autoHideMenuBar: true,
    title: "Spooky's SkyrimNet Prompt Tuner",
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.loadURL(`http://127.0.0.1:${PORT}`);

  // Open all target=_blank links in the system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

// ── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  try {
    startServer();
  } catch (err) {
    console.error("Server failed to start:", err);
  }
  try {
    await waitForServer();
  } catch (err) {
    console.error("Server not responding:", err);
  }
  createWindow();
});

app.on("window-all-closed", () => {
  app.quit();
});

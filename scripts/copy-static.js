/**
 * copy-static.js
 *
 * Run after `next build` to copy static assets into the standalone output.
 * Next.js standalone mode only bundles the server JS; static files must be
 * copied manually so the server can serve them.
 *
 * Called automatically by `npm run build:next` in the root package.json.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const appDir = path.join(__dirname, "..", "prompt-tuner");
const standaloneDir = path.join(appDir, ".next", "standalone");

if (!fs.existsSync(standaloneDir)) {
  console.error(
    "ERROR: .next/standalone not found.\n" +
      "Make sure next.config.ts has `output: \"standalone\"` and run `next build` first."
  );
  process.exit(1);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 1. Copy .next/static → standalone/.next/static  (JS chunks, CSS, etc.)
const staticSrc = path.join(appDir, ".next", "static");
const staticDest = path.join(standaloneDir, ".next", "static");
if (fs.existsSync(staticSrc)) {
  copyDir(staticSrc, staticDest);
  console.log("✓ Copied .next/static → standalone/.next/static");
} else {
  console.warn("WARN: .next/static not found — skipping");
}

// 2. Copy public/ → standalone/public  (favicon, images, etc.)
const publicSrc = path.join(appDir, "public");
const publicDest = path.join(standaloneDir, "public");
if (fs.existsSync(publicSrc)) {
  copyDir(publicSrc, publicDest);
  console.log("✓ Copied public/ → standalone/public");
} else {
  console.warn("WARN: public/ not found — skipping");
}

// 3. Hoist all pnpm virtual-store packages to top-level node_modules.
//    Next.js standalone + pnpm copies packages into .pnpm/ but doesn't create the
//    top-level symlinks that normal pnpm installs have. Electron's modified require
//    can't resolve packages through the .pnpm virtual store, so we copy them up.
const nodeModulesDir = path.join(standaloneDir, "node_modules");
const pnpmStore = path.join(nodeModulesDir, ".pnpm");
if (fs.existsSync(pnpmStore)) {
  let hoisted = 0;
  for (const storePkg of fs.readdirSync(pnpmStore)) {
    const innerModules = path.join(pnpmStore, storePkg, "node_modules");
    if (!fs.existsSync(innerModules)) continue;
    for (const pkg of fs.readdirSync(innerModules)) {
      if (pkg === ".pnpm" || pkg.startsWith(".")) continue;
      const pkgSrc = path.join(innerModules, pkg);
      if (pkg.startsWith("@")) {
        // Scoped package: @scope/name entries inside the scope dir
        for (const scopedPkg of fs.readdirSync(pkgSrc)) {
          const scopedSrc = path.join(pkgSrc, scopedPkg);
          const scopedDest = path.join(nodeModulesDir, pkg, scopedPkg);
          if (!fs.existsSync(scopedDest) && fs.statSync(scopedSrc).isDirectory()) {
            copyDir(scopedSrc, scopedDest);
            hoisted++;
          }
        }
      } else {
        const dest = path.join(nodeModulesDir, pkg);
        if (!fs.existsSync(dest) && fs.statSync(pkgSrc).isDirectory()) {
          copyDir(pkgSrc, dest);
          hoisted++;
        }
      }
    }
  }
  console.log(`✓ Hoisted ${hoisted} packages from .pnpm to top-level node_modules`);
} else {
  console.log("  No .pnpm store found — skipping hoist step");
}

console.log("Static copy complete. Standalone output is ready for packaging.");

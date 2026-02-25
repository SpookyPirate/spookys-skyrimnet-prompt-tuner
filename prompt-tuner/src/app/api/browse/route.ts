import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import os from "os";

interface BrowseEntry {
  name: string;
  path: string;
  type: "file" | "directory";
}

/**
 * GET /api/browse?dir=C:/Users/...&extensions=.zip,.7z
 *
 * Lists directories and files (filtered by extension) in a given directory.
 * This is the server-side file browser for the desktop app — when migrated to
 * Electron/Tauri, this route can be replaced with a native file dialog.
 *
 * No dir param → returns user home + common quick-access locations.
 */
export async function GET(request: NextRequest) {
  const dir = request.nextUrl.searchParams.get("dir");
  const extensionsParam = request.nextUrl.searchParams.get("extensions");
  const extensions = extensionsParam
    ? extensionsParam.split(",").map((e) => e.trim().toLowerCase())
    : [];

  // No dir → return quick-access roots
  if (!dir) {
    const home = os.homedir();
    const roots: BrowseEntry[] = [
      { name: "Home", path: home, type: "directory" },
    ];

    // Add common locations if they exist
    for (const sub of ["Desktop", "Downloads", "Documents"]) {
      const p = path.join(home, sub);
      try {
        await fs.access(p);
        roots.push({ name: sub, path: p, type: "directory" });
      } catch {
        // skip
      }
    }

    // Add drive roots on Windows
    if (process.platform === "win32") {
      for (const letter of ["C", "D", "E"]) {
        const drive = `${letter}:\\`;
        try {
          await fs.access(drive);
          roots.push({ name: `${letter}:`, path: drive, type: "directory" });
        } catch {
          // drive not present
        }
      }
    }

    return NextResponse.json({ entries: roots, parent: null, current: null });
  }

  const resolved = path.resolve(dir);

  try {
    const entries = await fs.readdir(resolved, { withFileTypes: true });
    const results: BrowseEntry[] = [];

    // Directories first
    const dirs = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const d of dirs) {
      results.push({
        name: d.name,
        path: path.join(resolved, d.name),
        type: "directory",
      });
    }

    // Files filtered by extension
    if (extensions.length > 0) {
      const files = entries
        .filter(
          (e) =>
            e.isFile() &&
            extensions.includes(path.extname(e.name).toLowerCase())
        )
        .sort((a, b) => a.name.localeCompare(b.name));

      for (const f of files) {
        results.push({
          name: f.name,
          path: path.join(resolved, f.name),
          type: "file",
        });
      }
    }

    const parent = path.dirname(resolved);

    return NextResponse.json({
      entries: results,
      parent: parent !== resolved ? parent : null,
      current: resolved,
    });
  } catch {
    return NextResponse.json(
      { error: `Cannot read directory: ${resolved}` },
      { status: 400 }
    );
  }
}

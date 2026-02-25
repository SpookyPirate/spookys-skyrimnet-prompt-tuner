import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { EDITED_PROMPTS_DIR, MO2_PROMPTS_SUBPATH, isPathAllowed } from "@/lib/files/paths";

/**
 * POST /api/export/save-set
 * Body: { name: string, sourceSet?: string }
 * Copies the source prompt set (or creates empty) to a new named set.
 */
export async function POST(request: Request) {
  try {
    const { name, sourceSet } = await request.json();

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Missing name" }, { status: 400 });
    }

    // Sanitize name
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const targetPath = path.join(EDITED_PROMPTS_DIR, safeName);

    if (!isPathAllowed(targetPath)) {
      return NextResponse.json({ error: "Path not allowed" }, { status: 403 });
    }

    // Check if already exists
    try {
      await fs.access(targetPath);
      return NextResponse.json(
        { error: `Prompt set "${safeName}" already exists` },
        { status: 409 }
      );
    } catch {
      // Good, doesn't exist
    }

    // Target always uses MO2 hierarchy: {set}/SKSE/Plugins/SkyrimNet/prompts/
    const targetPrompts = path.join(targetPath, MO2_PROMPTS_SUBPATH);

    if (sourceSet) {
      const sourcePath = path.join(EDITED_PROMPTS_DIR, sourceSet);
      if (!isPathAllowed(sourcePath)) {
        return NextResponse.json({ error: "Source path not allowed" }, { status: 403 });
      }
      // Look for prompts in MO2 hierarchy first, then legacy flat layout
      const sourceMo2 = path.join(sourcePath, MO2_PROMPTS_SUBPATH);
      const sourceLegacy = path.join(sourcePath, "prompts");
      let sourcePrompts: string | null = null;
      try { await fs.access(sourceMo2); sourcePrompts = sourceMo2; } catch {}
      if (!sourcePrompts) {
        try { await fs.access(sourceLegacy); sourcePrompts = sourceLegacy; } catch {}
      }

      if (sourcePrompts) {
        await copyDirectory(sourcePrompts, targetPrompts);
      } else {
        await fs.mkdir(targetPrompts, { recursive: true });
      }
    } else {
      await fs.mkdir(targetPrompts, { recursive: true });
    }

    return NextResponse.json({ success: true, name: safeName, path: targetPath });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to save prompt set: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

async function copyDirectory(src: string, dest: string) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

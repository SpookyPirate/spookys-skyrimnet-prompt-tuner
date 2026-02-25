import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import {
  ORIGINAL_PROMPTS_DIR,
  EDITED_PROMPTS_DIR,
  MO2_PROMPTS_SUBPATH,
  isPathAllowed,
} from "@/lib/files/paths";

/**
 * GET /api/export/package?set=v1.0
 * Returns a JSON manifest of all modified/new files in a prompt set,
 * comparing against the originals. Client-side JSZip builds the actual zip.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const setName = searchParams.get("set");

  if (!setName) {
    return NextResponse.json({ error: "Missing set parameter" }, { status: 400 });
  }

  const setPath = path.join(EDITED_PROMPTS_DIR, setName);
  if (!isPathAllowed(setPath)) {
    return NextResponse.json({ error: "Path not allowed" }, { status: 403 });
  }

  try {
    // Find prompts dir: MO2 hierarchy first, then legacy flat layout
    const mo2Dir = path.join(setPath, MO2_PROMPTS_SUBPATH);
    const legacyDir = path.join(setPath, "prompts");
    let promptsDir: string;
    try { await fs.access(mo2Dir); promptsDir = mo2Dir; } catch {
      try { await fs.access(legacyDir); promptsDir = legacyDir; } catch {
        return NextResponse.json({ files: [], setName });
      }
    }

    const files = await collectFiles(promptsDir, promptsDir);

    // For each file, determine if it's modified (exists in originals) or new
    const manifest: {
      path: string; // relative path within prompts dir
      skyrimPath: string; // path for MO2-ready zip structure
      content: string;
      isNew: boolean;
    }[] = [];

    const mo2Prefix = MO2_PROMPTS_SUBPATH.replace(/\\/g, "/");

    for (const file of files) {
      const content = await fs.readFile(file.fullPath, "utf-8");

      // Compare against originals using prompts-relative path
      // e.g. "submodules/system_head/0010_instructions.prompt"
      const originalPath = path.join(ORIGINAL_PROMPTS_DIR, file.relativePath);
      let isNew = true;
      try {
        const originalContent = await fs.readFile(originalPath, "utf-8");
        if (originalContent !== content) {
          isNew = false; // Modified
        } else {
          continue; // Unchanged, skip
        }
      } catch {
        isNew = true; // New file
      }

      // Build MO2-ready zip path: SKSE/Plugins/SkyrimNet/prompts/...
      const skyrimPath = `${mo2Prefix}/${file.relativePath}`;

      manifest.push({
        path: file.relativePath,
        skyrimPath,
        content,
        isNew,
      });
    }

    return NextResponse.json({ files: manifest, setName });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to read prompt set: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

async function collectFiles(
  dirPath: string,
  basePath: string
): Promise<{ fullPath: string; relativePath: string }[]> {
  const results: { fullPath: string; relativePath: string }[] = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const children = await collectFiles(fullPath, basePath);
      results.push(...children);
    } else if (entry.isFile() && !entry.name.startsWith(".")) {
      results.push({
        fullPath,
        relativePath: path.relative(basePath, fullPath).replace(/\\/g, "/"),
      });
    }
  }

  return results;
}

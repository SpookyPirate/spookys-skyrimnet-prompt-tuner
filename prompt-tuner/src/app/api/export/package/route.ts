import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import {
  ORIGINAL_PROMPTS_DIR,
  EDITED_PROMPTS_DIR,
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
    const files = await collectFiles(setPath, setPath);

    // For each file, determine if it's modified (exists in originals) or new
    const manifest: {
      path: string; // relative path within the set
      skyrimPath: string; // path for SkyrimNet zip structure
      content: string;
      isNew: boolean;
    }[] = [];

    for (const file of files) {
      const content = await fs.readFile(file.fullPath, "utf-8");

      // Check if there's an original version
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

      // Build the SkyrimNet export path
      // edited-prompts/v1.0/prompts/submodules/... → prompts/submodules/...
      // edited-prompts/v1.0/characters/... → characters/...
      const skyrimPath = file.relativePath;

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

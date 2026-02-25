import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import {
  ORIGINAL_PROMPTS_DIR,
  EDITED_PROMPTS_DIR,
  MO2_PROMPTS_SUBPATH,
  parseCharacterName,
} from "@/lib/files/paths";

interface CharacterEntry {
  displayName: string;
  filename: string;
  source: string;
  path: string;
  savePath: string;
  isOriginal: boolean;
}

/**
 * GET /api/characters/list?activeSet=v1.0
 * Returns all character .prompt files across originals + all edited prompt sets.
 * savePath is pre-computed: originals → copy into activeSet, edited → overwrite in place.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const activeSet = searchParams.get("activeSet") || "v1.0";
  const characters: CharacterEntry[] = [];

  // Save path prefix for originals → copy into active set
  const activeSetCharDir = path.join(
    EDITED_PROMPTS_DIR,
    activeSet,
    MO2_PROMPTS_SUBPATH,
    "characters"
  );

  // 1. Scan original prompts characters/
  const originalsCharDir = path.join(ORIGINAL_PROMPTS_DIR, "characters");
  await scanCharacterDir(originalsCharDir, "Original Prompts", true, activeSetCharDir, characters);

  // 2. Scan each edited prompt set
  try {
    const sets = await fs.readdir(EDITED_PROMPTS_DIR, { withFileTypes: true });
    for (const entry of sets) {
      if (!entry.isDirectory()) continue;
      const setName = entry.name;

      // MO2 hierarchy first
      const mo2CharDir = path.join(
        EDITED_PROMPTS_DIR,
        setName,
        MO2_PROMPTS_SUBPATH,
        "characters"
      );
      // Legacy fallback
      const legacyCharDir = path.join(
        EDITED_PROMPTS_DIR,
        setName,
        "characters"
      );

      let found = false;
      try {
        await fs.access(mo2CharDir);
        await scanCharacterDir(mo2CharDir, setName, false, null, characters);
        found = true;
      } catch {
        // MO2 dir not found, try legacy
      }

      if (!found) {
        try {
          await fs.access(legacyCharDir);
          await scanCharacterDir(legacyCharDir, setName, false, null, characters);
        } catch {
          // No characters in this set
        }
      }
    }
  } catch {
    // edited-prompts dir may not exist yet
  }

  // Sort alphabetically by display name
  characters.sort((a, b) => a.displayName.localeCompare(b.displayName));

  return NextResponse.json({ characters });
}

async function scanCharacterDir(
  dirPath: string,
  source: string,
  isOriginal: boolean,
  saveDir: string | null,
  results: CharacterEntry[]
) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".prompt")) continue;
      const { displayName } = parseCharacterName(entry.name);
      const filePath = path.join(dirPath, entry.name);
      results.push({
        displayName,
        filename: entry.name,
        source,
        path: filePath,
        savePath: isOriginal ? path.join(saveDir!, entry.name) : filePath,
        isOriginal,
      });
    }
  } catch {
    // Directory doesn't exist or can't be read
  }
}

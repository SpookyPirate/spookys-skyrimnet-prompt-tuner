import fs from "fs/promises";
import path from "path";
import type { FileLoader } from "./assembler";
import { ORIGINAL_PROMPTS_DIR } from "@/lib/files/paths";

export interface SaveBioConfig {
  /** Save folder ID (e.g. "1767940452352-935236") */
  saveId: string;
  /** Per-character priority. Key is filename. Higher number wins. */
  priorities: Record<string, number>;
}

/**
 * Create a FileLoader that resolves paths from a base directory,
 * falling back to the original prompts directory.
 *
 * When enabledSaves are provided, character file requests (characters/{uuid}.prompt)
 * will check enabled save folders first, using priority to resolve conflicts.
 */
export function createFileLoader(baseDir: string, enabledSaves?: SaveBioConfig[]): FileLoader {
  return {
    readFile: async (filePath: string) => {
      // If this is a character file request AND we have enabled saves, check saves first
      if (enabledSaves && enabledSaves.length > 0 && filePath.startsWith("characters/")) {
        const filename = filePath.slice("characters/".length);
        const saveResult = await resolveFromSaves(baseDir, filename, enabledSaves);
        if (saveResult !== null) return saveResult;
      }

      try {
        return await fs.readFile(path.join(baseDir, filePath), "utf-8");
      } catch {
        return await fs.readFile(path.join(ORIGINAL_PROMPTS_DIR, filePath), "utf-8");
      }
    },
    listDir: async (dirPath: string) => {
      const results: string[] = [];
      try {
        const files = await fs.readdir(path.join(baseDir, dirPath));
        results.push(...files);
      } catch {}
      try {
        const files = await fs.readdir(path.join(ORIGINAL_PROMPTS_DIR, dirPath));
        for (const f of files) if (!results.includes(f)) results.push(f);
      } catch {}
      return results;
    },
  };
}

/**
 * Try to resolve a character file from enabled save folders.
 * Priority logic:
 *  1. Saves with explicit priority numbers — highest number wins
 *  2. Among saves with no priority for this file — newest file (by mtime) wins
 * Returns file content or null if not found in any save.
 */
async function resolveFromSaves(
  baseDir: string,
  filename: string,
  enabledSaves: SaveBioConfig[],
): Promise<string | null> {
  interface Candidate {
    path: string;
    priority: number | null;
    mtime: number;
  }

  const candidates: Candidate[] = [];

  // Derive the dynamic filename: "serana_B74.prompt" → "serana_B74.dynamic.prompt"
  const dynamicFilename = filename.replace(/\.prompt$/, ".dynamic.prompt");

  for (const save of enabledSaves) {
    const saveCharDir = path.join(baseDir, "_saves", save.saveId, "characters");

    // Check static character file: _saves/{id}/characters/{uuid}.prompt
    const staticPath = path.join(saveCharDir, filename);
    try {
      const stat = await fs.stat(staticPath);
      if (stat.isFile()) {
        const priority = save.priorities[filename] ?? null;
        candidates.push({ path: staticPath, priority, mtime: stat.mtimeMs });
      }
    } catch {}

    // Check dynamic character file: _saves/{id}/characters/dynamic/{uuid}.dynamic.prompt
    const dynPath = path.join(saveCharDir, "dynamic", dynamicFilename);
    try {
      const stat = await fs.stat(dynPath);
      if (stat.isFile()) {
        const priority = save.priorities[dynamicFilename] ?? save.priorities[filename] ?? null;
        candidates.push({ path: dynPath, priority, mtime: stat.mtimeMs });
      }
    } catch {}
  }

  if (candidates.length === 0) return null;

  // Sort: explicit priority (higher first), then mtime (newer first)
  candidates.sort((a, b) => {
    // Both have priority — higher wins
    if (a.priority !== null && b.priority !== null) return b.priority - a.priority;
    // Only one has priority — it wins
    if (a.priority !== null) return -1;
    if (b.priority !== null) return 1;
    // Neither has priority — newest mtime wins
    return b.mtime - a.mtime;
  });

  return await fs.readFile(candidates[0].path, "utf-8");
}

/**
 * Read a template by name, trying baseDir first then ORIGINAL_PROMPTS_DIR.
 */
export async function readTemplate(baseDir: string, templateName: string): Promise<string> {
  try {
    return await fs.readFile(path.join(baseDir, templateName), "utf-8");
  } catch {
    return await fs.readFile(path.join(ORIGINAL_PROMPTS_DIR, templateName), "utf-8");
  }
}

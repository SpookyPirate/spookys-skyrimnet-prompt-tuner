import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { ORIGINAL_PROMPTS_DIR, EDITED_PROMPTS_DIR, parseCharacterName, isReadOnly } from "@/lib/files/paths";
import type { FileNode } from "@/types/files";

const SEARCHABLE_EXTENSIONS = new Set([".prompt", ".yaml", ".yml", ".txt", ".md"]);

/** Walk a directory recursively and collect all searchable file nodes. */
async function walkDir(dir: string, readOnly: boolean, nodes: FileNode[], promptSetName: string): Promise<void> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return;
  }

  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry);
      let stat;
      try {
        stat = await fs.stat(fullPath);
      } catch {
        return;
      }

      if (stat.isDirectory()) {
        await walkDir(fullPath, readOnly, nodes, promptSetName);
      } else if (SEARCHABLE_EXTENSIONS.has(path.extname(entry).toLowerCase())) {
        const isChar = entry.endsWith(".prompt") && dir.includes("characters");
        const displayName = isChar ? parseCharacterName(entry).displayName : entry;
        nodes.push({
          name: entry,
          path: fullPath,
          type: "file",
          isReadOnly: readOnly || isReadOnly(fullPath),
          displayName,
          promptSetName,
        });
      }
    })
  );
}

// Cache: [timestamp, nodes]
let fileIndex: FileNode[] | null = null;
let fileIndexBuiltAt = 0;
const INDEX_TTL_MS = 30_000; // rebuild every 30 s

async function getFileIndex(): Promise<FileNode[]> {
  if (fileIndex && Date.now() - fileIndexBuiltAt < INDEX_TTL_MS) return fileIndex;

  const nodes: FileNode[] = [];

  // Original prompts (read-only)
  await walkDir(ORIGINAL_PROMPTS_DIR, true, nodes, "Original Prompts");

  // All edited prompt sets
  try {
    const sets = await fs.readdir(EDITED_PROMPTS_DIR);
    await Promise.all(
      sets
        .filter((setName) => !setName.startsWith("__"))
        .map(async (setName) => {
          const setPath = path.join(EDITED_PROMPTS_DIR, setName);
          const stat = await fs.stat(setPath).catch(() => null);
          if (stat?.isDirectory()) {
            await walkDir(setPath, false, nodes, setName);
          }
        })
    );
  } catch {
    // Edited dir may not exist yet
  }

  fileIndex = nodes;
  fileIndexBuiltAt = Date.now();
  return nodes;
}

/** Invalidate the index (called after writes/deletes) */
export function invalidateFileIndex() {
  fileIndex = null;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");
  const type = request.nextUrl.searchParams.get("type"); // "characters" for NPC search
  const activeSet = request.nextUrl.searchParams.get("activeSet") || "";
  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const index = await getFileIndex();
    const lowerQuery = query.toLowerCase();

    let results = index
      .filter((node) => {
        const label = (node.displayName || node.name).toLowerCase();
        const name = node.name.toLowerCase();
        const rel = node.path.toLowerCase();
        return label.includes(lowerQuery) || name.includes(lowerQuery) || rel.includes(lowerQuery);
      });

    // For NPC search: only character files, deduplicated, no _saves
    if (type === "characters") {
      results = results.filter((node) => {
        const norm = node.path.replace(/\\/g, "/");
        return node.name.endsWith(".prompt") && norm.includes("/characters/") && !norm.includes("/_saves/");
      });

      // Deduplicate by filename — prefer active set > custom set > original
      const deduped = new Map<string, FileNode>();
      for (const node of results) {
        const key = node.name;
        const existing = deduped.get(key);
        if (!existing) {
          deduped.set(key, node);
          continue;
        }
        const norm = node.path.replace(/\\/g, "/");
        const existingNorm = existing.path.replace(/\\/g, "/");
        const isActive = activeSet && norm.includes(`/${activeSet}/`);
        const existingIsActive = activeSet && existingNorm.includes(`/${activeSet}/`);
        if (isActive && !existingIsActive) {
          deduped.set(key, node);
        } else if (!existingIsActive && existing.isReadOnly && !node.isReadOnly) {
          deduped.set(key, node);
        }
      }
      results = Array.from(deduped.values());
    }

    return NextResponse.json({ results: results.slice(0, 100) });
  } catch (error) {
    console.error("Search failed:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}

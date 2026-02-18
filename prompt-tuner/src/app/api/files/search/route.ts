import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { ORIGINAL_PROMPTS_DIR, EDITED_PROMPTS_DIR, parseCharacterName } from "@/lib/files/paths";
import type { FileNode } from "@/types/files";

// In-memory character index built on first request
let characterIndex: FileNode[] | null = null;

async function buildCharacterIndex(): Promise<FileNode[]> {
  if (characterIndex) return characterIndex;

  const nodes: FileNode[] = [];

  // Index original characters
  const charDir = path.join(ORIGINAL_PROMPTS_DIR, "characters");
  try {
    const entries = await fs.readdir(charDir);
    for (const entry of entries) {
      if (entry.endsWith(".prompt")) {
        const { displayName, id } = parseCharacterName(entry);
        nodes.push({
          name: entry,
          path: path.join(charDir, entry),
          type: "file",
          isReadOnly: true,
          displayName,
        });
      }
    }
  } catch {
    // Characters directory may not exist
  }

  characterIndex = nodes;
  return nodes;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const index = await buildCharacterIndex();
    const lowerQuery = query.toLowerCase();

    // Simple substring matching (Fuse.js will be used on the client for fuzzy)
    const results = index
      .filter(
        (node) =>
          (node.displayName || node.name).toLowerCase().includes(lowerQuery) ||
          node.name.toLowerCase().includes(lowerQuery)
      )
      .slice(0, 50);

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Search failed:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}

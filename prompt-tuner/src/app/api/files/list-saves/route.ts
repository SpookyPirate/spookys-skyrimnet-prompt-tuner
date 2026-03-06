import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { resolvePromptSetBaseServer } from "@/lib/files/paths-server";

/**
 * GET /api/files/list-saves?promptSet=overwrite
 * Returns save folder IDs and their character files for a prompt set.
 */
export async function GET(request: NextRequest) {
  try {
    const promptSet = request.nextUrl.searchParams.get("promptSet") || "";
    const baseDir = resolvePromptSetBaseServer(promptSet || undefined);
    const savesDir = path.join(baseDir, "_saves");

    let saveIds: string[];
    try {
      const entries = await fs.readdir(savesDir, { withFileTypes: true });
      saveIds = entries
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort();
    } catch {
      return NextResponse.json({ saves: [] });
    }

    const saves = await Promise.all(
      saveIds.map(async (saveId) => {
        const charDir = path.join(savesDir, saveId, "characters");
        let characters: { filename: string; displayName: string; mtime: number }[] = [];
        try {
          const entries = await fs.readdir(charDir, { withFileTypes: true });
          const charFiles = entries.filter(
            (e) => e.isFile() && e.name.endsWith(".prompt"),
          );
          characters = await Promise.all(
            charFiles.map(async (e) => {
              const stat = await fs.stat(path.join(charDir, e.name));
              const base = e.name.replace(/\.prompt$/, "");
              const lastUnderscore = base.lastIndexOf("_");
              const namePart = lastUnderscore > 0 ? base.substring(0, lastUnderscore) : base;
              const displayName = namePart
                .split("_")
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(" ");
              return {
                filename: e.name,
                displayName,
                mtime: stat.mtimeMs,
              };
            }),
          );
          characters.sort((a, b) => a.displayName.localeCompare(b.displayName));
        } catch {}

        // Parse timestamp from save folder name for display
        const timestamp = parseInt(saveId.split("-")[0], 10);
        const date = !isNaN(timestamp) ? new Date(timestamp).toISOString() : null;

        return { saveId, date, characters };
      }),
    );

    return NextResponse.json({ saves });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to list saves: ${(error as Error).message}` },
      { status: 500 },
    );
  }
}

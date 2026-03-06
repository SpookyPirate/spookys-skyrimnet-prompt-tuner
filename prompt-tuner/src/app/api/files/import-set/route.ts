import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { EDITED_PROMPTS_DIR, MO2_PROMPTS_SUBPATH, isPathAllowed } from "@/lib/files/paths";

/**
 * POST /api/files/import-set
 * Body: { name: string, files: { relativePath: string, content: string }[] }
 *
 * Imports a dropped folder as a new prompt set. Only .prompt files are accepted.
 * The folder structure is validated:
 *   - Must contain at least one .prompt file
 *   - If the folder has MO2 hierarchy (SKSE/Plugins/SkyrimNet/prompts/), prompts are
 *     extracted from that subtree
 *   - If the folder has a flat "prompts/" dir, prompts are extracted from there
 *   - Otherwise, all .prompt files are placed under the MO2 hierarchy
 */
export async function POST(request: NextRequest) {
  try {
    const { name, files } = (await request.json()) as {
      name: string;
      files: { relativePath: string; content: string }[];
    };

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Missing set name" }, { status: 400 });
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

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
        { status: 409 },
      );
    } catch {
      // Good
    }

    // Filter to .prompt files only
    const promptFiles = files.filter((f) => f.relativePath.endsWith(".prompt"));

    if (promptFiles.length === 0) {
      return NextResponse.json(
        { error: "No .prompt files found in the dropped folder" },
        { status: 400 },
      );
    }

    // Detect hierarchy in the dropped folder
    // Normalize paths to forward slashes
    const normalized = promptFiles.map((f) => ({
      ...f,
      relativePath: f.relativePath.replace(/\\/g, "/"),
    }));

    const mo2Prefix = "SKSE/Plugins/SkyrimNet/prompts/";
    const legacyPrefix = "prompts/";

    // Check if files already have MO2 hierarchy
    const hasMo2 = normalized.some((f) => f.relativePath.includes(mo2Prefix));
    // Check if files have legacy prompts/ hierarchy
    const hasLegacy =
      !hasMo2 && normalized.some((f) => f.relativePath.startsWith(legacyPrefix));

    const targetPrompts = path.join(targetPath, MO2_PROMPTS_SUBPATH);

    let written = 0;
    for (const file of normalized) {
      let relPath: string;

      if (hasMo2) {
        // Extract from after the MO2 prompts/ prefix
        const idx = file.relativePath.indexOf(mo2Prefix);
        if (idx === -1) continue; // Skip files outside MO2 hierarchy
        relPath = file.relativePath.slice(idx + mo2Prefix.length);
      } else if (hasLegacy) {
        // Extract from after prompts/
        if (!file.relativePath.startsWith(legacyPrefix)) continue;
        relPath = file.relativePath.slice(legacyPrefix.length);
      } else {
        // Flat — use relative path as-is
        relPath = file.relativePath;
      }

      if (!relPath) continue;

      const destPath = path.join(targetPrompts, relPath);

      if (!isPathAllowed(destPath)) continue;

      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.writeFile(destPath, file.content, "utf-8");
      written++;
    }

    if (written === 0) {
      // Clean up empty directory
      try {
        await fs.rm(targetPath, { recursive: true });
      } catch {}
      return NextResponse.json(
        { error: "No valid .prompt files could be imported" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      name: safeName,
      filesImported: written,
      totalFiles: files.length,
      promptFiles: promptFiles.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Import failed: ${(error as Error).message}` },
      { status: 500 },
    );
  }
}

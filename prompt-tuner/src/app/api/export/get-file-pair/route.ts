import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { isPathAllowed, EDITED_PROMPTS_DIR, MO2_PROMPTS_SUBPATH } from "@/lib/files/paths";
import { resolvePromptSetBaseServer } from "@/lib/files/paths-server";

/**
 * POST /api/export/get-file-pair
 * Body: { tempAbsPaths: string[], targetSetName: string }
 * Returns an array of { relativePath, tempPath, targetPath, newContent, oldContent }
 * for each modified file in the temp set, pairing it with the existing content
 * in the target set (or empty string if the file doesn't exist there yet).
 */
export async function POST(request: NextRequest) {
  try {
    const { tempAbsPaths, targetSetName } = await request.json();

    if (!Array.isArray(tempAbsPaths) || typeof targetSetName !== "string") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    for (const p of tempAbsPaths) {
      if (!isPathAllowed(p)) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    const tempBase = resolvePromptSetBaseServer("__tuner_temp__");

    // For the target: if the set already exists on disk, use its resolved layout
    // (MO2 or legacy). If it's brand-new, always use MO2 so the saved files work
    // as a SkyrimNet MO2 mod folder out of the box.
    const safeName = (targetSetName || "").replace(/[^a-zA-Z0-9._-]/g, "_");
    let targetBase: string;
    if (!safeName) {
      targetBase = resolvePromptSetBaseServer(undefined);
    } else {
      const resolved = resolvePromptSetBaseServer(safeName);
      let resolvedExists = false;
      try { await fs.access(resolved); resolvedExists = true; } catch {}
      targetBase = resolvedExists
        ? resolved
        : path.join(EDITED_PROMPTS_DIR, safeName, MO2_PROMPTS_SUBPATH);
    }

    const normalizedTempBase = tempBase.replace(/\\/g, "/").replace(/\/$/, "");

    const pairs = await Promise.all(
      tempAbsPaths.map(async (tempPath) => {
        const normalizedTemp = tempPath.replace(/\\/g, "/");
        const relativePath = normalizedTemp.startsWith(normalizedTempBase + "/")
          ? normalizedTemp.slice(normalizedTempBase.length + 1)
          : path.basename(tempPath);

        const targetPath = path.join(targetBase, relativePath);

        const [newContent, oldContent] = await Promise.all([
          fs.readFile(tempPath, "utf-8").catch(() => ""),
          isPathAllowed(targetPath)
            ? fs.readFile(targetPath, "utf-8").catch(() => "")
            : Promise.resolve(""),
        ]);

        return { relativePath, tempPath, targetPath, newContent, oldContent };
      })
    );

    return NextResponse.json({ pairs });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to get file pairs: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

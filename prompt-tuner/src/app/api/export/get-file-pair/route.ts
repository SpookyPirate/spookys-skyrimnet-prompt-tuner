import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { isPathAllowed } from "@/lib/files/paths";
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
    // For the target, use MO2 layout as the canonical new-set path.
    // resolvePromptSetBaseServer returns the MO2 path if the set uses MO2, or
    // legacy path if it exists that way. For brand-new sets, it returns MO2.
    const targetBase = resolvePromptSetBaseServer(targetSetName || undefined);

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

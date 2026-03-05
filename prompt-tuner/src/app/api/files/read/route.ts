import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { isPathAllowed, isReadOnly, ORIGINAL_PROMPTS_DIR } from "@/lib/files/paths";
import { resolvePromptSetBaseServer } from "@/lib/files/paths-server";

export async function GET(request: NextRequest) {
  const filePath = request.nextUrl.searchParams.get("path");
  // Optional: when the file doesn't exist at filePath, fall back through these
  // prompt set names in order (e.g. the user's selected set, then "__original__").
  const fallbackSets = request.nextUrl.searchParams.getAll("fallback");

  if (!filePath) {
    return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
  }

  if (!isPathAllowed(filePath)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    const content = await fs.readFile(filePath, "utf-8");
    return NextResponse.json({ content, isReadOnly: isReadOnly(filePath) });
  } catch (primaryErr) {
    if ((primaryErr as NodeJS.ErrnoException).code !== "ENOENT" || fallbackSets.length === 0) {
      const code = (primaryErr as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }
      console.error("Failed to read file:", primaryErr);
      return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
    }
  }

  // File not found in primary path — try fallback sets.
  // Compute the relative path by stripping any known prompt-set base prefix.
  // We try each fallback set in order, resolving the same relative path within it.
  const normalizedFilePath = filePath.replace(/\\/g, "/");

  // Build candidate base paths to strip (temp set, then edited-prompts root)
  const tempBase = resolvePromptSetBaseServer("__tuner_temp__").replace(/\\/g, "/").replace(/\/$/, "");

  let relativePath: string | null = null;
  if (normalizedFilePath.startsWith(tempBase + "/")) {
    relativePath = normalizedFilePath.slice(tempBase.length + 1);
  }

  if (!relativePath) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  for (const setName of fallbackSets) {
    const base = setName === "__original__"
      ? ORIGINAL_PROMPTS_DIR
      : resolvePromptSetBaseServer(setName);
    const candidatePath = path.join(base, relativePath);
    if (!isPathAllowed(candidatePath)) continue;
    try {
      const content = await fs.readFile(candidatePath, "utf-8");
      return NextResponse.json({ content, isReadOnly: isReadOnly(candidatePath) });
    } catch {
      // try next fallback
    }
  }

  return NextResponse.json({ error: "File not found" }, { status: 404 });
}

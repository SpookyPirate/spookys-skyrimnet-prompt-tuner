import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { ORIGINAL_PROMPTS_DIR, EDITED_PROMPTS_DIR, isPathAllowed } from "@/lib/files/paths";

/**
 * GET /api/files/original?path=<edited file path>
 * Returns the original version of an edited file by mapping
 * edited-prompts/<set>/... → original_prompts/...
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filePath = searchParams.get("path");

  if (!filePath) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  if (!isPathAllowed(filePath)) {
    return NextResponse.json({ error: "Path not allowed" }, { status: 403 });
  }

  const resolved = path.resolve(filePath);

  // Only makes sense for files in edited-prompts/
  if (!resolved.startsWith(path.resolve(EDITED_PROMPTS_DIR))) {
    return NextResponse.json({
      error: "File is not in an edited prompt set",
      content: null,
    });
  }

  // Map: edited-prompts/<setName>/prompts/... → original_prompts/prompts/...
  // edited-prompts/<setName>/characters/... → original_prompts/characters/...
  const relativeToEdited = path.relative(EDITED_PROMPTS_DIR, resolved);
  // relativeToEdited looks like: v1.0\prompts\submodules\foo.prompt
  // We need to strip the set name (first segment)
  const segments = relativeToEdited.split(path.sep);
  if (segments.length < 2) {
    return NextResponse.json({ error: "Invalid path structure", content: null });
  }

  const pathWithinSet = segments.slice(1).join(path.sep);
  const originalPath = path.join(ORIGINAL_PROMPTS_DIR, pathWithinSet);

  try {
    const content = await fs.readFile(originalPath, "utf-8");
    return NextResponse.json({ content, originalPath });
  } catch {
    return NextResponse.json({
      content: null,
      error: "No original version found",
    });
  }
}

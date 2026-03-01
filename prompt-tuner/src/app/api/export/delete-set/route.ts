import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { EDITED_PROMPTS_DIR, isPathAllowed } from "@/lib/files/paths";

/**
 * DELETE /api/export/delete-set
 * Body: { name: string }
 * Deletes a named prompt set directory. Validates path is within EDITED_PROMPTS_DIR.
 */
export async function DELETE(request: Request) {
  try {
    const { name } = await request.json();

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Missing name" }, { status: 400 });
    }

    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const targetPath = path.join(EDITED_PROMPTS_DIR, safeName);

    if (!isPathAllowed(targetPath)) {
      return NextResponse.json({ error: "Path not allowed" }, { status: 403 });
    }

    // Ensure target is directly inside EDITED_PROMPTS_DIR (no traversal)
    const resolved = path.resolve(targetPath);
    const editedResolved = path.resolve(EDITED_PROMPTS_DIR);
    if (!resolved.startsWith(editedResolved + path.sep) || resolved === editedResolved) {
      return NextResponse.json({ error: "Invalid path" }, { status: 403 });
    }

    // Check if exists
    try {
      await fs.access(targetPath);
    } catch {
      return NextResponse.json({ error: "Prompt set not found" }, { status: 404 });
    }

    // Remove recursively
    await fs.rm(targetPath, { recursive: true, force: true });

    return NextResponse.json({ success: true, name: safeName });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to delete prompt set: ${(error as Error).message}` },
      { status: 500 },
    );
  }
}

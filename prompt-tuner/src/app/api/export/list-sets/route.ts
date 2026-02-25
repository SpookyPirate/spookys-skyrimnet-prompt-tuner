import { NextResponse } from "next/server";
import fs from "fs/promises";
import { EDITED_PROMPTS_DIR } from "@/lib/files/paths";

/**
 * GET /api/export/list-sets
 * Returns { sets: string[] } — top-level directory names in edited-prompts/
 */
export async function GET() {
  try {
    const entries = await fs.readdir(EDITED_PROMPTS_DIR, {
      withFileTypes: true,
    });
    const sets = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();

    return NextResponse.json({ sets });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to list prompt sets: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

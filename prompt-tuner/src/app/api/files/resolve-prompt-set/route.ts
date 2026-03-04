import { NextRequest, NextResponse } from "next/server";
import { resolvePromptSetBaseServer } from "@/lib/files/paths-server";

/**
 * GET /api/files/resolve-prompt-set?name=__tuner_temp__
 * Resolves a prompt set name to its absolute base path on disk.
 */
export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name") ?? "";
  const basePath = resolvePromptSetBaseServer(name || undefined);
  return NextResponse.json({ basePath });
}

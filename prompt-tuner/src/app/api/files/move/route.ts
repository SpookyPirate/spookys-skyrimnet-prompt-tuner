import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { isPathAllowed, isReadOnly } from "@/lib/files/paths";

export async function POST(request: NextRequest) {
  try {
    const { sourcePath, destPath } = await request.json();

    if (!sourcePath || !destPath) {
      return NextResponse.json({ error: "Missing sourcePath or destPath" }, { status: 400 });
    }
    if (!isPathAllowed(sourcePath) || !isPathAllowed(destPath)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    if (isReadOnly(sourcePath)) {
      return NextResponse.json({ error: "Cannot move read-only file" }, { status: 403 });
    }
    if (isReadOnly(destPath)) {
      return NextResponse.json({ error: "Cannot move file into read-only location" }, { status: 403 });
    }

    // Ensure destination directory exists
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.rename(sourcePath, destPath);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: `Move failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { isPathAllowed, isReadOnly } from "@/lib/files/paths";

export async function POST(request: NextRequest) {
  try {
    const { filePath } = await request.json();

    if (!filePath) {
      return NextResponse.json({ error: "Missing filePath" }, { status: 400 });
    }
    if (!isPathAllowed(filePath)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    if (isReadOnly(filePath)) {
      return NextResponse.json({ error: "Cannot delete read-only file" }, { status: 403 });
    }

    await fs.unlink(filePath);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: `Delete failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

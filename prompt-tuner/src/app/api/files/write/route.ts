import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { isPathAllowed, isReadOnly } from "@/lib/files/paths";

export async function POST(request: NextRequest) {
  try {
    const { filePath, content } = await request.json();

    if (!filePath || typeof content !== "string") {
      return NextResponse.json(
        { error: "Missing filePath or content" },
        { status: 400 }
      );
    }

    if (!isPathAllowed(filePath)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (isReadOnly(filePath)) {
      return NextResponse.json(
        { error: "Cannot write to read-only file" },
        { status: 403 }
      );
    }

    // Ensure parent directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, "utf-8");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to write file:", error);
    return NextResponse.json(
      { error: "Failed to write file" },
      { status: 500 }
    );
  }
}

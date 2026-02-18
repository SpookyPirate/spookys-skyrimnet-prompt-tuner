import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { isPathAllowed, isReadOnly } from "@/lib/files/paths";

export async function GET(request: NextRequest) {
  const filePath = request.nextUrl.searchParams.get("path");

  if (!filePath) {
    return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
  }

  if (!isPathAllowed(filePath)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    const content = await fs.readFile(filePath, "utf-8");
    return NextResponse.json({
      content,
      isReadOnly: isReadOnly(filePath),
    });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    console.error("Failed to read file:", error);
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }
}

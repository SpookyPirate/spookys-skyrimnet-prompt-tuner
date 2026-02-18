import { NextRequest, NextResponse } from "next/server";
import { loadDirectoryChildren } from "@/lib/files/tree";
import { isPathAllowed, isReadOnly } from "@/lib/files/paths";

export async function GET(request: NextRequest) {
  const dirPath = request.nextUrl.searchParams.get("path");
  const offset = parseInt(request.nextUrl.searchParams.get("offset") || "0", 10);
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "200", 10);

  if (!dirPath) {
    return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
  }

  if (!isPathAllowed(dirPath)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    const result = await loadDirectoryChildren(
      dirPath,
      offset,
      limit,
      isReadOnly(dirPath)
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to load directory children:", error);
    return NextResponse.json(
      { error: "Failed to load directory" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { buildFileTree } from "@/lib/files/tree";

export async function GET() {
  try {
    const tree = await buildFileTree();
    return NextResponse.json({ tree });
  } catch (error) {
    console.error("Failed to build file tree:", error);
    return NextResponse.json(
      { error: "Failed to build file tree" },
      { status: 500 }
    );
  }
}

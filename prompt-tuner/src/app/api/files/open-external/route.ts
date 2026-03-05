import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";
import { isPathAllowed } from "@/lib/files/paths";

export async function POST(request: NextRequest) {
  try {
    const { filePath } = await request.json();

    if (!filePath) {
      return NextResponse.json({ error: "Missing filePath" }, { status: 400 });
    }
    if (!isPathAllowed(filePath)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const cmd =
      process.platform === "win32"
        ? `start "" "${filePath}"`
        : process.platform === "darwin"
          ? `open "${filePath}"`
          : `xdg-open "${filePath}"`;

    await new Promise<void>((resolve, reject) => {
      exec(cmd, { shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh" }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to open file: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

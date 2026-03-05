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

    const dir = path.dirname(filePath);

    let cmd: string;
    if (process.platform === "win32") {
      // /select highlights the file in Explorer
      cmd = `explorer /select,"${filePath}"`;
    } else if (process.platform === "darwin") {
      cmd = `open -R "${filePath}"`;
    } else {
      cmd = `xdg-open "${dir}"`;
    }

    await new Promise<void>((resolve, reject) => {
      exec(cmd, { shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh" }, (err) => {
        // Explorer returns non-zero on some Windows versions even on success
        if (err && process.platform !== "win32") reject(err);
        else resolve();
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to reveal file: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

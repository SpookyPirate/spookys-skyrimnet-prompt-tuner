import { NextResponse } from "next/server";

/** Lightweight readiness probe used by electron/main.js to detect server startup. */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}

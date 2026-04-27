import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, version: APP_VERSION, db: "up" });
  } catch (err) {
    console.error("health: db check failed", err);
    return NextResponse.json({ ok: false, version: APP_VERSION, db: "down" }, { status: 503 });
  }
}

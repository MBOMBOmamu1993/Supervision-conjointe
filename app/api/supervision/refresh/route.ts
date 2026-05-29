import { NextResponse } from "next/server";
import { flushKoboCache } from "@/lib/supervision/kobo-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  flushKoboCache();
  return NextResponse.json({ ok: true, flushedAt: new Date().toISOString() });
}

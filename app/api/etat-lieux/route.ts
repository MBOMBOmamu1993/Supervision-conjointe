import { NextResponse } from "next/server";
import { loadEtatBundle } from "@/lib/etat-lieux/loader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const bundle = loadEtatBundle();
    return NextResponse.json(bundle, {
      headers: { "Cache-Control": "public, max-age=0, s-maxage=600, stale-while-revalidate=60" },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

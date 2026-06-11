import { NextRequest, NextResponse } from "next/server";
import { fetchDhis2Cv } from "@/lib/dhis2/cv";
import { ENV } from "@/lib/server/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get("force") === "1";
  try {
    const bundle = await fetchDhis2Cv({ force });
    return NextResponse.json(bundle, {
      headers: { "Cache-Control": `public, max-age=0, s-maxage=${ENV.CACHE_TTL_SECONDS}, stale-while-revalidate=60` },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}

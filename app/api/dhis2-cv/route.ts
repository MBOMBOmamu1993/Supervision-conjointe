import { NextRequest, NextResponse } from "next/server";
import { fetchDhis2Cv } from "@/lib/dhis2/cv";
import { ENV } from "@/lib/server/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get("force") === "1";
  // `ref` : date de réalisation du RCM (ISO "YYYY-MM-DD") qui sert de
  // référence au calcul du mois DHIS2 (règle M-1/M-2).
  const refDate = req.nextUrl.searchParams.get("ref") ?? undefined;
  try {
    const bundle = await fetchDhis2Cv({ force, refDate });
    return NextResponse.json(bundle, {
      headers: { "Cache-Control": `public, max-age=0, s-maxage=${ENV.CACHE_TTL_SECONDS}, stale-while-revalidate=60` },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}

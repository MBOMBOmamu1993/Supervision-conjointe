import { NextRequest, NextResponse } from "next/server";
import { fetchAllSources } from "@/lib/supervision/kobo-client";
import { buildBundle, type Filters } from "@/lib/supervision/analytics";
import { TARGETS, ENV } from "@/lib/server/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const filters: Filters = {
    province: sp.get("province"),
    antenne: sp.get("antenne"),
    zone: sp.get("zone"),
    aire: sp.get("aire"),
    month: sp.get("month"),
  };
  const force = sp.get("force") === "1";

  try {
    const sources = await fetchAllSources({ force });
    const bundle = buildBundle(sources, filters, TARGETS);
    return NextResponse.json(bundle, {
      headers: { "Cache-Control": `public, max-age=0, s-maxage=${ENV.CACHE_TTL_SECONDS}, stale-while-revalidate=60` },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}

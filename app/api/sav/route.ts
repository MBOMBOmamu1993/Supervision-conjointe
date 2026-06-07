import { NextRequest, NextResponse } from "next/server";
import { fetchAllSavSources, fetchBaseSaisieSav } from "@/lib/sav/kobo-client";
import { buildSavBundle, type SavFilters } from "@/lib/sav/analytics";
import { ENV } from "@/lib/server/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function multi(sp: URLSearchParams, key: string): string[] {
  const out: string[] = [];
  for (const v of sp.getAll(key)) for (const part of v.split(",")) { const t = part.trim(); if (t) out.push(t); }
  return out;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const filters: SavFilters = {
    province: sp.get("province"),
    antenne: sp.get("antenne"),
    zone: sp.get("zone"),
    aire: sp.get("aire"),
    months: multi(sp, "months"),
  };
  const force = sp.get("force") === "1";
  try {
    const [sources, baseSaisie] = await Promise.all([fetchAllSavSources({ force }), fetchBaseSaisieSav({ force })]);
    const bundle = buildSavBundle(sources, baseSaisie, filters);
    return NextResponse.json(bundle, {
      headers: { "Cache-Control": `public, max-age=0, s-maxage=${ENV.CACHE_TTL_SECONDS}, stale-while-revalidate=60` },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}

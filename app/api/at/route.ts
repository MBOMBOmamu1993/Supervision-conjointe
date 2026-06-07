import { NextRequest, NextResponse } from "next/server";
import { fetchAtSource } from "@/lib/at/kobo-client";
import { buildRapportBundle, buildEvaluationBundle, type AtFilters } from "@/lib/at/analytics";
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
  const filters: AtFilters = {
    province: sp.get("province"),
    antenne: sp.get("antenne"),
    months: multi(sp, "months"),
    at: sp.get("at"),
  };
  const force = sp.get("force") === "1";
  try {
    const source = await fetchAtSource({ force });
    const rapport = buildRapportBundle(source, filters);
    const evaluation = buildEvaluationBundle(source, filters);
    return NextResponse.json({ rapport, evaluation }, {
      // TTL court : collecte continue → synchronisation temps réel.
      headers: { "Cache-Control": `public, max-age=0, s-maxage=${ENV.AT_CACHE_TTL_SECONDS}, stale-while-revalidate=30` },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}

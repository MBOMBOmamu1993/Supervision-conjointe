import { NextRequest, NextResponse } from "next/server";
import { fetchDhis2Prestation, type PrestationFilters } from "@/lib/dhis2/prestation";
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
  const filters: PrestationFilters = {
    antenne: sp.get("antenne"),
    months: multi(sp, "months"),
  };
  const force = sp.get("force") === "1";
  try {
    const bundle = await fetchDhis2Prestation(filters, { force });
    return NextResponse.json(bundle, {
      headers: { "Cache-Control": `public, max-age=0, s-maxage=${ENV.CACHE_TTL_SECONDS}, stale-while-revalidate=60` },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}

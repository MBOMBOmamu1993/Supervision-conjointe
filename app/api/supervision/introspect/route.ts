import { NextResponse } from "next/server";
import { fetchAllSources } from "@/lib/supervision/kobo-client";
import { detectQuestionColumns, getColumns, resolveGeoColumns, matchComposante } from "@/lib/supervision/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Diagnostic : expose les colonnes détectées de chaque formulaire Kobo afin
 * d'ajuster, au besoin, les mots-clés de config/supervision.config.ts.
 */
export async function GET() {
  try {
    const sources = await fetchAllSources({ force: true });
    const out = sources.map((s) => {
      const columns = getColumns(s.rows);
      const qCols = detectQuestionColumns(s.rows);
      return {
        level: s.level,
        label: s.label,
        ok: s.ok,
        error: s.error,
        rowCount: s.rows.length,
        geo: resolveGeoColumns(columns),
        questionColumns: qCols.map((q) => ({ column: q, composante: matchComposante(q) })),
        allColumns: columns,
        sample: s.rows.slice(0, 2),
      };
    });
    return NextResponse.json({ sources: out });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}

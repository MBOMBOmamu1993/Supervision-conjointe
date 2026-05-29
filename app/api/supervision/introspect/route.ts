import { NextResponse } from "next/server";
import { fetchAllSources } from "@/lib/supervision/kobo-client";
import { detectScoreQuestions, getColumns, resolveGeoColumns } from "@/lib/supervision/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Diagnostic : expose les colonnes détectées de chaque formulaire Kobo afin
 * d'ajuster, au besoin, la config (mapping composantes / champs géo).
 */
export async function GET() {
  try {
    const sources = await fetchAllSources({ force: true });
    const out = sources.map((s) => {
      const columns = getColumns(s.rows);
      const scoreQs = detectScoreQuestions(columns);
      return {
        level: s.level,
        label: s.label,
        ok: s.ok,
        error: s.error,
        rowCount: s.rows.length,
        geo: resolveGeoColumns(columns),
        questionCount: scoreQs.length,
        questions: scoreQs.map((q) => ({ scoreCol: q.scoreCol, maxCol: q.maxCol, token: q.token, composante: q.composante, label: q.label })),
        unmatchedComposante: scoreQs.filter((q) => !q.composante).map((q) => q.token),
        allColumns: columns,
        sample: s.rows.slice(0, 2),
      };
    });
    return NextResponse.json({ sources: out });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}

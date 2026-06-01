import { NextRequest, NextResponse } from "next/server";
import { fetchAllSources, fetchAllCqdSources } from "@/lib/supervision/kobo-client";
import { buildBundle } from "@/lib/supervision/analytics";
import { buildCqdBundle } from "@/lib/cqd/analytics";
import { buildZsReport, buildCsReport } from "@/lib/reports/pptx";
import { TARGETS } from "@/lib/server/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Génération PPTX : peut être un peu longue (téléchargement Kobo + rendu).
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const type = sp.get("type") === "cs" ? "cs" : "zs";
  try {
    const [supSources, cqdSources] = await Promise.all([fetchAllSources(), fetchAllCqdSources()]);
    const sup = buildBundle(supSources, {}, TARGETS);
    const cqd = buildCqdBundle(cqdSources, {});

    const buffer = type === "cs" ? await buildCsReport(sup, cqd) : await buildZsReport(sup, cqd);
    const filename =
      type === "cs"
        ? "Rapport_Supervision_PEV_CQD_Centres_Sante_Tshuapa.pptx"
        : "Rapport_Supervision_PEV_CQD_ZS_Tshuapa.pptx";

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}

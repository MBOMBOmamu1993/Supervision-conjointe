import { NextRequest, NextResponse } from "next/server";
import { fetchAllSources } from "@/lib/supervision/kobo-client";
import { buildBundle } from "@/lib/supervision/analytics";
import { buildSupReport, buildCqdZsReport, buildCqdCsReport } from "@/lib/reports/pptx";
import { TARGETS } from "@/lib/server/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FILES: Record<string, string> = {
  sup: "Rapport_Supervision_Conjointe_PEV_OMS_Tshuapa.pptx",
  cqzs: "Rapport_Automatise_CQD_ZS_Tshuapa.pptx",
  cqas: "Rapport_Automatise_CQD_Centres_Sante_Tshuapa.pptx",
};

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") ?? "sup";
  try {
    let buffer: Buffer;
    if (type === "cqzs") {
      buffer = await buildCqdZsReport();
    } else if (type === "cqas") {
      buffer = await buildCqdCsReport();
    } else {
      // Rapport supervision : alimenté en temps réel par les données KOBO.
      const sources = await fetchAllSources();
      const sup = buildBundle(sources, {}, TARGETS);
      buffer = await buildSupReport(sup);
    }
    const filename = FILES[type] ?? FILES.sup;
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

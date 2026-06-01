import { NextRequest, NextResponse } from "next/server";
import { buildZsReport, buildCsReport } from "@/lib/reports/pptx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* Noms de fichiers — cf. §1 de la spec (champs dynamiques [ZS]/[AS]/[Période]). */
const FILES: Record<string, string> = {
  zs: "Rapport_supervision_PEV_CQD_Tshuapa_Bokungu_Jan-Mars-2026.pptx",
  cs: "Rapport_supervision_PEV_CQD_Tshuapa_CS_Lofima-2_Jan-Mars-2026.pptx",
};

export async function GET(_req: NextRequest, { params }: { params: { type: string } }) {
  const type = (params.type ?? "").toLowerCase();
  if (type !== "zs" && type !== "cs") {
    return NextResponse.json({ error: `Type de rapport inconnu : « ${type} » (attendu : zs | cs).` }, { status: 400 });
  }
  try {
    const buffer = type === "zs" ? await buildZsReport() : await buildCsReport();
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${FILES[type]}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { buildZsReport, buildCsReport, type Headline } from "@/lib/reports/pptx";
import { fetchAllSources, fetchAllCqdSources } from "@/lib/supervision/kobo-client";
import { buildBundle, type Filters } from "@/lib/supervision/analytics";
import { buildCqdBundle, type CqdFilters } from "@/lib/cqd/analytics";
import { TARGETS } from "@/lib/server/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* Noms de fichiers — cf. §1 de la spec (champs dynamiques [ZS]/[AS]/[Période]). */
const FILES: Record<"zs" | "cs", string> = {
  zs: "Rapport_supervision_PEV_CQD_Tshuapa_ZS.pptx",
  cs: "Rapport_supervision_PEV_CQD_Tshuapa_CS.pptx",
};

/** Résout le type de rapport en tolérant les anciens chemins (rétro-compat). */
function resolveType(raw: string, query: string): "zs" | "cs" {
  const map: Record<string, "zs" | "cs"> = {
    zs: "zs", cs: "cs",
    cqzs: "zs", cqas: "cs", cqcs: "cs",
    sup: "zs", // ancien rapport « supervision conjointe » → consolidé ZS
  };
  for (const v of [raw.toLowerCase(), query.toLowerCase()]) {
    if (map[v]) return map[v];
  }
  return "zs"; // jamais d'erreur de téléchargement : repli sur le rapport ZS
}

function multi(sp: URLSearchParams, key: string): string[] {
  const out: string[] = [];
  for (const v of sp.getAll(key)) for (const part of v.split(",")) { const t = part.trim(); if (t) out.push(t); }
  return out;
}

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
function periodLabel(months: string[]): string | null {
  if (!months.length) return null;
  const fmt = (m: string) => {
    const x = m.match(/(\d{4})-(\d{2})/);
    if (!x) return m;
    const mi = parseInt(x[2], 10) - 1;
    return `${(MOIS[mi] ?? "").replace(/^./, (c) => c.toUpperCase())} ${x[1]}`;
  };
  const sorted = [...months].sort();
  return sorted.length === 1 ? fmt(sorted[0]) : `${fmt(sorted[0])} – ${fmt(sorted[sorted.length - 1])}`;
}

/**
 * Construit les valeurs d'en-tête RÉELLES depuis les données du tableau de bord
 * (supervision + contrôle qualité), filtrées. En cas d'indisponibilité Kobo,
 * on renvoie `undefined` → le rapport conserve ses valeurs représentatives.
 */
async function computeHeadline(type: "zs" | "cs", sp: URLSearchParams): Promise<Headline | undefined> {
  const filters: Filters = {
    province: sp.get("province"),
    antenne: sp.get("antenne"),
    zone: sp.get("zone"),
    aire: sp.get("aire"),
    months: multi(sp, "months"),
    types: multi(sp, "types"),
  };
  const cqdFilters: CqdFilters = { ...filters };
  try {
    const [supSources, cqdSources] = await Promise.all([fetchAllSources(), fetchAllCqdSources()]);
    const sup = buildBundle(supSources, filters, TARGETS);
    const cqd = buildCqdBundle(cqdSources, cqdFilters);
    const period = periodLabel(cqd.meta.months.length ? cqd.meta.months : sup.meta.months);

    if (type === "zs") {
      const zsSup = sup.levels.zs;
      const zsCqd = cqd.levels.zs;
      const ge80 = zsSup.perStructure.filter((s) => (s.score ?? 0) >= 80).length;
      return {
        period,
        unitsControlled: zsCqd.structuresControlees || zsSup.perStructure.length || null,
        unitsPlanned: 12,
        asVerified: cqd.levels.as.structuresControlees || null,
        unitsScored80: ge80,
        scoreMoyen: zsSup.score.moyen,
        concP3: zsCqd.concordanceP3.taux,
        concRR2: zsCqd.concordanceRr2.taux,
        erreur: zsCqd.erreurSnisDhis2,
        enfRecup: zsCqd.enfants.recuperes || null,
        enfIdent: zsCqd.enfants.identifies || null,
      };
    }
    const asSup = sup.levels.as;
    const asCqd = cqd.levels.as;
    return {
      period,
      unitsControlled: asSup.perStructure.length || asSup.records || null,
      unitsPlanned: 279,
      scoreMoyen: asSup.score.moyen,
      concP3: asCqd.concordanceP3.taux,
      concRR2: asCqd.concordanceRr2.taux,
      erreur: asCqd.erreurSnisDhis2,
      enfRecup: asCqd.enfants.recuperes || null,
      enfIdent: asCqd.enfants.identifies || null,
    };
  } catch {
    return undefined; // Kobo indisponible → rapport avec valeurs représentatives
  }
}

export async function GET(req: NextRequest, { params }: { params: { type: string } }) {
  const sp = req.nextUrl.searchParams;
  const type = resolveType(params.type ?? "", sp.get("type") ?? "");
  try {
    const headline = await computeHeadline(type, sp);
    const buffer = type === "zs" ? await buildZsReport(headline) : await buildCsReport(headline);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${FILES[type]}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: `La génération du rapport a échoué. Réessayez dans un instant. (${err instanceof Error ? err.message : String(err)})` },
      { status: 502 }
    );
  }
}

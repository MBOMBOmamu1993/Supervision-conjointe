/**
 * « Comparaison Doses des vaccins disponibles et Nombre de vaccinés »
 * (triangulation) — données DHIS2/SNIS de la province du Tshuapa, reproduites à
 * l'identique du dashboard du repo MBOMBOmamu1993/snis-vaccination-api :
 *
 *   Dose disponible = Stock début + Reçues au cours du mois
 *   Vaccinés        = somme des doses administrées de l'antigène (par dose)
 *   Écart           = Dose disponible − Vaccinés   (négatif = doses insuffisantes)
 *   Proportion écarts négatifs = nb d'antigènes à écart négatif / nb d'antigènes
 *   Cohérence vaccinés-doses   = « Oui » si proportion = 0 %, « Non » sinon
 *
 * Niveau CS → une ligne par AIRE DE SANTÉ ; niveau ZS → une ligne par ZONE DE
 * SANTÉ. Les filtres (antenne · ZS · aire · mois) de l'onglet « Contrôle qualité
 * des données » sont appliqués côté serveur.
 */
import {
  fetchTshuapaByAs, num, isoToYm, ymToIso,
} from "@/lib/dhis2/pages";
import {
  canonAntenne, cleanStructureName, snapToKnown, isKnownZone, isKnownAire, norm,
} from "@/lib/geo";
import { ENV } from "@/lib/server/env";

/** Antigènes de la triangulation (ordre et champs identiques au dashboard source). */
const TRIANG_DEFS: { lbl: string; stock: string; recv: string; vacs: string[] }[] = [
  { lbl: "BCG", stock: "BCG_stock_d_but", recv: "BCG_re_ues", vacs: ["BCG_0_11"] },
  { lbl: "VPO", stock: "VPO_stock_d_but", recv: "VPO_re_ues", vacs: ["VPO0_0_11", "VPO1_0_11", "VPO2_0_11", "VPO3_0_11"] },
  { lbl: "DTC/Penta", stock: "DTC_stock_d_but", recv: "DTC_re_ues", vacs: ["DTC1_0_11", "DTC2_0_11", "DTC3_0_11"] },
  { lbl: "PCV13", stock: "PCV13_stock_d_but", recv: "PCV13_re_ues", vacs: ["PCV13_1_0_11", "PCV13_2_0_11", "PCV13_3_0_11"] },
  { lbl: "ROTA", stock: "ROTA_stock_d_but", recv: "ROTA_re_ues", vacs: ["ROTA1_0_11", "ROTA2_0_11", "ROTA3_0_11"] },
  { lbl: "VPI", stock: "VPI_stock_d_but", recv: "VPI_re_ues", vacs: ["VPI1_0_11", "VPI2_0_11"] },
  { lbl: "VAR", stock: "VAR_stock_d_but", recv: "VAR_re_ues", vacs: ["VAR1_0_11", "VAR2_12_23"] },
  { lbl: "VAA", stock: "VAA_stock_d_but", recv: "VAA_re_ues", vacs: ["VAA_0_11"] },
  { lbl: "Td (VAT)", stock: "Td_stock_d_but", recv: "Td_re_ues", vacs: ["Td_2_plus"] },
  { lbl: "VAP", stock: "VAP_stock_d_but", recv: "VAP_re_ues", vacs: ["VAP1_0_11", "VAP2_0_11", "VAP3_0_11", "VAP4_12_23"] },
];

export interface TriAntigene {
  label: string;
  /** Dose disponible = stock début + reçues. */
  dispo: number;
  vaccines: number;
  /** Écart = dispo − vaccinés. */
  ecart: number;
}
export interface TriRow {
  name: string;
  antenne: string | null;
  antigenes: TriAntigene[];
  /** Proportion d'antigènes à écart négatif (%). */
  propNeg: number;
  /** « Oui » si aucun antigène n'a un écart négatif. */
  coherence: boolean;
}
export interface TriBundle {
  level: "as" | "zs";
  /** Libellés des antigènes (en-têtes de colonnes). */
  antigenes: string[];
  /** Mois effectivement agrégés (ISO "YYYY-MM"). */
  months: string[];
  rows: TriRow[];
  records: number;
  generatedAt: string;
  error?: string;
}

export interface TriFilters {
  province?: string | null;
  antenne?: string | null;
  zone?: string | null;
  aire?: string | null;
  months?: string[];
}

interface RawRec {
  _Province?: string;
  _Antenne?: string;
  _ZS?: string;
  _AS?: string;
  _YM?: string;
  [k: string]: unknown;
}

const eq = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && norm(a) === norm(b);

/** Nom canonique d'une ZS DHIS2 (« tu Boende Zone de Santé » → « Boende »). */
function cleanZs(raw: string | null | undefined, antenne: string | null): string | null {
  return snapToKnown(cleanStructureName(raw ?? null, null, antenne), isKnownZone) ?? cleanStructureName(raw ?? null, null, antenne);
}
/** Nom canonique d'une AS DHIS2 (« tu Motema Mosantu Aire de Santé » → « Motema Mosantu »). */
function cleanAs(raw: string | null | undefined, zone: string | null, antenne: string | null): string | null {
  return snapToKnown(cleanStructureName(raw ?? null, zone, antenne), isKnownAire) ?? cleanStructureName(raw ?? null, zone, antenne);
}

type CacheEntry = { at: number; value: TriBundle };
const cache = new Map<string, CacheEntry>();
let recsCache: { at: number; recs: RawRec[] } | null = null;

async function loadRecs(force: boolean): Promise<RawRec[]> {
  if (!force && recsCache && (Date.now() - recsCache.at) / 1000 < ENV.CACHE_TTL_SECONDS) return recsCache.recs;
  const recs = await fetchTshuapaByAs<RawRec>();
  recsCache = { at: Date.now(), recs };
  return recs;
}

/** Construit la triangulation pour un niveau (AS ou ZS) et un jeu de filtres. */
export async function fetchTriangulation(
  level: "as" | "zs",
  filters: TriFilters = {},
  opts: { force?: boolean } = {},
): Promise<TriBundle> {
  const cacheKey = `${level}|${JSON.stringify(filters)}`;
  const hit = cache.get(cacheKey);
  if (!opts.force && hit && (Date.now() - hit.at) / 1000 < ENV.CACHE_TTL_SECONDS) return hit.value;

  const antigenes = TRIANG_DEFS.map((d) => d.lbl);
  try {
    const recs = await loadRecs(!!opts.force);

    // Mois disponibles (avec au moins une donnée de stock/dose) et mois effectifs.
    const hasData = (r: RawRec) =>
      TRIANG_DEFS.some((d) => num(r[d.stock]) > 0 || num(r[d.recv]) > 0 || d.vacs.some((v) => num(r[v]) > 0));
    const availYm = new Set<string>();
    for (const r of recs) if (r._YM && hasData(r)) availYm.add(String(r._YM));
    const available = [...availYm].sort();
    const selectedYm = (filters.months ?? []).map(isoToYm).filter((ym) => availYm.has(ym));
    // À défaut de filtre mois : dernier mois publié (le tableau est « au cours du mois »).
    const effectiveYm = selectedYm.length ? selectedYm : available.length ? [available[available.length - 1]] : [];
    const effSet = new Set(effectiveYm);

    // Filtrage géographique + restriction aux mois effectifs.
    const filtered = recs.filter((r) => {
      if (!effSet.has(String(r._YM))) return false;
      if (filters.antenne && !eq(canonAntenne(r._Antenne), canonAntenne(filters.antenne))) return false;
      const zone = cleanZs(r._ZS, r._Antenne ?? null);
      if (filters.zone && !eq(zone, filters.zone)) return false;
      if (level === "as" && filters.aire) {
        const aire = cleanAs(r._AS, r._ZS ?? null, r._Antenne ?? null);
        if (!eq(aire, filters.aire)) return false;
      }
      return true;
    });

    // Regroupement par unité d'organisation (AS ou ZS).
    const groups = new Map<string, RawRec[]>();
    for (const r of filtered) {
      const zone = cleanZs(r._ZS, r._Antenne ?? null);
      const key = level === "as" ? cleanAs(r._AS, r._ZS ?? null, r._Antenne ?? null) : zone;
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }

    const rows: TriRow[] = [...groups.entries()]
      .map(([name, grp]) => {
        let neg = 0;
        const ants = TRIANG_DEFS.map((d) => {
          const stock = grp.reduce((s, r) => s + num(r[d.stock]), 0);
          const recv = grp.reduce((s, r) => s + num(r[d.recv]), 0);
          const dispo = stock + recv;
          const vaccines = d.vacs.reduce((s, v) => s + grp.reduce((s2, r) => s2 + num(r[v]), 0), 0);
          const ecart = dispo - vaccines;
          if (ecart < 0) neg++;
          return { label: d.lbl, dispo, vaccines, ecart };
        });
        const propNeg = Math.round((neg / TRIANG_DEFS.length) * 100);
        return {
          name,
          antenne: grp[0]?._Antenne ? String(grp[0]._Antenne) : null,
          antigenes: ants,
          propNeg,
          coherence: propNeg === 0,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));

    const bundle: TriBundle = {
      level,
      antigenes,
      months: effectiveYm.map(ymToIso),
      rows,
      records: filtered.length,
      generatedAt: new Date().toISOString(),
    };
    cache.set(cacheKey, { at: Date.now(), value: bundle });
    return bundle;
  } catch (err) {
    return {
      level,
      antigenes,
      months: [],
      rows: [],
      records: 0,
      generatedAt: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

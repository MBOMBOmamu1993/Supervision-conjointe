/**
 * « Prestation de services » (onglet Rapport mensuel des AT) alimentée par les
 * données DHIS2/SNIS de la province du Tshuapa (repo snis-vaccination-api) :
 *
 *  · Séances de vaccination PLANIFIÉES vs RÉALISÉES (fixes · avancées · mobiles)
 *    → % des aires de santé ayant réalisé ≥ 80 % de leurs séances, par mois et
 *      par antenne (Boende · Bokungu) ;
 *  · Couvertures vaccinales administratives → % des aires de santé avec CV ≥ 90 %
 *    par antigène (Penta1 · Penta3 · RR1 · RR2).
 *
 * CV mensuelle (identique au dashboard source / lib/dhis2/cv) :
 *   cible NS mensuelle = Pop_par_AS × 3,49 % / 12 ; CV = doses / cible × 100.
 */
import { fetchTshuapaByAs, num, ymToIso } from "@/lib/dhis2/pages";
import { canonAntenne, norm } from "@/lib/geo";
import { fmtMonth } from "@/lib/client/format";
import { ENV } from "@/lib/server/env";
import { defaultTargetYm } from "@/lib/dhis2/triangulation";

/** Année de référence pour les graphiques mensuels de prestation (feedback TL). */
const CHART_YEAR = "2025";

/** Taux annuel « nourrissons survivants » (PEV-RDC). */
const NS_RATE = 0.0349;
/** Antennes PEV de la province du Tshuapa. */
const ANTENNES = ["Boende", "Bokungu"];
/** Seuils de réalisation / couverture. */
const SESSION_THRESHOLD = 0.8;
const CV_THRESHOLD = 90;

const SESSION_DEFS = [
  { key: "fixes", label: "% des AS ayant réalisé au moins 80 % des sessions fixes", prev: "seances_fixes_prevues", real: "seances_fixes_realisees" },
  { key: "avancees", label: "% des AS ayant réalisé au moins 80 % des stratégies avancées", prev: "seances_avancees_prevues", real: "seances_avancees_realisees" },
  { key: "mobiles", label: "% des AS ayant réalisé au moins 80 % des sessions mobiles", prev: "seances_mobiles_prevues", real: "seances_mobiles_realisees" },
];
/** Antigènes de couverture (champ de doses 0-11 mois, sauf RR2 à 12-23 mois). */
const CV_DEFS = [
  { key: "p1", name: "Penta1", field: "DTC1_0_11" },
  { key: "p3", name: "Penta3", field: "DTC3_0_11" },
  { key: "rr1", name: "RR1", field: "VAR1_0_11" },
  { key: "rr2", name: "RR2", field: "VAR2_12_23" },
] as const;

export interface PrestationBundle {
  months: { key: string; label: string }[];
  sessions: { key: string; label: string; series: { antenne: string; values: (number | null)[] }[]; ensemble: (number | null)[] }[];
  couvertures: { cats: string[]; series: { name: string; data: (number | null)[] }[] };
  detail: {
    moisLabel: string | null;
    rows: { antenne: string; fixes: number | null; avancees: number | null; mobiles: number | null; p1: number | null; p3: number | null; rr1: number | null; rr2: number | null }[];
  };
  records: number;
  generatedAt: string;
  error?: string;
}

export interface PrestationFilters {
  antenne?: string | null;
  months?: string[];
}

interface RawRec {
  _Antenne?: string;
  _AS?: string;
  _YM?: string;
  Pop_par_AS?: number;
  [k: string]: unknown;
}

type CacheEntry = { at: number; value: PrestationBundle };
const cache = new Map<string, CacheEntry>();
let recsCache: { at: number; recs: RawRec[] } | null = null;

async function loadRecs(force: boolean): Promise<RawRec[]> {
  if (!force && recsCache && (Date.now() - recsCache.at) / 1000 < ENV.CACHE_TTL_SECONDS) return recsCache.recs;
  const recs = await fetchTshuapaByAs<RawRec>();
  recsCache = { at: Date.now(), recs };
  return recs;
}

const sameAntenne = (a: string | null | undefined, b: string) => norm(canonAntenne(a) ?? "") === norm(b);

/** % d'AS d'un sous-ensemble ayant réalisé ≥ 80 % de leurs séances (un type). */
function sessionPct(recs: RawRec[], prev: string, real: string): number | null {
  const withPlan = recs.filter((r) => num(r[prev]) > 0);
  if (!withPlan.length) return null;
  const ok = withPlan.filter((r) => num(r[real]) / num(r[prev]) >= SESSION_THRESHOLD).length;
  return Math.round((ok / withPlan.length) * 100);
}
/** CV administrative (%) d'une AS pour un antigène donné. */
function cvOf(r: RawRec, field: string): number | null {
  const cible = (num(r.Pop_par_AS) * NS_RATE) / 12;
  if (cible <= 0) return null;
  return (num(r[field]) / cible) * 100;
}
/** % d'AS d'un sous-ensemble avec CV ≥ 90 % pour un antigène. */
function cvPct(recs: RawRec[], field: string): number | null {
  const vals = recs.map((r) => cvOf(r, field)).filter((v): v is number => v != null);
  if (!vals.length) return null;
  return Math.round((vals.filter((v) => v >= CV_THRESHOLD).length / vals.length) * 100);
}

export async function fetchDhis2Prestation(
  filters: PrestationFilters = {},
  opts: { force?: boolean } = {},
): Promise<PrestationBundle> {
  const cacheKey = JSON.stringify(filters);
  const hit = cache.get(cacheKey);
  if (!opts.force && hit && (Date.now() - hit.at) / 1000 < ENV.CACHE_TTL_SECONDS) return hit.value;

  const empty: PrestationBundle = {
    months: [], sessions: [], couvertures: { cats: [], series: [] },
    detail: { moisLabel: null, rows: [] }, records: 0, generatedAt: new Date().toISOString(),
  };
  try {
    const recs = await loadRecs(!!opts.force);
    const antennes = filters.antenne ? ANTENNES.filter((a) => sameAntenne(filters.antenne, a)) : ANTENNES;

    // Mois disponibles (avec séances planifiées ou doses) et mois effectifs.
    const hasData = (r: RawRec) =>
      SESSION_DEFS.some((s) => num(r[s.prev]) > 0) || CV_DEFS.some((c) => num(r[c.field]) > 0);
    const availYm = new Set<string>();
    for (const r of recs) if (r._YM && hasData(r)) availYm.add(String(r._YM));
    const available = [...availYm].sort();
    if (!available.length) { cache.set(cacheKey, { at: Date.now(), value: empty }); return empty; }

    // Graphiques mensuels : situation de l'année 2025 (feedback TL), filtrables
    // par antenne PEV. À défaut de données 2025, on retombe sur les mois publiés.
    const ym2025 = available.filter((ym) => ym.slice(0, 4) === CHART_YEAR);
    const chartYm = ym2025.length ? ym2025 : available;
    // Mois de référence (détail & couvertures) : M−2 avant le 20, sinon M−1 ;
    // à défaut de publication, dernier mois disponible.
    const target = defaultTargetYm();
    const refYm = availYm.has(target) ? target : available[available.length - 1];

    const sub = (ant: string, ym: string) => recs.filter((r) => sameAntenne(r._Antenne, ant) && String(r._YM) === ym);
    const subMonth = (ym: string) => recs.filter((r) => antennes.some((a) => sameAntenne(r._Antenne, a)) && String(r._YM) === ym);

    // 1. Séances réalisées (≥ 80 %) — séries mensuelles 2025 par antenne + ensemble.
    const sessions = SESSION_DEFS.map((s) => ({
      key: s.key,
      label: s.label,
      series: antennes.map((ant) => ({
        antenne: ant,
        values: chartYm.map((ym) => sessionPct(sub(ant, ym), s.prev, s.real)),
      })),
      ensemble: chartYm.map((ym) => sessionPct(subMonth(ym), s.prev, s.real)),
    }));

    // 2. Couvertures ≥ 90 % par antigène — catégories antenne (mois de référence).
    const couvertures = {
      cats: antennes.slice(),
      series: CV_DEFS.map((c) => ({
        name: c.name,
        data: antennes.map((ant) => cvPct(sub(ant, refYm), c.field)),
      })),
    };

    // 3. Détail par antenne — mois de référence (M−2 / M−1).
    const detail = {
      moisLabel: fmtMonth(ymToIso(refYm)),
      rows: antennes.map((ant) => {
        const rs = sub(ant, refYm);
        return {
          antenne: ant,
          fixes: sessionPct(rs, "seances_fixes_prevues", "seances_fixes_realisees"),
          avancees: sessionPct(rs, "seances_avancees_prevues", "seances_avancees_realisees"),
          mobiles: sessionPct(rs, "seances_mobiles_prevues", "seances_mobiles_realisees"),
          p1: cvPct(rs, "DTC1_0_11"),
          p3: cvPct(rs, "DTC3_0_11"),
          rr1: cvPct(rs, "VAR1_0_11"),
          rr2: cvPct(rs, "VAR2_12_23"),
        };
      }),
    };

    const bundle: PrestationBundle = {
      months: chartYm.map((ym) => ({ key: ymToIso(ym), label: fmtMonth(ymToIso(ym)) })),
      sessions,
      couvertures,
      detail,
      records: recs.filter((r) => chartYm.includes(String(r._YM)) && antennes.some((a) => sameAntenne(r._Antenne, a))).length,
      generatedAt: new Date().toISOString(),
    };
    cache.set(cacheKey, { at: Date.now(), value: bundle });
    return bundle;
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.message : String(err) };
  }
}

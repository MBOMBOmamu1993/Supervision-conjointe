/**
 * « Gestion des vaccins » (onglet Rapport mensuel des AT) — TAUX DE DISPONIBILITÉ
 * des vaccins PENTA et RR, alimenté par les données de LOGISTIQUE DHIS2/SNIS de
 * la province du Tshuapa (repo MBOMBOmamu1993/snis-vaccination-api).
 *
 * Méthode reproduite À L'IDENTIQUE du dashboard source (docs/index.html, page
 * « Logistique » — KPI « Taux de disponibilité des vaccins ») :
 *
 *   Pour chaque enregistrement (1 aire de santé × 1 mois) où l'antigène a été
 *   rapporté — hasItem = reçues > 0 OU stock final > 0 OU CMM > 0 OU jours de
 *   rupture > 0 — on cumule 30 jours et les jours de rupture rapportés :
 *
 *     Taux de disponibilité (%) = (Σ 30 − Σ jours_rupture) / Σ 30 × 100
 *
 *   PENTA ↔ champs DTC_* ; RR ↔ champs VAR_*. Agrégé par antenne × mois et par
 *   zone de santé × mois. Situation de l'année 2026 uniquement (feedback TL).
 *
 * Pas de credentials (Pages public). Cache mémoire TTL. Ne JAMAIS importer côté
 * client (gzip node:zlib via fetchTshuapaByAs).
 */
import { fetchTshuapaByAs, num, ymToIso } from "@/lib/dhis2/pages";
import { canonAntenne, cleanDhis2OrgUnit, snapToKnown, isKnownZone, norm } from "@/lib/geo";
import { fmtMonth } from "@/lib/client/format";
import { ENV } from "@/lib/server/env";

/** Année de référence des graphiques mensuels (feedback TL). */
const CHART_YEAR = "2026";
/** Antennes PEV de la province du Tshuapa. */
const ANTENNES = ["Boende", "Bokungu"];

/** Antigènes suivis (libellé d'affichage ↔ préfixe des champs logistiques DHIS2). */
const ANTIGENS = [
  { key: "penta", label: "PENTA", prefix: "DTC" },
  { key: "rr", label: "RR", prefix: "VAR" },
] as const;

/** Série mensuelle par unité d'organisation (antenne ou ZS), alignée sur `months`. */
export interface DispoSeries {
  /** Nom de l'unité (antenne ou zone de santé). */
  antenne: string;
  values: (number | null)[];
}
export interface DispoBundle {
  months: { key: string; label: string }[];
  /** 4 jeux : PENTA/RR × niveau antenne/ZS. */
  dispo: { key: string; label: string; series: DispoSeries[] }[];
  records: number;
  generatedAt: string;
  error?: string;
}

export interface LogistiqueFilters {
  antenne?: string | null;
  /** Mois ISO "YYYY-MM" (optionnel ; à défaut, tous les mois 2026 publiés). */
  months?: string[];
}

interface RawRec {
  _Antenne?: string;
  _ZS?: string;
  _AS?: string;
  _YM?: string;
  [k: string]: unknown;
}

type CacheEntry = { at: number; value: DispoBundle };
const cache = new Map<string, CacheEntry>();
let recsCache: { at: number; recs: RawRec[] } | null = null;

async function loadRecs(force: boolean): Promise<RawRec[]> {
  if (!force && recsCache && (Date.now() - recsCache.at) / 1000 < ENV.CACHE_TTL_SECONDS) return recsCache.recs;
  const recs = await fetchTshuapaByAs<RawRec>();
  recsCache = { at: Date.now(), recs };
  return recs;
}

const sameAntenne = (a: string | null | undefined, b: string) =>
  norm(canonAntenne(cleanDhis2OrgUnit(a)) ?? "") === norm(canonAntenne(cleanDhis2OrgUnit(b)) ?? "");

/** Nom canonique d'une ZS DHIS2 (« tu Boende Zone de Santé » → « Boende »). */
function cleanZs(raw: string | null | undefined): string | null {
  const base = cleanDhis2OrgUnit(raw);
  if (!base) return null;
  return snapToKnown(base, isKnownZone) ?? base;
}

/**
 * Taux de disponibilité (%) d'un antigène pour un sous-ensemble d'enregistrements
 * (méthode identique au dashboard snis-vaccination-api : voir entête du module).
 */
function dispoRate(recs: RawRec[], prefix: string): number | null {
  let sumRup = 0;
  let sumDays = 0;
  for (const r of recs) {
    const rcv = num(r[`${prefix}_re_ues`]);
    const sf = num(r[`${prefix}_stock_fin`]);
    const cmm = num(r[`${prefix}_cmm`]);
    const rup = Math.max(0, num(r[`${prefix}_jours_rupture`]));
    const hasItem = rcv > 0 || sf > 0 || cmm > 0 || rup > 0;
    if (!hasItem) continue;
    sumRup += rup;
    sumDays += 30;
  }
  if (sumDays <= 0) return null;
  return Math.round(((sumDays - sumRup) / sumDays) * 1000) / 10;
}

/** Un enregistrement rapporte-t-il au moins un des deux antigènes suivis ? */
const reported = (r: RawRec) =>
  ANTIGENS.some(({ prefix }) =>
    num(r[`${prefix}_re_ues`]) > 0 || num(r[`${prefix}_stock_fin`]) > 0 ||
    num(r[`${prefix}_cmm`]) > 0 || num(r[`${prefix}_jours_rupture`]) > 0);

export async function fetchDhis2Logistique(
  filters: LogistiqueFilters = {},
  opts: { force?: boolean } = {},
): Promise<DispoBundle> {
  const cacheKey = JSON.stringify(filters);
  const hit = cache.get(cacheKey);
  if (!opts.force && hit && (Date.now() - hit.at) / 1000 < ENV.CACHE_TTL_SECONDS) return hit.value;

  const empty: DispoBundle = { months: [], dispo: [], records: 0, generatedAt: new Date().toISOString() };
  try {
    const recs = await loadRecs(!!opts.force);
    const antennes = filters.antenne ? ANTENNES.filter((a) => sameAntenne(filters.antenne, a)) : ANTENNES;

    // Mois 2026 effectivement publiés (au moins un enregistrement de logistique).
    const availYm = new Set<string>();
    for (const r of recs) if (r._YM && String(r._YM).slice(0, 4) === CHART_YEAR && reported(r)) availYm.add(String(r._YM));
    let chartYm = [...availYm].sort();
    if (filters.months?.length) {
      const wanted = new Set(filters.months.map((m) => m.replace("-", "")));
      chartYm = chartYm.filter((ym) => wanted.has(ym));
    }
    if (!chartYm.length) { cache.set(cacheKey, { at: Date.now(), value: empty }); return empty; }

    // Sous-ensembles par antenne et par ZS (restreints aux antennes filtrées).
    const inScope = (r: RawRec) => antennes.some((a) => sameAntenne(r._Antenne, a));
    const zones = [...new Set(recs.filter(inScope).map((r) => cleanZs(r._ZS)).filter((z): z is string => !!z))]
      .sort((a, b) => a.localeCompare(b, "fr"));

    const subAntMonth = (ant: string, ym: string) =>
      recs.filter((r) => sameAntenne(r._Antenne, ant) && String(r._YM) === ym);
    const subZsMonth = (zs: string, ym: string) =>
      recs.filter((r) => inScope(r) && cleanZs(r._ZS) === zs && String(r._YM) === ym);

    const dispo = [
      ...ANTIGENS.map((ag) => ({
        key: `${ag.key}_antenne`,
        label: `Taux de disponibilité des vaccins ${ag.label} — niveau antenne et par mois`,
        series: antennes.map((ant) => ({
          antenne: ant,
          values: chartYm.map((ym) => dispoRate(subAntMonth(ant, ym), ag.prefix)),
        })),
      })),
      ...ANTIGENS.map((ag) => ({
        key: `${ag.key}_zs`,
        label: `Taux de disponibilité des vaccins ${ag.label} — niveau zones de santé et par mois`,
        series: zones.map((zs) => ({
          antenne: zs,
          values: chartYm.map((ym) => dispoRate(subZsMonth(zs, ym), ag.prefix)),
        })),
      })),
    ];

    const bundle: DispoBundle = {
      months: chartYm.map((ym) => ({ key: ymToIso(ym), label: fmtMonth(ymToIso(ym)) })),
      dispo,
      records: recs.filter((r) => chartYm.includes(String(r._YM)) && inScope(r)).length,
      generatedAt: new Date().toISOString(),
    };
    cache.set(cacheKey, { at: Date.now(), value: bundle });
    return bundle;
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.message : String(err) };
  }
}

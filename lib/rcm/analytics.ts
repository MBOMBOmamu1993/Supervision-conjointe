/**
 * Analytique RCM (Monitorage rapide de convenance).
 *
 * Le formulaire comporte des repeats imbriqués `identification → menage → enfant`.
 * L'export Kobo (JSON nesté ou XLSX par feuille) est aplati ici en « enregistrements
 * enfant » qui héritent du contexte de leur parent (géographie, distance, date),
 * conformément au mapping de `specs/04_MONITORAGE_RCM.md`. Le formulaire n'ayant
 * pas encore de soumissions, l'agrégation renvoie des structures vides mais
 * complètes : les visuels s'alimentent automatiquement dès les premières données.
 */
import type { RawRow } from "@/lib/supervision/types";
import { canonAntenne, norm } from "@/lib/geo";
import {
  RCM_ANTIGENES, RCM_ANTIGENE_LABEL, AGE_GROUP_LABEL,
  type RcmBundle, type RcmAntigene, type AgeGroup, type DistanceBand, type ReasonCount,
} from "./types";

export interface RcmFilters {
  province: string | null; antenne: string | null; zone: string | null; aire: string | null;
  months: string[]; types: string[];
}

const DISTANCES: DistanceBand[] = ["moins_5km", "entre_5_10km", "plus_10km"];
const AGE_GROUPS: AgeGroup[] = ["age_0_11", "age_12_23", "age_24_59"];

/** Champ réel par antigène (RR1/RR2 sont stockés `var_rr1` / `var_rr2`). */
const ANTIGENE_FIELD: Record<RcmAntigene, string> = {
  penta1: "penta1", penta2: "penta2", rr1: "var_rr1", rr2: "var_rr2", vpi1: "vpi1", vpi2: "vpi2",
};

const REASONS_CARTE: Record<string, string> = {
  carte_non_disponible_cs: "Carte non disponible au CS",
  carte_perdue: "Carte perdue",
  pas_moyen_acheter: "Pas de moyen d'acheter la carte",
  connait_pas_importance: "Ne connaît pas l'importance",
  autre: "Autre",
};
const REASONS_VACC: Record<string, string> = {
  censure_religieuse: "Censure religieuse", cout_eleve: "Coût élevé", enfant_malade: "Enfant malade",
  ignore_importance_doses_suivantes: "Ignore l'importance des doses suivantes", longue_attente: "Longue attente",
  mere_trop_occupee: "Mère trop occupée", moment_inopportun: "Moment inopportun",
  ne_croit_pas_vaccination: "Ne croit pas à la vaccination", peur_effets_secondaires: "Peur des effets secondaires",
  problemes_familiaux: "Problèmes familiaux", rumeurs: "Rumeurs", seance_annulee: "Séance annulée",
  site_trop_eloigne: "Site trop éloigné", horaire_site_non_connu: "Horaire du site non connu",
  vaccins_non_disponibles: "Vaccins non disponibles", vaccinateur_absent: "Vaccinateur absent",
  mauvais_accueil: "Mauvais accueil", autre: "Autre",
};

const lastSeg = (k: string) => k.split(/[/.]/).pop()!.toLowerCase();
const str = (v: unknown): string => (v == null ? "" : String(v).trim());

/**
 * Nettoyage des libellés géographiques encodés « type_parent_nom » (valeurs XML
 * Kobo). Le nom réel est en fin de chaîne, précédé du code de niveau (prov/ant/
 * zs/as) et du nom du parent immédiat. Ex. « as_befale_bekiri » (zone Befale)
 * → « Bekiri » ; « ant_tshuapa_boende » → « Boende ».
 */
const GEO_TYPE_PREFIX = new Set(["prov", "province", "ant", "antenne", "zs", "zone", "cs", "as", "aire"]);
function prettifyGeo(s: string): string {
  return s.split(/[_\s]+/).filter(Boolean)
    .map((w) => (/^\d+$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}
function cleanGeoName(raw: string | null, parents: (string | null)[]): string | null {
  if (!raw) return null;
  let parts = String(raw).split("_").filter(Boolean);
  if (parts.length > 1 && GEO_TYPE_PREFIX.has(norm(parts[0]))) parts = parts.slice(1);
  const parentToks = new Set(parents.filter((p): p is string => !!p).flatMap((p) => norm(p).split(" ")).filter(Boolean));
  while (parts.length > 1 && parentToks.has(norm(parts[0]))) parts = parts.slice(1);
  const cleaned = prettifyGeo(parts.join(" "));
  return cleaned || prettifyGeo(raw);
}

/** Carte d'accès aux scalaires d'un objet, indexée par suffixe de nom de champ. */
function scalarMap(obj: Record<string, unknown>): Record<string, unknown> {
  const m: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && typeof v === "object") continue;
    m[lastSeg(k)] = v;
  }
  return m;
}
const pick = (m: Record<string, unknown>, name: string): unknown => m[name.toLowerCase()];

function selectMulti(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(str).filter(Boolean);
  const s = str(v);
  return s ? s.split(/\s+/).filter(Boolean) : [];
}

function isChild(sm: Record<string, unknown>): boolean {
  if (pick(sm, "age_mois") != null || pick(sm, "age_group") != null || pick(sm, "statut_vaccinal") != null) return true;
  return Object.values(ANTIGENE_FIELD).some((f) => pick(sm, f) != null);
}

/** Aplati une soumission en enregistrements enfant héritant du contexte parent. */
function collect(node: unknown, ctx: Record<string, unknown>, out: Record<string, unknown>[]): void {
  if (Array.isArray(node)) {
    for (const item of node) collect(item, ctx, out);
    return;
  }
  if (!node || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  const sm = scalarMap(obj);
  const merged = { ...ctx, ...sm };
  for (const v of Object.values(obj)) {
    if (Array.isArray(v) || (v && typeof v === "object")) collect(v, merged, out);
  }
  if (isChild(sm)) out.push(merged);
}

/** Antigènes du tableau comparatif CV RCM vs CV DHIS2 (feedback TL). */
const CV_ANTIGENS = ["penta1", "penta3", "rr1", "rr2"] as const;
type CvAntigen = (typeof CV_ANTIGENS)[number];
/** Champs réels par antigène (RR1/RR2 = VAR1/VAR2 dans certains exports). */
const CV_FIELDS: Record<CvAntigen, string[]> = {
  penta1: ["penta1"],
  penta3: ["penta3"],
  rr1: ["var_rr1", "rr1", "var1"],
  rr2: ["var_rr2", "rr2", "var2"],
};

interface Child {
  province: string | null; antenne: string | null; zone: string | null; aire: string | null;
  month: string | null; distance: string; carte: string; ageGroup: string;
  vacc: Record<RcmAntigene, string>;
  /** Statut vaccinal des 4 antigènes du comparatif CV RCM vs DHIS2. */
  cvVacc: Record<CvAntigen, string>;
  reasonsCarte: string[]; reasonsVacc: string[];
}

function toMonth(v: unknown): string | null {
  const s = str(v);
  const m = s.match(/(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : null;
}

function normalize(rows: RawRow[]): Child[] {
  const raw: Record<string, unknown>[] = [];
  for (const r of rows) collect(r, {}, raw);
  // Repli : export plat sans imbrication → chaque ligne « enfant » est déjà un scalaire.
  if (raw.length === 0) {
    for (const r of rows) { const sm = scalarMap(r as Record<string, unknown>); if (isChild(sm)) raw.push(sm); }
  }
  return raw.map((m) => {
    const vacc = {} as Record<RcmAntigene, string>;
    for (const ag of RCM_ANTIGENES) vacc[ag] = str(pick(m, ANTIGENE_FIELD[ag])).toLowerCase();
    const cvVacc = {} as Record<CvAntigen, string>;
    for (const ag of CV_ANTIGENS) {
      let v = "";
      for (const fld of CV_FIELDS[ag]) { v = str(pick(m, fld)).toLowerCase(); if (v) break; }
      cvVacc[ag] = v;
    }
    // Libellés géographiques nettoyés (retrait du code de niveau et des parents
    // encodés en préfixe) — appliqués en cascade Province → Antenne → ZS → Aire.
    const province = cleanGeoName(str(pick(m, "province")) || null, []);
    const antenne = cleanGeoName(str(pick(m, "antenne")) || null, [province]);
    const zone = cleanGeoName(str(pick(m, "zone_sante")) || str(pick(m, "zone")) || null, [antenne, province]);
    const aire = cleanGeoName(str(pick(m, "aire_sante")) || str(pick(m, "aire")) || null, [zone, antenne, province]);
    return {
      province,
      antenne,
      zone,
      aire,
      month: toMonth(pick(m, "date_enquete")) ?? toMonth(pick(m, "today")) ?? toMonth(pick(m, "_submission_time")),
      distance: str(pick(m, "distance_cs")).toLowerCase(),
      carte: str(pick(m, "carte_vaccination")).toLowerCase(),
      ageGroup: str(pick(m, "age_group")).toLowerCase(),
      vacc,
      cvVacc,
      reasonsCarte: selectMulti(pick(m, "raisons_absence_carte")),
      reasonsVacc: selectMulti(pick(m, "raisons_non_vaccination")),
    };
  });
}

const pct = (n: number, d: number): number | null => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);
const isVacc = (s: string) => s.startsWith("oui");
const isMissed = (s: string) => s === "non";

function topReasons(map: Map<string, number>, labels: Record<string, string>): ReasonCount[] {
  return [...map.entries()]
    .map(([key, count]) => ({ key, label: labels[key] ?? key, count }))
    .sort((a, b) => b.count - a.count);
}

export function buildRcmBundle(
  fetched: { label: string; rows: RawRow[]; ok: boolean; error?: string },
  filters: RcmFilters
): RcmBundle {
  const all = normalize(fetched.rows);

  // Options de filtres (avant application).
  const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort();
  const filterOptions = {
    provinces: uniq(all.map((c) => c.province)),
    antennes: uniq(all.map((c) => c.antenne)),
    zones: uniq(all.map((c) => c.zone)),
    aires: uniq(all.map((c) => c.aire)),
    months: uniq(all.map((c) => c.month)),
    types: [] as string[],
    // Tuples géographiques (antennes canonicalisées) → filtres en cascade,
    // dérivés des données de CET onglet.
    geo: all.map((c) => ({
      province: c.province,
      antenne: canonAntenne(c.antenne),
      zone: c.zone,
      aire: c.aire,
    })),
  };

  const months = filters.months ?? [];
  // Comparaison normalisée (casse/accents/espaces) + canonicalisation des
  // antennes, pour que les filtres correspondent aux valeurs du formulaire RCM.
  const eq = (a: string | null, b: string | null) => norm(a ?? "") === norm(b ?? "");
  const children = all.filter((c) =>
    (!filters.province || eq(c.province, filters.province)) &&
    (!filters.antenne || eq(canonAntenne(c.antenne), canonAntenne(filters.antenne))) &&
    (!filters.zone || eq(c.zone, filters.zone)) &&
    (!filters.aire || eq(c.aire, filters.aire)) &&
    (months.length === 0 || (c.month != null && months.includes(c.month)))
  );

  const totalEnfants = children.length;
  const asSet = new Set(children.map((c) => c.aire).filter(Boolean));
  const asTotal = filterOptions.aires.length;

  // Distance (au niveau enfant ≈ localité monitorée).
  const distance = { moins_5km: 0, entre_5_10km: 0, plus_10km: 0 } as Record<DistanceBand, number>;
  for (const c of children) if (c.distance && c.distance in distance) distance[c.distance as DistanceBand]++;
  const distTotal = DISTANCES.reduce((s, d) => s + distance[d], 0);
  const distancePct = {} as Record<DistanceBand, number | null>;
  for (const d of DISTANCES) distancePct[d] = pct(distance[d], distTotal);

  // Carte de vaccination.
  const avecCarte = children.filter((c) => c.carte === "oui").length;
  const cartePct = pct(avecCarte, children.filter((c) => c.carte).length);

  // Enfants manqués par antigène.
  const missByAntigene = RCM_ANTIGENES.map((ag) => {
    const considered = children.filter((c) => c.vacc[ag] && c.vacc[ag] !== "non_applicable");
    const missed = considered.filter((c) => isMissed(c.vacc[ag])).length;
    return { antigene: RCM_ANTIGENE_LABEL[ag], pct: pct(missed, considered.length), missed, total: considered.length };
  });
  // miss_any = au moins un antigène non reçu.
  const missAny = children.filter((c) => RCM_ANTIGENES.some((ag) => isMissed(c.vacc[ag]))).length;
  const missAnyPct = pct(missAny, totalEnfants);

  // Vacciné / non vacciné global (moyenne sur antigènes considérés).
  let vTot = 0, nTot = 0;
  for (const c of children) for (const ag of RCM_ANTIGENES) {
    const s = c.vacc[ag]; if (!s || s === "non_applicable") continue;
    if (isVacc(s)) vTot++; else if (isMissed(s)) nTot++;
  }
  const vaccinePct = pct(vTot, vTot + nTot);
  const nonVaccinePct = pct(nTot, vTot + nTot);

  // Antigènes prioritaires (plus fort % manqué).
  const prio = [...missByAntigene].filter((m) => m.pct != null).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0)).slice(0, 2);
  const antigenesPrioritaires = prio.length ? prio.map((p) => p.antigene).join(" / ") : "—";

  // Par tranche d'âge × antigène.
  const byAge = AGE_GROUPS.map((g) => ({
    group: g, label: AGE_GROUP_LABEL[g],
    antigenes: RCM_ANTIGENES.map((ag) => {
      const grp = children.filter((c) => c.ageGroup === g && c.vacc[ag] && c.vacc[ag] !== "non_applicable");
      return { antigene: RCM_ANTIGENE_LABEL[ag], vaccines: grp.filter((c) => isVacc(c.vacc[ag])).length, nonVaccines: grp.filter((c) => isMissed(c.vacc[ag])).length };
    }),
  }));

  // Heatmap ZS × antigène (% manqués).
  const zones = uniq(children.map((c) => c.zone));
  const missByZs = zones.map((zone) => {
    const zc = children.filter((c) => c.zone === zone);
    const values: Record<string, number | null> = {};
    for (const ag of RCM_ANTIGENES) {
      const considered = zc.filter((c) => c.vacc[ag] && c.vacc[ag] !== "non_applicable");
      values[RCM_ANTIGENE_LABEL[ag]] = pct(considered.filter((c) => isMissed(c.vacc[ag])).length, considered.length);
    }
    return { zone, values };
  });

  // Raisons.
  const carteMap = new Map<string, number>();
  const vaccMap = new Map<string, number>();
  for (const c of children) {
    for (const r of c.reasonsCarte) carteMap.set(r, (carteMap.get(r) ?? 0) + 1);
    for (const r of c.reasonsVacc) vaccMap.set(r, (vaccMap.get(r) ?? 0) + 1);
  }
  const reasonsCarte = topReasons(carteMap, REASONS_CARTE);
  const reasonsVacc = topReasons(vaccMap, REASONS_VACC);

  // Détail par aire de santé.
  const aires = uniq(children.map((c) => c.aire));
  const parAire = aires.map((name) => {
    const ac = children.filter((c) => c.aire === name);
    const rc: Record<string, number> = {}; const rv: Record<string, number> = {};
    for (const c of ac) { for (const r of c.reasonsCarte) rc[r] = (rc[r] ?? 0) + 1; for (const r of c.reasonsVacc) rv[r] = (rv[r] ?? 0) + 1; }
    return { name, zone: ac[0]?.zone ?? null, enfants: ac.length, reasonsCarte: rc, reasonsVacc: rv };
  });

  // CV RCM par aire de santé (numérateur enquête) : vaccinés / enquêtés
  // éligibles × 100, pour les 4 antigènes du comparatif RCM vs DHIS2.
  const cvParAire = aires.map((name) => {
    const ac = children.filter((c) => c.aire === name);
    const cv = {} as Record<CvAntigen, number | null>;
    for (const ag of CV_ANTIGENS) {
      const considered = ac.filter((c) => c.cvVacc[ag] && c.cvVacc[ag] !== "non_applicable");
      cv[ag] = pct(considered.filter((c) => isVacc(c.cvVacc[ag])).length, considered.length);
    }
    return { name, zone: ac[0]?.zone ?? null, enfants: ac.length, cv };
  });

  const sansCartePct = cartePct == null ? null : Math.round((100 - cartePct) * 10) / 10;

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      months: filterOptions.months,
      source: { label: fetched.label, rows: fetched.rows.length, enfants: all.length, ok: fetched.ok, error: fetched.error },
      hasData: all.length > 0,
    },
    filters: filterOptions,
    kpi: {
      asBeneficiaires: asSet.size, asTotal, localites: distTotal || totalEnfants, totalEnfants,
      distance, distancePct, missAnyPct, cartePct, sansCartePct, vaccinePct, nonVaccinePct, antigenesPrioritaires,
    },
    missByAntigene, byAge, missByZs, reasonsCarte, reasonsVacc, parAire, cvParAire,
  };
}

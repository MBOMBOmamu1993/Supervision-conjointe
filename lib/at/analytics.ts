/**
 * Analytique des onglets « Rapport mensuel des AT » et « Évaluation des AT ».
 *
 * Source : formulaire Kobo « Rapport mensuel des AT » (asset avvVUwZZwkg…),
 * une soumission = un AT pour un mois. Les champs sont résolus par leur `name`
 * technique exact (cf. XLSForm `specs/Rapport_mensuel_AT_survey.txt`).
 *
 * Toute la logique de notation est isolée dans `computeAtScore()` : pondérations,
 * taux par critère, gestion des composantes non applicables (NA), score ajusté
 * et seuils sont en CONSTANTES PARAMÉTRABLES (un seul endroit à modifier).
 */
import type { RawRow } from "@/lib/supervision/types";
import { canonAntenne, norm } from "@/lib/geo";
import {
  type AtComponentDef, type AtComponentKey, type AtComponentScore, type AtScore,
  type AtNiveau, type AtNiveauDef, type AtRecord, type AtFilterOptions,
  type RapportBundle, type EvaluationBundle, type AtNarratives, type NarrativeItem,
} from "./types";

/* ============================ Constantes paramétrables ============================ */

export const AT_COMPONENTS: AtComponentDef[] = [
  { key: "reunions",    label: "Tenue & appui aux réunions",            short: "Réunions /15",     max: 15, color: "#1f54b8" },
  { key: "supervisions",label: "Supervisions",                          short: "Supervisions /20", max: 20, color: "#0d9488" },
  { key: "monitorage",  label: "Monitorage de convenance",              short: "Monitorage /10",   max: 10, color: "#2bbd6b" },
  { key: "rougeole",    label: "Surveillance rougeole",                 short: "Rougeole /15",     max: 15, color: "#86d98e" },
  { key: "tnn_mapi",    label: "Surveillance TNN & MAPI graves",        short: "TNN-MAPI /10",     max: 10, color: "#9ca3af" },
  { key: "osp",         label: "OSP & activités spéciales",             short: "OSP /10",          max: 10, color: "#f59e0b" },
  { key: "rapport_pev", label: "Rapports trimestriels antenne PEV",     short: "Rapport PEV /10",  max: 10, color: "#7c3aed" },
  { key: "rapport_oms", label: "Rapports OMS & justification",          short: "Rapport OMS /10",  max: 10, color: "#ec4899" },
];

export const AT_NIVEAUX: AtNiveauDef[] = [
  { key: "excellent",   label: "Excellent",   min: 90, max: 100, color: "#178a44", decision: "Maintenir la performance" },
  { key: "bon",         label: "Bon",         min: 80, max: 89,  color: "#2bbd6b", decision: "Performance satisfaisante" },
  { key: "moyen",       label: "Moyen",       min: 70, max: 79,  color: "#facc15", decision: "Amélioration ciblée" },
  { key: "faible",      label: "Faible",      min: 60, max: 69,  color: "#f59e0b", decision: "Accompagnement rapproché" },
  { key: "insuffisant", label: "Insuffisant", min: 0,  max: 59,  color: "#e23636", decision: "Plan correctif obligatoire" },
];

export function niveauFor(ajuste: number | null): AtNiveauDef | null {
  if (ajuste == null || !Number.isFinite(ajuste)) return null;
  for (const n of AT_NIVEAUX) if (ajuste >= n.min) return n;
  return AT_NIVEAUX[AT_NIVEAUX.length - 1];
}
export const decisionFor = (ajuste: number | null): string => niveauFor(ajuste)?.decision ?? "—";

/* ============================ Helpers de lecture des lignes ============================ */

const lastSeg = (k: string) => k.split(/[/.]/).pop()!.toLowerCase();
const str = (v: unknown): string => (v == null ? "" : String(v).trim());

/** Carte des scalaires indexée par `name` technique (dernier segment). */
function scalarMap(obj: Record<string, unknown>): Record<string, unknown> {
  const m: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && typeof v === "object") continue;
    m[lastSeg(k)] = v;
  }
  return m;
}
const pick = (m: Record<string, unknown>, name: string): unknown => m[name.toLowerCase()];

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", ".").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}
const n0 = (v: unknown): number => num(v) ?? 0;

type YNA = "oui" | "non" | "na" | null;
function yna(v: unknown): YNA {
  const s = norm(str(v));
  if (!s) return null;
  if (/(non.?app|^na$|n\/a|sans.?objet)/.test(s)) return "na";
  if (/(partiel)/.test(s)) return "oui"; // partiellement compte comme appui partiel → traité ailleurs
  if (/^(oui|yes|1|vrai|true)/.test(s)) return "oui";
  if (/^(non|no|0|faux|false)/.test(s)) return "non";
  return null;
}
/** Variante conservant « partiel » distinct (liste linéaire). */
function ynp(v: unknown): "oui" | "partiel" | "non" | "na" | null {
  const s = norm(str(v));
  if (!s) return null;
  if (/(non.?app|^na$|n\/a|sans.?objet)/.test(s)) return "na";
  if (/partiel/.test(s)) return "partiel";
  if (/^(oui|yes|1|vrai|true|dispo|a jour|ajour)/.test(s)) return "oui";
  if (/^(non|no|0|faux|false)/.test(s)) return "non";
  return null;
}

function selectMulti(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(str).filter(Boolean);
  const s = str(v);
  return s ? s.split(/[\s,;]+/).filter(Boolean) : [];
}

/* ============================ Extraction des champs narratifs ============================ */
/* Noms de champs issus du XLSForm « Rapport mensuel des AT » (asset avvVUwZZwkg…).
   On lit les VERBATIMS texte exactement aux champs prévus à cet effet. */

/** Libellés des choix de la liste « problemes » (XLSForm). */
const PROBLEMES_LABELS: Record<string, string> = {
  faible_completude: "Faible complétude des rapports",
  retard_rapportage: "Retard de rapportage",
  faible_couverture: "Faible couverture vaccinale",
  hausse_zero_dose: "Hausse des enfants zéro dose",
  hausse_sous_vaccines: "Hausse des sous-vaccinés",
  rupture_vaccins: "Rupture de vaccins",
  problemes_cdf: "Problèmes de chaîne du froid",
  faible_seances_avancees: "Faible tenue des séances avancées",
  faible_surveillance_mpv: "Faible surveillance des MPV",
  donnees_incoherentes: "Données incohérentes",
  absence_validation_donnees: "Absence de validation des données",
};

/** Une valeur est-elle du texte libre exploitable (pas un code, un oui/non, un nombre ou une date) ? */
function isNarrativeText(s: string): boolean {
  const t = s.trim();
  if (t.length < 2) return false;
  if (/^[0-9.,\-\s%/]+$/.test(t)) return false;       // nombres, pourcentages
  if (/^\d{4}-\d{2}/.test(t)) return false;            // dates ISO
  if (!/[a-zàâäéèêëîïôöùûüç]/i.test(t)) return false;  // au moins une lettre
  const low = norm(t);
  if (["oui", "non", "na", "nonapplicable", "non applicable", "sans objet", "yes", "no", "true", "false", "null", "nan"].includes(low)) return false;
  return true;
}

const dedup = (xs: string[]): string[] => [...new Set(xs.map((x) => x.trim()).filter(Boolean))];

/** Lit un champ texte unique s'il contient du verbatim exploitable. */
function txt(m: Record<string, unknown>, name: string): string[] {
  const t = str(pick(m, name));
  return isNarrativeText(t) ? [t] : [];
}
/** Traduit un select_multiple « problemes » en libellés (hors « autre »/« na »). */
function problemeLabels(m: Record<string, unknown>, name: string): string[] {
  const out: string[] = [];
  for (const code of selectMulti(pick(m, name))) {
    const lab = PROBLEMES_LABELS[code.toLowerCase()];
    if (lab) out.push(lab);
  }
  return out;
}

/** Extrait les verbatims du formulaire AT, ventilés par champ d'origine. */
function extractNarratives(m: Record<string, unknown>): AtNarratives {
  return {
    constatsAs: dedup(txt(m, "supervision_as_constats")),
    constatsZs: dedup(txt(m, "supervision_zs_constats")),
    constatsAntenne: dedup(txt(m, "supervision_antenne_constats")),
    recoSupZs: dedup(txt(m, "supervision_zs_recommandations")),
    recoSupAntenne: dedup(txt(m, "supervision_antenne_recommandations")),
    recoCcpev: dedup(txt(m, "recommandations_ccpev")),
    recoCoordination: dedup(txt(m, "recommandations_coordination")),
    problemesDonnees: dedup(problemeLabels(m, "problemes_donnees")),
    problemesMonitorageZs: dedup(problemeLabels(m, "problemes_monitorage_zs")),
    problemesDonneesAutre: dedup(txt(m, "problemes_donnees_autre")),
    problemesMonitorageZsAutre: dedup(txt(m, "problemes_monitorage_zs_autre")),
    actionsDonnees: dedup(txt(m, "actions_correctrices_donnees")),
    actionsMonitorageZs: dedup(txt(m, "actions_correctrices_monitorage_zs")),
    observationsMonitorage: dedup(txt(m, "observations_monitorage")),
    observationsRougeole: dedup(txt(m, "observations_rougeole")),
    observationsTnnMapi: dedup(txt(m, "observations_tnn_mapi")),
    commentaireRapportTrim: dedup(txt(m, "commentaire_rapport_trim")),
    commentaireRapportsOms: dedup(txt(m, "commentaire_rapports_oms")),
  };
}

const MONTHS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const MONTHS_SHORT = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

/** Index de mois (0..11) depuis une valeur de liste « mois » (nom FR ou numéro). */
function monthIndexFrom(v: unknown): number | null {
  const s = norm(str(v));
  if (!s) return null;
  const asNum = Number(s.replace(/[^0-9]/g, ""));
  if (Number.isFinite(asNum) && asNum >= 1 && asNum <= 12) return asNum - 1;
  for (let i = 0; i < MONTHS_FR.length; i++) {
    if (s.startsWith(norm(MONTHS_FR[i])) || norm(MONTHS_FR[i]).startsWith(s)) return i;
  }
  return null;
}
function isoMonthFrom(v: unknown): string | null {
  const m = str(v).match(/(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : null;
}

/* ============================ computeAtScore (grille officielle) ============================ */

/** Critère : poids + ratio atteint (null = critère non applicable → exclu). */
interface Crit { weight: number; ratio: number | null }

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** Ratio borné [0,1] si dénominateur > 0, sinon non applicable (null). */
function r(numr: number, den: number): number | null {
  return den > 0 ? clamp01(numr / den) : null;
}

/** Assemble une composante depuis ses critères. NA si aucune pondération applicable. */
function buildComponent(key: AtComponentKey, max: number, crits: Crit[], gated: boolean): AtComponentScore {
  if (!gated) return { key, points: null, max, applicable: false, pct: null };
  let pts = 0, applWeight = 0;
  for (const c of crits) {
    if (c.ratio == null) continue;
    pts += c.ratio * c.weight;
    applWeight += c.weight;
  }
  if (applWeight <= 0) return { key, points: null, max, applicable: false, pct: null };
  // Points ramenés à la pondération nominale de la composante (les critères NA
  // d'une composante applicable ne pénalisent pas : on évalue au prorata).
  const points = (pts / applWeight) * max;
  return { key, points: Math.round(points * 10) / 10, max, applicable: true, pct: Math.round((points / max) * 1000) / 10 };
}

/**
 * Calcule le score d'un AT pour un mois selon la grille officielle
 * (8 composantes /100, points au prorata du % atteint, NA exclus du
 * dénominateur, score ajusté = obtenu ÷ applicable × 100).
 */
export function computeAtScore(m: Record<string, unknown>): AtScore {
  /* A. Réunions /15 */
  const ccpevPrev = Math.max(n0(pick(m, "nb_ccpev_prevues")), n0(pick(m, "nb_ccpev_tenues")) > 0 ? 1 : 0);
  const reunions = buildComponent("reunions", 15, [
    { weight: 4,   ratio: r(n0(pick(m, "nb_ccpev_appuyees")), Math.max(ccpevPrev, 1)) },
    { weight: 3.5, ratio: r(n0(pick(m, "nb_reunions_coord_appuyees")), n0(pick(m, "nb_reunions_coord_prevues"))) },
    { weight: 3.5, ratio: r(n0(pick(m, "nb_reunions_validation_appuyees")), n0(pick(m, "nb_reunions_validation_prevues"))) },
    { weight: 4,   ratio: r(n0(pick(m, "nb_reunions_monitorage_zs_appuyees")), n0(pick(m, "nb_reunions_monitorage_zs_prevues"))) },
  ], true);

  /* B. Supervisions /20 */
  const antPrev = n0(pick(m, "nb_antennes_supervision_attendues"));
  const zsPrev = n0(pick(m, "nb_zs_supervision_attendues"));
  const asPrev = n0(pick(m, "nb_as_supervision_attendues"));
  const formsSoumis = n0(pick(m, "nb_form_supervision_as_soumis")) + n0(pick(m, "nb_form_supervision_zs_soumis")) + n0(pick(m, "nb_form_supervision_antenne_soumis"));
  const supSup = n0(pick(m, "nb_antennes_supervisees")) + n0(pick(m, "nb_zs_supervisees")) + n0(pick(m, "nb_as_supervisees"));
  const supervisions = buildComponent("supervisions", 20, [
    { weight: 4, ratio: r(n0(pick(m, "nb_antennes_supervisees")), antPrev) },
    { weight: 5, ratio: r(n0(pick(m, "nb_zs_supervisees")), zsPrev) },
    { weight: 5, ratio: r(n0(pick(m, "nb_as_supervisees")), asPrev) },
    // Qualité (conformes ÷ soumis) approchée par la complétude des formulaires soumis.
    { weight: 6, ratio: r(formsSoumis, supSup) },
  ], antPrev + zsPrev + asPrev + supSup > 0);

  /* C. Monitorage /10 */
  const monitApplicable = yna(pick(m, "monitorage_convenance_applicable")) !== "na" &&
    (n0(pick(m, "cible_monitorage_convenance")) > 0 || n0(pick(m, "nb_as_monitorage_convenance")) > 0);
  const monitorage = buildComponent("monitorage", 10, [
    { weight: 10, ratio: r(n0(pick(m, "nb_as_monitorage_convenance")), n0(pick(m, "cible_monitorage_convenance"))) },
  ], monitApplicable);

  /* D. Rougeole /15 */
  const rougNotif = n0(pick(m, "nb_cas_rougeole_notifies"));
  const rougApplicable = rougNotif > 0 || n0(pick(m, "nb_zs_rougeole_epidemie")) > 0;
  const listeFlag = ynp(pick(m, "preuve_liste_rougeole"));
  const listeRatio = (() => {
    const aj = n0(pick(m, "nb_zs_liste_rougeole_ajour")), dispo = n0(pick(m, "nb_zs_liste_rougeole_dispo"));
    if (dispo > 0) return clamp01(aj / dispo);
    if (listeFlag === "oui") return 1; if (listeFlag === "partiel") return 0.5; if (listeFlag === "non") return 0;
    return null;
  })();
  const ripFlag = yna(pick(m, "riposte_rougeole"));
  const rougeole = buildComponent("rougeole", 15, [
    { weight: 7, ratio: r(n0(pick(m, "nb_cas_rougeole_investigues")), rougNotif) },
    { weight: 5, ratio: ripFlag === "na" || ripFlag == null ? (rougNotif > 0 ? 0 : null) : ripFlag === "oui" ? 1 : 0 },
    { weight: 3, ratio: listeRatio },
  ], rougApplicable);

  /* E. TNN & MAPI /10 */
  const tnnNotif = n0(pick(m, "nb_cas_tnn_notifies"));
  const mapiNotif = n0(pick(m, "nb_mapi_graves_notifiees"));
  const tnnApplicable = tnnNotif > 0 || mapiNotif > 0;
  const tnn_mapi = buildComponent("tnn_mapi", 10, [
    { weight: 4, ratio: r(n0(pick(m, "nb_fiches_tnn_remontees")), tnnNotif) },
    { weight: 3, ratio: r(n0(pick(m, "nb_fiches_tnn_riposte")), tnnNotif) },
    { weight: 3, ratio: r(n0(pick(m, "nb_fiches_mapi_graves_remontees")), mapiNotif) },
  ], tnnApplicable);

  /* F. OSP /10 */
  const ospDispo = yna(pick(m, "osp_disponible"));
  const ospApplicable = ospDispo !== "na" && ospDispo != null;
  const ospTransmis = yna(pick(m, "osp_transmis"));
  const osp = buildComponent("osp", 10, [
    { weight: 10, ratio: ospTransmis === "oui" ? 1 : ospTransmis === "non" ? 0 : ospDispo === "oui" ? 0 : null },
  ], ospApplicable);

  /* G. Rapport trimestriel PEV /10 */
  const trimAttendu = yna(pick(m, "rapport_trimestriel_attendu"));
  const trimApplicable = yna(pick(m, "rapport_trimestriel_applicable")) !== "na" && trimAttendu === "oui";
  const trimTransmis = yna(pick(m, "rapport_trimestriel_transmis"));
  const rapport_pev = buildComponent("rapport_pev", 10, [
    { weight: 10, ratio: trimTransmis === "oui" ? 1 : trimTransmis === "non" ? 0 : null },
  ], trimApplicable);

  /* H. Rapport OMS & justification /10 */
  const omsPrev = Math.max(n0(pick(m, "activites_oms_prevues")), n0(pick(m, "autres_activites_oms_prevues")));
  const omsApplicable = yna(pick(m, "rapports_oms_applicable")) !== "na" && omsPrev > 0;
  const omsRatio = r(n0(pick(m, "rapports_oms_remontes")) || n0(pick(m, "activites_oms_realisees")), omsPrev);
  const rapport_oms = buildComponent("rapport_oms", 10, [
    { weight: 6, ratio: omsRatio },
    { weight: 4, ratio: omsRatio }, // justificatifs transmis (approché par la remontée)
  ], omsApplicable);

  const components = [reunions, supervisions, monitorage, rougeole, tnn_mapi, osp, rapport_pev, rapport_oms];
  let obtenu = 0, applicable = 0;
  for (const c of components) { if (c.applicable && c.points != null) { obtenu += c.points; applicable += c.max; } }
  const ajuste = applicable > 0 ? Math.round((obtenu / applicable) * 1000) / 10 : null;
  return {
    components,
    obtenu: Math.round(obtenu * 10) / 10,
    applicable,
    ajuste,
    niveau: niveauFor(ajuste)?.key ?? null,
  };
}

/* ============================ Normalisation ============================ */

function normalizeRows(rows: RawRow[]): AtRecord[] {
  return rows.map((row, i) => {
    const m = scalarMap(row as Record<string, unknown>);
    const province = canonAntenneNullable(str(pick(m, "province_dps")) || null);
    const antenne = canonAntenne(str(pick(m, "antenne_pev")) || null);
    const monthIndex = monthIndexFrom(pick(m, "mois_rapport"));
    const year = n0(pick(m, "annee_rapport")) || (str(pick(m, "date_rapport")).match(/(\d{4})/)?.[1] ? Number(RegExp.$1) : new Date().getFullYear());
    const month =
      monthIndex != null ? `${year}-${String(monthIndex + 1).padStart(2, "0")}` :
      isoMonthFrom(pick(m, "date_rapport")) ?? isoMonthFrom(pick(m, "_submission_time"));
    const mi = monthIndex ?? (month ? Number(month.slice(5, 7)) - 1 : null);
    return {
      id: str(pick(m, "_uuid")) || str(pick(m, "_id")) || `at_${i}`,
      nomAt: str(pick(m, "nom_at")) || "AT non précisé",
      province,
      antenne,
      zonesAppuyees: selectMulti(pick(m, "zones_sante_appuyees")),
      month: month ?? null,
      monthLabel: mi != null ? MONTHS_SHORT[mi] : null,
      monthIndex: mi,
      score: computeAtScore(m),
      raw: numericRaw(m),
      narratives: extractNarratives(m),
    };
  });
}
function canonAntenneNullable(s: string | null) { return s ? s : null; }

/** Conserve les scalaires utiles (number|string) pour les agrégations du rapport. */
function numericRaw(m: Record<string, unknown>): Record<string, number | string | null> {
  const keys = [
    "nb_ccpev_prevues", "nb_ccpev_tenues", "nb_ccpev_appuyees",
    "nb_reunions_coord_prevues", "nb_reunions_coord_appuyees",
    "nb_reunions_validation_prevues", "nb_reunions_validation_tenues", "nb_reunions_validation_appuyees",
    "nb_reunions_monitorage_zs_prevues", "nb_reunions_monitorage_zs_tenues", "nb_reunions_monitorage_zs_appuyees",
    "nb_antennes_supervision_attendues", "nb_antennes_supervisees", "nb_form_supervision_antenne_soumis",
    "nb_zs_supervision_attendues", "nb_zs_supervisees", "nb_form_supervision_zs_soumis",
    "nb_as_supervision_attendues", "nb_as_supervisees", "nb_form_supervision_as_soumis",
    "cible_monitorage_convenance", "nb_as_monitorage_convenance", "nb_form_monitorage_soumis",
    "nb_zs_rougeole_epidemie", "nb_cas_rougeole_notifies", "nb_cas_rougeole_investigues", "nb_prelevements_rougeole", "nb_resultats_labo_rougeole_recus",
    "nb_cas_tnn_notifies", "nb_fiches_tnn_remontees", "nb_fiches_tnn_riposte", "nb_mapi_graves_notifiees", "nb_fiches_mapi_graves_remontees",
    "activites_oms_prevues", "autres_activites_oms_prevues", "activites_oms_realisees", "rapports_oms_remontes",
  ];
  const out: Record<string, number | string | null> = {};
  for (const k of keys) out[k] = num(pick(m, k));
  out["riposte_rougeole"] = str(pick(m, "riposte_rougeole"));
  out["osp_disponible"] = str(pick(m, "osp_disponible"));
  out["osp_rempli_regulierement"] = str(pick(m, "osp_rempli_regulierement"));
  out["osp_transmis"] = str(pick(m, "osp_transmis"));
  out["preuve_osp"] = str(pick(m, "preuve_osp"));
  out["activite_speciale_prevue"] = str(pick(m, "activite_speciale_prevue"));
  out["type_activite_speciale"] = str(pick(m, "type_activite_speciale"));
  out["type_activite_speciale_autre"] = str(pick(m, "type_activite_speciale_autre"));
  out["rapport_trimestriel_attendu"] = str(pick(m, "rapport_trimestriel_attendu"));
  out["rapport_trimestriel_transmis"] = str(pick(m, "rapport_trimestriel_transmis"));
  out["preuve_liste_rougeole"] = str(pick(m, "preuve_liste_rougeole"));
  out["nb_zs_liste_rougeole_dispo"] = num(pick(m, "nb_zs_liste_rougeole_dispo"));
  out["nb_zs_liste_rougeole_ajour"] = num(pick(m, "nb_zs_liste_rougeole_ajour"));
  return out;
}

/* ============================ Filtres communs ============================ */

export interface AtFilters { province: string | null; antenne: string | null; months: string[]; at: string | null }

const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort();
const eq = (a: string | null, b: string | null) => norm(a ?? "") === norm(b ?? "");

function buildFilterOptions(all: AtRecord[]): AtFilterOptions {
  const monthPairs = [...new Map(all.filter((r) => r.month).map((r) => [r.month!, r.monthLabel ?? r.month!])).entries()].sort();
  return {
    provinces: uniq(all.map((r) => r.province)),
    antennes: uniq(all.map((r) => r.antenne)),
    months: monthPairs.map((p) => p[0]),
    monthLabels: monthPairs.map((p) => p[1]),
    ats: uniq(all.map((r) => r.nomAt)),
    geo: all.map((r) => ({ province: r.province, antenne: canonAntenne(r.antenne), zone: null, aire: null })),
  };
}

function applyFilters(all: AtRecord[], f: AtFilters): AtRecord[] {
  return all.filter((r) =>
    (!f.province || eq(r.province, f.province)) &&
    (!f.antenne || eq(canonAntenne(r.antenne), canonAntenne(f.antenne))) &&
    (!f.at || eq(r.nomAt, f.at)) &&
    (f.months.length === 0 || (r.month != null && f.months.includes(r.month)))
  );
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const pct = (n: number, d: number): number | null => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);
const rawN = (r: AtRecord, k: string): number => (typeof r.raw[k] === "number" ? (r.raw[k] as number) : 0);
const rawS = (r: AtRecord, k: string): string => String(r.raw[k] ?? "");

function monthCols(recs: AtRecord[]): { key: string; label: string }[] {
  return [...new Map(recs.filter((r) => r.month).map((r) => [r.month!, r.monthLabel ?? r.month!])).entries()]
    .sort().map(([key, label]) => ({ key, label }));
}

/** Aplati les verbatims d'une catégorie en items contextualisés (AT · antenne · mois). */
function collectNarratives(recs: AtRecord[], pickList: (n: AtNarratives) => string[]): NarrativeItem[] {
  const out: NarrativeItem[] = [];
  const seen = new Set<string>();
  for (const r of recs) {
    for (const text of pickList(r.narratives)) {
      const dedupKey = `${r.nomAt}|${r.month ?? ""}|${text}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      out.push({ at: r.nomAt, antenne: r.antenne, month: r.month, monthLabel: r.monthLabel, text });
    }
  }
  return out;
}

/* ============================ Bundle Rapport mensuel ============================ */

export function buildRapportBundle(fetched: { label: string; rows: RawRow[]; ok: boolean; error?: string }, f: AtFilters): RapportBundle {
  const all = normalizeRows(fetched.rows);
  const filters = buildFilterOptions(all);
  const recs = applyFilters(all, f);
  const months = monthCols(recs);
  const ats = uniq(recs.map((r) => r.nomAt));
  const antennes = uniq(recs.map((r) => r.antenne));

  /* 1. Vue d'ensemble */
  const zonesSet = new Set<string>(); recs.forEach((r) => r.zonesAppuyees.forEach((z) => zonesSet.add(norm(z))));
  const rapportsAttendus = ats.length * Math.max(months.length, 1);
  const scoreParAtMois = ats.map((at) => {
    const byMonth: Record<string, number | null> = {};
    const vals: number[] = [];
    for (const mc of months) {
      const rec = recs.find((r) => r.nomAt === at && r.month === mc.key);
      const v = rec?.score.ajuste ?? null;
      byMonth[mc.key] = v;
      if (v != null) vals.push(v);
    }
    const antenne = recs.find((r) => r.nomAt === at)?.antenne ?? null;
    return { at, antenne, byMonth, moyenne: vals.length ? Math.round((sum(vals) / vals.length) * 10) / 10 : null };
  });

  /* 2. Réunions */
  const reuKpi = {
    ccpevTenues: sum(recs.map((r) => rawN(r, "nb_ccpev_tenues"))), ccpevPrevues: sum(recs.map((r) => rawN(r, "nb_ccpev_prevues"))),
    survAppuyees: sum(recs.map((r) => rawN(r, "nb_reunions_coord_appuyees"))), survPrevues: sum(recs.map((r) => rawN(r, "nb_reunions_coord_prevues"))),
    validAppuyees: sum(recs.map((r) => rawN(r, "nb_reunions_validation_appuyees"))), validPrevues: sum(recs.map((r) => rawN(r, "nb_reunions_validation_prevues"))),
    revuesAppuyees: sum(recs.map((r) => rawN(r, "nb_reunions_monitorage_zs_appuyees"))), revuesPrevues: sum(recs.map((r) => rawN(r, "nb_reunions_monitorage_zs_prevues"))),
  };
  const reunionTypes = [
    { type: "CCPeV", prevues: reuKpi.ccpevPrevues, appuyees: sum(recs.map((r) => rawN(r, "nb_ccpev_appuyees"))) },
    { type: "Surveillance", prevues: reuKpi.survPrevues, appuyees: reuKpi.survAppuyees },
    { type: "Validation données", prevues: reuKpi.validPrevues, appuyees: reuKpi.validAppuyees },
    { type: "Revues mensuelles ZS", prevues: reuKpi.revuesPrevues, appuyees: reuKpi.revuesAppuyees },
  ];
  const reunionsTableParAt = ats.map((at) => tableByMonth(recs, at, months, (r) =>
    rawN(r, "nb_ccpev_appuyees") + rawN(r, "nb_reunions_coord_appuyees") + rawN(r, "nb_reunions_validation_appuyees") + rawN(r, "nb_reunions_monitorage_zs_appuyees")));

  /* 3. Supervisions */
  const supKpi = {
    antSup: sum(recs.map((r) => rawN(r, "nb_antennes_supervisees"))), antPrev: sum(recs.map((r) => rawN(r, "nb_antennes_supervision_attendues"))),
    zsSup: sum(recs.map((r) => rawN(r, "nb_zs_supervisees"))), zsPrev: sum(recs.map((r) => rawN(r, "nb_zs_supervision_attendues"))),
    asSup: sum(recs.map((r) => rawN(r, "nb_as_supervisees"))), asPrev: sum(recs.map((r) => rawN(r, "nb_as_supervision_attendues"))),
    formsSoumis: sum(recs.map((r) => rawN(r, "nb_form_supervision_antenne_soumis") + rawN(r, "nb_form_supervision_zs_soumis") + rawN(r, "nb_form_supervision_as_soumis"))),
  };
  const supTableParAt = ats.map((at) => tableByMonth(recs, at, months, (r) =>
    rawN(r, "nb_antennes_supervisees") + rawN(r, "nb_zs_supervisees") + rawN(r, "nb_as_supervisees")));

  /* 4. Monitorage */
  const monRealises = sum(recs.map((r) => rawN(r, "nb_as_monitorage_convenance")));
  const monPrevus = sum(recs.map((r) => rawN(r, "cible_monitorage_convenance")));
  const monTableParAt = ats.map((at) => tableByMonth(recs, at, months, (r) => rawN(r, "nb_as_monitorage_convenance")));

  /* 5. Surveillance */
  const rougeoleParAntenne = antennes.map((ant) => {
    const rr = recs.filter((r) => r.antenne === ant);
    const notifies = sum(rr.map((r) => rawN(r, "nb_cas_rougeole_notifies")));
    const investigues = sum(rr.map((r) => rawN(r, "nb_cas_rougeole_investigues")));
    return { antenne: ant, notifies, investigues, pct: pct(investigues, notifies) };
  });

  /* 6. OSP */
  const countYes = (k: string) => recs.filter((r) => yna(rawS(r, k)) === "oui").length;
  const ospParAntenne = antennes.map((ant) => {
    const rr = recs.filter((r) => r.antenne === ant);
    const tot = rr.length || 1;
    return {
      antenne: ant,
      disponible: pct(rr.filter((r) => yna(rawS(r, "osp_disponible")) === "oui").length, tot),
      rempli: pct(rr.filter((r) => yna(rawS(r, "osp_rempli_regulierement")) === "oui").length, tot),
      transmis: pct(rr.filter((r) => yna(rawS(r, "osp_transmis")) === "oui").length, tot),
    };
  });
  const typesActivites = uniq(recs.flatMap((r) => {
    const t = selectMulti(rawS(r, "type_activite_speciale")).map(prettyToken);
    const autre = rawS(r, "type_activite_speciale_autre"); return autre ? [...t, autre] : t;
  }));
  const rapportsTrimParAntenne = antennes.map((ant) => {
    const rr = recs.filter((r) => r.antenne === ant);
    const attendus = rr.filter((r) => yna(rawS(r, "rapport_trimestriel_attendu")) === "oui").length;
    const transmis = rr.filter((r) => yna(rawS(r, "rapport_trimestriel_transmis")) === "oui").length;
    return { antenne: ant, transmis, attendus, statut: attendus > 0 ? transmis >= attendus : transmis > 0 };
  });
  const omsJustifieesParAntenne = antennes.map((ant) => {
    const rr = recs.filter((r) => r.antenne === ant);
    const fin = sum(rr.map((r) => Math.max(rawN(r, "activites_oms_prevues"), rawN(r, "autres_activites_oms_prevues"))));
    const just = sum(rr.map((r) => rawN(r, "rapports_oms_remontes") || rawN(r, "activites_oms_realisees")));
    return { antenne: ant, pct: pct(just, fin) };
  });
  const ospTransmis = countYes("osp_transmis");
  const omsFin = sum(recs.map((r) => Math.max(rawN(r, "activites_oms_prevues"), rawN(r, "autres_activites_oms_prevues"))));
  const omsJust = sum(recs.map((r) => rawN(r, "rapports_oms_remontes") || rawN(r, "activites_oms_realisees")));

  /* ---- Réunions : par AT × type + verbatims + top problèmes ---- */
  const reunionsParAtType = ats.map((at) => {
    const rr = recs.filter((r) => r.nomAt === at);
    const ccpev = sum(rr.map((r) => rawN(r, "nb_ccpev_appuyees")));
    const coordination = sum(rr.map((r) => rawN(r, "nb_reunions_coord_appuyees")));
    const validation = sum(rr.map((r) => rawN(r, "nb_reunions_validation_appuyees")));
    const monitorageZs = sum(rr.map((r) => rawN(r, "nb_reunions_monitorage_zs_appuyees")));
    return { at, ccpev, coordination, validation, monitorageZs, total: ccpev + coordination + validation + monitorageZs };
  });
  const topFreq = (lists: ((n: AtNarratives) => string[])[]): { label: string; count: number }[] => {
    const m = new Map<string, number>();
    for (const r of recs) for (const pickList of lists) for (const v of pickList(r.narratives)) {
      const t = v.trim(); if (t.length < 2) continue; m.set(t, (m.get(t) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, count]) => ({ label, count }));
  };
  const reunionsRecommandations = collectNarratives(recs, (n) => [...n.recoCcpev, ...n.recoCoordination]);
  const reunionsActions = collectNarratives(recs, (n) => [...n.actionsDonnees, ...n.actionsMonitorageZs]);
  const topProblemesQualite = topFreq([(n) => n.problemesDonnees, (n) => n.problemesDonneesAutre]);
  const topProblemesRevues = topFreq([(n) => n.problemesMonitorageZs, (n) => n.problemesMonitorageZsAutre]);

  /* ---- Supervisions : par AT × niveau + évolution mensuelle + constats ---- */
  const supParAtNiveau = ats.map((at) => {
    const rr = recs.filter((r) => r.nomAt === at);
    return {
      at,
      antAtt: sum(rr.map((r) => rawN(r, "nb_antennes_supervision_attendues"))), antReal: sum(rr.map((r) => rawN(r, "nb_antennes_supervisees"))),
      zsAtt: sum(rr.map((r) => rawN(r, "nb_zs_supervision_attendues"))), zsReal: sum(rr.map((r) => rawN(r, "nb_zs_supervisees"))),
      asAtt: sum(rr.map((r) => rawN(r, "nb_as_supervision_attendues"))), asReal: sum(rr.map((r) => rawN(r, "nb_as_supervisees"))),
    };
  });
  const supEvolutionParMois = months.map((mc) => {
    const rr = recs.filter((r) => r.month === mc.key);
    const antenne = sum(rr.map((r) => rawN(r, "nb_antennes_supervisees")));
    const zs = sum(rr.map((r) => rawN(r, "nb_zs_supervisees")));
    const as = sum(rr.map((r) => rawN(r, "nb_as_supervisees")));
    return { month: mc.key, label: mc.label, antenne, zs, as, total: antenne + zs + as };
  });
  const supConstatsParNiveau = [
    { niveau: "Antenne", items: collectNarratives(recs, (n) => n.constatsAntenne) },
    { niveau: "Zone de santé", items: collectNarratives(recs, (n) => n.constatsZs) },
    { niveau: "Aire de santé", items: collectNarratives(recs, (n) => n.constatsAs) },
  ];
  const supConstats = collectNarratives(recs, (n) => [...n.constatsAntenne, ...n.constatsZs, ...n.constatsAs]);
  const supRecommandations = collectNarratives(recs, (n) => [...n.recoSupAntenne, ...n.recoSupZs]);

  /* ---- Surveillance : séries mensuelles par maladie + ripostes + listes ---- */
  const survParMois = months.map((mc) => {
    const rr = recs.filter((r) => r.month === mc.key);
    const rougeoleN = sum(rr.map((r) => rawN(r, "nb_cas_rougeole_notifies")));
    const rougeoleI = sum(rr.map((r) => rawN(r, "nb_cas_rougeole_investigues")));
    const tnnN = sum(rr.map((r) => rawN(r, "nb_cas_tnn_notifies")));
    const tnnI = sum(rr.map((r) => rawN(r, "nb_fiches_tnn_remontees")));
    const mapiN = sum(rr.map((r) => rawN(r, "nb_mapi_graves_notifiees")));
    const mapiI = sum(rr.map((r) => rawN(r, "nb_fiches_mapi_graves_remontees")));
    return {
      month: mc.key, label: mc.label,
      rougeoleN, rougeoleI, rougeolePct: pct(rougeoleI, rougeoleN),
      tnnN, tnnI, tnnPct: pct(tnnI, tnnN),
      mapiN, mapiI, mapiPct: pct(mapiI, mapiN),
      zsEpidemie: sum(rr.map((r) => rawN(r, "nb_zs_rougeole_epidemie"))),
    };
  });
  const survTnnNotifies = sum(recs.map((r) => rawN(r, "nb_cas_tnn_notifies")));
  const survTnnInvestigues = sum(recs.map((r) => rawN(r, "nb_fiches_tnn_remontees")));
  const survMapiNotifiees = sum(recs.map((r) => rawN(r, "nb_mapi_graves_notifiees")));
  const survMapiInvestiguees = sum(recs.map((r) => rawN(r, "nb_fiches_mapi_graves_remontees")));
  const survRougeoleNotifies = sum(recs.map((r) => rawN(r, "nb_cas_rougeole_notifies")));
  const survRougeoleInvestigues = sum(recs.map((r) => rawN(r, "nb_cas_rougeole_investigues")));
  const survRipostesRougeole = recs.filter((r) => yna(rawS(r, "riposte_rougeole")) === "oui").length;
  const survRipostesTnn = sum(recs.map((r) => rawN(r, "nb_fiches_tnn_riposte")));
  const listeDispo = sum(recs.map((r) => rawN(r, "nb_zs_liste_rougeole_dispo")));
  const listeAjour = sum(recs.map((r) => rawN(r, "nb_zs_liste_rougeole_ajour")));
  const listesParAntenne = antennes.map((ant) => {
    const rr = recs.filter((r) => r.antenne === ant);
    return { antenne: ant, pct: pct(sum(rr.map((r) => rawN(r, "nb_zs_liste_rougeole_ajour"))), sum(rr.map((r) => rawN(r, "nb_zs_liste_rougeole_dispo")))) };
  });

  return {
    meta: { generatedAt: new Date().toISOString(), source: { label: fetched.label, rows: fetched.rows.length, ok: fetched.ok, error: fetched.error }, hasData: all.length > 0 },
    filters,
    vue: {
      kpi: {
        antennes: antennes.length, zones: zonesSet.size,
        rapportsSoumis: recs.length, rapportsAttendus, rapportsPct: pct(recs.length, rapportsAttendus),
        atsRapporte: ats.length, atsTotal: filters.ats.length,
      },
      rapportsParAt: ats.map((at) => ({ at, count: recs.filter((r) => r.nomAt === at).length })),
      rapportsParMois: months.map((mc) => ({ month: mc.key, label: mc.label, count: recs.filter((r) => r.month === mc.key).length })),
      scoreParAtMois, months,
    },
    reunions: {
      kpi: reuKpi, prevuesVsAppuyees: reunionTypes, tauxParType: reunionTypes.map((t) => ({ type: t.type, taux: pct(t.appuyees, t.prevues) })),
      tableParAtMois: reunionsTableParAt,
      parAtType: reunionsParAtType,
      recommandations: reunionsRecommandations,
      actionsCorrectrices: reunionsActions,
      topProblemesQualite, topProblemesRevues,
      months,
    },
    supervisions: {
      kpi: supKpi,
      attenduVsRealise: [
        { niveau: "Antenne", attendues: supKpi.antPrev, realisees: supKpi.antSup },
        { niveau: "Zone de santé", attendues: supKpi.zsPrev, realisees: supKpi.zsSup },
        { niveau: "Aire de santé", attendues: supKpi.asPrev, realisees: supKpi.asSup },
      ],
      tauxParNiveau: [
        { niveau: "Antenne", taux: pct(supKpi.antSup, supKpi.antPrev) },
        { niveau: "ZS", taux: pct(supKpi.zsSup, supKpi.zsPrev) },
        { niveau: "AS", taux: pct(supKpi.asSup, supKpi.asPrev) },
      ],
      tableParAtMois: supTableParAt,
      parAtNiveau: supParAtNiveau,
      evolutionParMois: supEvolutionParMois,
      constatsParNiveau: supConstatsParNiveau,
      constats: supConstats,
      recommandations: supRecommandations,
      months,
    },
    monitorage: {
      kpi: { realises: monRealises, prevus: monPrevus, pct: pct(monRealises, monPrevus), asCouvertes: monRealises, formsSoumis: sum(recs.map((r) => rawN(r, "nb_form_monitorage_soumis"))) },
      parAtMois: monTableParAt, couverture: { couvertes: monRealises, nonCouvertes: Math.max(0, monPrevus - monRealises) },
      constats: collectNarratives(recs, (n) => n.observationsMonitorage),
      months,
    },
    surveillance: {
      kpi: {
        rougeoleNotifies: survRougeoleNotifies, rougeoleInvestigues: survRougeoleInvestigues, rougeolePct: pct(survRougeoleInvestigues, survRougeoleNotifies),
        tnnNotifies: survTnnNotifies, tnnInvestigues: survTnnInvestigues, tnnPct: pct(survTnnInvestigues, survTnnNotifies),
        mapiNotifiees: survMapiNotifiees, mapiInvestiguees: survMapiInvestiguees, mapiPct: pct(survMapiInvestiguees, survMapiNotifiees),
        ripostesRougeole: survRipostesRougeole, ripostesTnn: survRipostesTnn,
      },
      rougeoleParAntenne,
      tnnMapi: {
        tnnNotifies: survTnnNotifies, tnnInvestigues: survTnnInvestigues, ripostesTnn: survRipostesTnn,
        mapiNotifiees: survMapiNotifiees, mapiInvestiguees: survMapiInvestiguees,
      },
      parMois: survParMois,
      ripostesParMaladie: [
        { maladie: "Rougeole", notifies: survRougeoleNotifies, ripostes: survRipostesRougeole },
        { maladie: "TNN", notifies: survTnnNotifies, ripostes: survRipostesTnn },
      ],
      listesLineaires: { dispo: listeDispo, ajour: listeAjour, pct: pct(listeAjour, listeDispo), parAntenne: listesParAntenne },
      commentairesRougeole: collectNarratives(recs, (n) => n.observationsRougeole),
      commentairesTnnMapi: collectNarratives(recs, (n) => n.observationsTnnMapi),
    },
    osp: {
      kpi: {
        ospPartagesPct: pct(ospTransmis, recs.length), activitesSpeciales: typesActivites.length,
        rapportsTrimTransmis: sum(rapportsTrimParAntenne.map((r) => r.transmis)), rapportsTrimAttendus: sum(rapportsTrimParAntenne.map((r) => r.attendus)),
        omsJustifieesPct: pct(omsJust, omsFin),
      },
      ospParAntenne, typesActivites, rapportsTrimParAntenne, omsJustifieesParAntenne,
      commentairesRapportPev: collectNarratives(recs, (n) => n.commentaireRapportTrim),
      commentairesRapportsOms: collectNarratives(recs, (n) => n.commentaireRapportsOms),
    },
  };
}

function tableByMonth(recs: AtRecord[], at: string, months: { key: string; label: string }[], val: (r: AtRecord) => number) {
  const byMonth: Record<string, number | null> = {};
  let total = 0;
  for (const mc of months) {
    const rec = recs.find((r) => r.nomAt === at && r.month === mc.key);
    const v = rec ? val(rec) : null;
    byMonth[mc.key] = v;
    if (v != null) total += v;
  }
  return { at, byMonth, total };
}

const TOKEN_LABELS: Record<string, string> = {
  omv: "OMV — Mise à niveau de la vaccination", strategie_fluviale: "Stratégie fluviale", vaccination_pdi: "Vaccination PDI",
  supervision_conjointe: "Supervision conjointe PEV / OMS", surveillance_mpv: "Surveillance MPV renforcée",
};
function prettyToken(t: string): string {
  const k = norm(t).replace(/\s+/g, "_");
  return TOKEN_LABELS[k] ?? t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, " ");
}

/* ============================ Bundle Évaluation ============================ */

export function buildEvaluationBundle(fetched: { label: string; rows: RawRow[]; ok: boolean; error?: string }, f: AtFilters): EvaluationBundle {
  const all = normalizeRows(fetched.rows);
  const filters = buildFilterOptions(all);
  const recs = applyFilters(all, f);
  const months = monthCols(all); // évolution sur toute la période disponible
  const ats = uniq(recs.map((r) => r.nomAt));

  const rows = recs.filter((r) => r.month && r.score.ajuste != null).map((r) => ({
    at: r.nomAt, antenne: r.antenne, month: r.month!, monthLabel: r.monthLabel ?? r.month!,
    obtenu: r.score.obtenu, applicable: r.score.applicable, ajuste: r.score.ajuste, niveau: r.score.niveau,
    components: r.score.components.map((c) => ({ key: c.key, points: c.points, max: c.max })),
  })).sort((a, b) => (b.ajuste ?? 0) - (a.ajuste ?? 0));

  const parAt = ats.map((at) => {
    const rr = recs.filter((r) => r.nomAt === at);
    const ajustes = rr.map((r) => r.score.ajuste).filter((v): v is number => v != null);
    const ajusteMoyen = ajustes.length ? Math.round((sum(ajustes) / ajustes.length) * 10) / 10 : null;
    const components = AT_COMPONENTS.map((cd) => {
      const ptsList = rr.map((r) => r.score.components.find((c) => c.key === cd.key)).filter((c): c is AtComponentScore => !!c && c.applicable && c.points != null);
      const avg = ptsList.length ? sum(ptsList.map((c) => c.points!)) / ptsList.length : null;
      return { key: cd.key, points: avg == null ? null : Math.round(avg * 10) / 10, max: cd.max, pct: avg == null ? null : Math.round((avg / cd.max) * 1000) / 10 };
    });
    const byMonth: Record<string, number | null> = {};
    for (const mc of months) byMonth[mc.key] = rr.find((r) => r.month === mc.key)?.score.ajuste ?? null;
    return { at, antenne: rr[0]?.antenne ?? null, ajusteMoyen, niveau: niveauFor(ajusteMoyen)?.key ?? null, components, byMonth };
  });

  const moyennes = parAt.map((p) => p.ajusteMoyen).filter((v): v is number => v != null);
  const repartition = AT_NIVEAUX.map((nv) => ({ niveau: nv.key, count: parAt.filter((p) => p.niveau === nv.key).length }));
  const classement = [...parAt].sort((a, b) => (b.ajusteMoyen ?? -1) - (a.ajusteMoyen ?? -1)).map((p) => ({ at: p.at, ajuste: p.ajusteMoyen }));

  const evolution = {
    months,
    series: ats.map((at) => {
      const p = parAt.find((x) => x.at === at)!;
      return { at, values: months.map((mc) => p.byMonth[mc.key] ?? null) };
    }),
  };

  const scoreMoyenParComposante = AT_COMPONENTS.map((cd) => {
    const pcts = parAt.map((p) => p.components.find((c) => c.key === cd.key)?.pct).filter((v): v is number => v != null);
    return { key: cd.key, pctMoyen: pcts.length ? Math.round((sum(pcts) / pcts.length) * 10) / 10 : null };
  });

  return {
    meta: { generatedAt: new Date().toISOString(), source: { label: fetched.label, rows: fetched.rows.length, ok: fetched.ok, error: fetched.error }, hasData: all.length > 0 },
    filters, components: AT_COMPONENTS, niveaux: AT_NIVEAUX, rows, parAt,
    vue: {
      kpi: {
        scoreMoyen: moyennes.length ? Math.round((sum(moyennes) / moyennes.length) * 10) / 10 : null,
        meilleur: moyennes.length ? Math.max(...moyennes) : null,
        faible: moyennes.length ? Math.min(...moyennes) : null,
        atsEvalues: parAt.filter((p) => p.ajusteMoyen != null).length,
      },
      repartition, classement,
    },
    evolution, scoreMoyenParComposante,
  };
}

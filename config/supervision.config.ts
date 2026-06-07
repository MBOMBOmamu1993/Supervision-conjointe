/**
 * Configuration du dashboard de SUPERVISION CONJOINTE PEV-Central / OMS (Tshuapa, RDC).
 *
 * Les scores sont lus directement depuis les colonnes calculées des formulaires
 * KoboToolbox (barème : Oui = score complet, Partiellement = moitié, Non = 0,
 * Non applicable = exclu du score maximum).
 */

export type StructureLevel = "antenne" | "zs" | "as";
export type CotationLevel = "tres_bon" | "bon" | "moyen" | "faible";
export type AnswerValue = "oui" | "partiel" | "non" | "na";
export type SupervisionType =
  | "conjointe_pev_oms"
  | "conjointe_mca"
  | "auto_eval"
  | "mca_seul"
  | "ecz_seul"
  | "autre";

export interface KoboSource {
  key: StructureLevel;
  label: string;
  assetUid: string;
  exportUid: string;
}

export const KOBO_BASE_URL = "https://eu.kobotoolbox.org";

/** Valeur par défaut du « Type de supervision » pour les anciennes soumissions. */
export const DEFAULT_TYPE_SUPERVISION = "Supervision conjointe";

export const KOBO_SOURCES: KoboSource[] = [
  { key: "antenne", label: "Checklist supervision Antenne PEV", assetUid: "axvaHRq3XGozr8o3z4wr5u", exportUid: "esTwbAKe5dn2FTAcbbagXL8" },
  { key: "zs", label: "Checklist supervision PEV — Zone de santé", assetUid: "axsB6RwiENF3FC2eZzsH3m", exportUid: "esTZSfTTAYYvcLtRbJdr6Jh" },
  // Centre de santé : NOUVEL asset (formulaire avec « Type de supervision »).
  { key: "as", label: "Checklist supervision — Centre de santé", assetUid: "af5W55HqW8nPgqyC5jgALc", exportUid: "esiVtGnbm8cm2VKD2AR672n" },
];

/** Formulaires CQD (Contrôle Qualité des Données). */
export interface CqdSource {
  key: "zs" | "as";
  label: string;
  assetUid: string;
  exportUid: string;
}
export const CQD_SOURCES: CqdSource[] = [
  { key: "zs", label: "Contrôle qualité des données — Zone de santé", assetUid: "ajhW22rQEkVs39SuhBuwCC", exportUid: "es8g2L4gEfMbGCGADHyXVwR" },
  { key: "as", label: "Contrôle qualité des données — Aire de santé", assetUid: "aaQZRLWXQ6rpTWr3uR3SEU", exportUid: "esbbnddHn8i5jMH8k9QBQmd" },
];

/**
 * Formulaire « Monitorage rapide de convenance » (RCM).
 * Même projet / même token Kobo que les supervisions conjointes. Le formulaire
 * comporte des repeats imbriqués (`menage` → `enfant`) ; l'agrégation se fait au
 * niveau enfant. Le formulaire n'a pas encore de soumissions : les visuels
 * s'alimentent automatiquement dès les premières données.
 */
export interface RcmSource {
  key: "rcm";
  label: string;
  assetUid: string;
  exportUid: string;
}
export const RCM_SOURCE: RcmSource = {
  key: "rcm",
  label: "Monitorage rapide de convenance",
  assetUid: "acs8Na8fUTpyyoxhcKFwC5",
  exportUid: "esc4DesE6zhkp5tYZ5ZkMjR",
};
export const rcmExportUrl = (base = KOBO_BASE_URL) => koboExportUrl(RCM_SOURCE, base);
export const rcmDataUrl = (base = KOBO_BASE_URL) => koboDataUrl(RCM_SOURCE, base);

/* ----------------------- Sources SAV (Semaine Africaine de Vaccination) ----------------------- */
/**
 * Les 5 formulaires KoboToolbox de la SAV (activité terminée → exports XLSX
 * figés exhaustifs). Même projet / même token que le reste du dashboard.
 */
export interface SavSource { key: string; label: string; assetUid: string; exportUid: string; }

export const SAV_SOURCES: SavSource[] = [
  { key: "ident_cs",     label: "SAV — Identification EZD/ESV par Centre de santé", assetUid: "auKr7bzjsRNoohpveySTVA", exportUid: "esvjFiKSo7tfMQMcpxvrYga" },
  { key: "ident_relais", label: "SAV — Identification EZD/ESV par relais",          assetUid: "asJpNSD7cpyqDyrkrUp7kL", exportUid: "esULo4gSfeEmuKBn4n3dgg5" },
  { key: "resultats",    label: "SAV — Résultats vaccination par équipe",           assetUid: "akKgEGx4H4ngXpf6jecCnG", exportUid: "esVv8TpVCDXyWzDy5reV3LE" },
  { key: "supervision",  label: "SAV — Supervision des équipes",                    assetUid: "aNbqyLNEssNK8SJjP5C52Z", exportUid: "esJpDYBSSBSB4GAFkxYWs4x" },
  { key: "planif",       label: "SAV — Planification session de vaccination",       assetUid: "aTULFAgubcP55V7VsSbcer", exportUid: "esMPxESLfJK4Dsh4ediJdBb" },
];

/* ----------------------- Source Rapport mensuel + Évaluation des AT ----------------------- */
/**
 * Formulaire « Rapport mensuel des AT ». Source unique des onglets « Rapport
 * mensuel des consultants » et « Évaluation des consultants » (collecte
 * continue → synchronisation temps réel, TTL court).
 */
export interface AtSource { key: "at"; label: string; assetUid: string; exportUid: string; }
export const AT_SOURCE: AtSource = {
  key: "at",
  label: "Rapport mensuel des AT et Évaluation",
  assetUid: "avvVUwZZwkg24iz2Ztj3wi",
  exportUid: "esJkyaePnnusbTbfLRZRpbk",
};
export const savExportUrl = (src: SavSource, base = KOBO_BASE_URL) => koboExportUrl(src, base);
export const savDataUrl = (src: SavSource, base = KOBO_BASE_URL) => koboDataUrl(src, base);
export const atExportUrl = (base = KOBO_BASE_URL) => koboExportUrl(AT_SOURCE, base);
export const atDataUrl = (base = KOBO_BASE_URL) => koboDataUrl(AT_SOURCE, base);

export function koboExportUrl(src: { assetUid: string; exportUid: string }, base = KOBO_BASE_URL): string {
  return `${base}/api/v2/assets/${src.assetUid}/export-settings/${src.exportUid}/data.xlsx`;
}
export function koboDataUrl(src: { assetUid: string }, base = KOBO_BASE_URL): string {
  return `${base}/api/v2/assets/${src.assetUid}/data.json`;
}
export const cqdExportUrl = (src: CqdSource, base = KOBO_BASE_URL) => koboExportUrl(src, base);
export const cqdDataUrl = (src: CqdSource, base = KOBO_BASE_URL) => koboDataUrl(src, base);

export const LEVEL_LABEL: Record<StructureLevel, { short: string; plural: string }> = {
  antenne: { short: "Antenne", plural: "Antennes" },
  zs: { short: "Zone de santé", plural: "Zones de santé" },
  as: { short: "Aire de santé", plural: "Aires de santé" },
};

/* ------------------------ Les 6 composantes ------------------------ */
export interface Composante {
  key: string;
  label: string;
  short: string;
  tokens: string[];
}

export const COMPOSANTES: Composante[] = [
  {
    key: "planification",
    label: "Planification & gestion des ressources",
    short: "Planification & ressources",
    tokens: ["planification", "plan", "docs", "document", "cdf", "chaine_froid", "froid", "gestion_vaccins", "vaccins", "gestion_dechets", "dechets", "securite_injections", "securite", "injection", "intrant", "logistique", "ressource"],
  },
  {
    key: "prestation",
    label: "Atteinte des populations cibles / prestation de services",
    short: "Prestation de services",
    tokens: ["prestation_services", "prestation", "service", "pop", "population", "cible"],
  },
  {
    key: "supervision",
    label: "Supervision formative",
    short: "Supervision formative",
    tokens: ["supervision_formative", "supervision_zs", "supervision", "formative", "sup"],
  },
  {
    key: "monitorage",
    label: "Monitorage pour action / gestion des données",
    short: "Monitorage pour action",
    tokens: ["monitorage_donnees", "monitorage", "gestion_donnees", "donnees", "data", "mon", "rapportage"],
  },
  {
    key: "engagement",
    label: "Engagement communautaire",
    short: "Engagement communautaire",
    tokens: ["engagement_communautaire", "engagement_comm", "engagement", "communautaire", "comm", "mobilisation", "demande"],
  },
  {
    key: "surveillance",
    label: "Surveillance épidémiologique",
    short: "Surveillance épidémio.",
    tokens: ["surveillance_epidemiologique", "surveillance", "surv", "epidemio", "pfa"],
  },
];

/* ------------ Choix « reponse_score » → réponse canonique ------------ */
export const ANSWER_MATCHERS: Record<AnswerValue, string[]> = {
  oui: ["oui", "yes", "1", "vrai", "conforme"],
  partiel: ["partiellement", "partiel", "partial", "en partie", "moyennement"],
  non: ["non", "no", "0", "non conforme"],
  na: ["non applicable", "non_applicable", "na", "n/a", "sans objet", "nsp"],
};

export const ANSWER_COLOR: Record<AnswerValue, string> = { oui: "#1f9d57", partiel: "#f59e0b", non: "#e23636", na: "#cbd5e1" };
export const ANSWER_LABEL: Record<AnswerValue, string> = { oui: "Oui", partiel: "Partiel", non: "Non", na: "N/A" };

/* --------- Détection du TYPE de supervision --------- */
/**
 * Mots-clés appliqués à la valeur RÉELLE du champ « Type_de_supervision »
 * (select_multiple). Valeurs RÉELLES par formulaire (Tshuapa, 2026) :
 *   Centre de santé : supervision_conjointe_mca_ecz_at, supervision_ecz_seul,
 *                     supervision_dps_seul, supervision_antenne_seul,
 *                     supervision_pev_central_dps
 *   Zone de santé   : supervision_conjointe, supervision_mca_seul,
 *                     supervision_dps, supervision_pev_central_oms
 *   Antenne         : supervision_conjointe_pev_central_oms, supervision_par_dps,
 *                     auto_supervision, supervision_par_mcp
 * L'ordre compte : on teste le plus spécifique d'abord. « pev central »/
 * « niveau central » AVANT le générique « conjointe ». La valeur générique
 * « Supervision conjointe » (anciennes données) → conjointe_mca, JAMAIS
 * conjointe_pev_oms (réservé aux valeurs nommant explicitement PEV central/OMS).
 */
export const TYPE_LABEL_KEYWORDS: { type: SupervisionType; keywords: string[] }[] = [
  { type: "conjointe_pev_oms", keywords: ["pev central oms", "pev central dps", "niveau central", "pev oms", "pev/oms", "pev central", "central pev", "oms vpd"] },
  { type: "auto_eval", keywords: ["auto supervision", "auto_supervision", "auto evaluation", "auto-evaluation", "autoevaluation", "auto eval"] },
  { type: "ecz_seul", keywords: ["ecz seul", "mcz seul", "ecz/mcz", "ecz mcz seul"] },
  { type: "mca_seul", keywords: ["mca seul", "mca/at seul"] },
  { type: "conjointe_mca", keywords: ["conjointe mca ecz at", "conjointe mca mcz at", "conjointe mca", "conjointe mcz", "supervision conjointe", "conjointe", "conjoint"] },
];

/** Mots-clés résiduels pour la classification par fonction (anciennes données). */
export const TYPE_KEYWORDS = {
  oms: ["oms", "vpd", "pev central", "niveau central"],
  mca_at: ["mca", " at", "at ", "assistant technique", "antenne", "mcz conjoint"],
  ecz: ["ecz", "mcz", "bcz", "medecin chef de zone", "equipe cadre"],
};

export interface SupervisionTypeDef { key: SupervisionType; label: string; }
export const SUPERVISION_TYPES: SupervisionTypeDef[] = [
  { key: "conjointe_pev_oms", label: "Conjointe PEV-Central / OMS-VPD" },
  { key: "conjointe_mca", label: "Conjointe (équipe)" },
  { key: "auto_eval", label: "Auto-évaluation" },
  { key: "mca_seul", label: "MCA seul" },
  { key: "ecz_seul", label: "ECZ / MCZ seul" },
  { key: "autre", label: "Autre / non précisé" },
];

/* ------------------------ Seuils de cotation ------------------------ */
export const COTATION_THRESHOLDS: { level: CotationLevel; label: string; min: number; color: string }[] = [
  { level: "tres_bon", label: "Très bon", min: 80, color: "#1f9d57" },
  { level: "bon", label: "Bon", min: 60, color: "#0093d5" },
  { level: "moyen", label: "Moyen", min: 40, color: "#f59e0b" },
  { level: "faible", label: "Faible", min: 0, color: "#e23636" },
];
export function cotationFor(scorePct: number): CotationLevel {
  for (const t of COTATION_THRESHOLDS) if (scorePct >= t.min) return t.level;
  return "faible";
}
export const COTATION_LABEL: Record<CotationLevel, string> = { tres_bon: "Très bon", bon: "Bon", moyen: "Moyen", faible: "Faible" };
export const COTATION_COLOR: Record<CotationLevel, string> = { tres_bon: "#1f9d57", bon: "#0093d5", moyen: "#f59e0b", faible: "#e23636" };
export const COTATION_ORDER: CotationLevel[] = ["tres_bon", "bon", "moyen", "faible"];

/* ----- Seuils CQD (complétude / promptitude / concordance) ----- */
export const CQD_THRESHOLDS: { level: CotationLevel; label: string; min: number; color: string }[] = [
  { level: "tres_bon", label: "Très bon", min: 90, color: "#1f9d57" },
  { level: "bon", label: "Bon", min: 80, color: "#0093d5" },
  { level: "moyen", label: "Moyen", min: 70, color: "#f59e0b" },
  { level: "faible", label: "Faible", min: 0, color: "#e23636" },
];
export function cqdAppreciation(pct: number | null): CotationLevel | null {
  if (pct === null || !Number.isFinite(pct)) return null;
  for (const t of CQD_THRESHOLDS) if (pct >= t.min) return t.level;
  return "faible";
}

/* ------------------------ Cibles attendues ------------------------ */
/**
 * Dénominateurs « attendus » par mois (échelle provinciale), utilisés pour le
 * « % réalisé ». Ils sont multipliés par le nombre de mois de la période.
 */
export interface SupervisionTargets {
  conjointe_pev_oms_per_month: number;
  conjointe_antennes_per_month: number;
  conjointe_zs_per_month: number;
  conjointe_aires_per_month: number;
  auto_eval_per_month: number;
  mca_seul_per_month: number;
  ecz_seul_per_month: number;
}

/**
 * Valeurs provinciales par défaut (Tshuapa).
 * Province ≈ 2 antennes, ≈ 23 ZS, nombreuses aires.
 */
export const SUPERVISION_TARGETS: SupervisionTargets = {
  conjointe_pev_oms_per_month: 1 / 3,
  conjointe_antennes_per_month: 2 / 3,
  conjointe_zs_per_month: 4,
  conjointe_aires_per_month: 12,
  auto_eval_per_month: 2,
  mca_seul_per_month: 8,
  ecz_seul_per_month: 23,
};

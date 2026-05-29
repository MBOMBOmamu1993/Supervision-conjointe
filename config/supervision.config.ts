/**
 * Configuration du dashboard de SUPERVISION CONJOINTE PEV-Central / OMS.
 *
 * Cette configuration a été calée sur la structure RÉELLE des trois
 * formulaires KoboToolbox (Tshuapa) :
 *   - Antenne PEV               (XLSForm : groupes I à VI)
 *   - Checklist ZS              (colonnes q_<token>_NN_score / _max)
 *   - Checklist Centre de santé (colonnes sc_<token>_NN / max_<token>_NN)
 *
 * Les scores sont lus directement depuis les colonnes calculées du formulaire
 * (barème : Oui = score complet, Partiellement = moitié, Non = 0, Non
 * applicable = exclu du score maximum), ce qui garantit l'exactitude.
 */

export type StructureLevel = "antenne" | "zs" | "as";
export type CotationLevel = "tres_bon" | "bon" | "moyen" | "faible";
export type AnswerValue = "oui" | "partiel" | "non" | "na";
export type SupervisionType = "conjointe_pev_oms" | "conjointe_mca" | "mca_seul" | "ecz_seul" | "autre";

export interface KoboSource {
  key: StructureLevel;
  label: string;
  assetUid: string;
  exportUid: string;
}

export const KOBO_BASE_URL = "https://eu.kobotoolbox.org";

export const KOBO_SOURCES: KoboSource[] = [
  { key: "antenne", label: "Checklist supervision Antenne PEV", assetUid: "axvaHRq3XGozr8o3z4wr5u", exportUid: "esTwbAKe5dn2FTAcbbagXL8" },
  { key: "zs", label: "Checklist supervision PEV — Zone de santé", assetUid: "axsB6RwiENF3FC2eZzsH3m", exportUid: "esTZSfTTAYYvcLtRbJdr6Jh" },
  { key: "as", label: "Checklist supervision — Centre de santé", assetUid: "ac8zZ9oE8VWoHXS3iSKRTQ", exportUid: "esNgSLpkCsawjAQXWtSgL6b" },
];

export function koboExportUrl(src: KoboSource, base = KOBO_BASE_URL): string {
  return `${base}/api/v2/assets/${src.assetUid}/export-settings/${src.exportUid}/data.xlsx`;
}
export function koboDataUrl(src: KoboSource, base = KOBO_BASE_URL): string {
  return `${base}/api/v2/assets/${src.assetUid}/data.json`;
}

export const LEVEL_LABEL: Record<StructureLevel, { short: string; plural: string }> = {
  antenne: { short: "Antenne", plural: "Antennes" },
  zs: { short: "Zone de santé", plural: "Zones de santé" },
  as: { short: "Aire de santé", plural: "Aires de santé" },
};

/* ------------------------ Les 6 composantes ------------------------ */
/**
 * `tokens` = fragments présents dans le NOM technique des colonnes de score
 * (ex. q_plan_01_score → token « plan » ; sc_chaine_froid_01 → « chaine_froid »).
 * La correspondance retient le mot-clé le PLUS LONG inclus dans le token.
 */
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

export const ANSWER_COLOR: Record<AnswerValue, string> = { oui: "#22b457", partiel: "#f29e0b", non: "#e23636", na: "#cbd5e1" };
export const ANSWER_LABEL: Record<AnswerValue, string> = { oui: "Oui", partiel: "Partiel", non: "Non", na: "N/A" };

/* --------- Détection du TYPE de supervision (Fonction du superviseur) --------- */
/**
 * Aucun champ « type de supervision » n'existe dans les formulaires : on le
 * déduit du champ « Fonction du superviseur ». Une mention « OMS / VPD »
 * indique une supervision conjointe avec le niveau central ; la présence d'un
 * « / » (ex. « AT MASHAKO / OMS ») indique une équipe conjointe.
 */
export const TYPE_KEYWORDS = {
  oms: ["oms", "vpd", "central", "pev central", "niveau central", "intermediaire", "antenne nationale"],
  mca_at: ["mca", " at", "at ", "assistant technique", "antenne", "mcz conjoint"],
  ecz: ["ecz", "mcz", "bcz", "medecin chef de zone", "equipe cadre"],
};

export interface SupervisionTypeDef { key: SupervisionType; label: string; }
export const SUPERVISION_TYPES: SupervisionTypeDef[] = [
  { key: "conjointe_pev_oms", label: "Conjointe PEV-Central / OMS-VPD" },
  { key: "conjointe_mca", label: "Conjointe MCA / AT / MCZ" },
  { key: "mca_seul", label: "MCA seul" },
  { key: "ecz_seul", label: "ECZ seul" },
  { key: "autre", label: "Autre / non précisé" },
];

/* ------------------------ Seuils de cotation ------------------------ */
export const COTATION_THRESHOLDS: { level: CotationLevel; label: string; min: number; color: string }[] = [
  { level: "tres_bon", label: "Très bon", min: 80, color: "#22b457" },
  { level: "bon", label: "Bon", min: 60, color: "#0093d5" },
  { level: "moyen", label: "Moyen", min: 40, color: "#f29e0b" },
  { level: "faible", label: "Faible", min: 0, color: "#e23636" },
];
export function cotationFor(scorePct: number): CotationLevel {
  for (const t of COTATION_THRESHOLDS) if (scorePct >= t.min) return t.level;
  return "faible";
}
export const COTATION_LABEL: Record<CotationLevel, string> = { tres_bon: "Très bon", bon: "Bon", moyen: "Moyen", faible: "Faible" };
export const COTATION_COLOR: Record<CotationLevel, string> = { tres_bon: "#22b457", bon: "#0093d5", moyen: "#f29e0b", faible: "#e23636" };
export const COTATION_ORDER: CotationLevel[] = ["tres_bon", "bon", "moyen", "faible"];

/* ------------------------ Cibles attendues ------------------------ */
export interface SupervisionTargets {
  conjointe_pev_oms: number | null;
  conjointe_mca: number | null;
  mca_seul: number | null;
  ecz_seul: number | null;
  antennes: number | null;
  zs_conjointe: number | null;
  zs_mca: number | null;
  cs_conjointe: number | null;
  cs_ecz: number | null;
}

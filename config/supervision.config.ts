/**
 * Configuration du dashboard de SUPERVISION CONJOINTE PEV-Central / OMS.
 *
 * Tout ce qui dépend de la structure réelle des formulaires KoboToolbox est
 * centralisé ici afin de pouvoir l'ajuster sans toucher au code analytique.
 *
 * Les trois bases de données KoboCollect :
 *   1. Antenne PEV                               → niveau Antenne
 *   2. Checklist supervision PEV Zone de santé   → niveau ZS
 *   3. Checklist supervision Centre de santé     → niveau CS / Aire de santé
 *
 * NB : la résolution des colonnes (lib/supervision/schema.ts) est tolérante —
 * elle teste plusieurs libellés candidats et normalise accents/casse. Les
 * listes ci-dessous sont des indices ; complétez-les une fois les vrais noms
 * de colonnes connus (voir la page Analyse → « Colonnes détectées », ou
 * l'endpoint /api/supervision/introspect).
 */

export type StructureLevel = "antenne" | "zs" | "as";
export type CotationLevel = "tres_bon" | "bon" | "moyen" | "faible";
export type AnswerValue = "oui" | "partiel" | "non" | "na";

export interface KoboSource {
  key: StructureLevel;
  label: string;
  assetUid: string;
  exportUid: string;
}

export const KOBO_BASE_URL = "https://eu.kobotoolbox.org";

export const KOBO_SOURCES: KoboSource[] = [
  { key: "antenne", label: "Antenne PEV", assetUid: "axvaHRq3XGozr8o3z4wr5u", exportUid: "esTwbAKe5dn2FTAcbbagXL8" },
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
export interface Composante {
  key: string;
  label: string;
  short: string;
  keywords: string[];
}

export const COMPOSANTES: Composante[] = [
  {
    key: "planification",
    label: "Planification & gestion des ressources",
    short: "Planification & ressources",
    keywords: ["planification", "gestion des ressources", "ressource", "intrant", "logistique", "micro plan", "microplan", "budget", "stock", "carburant", "chaine de froid", "chaine du froid"],
  },
  {
    key: "populations_cibles",
    label: "Atteinte des populations cibles",
    short: "Populations cibles",
    keywords: ["population cible", "atteinte des population", "couverture", "cible", "denombrement", "enfant", "cohorte", "perdu de vue", "abandon"],
  },
  {
    key: "supervision_formative",
    label: "Supervision formative",
    short: "Supervision formative",
    keywords: ["supervision formative", "formative", "formation", "encadrement", "feedback", "retro information", "retroaction", "coaching"],
  },
  {
    key: "monitorage_action",
    label: "Monitorage pour action",
    short: "Monitorage pour action",
    keywords: ["monitorage pour action", "monitorage", "analyse des donnees", "analyse mensuelle", "action corrective", "suivi des action", "rapportage", "dhis", "completude", "promptitude"],
  },
  {
    key: "engagement_communautaire",
    label: "Engagement communautaire",
    short: "Engagement communautaire",
    keywords: ["engagement communautaire", "communautaire", "communaute", "mobilisation", "sensibilisation", "relais", "crec", "communication", "reticence", "refus"],
  },
  {
    key: "surveillance_epidemiologique",
    label: "Surveillance épidémiologique",
    short: "Surveillance épidémiologique",
    keywords: ["surveillance epidemiologique", "surveillance", "epidemio", "pfa", "cas suspect", "notification", "recherche active", "rougeole", "manifestation post"],
  },
];

/* ------------------- Types de supervision (qui supervise) ------------------- */
export type SupervisionType = "conjointe_pev_oms" | "conjointe_mca" | "mca_seul" | "ecz_seul" | "autre";

export interface SupervisionTypeDef {
  key: SupervisionType;
  label: string;
  matchers: string[];
}

export const SUPERVISION_TYPES: SupervisionTypeDef[] = [
  { key: "conjointe_pev_oms", label: "Conjointe PEV-Central / OMS-VPD", matchers: ["pev central", "pev-central", "oms vpd", "oms-vpd", "conjointe pev", "central oms", "niveau central"] },
  { key: "conjointe_mca", label: "Conjointe MCA / AT / MCZ", matchers: ["mca at mcz", "mca/at/mcz", "conjointe mca", "mca at", "at mcz", "conjointe niveau", "conjointe zone", "conjointe antenne"] },
  { key: "mca_seul", label: "MCA seul", matchers: ["mca seul", "mca seule", "mca uniquement", "antenne seul"] },
  { key: "ecz_seul", label: "ECZ seul", matchers: ["ecz seul", "ecz seule", "ecz uniquement", "zone seul", "mcz seul"] },
];

/* ------------------------ Réponses & barème ------------------------ */
export const ANSWER_MATCHERS: Record<AnswerValue, string[]> = {
  oui: ["oui", "yes", "vrai", "true", "conforme", "fait", "disponible", "present", "o"],
  partiel: ["partiel", "partiellement", "partial", "en partie", "moyennement", "incomplet"],
  non: ["non", "no", "faux", "false", "non conforme", "non fait", "absent", "indisponible", "n"],
  na: ["na", "n/a", "sans objet", "non applicable", "not applicable", "ne s'applique pas", "nsp"],
};

export const ANSWER_SCORE: Record<AnswerValue, number | null> = { oui: 1, partiel: 0.5, non: 0, na: null };

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

export const ANSWER_COLOR: Record<AnswerValue, string> = { oui: "#22b457", partiel: "#f29e0b", non: "#e23636", na: "#cbd5e1" };
export const ANSWER_LABEL: Record<AnswerValue, string> = { oui: "Oui", partiel: "Partiel", non: "Non", na: "N/A" };

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

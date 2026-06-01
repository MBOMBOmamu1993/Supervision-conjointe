/** Types pour l'onglet « Qualité des données » (Contrôle Qualité — CQD). */

export type ConcordanceClass = "normal" | "sous" | "sur" | "na";

export interface CqdRecord {
  id: string;
  level: "zs" | "as";
  province: string | null;
  antenne: string | null;
  zone: string | null;
  aire: string | null;
  structure: string | null;
  month: string | null;
  typeLabel: string | null;
  // Sommes des antigènes par source (PENTA1/3, RR1/2).
  registre: { p1: number; p3: number; rr1: number; rr2: number };
  pointage: { p1: number; p3: number; rr1: number; rr2: number };
  snis: { p1: number; p3: number; rr1: number; rr2: number };
  dhis2: { p1: number; p3: number; rr1: number; rr2: number };
  // Discordances / valeurs vérifiées (transcription).
  nbValeursVerifiees: number;
  nbDiscordSnisDhis2: number;
  nbDiscordPointageRegistre: number;
  // Outils correctement remplis.
  registreCorrect: boolean | null;
  pointageCorrect: boolean | null;
  snisCorrect: boolean | null;
  // Enfants perdus de vue.
  enfantsARecuperer: number;
  enfantsIdentifies: number;
  enfantsRetrouves: number;
  enfantsRecuperes: number;
}

export interface ConcordanceStat {
  /** Taux = DHIS2 / référence × 100. */
  taux: number | null;
  classe: ConcordanceClass;
}

export interface CqdTrendPoint {
  month: string;
  concordanceP3: number | null;
  concordanceRr2: number | null;
  erreurSnisDhis2: number | null;
  erreurPointageRegistre: number | null;
}

export interface CqdLevelBundle {
  level: "zs" | "as";
  records: number;
  structuresControlees: number;
  /** Concordance globale PENTA3 / RR2 (DHIS2 vs référence). */
  concordanceP3: ConcordanceStat;
  concordanceRr2: ConcordanceStat;
  /** Taux global d'erreur de transcription (%). */
  erreurSnisDhis2: number | null;
  erreurPointageRegistre: number | null;
  /** Complétude des outils de gestion (%). */
  outils: { registre: number | null; pointage: number | null; snis: number | null };
  /** Enfants perdus de vue : identifiés / retrouvés / récupérés (%). */
  enfants: { aRecuperer: number; identifies: number; retrouves: number; recuperes: number; tauxRecuperes: number | null };
  /** Comparaison des antigènes (sommes) entre sources. */
  antigenes: { antigene: string; registre: number; pointage: number; snis: number; dhis2: number }[];
  /** Évolution mensuelle. */
  trend: CqdTrendPoint[];
  /** Détail par structure (concordance + erreur). */
  parStructure: {
    name: string;
    concordanceP3: number | null;
    classeP3: ConcordanceClass;
    erreurSnisDhis2: number | null;
    outilsOk: number;
  }[];
}

export interface CqdBundle {
  meta: {
    generatedAt: string;
    months: string[];
    sources: { key: "zs" | "as"; label: string; rows: number; ok: boolean; error?: string }[];
  };
  filters: { provinces: string[]; antennes: string[]; zones: string[]; aires: string[]; months: string[]; types: string[] };
  levels: { zs: CqdLevelBundle; as: CqdLevelBundle };
}

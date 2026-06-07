/** Types pour l'onglet « SAV — Semaine Africaine de Vaccination ». */

/** Antigènes suivis par la SAV (ordre d'affichage des doses manquées). */
export const SAV_ANTIGENES = [
  "BCG", "VPO1", "Penta1", "PCV1", "Rota1", "VPO2", "Penta2", "PCV2", "Rota2",
  "VPO3", "VPI1", "Penta3", "PCV3", "Rota3", "VPI2", "RR1", "RR2", "VAA",
  "VAP1", "VAP2", "VAP3", "VAP4",
] as const;
export type SavAntigene = (typeof SAV_ANTIGENES)[number];

export const SAV_AGE_GROUPS = ["age_0_11", "age_12_23", "age_24_59"] as const;
export type SavAgeGroup = (typeof SAV_AGE_GROUPS)[number];
export const SAV_AGE_LABEL: Record<SavAgeGroup, string> = {
  age_0_11: "0 – 11 mois", age_12_23: "12 – 23 mois", age_24_59: "24 – 59 mois",
};

/** Compteur générique clé → nombre, trié. */
export interface SavCount { label: string; value: number }

export interface SavSourceMeta { key: string; label: string; rows: number; ok: boolean; error?: string }

/** Comptage de dédoublonnage (avant → après). */
export interface DedupInfo { raw: number; kept: number; removed: number }

/** Ligne de synthèse par zone de santé (vue d'ensemble). */
export interface SavZsSynthese {
  zone: string;
  cs: number;
  enfantsIdentifies: number;
  zeroDose: number;
  sousVaccines: number;
  sessions: number;
  enfantsAttendus: number;
  enfantsRecuperes: number;
  tauxRecup: number | null;
}

/** Tableau par tranche d'âge × antigène (ligne = tranche d'âge). */
export interface AgeAntigeneRow { ageLabel: string; values: Record<string, number> }

/** Ligne « enfants manqués par aire de santé et tranche d'âge ». */
export interface AsAgeRow { aire: string; zone: string | null; a0: number; a1: number; a2: number; total: number }

export interface SavBundle {
  meta: {
    generatedAt: string;
    sources: SavSourceMeta[];
    baseSaisie: { configured: boolean; ok: boolean; rows: number; error?: string };
    hasData: boolean;
  };
  filters: {
    provinces: string[]; antennes: string[]; zones: string[]; aires: string[]; months: string[];
    geo: { province: string | null; antenne: string | null; zone: string | null; aire: string | null }[];
  };
  dedup: { identCs: DedupInfo; planif: DedupInfo };

  /* 1. Vue d'ensemble */
  vue: {
    kpi: {
      identCsFiches: number;
      planifFiches: number;
      asRelais: number; asRelaisTotal: number; asRelaisPct: number | null;
      asResultats: number; asResultatsTotal: number; asResultatsPct: number | null;
      supervisionForms: number;
    };
    formsByType: SavCount[];
    enfantsManquesByZs: SavCount[];
    statutVaccinal: { zeroDose: number; sousVaccines: number; autres: number };
    dosesByAntigene: SavCount[];
    topAsManques: SavCount[];
    syntheseByZs: SavZsSynthese[];
  };

  /* 2. Identification CS */
  identCs: {
    kpi: { identifies: number; zeroDose: number; sousVaccines: number; dosesManquees: number; csUniques: number };
    parTrancheAge: { age_0_11: number; age_12_23: number; age_24_59: number };
    parZsTrancheAge: { zone: string; a0: number; a1: number; a2: number }[];
    dosesParTrancheAntigene: AgeAntigeneRow[];
    parAsTrancheAge: AsAgeRow[];
    topAs: SavCount[];
  };

  /* 3. Identification relais */
  identRelais: {
    kpi: { identifies: number; zeroDose: number; sousVaccines: number; relais: number; asCount: number };
    parTrancheAge: { age_0_11: number; age_12_23: number; age_24_59: number };
    parZsTrancheAge: { zone: string; a0: number; a1: number; a2: number }[];
    comparaisonCsCommunaute: { zone: string; cs: number; communaute: number }[];
    parAsTrancheAge: AsAgeRow[];
    topAs: SavCount[];
  };

  /* 4. Planification */
  planif: {
    kpi: { sessions: number; enfantsAttendus: number; asAvecProgramme: number; asTotal: number; ratio: number | null };
    sessionsParType: { avancee: number; fixe: number; mobile: number };
    asProgramme: { avec: number; sans: number };
    enfantsAttendusByZs: SavCount[];
    asProgrammeTable: { aire: string; zone: string | null; sessions: number; enfantsAttendus: number; programme: boolean }[];
    programmeParAs: {
      aire: string; date: string | null; type: string; site: string | null; enfantsAttendus: number; equipe: string | null;
    }[];
  };

  /* 5. Résultats vaccination */
  resultats: {
    kpi: { recuperes: number; tauxRecup: number | null; zeroDoseRecuperes: number | null; asSousSeuil: number };
    tauxByZsAntigene: { antigene: string; zones: { zone: string; taux: number | null }[] }[];
    enfantsByTrancheAge: { age_0_11: number; age_12_23: number; age_24_59: number };
    parAsTable: { aire: string; values: Record<string, number>; total: number; identifies: number; taux: number | null }[];
    topAsFaibles: SavCount[];
    syntheseAntigenes: { antigene: string; a0: number; a1: number; a2: number; pctRecup: number | null }[];
    antigeneOptions: string[];
    /** Enfants vaccinés par antigène × tranche d'âge (Source : BASE SAISIE). */
    vaccinesParTrancheAntigene: AgeAntigeneRow[];
    /** % enfants vaccinés par antigène × tranche d'âge (vaccinés ÷ identifiés, BASE SAISIE). */
    pctParTrancheAntigene: { ageLabel: string; values: Record<string, number | null> }[];
  };

  /* 6. Supervision équipes */
  supervision: {
    kpi: { realisees: number; asCount: number; ouiGlobalPct: number | null; questionsCount: number };
    ouiParQuestion: SavCount[];
    ouiParQuestionAs: { aire: string; values: Record<string, number | null> }[];
    topProblemes: string[];
    topActions: string[];
    topRecommandations: string[];
  };
}

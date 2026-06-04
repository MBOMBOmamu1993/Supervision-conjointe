/** Types pour l'onglet « Monitorage rapide de convenance » (RCM). */

/** Antigènes suivis par le formulaire RCM. */
export const RCM_ANTIGENES = ["penta1", "penta2", "rr1", "rr2", "vpi1", "vpi2"] as const;
export type RcmAntigene = (typeof RCM_ANTIGENES)[number];
export const RCM_ANTIGENE_LABEL: Record<RcmAntigene, string> = {
  penta1: "PENTA1", penta2: "PENTA2", rr1: "RR1", rr2: "RR2", vpi1: "VPI1", vpi2: "VPI2",
};

export type AgeGroup = "age_0_11" | "age_12_23" | "age_24_59";
export const AGE_GROUP_LABEL: Record<AgeGroup, string> = {
  age_0_11: "0–11 mois", age_12_23: "12–23 mois", age_24_59: "24–59 mois",
};

export type DistanceBand = "moins_5km" | "entre_5_10km" | "plus_10km";

/** Comptage vacciné / non vacciné pour un antigène. */
export interface VaccCount { vaccines: number; nonVaccines: number; }

/** Raison agrégée (clé technique → libellé + nombre). */
export interface ReasonCount { key: string; label: string; count: number; }

/** Détail d'une aire de santé pour les tableaux par raison. */
export interface RcmAsRow {
  name: string;
  zone: string | null;
  enfants: number;
  reasonsCarte: Record<string, number>;
  reasonsVacc: Record<string, number>;
}

export interface RcmBundle {
  meta: {
    generatedAt: string;
    months: string[];
    source: { label: string; rows: number; enfants: number; ok: boolean; error?: string };
    hasData: boolean;
  };
  filters: { provinces: string[]; antennes: string[]; zones: string[]; aires: string[]; months: string[]; types: string[] };
  kpi: {
    asBeneficiaires: number;
    asTotal: number;
    localites: number;
    totalEnfants: number;
    distance: Record<DistanceBand, number>;        // nombre de localités/enfants par bande
    distancePct: Record<DistanceBand, number | null>;
    missAnyPct: number | null;                      // % global enfants manqués
    cartePct: number | null;                        // % enfants possédant une carte
    sansCartePct: number | null;
    vaccinePct: number | null;                      // % enfants vaccinés (moyenne antigènes)
    nonVaccinePct: number | null;
    antigenesPrioritaires: string;
  };
  /** % d'enfants manqués par antigène. */
  missByAntigene: { antigene: string; pct: number | null; missed: number; total: number }[];
  /** Vacciné / non vacciné par tranche d'âge × antigène. */
  byAge: { group: AgeGroup; label: string; antigenes: { antigene: string; vaccines: number; nonVaccines: number }[] }[];
  /** Heatmap % enfants manqués ZS × antigène (dernier découpage mensuel agrégé). */
  missByZs: { zone: string; values: Record<string, number | null> }[];
  /** Raisons de non-possession de carte (triées). */
  reasonsCarte: ReasonCount[];
  /** Raisons de non vaccination (triées). */
  reasonsVacc: ReasonCount[];
  /** Détail par aire de santé pour les tableaux. */
  parAire: RcmAsRow[];
}

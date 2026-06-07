/**
 * Données SAV figées (activité terminée) issues des exports Kobo officiels,
 * normalisées au build par `scripts/gen-sav-seed.cjs` (jointure parent/enfant,
 * antigènes harmonisés : Pneumo→PCV, Rotasiil→ROTA, VAR/RR→RR).
 *
 * Les exports XLSX live de Kobo comportent plusieurs feuilles (parent = géo +
 * totaux, enfant = par antigène) ; l'API ne renvoyant qu'une feuille, on
 * s'appuie sur ce seed normalisé pour garantir des chiffres exacts et stables.
 */
import seedJson from "@/data/sav/sav-seed.json";

export type AntigeneKey =
  | "BCG" | "VPO1" | "VPO2" | "VPO3" | "PENTA1" | "PENTA2" | "PENTA3"
  | "PCV1" | "PCV2" | "PCV3" | "ROTA1" | "ROTA2" | "ROTA3"
  | "VPI1" | "VPI2" | "RR1" | "RR2" | "VAA" | "VAP1" | "VAP2" | "VAP3" | "VAP4";

export type AgeKey = "age_0_11" | "age_12_23" | "age_24_59";

export interface SeedFiche {
  id: string; time: number; province: string | null; antenne: string | null;
  zone: string | null; aire: string | null; cs: string | null; identifies: number; month: string | null;
}
export interface SeedChild {
  ficheId: string; province: string | null; antenne: string | null; zone: string | null; aire: string | null; cs: string | null;
  month: string | null; ageGroup: AgeKey | null; identifie: boolean; zeroDose: boolean; sousVaccine: boolean;
  missed: Record<AntigeneKey, boolean>;
}
export interface SeedResult {
  province: string | null; antenne: string | null; zone: string | null; aire: string | null;
  site: string | null; type: string | null; month: string | null;
  totalDoses: number; a0: number; a1: number; a2: number;
  byAntigene: Record<AntigeneKey, number>;
  byAntigeneAge: Record<AntigeneKey, { a0: number; a1: number; a2: number }>;
}
export interface SeedPlanFiche {
  id: string; time: number; province: string | null; antenne: string | null; zone: string | null; aire: string | null;
  sessionsPlanifiees: number; enfantsAttendus: number; sessionsAvancees: number; sessionsMobiles: number; month: string | null;
}
export interface SeedSession {
  ficheId: string; month: string | null; province: string | null; antenne: string | null; zone: string | null; aire: string | null;
  n: string | null; date: string | null; type: string | null; autreType: string | null; site: string | null; enfantsAttendus: number; equipe: string | null;
}
export interface SeedSupRow {
  province: string | null; antenne: string | null; zone: string | null; aire: string | null; site: string | null; month: string | null;
  q: Record<string, "oui" | "non" | null>;
  difficultesList: string[];
  difficultes: string | null; actions: string | null; recommandations: string | null;
}
export interface SeedBaseRow {
  antenne: string | null; zone: string | null; aire: string | null;
  byAgeAntigene: Record<AgeKey, Partial<Record<AntigeneKey, number>>>;
}
export interface SavSeed {
  antigenes: AntigeneKey[];
  identCs: { fiches: SeedFiche[]; enfants: SeedChild[] };
  identRelais: { fiches: SeedFiche[]; enfants: SeedChild[] };
  resultats: SeedResult[];
  planif: { fiches: SeedPlanFiche[]; sessions: SeedSession[] };
  supervision: { questions: string[]; rows: SeedSupRow[] };
  /** BASE SAISIE DONNEES SAV (Google Sheet) : détail par AS × âge × antigène. */
  baseSaisie: { identifies: SeedBaseRow[]; vaccines: SeedBaseRow[] };
}

export const SAV_SEED = seedJson as unknown as SavSeed;

/** Ordre d'affichage des antigènes (par contact). */
export const ANTIGENE_ORDER: AntigeneKey[] = [
  "BCG", "VPO1", "PENTA1", "PCV1", "ROTA1", "VPO2", "PENTA2", "PCV2", "ROTA2",
  "VPO3", "VPI1", "PENTA3", "PCV3", "ROTA3", "VPI2", "RR1", "RR2", "VAA",
  "VAP1", "VAP2", "VAP3", "VAP4",
];
/** Libellé d'affichage par antigène. */
export const ANTIGENE_LABEL: Record<AntigeneKey, string> = {
  BCG: "BCG", VPO1: "VPO1", VPO2: "VPO2", VPO3: "VPO3", PENTA1: "Penta1", PENTA2: "Penta2", PENTA3: "Penta3",
  PCV1: "PCV1", PCV2: "PCV2", PCV3: "PCV3", ROTA1: "Rota1", ROTA2: "Rota2", ROTA3: "Rota3",
  VPI1: "VPI1", VPI2: "VPI2", RR1: "RR1", RR2: "RR2", VAA: "VAA", VAP1: "VAP1", VAP2: "VAP2", VAP3: "VAP3", VAP4: "VAP4",
};

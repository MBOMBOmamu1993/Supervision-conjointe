/**
 * Niveau d'org unit DYNAMIQUE de l'onglet « Supervision conjointe » (cf.
 * specs/03) : le niveau affiché découle des filtres géographiques.
 *
 *  - aucun filtre          → comparaison des antennes ;
 *  - antenne sélectionnée  → zones de santé de l'antenne ;
 *  - ZS sélectionnée       → aires de santé de la ZS ;
 *  - AS sélectionnée       → détail de l'aire de santé.
 *
 * Module partagé serveur + client (PAS de "use client" : importé par
 * l'analytique serveur ET par les pages).
 */
import type { StructureLevel } from "@/config/supervision.config";

export type OrgLevel = "antenne" | "zs" | "as";

export interface OrgFilterValues {
  antenne?: string | null;
  zone?: string | null;
  aire?: string | null;
}

export function orgLevelOf(f: OrgFilterValues): OrgLevel {
  if (f.aire) return "as";
  if (f.zone) return "as"; // ZS choisie → on liste les AS de la ZS
  if (f.antenne) return "zs"; // antenne choisie → on liste les ZS de l'antenne
  return "antenne"; // défaut → comparaison des antennes
}

export const ORG_LABEL: Record<OrgLevel, { sing: string; plur: string }> = {
  antenne: { sing: "Antenne", plur: "Antennes" },
  zs: { sing: "Zone de santé", plur: "Zones de santé" },
  as: { sing: "Aire de santé", plur: "Aires de santé" },
};

/** Le niveau d'org unit correspond directement au niveau de formulaire source. */
export const ORG_TO_STRUCTURE: Record<OrgLevel, StructureLevel> = {
  antenne: "antenne",
  zs: "zs",
  as: "as",
};

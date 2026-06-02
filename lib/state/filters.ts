"use client";

import { create } from "zustand";

/**
 * Groupes de « Type de supervision » exposés dans le filtre. Chaque groupe
 * agrège un ou plusieurs types canoniques (cf. config/supervision.config.ts) :
 *  - « Supervision conjointe »  → toutes les supervisions conjointes ;
 *  - « Supervision par MoH (seul) » → auto-évaluation (antenne), MCA seul, ECZ/MCZ seul.
 */
export interface TypeGroupDef {
  key: string;
  label: string;
  /** Types canoniques regroupés (SupervisionType). */
  types: string[];
}

export const TYPE_GROUPS: TypeGroupDef[] = [
  { key: "conjointe_pev_oms", label: "Supervision conjointe PEV central-OMS", types: ["conjointe_pev_oms"] },
  { key: "conjointe_mca", label: "Supervision conjointe MCA/AT/ECZS", types: ["conjointe_mca"] },
  { key: "moh_seul", label: "Supervision par MoH (seul)", types: ["auto_eval", "mca_seul", "ecz_seul"] },
];

export interface FiltersState {
  province: string | null;
  antenne: string | null;
  zone: string | null;
  aire: string | null;
  /** Mois sélectionnés (ISO "YYYY-MM"), multi-sélection. */
  months: string[];
  /** Groupes de types de supervision sélectionnés (clés de TYPE_GROUPS). */
  types: string[];
  set: (patch: Partial<Omit<FiltersState, "set" | "reset" | "resetField">>) => void;
  /** Réinitialise tous les filtres. */
  reset: () => void;
  /** Réinitialise un champ précis (et ses dépendants pour la cascade géo). */
  resetField: (field: "province" | "antenne" | "zone" | "aire" | "months" | "types") => void;
}

export const useFilters = create<FiltersState>((set) => ({
  province: null,
  antenne: null,
  zone: null,
  aire: null,
  months: [],
  types: [],
  set: (patch) => set(patch),
  reset: () => set({ province: null, antenne: null, zone: null, aire: null, months: [], types: [] }),
  resetField: (field) =>
    set((s) => {
      switch (field) {
        // Réinitialiser un niveau géographique réinitialise aussi ses enfants
        // (cohérence de la cascade Province → Antenne → ZS → Aire).
        case "province":
          return { province: null, antenne: null, zone: null, aire: null };
        case "antenne":
          return { antenne: null, zone: null, aire: null };
        case "zone":
          return { zone: null, aire: null };
        case "aire":
          return { aire: null };
        case "months":
          return { months: [] };
        case "types":
          return { types: [] };
        default:
          return s;
      }
    }),
}));

export type QueryFilters = Pick<FiltersState, "province" | "antenne" | "zone" | "aire" | "months" | "types">;

export function filtersToQuery(f: QueryFilters): string {
  const p = new URLSearchParams();
  if (f.province) p.set("province", f.province);
  if (f.antenne) p.set("antenne", f.antenne);
  if (f.zone) p.set("zone", f.zone);
  if (f.aire) p.set("aire", f.aire);
  if (f.months && f.months.length) p.set("months", f.months.join(","));
  if (f.types && f.types.length) p.set("types", f.types.join(","));
  const s = p.toString();
  return s ? `?${s}` : "";
}

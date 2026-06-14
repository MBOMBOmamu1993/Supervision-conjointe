"use client";

import { create } from "zustand";

// Niveau d'org unit dynamique (onglet Supervision conjointe) — réexporté ici
// pour les composants clients ; la définition vit dans lib/org-level.ts
// (module partagé serveur + client).
export { orgLevelOf, ORG_LABEL, ORG_TO_STRUCTURE, type OrgLevel } from "@/lib/org-level";

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

/** Valeurs de filtre d'un onglet. */
export interface FilterValues {
  province: string | null;
  antenne: string | null;
  zone: string | null;
  aire: string | null;
  /** Mois sélectionnés (ISO "YYYY-MM"), multi-sélection. */
  months: string[];
  /** Groupes de types de supervision sélectionnés (clés de TYPE_GROUPS). */
  types: string[];
  /** Assistant technique sélectionné (onglets Rapport mensuel / Évaluation AT). */
  at: string | null;
  /**
   * Entité individuelle sélectionnée au NIVEAU D'AFFICHAGE courant (onglet
   * Supervision conjointe — sélecteur d'org unit sous le titre des pages) :
   * une antenne par défaut, une ZS si une antenne est filtrée, une AS si une
   * ZS est filtrée. Traduite côté client vers le filtre géo correspondant,
   * sans changer le niveau d'affichage. Réinitialisée à chaque changement de
   * filtre géographique principal.
   */
  org: string | null;
}

export type FilterField = "province" | "antenne" | "zone" | "aire" | "months" | "types" | "at" | "org";

export const EMPTY_FILTERS: FilterValues = {
  province: null, antenne: null, zone: null, aire: null, months: [], types: [], at: null, org: null,
};

/**
 * Store de filtres CLOISONNÉ PAR ONGLET : chaque onglet (supervision, qualite,
 * rcm, etat…) possède son propre jeu de filtres. Les visuels d'un onglet ne
 * dépendent donc que des filtres de cet onglet, jamais de ceux d'un autre.
 */
interface FiltersStore {
  tabs: Record<string, FilterValues>;
  set: (tab: string, patch: Partial<FilterValues>) => void;
  reset: (tab: string) => void;
  resetField: (tab: string, field: FilterField) => void;
}

export const useFiltersStore = create<FiltersStore>((set) => ({
  tabs: {},
  set: (tab, patch) =>
    set((s) => {
      const cur = s.tabs[tab] ?? EMPTY_FILTERS;
      // Tout changement de filtre géographique principal invalide la sélection
      // d'org unit (elle appartient au niveau d'affichage précédent).
      const touchesGeo = (["province", "antenne", "zone", "aire"] as const).some((k) => k in patch);
      const next = { ...cur, ...(touchesGeo && !("org" in patch) ? { org: null } : null), ...patch };
      return { tabs: { ...s.tabs, [tab]: next } };
    }),
  reset: (tab) => set((s) => ({ tabs: { ...s.tabs, [tab]: EMPTY_FILTERS } })),
  resetField: (tab, field) =>
    set((s) => {
      const cur = s.tabs[tab] ?? EMPTY_FILTERS;
      // Réinitialiser un niveau géographique réinitialise aussi ses enfants
      // (cohérence de la cascade Province → Antenne → ZS → Aire).
      const patch: Partial<FilterValues> =
        field === "province" ? { province: null, antenne: null, zone: null, aire: null, org: null }
        : field === "antenne" ? { antenne: null, zone: null, aire: null, org: null }
        : field === "zone" ? { zone: null, aire: null, org: null }
        : field === "aire" ? { aire: null, org: null }
        : field === "months" ? { months: [] }
        : field === "at" ? { at: null }
        : field === "org" ? { org: null }
        : { types: [] };
      return { tabs: { ...s.tabs, [tab]: { ...cur, ...patch } } };
    }),
}));

/**
 * Accès aux filtres d'un onglet précis (valeurs + setters liés à cet onglet).
 * À utiliser par la barre de filtres et par les hooks de données de l'onglet.
 */
export function useTabFilters(tab: string): FilterValues & {
  set: (patch: Partial<FilterValues>) => void;
  reset: () => void;
  resetField: (field: FilterField) => void;
} {
  const values = useFiltersStore((s) => s.tabs[tab] ?? EMPTY_FILTERS);
  const set = useFiltersStore((s) => s.set);
  const reset = useFiltersStore((s) => s.reset);
  const resetField = useFiltersStore((s) => s.resetField);
  return {
    ...values,
    set: (patch) => set(tab, patch),
    reset: () => reset(tab),
    resetField: (field) => resetField(tab, field),
  };
}

export function filtersToQuery(f: FilterValues): string {
  const p = new URLSearchParams();
  if (f.province) p.set("province", f.province);
  if (f.antenne) p.set("antenne", f.antenne);
  if (f.zone) p.set("zone", f.zone);
  if (f.aire) p.set("aire", f.aire);
  if (f.months && f.months.length) p.set("months", f.months.join(","));
  if (f.types && f.types.length) p.set("types", f.types.join(","));
  if (f.at) p.set("at", f.at);
  const s = p.toString();
  return s ? `?${s}` : "";
}

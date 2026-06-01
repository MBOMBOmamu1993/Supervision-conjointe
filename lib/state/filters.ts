"use client";

import { create } from "zustand";

export interface FiltersState {
  province: string | null;
  antenne: string | null;
  zone: string | null;
  aire: string | null;
  /** Mois sélectionnés (ISO "YYYY-MM"), multi-sélection. */
  months: string[];
  /** Types de supervision sélectionnés (libellés bruts). */
  types: string[];
  set: (patch: Partial<Omit<FiltersState, "set" | "reset">>) => void;
  reset: () => void;
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

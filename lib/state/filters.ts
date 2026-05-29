"use client";

import { create } from "zustand";

export interface FiltersState {
  province: string | null;
  antenne: string | null;
  zone: string | null;
  aire: string | null;
  month: string | null;
  set: (patch: Partial<Omit<FiltersState, "set" | "reset">>) => void;
  reset: () => void;
}

export const useFilters = create<FiltersState>((set) => ({
  province: null,
  antenne: null,
  zone: null,
  aire: null,
  month: null,
  set: (patch) => set(patch),
  reset: () => set({ province: null, antenne: null, zone: null, aire: null, month: null }),
}));

export function filtersToQuery(f: Pick<FiltersState, "province" | "antenne" | "zone" | "aire" | "month">): string {
  const p = new URLSearchParams();
  if (f.province) p.set("province", f.province);
  if (f.antenne) p.set("antenne", f.antenne);
  if (f.zone) p.set("zone", f.zone);
  if (f.aire) p.set("aire", f.aire);
  if (f.month) p.set("month", f.month);
  const s = p.toString();
  return s ? `?${s}` : "";
}

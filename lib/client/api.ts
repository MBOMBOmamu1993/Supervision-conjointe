"use client";

import useSWR from "swr";
import type { SupervisionBundle } from "@/lib/supervision/types";
import { useTabFilters, filtersToQuery, orgLevelOf } from "@/lib/state/filters";

const fetcher = async (url: string): Promise<SupervisionBundle> => {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} — ${txt.slice(0, 200)}`);
  }
  return res.json();
};

export function useSupervision() {
  const filters = useTabFilters("supervision");
  // Sélecteur d'org unit (sous le titre des pages) : restreint la sélection à
  // UNE entité du niveau d'affichage courant SANS changer ce niveau — on le
  // traduit vers le filtre géographique du niveau correspondant.
  const effective = { ...filters };
  if (filters.org) {
    const lvl = orgLevelOf(filters);
    if (lvl === "antenne") effective.antenne = filters.org;
    else if (lvl === "zs") effective.zone = filters.org;
    else effective.aire = filters.org;
  }
  const url = `/api/supervision${filtersToQuery(effective)}`;
  const { data, error, isLoading, isValidating, mutate } = useSWR<SupervisionBundle>(url, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
    dedupingInterval: 60_000,
    errorRetryCount: 2,
  });
  return { data, error, isLoading, isValidating, refresh: mutate, hasData: !!data };
}

export async function triggerRefresh(): Promise<void> {
  await fetch("/api/supervision/refresh", { method: "POST" });
}

"use client";

import useSWR from "swr";
import type { DispoBundle } from "@/lib/dhis2/logistique";
import { useTabFilters, filtersToQuery } from "@/lib/state/filters";

const fetcher = async (url: string): Promise<DispoBundle> => {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} — ${txt.slice(0, 200)}`);
  }
  return res.json();
};

/**
 * Taux de disponibilité des vaccins PENTA / RR (logistique DHIS/SNIS Tshuapa,
 * situation 2026) — niveaux antenne et zones de santé. Branché sur les filtres
 * de l'onglet « Rapport mensuel des consultants » (antenne · période).
 */
export function useDhis2Logistique() {
  const filters = useTabFilters("rapport");
  const url = `/api/dhis2-logistique${filtersToQuery(filters)}`;
  const { data, error, isLoading } = useSWR<DispoBundle>(url, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
    dedupingInterval: 120_000,
  });
  return { data, error, isLoading };
}

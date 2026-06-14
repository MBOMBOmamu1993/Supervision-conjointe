"use client";

import useSWR from "swr";
import type { PrestationBundle } from "@/lib/dhis2/prestation";
import { useTabFilters, filtersToQuery } from "@/lib/state/filters";

const fetcher = async (url: string): Promise<PrestationBundle> => {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} — ${txt.slice(0, 200)}`);
  }
  return res.json();
};

/**
 * Prestation de services (DHIS2/SNIS Tshuapa) — séances planifiées/réalisées et
 * couvertures vaccinales pour les antennes de Boende et Bokungu. Branchée sur
 * les filtres de l'onglet « Rapport mensuel des consultants » (antenne · mois).
 */
export function useDhis2Prestation() {
  const filters = useTabFilters("rapport");
  const url = `/api/dhis2-prestation${filtersToQuery(filters)}`;
  const { data, error, isLoading } = useSWR<PrestationBundle>(url, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
    dedupingInterval: 120_000,
  });
  return { data, error, isLoading };
}

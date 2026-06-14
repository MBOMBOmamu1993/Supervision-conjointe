"use client";

import useSWR from "swr";
import type { TriBundle } from "@/lib/dhis2/triangulation";
import { useTabFilters, filtersToQuery } from "@/lib/state/filters";

const fetcher = async (url: string): Promise<TriBundle> => {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} — ${txt.slice(0, 200)}`);
  }
  return res.json();
};

/**
 * Triangulation « doses disponibles vs vaccinés » (DHIS2, Tshuapa) au niveau
 * AS ou ZS. Branchée sur les filtres de l'onglet « Contrôle qualité des
 * données » : antenne · ZS · aire · mois s'appliquent comme aux autres visuels.
 */
export function useTriangulation(level: "as" | "zs") {
  const filters = useTabFilters("qualite");
  const q = filtersToQuery(filters);
  const url = `/api/triangulation${q ? `${q}&level=${level}` : `?level=${level}`}`;
  const { data, error, isLoading } = useSWR<TriBundle>(url, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
    dedupingInterval: 120_000,
  });
  return { data, error, isLoading };
}

"use client";

import useSWR from "swr";
import type { RapportBundle, EvaluationBundle } from "@/lib/at/types";
import { useTabFilters, filtersToQuery } from "@/lib/state/filters";

interface AtResponse { rapport: RapportBundle; evaluation: EvaluationBundle }

const fetcher = async (url: string): Promise<AtResponse> => {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} — ${txt.slice(0, 200)}`);
  }
  return res.json();
};

/**
 * Données AT (temps réel) pour un onglet donné. `rapport` et `evaluation`
 * partagent la même source Kobo ; on segmente par onglet pour des filtres
 * cloisonnés (Antenne / AT / Période). `refresh` force une resynchronisation.
 */
function useAt(tab: "rapport" | "evaluation") {
  const filters = useTabFilters(tab);
  const url = `/api/at${filtersToQuery(filters)}`;
  const { data, error, isLoading, mutate } = useSWR<AtResponse>(url, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
    // Collecte continue → resynchronisation régulière (temps réel).
    refreshInterval: 60_000,
    dedupingInterval: 30_000,
  });
  const refresh = () => mutate(fetcher(`${url}${url.includes("?") ? "&" : "?"}force=1`), { revalidate: false });
  return { data, error, isLoading, refresh };
}

export function useRapportAt() {
  const { data, error, isLoading, refresh } = useAt("rapport");
  return { data: data?.rapport, error, isLoading, refresh };
}
export function useEvaluationAt() {
  const { data, error, isLoading, refresh } = useAt("evaluation");
  return { data: data?.evaluation, error, isLoading, refresh };
}

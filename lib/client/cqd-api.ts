"use client";

import useSWR from "swr";
import type { CqdBundle } from "@/lib/cqd/types";
import { useTabFilters, filtersToQuery } from "@/lib/state/filters";

const fetcher = async (url: string): Promise<CqdBundle> => {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} — ${txt.slice(0, 200)}`);
  }
  return res.json();
};

export function useCqd() {
  const filters = useTabFilters("qualite");
  const url = `/api/cqd${filtersToQuery(filters)}`;
  const { data, error, isLoading } = useSWR<CqdBundle>(url, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
    dedupingInterval: 60_000,
  });
  return { data, error, isLoading };
}

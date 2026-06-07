"use client";

import useSWR from "swr";
import type { SavBundle } from "@/lib/sav/types";
import { useTabFilters, filtersToQuery } from "@/lib/state/filters";

const fetcher = async (url: string): Promise<SavBundle> => {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} — ${txt.slice(0, 200)}`);
  }
  return res.json();
};

export function useSav() {
  const filters = useTabFilters("sav");
  const url = `/api/sav${filtersToQuery(filters)}`;
  const { data, error, isLoading, mutate } = useSWR<SavBundle>(url, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
    dedupingInterval: 60_000,
  });
  return { data, error, isLoading, refresh: () => mutate(fetcher(`${url}${url.includes("?") ? "&" : "?"}force=1`), { revalidate: false }) };
}

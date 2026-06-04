"use client";

import useSWR from "swr";
import type { RcmBundle } from "@/lib/rcm/types";
import { useFilters, filtersToQuery } from "@/lib/state/filters";

const fetcher = async (url: string): Promise<RcmBundle> => {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} — ${txt.slice(0, 200)}`);
  }
  return res.json();
};

export function useRcm() {
  const filters = useFilters();
  const url = `/api/rcm${filtersToQuery(filters)}`;
  const { data, error, isLoading } = useSWR<RcmBundle>(url, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
    dedupingInterval: 60_000,
  });
  return { data, error, isLoading };
}

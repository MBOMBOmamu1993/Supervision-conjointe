"use client";

import useSWR from "swr";
import type { SupervisionBundle } from "@/lib/supervision/types";
import { useTabFilters, filtersToQuery } from "@/lib/state/filters";

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
  const url = `/api/supervision${filtersToQuery(filters)}`;
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

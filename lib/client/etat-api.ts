"use client";

import useSWR from "swr";
import type { EtatBundle } from "@/lib/etat-lieux/types";

const fetcher = async (url: string): Promise<EtatBundle> => {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} — ${txt.slice(0, 200)}`);
  }
  return res.json();
};

export function useEtatLieux() {
  const { data, error, isLoading } = useSWR<EtatBundle>("/api/etat-lieux", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5 * 60_000,
  });
  return { data, error, isLoading };
}

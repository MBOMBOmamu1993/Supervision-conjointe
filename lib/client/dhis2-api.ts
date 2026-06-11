"use client";

import useSWR from "swr";
import type { Dhis2CvBundle } from "@/lib/dhis2/cv";

const fetcher = async (url: string): Promise<Dhis2CvBundle> => {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} — ${txt.slice(0, 200)}`);
  }
  return res.json();
};

/**
 * Couvertures administratives DHIS2 (mois de référence M-1/M-2) — Tshuapa.
 * `refDate` (ISO "YYYY-MM-DD") : date de réalisation du RCM servant de
 * référence au calcul du mois ; à défaut, la date du jour côté serveur.
 */
export function useDhis2Cv(refDate?: string | null) {
  const key = refDate ? `/api/dhis2-cv?ref=${encodeURIComponent(refDate)}` : "/api/dhis2-cv";
  const { data, error, isLoading } = useSWR<Dhis2CvBundle>(key, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
    dedupingInterval: 120_000,
  });
  return { data, error, isLoading };
}

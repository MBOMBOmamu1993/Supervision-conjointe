/**
 * Client KoboToolbox — formulaire « Rapport mensuel des AT » (asset
 * avvVUwZZwkg24iz2Ztj3wi). Source commune des onglets « Rapport mensuel des
 * consultants » et « Évaluation des consultants ».
 *
 * Collecte CONTINUE → données LIVE (`data.json`) prioritaires, repli sur
 * l'export XLSX figé. Cache mémoire `kobo:at` avec TTL court (temps réel).
 *
 * Ne JAMAIS importer côté client.
 */
import pRetry, { AbortError } from "p-retry";
import { ENV } from "@/lib/server/env";
import { AT_SOURCE, atExportUrl, atDataUrl } from "@/config/supervision.config";
import type { RawRow } from "@/lib/supervision/types";
import {
  fetchBuffer, parseXlsx, cacheGet, cacheGetStale, cacheSet, MAX_ATTEMPTS,
} from "@/lib/server/kobo-fetch";

export interface AtFetch { label: string; rows: RawRow[]; ok: boolean; error?: string }

/** Récupère le formulaire AT (data.json temps réel prioritaire, repli XLSX). */
export async function fetchAtSource(opts: { force?: boolean } = {}): Promise<AtFetch> {
  const cacheKey = "kobo:at";
  if (!opts.force) {
    const cached = cacheGet<AtFetch>(cacheKey, ENV.AT_CACHE_TTL_SECONDS);
    if (cached) return cached;
  }
  const exportUrl = atExportUrl(ENV.KOBO_BASE_URL);
  const dataUrl = atDataUrl(ENV.KOBO_BASE_URL) + "?limit=30000";
  try {
    const rows = await pRetry(
      async () => {
        try {
          const buf = await fetchBuffer(dataUrl, "application/json");
          const json = JSON.parse(new TextDecoder().decode(buf));
          const live = (Array.isArray(json) ? json : json.results ?? []) as RawRow[];
          if (live.length) return live;
          throw new Error("data.json vide → repli sur l'export XLSX");
        } catch (e) {
          if (e instanceof AbortError) throw e;
          return parseXlsx(await fetchBuffer(exportUrl, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        }
      },
      { retries: MAX_ATTEMPTS - 1, minTimeout: 1000, maxTimeout: 4000 }
    );
    const result: AtFetch = { label: AT_SOURCE.label, rows, ok: true };
    cacheSet(cacheKey, result);
    return result;
  } catch (err) {
    const stale = cacheGetStale<AtFetch>(cacheKey);
    if (stale) return stale;
    // Formulaire sans données / Kobo indisponible : pipeline prêt, visuels vides.
    return { label: AT_SOURCE.label, rows: [], ok: true, error: err instanceof Error ? err.message : String(err) };
  }
}

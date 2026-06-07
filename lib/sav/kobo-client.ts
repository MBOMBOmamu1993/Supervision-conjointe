/**
 * Client KoboToolbox — formulaires SAV (Semaine Africaine de Vaccination).
 *
 * L'activité SAV est terminée : l'export XLSX figé reflète l'intégralité des
 * soumissions → il est prioritaire, avec repli sur `data.json`. Cache mémoire
 * par source (`kobo:sav:<key>`) + repli « stale ». Une source « BASE SAISIE
 * DONNEES SAV » (Google Sheet publié en CSV) alimente les ventilations par
 * antigène × tranche d'âge ; si l'URL n'est pas fournie, on logue un
 * avertissement et le rendu se replie sur les exports Kobo.
 *
 * Ne JAMAIS importer côté client.
 */
import pRetry, { AbortError } from "p-retry";
import { ENV } from "@/lib/server/env";
import {
  SAV_SOURCES, savExportUrl, savDataUrl, type SavSource,
} from "@/config/supervision.config";
import type { RawRow } from "@/lib/supervision/types";
import {
  fetchBuffer, parseXlsx, parseCsv, cacheGet, cacheGetStale, cacheSet, MAX_ATTEMPTS,
} from "@/lib/server/kobo-fetch";

export interface SavFetch { key: string; label: string; rows: RawRow[]; ok: boolean; error?: string }

async function fetchSavXlsx(src: SavSource): Promise<RawRow[]> {
  const buf = await fetchBuffer(savExportUrl(src, ENV.KOBO_BASE_URL), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  return parseXlsx(buf);
}
async function fetchSavJson(src: SavSource): Promise<RawRow[]> {
  const buf = await fetchBuffer(savDataUrl(src, ENV.KOBO_BASE_URL) + "?limit=30000", "application/json");
  const json = JSON.parse(new TextDecoder().decode(buf));
  return (Array.isArray(json) ? json : json.results ?? []) as RawRow[];
}

/** Récupère une source SAV (XLSX figé prioritaire, repli JSON) avec retry + cache. */
export async function fetchSavSource(src: SavSource, opts: { force?: boolean } = {}): Promise<SavFetch> {
  const cacheKey = `kobo:sav:${src.key}`;
  if (!opts.force) {
    const cached = cacheGet<SavFetch>(cacheKey);
    if (cached) return cached;
  }
  try {
    const rows = await pRetry(
      async () => {
        try {
          return await fetchSavXlsx(src);
        } catch (e) {
          if (e instanceof AbortError) throw e;
          return await fetchSavJson(src);
        }
      },
      { retries: MAX_ATTEMPTS - 1, minTimeout: 1000, maxTimeout: 4000 }
    );
    const result: SavFetch = { key: src.key, label: src.label, rows, ok: true };
    cacheSet(cacheKey, result);
    return result;
  } catch (err) {
    const stale = cacheGetStale<SavFetch>(cacheKey);
    if (stale) return stale;
    return { key: src.key, label: src.label, rows: [], ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Récupère les 5 sources SAV en parallèle. */
export async function fetchAllSavSources(opts: { force?: boolean } = {}): Promise<SavFetch[]> {
  return Promise.all(SAV_SOURCES.map((s) => fetchSavSource(s, opts)));
}

export interface BaseSaisieFetch { configured: boolean; rows: RawRow[]; ok: boolean; error?: string }

/**
 * Récupère la « BASE SAISIE DONNEES SAV » (Google Sheet publié en CSV).
 * Si `SAV_BASE_SAISIE_CSV_URL` est vide → repli silencieux (configured=false) :
 * les analyses « Drive » sont alors dérivées des exports Kobo SAV.
 */
export async function fetchBaseSaisieSav(opts: { force?: boolean } = {}): Promise<BaseSaisieFetch> {
  const url = ENV.SAV_BASE_SAISIE_CSV_URL;
  if (!url) {
    console.warn("[sav] SAV_BASE_SAISIE_CSV_URL non défini — repli sur les exports Kobo pour les ventilations par antigène.");
    return { configured: false, rows: [], ok: false };
  }
  const cacheKey = "sheet:sav-base";
  if (!opts.force) {
    const cached = cacheGet<BaseSaisieFetch>(cacheKey);
    if (cached) return cached;
  }
  try {
    const rows = await pRetry(
      async () => parseCsv(await fetchBuffer(url, "text/csv", false)),
      { retries: MAX_ATTEMPTS - 1, minTimeout: 1000, maxTimeout: 4000 }
    );
    const result: BaseSaisieFetch = { configured: true, rows, ok: true };
    cacheSet(cacheKey, result);
    return result;
  } catch (err) {
    const stale = cacheGetStale<BaseSaisieFetch>(cacheKey);
    if (stale) return stale;
    return { configured: true, rows: [], ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

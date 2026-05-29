/**
 * Client KoboToolbox — récupère les données des 3 formulaires de supervision.
 *
 * Stratégie :
 *  1. Télécharge l'export XLSX figé (data.xlsx) et le parse avec SheetJS.
 *  2. En cas d'échec (export indisponible / 404), bascule sur l'API JSON
 *     /data.json (données brutes).
 *  3. Cache mémoire avec TTL → le dashboard reste réactif et se resynchronise
 *     automatiquement à l'expiration (ou via /api/supervision/refresh).
 *
 * Ne JAMAIS importer côté client : utilise les credentials (token / basic).
 */
import pRetry, { AbortError } from "p-retry";
import * as XLSX from "xlsx";
import { ENV, koboAuthHeader } from "@/lib/server/env";
import {
  KOBO_SOURCES,
  koboExportUrl,
  koboDataUrl,
  type KoboSource,
  type StructureLevel,
} from "@/config/supervision.config";
import type { RawRow } from "./types";

type CacheEntry<T> = { at: number; value: T };
const memCache = new Map<string, CacheEntry<unknown>>();

const PER_REQUEST_TIMEOUT_MS = 45_000;
const MAX_ATTEMPTS = 3;

function cacheGet<T>(key: string, ttlSec = ENV.CACHE_TTL_SECONDS): T | null {
  const hit = memCache.get(key) as CacheEntry<T> | undefined;
  if (!hit) return null;
  if ((Date.now() - hit.at) / 1000 > ttlSec) return null;
  return hit.value;
}
function cacheGetStale<T>(key: string): T | null {
  return (memCache.get(key) as CacheEntry<T> | undefined)?.value ?? null;
}
function cacheSet<T>(key: string, value: T): void {
  memCache.set(key, { at: Date.now(), value });
}

async function fetchBuffer(url: string, accept: string): Promise<ArrayBuffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: accept, "User-Agent": "SupervisionConjointe/1.0", ...koboAuthHeader() },
      cache: "no-store",
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      if (res.status === 401 || res.status === 403) {
        throw new AbortError(`Kobo ${res.status} ${res.statusText} — ${url} — ${txt.slice(0, 160)}`);
      }
      throw new Error(`Kobo ${res.status} ${res.statusText} — ${url}`);
    }
    return await res.arrayBuffer();
  } finally {
    clearTimeout(timer);
  }
}

/** Parse un buffer XLSX → lignes JSON (objets clé=libellé de colonne). */
function parseXlsx(buf: ArrayBuffer): RawRow[] {
  const wb = XLSX.read(buf, { type: "array" });
  // La feuille de données principale est généralement la première ; on prend
  // celle qui contient le plus de lignes pour être robuste.
  let best: RawRow[] = [];
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<RawRow>(wb.Sheets[name], { defval: null, raw: false });
    if (rows.length > best.length) best = rows;
  }
  return best;
}

async function fetchSourceXlsx(src: KoboSource): Promise<RawRow[]> {
  const url = koboExportUrl(src, ENV.KOBO_BASE_URL);
  const buf = await fetchBuffer(url, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  return parseXlsx(buf);
}

async function fetchSourceJson(src: KoboSource): Promise<RawRow[]> {
  const url = koboDataUrl(src, ENV.KOBO_BASE_URL) + "?limit=30000";
  const buf = await fetchBuffer(url, "application/json");
  const text = new TextDecoder().decode(buf);
  const json = JSON.parse(text);
  const results = Array.isArray(json) ? json : json.results ?? [];
  return results as RawRow[];
}

export interface SourceFetch {
  level: StructureLevel;
  label: string;
  rows: RawRow[];
  ok: boolean;
  error?: string;
}

/** Récupère une source (XLSX puis fallback JSON) avec retry + cache. */
export async function fetchSource(src: KoboSource, opts: { force?: boolean } = {}): Promise<SourceFetch> {
  const cacheKey = `kobo:${src.key}`;
  if (!opts.force) {
    const cached = cacheGet<SourceFetch>(cacheKey);
    if (cached) return cached;
  }
  try {
    const rows = await pRetry(
      async () => {
        try {
          return await fetchSourceXlsx(src);
        } catch (e) {
          if (e instanceof AbortError) throw e; // auth → ne pas réessayer en JSON
          // Fallback JSON (export XLSX peut-être non régénéré côté Kobo)
          return await fetchSourceJson(src);
        }
      },
      { retries: MAX_ATTEMPTS - 1, minTimeout: 1000, maxTimeout: 4000 }
    );
    const result: SourceFetch = { level: src.key, label: src.label, rows, ok: true };
    cacheSet(cacheKey, result);
    return result;
  } catch (err) {
    const stale = cacheGetStale<SourceFetch>(cacheKey);
    if (stale) return stale;
    return {
      level: src.key,
      label: src.label,
      rows: [],
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Récupère les 3 sources en parallèle. */
export async function fetchAllSources(opts: { force?: boolean } = {}): Promise<SourceFetch[]> {
  return Promise.all(KOBO_SOURCES.map((s) => fetchSource(s, opts)));
}

export function flushKoboCache(): void {
  memCache.clear();
}

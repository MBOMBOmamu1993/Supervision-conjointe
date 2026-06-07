/**
 * Helpers serveur partagés pour la récupération KoboToolbox / Google Sheet :
 * fetch authentifié avec timeout, parse XLSX (SheetJS), parse CSV, et cache
 * mémoire avec TTL + repli « stale ». Repris de `lib/supervision/kobo-client.ts`
 * pour être réutilisé par les onglets SAV et AT sans dupliquer la logique.
 *
 * Ne JAMAIS importer côté client : utilise les credentials Kobo.
 */
import { AbortError } from "p-retry";
import * as XLSX from "xlsx";
import { ENV, koboAuthHeader } from "@/lib/server/env";
import type { RawRow } from "@/lib/supervision/types";

export const PER_REQUEST_TIMEOUT_MS = 45_000;
export const MAX_ATTEMPTS = 3;

type CacheEntry<T> = { at: number; value: T };
const memCache = new Map<string, CacheEntry<unknown>>();

export function cacheGet<T>(key: string, ttlSec = ENV.CACHE_TTL_SECONDS): T | null {
  const hit = memCache.get(key) as CacheEntry<T> | undefined;
  if (!hit) return null;
  if ((Date.now() - hit.at) / 1000 > ttlSec) return null;
  return hit.value;
}
export function cacheGetStale<T>(key: string): T | null {
  return (memCache.get(key) as CacheEntry<T> | undefined)?.value ?? null;
}
export function cacheSet<T>(key: string, value: T): void {
  memCache.set(key, { at: Date.now(), value });
}
export function flushSharedCache(): void {
  memCache.clear();
}

/** Fetch authentifié Kobo avec timeout ; 401/403 → AbortError (pas de retry). */
export async function fetchBuffer(url: string, accept: string, withAuth = true): Promise<ArrayBuffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: accept, "User-Agent": "SupervisionConjointe/1.0", ...(withAuth ? koboAuthHeader() : {}) },
      cache: "no-store",
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      if (res.status === 401 || res.status === 403) {
        throw new AbortError(`Kobo ${res.status} ${res.statusText} — ${url} — ${txt.slice(0, 160)}`);
      }
      throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}`);
    }
    return await res.arrayBuffer();
  } finally {
    clearTimeout(timer);
  }
}

/** Parse un buffer XLSX → lignes JSON (clé = libellé de colonne) ; feuille la plus fournie. */
export function parseXlsx(buf: ArrayBuffer): RawRow[] {
  const wb = XLSX.read(buf, { type: "array" });
  let best: RawRow[] = [];
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<RawRow>(wb.Sheets[name], { defval: null, raw: false });
    if (rows.length > best.length) best = rows;
  }
  return best;
}

/** Parse un CSV (Google Sheet publié) → lignes JSON via SheetJS. */
export function parseCsv(buf: ArrayBuffer): RawRow[] {
  const text = new TextDecoder("utf-8").decode(buf);
  const wb = XLSX.read(text, { type: "string" });
  const first = wb.SheetNames[0];
  if (!first) return [];
  return XLSX.utils.sheet_to_json<RawRow>(wb.Sheets[first], { defval: null, raw: false });
}

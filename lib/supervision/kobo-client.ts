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
  CQD_SOURCES,
  RCM_SOURCE,
  koboExportUrl,
  koboDataUrl,
  type KoboSource,
  type CqdSource,
  type StructureLevel,
} from "@/config/supervision.config";
import type { RawRow } from "./types";
import { CS_SEED_ROWS } from "@/data/supervision-cs-seed";
import { detectScoreQuestions, getColumns } from "./schema";

/** Vrai si les lignes exposent au moins une question notée (colonnes score/max). */
function hasScoreQuestions(rows: RawRow[]): boolean {
  return rows.length > 0 && detectScoreQuestions(getColumns(rows)).length > 0;
}

type CacheEntry<T> = { at: number; value: T };
const memCache = new Map<string, CacheEntry<unknown>>();

/**
 * Fusionne les soumissions « Centre de santé » migrées localement (anciennes
 * données conjointes, antérieures au champ « Type de supervision ») avec les
 * lignes live de Kobo. Dédoublonnage par _uuid : si la migration côté Kobo a
 * lieu plus tard, les doublons sont automatiquement écartés.
 */
function mergeCsSeed(level: StructureLevel, rows: RawRow[]): RawRow[] {
  if (level !== "as" || CS_SEED_ROWS.length === 0) return rows;
  const present = new Set(rows.map((r) => String(r["_uuid"] ?? "")).filter(Boolean));
  const extra = CS_SEED_ROWS.filter((s) => !present.has(String(s["_uuid"] ?? "")));
  return extra.length ? rows.concat(extra) : rows;
}

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

/**
 * Fusionne les lignes de l'export XLSX figé et du data.json live, dédoublonnées
 * par `_uuid`. L'export-setting XLSX d'un formulaire n'est PAS régénéré à
 * chaque soumission : les soumissions récentes (ex. ZS Boende) peuvent en être
 * absentes alors qu'elles existent dans data.json — et inversement, le live
 * peut perdre des colonnes score/max si le formulaire a été re-déployé. On
 * prend comme base la source qui expose les questions notées (préférence au
 * live, plus complet), puis on ajoute les soumissions de l'autre source qui
 * manquent (les deux formats de colonnes cohabitent sans conflit : la
 * détection score/max travaille sur la feuille du nom de colonne).
 */
function mergeSourceRows(xlsx: RawRow[] | null, live: RawRow[] | null): RawRow[] {
  if (!xlsx && !live) return [];
  if (!xlsx) return live!;
  if (!live) return xlsx;
  const uuidOf = (r: RawRow) => String(r["_uuid"] ?? "");
  const liveScored = hasScoreQuestions(live);
  const xlsxScored = hasScoreQuestions(xlsx);
  const [base, extra] = liveScored || !xlsxScored ? [live, xlsx] : [xlsx, live];
  const present = new Set(base.map(uuidOf).filter(Boolean));
  const added = extra.filter((r) => { const u = uuidOf(r); return u !== "" && !present.has(u); });
  return added.length ? base.concat(added) : base;
}

/** Récupère une source (fusion XLSX + data.json par _uuid) avec retry + cache. */
export async function fetchSource(src: KoboSource, opts: { force?: boolean } = {}): Promise<SourceFetch> {
  const cacheKey = `kobo:${src.key}`;
  if (!opts.force) {
    const cached = cacheGet<SourceFetch>(cacheKey);
    if (cached) return cached;
  }
  try {
    const rows = await pRetry(
      async () => {
        // Les deux sources sont interrogées en parallèle puis fusionnées par
        // _uuid : ni l'export XLSX figé (souvent en retard sur les nouvelles
        // soumissions), ni le data.json live (parfois sans les colonnes
        // score/max attendues) n'est exhaustif seul.
        const [xlsxRes, liveRes] = await Promise.allSettled([fetchSourceXlsx(src), fetchSourceJson(src)]);
        if (xlsxRes.status === "rejected" && xlsxRes.reason instanceof AbortError) throw xlsxRes.reason;
        if (liveRes.status === "rejected" && liveRes.reason instanceof AbortError) throw liveRes.reason;
        const xlsx = xlsxRes.status === "fulfilled" ? xlsxRes.value : null;
        const live = liveRes.status === "fulfilled" ? liveRes.value : null;
        if (!xlsx && !live) {
          throw (xlsxRes.status === "rejected" ? xlsxRes.reason : (liveRes as PromiseRejectedResult).reason);
        }
        return mergeSourceRows(xlsx, live);
      },
      { retries: MAX_ATTEMPTS - 1, minTimeout: 1000, maxTimeout: 4000 }
    );
    // ANCIEN formulaire du même niveau (asset legacy) : ses soumissions sont
    // récupérées via l'API et ajoutées si absentes (dédoublonnage par _uuid).
    // Un échec sur le legacy ne casse jamais la source principale.
    let merged = rows;
    if (src.legacy) {
      try {
        const legacySrc: KoboSource = {
          key: src.key,
          label: `${src.label} (ancien formulaire)`,
          assetUid: src.legacy.assetUid,
          exportUid: src.legacy.exportUid ?? "",
        };
        const [lx, lj] = await Promise.allSettled([
          src.legacy.exportUid ? fetchSourceXlsx(legacySrc) : Promise.reject(new Error("pas d'export XLSX legacy")),
          fetchSourceJson(legacySrc),
        ]);
        const legacyRows = mergeSourceRows(
          lx.status === "fulfilled" ? lx.value : null,
          lj.status === "fulfilled" ? lj.value : null
        );
        if (legacyRows.length) {
          const present = new Set(merged.map((r) => String(r["_uuid"] ?? "")).filter(Boolean));
          const extra = legacyRows.filter((r) => {
            const u = String(r["_uuid"] ?? "");
            return u !== "" && !present.has(u);
          });
          if (extra.length) merged = merged.concat(extra);
        }
      } catch {
        /* legacy indisponible : on garde la source principale + le seed local */
      }
    }
    const result: SourceFetch = { level: src.key, label: src.label, rows: mergeCsSeed(src.key, merged), ok: true };
    cacheSet(cacheKey, result);
    return result;
  } catch (err) {
    const stale = cacheGetStale<SourceFetch>(cacheKey);
    if (stale) return stale;
    // Hors-ligne / Kobo indisponible : on expose au moins les données migrées.
    const seeded = mergeCsSeed(src.key, []);
    return {
      level: src.key,
      label: src.label,
      rows: seeded,
      ok: seeded.length > 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Récupère les 3 sources en parallèle. */
export async function fetchAllSources(opts: { force?: boolean } = {}): Promise<SourceFetch[]> {
  return Promise.all(KOBO_SOURCES.map((s) => fetchSource(s, opts)));
}

/* ----------------------- Sources CQD (Qualité des données) ----------------------- */

export interface CqdFetch {
  key: "zs" | "as";
  label: string;
  rows: RawRow[];
  ok: boolean;
  error?: string;
}

export async function fetchCqdSource(src: CqdSource, opts: { force?: boolean } = {}): Promise<CqdFetch> {
  const cacheKey = `kobo:cqd:${src.key}`;
  if (!opts.force) {
    const cached = cacheGet<CqdFetch>(cacheKey);
    if (cached) return cached;
  }
  const exportUrl = koboExportUrl(src, ENV.KOBO_BASE_URL);
  const dataUrl = koboDataUrl(src, ENV.KOBO_BASE_URL) + "?limit=30000";
  try {
    const rows = await pRetry(
      async () => {
        // FUSION data.json live + export XLSX figé (dédoublonnage par _uuid) :
        // le live (noms techniques) est complet et prioritaire, mais l'export
        // XLSX « toutes versions » peut contenir d'anciennes soumissions
        // (anciennes versions du formulaire) absentes d'un côté — on ne perd
        // aucun contrôle qualité.
        const [liveRes, xlsxRes] = await Promise.allSettled([
          (async () => {
            const buf = await fetchBuffer(dataUrl, "application/json");
            const json = JSON.parse(new TextDecoder().decode(buf));
            return (Array.isArray(json) ? json : json.results ?? []) as RawRow[];
          })(),
          (async () => {
            const buf = await fetchBuffer(exportUrl, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            return parseXlsx(buf);
          })(),
        ]);
        if (liveRes.status === "rejected" && liveRes.reason instanceof AbortError) throw liveRes.reason;
        if (xlsxRes.status === "rejected" && xlsxRes.reason instanceof AbortError) throw xlsxRes.reason;
        const live = liveRes.status === "fulfilled" ? liveRes.value : null;
        const xlsx = xlsxRes.status === "fulfilled" ? xlsxRes.value : null;
        if (!live && !xlsx) {
          throw (liveRes.status === "rejected" ? liveRes.reason : (xlsxRes as PromiseRejectedResult).reason);
        }
        if (!live || live.length === 0) return xlsx ?? [];
        if (!xlsx || xlsx.length === 0) return live;
        const present = new Set(live.map((r) => String(r["_uuid"] ?? "")).filter(Boolean));
        const extra = xlsx.filter((r) => {
          const u = String(r["_uuid"] ?? "");
          return u !== "" && !present.has(u);
        });
        return extra.length ? live.concat(extra) : live;
      },
      { retries: MAX_ATTEMPTS - 1, minTimeout: 1000, maxTimeout: 4000 }
    );
    const result: CqdFetch = { key: src.key, label: src.label, rows, ok: true };
    cacheSet(cacheKey, result);
    return result;
  } catch (err) {
    const stale = cacheGetStale<CqdFetch>(cacheKey);
    if (stale) return stale;
    return { key: src.key, label: src.label, rows: [], ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function fetchAllCqdSources(opts: { force?: boolean } = {}): Promise<CqdFetch[]> {
  return Promise.all(CQD_SOURCES.map((s) => fetchCqdSource(s, opts)));
}

/* ----------------------- Source RCM (Monitorage rapide de convenance) ----------------------- */

export interface RcmFetch {
  label: string;
  rows: RawRow[];
  ok: boolean;
  error?: string;
}

/**
 * Récupère le formulaire RCM. Données LIVE (data.json, repeats imbriqués)
 * prioritaires car elles conservent la structure `menage → enfant` nécessaire
 * à l'agrégation au niveau enfant ; repli sur l'export XLSX figé. Le formulaire
 * peut être vide (aucune soumission) — on renvoie alors `rows: []`.
 */
export async function fetchRcmSource(opts: { force?: boolean } = {}): Promise<RcmFetch> {
  const cacheKey = "kobo:rcm";
  if (!opts.force) {
    const cached = cacheGet<RcmFetch>(cacheKey);
    if (cached) return cached;
  }
  const exportUrl = koboExportUrl(RCM_SOURCE, ENV.KOBO_BASE_URL);
  const dataUrl = koboDataUrl(RCM_SOURCE, ENV.KOBO_BASE_URL) + "?limit=30000";
  try {
    const rows = await pRetry(
      async () => {
        try {
          const buf = await fetchBuffer(dataUrl, "application/json");
          const json = JSON.parse(new TextDecoder().decode(buf));
          return (Array.isArray(json) ? json : json.results ?? []) as RawRow[];
        } catch (e) {
          if (e instanceof AbortError) throw e;
          const buf = await fetchBuffer(exportUrl, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
          return parseXlsx(buf);
        }
      },
      { retries: MAX_ATTEMPTS - 1, minTimeout: 1000, maxTimeout: 4000 }
    );
    const result: RcmFetch = { label: RCM_SOURCE.label, rows, ok: true };
    cacheSet(cacheKey, result);
    return result;
  } catch (err) {
    const stale = cacheGetStale<RcmFetch>(cacheKey);
    if (stale) return stale;
    // Formulaire sans données / Kobo indisponible : pipeline prêt, visuels vides.
    return { label: RCM_SOURCE.label, rows: [], ok: true, error: err instanceof Error ? err.message : String(err) };
  }
}

export function flushKoboCache(): void {
  memCache.clear();
}

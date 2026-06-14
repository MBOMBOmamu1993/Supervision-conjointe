/**
 * Helpers PARTAGÉS d'accès aux données DHIS2/SNIS publiées par le pipeline
 * GitHub Actions du repo public MBOMBOmamu1993/snis-vaccination-api
 * (GitHub Pages → dossier docs/). Mutualisé par les modules « triangulation »
 * (doses disponibles vs vaccinés) et « prestation » (sessions + CV).
 *
 * Pas de credentials (Pages public). Cache mémoire TTL géré par chaque module.
 * Ne JAMAIS importer côté client (gzip node:zlib).
 */
import { gunzipSync } from "node:zlib";

export const PAGES_BASE = "https://mbombomamu1993.github.io/snis-vaccination-api";
export const RAW_BASE = "https://raw.githubusercontent.com/MBOMBOmamu1993/snis-vaccination-api/main/docs";

/** Clé de la province Tshuapa dans les manifests / agrégats du repo. */
export const TSHUAPA_PROVINCE_KEY = "tu Tshuapa Province";
/** Fichier d'agrégat par AIRE DE SANTÉ (1 enregistrement = 1 AS × 1 mois). */
export const TSHUAPA_BY_AS_FILE = "tu_tshuapa_province.json.gz";

/** Conversion numérique tolérante (chaînes, null, NaN → 0). */
export const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};

export const isoToYm = (iso: string) => iso.replace("-", "");
export const ymToIso = (ym: string) => `${ym.slice(0, 4)}-${ym.slice(4, 6)}`;

/**
 * Récupère un JSON gzippé publié sur GitHub Pages (repli raw.githubusercontent
 * si Pages indisponible). Détecte le magic gzip (Pages peut déjà décompresser
 * via Content-Encoding).
 */
export async function fetchGzJson<T>(path: string): Promise<T> {
  let lastErr: unknown = null;
  for (const base of [PAGES_BASE, RAW_BASE]) {
    try {
      const res = await fetch(`${base}/${path}`, {
        headers: { "User-Agent": "SupervisionConjointe/1.0" },
        cache: "no-store",
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} — ${base}/${path}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const text = buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf).toString("utf8") : buf.toString("utf8");
      return JSON.parse(text) as T;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/**
 * Charge l'agrégat « by_as » de Tshuapa (1 enregistrement = 1 aire de santé ×
 * 1 mois), incluant doses de vaccination, données de stock, séances et
 * population. Source unique réutilisable pour la triangulation (AS et ZS, par
 * agrégation) et la prestation de services.
 */
export async function fetchTshuapaByAs<T = Record<string, unknown>>(): Promise<T[]> {
  const manifest = await fetchGzJson<Record<string, string>>("data_as/dashboard/by_as/manifest.json.gz");
  const file = manifest[TSHUAPA_PROVINCE_KEY] ?? TSHUAPA_BY_AS_FILE;
  return fetchGzJson<T[]>(`data_as/dashboard/by_as/${file}`);
}

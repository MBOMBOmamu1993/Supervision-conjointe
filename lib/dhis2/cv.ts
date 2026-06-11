/**
 * Couvertures vaccinales ADMINISTRATIVES (DHIS2/SNIS) par aire de santé —
 * source : repo public MBOMBOmamu1993/snis-vaccination-api (pipeline GitHub
 * Actions → données statiques publiées sur GitHub Pages, dossier docs/).
 *
 * On consomme les agrégats « dashboard » par AS de la province Tshuapa
 * (data_as/dashboard/by_as/…json.gz : 1 enregistrement = 1 AS × 1 mois, clés
 * _Province/_Antenne/_ZS/_AS/_YM + doses par antigène + Pop_par_AS), et on
 * réplique la formule de CV du dashboard de ce repo :
 *
 *   cible NS mensuelle = Pop_par_AS × 3,49 % / 12   (nourrissons survivants)
 *   CV (%)             = doses du mois / cible NS mensuelle × 100
 *
 * Antigènes (libellés DHIS2) : PENTA1 = DTC1 (0-11), PENTA3 = DTC3 (0-11),
 * RR1 = VAR1 (0-11), RR2 = VAR2 (12-23) — cohérent avec docs/index.html.
 *
 * Pas de credentials (Pages public). Cache mémoire TTL, repli
 * raw.githubusercontent.com si Pages indisponible. Ne JAMAIS importer côté
 * client (gzip node:zlib).
 */
import { gunzipSync } from "node:zlib";
import { ENV } from "@/lib/server/env";

const PAGES_BASE = "https://mbombomamu1993.github.io/snis-vaccination-api";
const RAW_BASE = "https://raw.githubusercontent.com/MBOMBOmamu1993/snis-vaccination-api/main/docs";
const PROVINCE_KEY = "tu Tshuapa Province";

/** Taux annuel « nourrissons survivants » (PEV-RDC) — cf. snis-vaccination-api. */
const NS_RATE = 0.0349;

export interface Dhis2AsCv {
  /** Nom d'AS nettoyé (« tu Bekiri Aire de Santé » → « Bekiri »). */
  name: string;
  zone: string | null;
  antenne: string | null;
  pop: number;
  /** CV administratives (%) du mois de référence. */
  cv: { penta1: number | null; penta3: number | null; rr1: number | null; rr2: number | null };
  /** Doses brutes (utile au débogage / export). */
  doses: { penta1: number; penta3: number; rr1: number; rr2: number };
}

export interface Dhis2CvBundle {
  /** Mois de référence effectif (ISO "YYYY-MM"). */
  month: string;
  /** Mois demandé par la règle M-1/M-2 (peut différer si non encore publié). */
  requestedMonth: string;
  /** Vrai si on a dû reculer d'un mois supplémentaire (données non publiées). */
  fallbackUsed: boolean;
  generatedAt: string;
  aires: Dhis2AsCv[];
  error?: string;
}

type CacheEntry = { at: number; value: Dhis2CvBundle };
const cache = new Map<string, CacheEntry>();

/**
 * Règle du mois de référence (feedback TL) : avant le 20 du mois de référence →
 * M-2 ; à partir du 20 → M-1. Renvoie "YYYY-MM". La date de référence est la
 * date de réalisation du RCM quand elle est connue (sinon la date du jour).
 */
export function referenceMonth(refDate = new Date()): string {
  const back = refDate.getDate() < 20 ? 2 : 1;
  const d = new Date(refDate.getFullYear(), refDate.getMonth() - back, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const isoToYm = (iso: string) => iso.replace("-", "");
const ymToIso = (ym: string) => `${ym.slice(0, 4)}-${ym.slice(4, 6)}`;
function prevIsoMonth(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function fetchGzJson<T>(path: string): Promise<T> {
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
      // Pages peut déjà décompresser via Content-Encoding ; on détecte le magic gzip.
      const text = buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf).toString("utf8") : buf.toString("utf8");
      return JSON.parse(text) as T;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** « tu Bekiri Aire de Santé » → « Bekiri » (espaces insécables compris). */
function cleanOrgName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return String(raw)
    .replace(/ /g, " ")
    .replace(/^[a-z]{2}\s+/i, "")
    .replace(/\s+(aire|zone)\s+de\s+sant[ée]\s*$/i, "")
    .replace(/\s+province\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim() || null;
}

interface RawDashRec {
  _Province?: string;
  _Antenne?: string;
  _ZS?: string;
  _AS?: string;
  _YM?: string;
  Pop_par_AS?: number;
  DTC1_0_11?: number;
  DTC3_0_11?: number;
  VAR1_0_11?: number;
  VAR2_12_23?: number;
  [k: string]: unknown;
}

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};

function buildBundle(recs: RawDashRec[], requestedIso: string): Dhis2CvBundle {
  // Mois de référence effectif : le mois demandé s'il est publié (au moins une
  // ligne avec des doses), sinon on recule jusqu'à trouver un mois publié.
  const byYm = new Map<string, RawDashRec[]>();
  for (const r of recs) {
    const ym = String(r._YM ?? "");
    if (!ym) continue;
    if (!byYm.has(ym)) byYm.set(ym, []);
    byYm.get(ym)!.push(r);
  }
  const hasData = (iso: string) => {
    const rows = byYm.get(isoToYm(iso)) ?? [];
    return rows.some((r) => num(r.DTC1_0_11) > 0 || num(r.DTC3_0_11) > 0 || num(r.VAR1_0_11) > 0);
  };
  let effective = requestedIso;
  let fallbackUsed = false;
  for (let i = 0; i < 6 && !hasData(effective); i++) {
    effective = prevIsoMonth(effective);
    fallbackUsed = true;
  }

  const monthRecs = byYm.get(isoToYm(effective)) ?? [];
  const aires: Dhis2AsCv[] = monthRecs
    .map((r) => {
      const pop = num(r.Pop_par_AS);
      const cibleMensuelle = (pop * NS_RATE) / 12;
      const doses = {
        penta1: num(r.DTC1_0_11),
        penta3: num(r.DTC3_0_11),
        rr1: num(r.VAR1_0_11),
        rr2: num(r.VAR2_12_23),
      };
      const cvOf = (d: number) => (cibleMensuelle > 0 ? Math.round((d / cibleMensuelle) * 1000) / 10 : null);
      return {
        name: cleanOrgName(r._AS) ?? "—",
        zone: cleanOrgName(r._ZS),
        antenne: r._Antenne ? String(r._Antenne) : null,
        pop,
        cv: { penta1: cvOf(doses.penta1), penta3: cvOf(doses.penta3), rr1: cvOf(doses.rr1), rr2: cvOf(doses.rr2) },
        doses,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  return {
    month: effective,
    requestedMonth: requestedIso,
    fallbackUsed,
    generatedAt: new Date().toISOString(),
    aires,
  };
}

/**
 * Récupère (avec cache TTL par mois demandé) les CV administratives Tshuapa du
 * mois de référence. `refDate` (ISO "YYYY-MM-DD") = date de réalisation du RCM ;
 * à défaut, la date du jour.
 */
export async function fetchDhis2Cv(opts: { force?: boolean; refDate?: string } = {}): Promise<Dhis2CvBundle> {
  const parsed = opts.refDate ? new Date(`${opts.refDate}T12:00:00`) : new Date();
  const requested = referenceMonth(Number.isNaN(parsed.getTime()) ? new Date() : parsed);
  const hit = cache.get(requested);
  if (!opts.force && hit && (Date.now() - hit.at) / 1000 < ENV.CACHE_TTL_SECONDS) return hit.value;
  try {
    const manifest = await fetchGzJson<Record<string, string>>("data_as/dashboard/by_as/manifest.json.gz");
    const file = manifest[PROVINCE_KEY];
    if (!file) throw new Error(`Province « ${PROVINCE_KEY} » absente du manifest by_as`);
    const recs = await fetchGzJson<RawDashRec[]>(`data_as/dashboard/by_as/${file}`);
    const bundle = buildBundle(recs, requested);
    cache.set(requested, { at: Date.now(), value: bundle });
    return bundle;
  } catch (err) {
    if (hit) return hit.value; // données périmées plutôt que rien
    return {
      month: requested,
      requestedMonth: requested,
      fallbackUsed: false,
      generatedAt: new Date().toISOString(),
      aires: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

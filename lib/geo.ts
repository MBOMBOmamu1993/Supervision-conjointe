/**
 * Utilitaires géographiques partagés (serveur + client) :
 *  - normalisation des libellés (casse, accents, espaces) ;
 *  - correction de coquilles connues (« Bonkungu » → « Bokungu ») ;
 *  - dédoublonnage des listes de filtres ;
 *  - calcul des options en cascade Province → Antenne → ZS → Aire.
 */

export interface GeoTuple {
  province: string | null;
  antenne: string | null;
  zone: string | null;
  aire: string | null;
}

export interface GeoSelection {
  province?: string | null;
  antenne?: string | null;
  zone?: string | null;
  aire?: string | null;
}

export interface CascadeOptions {
  provinces: string[];
  antennes: string[];
  zones: string[];
  aires: string[];
}

/** Supprime les diacritiques (é → e). */
export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Clé de comparaison normalisée : minuscule, sans accent, espaces réduits. */
export function norm(s: string | null | undefined): string {
  return stripAccents((s ?? "").toLowerCase()).replace(/\s+/g, " ").trim();
}

/** Coquilles d'antennes connues dans la base (clé normalisée → libellé propre). */
const ANTENNE_FIX: Record<string, string> = {
  bonkungu: "Bokungu",
};

/** Renvoie le libellé d'antenne canonique (corrige « Bonkungu »). */
export function canonAntenne(s: string | null | undefined): string | null {
  if (s === null || s === undefined) return null;
  const t = String(s).trim();
  if (t === "") return null;
  return ANTENNE_FIX[norm(t)] ?? t;
}

/** Égalité de deux libellés géographiques (insensible casse/accents). */
export function eqGeo(a: string | null | undefined, b: string | null | undefined): boolean {
  return norm(a) === norm(b);
}

/**
 * Dédoublonne une liste de libellés par clé normalisée et renvoie un libellé
 * d'affichage par groupe. On préfère un libellé non entièrement en majuscules
 * (« Bokungu » plutôt que « BOKUNGU ») pour rester lisible.
 */
export function dedupeLabels(values: (string | null | undefined)[]): string[] {
  const byKey = new Map<string, string>();
  for (const raw of values) {
    if (raw === null || raw === undefined) continue;
    const v = String(raw).trim();
    if (v === "") continue;
    const key = norm(v);
    if (!key) continue;
    const cur = byKey.get(key);
    if (!cur) {
      byKey.set(key, v);
    } else if (cur === cur.toUpperCase() && v !== v.toUpperCase()) {
      // Remplace un libellé tout-majuscule par une variante mieux formatée.
      byKey.set(key, v);
    }
  }
  return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b, "fr"));
}

/** Normalise une liste de tuples (corrige les antennes). */
export function canonTuples(tuples: GeoTuple[]): GeoTuple[] {
  return tuples.map((t) => ({
    province: t.province,
    antenne: canonAntenne(t.antenne),
    zone: t.zone,
    aire: t.aire,
  }));
}

/* ----- Rattachement hiérarchique statique (base État de lieux Tshuapa) ----- */
// Les formulaires Kobo ne renseignent pas toujours les niveaux parents (ex.
// l'antenne d'une soumission ZS). On complète via la hiérarchie provinciale
// connue : ZS → antenne et AS → ZS. Les clés sont normalisées (casse/accents).
// NB : il existe une *antenne* « Boende » ET une *ZS* « Boende » — le
// rattachement se fait toujours du niveau enfant vers le parent, jamais par
// égalité de nom, pour éviter toute collision.
import { EDL } from "@/data/edl-data";

let _zsToAntenne: Map<string, string> | null = null;
let _asToZs: Map<string, { zone: string; antenne: string }> | null = null;

function zsToAntenneMap(): Map<string, string> {
  if (!_zsToAntenne) {
    _zsToAntenne = new Map();
    for (const z of EDL.zsPop) _zsToAntenne.set(norm(z.zs), canonAntenne(z.antenne) ?? z.antenne);
  }
  return _zsToAntenne;
}
function asToZsMap(): Map<string, { zone: string; antenne: string }> {
  if (!_asToZs) {
    _asToZs = new Map();
    for (const a of EDL.asPop) {
      const key = norm(a.as);
      const parent = { zone: a.zs, antenne: canonAntenne(a.antenne) ?? a.antenne };
      // En cas d'homonymie d'AS entre ZS, on garde la première occurrence.
      if (!_asToZs.has(key)) _asToZs.set(key, parent);
      // La base État de lieux préfixe les aires « AS Iyongo » alors que les
      // formulaires Kobo utilisent le nom nu (« Iyongo ») : on indexe les deux.
      const bare = key.replace(/^as /, "");
      if (bare && !_asToZs.has(bare)) _asToZs.set(bare, parent);
    }
  }
  return _asToZs;
}

/** Antenne de rattachement d'une ZS (hiérarchie provinciale statique). */
export function antenneOfZone(zone: string | null | undefined): string | null {
  if (!zone) return null;
  return zsToAntenneMap().get(norm(zone)) ?? null;
}

/** ZS (et antenne) de rattachement d'une aire de santé. */
export function zoneOfAire(aire: string | null | undefined): { zone: string; antenne: string } | null {
  if (!aire) return null;
  return asToZsMap().get(norm(aire)) ?? null;
}

/**
 * Options en cascade : chaque niveau est restreint par les niveaux parents
 * déjà sélectionnés. Les listes sont dédoublonnées.
 */
export function cascadeOptions(tuples: GeoTuple[], sel: GeoSelection): CascadeOptions {
  const matchProvince = (t: GeoTuple) => !sel.province || eqGeo(t.province, sel.province);
  const matchAntenne = (t: GeoTuple) => !sel.antenne || eqGeo(t.antenne, sel.antenne);
  const matchZone = (t: GeoTuple) => !sel.zone || eqGeo(t.zone, sel.zone);

  return {
    provinces: dedupeLabels(tuples.map((t) => t.province)),
    antennes: dedupeLabels(tuples.filter(matchProvince).map((t) => t.antenne)),
    zones: dedupeLabels(tuples.filter((t) => matchProvince(t) && matchAntenne(t)).map((t) => t.zone)),
    aires: dedupeLabels(
      tuples.filter((t) => matchProvince(t) && matchAntenne(t) && matchZone(t)).map((t) => t.aire)
    ),
  };
}

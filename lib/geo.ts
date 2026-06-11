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
 * Aires de santé d'une ZS d'après la hiérarchie provinciale (base État de
 * lieux), en libellés d'affichage (préfixe « AS » retiré). Sert à proposer la
 * liste complète des aires d'une ZS dans les sélecteurs, même lorsque certaines
 * aires n'ont pas encore de données.
 */
export function airesOfZone(zone: string | null | undefined): string[] {
  if (!zone) return [];
  const key = norm(zone);
  return EDL.asPop
    .filter((a) => norm(a.zs) === key)
    .map((a) => a.as.replace(/^AS\s+/i, "").trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "fr"));
}

/**
 * Nombre d'unités géographiques (antennes / ZS / aires de santé) couvertes par
 * une sélection de filtres, d'après la hiérarchie provinciale (base État de
 * lieux). Sert de base aux DÉNOMINATEURS « attendus » dynamiques : l'attendu
 * d'une sélection = taux par unité × unités dans la sélection × mois.
 */
export function geoScopeCounts(sel: GeoSelection): { antennes: number; zones: number; aires: number } {
  const selAntenne = canonAntenne(sel.antenne ?? null);
  const zones = EDL.zsPop.filter(
    (z) => (!selAntenne || eqGeo(canonAntenne(z.antenne), selAntenne)) && (!sel.zone || eqGeo(z.zs, sel.zone))
  );
  const bareAs = (s: string) => s.replace(/^AS\s+/i, "").trim();
  const aires = EDL.asPop.filter(
    (a) =>
      (!selAntenne || eqGeo(canonAntenne(a.antenne), selAntenne)) &&
      (!sel.zone || eqGeo(a.zs, sel.zone)) &&
      (!sel.aire || eqGeo(bareAs(a.as), sel.aire) || eqGeo(a.as, sel.aire))
  );
  const antennes = selAntenne
    ? 1
    : new Set(EDL.zsPop.map((z) => norm(canonAntenne(z.antenne) ?? "")).filter(Boolean)).size;
  return { antennes, zones: zones.length, aires: aires.length };
}

/* ----- Nettoyage des libellés encodés Kobo (valeurs XML) ----- */

/**
 * Normalisation TOKENISANTE pour la comparaison de segments encodés : les
 * codes XML Kobo séparent par underscore (« monkoto_boende ») — tout caractère
 * non alphanumérique devient un séparateur (contrairement à `norm` ci-dessus
 * qui ne réduit que les espaces).
 */
function tokNorm(s: string | null | undefined): string {
  return stripAccents((s ?? "").toLowerCase()).replace(/[^a-z0-9]+/g, " ").trim();
}

/** Met en forme un nom de structure : « lofima 2 » → « Lofima 2 ». */
export function prettifyName(s: string): string {
  return s
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => (/^\d+$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

/**
 * Nettoie un nom de centre/aire encodé « aire_zs_antenne » (valeurs XML Kobo)
 * en retirant les SÉQUENCES terminales de segments correspondant à la ZS puis à
 * l'antenne, puis met le résultat en forme. La ZS est elle-même encodée
 * « zs_antenne » (plusieurs segments) : on compare donc des séquences, pas des
 * segments isolés. Ex. « iyongo_monkoto_boende » (ZS « monkoto_boende »,
 * antenne « boende ») → « Iyongo » ; « lofima_2_bokungu_bokungu » → « Lofima 2 ».
 */
export function cleanStructureName(raw: string | null, zone: string | null, antenne: string | null): string | null {
  if (!raw) return raw;
  let parts = raw.split("_").filter(Boolean);
  const parentSeqs = [zone, antenne]
    .filter((p): p is string => !!p)
    .map((p) => tokNorm(p).split(" ").filter(Boolean))
    .filter((seq) => seq.length > 0);
  let changed = true;
  while (changed) {
    changed = false;
    for (const seq of parentSeqs) {
      if (parts.length > seq.length && seq.every((tok, k) => tokNorm(parts[parts.length - seq.length + k]) === tok)) {
        parts = parts.slice(0, parts.length - seq.length);
        changed = true;
      }
    }
  }
  const cleaned = prettifyName(parts.join("_"));
  return cleaned || prettifyName(raw);
}

/**
 * Rabat un libellé nettoyé sur une entité CONNUE de la hiérarchie provinciale
 * (base État de lieux) en retirant d'éventuels mots terminaux résiduels —
 * segments parents d'un code Kobo qui n'ont pas pu être identifiés (parent
 * absent de la ligne, encodage hérité d'une ancienne version du formulaire).
 * Ex. « Iyongo Monkoto » → « Iyongo » ; « Boende Boende » → « Boende ».
 */
export function snapToKnown(name: string | null, isKnown: (s: string) => boolean): string | null {
  if (!name || isKnown(name)) return name;
  const words = name.split(" ");
  for (let n = words.length - 1; n >= 1; n--) {
    const cand = words.slice(0, n).join(" ");
    if (isKnown(cand)) return cand;
  }
  return name;
}
export const isKnownZone = (s: string) => antenneOfZone(s) !== null;
export const isKnownAire = (s: string) => zoneOfAire(s) !== null;

/** Nettoyage complet d'un libellé de ZS issu d'un formulaire Kobo. */
export function cleanZoneLabel(zone: string | null, antenne: string | null): string | null {
  return snapToKnown(cleanStructureName(zone, null, antenne), isKnownZone);
}

/** Nettoyage complet d'un libellé d'aire de santé issu d'un formulaire Kobo. */
export function cleanAireLabel(aire: string | null, zone: string | null, antenne: string | null): string | null {
  return snapToKnown(cleanStructureName(aire, zone, antenne), isKnownAire);
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

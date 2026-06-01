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

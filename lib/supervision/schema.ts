/**
 * Résolution du schéma Kobo (calée sur les formulaires réels de Tshuapa).
 *
 *  - Les questions notées sont identifiées par leurs colonnes de SCORE/MAX :
 *      ZS       : q_<token>_NN_score / q_<token>_NN_max
 *      CS       : sc_<token>_NN      / max_<token>_NN
 *      Antenne  : sc_<token>_NN      / mx_<token>_NN
 *  - Le <token> détermine la composante (mot-clé le plus long inclus).
 *  - Le score d'une question respecte le barème du formulaire (NA → max = 0).
 */
import {
  ANSWER_MATCHERS,
  COMPOSANTES,
  TYPE_KEYWORDS,
  type AnswerValue,
  type StructureLevel,
  type SupervisionType,
} from "@/config/supervision.config";
import type { RawRow } from "./types";

/** minuscule, sans accents, espaces normalisés. */
export function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isMetaColumn(col: string): boolean {
  const n = norm(col);
  if (!n) return true;
  if (col.startsWith("_")) return true;
  return ["start", "end", "today", "deviceid", "username", "instanceid", "version", "submissiontime", "phonenumber", "audit", "validation status"].includes(n);
}

/** Première colonne dont le nom contient l'un des mots-clés (exact > startsWith > contains). */
export function findColumn(columns: string[], keywords: string[]): string | null {
  const ncols = columns.map((c) => ({ c, n: norm(c) }));
  for (const kw of keywords) {
    const nk = norm(kw);
    const exact = ncols.find((x) => x.n === nk);
    if (exact) return exact.c;
  }
  for (const kw of keywords) {
    const nk = norm(kw);
    const s = ncols.find((x) => x.n.startsWith(nk));
    if (s) return s.c;
  }
  for (const kw of keywords) {
    const nk = norm(kw);
    const c = ncols.find((x) => x.n.includes(nk));
    if (c) return c.c;
  }
  return null;
}

export interface GeoColumns {
  province: string | null;
  antenne: string | null;
  zone: string | null;
  aire: string | null;
  date: string | null;
  fonction: string | null;
  personne: string | null;
  etablissement: string | null;
}

export function resolveGeoColumns(columns: string[]): GeoColumns {
  // On teste à la fois les LIBELLÉS (export « labels/Français ») et les NOMS
  // techniques (export « valeurs XML »), pour être robuste aux deux formats.
  return {
    province: findColumn(columns, ["province", "dps"]),
    antenne: findColumn(columns, ["antenne pev", "antenne"]),
    zone: findColumn(columns, ["zone de sante", "zone sante", "zone_sante", "zone"]),
    aire: findColumn(columns, ["aire de sante", "aire sante", "aire_sante", "aire"]),
    date: findColumn(columns, ["date de la supervision", "date de supervision", "date supervision", "date_supervision", "date", "today", "end"]),
    fonction: findColumn(columns, ["fonction du superviseur", "fonction superviseur", "fonction_superviseur", "fonction de la personne", "equipe de supervision", "fonction"]),
    personne: findColumn(columns, ["nom du superviseur", "nom_superviseur", "nom et fonction de la personne", "personne rencontree", "personne_rencontree", "superviseur"]),
    etablissement: findColumn(columns, ["nom de l etablissement", "nom_ess", "etablissement", "centre de sante supervise", "structure supervisee"]),
  };
}

/** Mot-clé composante le plus long inclus dans le token → clé de composante. */
export function matchComposanteByToken(token: string): string | null {
  const t = norm(token).replace(/\s+/g, "_");
  let bestKey: string | null = null;
  let bestLen = 0;
  for (const comp of COMPOSANTES) {
    for (const kw of comp.tokens) {
      const k = norm(kw).replace(/\s+/g, "_");
      if (k && t.includes(k) && k.length > bestLen) {
        bestLen = k.length;
        bestKey = comp.key;
      }
    }
  }
  return bestKey;
}

export interface ScoreQuestion {
  scoreCol: string;
  maxCol: string;
  token: string;
  composante: string | null;
  label: string;
}

/** Jolit un libellé de question (retire numérotation et soulignés). */
function prettyLabel(raw: string): string {
  const clean = raw.replace(/^\s*\d+[.)]\s*/, "").replace(/_/g, " ").trim();
  return clean.length > 90 ? clean.slice(0, 87) + "…" : clean;
}

/**
 * Détecte les paires score/max et les rattache à une composante + un libellé.
 * Le libellé est récupéré par position : [question][commentaire][score][max].
 */
export function detectScoreQuestions(columns: string[]): ScoreQuestion[] {
  const colSet = new Set(columns);
  const out: ScoreQuestion[] = [];
  const seen = new Set<string>();

  const resolveLabel = (scoreIdx: number, token: string): string => {
    for (const back of [2, 1, 3]) {
      const cand = columns[scoreIdx - back];
      if (!cand) continue;
      const n = norm(cand);
      if (!cand || isMetaColumn(cand)) continue;
      if (/(^|_)(score|max|mx|sc|pct)(_|$)/.test(norm(cand).replace(/ /g, "_"))) continue;
      if (n.startsWith("commentaire") || n.startsWith("observation") || n.includes("commentaires")) continue;
      if (cand.length > 8) return prettyLabel(cand);
    }
    return prettyLabel(token);
  };

  columns.forEach((col, idx) => {
    let token: string | null = null;
    let maxCol: string | null = null;

    // ZS : q_<token>_NN_score
    let m = col.match(/^q_(.+)_\d+_score$/i);
    if (m) {
      token = m[1];
      const cand = col.replace(/_score$/i, "_max");
      if (colSet.has(cand)) maxCol = cand;
    }
    // CS / Antenne : sc_<token>_NN
    if (!token) {
      m = col.match(/^sc_(.+)_\d+$/i);
      if (m) {
        const rest = col.slice(3); // après "sc_"
        const cMax = "max_" + rest;
        const cMx = "mx_" + rest;
        if (colSet.has(cMax)) { token = m[1]; maxCol = cMax; }
        else if (colSet.has(cMx)) { token = m[1]; maxCol = cMx; }
      }
    }

    if (token && maxCol && !seen.has(col)) {
      seen.add(col);
      const composante = matchComposanteByToken(token);
      if (composante) {
        out.push({ scoreCol: col, maxCol, token, composante, label: resolveLabel(idx, token) });
      }
    }
  });

  return out;
}

/** Classe une valeur brute (Oui/Partiellement/Non/Non applicable) — usage résiduel. */
export function classifyAnswer(value: unknown): AnswerValue | null {
  const n = norm(value);
  if (!n) return null;
  for (const av of ["na", "oui", "partiel", "non"] as AnswerValue[]) {
    for (const matcher of ANSWER_MATCHERS[av]) if (n === norm(matcher)) return av;
  }
  for (const av of ["na", "partiel"] as AnswerValue[]) {
    for (const matcher of ANSWER_MATCHERS[av]) if (n.startsWith(norm(matcher))) return av;
  }
  return null;
}

/** Score brut/max → réponse canonique (barème du formulaire). */
export function answerFromScore(score: number | null, max: number | null): AnswerValue | null {
  if (max === null || !Number.isFinite(max) || max <= 0) {
    // max 0 ou absent : applicable seulement si un score existe
    return score === null ? null : "na";
  }
  if (score === null || !Number.isFinite(score)) return null;
  const ratio = score / max;
  if (ratio >= 0.999) return "oui";
  if (ratio <= 0.001) return "non";
  return "partiel";
}

/** Type de supervision déduit de la fonction du superviseur et du niveau. */
export function classifySupervisionType(level: StructureLevel, fonction: unknown, personne?: unknown): SupervisionType {
  const f = norm(fonction) + " " + norm(personne);
  const has = (arr: string[]) => arr.some((k) => f.includes(norm(k)));
  const joint = String(fonction ?? "").includes("/") || / et |&|conjoint/.test(norm(fonction));

  if (has(TYPE_KEYWORDS.oms)) return "conjointe_pev_oms";

  if (level === "antenne") {
    // Les antennes sont supervisées par le niveau central/intermédiaire (conjointe).
    return "conjointe_pev_oms";
  }
  if (level === "zs") {
    if (joint && has(TYPE_KEYWORDS.mca_at)) return "conjointe_mca";
    if (has(TYPE_KEYWORDS.mca_at)) return "mca_seul";
    return "conjointe_mca";
  }
  if (level === "as") {
    if (joint) return "conjointe_mca";
    if (has(TYPE_KEYWORDS.ecz)) return "ecz_seul";
    return "ecz_seul";
  }
  return "autre";
}

export function getColumns(rows: RawRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows.slice(0, 80)) for (const k of Object.keys(r)) set.add(k);
  return Array.from(set);
}

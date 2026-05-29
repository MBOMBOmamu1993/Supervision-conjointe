/**
 * Résolution tolérante du schéma Kobo.
 *
 * Les noms de colonnes des checklists ne sont pas connus à l'avance : on les
 * résout par correspondance de mots-clés normalisés (sans accents, minuscule).
 * Cela rend le dashboard robuste aux variations de libellés entre formulaires.
 */
import {
  ANSWER_MATCHERS,
  COMPOSANTES,
  SUPERVISION_TYPES,
  type AnswerValue,
  type SupervisionType,
} from "@/config/supervision.config";
import type { RawRow } from "./types";

/** minuscule, sans accents, espaces normalisés, ponctuation → espace. */
export function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Colonnes techniques Kobo à ignorer pour la détection de questions. */
const META_PREFIXES = ["_", "meta", "formhub", "instanceid", "deviceid", "today", "start", "end", "username", "phonenumber", "audit", "version", "submission", "validation", "tags", "notes", "geolocation", "gps"];

export function isMetaColumn(col: string): boolean {
  const n = norm(col);
  if (!n) return true;
  return META_PREFIXES.some((p) => n === norm(p) || n.startsWith(norm(p) + " ") || col.startsWith("_"));
}

/** Trouve la première colonne dont le nom contient l'un des mots-clés. */
export function findColumn(columns: string[], keywords: string[]): string | null {
  const ncols = columns.map((c) => ({ c, n: norm(c) }));
  for (const kw of keywords) {
    const nk = norm(kw);
    // priorité au match exact, puis "commence par", puis "contient"
    const exact = ncols.find((x) => x.n === nk);
    if (exact) return exact.c;
  }
  for (const kw of keywords) {
    const nk = norm(kw);
    const starts = ncols.find((x) => x.n.startsWith(nk));
    if (starts) return starts.c;
  }
  for (const kw of keywords) {
    const nk = norm(kw);
    const contains = ncols.find((x) => x.n.includes(nk));
    if (contains) return contains.c;
  }
  return null;
}

export interface GeoColumns {
  province: string | null;
  antenne: string | null;
  zone: string | null;
  aire: string | null;
  date: string | null;
  type: string | null;
}

export function resolveGeoColumns(columns: string[]): GeoColumns {
  return {
    province: findColumn(columns, ["province", "dps"]),
    antenne: findColumn(columns, ["antenne pev", "antenne", "nom antenne", "antenne de"]),
    zone: findColumn(columns, ["zone de sante", "nom de la zone", "zone sante", "zs", "zone"]),
    aire: findColumn(columns, ["aire de sante", "nom de l aire", "centre de sante", "formation sanitaire", "fosa", "aire", "cs"]),
    date: findColumn(columns, ["date de supervision", "date supervision", "date de la visite", "date", "_submission_time", "today", "end"]),
    type: findColumn(columns, ["type de supervision", "type supervision", "categorie de supervision", "type de visite", "equipe de supervision", "niveau de supervision", "supervision conjointe", "superviseur"]),
  };
}

/** Classe une valeur brute en réponse canonique (ou null si non reconnue). */
export function classifyAnswer(value: unknown): AnswerValue | null {
  const n = norm(value);
  if (!n) return null;
  // ordre : na avant non (car "non applicable" contient "non")
  for (const av of ["na", "oui", "partiel", "non"] as AnswerValue[]) {
    for (const m of ANSWER_MATCHERS[av]) {
      const nm = norm(m);
      if (n === nm) return av;
    }
  }
  for (const av of ["na", "partiel", "oui", "non"] as AnswerValue[]) {
    for (const m of ANSWER_MATCHERS[av]) {
      const nm = norm(m);
      if (nm.length >= 3 && (n.startsWith(nm + " ") || n === nm)) return av;
    }
  }
  return null;
}

/** Rattache un libellé de question à une composante (clé) ou null. */
export function matchComposante(columnLabel: string): string | null {
  const n = norm(columnLabel);
  let bestKey: string | null = null;
  let bestLen = 0;
  for (const comp of COMPOSANTES) {
    for (const kw of comp.keywords) {
      const nk = norm(kw);
      if (nk && n.includes(nk) && nk.length > bestLen) {
        bestLen = nk.length;
        bestKey = comp.key;
      }
    }
  }
  return bestKey;
}

/** Classe la valeur du champ « type de supervision ». */
export function classifySupervisionType(value: unknown): SupervisionType {
  const n = norm(value);
  if (!n) return "autre";
  for (const t of SUPERVISION_TYPES) {
    for (const m of t.matchers) {
      if (n.includes(norm(m))) return t.key;
    }
  }
  return "autre";
}

/**
 * Détecte les colonnes « question » d'un jeu de lignes : celles dont une part
 * significative des valeurs non vides se classe en Oui/Non/Partiel/NA.
 */
export function detectQuestionColumns(rows: RawRow[]): string[] {
  if (rows.length === 0) return [];
  const columns = Object.keys(rows[0] ?? {});
  const sample = rows.slice(0, Math.min(rows.length, 400));
  const questions: string[] = [];
  for (const col of columns) {
    if (isMetaColumn(col)) continue;
    let nonEmpty = 0;
    let answerLike = 0;
    for (const r of sample) {
      const v = r[col];
      if (v === null || v === undefined || String(v).trim() === "") continue;
      nonEmpty++;
      if (classifyAnswer(v)) answerLike++;
    }
    if (nonEmpty >= 3 && answerLike / nonEmpty >= 0.6) {
      questions.push(col);
    }
  }
  return questions;
}

export function getColumns(rows: RawRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows.slice(0, 50)) for (const k of Object.keys(r)) set.add(k);
  return Array.from(set);
}

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
  TYPE_LABEL_KEYWORDS,
  DEFAULT_TYPE_SUPERVISION,
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

/**
 * TOUTES les colonnes correspondant aux mots-clés, classées par pertinence
 * décroissante : correspondance exacte (nom complet OU feuille après le dernier
 * « / ») > préfixe > inclusion d'une séquence de JETONS entiers. La
 * correspondance par jetons évite les faux positifs par sous-chaîne
 * (« Commentaire… » ne matche pas le mot-clé « aire »).
 *
 * Sert à la résolution géo MULTI-FORMATS : les exports XLSX (libellés
 * français), les data.json live (noms techniques préfixés par groupe) et les
 * anciennes versions d'un formulaire cohabitent dans un même jeu de lignes —
 * la valeur d'un champ se lit ligne par ligne sur la première colonne
 * candidate renseignée.
 */
export function findColumns(columns: string[], keywords: string[]): string[] {
  const tokensOf = (s: string) => s.split(" ").filter(Boolean);
  const hasSeq = (hay: string[], needle: string[]): boolean => {
    if (needle.length === 0 || needle.length > hay.length) return false;
    for (let i = 0; i + needle.length <= hay.length; i++) {
      let ok = true;
      for (let j = 0; j < needle.length; j++) {
        if (hay[i + j] !== needle[j]) { ok = false; break; }
      }
      if (ok) return true;
    }
    return false;
  };
  const scored: { c: string; score: number }[] = [];
  for (const c of columns) {
    const full = norm(c);
    const leaf = norm(c.slice(c.lastIndexOf("/") + 1));
    const fullT = tokensOf(full);
    const leafT = tokensOf(leaf);
    let best = Infinity;
    keywords.forEach((kw, ki) => {
      const nk = norm(kw);
      if (!nk) return;
      let tier: number | null = null;
      if (full === nk || leaf === nk) tier = 0;
      else if (full.startsWith(nk + " ") || leaf.startsWith(nk + " ")) tier = 1;
      else if (hasSeq(fullT, tokensOf(nk)) || hasSeq(leafT, tokensOf(nk))) tier = 2;
      if (tier !== null) best = Math.min(best, tier * 100 + ki);
    });
    if (best !== Infinity) scored.push({ c, score: best });
  }
  return scored.sort((a, b) => a.score - b.score).map((x) => x.c);
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
  /** Colonne « Type de supervision » (nom technique Type_de_supervision). */
  typeSupervision: string | null;
}

/** Toutes les colonnes candidates par champ géo (ordre de pertinence). */
export type GeoColumnCandidates = Record<keyof GeoColumns, string[]>;

export function resolveGeoColumnCandidates(columns: string[]): GeoColumnCandidates {
  // On teste à la fois les LIBELLÉS (export « labels/Français ») et les NOMS
  // techniques (export « valeurs XML »), pour être robuste aux deux formats —
  // ET on conserve TOUTES les colonnes candidates : les lignes issues de
  // l'export XLSX et du data.json live (ou d'anciennes versions du formulaire)
  // ne renseignent pas les mêmes colonnes pour un même champ.
  return {
    province: findColumns(columns, ["province", "dps"]),
    antenne: findColumns(columns, ["antenne pev", "antenne"]),
    zone: findColumns(columns, ["zone de sante", "zone sante", "zone_sante", "zone"]),
    aire: findColumns(columns, ["aire de sante", "aire sante", "aire_sante", "aire"]),
    date: findColumns(columns, ["date de la supervision", "date de supervision", "date supervision", "date_supervision", "date", "today", "end"]),
    fonction: findColumns(columns, ["fonction du superviseur", "fonction superviseur", "fonction_superviseur", "fonction de la personne", "equipe de supervision", "fonction"]),
    personne: findColumns(columns, ["nom du superviseur", "nom_superviseur", "nom et fonction de la personne", "personne rencontree", "personne_rencontree", "superviseur"]),
    etablissement: findColumns(columns, ["nom de l etablissement", "nom_ess", "etablissement", "centre de sante supervise", "structure supervisee"]),
    // Champ ajouté en 2026 (le nom technique exact est « Type_de_supervision »).
    typeSupervision: findColumns(columns, [
      "type de supervision", "type_de_supervision", "type supervision",
      "type_supervision", "type de la supervision",
    ]),
  };
}

export function resolveGeoColumns(columns: string[]): GeoColumns {
  const cand = resolveGeoColumnCandidates(columns);
  const first = (xs: string[]) => (xs.length ? xs[0] : null);
  return {
    province: first(cand.province),
    antenne: first(cand.antenne),
    zone: first(cand.zone),
    aire: first(cand.aire),
    date: first(cand.date),
    fonction: first(cand.fonction),
    personne: first(cand.personne),
    etablissement: first(cand.etablissement),
    typeSupervision: first(cand.typeSupervision),
  };
}

/**
 * Libellé « Type de supervision » → mois ISO. Renvoie la valeur brute du champ,
 * ou DEFAULT_TYPE_SUPERVISION (« Supervision conjointe ») si vide/absente
 * (= anciennes soumissions, avant l'ajout du champ).
 */
export function resolveTypeLabel(value: unknown): string {
  const s = String(value ?? "").trim();
  if (!s || s.toLowerCase() === "nan") return DEFAULT_TYPE_SUPERVISION;
  // select_multiple : Kobo exporte parfois plusieurs valeurs séparées par espace.
  // On garde le libellé tel quel pour l'affichage du filtre.
  return s;
}

/**
 * Classe un libellé « Type de supervision » (valeur réelle du formulaire) vers
 * un SupervisionType canonique, via TYPE_LABEL_KEYWORDS. La valeur générique
 * « Supervision conjointe » (anciennes données) → conjointe_mca, JAMAIS
 * conjointe_pev_oms (réservé aux valeurs nommant explicitement PEV central/OMS).
 */
export function classifyTypeFromLabel(label: string): SupervisionType | null {
  const n = norm(label);
  if (!n) return null;
  for (const { type, keywords } of TYPE_LABEL_KEYWORDS) {
    for (const kw of keywords) {
      if (n.includes(norm(kw))) return type;
    }
  }
  return null;
}

/**
 * Jetons/libellés PUREMENT ADMINISTRATIFS (identification de la structure) :
 * jamais comptés comme questions notées. Seules les questions ayant une vraie
 * réponse (Oui / Partiellement / Non / Non applicable) entrent dans le total
 * des questions administrées — pas les champs Province / Antenne / Zone de
 * santé / Aire de santé / identification du superviseur.
 */
const ADMIN_FIELD_RE = /^(province|dps|antenne( pev)?|zone( de)?( sante)?|aire( de)?( sante)?|zs|as|identification( de la structure.*)?|nom du superviseur|fonction du superviseur|nom de l etablissement.*|type de structure|type de supervision|date de la supervision|superviseur|etablissement|ess)$/;

/** Vrai si le jeton/libellé correspond à un champ administratif (non noté). */
export function isAdminFieldLabel(s: string): boolean {
  return ADMIN_FIELD_RE.test(norm(s));
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
  /** Colonne de commentaire/observation associée à la question (si présente). */
  commentCol: string | null;
}

/** Jolit un libellé de question (retire numérotation et soulignés). */
function prettyLabel(raw: string): string {
  const clean = raw.replace(/^\s*\d+[.)]\s*/, "").replace(/_/g, " ").trim();
  return clean.length > 90 ? clean.slice(0, 87) + "…" : clean;
}

/**
 * Feuille d'un nom de colonne Kobo : segment après le dernier « / ».
 * Les data.json imbriquent les champs sous le nom de leur groupe
 * (ex. « scores/sc_planification_01 ») alors que l'export XLSX les aplatit
 * (« sc_planification_01 »). On détecte donc sur la feuille tout en conservant
 * le chemin complet pour la lecture des valeurs de ligne.
 */
function leafName(col: string): string {
  const i = col.lastIndexOf("/");
  return i >= 0 ? col.slice(i + 1) : col;
}

/**
 * Détecte les paires score/max et les rattache à une composante + un libellé.
 * Le libellé est récupéré par position : [question][commentaire][score][max].
 *
 * Robuste aux deux formats de colonnes Kobo : noms techniques aplatis (export
 * XLSX) et noms techniques préfixés par leur groupe (data.json live). La
 * détection se fait sur la FEUILLE du nom ; le chemin complet est conservé pour
 * la lecture des valeurs (`row[scoreCol]`). La colonne « max » est cherchée
 * dans le même groupe que la colonne « score ».
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
      // Jamais un champ administratif comme libellé de question.
      if (isAdminFieldLabel(cand)) continue;
      if (cand.length > 8) return prettyLabel(cand);
    }
    return prettyLabel(token);
  };

  // Colonne de commentaire de la question : par position ([question]
  // [commentaire] [score] [max]), sur la feuille du nom de colonne.
  const isCommentLeaf = (c: string): boolean => {
    const n = norm(leafName(c));
    return n.startsWith("commentaire") || n.startsWith("observation") || n.startsWith("constat") || n.includes("commentaires");
  };
  const resolveComment = (scoreIdx: number): string | null => {
    for (const back of [1, 2]) {
      const cand = columns[scoreIdx - back];
      if (cand && isCommentLeaf(cand)) return cand;
    }
    return null;
  };

  columns.forEach((col, idx) => {
    let token: string | null = null;
    let maxCol: string | null = null;

    // Préfixe de groupe éventuel (data.json) — la colonne « max » partage le
    // même groupe que la colonne « score ».
    const leaf = leafName(col);
    const slash = col.lastIndexOf("/");
    const prefix = slash >= 0 ? col.slice(0, slash + 1) : "";

    // ZS : q_<token>_NN_score
    let m = leaf.match(/^q_(.+)_\d+_score$/i);
    if (m) {
      token = m[1];
      const cand = prefix + leaf.replace(/_score$/i, "_max");
      if (colSet.has(cand)) maxCol = cand;
    }
    // CS / Antenne : sc_<token>_NN
    if (!token) {
      m = leaf.match(/^sc_(.+)_\d+$/i);
      if (m) {
        const rest = leaf.slice(3); // après "sc_"
        const cMax = prefix + "max_" + rest;
        const cMx = prefix + "mx_" + rest;
        if (colSet.has(cMax)) { token = m[1]; maxCol = cMax; }
        else if (colSet.has(cMx)) { token = m[1]; maxCol = cMx; }
      }
    }

    if (token && maxCol && !seen.has(col)) {
      seen.add(col);
      // Champs administratifs (Province, Antenne, ZS, Aire, identification…) :
      // exclus du décompte des questions, même s'ils portent un score technique.
      if (isAdminFieldLabel(token)) return;
      // TOUTE question notée (paire score/max) est comptée, même si son jeton
      // ne correspond à aucune composante connue (composante = null) — sinon
      // le « total des questions administrées » perd des questions du
      // formulaire et ne correspond plus au nombre réel de questions.
      const composante = matchComposanteByToken(token);
      const label = resolveLabel(idx, token);
      if (isAdminFieldLabel(label)) return;
      out.push({ scoreCol: col, maxCol, token, composante, label, commentCol: resolveComment(idx) });
    }
  });

  return out;
}

/**
 * Colonnes texte « recommandations » du formulaire (hors questions notées) :
 * tout champ libre dont la feuille du nom contient « recommand ».
 */
export function detectRecommendationColumns(columns: string[]): string[] {
  return columns.filter((c) => {
    const n = norm(c.slice(c.lastIndexOf("/") + 1));
    return n.includes("recommand") && !/(^|_| )(score|max|mx)(_| |$)/.test(n);
  });
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
  // Balaye TOUTES les lignes : depuis la fusion XLSX + data.json, deux formats
  // de colonnes cohabitent dans un même jeu de lignes (noms aplatis vs chemins
  // de groupe) et un échantillon tronqué pouvait manquer le second format.
  const set = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) set.add(k);
  return Array.from(set);
}

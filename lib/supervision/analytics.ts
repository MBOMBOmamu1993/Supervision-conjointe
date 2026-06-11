/**
 * Moteur analytique : transforme les lignes brutes Kobo des 3 formulaires en
 * un bundle prêt à l'affichage. Les scores sont lus depuis les colonnes
 * score/max calculées par le formulaire (barème officiel respecté).
 */
import {
  COMPOSANTES,
  COTATION_COLOR,
  COTATION_LABEL,
  COTATION_ORDER,
  LEVEL_LABEL,
  cotationFor,
  type AnswerValue,
  type CotationLevel,
  type StructureLevel,
  type SupervisionTargets,
} from "@/config/supervision.config";
import {
  answerFromScore,
  classifySupervisionType,
  classifyTypeFromLabel,
  detectRecommendationColumns,
  detectScoreQuestions,
  getColumns,
  norm,
  resolveGeoColumns,
  resolveTypeLabel,
  type ScoreQuestion,
} from "./schema";
import { antenneOfZone, canonAntenne, zoneOfAire } from "@/lib/geo";
import type { SourceFetch } from "./kobo-client";
import type {
  ComposanteAnswerDist,
  ComposanteScore,
  ComposanteMonthly,
  CotationDist,
  KpiBlock,
  LevelBundle,
  MonthlyMatrixRow,
  NamedScore,
  RawRow,
  ScoreStat,
  SupervisionBundle,
  SupervisionRecord,
  TopNonItem,
  TrendPoint,
} from "./types";

export interface Filters {
  province?: string | null;
  antenne?: string | null;
  zone?: string | null;
  aire?: string | null;
  /** Mois sélectionnés (ISO "YYYY-MM"). Vide = tous les mois. */
  months?: string[] | null;
  /** Libellés « Type de supervision » sélectionnés. Vide = tous. */
  types?: string[] | null;
}

const EMPTY_ANSWERS = (): Record<AnswerValue, number> => ({ oui: 0, partiel: 0, non: 0, na: 0 });

function toMonth(iso: string | null): string | null {
  if (!iso) return null;
  const m = iso.match(/(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : null;
}

function parseDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (dmy) {
    const yr = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${yr}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/**
 * Colonnes de repli pour la date, dans l'ordre de préférence, lorsque la
 * « Date de la supervision » du formulaire est vide (cas des anciennes
 * soumissions migrées vers le nouvel asset Centre de santé : la colonne existe
 * dans le schéma mais n'est pas renseignée). Sans ce repli, ces enregistrements
 * se retrouvent sans mois et disparaissent du tableau de comparaison mensuelle,
 * alors qu'ils sont bien comptés comme structures supervisées.
 */
const DATE_FALLBACK_COLUMNS = ["today", "end", "start", "_submission_time"];

/**
 * Normalisation de campagne (Tshuapa, Mai 2026) : toutes les supervisions ont
 * été conduites en mai, mais quelques soumissions ont été datées début juin
 * (saisie tardive). On les rattache à fin mai pour éviter un faux découpage de
 * la période sur deux mois et conserver une comparaison cohérente.
 */
function normalizeSupervisionDate(iso: string | null): string | null {
  if (!iso) return iso;
  if (iso >= "2026-06-01" && iso <= "2026-06-30") return "2026-05-31";
  return iso;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function cleanStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  return s === "" ? null : s;
}

function avg(nums: (number | null)[]): number | null {
  const xs = nums.filter((n): n is number => n !== null && Number.isFinite(n));
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
const r1 = (n: number | null): number | null => (n === null ? null : Math.round(n * 10) / 10);

/* ----------------------- Construction des enregistrements ----------------------- */

function buildRecords(source: SourceFetch): { records: SupervisionRecord[]; rows: RawRow[]; scoreQs: ScoreQuestion[] } {
  const rows = source.rows;
  const columns = getColumns(rows);
  const geo = resolveGeoColumns(columns);
  const scoreQs = detectScoreQuestions(columns);
  const recoCols = detectRecommendationColumns(columns);
  // Champs texte libres « Constats majeurs » (ajoutés aux checklists CS et ZS
  // en 2026) : alimentent la colonne « A. Constats majeurs » de la page
  // « Constats & recommandations », en tête de liste.
  const constatsMajeursCols = columns.filter((c) => {
    const n = norm(c.slice(c.lastIndexOf("/") + 1));
    return n.startsWith("constats majeurs") || n === "constat majeur";
  });

  const records: SupervisionRecord[] = rows.map((row, i) => {
    const answers = EMPTY_ANSWERS();
    const answersByComposante: Record<string, Record<AnswerValue, number>> = {};
    const compSum: Record<string, { score: number; max: number }> = {};
    for (const c of COMPOSANTES) {
      answersByComposante[c.key] = EMPTY_ANSWERS();
      compSum[c.key] = { score: 0, max: 0 };
    }
    let globalScore = 0;
    let globalMax = 0;
    const constats: SupervisionRecord["constats"] = [];

    for (const q of scoreQs) {
      const sc = num(row[q.scoreCol]);
      const mx = num(row[q.maxCol]);
      const av = answerFromScore(sc, mx);
      if (!av) continue;
      answers[av]++;
      const ck = q.composante!;
      answersByComposante[ck][av]++;
      if (av !== "na" && mx !== null && mx > 0) {
        compSum[ck].score += sc ?? 0;
        compSum[ck].max += mx;
        globalScore += sc ?? 0;
        globalMax += mx;
      }
      // Constat : commentaire/observation renseigné sur la question.
      if (q.commentCol) {
        const text = cleanStr(row[q.commentCol]);
        if (text && text.length > 1) constats.push({ question: q.label, composante: ck, answer: av, text });
      }
    }

    // Constats majeurs saisis librement par le superviseur (champ dédié du
    // formulaire) — placés en tête des constats de la structure.
    const majeurs = constatsMajeursCols
      .map((c) => cleanStr(row[c]))
      .filter((t): t is string => !!t && t.length > 1);
    constats.unshift(...majeurs.map((text) => ({ question: "", composante: null, answer: "partiel" as AnswerValue, text })));

    const recommandations = recoCols
      .map((c) => cleanStr(row[c]))
      .filter((t): t is string => !!t && t.length > 1);

    const composantes: Record<string, number | null> = {};
    for (const c of COMPOSANTES) {
      composantes[c.key] = compSum[c.key].max > 0 ? r1((compSum[c.key].score / compSum[c.key].max) * 100) : null;
    }
    const scorePct = globalMax > 0 ? r1((globalScore / globalMax) * 100) : null;

    let date = geo.date ? parseDate(row[geo.date]) : null;
    if (!date) {
      // Repli sur les métadonnées de saisie pour ne pas perdre le mois des
      // soumissions sans « Date de la supervision » renseignée (cf. KPI vs tableau).
      for (const col of DATE_FALLBACK_COLUMNS) {
        if (col in row) {
          date = parseDate(row[col]);
          if (date) break;
        }
      }
    }
    date = normalizeSupervisionDate(date);
    let antenne = geo.antenne ? cleanStr(row[geo.antenne]) : null;
    let zone = geo.zone ? cleanStr(row[geo.zone]) : null;
    const aire = geo.aire ? cleanStr(row[geo.aire]) : null;
    const etab = geo.etablissement ? cleanStr(row[geo.etablissement]) : null;

    // Rattachement hiérarchique : complète les niveaux parents manquants via la
    // hiérarchie provinciale statique (ZS → antenne, AS → ZS). Indispensable au
    // drill-down par filtre ET à la non-confusion antenne « Boende » /
    // ZS « Boende » (le rattachement va toujours de l'enfant vers le parent).
    if (source.level === "as") {
      const parent = zoneOfAire(aire ?? etab);
      if (parent) {
        if (!zone) zone = parent.zone;
        if (!antenne) antenne = parent.antenne;
      } else if (zone && !antenne) {
        antenne = antenneOfZone(zone);
      }
    } else if (source.level === "zs" && zone && !antenne) {
      antenne = antenneOfZone(zone);
    }
    const structure =
      source.level === "antenne" ? antenne :
      source.level === "zs" ? zone :
      (aire ?? etab);

    // Type de supervision : on lit le champ réel ("Type_de_supervision") s'il
    // existe ; sinon on retombe sur la classification par fonction (anciennes
    // données). Le libellé brut est conservé pour le filtre.
    const typeLabel = geo.typeSupervision ? resolveTypeLabel(row[geo.typeSupervision]) : resolveTypeLabel(null);
    const typeFromLabel = geo.typeSupervision ? classifyTypeFromLabel(typeLabel) : null;
    const type =
      typeFromLabel ??
      classifySupervisionType(source.level, geo.fonction ? row[geo.fonction] : null, geo.personne ? row[geo.personne] : null);

    return {
      id: `${source.level}-${i}`,
      level: source.level,
      type,
      typeLabel,
      province: geo.province ? cleanStr(row[geo.province]) : null,
      antenne,
      zone,
      aire,
      structure: structure ?? `${LEVEL_LABEL[source.level].short} ${i + 1}`,
      date,
      month: toMonth(date),
      scorePct,
      cotation: scorePct !== null ? cotationFor(scorePct) : null,
      composantes,
      answers,
      answersByComposante,
      constats,
      recommandations,
    };
  });

  return { records, rows, scoreQs };
}

/**
 * Groupes de « Type de supervision » : chaque clé envoyée par le filtre
 * regroupe plusieurs types canoniques. Doit rester aligné avec
 * lib/state/filters.ts (TYPE_GROUPS).
 */
const TYPE_GROUP_TYPES: Record<string, string[]> = {
  // « Supervision conjointe » est désormais scindée en deux groupes distincts.
  conjointe_pev_oms: ["conjointe_pev_oms"],
  conjointe_mca: ["conjointe_mca"],
  // Compat. ascendante : ancienne clé unique « conjointe ».
  conjointe: ["conjointe_pev_oms", "conjointe_mca"],
  moh_seul: ["auto_eval", "mca_seul", "ecz_seul"],
};

function passFilters(r: SupervisionRecord, f: Filters): boolean {
  if (f.province && r.province && norm(r.province) !== norm(f.province)) return false;
  if (f.antenne && r.antenne && norm(canonAntenne(r.antenne) ?? "") !== norm(canonAntenne(f.antenne) ?? "")) return false;
  if (f.zone && r.zone && norm(r.zone) !== norm(f.zone)) return false;
  if (f.aire && r.aire && norm(r.aire) !== norm(f.aire)) return false;
  if (f.months && f.months.length) {
    if (!r.month || !f.months.includes(r.month)) return false;
  }
  if (f.types && f.types.length) {
    // Les jetons sont des clés de groupe ; on tolère aussi un type canonique brut.
    const allowed = new Set(f.types.flatMap((t) => TYPE_GROUP_TYPES[t] ?? [t]));
    if (!allowed.has(r.type)) return false;
  }
  return true;
}

/* ----------------------- Agrégats par niveau ----------------------- */

function scoreStat(records: SupervisionRecord[]): ScoreStat {
  const scored = records.map((r) => r.scorePct).filter((n): n is number => n !== null);
  if (scored.length === 0) return { moyen: null, max: null, min: null, count: 0 };
  return {
    moyen: r1(scored.reduce((a, b) => a + b, 0) / scored.length),
    max: r1(Math.max(...scored)),
    min: r1(Math.min(...scored)),
    count: scored.length,
  };
}

function cotationDist(records: SupervisionRecord[]): CotationDist[] {
  const counts: Record<CotationLevel, number> = { tres_bon: 0, bon: 0, moyen: 0, faible: 0 };
  let total = 0;
  for (const r of records) if (r.cotation) { counts[r.cotation]++; total++; }
  return COTATION_ORDER.map((level) => ({
    level,
    label: COTATION_LABEL[level],
    count: counts[level],
    pct: total ? Math.round((counts[level] / total) * 100) : 0,
    color: COTATION_COLOR[level],
  }));
}

function perStructure(records: SupervisionRecord[]): NamedScore[] {
  const map = new Map<string, number[]>();
  for (const r of records) {
    const name = r.structure ?? "—";
    if (!map.has(name)) map.set(name, []);
    if (r.scorePct !== null) map.get(name)!.push(r.scorePct);
  }
  return Array.from(map.entries())
    .map(([name, scores]) => ({ name, score: r1(avg(scores)), count: scores.length }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

function composanteScores(records: SupervisionRecord[]): ComposanteScore[] {
  return COMPOSANTES.map((c) => ({
    key: c.key,
    label: c.label,
    short: c.short,
    score: r1(avg(records.map((r) => r.composantes[c.key] ?? null))),
  }));
}

function composantesMonthly(records: SupervisionRecord[], months: string[]): ComposanteMonthly[] {
  return COMPOSANTES.map((c) => {
    const scores: Record<string, number | null> = {};
    for (const mo of months) {
      const vals = records.filter((r) => r.month === mo).map((r) => r.composantes[c.key] ?? null);
      scores[mo] = r1(avg(vals));
    }
    return { key: c.key, label: c.label, short: c.short, scores };
  });
}

function composanteAnswers(records: SupervisionRecord[]): ComposanteAnswerDist[] {
  return COMPOSANTES.map((c) => {
    const acc = EMPTY_ANSWERS();
    for (const r of records) {
      const a = r.answersByComposante[c.key];
      if (a) for (const k of Object.keys(acc) as AnswerValue[]) acc[k] += a[k];
    }
    return { key: c.key, label: c.label, short: c.short, answers: acc };
  });
}

function trend(records: SupervisionRecord[]): TrendPoint[] {
  const map = new Map<string, number[]>();
  for (const r of records) {
    if (!r.month) continue;
    if (!map.has(r.month)) map.set(r.month, []);
    if (r.scorePct !== null) map.get(r.month)!.push(r.scorePct);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, scores]) => ({ month, score: r1(avg(scores)), count: scores.length }));
}

function monthlyMatrix(records: SupervisionRecord[], months: string[]): MonthlyMatrixRow[] {
  const byStruct = new Map<string, Map<string, number[]>>();
  for (const r of records) {
    if (!r.month) continue;
    const name = r.structure ?? "—";
    if (!byStruct.has(name)) byStruct.set(name, new Map());
    const m = byStruct.get(name)!;
    if (!m.has(r.month)) m.set(r.month, []);
    if (r.scorePct !== null) m.get(r.month)!.push(r.scorePct);
  }
  const rows: MonthlyMatrixRow[] = [];
  for (const [name, m] of byStruct.entries()) {
    const scores: Record<string, number | null> = {};
    for (const mo of months) scores[mo] = m.has(mo) ? r1(avg(m.get(mo)!)) : null;
    const present = months.map((mo) => scores[mo]).filter((n): n is number => n !== null);
    const first = present.length ? present[0] : null;
    const last = present.length ? present[present.length - 1] : null;
    // Variation = DERNIER mois − AVANT-DERNIER mois (mois renseignés), et non
    // premier→dernier. Null s'il n'y a pas au moins deux mois renseignés.
    const penultimate = present.length >= 2 ? present[present.length - 2] : null;
    const variation = last !== null && penultimate !== null ? r1(last - penultimate) : null;
    rows.push({ name, scores, first, last, variation });
  }
  return rows.sort((a, b) => (b.last ?? -1) - (a.last ?? -1));
}

/**
 * Proportion mensuelle des réponses « Oui » par structure (lignes = org units,
 * colonnes = mois) — cf. feedback p.4 : remplace le visuel pointé du PDF.
 * % = « oui » / total des réponses administrées (oui + partiel + non + NA).
 */
function ouiMonthlyMatrix(records: SupervisionRecord[], months: string[]): { name: string; scores: Record<string, number | null> }[] {
  const byStruct = new Map<string, Map<string, { oui: number; all: number }>>();
  for (const r of records) {
    if (!r.month) continue;
    const name = r.structure ?? "—";
    if (!byStruct.has(name)) byStruct.set(name, new Map());
    const m = byStruct.get(name)!;
    if (!m.has(r.month)) m.set(r.month, { oui: 0, all: 0 });
    const acc = m.get(r.month)!;
    acc.oui += r.answers.oui;
    acc.all += r.answers.oui + r.answers.partiel + r.answers.non + r.answers.na;
  }
  return Array.from(byStruct.entries())
    .map(([name, m]) => {
      const scores: Record<string, number | null> = {};
      for (const mo of months) {
        const acc = m.get(mo);
        scores[mo] = acc && acc.all > 0 ? Math.round((acc.oui / acc.all) * 100) : null;
      }
      return { name, scores };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

/** Constats (commentaires de questions) et recommandations, groupés par structure. */
function constatsByStructure(records: SupervisionRecord[]): {
  name: string;
  constats: { question: string; composante: string | null; answer: AnswerValue; text: string }[];
  recommandations: string[];
}[] {
  const byStruct = new Map<string, SupervisionRecord[]>();
  for (const r of records) {
    const name = r.structure ?? "—";
    if (!byStruct.has(name)) byStruct.set(name, []);
    byStruct.get(name)!.push(r);
  }
  return Array.from(byStruct.entries())
    .map(([name, recs]) => {
      const constats = recs.flatMap((r) => r.constats);
      const recommandations = Array.from(new Set(recs.flatMap((r) => r.recommandations)));
      return { name, constats, recommandations };
    })
    .filter((s) => s.constats.length > 0 || s.recommandations.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

function topNon(rows: RawRow[], scoreQs: ScoreQuestion[]): TopNonItem[] {
  const items: TopNonItem[] = [];
  for (const q of scoreQs) {
    let non = 0;
    let total = 0;
    for (const row of rows) {
      const av = answerFromScore(num(row[q.scoreCol]), num(row[q.maxCol]));
      if (!av || av === "na") continue;
      total++;
      if (av === "non") non++;
    }
    if (total >= 1 && non > 0) items.push({ question: q.label, nonCount: non, total, pct: Math.round((non / total) * 100) });
  }
  return items.sort((a, b) => b.pct - a.pct || b.nonCount - a.nonCount).slice(0, 10);
}

function radar(records: SupervisionRecord[]): { entities: { name: string; values: number[] }[]; indicators: string[] } {
  const indicators = COMPOSANTES.map((c) => c.short);
  const byStruct = new Map<string, SupervisionRecord[]>();
  for (const r of records) {
    const name = r.structure ?? "—";
    if (!byStruct.has(name)) byStruct.set(name, []);
    byStruct.get(name)!.push(r);
  }
  const entities = Array.from(byStruct.entries())
    .slice(0, 8)
    .map(([name, recs]) => ({
      name,
      values: COMPOSANTES.map((c) => Math.round(avg(recs.map((r) => r.composantes[c.key] ?? null)) ?? 0)),
    }));
  return { entities, indicators };
}

function buildLevel(level: StructureLevel, records: SupervisionRecord[], rows: RawRow[], scoreQs: ScoreQuestion[], months: string[]): LevelBundle {
  return {
    level,
    records: records.length,
    score: scoreStat(records),
    cotations: cotationDist(records),
    perStructure: perStructure(records),
    composantes: composanteScores(records),
    composanteAnswers: composanteAnswers(records),
    composantesMonthly: composantesMonthly(records, months),
    trend: trend(records),
    monthlyMatrix: monthlyMatrix(records, months),
    ouiMonthlyMatrix: ouiMonthlyMatrix(records, months),
    topNon: topNon(rows, scoreQs),
    radar: radar(records),
    constats: constatsByStructure(records),
  };
}

/* ----------------------- KPI ----------------------- */

function distinctStructures(records: SupervisionRecord[]): number {
  return new Set(records.filter((r) => r.structure).map((r) => norm(r.structure))).size;
}
function kpiBlock(count: number, target: number | null): KpiBlock {
  const t = target !== null && target > 0 ? Math.round(target * 10) / 10 : target;
  return { count, target: t, pct: target && target > 0 ? Math.round((count / target) * 100) : null };
}

/* ----------------------- Bundle complet ----------------------- */

export function buildBundle(sources: SourceFetch[], filters: Filters, targets: SupervisionTargets): SupervisionBundle {
  const parsed = sources.map((s) => ({ source: s, ...buildRecords(s) }));

  // Enregistrements NON filtrés (pour peupler les options de filtres sans les
  // « auto-collapser » lorsqu'un filtre est actif).
  const allUnfiltered: SupervisionRecord[] = [];
  for (const p of parsed) allUnfiltered.push(...p.records);

  // Garde-fou (bug « ZS Boende absente ») : toute valeur distincte de ZS
  // présente dans les lignes brutes du formulaire ZS doit se retrouver dans les
  // enregistrements du bundle. Une perte signale un problème de source/schéma.
  const zsParsed = parsed.find((p) => p.source.level === "zs");
  if (zsParsed) {
    const geoCols = resolveGeoColumns(getColumns(zsParsed.rows));
    if (geoCols.zone) {
      const rawZones = new Set(
        zsParsed.rows.map((r) => norm(cleanStr(r[geoCols.zone!]) ?? "")).filter(Boolean)
      );
      const recZones = new Set(zsParsed.records.map((r) => norm(r.zone ?? r.structure ?? "")).filter(Boolean));
      for (const z of rawZones) {
        if (!recZones.has(z)) {
          console.warn(`[supervision] ZS « ${z} » présente dans les lignes brutes mais absente du bundle — vérifier le schéma/la normalisation.`);
        }
      }
    }
  }

  const byLevel = {} as Record<StructureLevel, { records: SupervisionRecord[]; rows: RawRow[]; scoreQs: ScoreQuestion[] }>;
  const allRecords: SupervisionRecord[] = [];
  for (const p of parsed) {
    const keep = p.records.map((r) => passFilters(r, filters));
    const records = p.records.filter((_, i) => keep[i]);
    const rows = p.rows.filter((_, i) => keep[i]);
    byLevel[p.source.level] = { records, rows, scoreQs: p.scoreQs };
    allRecords.push(...records);
  }

  const months = Array.from(new Set(allRecords.map((r) => r.month).filter((m): m is string => !!m))).sort();
  // Nombre de mois de la période pour la mise à l'échelle des cibles attendues.
  const monthsCount = Math.max(1, months.length);

  const levels = {} as Record<StructureLevel, LevelBundle>;
  (["antenne", "zs", "as"] as StructureLevel[]).forEach((lvl) => {
    const d = byLevel[lvl] ?? { records: [], rows: [], scoreQs: [] };
    levels[lvl] = buildLevel(lvl, d.records, d.rows, d.scoreQs, months);
  });

  const byType = (recs: SupervisionRecord[], t: string) => recs.filter((r) => r.type === t);
  const antRecs = byLevel.antenne?.records ?? [];
  const zsRecs = byLevel.zs?.records ?? [];
  const asRecs = byLevel.as?.records ?? [];

  const conjointePevOms = allRecords.filter((r) => r.type === "conjointe_pev_oms");
  const conjointeMca = allRecords.filter((r) => r.type === "conjointe_mca");
  const autoEval = allRecords.filter((r) => r.type === "auto_eval");
  const conjointeAll = allRecords.filter((r) => r.type === "conjointe_pev_oms" || r.type === "conjointe_mca");

  const zsConjointe = zsRecs.filter((r) => r.type === "conjointe_pev_oms" || r.type === "conjointe_mca");
  const csConjointe = asRecs.filter((r) => r.type === "conjointe_pev_oms" || r.type === "conjointe_mca");

  // Cibles « attendues » mises à l'échelle du nombre de mois de la période.
  const T = (perMonth: number) => perMonth * monthsCount;

  // Cibles « totales » par niveau, calculées selon le filtre « Type de
  // supervision » actif. Sans filtre, on cumule conjointe + MoH seul ; avec
  // filtre, on ne retient que la (les) catégorie(s) sélectionnée(s). Le compteur
  // (numérateur) suit déjà le filtre car antRecs/zsRecs/asRecs sont filtrés.
  const tf = filters.types ?? [];
  const none = tf.length === 0;
  const hasConjointe = none || tf.includes("conjointe_pev_oms") || tf.includes("conjointe_mca") || tf.includes("conjointe");
  const hasSeul = none || tf.includes("moh_seul");
  const antTargetTotal = (hasConjointe ? targets.conjointe_antennes_per_month : 0) + (hasSeul ? targets.auto_eval_per_month : 0);
  const zsTargetTotal = (hasConjointe ? targets.conjointe_zs_per_month : 0) + (hasSeul ? targets.mca_seul_per_month : 0);
  const asTargetTotal = (hasConjointe ? targets.conjointe_aires_per_month : 0) + (hasSeul ? targets.ecz_seul_per_month : 0);

  // % de réalisation au niveau ANTENNE : la cible est 2 antennes par TRIMESTRE
  // (feedback TL p.3) — antennes distinctes supervisées dans le trimestre
  // courant / 2, indépendamment du nombre de mois filtrés.
  const now = new Date();
  const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
  const quarterMonths = [0, 1, 2].map((i) => `${now.getFullYear()}-${String(qStartMonth + i + 1).padStart(2, "0")}`);
  const antennesTrimestre = distinctStructures(antRecs.filter((r) => r.month !== null && quarterMonths.includes(r.month)));

  const kpi = {
    // Compteurs « toutes catégories » (suivent le filtre Type de supervision) :
    // nombre de structures distinctes supervisées par niveau, avec % réalisation.
    antennes_total: kpiBlock(distinctStructures(antRecs), T(antTargetTotal)),
    // Réalisation trimestrielle des antennes (cible : 2 antennes / trimestre).
    antennes_trimestre: kpiBlock(antennesTrimestre, 2),
    zs_total: kpiBlock(distinctStructures(zsRecs), T(zsTargetTotal)),
    as_total: kpiBlock(distinctStructures(asRecs), T(asTargetTotal)),
    // Supervision conjointe PEV central-OMS : compteur réel (0 tant que le PEV
    // central/OMS n'a pas supervisé) vs 1/trimestre.
    conjointe_pev_oms: kpiBlock(conjointePevOms.length, T(targets.conjointe_pev_oms_per_month)),
    // Supervision conjointe (équipe) : 2 antennes/trim + 4 ZS/mois + 12 aires/mois
    // (2 antennes × 2 ZS supervisées × 3 aires de santé = 12 aires/mois).
    conjointe_mca: kpiBlock(conjointeMca.length, T(targets.conjointe_antennes_per_month + targets.conjointe_zs_per_month + targets.conjointe_aires_per_month)),
    auto_eval: kpiBlock(autoEval.length, T(targets.auto_eval_per_month)),
    mca_seul: kpiBlock(byType(allRecords, "mca_seul").length, T(targets.mca_seul_per_month)),
    ecz_seul: kpiBlock(byType(allRecords, "ecz_seul").length, T(targets.ecz_seul_per_month)),
    antennes_sup: kpiBlock(distinctStructures(antRecs.filter((r) => r.type === "conjointe_pev_oms" || r.type === "conjointe_mca")), T(targets.conjointe_antennes_per_month)),
    zs_conjointe: kpiBlock(distinctStructures(zsConjointe), T(targets.conjointe_zs_per_month)),
    zs_mca: kpiBlock(distinctStructures(byType(zsRecs, "mca_seul")), T(targets.mca_seul_per_month)),
    cs_conjointe: kpiBlock(distinctStructures(csConjointe), T(targets.conjointe_aires_per_month)),
    cs_ecz: kpiBlock(distinctStructures(byType(asRecs, "ecz_seul")), T(targets.ecz_seul_per_month)),
    structures_conjointe: distinctStructures(conjointeAll),
    total_supervisions: allRecords.length,
  };

  const zsMca = perStructure(byType(zsRecs, "mca_seul"));
  const csEcz = perStructure(byType(asRecs, "ecz_seul"));

  const levelScores = (["antenne", "zs", "as"] as StructureLevel[]).map((lvl) => ({
    level: lvl,
    label: LEVEL_LABEL[lvl].short,
    score: levels[lvl].score.moyen,
  }));
  const ranked = [...levelScores].filter((l) => l.score !== null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const bestLevel = ranked[0] ?? levelScores[0];
  const worstLevel = ranked[ranked.length - 1] ?? levelScores[levelScores.length - 1];

  // Meilleure / pire org-unité (tous niveaux confondus), par score moyen.
  const allUnits = (["antenne", "zs", "as"] as StructureLevel[]).flatMap((lvl) =>
    levels[lvl].perStructure
      .filter((s) => s.score !== null)
      .map((s) => ({ level: lvl, levelLabel: LEVEL_LABEL[lvl].short, name: s.name, score: s.score }))
  );
  const unitsRanked = [...allUnits].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const bestStructure = unitsRanked[0] ?? null;
  const worstStructure = unitsRanked.length ? unitsRanked[unitsRanked.length - 1] : null;

  const allComp = COMPOSANTES.map((c) => ({
    key: c.key,
    label: c.label,
    short: c.short,
    score: r1(avg(allRecords.map((r) => r.composantes[c.key] ?? null))),
  }));
  const compRanked = allComp.filter((c) => c.score !== null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const bestComposante = compRanked[0] ?? null;
  const worstComposante = compRanked[compRanked.length - 1] ?? null;

  const antMatrix = levels.antenne.monthlyMatrix.filter((m) => m.variation !== null);
  const bestProg = antMatrix.length ? [...antMatrix].sort((a, b) => (b.variation ?? 0) - (a.variation ?? 0))[0] : null;

  let alert: string | null = null;
  if (worstComposante) {
    const weakZs = levels.zs.perStructure.filter((s) => {
      const recs = zsRecs.filter((r) => r.structure === s.name);
      const sc = avg(recs.map((r) => r.composantes[worstComposante.key] ?? null));
      return sc !== null && sc < 60;
    }).length;
    if (weakZs > 0) alert = `Faible performance en « ${worstComposante.short} » dans ${weakZs} ZS`;
  }

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      months,
      sources: sources.map((s) => ({ level: s.level, label: s.label, rows: s.rows.length, ok: s.ok, error: s.error })),
      totalRecords: allRecords.length,
    },
    filters: {
      // Options dérivées des données NON filtrées (sinon les listes se vident
      // dès qu'un filtre est appliqué).
      provinces: uniqueSorted(allUnfiltered.map((r) => r.province)),
      antennes: uniqueSorted(allUnfiltered.map((r) => r.antenne)),
      zones: uniqueSorted(allUnfiltered.map((r) => r.zone)),
      // L'aire n'est un libellé unique qu'au niveau AS ; aux niveaux antenne/ZS
      // le champ peut être vide ou agréger plusieurs aires — on l'exclut.
      aires: uniqueSorted(allUnfiltered.filter((r) => r.level === "as").map((r) => r.aire)),
      months: Array.from(new Set(allUnfiltered.map((r) => r.month).filter((m): m is string => !!m))).sort(),
      types: uniqueSorted(allUnfiltered.map((r) => r.typeLabel)),
      // Tuples géographiques (antennes canonicalisées) pour les filtres en
      // cascade Province → Antenne → ZS → Aire côté client. L'aire n'est
      // renseignée que pour les enregistrements AS.
      geo: allUnfiltered.map((r) => ({
        province: r.province,
        antenne: canonAntenne(r.antenne),
        zone: r.zone,
        aire: r.level === "as" ? r.aire : null,
      })),
    },
    kpi,
    levels,
    zsMca,
    csEcz,
    highlights: {
      bestLevel,
      worstLevel,
      bestStructure,
      worstStructure,
      bestComposante,
      worstComposante,
      bestProgressAntenne: bestProg ? { name: bestProg.name, from: bestProg.first, to: bestProg.last, delta: bestProg.variation } : null,
      alert,
    },
  };
}

function uniqueSorted(values: (string | null)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
}

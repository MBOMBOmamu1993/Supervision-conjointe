/**
 * Moteur analytique : transforme les lignes brutes Kobo des 3 formulaires en
 * un bundle prêt à l'affichage (KPI, scores, cotations, composantes, tendances,
 * comparaisons, top-5 réponses « Non »).
 */
import {
  ANSWER_SCORE,
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
  classifyAnswer,
  classifySupervisionType,
  detectQuestionColumns,
  getColumns,
  matchComposante,
  norm,
  resolveGeoColumns,
} from "./schema";
import type { SourceFetch } from "./kobo-client";
import type {
  ComposanteAnswerDist,
  ComposanteScore,
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
  month?: string | null;
}

const EMPTY_ANSWERS = (): Record<AnswerValue, number> => ({ oui: 0, partiel: 0, non: 0, na: 0 });

function toMonth(iso: string | null): string | null {
  if (!iso) return null;
  const m = iso.match(/(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : null;
}

function parseDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  // formats fréquents : ISO, dd/mm/yyyy
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

function cleanStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
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

function buildRecords(source: SourceFetch): { records: SupervisionRecord[]; rows: RawRow[]; qCols: string[] } {
  const rows = source.rows;
  const columns = getColumns(rows);
  const geo = resolveGeoColumns(columns);
  const qCols = detectQuestionColumns(rows);

  // pré-calcul : composante de chaque question
  const qComp = new Map<string, string | null>();
  for (const q of qCols) qComp.set(q, matchComposante(q));

  const records: SupervisionRecord[] = rows.map((row, i) => {
    const answers = EMPTY_ANSWERS();
    const answersByComposante: Record<string, Record<AnswerValue, number>> = {};
    const compScored: Record<string, number[]> = {};
    for (const c of COMPOSANTES) {
      answersByComposante[c.key] = EMPTY_ANSWERS();
      compScored[c.key] = [];
    }
    const allScored: number[] = [];

    for (const q of qCols) {
      const av = classifyAnswer(row[q]);
      if (!av) continue;
      answers[av]++;
      const sc = ANSWER_SCORE[av];
      const ck = qComp.get(q);
      if (ck) {
        answersByComposante[ck][av]++;
        if (sc !== null) compScored[ck].push(sc);
      }
      if (sc !== null) allScored.push(sc);
    }

    const composantes: Record<string, number | null> = {};
    for (const c of COMPOSANTES) {
      composantes[c.key] = compScored[c.key].length ? r1((compScored[c.key].reduce((a, b) => a + b, 0) / compScored[c.key].length) * 100) : null;
    }
    const scorePct = allScored.length ? r1((allScored.reduce((a, b) => a + b, 0) / allScored.length) * 100) : null;

    const date = geo.date ? parseDate(row[geo.date]) : null;
    const antenne = geo.antenne ? cleanStr(row[geo.antenne]) : null;
    const zone = geo.zone ? cleanStr(row[geo.zone]) : null;
    const aire = geo.aire ? cleanStr(row[geo.aire]) : null;
    const structure = source.level === "antenne" ? antenne : source.level === "zs" ? zone : aire;

    return {
      id: `${source.level}-${i}`,
      level: source.level,
      type: geo.type ? classifySupervisionType(row[geo.type]) : "autre",
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
    };
  });

  return { records, rows, qCols };
}

function passFilters(r: SupervisionRecord, f: Filters): boolean {
  if (f.province && r.province && norm(r.province) !== norm(f.province)) return false;
  if (f.antenne && r.antenne && norm(r.antenne) !== norm(f.antenne)) return false;
  if (f.zone && r.zone && norm(r.zone) !== norm(f.zone)) return false;
  if (f.aire && r.aire && norm(r.aire) !== norm(f.aire)) return false;
  if (f.month && r.month && r.month !== f.month) return false;
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
  for (const r of records) {
    if (r.cotation) {
      counts[r.cotation]++;
      total++;
    }
  }
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
    .map(([name, scores]) => ({ name, score: avg(scores), count: scores.length }))
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
    .map(([month, scores]) => ({ month, score: avg(scores), count: scores.length }));
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
    rows.push({ name, scores, first, last, variation: first !== null && last !== null ? r1(last - first) : null });
  }
  return rows.sort((a, b) => (b.last ?? -1) - (a.last ?? -1));
}

function topNon(rows: RawRow[], qCols: string[]): TopNonItem[] {
  const items: TopNonItem[] = [];
  for (const q of qCols) {
    let non = 0;
    let total = 0;
    for (const row of rows) {
      const av = classifyAnswer(row[q]);
      if (!av || av === "na") continue;
      total++;
      if (av === "non") non++;
    }
    if (total >= 3) items.push({ question: shortenQuestion(q), nonCount: non, total, pct: Math.round((non / total) * 100) });
  }
  return items.sort((a, b) => b.pct - a.pct).slice(0, 5);
}

function shortenQuestion(q: string): string {
  const clean = q.replace(/^\d+[.)]\s*/, "").replace(/_/g, " ").trim();
  return clean.length > 70 ? clean.slice(0, 67) + "…" : clean;
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
      values: COMPOSANTES.map((c) => avg(recs.map((r) => r.composantes[c.key] ?? null)) ?? 0).map((n) => Math.round(n)),
    }));
  return { entities, indicators };
}

function buildLevel(level: StructureLevel, records: SupervisionRecord[], rows: RawRow[], qCols: string[], months: string[]): LevelBundle {
  return {
    level,
    records: records.length,
    score: scoreStat(records),
    cotations: cotationDist(records),
    perStructure: perStructure(records),
    composantes: composanteScores(records),
    composanteAnswers: composanteAnswers(records),
    trend: trend(records),
    monthlyMatrix: monthlyMatrix(records, months),
    topNon: topNon(rows, qCols),
    radar: radar(records),
  };
}

/* ----------------------- KPI ----------------------- */

function distinctStructures(records: SupervisionRecord[]): number {
  return new Set(records.filter((r) => r.structure).map((r) => norm(r.structure))).size;
}

function kpiBlock(count: number, target: number | null): KpiBlock {
  return { count, target, pct: target && target > 0 ? Math.round((count / target) * 100) : null };
}

/* ----------------------- Bundle complet ----------------------- */

export function buildBundle(sources: SourceFetch[], filters: Filters, targets: SupervisionTargets): SupervisionBundle {
  const parsed = sources.map((s) => ({ source: s, ...buildRecords(s) }));

  // Application des filtres + filtrage parallèle des lignes brutes (topNon)
  const byLevel = {} as Record<StructureLevel, { records: SupervisionRecord[]; rows: RawRow[]; qCols: string[] }>;
  const allRecords: SupervisionRecord[] = [];
  for (const p of parsed) {
    const keep: boolean[] = p.records.map((r) => passFilters(r, filters));
    const records = p.records.filter((_, i) => keep[i]);
    const rows = p.rows.filter((_, i) => keep[i]);
    byLevel[p.source.level] = { records, rows, qCols: p.qCols };
    allRecords.push(...records);
  }

  // mois présents (triés)
  const months = Array.from(new Set(allRecords.map((r) => r.month).filter((m): m is string => !!m))).sort();

  const levels = {} as Record<StructureLevel, LevelBundle>;
  (["antenne", "zs", "as"] as StructureLevel[]).forEach((lvl) => {
    const d = byLevel[lvl] ?? { records: [], rows: [], qCols: [] };
    levels[lvl] = buildLevel(lvl, d.records, d.rows, d.qCols, months);
  });

  const byType = (recs: SupervisionRecord[], t: string) => recs.filter((r) => r.type === t);

  const antRecs = byLevel.antenne?.records ?? [];
  const zsRecs = byLevel.zs?.records ?? [];
  const asRecs = byLevel.as?.records ?? [];

  const conjointePevOms = allRecords.filter((r) => r.type === "conjointe_pev_oms");
  const conjointeMca = allRecords.filter((r) => r.type === "conjointe_mca");
  const conjointeAll = allRecords.filter((r) => r.type === "conjointe_pev_oms" || r.type === "conjointe_mca");

  const zsConjointe = zsRecs.filter((r) => r.type !== "ecz_seul" && r.type !== "mca_seul");
  const csConjointe = asRecs.filter((r) => r.type !== "ecz_seul" && r.type !== "mca_seul");
  const antConjointe = antRecs;

  const kpi = {
    conjointe_pev_oms: kpiBlock(conjointePevOms.length, targets.conjointe_pev_oms),
    conjointe_mca: kpiBlock(conjointeMca.length, targets.conjointe_mca),
    mca_seul: kpiBlock(byType(allRecords, "mca_seul").length, targets.mca_seul),
    ecz_seul: kpiBlock(byType(allRecords, "ecz_seul").length, targets.ecz_seul),
    antennes_sup: kpiBlock(distinctStructures(antConjointe), targets.antennes),
    zs_conjointe: kpiBlock(distinctStructures(zsConjointe), targets.zs_conjointe),
    zs_mca: kpiBlock(distinctStructures(byType(zsRecs, "mca_seul")), targets.zs_mca),
    cs_conjointe: kpiBlock(distinctStructures(csConjointe), targets.cs_conjointe),
    cs_ecz: kpiBlock(distinctStructures(byType(asRecs, "ecz_seul")), targets.cs_ecz),
    structures_conjointe: distinctStructures(conjointeAll),
    total_supervisions: allRecords.length,
  };

  // comparaisons par type (page 2)
  const zsMca = perStructure(byType(zsRecs, "mca_seul"));
  const csEcz = perStructure(byType(asRecs, "ecz_seul"));

  // highlights
  const levelScores: { level: StructureLevel; label: string; score: number | null }[] = (["antenne", "zs", "as"] as StructureLevel[]).map((lvl) => ({
    level: lvl,
    label: LEVEL_LABEL[lvl].short,
    score: levels[lvl].score.moyen,
  }));
  const ranked = [...levelScores].filter((l) => l.score !== null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const bestLevel = ranked[0] ?? levelScores[0];
  const worstLevel = ranked[ranked.length - 1] ?? levelScores[levelScores.length - 1];

  const allComp = COMPOSANTES.map((c) => ({
    key: c.key,
    label: c.label,
    short: c.short,
    score: r1(avg(allRecords.map((r) => r.composantes[c.key] ?? null))),
  }));
  const compRanked = allComp.filter((c) => c.score !== null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const bestComposante = compRanked[0] ?? null;
  const worstComposante = compRanked[compRanked.length - 1] ?? null;

  // meilleure progression antenne (matrice mensuelle)
  const antMatrix = levels.antenne.monthlyMatrix.filter((m) => m.variation !== null);
  const bestProg = antMatrix.length ? [...antMatrix].sort((a, b) => (b.variation ?? 0) - (a.variation ?? 0))[0] : null;

  // alerte : composante faible dans plusieurs ZS
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
      provinces: uniqueSorted(allRecords.map((r) => r.province)),
      antennes: uniqueSorted(allRecords.map((r) => r.antenne)),
      zones: uniqueSorted(allRecords.map((r) => r.zone)),
      aires: uniqueSorted(allRecords.map((r) => r.aire)),
      months,
    },
    kpi,
    levels,
    zsMca,
    csEcz,
    highlights: {
      bestLevel,
      worstLevel,
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

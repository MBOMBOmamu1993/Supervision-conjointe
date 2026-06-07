/**
 * Analytique SAV (Semaine Africaine de Vaccination) — couvre les 6 pages.
 *
 * Les exports Kobo SAV ont des libellés FR longs : la résolution des colonnes
 * se fait par mots-clés (insensible casse/accents), comme le reste du repo. Deux
 * formulaires (`ident_cs` et `planif`) sont soumis une fois par CS mais
 * comportent des doublons → on déduplique par centre de santé AVANT tout calcul
 * (`dedupeByCs`, 1 fiche/CS = la plus récente). Les ventilations par antigène ×
 * tranche d'âge proviennent de la « BASE SAISIE DONNEES SAV » si configurée,
 * sinon repli sur les exports Kobo. Aucune page ne plante sans données.
 */
import type { RawRow } from "@/lib/supervision/types";
import { canonAntenne, norm } from "@/lib/geo";
import {
  SAV_ANTIGENES, type SavAntigene, type SavBundle, type DedupInfo, type SavCount,
} from "./types";
import type { SavFetch, BaseSaisieFetch } from "./kobo-client";

export interface SavFilters { province: string | null; antenne: string | null; zone: string | null; aire: string | null; months: string[] }

const str = (v: unknown): string => (v == null ? "" : String(v).trim());
const lastSeg = (k: string) => k.split(/[/.]/).pop()!;
const normKey = (s: string) => norm(s).replace(/[\s_]+/g, " ").trim();
const normTight = (s: string) => norm(s).replace(/[\s_]+/g, "");

function num(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(",", ".").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const pct = (n: number, d: number): number | null => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);
const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort();

/** Map scalaire d'une ligne, indexée par clé normalisée du dernier segment. */
function rowMap(row: RawRow): Map<string, unknown> {
  const m = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) {
    if (v !== null && typeof v === "object") continue;
    m.set(normKey(lastSeg(k)), v);
  }
  return m;
}

/** Première valeur dont la clé contient TOUS les tokens donnés. */
function get(m: Map<string, unknown>, ...tokens: string[]): unknown {
  const toks = tokens.map((t) => norm(t));
  for (const [k, v] of m) if (toks.every((t) => k.includes(t))) return v;
  return null;
}
function getStr(m: Map<string, unknown>, ...tokens: string[]): string { return str(get(m, ...tokens)); }
function getNum(m: Map<string, unknown>, ...tokens: string[]): number { return num(get(m, ...tokens)); }

/* --------- Géographie commune --------- */
interface Geo { province: string | null; antenne: string | null; zone: string | null; aire: string | null }
function readGeo(m: Map<string, unknown>): Geo {
  return {
    province: getStr(m, "province") || null,
    antenne: canonAntenne(getStr(m, "antenne") || null),
    zone: (getStr(m, "zone", "sante") || getStr(m, "zone")) || null,
    aire: (getStr(m, "aire", "sante") || getStr(m, "centre", "sante") || getStr(m, "aire") || getStr(m, "ess")) || null,
  };
}
function submissionTime(m: Map<string, unknown>): number {
  const s = getStr(m, "submission", "time") || getStr(m, "end") || getStr(m, "today") || getStr(m, "date");
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}
function monthOf(m: Map<string, unknown>): string | null {
  const s = getStr(m, "submission", "time") || getStr(m, "end") || getStr(m, "today") || getStr(m, "date");
  const mm = s.match(/(\d{4})-(\d{2})/);
  return mm ? `${mm[1]}-${mm[2]}` : null;
}

/* ============================ Déduplication par CS ============================ */

/**
 * Déduplique des lignes par centre de santé : clé = norm(Zone) | norm(Aire/CS).
 * Conserve la fiche la plus récente (`_submission_time`/`end`) ; départage à
 * date égale par la fiche la plus complète (max enfants / sessions).
 */
export function dedupeByCs(rows: RawRow[]): { kept: RawRow[]; info: DedupInfo } {
  const byKey = new Map<string, { row: RawRow; time: number; weight: number }>();
  for (const row of rows) {
    const m = rowMap(row);
    const g = readGeo(m);
    const key = `${norm(g.zone ?? "")}|${norm(g.aire ?? "")}`;
    if (key === "|") { // pas de géo exploitable : conserver tel quel sous clé unique
      byKey.set(`__raw_${byKey.size}`, { row, time: submissionTime(m), weight: 0 });
      continue;
    }
    const weight = getNum(m, "enfant") + getNum(m, "session") + getNum(m, "attendu");
    const cur = byKey.get(key);
    const cand = { row, time: submissionTime(m), weight };
    if (!cur || cand.time > cur.time || (cand.time === cur.time && cand.weight > cur.weight)) byKey.set(key, cand);
  }
  const kept = [...byKey.values()].map((e) => e.row);
  return { kept, info: { raw: rows.length, kept: kept.length, removed: rows.length - kept.length } };
}

/* ============================ Résolution des antigènes ============================ */

/** Trouve, pour un antigène, la colonne « manqué » (compte) d'une ligne. */
function antigeneMissed(m: Map<string, unknown>, ag: SavAntigene): number {
  const tight = normTight(ag);
  for (const [k, v] of m) {
    const kt = normTight(k);
    if (kt.includes(tight) && /(manqu|nonrecu|nonvacc|rate|absent)/.test(kt)) return num(v);
  }
  // Repli : colonne portant exactement le nom de l'antigène (valeur = compte manqué)
  for (const [k, v] of m) if (normTight(k) === tight) return num(v);
  return 0;
}

/* ============================ Filtres ============================ */

function matchGeo(g: Geo, f: SavFilters): boolean {
  const eq = (a: string | null, b: string | null) => norm(a ?? "") === norm(b ?? "");
  return (!f.province || eq(g.province, f.province)) &&
    (!f.antenne || eq(canonAntenne(g.antenne), canonAntenne(f.antenne))) &&
    (!f.zone || eq(g.zone, f.zone)) &&
    (!f.aire || eq(g.aire, f.aire));
}

interface Parsed { m: Map<string, unknown>; g: Geo; month: string | null }
function parseRows(rows: RawRow[]): Parsed[] {
  return rows.map((row) => { const m = rowMap(row); return { m, g: readGeo(m), month: monthOf(m) }; });
}
function filterParsed(ps: Parsed[], f: SavFilters): Parsed[] {
  return ps.filter((p) => matchGeo(p.g, f) && (f.months.length === 0 || (p.month != null && f.months.includes(p.month))));
}

/* ============================ Build bundle ============================ */

const EMPTY_AGE = { age_0_11: 0, age_12_23: 0, age_24_59: 0 };

export function buildSavBundle(sources: SavFetch[], baseSaisie: BaseSaisieFetch, f: SavFilters): SavBundle {
  const byKey = (k: string) => sources.find((s) => s.key === k);
  const identCsRaw = byKey("ident_cs")?.rows ?? [];
  const planifRaw = byKey("planif")?.rows ?? [];
  const relaisRaw = byKey("ident_relais")?.rows ?? [];
  const resultatsRaw = byKey("resultats")?.rows ?? [];
  const supRaw = byKey("supervision")?.rows ?? [];

  // Déduplication par CS (ident_cs + planif).
  const identCsDedup = dedupeByCs(identCsRaw);
  const planifDedup = dedupeByCs(planifRaw);

  // Options de filtres : agrégées sur toutes les sources.
  const allParsed = [identCsDedup.kept, planifDedup.kept, relaisRaw, resultatsRaw, supRaw].flatMap(parseRows);
  const geoTuples = allParsed.map((p) => ({ province: p.g.province, antenne: canonAntenne(p.g.antenne), zone: p.g.zone, aire: p.g.aire }));
  const filterOptions = {
    provinces: uniq(allParsed.map((p) => p.g.province)),
    antennes: uniq(allParsed.map((p) => canonAntenne(p.g.antenne))),
    zones: uniq(allParsed.map((p) => p.g.zone)),
    aires: uniq(allParsed.map((p) => p.g.aire)),
    months: uniq(allParsed.map((p) => p.month)),
    geo: geoTuples,
  };

  // Application des filtres.
  const identCs = filterParsed(parseRows(identCsDedup.kept), f);
  const planif = filterParsed(parseRows(planifDedup.kept), f);
  const relais = filterParsed(parseRows(relaisRaw), f);
  const resultats = filterParsed(parseRows(resultatsRaw), f);
  const sup = filterParsed(parseRows(supRaw), f);

  /* ---- Helpers de comptage identification ---- */
  const enfIdentifies = (ps: Parsed[]) => sum(ps.map((p) => {
    const v = getNum(p.m, "enfant", "identifi") || getNum(p.m, "total", "enfant") || getNum(p.m, "nombre", "enfant");
    return v;
  }));
  const zeroDose = (ps: Parsed[]) => sum(ps.map((p) => getNum(p.m, "zero", "dose"))) || ps.reduce((a, p) => a + antigeneMissed(p.m, "Penta1"), 0);
  const sousVacc = (ps: Parsed[]) => sum(ps.map((p) => getNum(p.m, "sous", "vaccin"))) || ps.reduce((a, p) => a + Math.max(0, antigeneMissed(p.m, "Penta3") - antigeneMissed(p.m, "Penta1")), 0);
  const dosesManquees = (ps: Parsed[]) => sum(ps.map((p) => sum(SAV_ANTIGENES.map((ag) => antigeneMissed(p.m, ag)))));

  /* ---- Doses manquées par antigène (province) ---- */
  const dosesByAntigene: SavCount[] = SAV_ANTIGENES.map((ag) => ({ label: ag, value: sum(identCs.map((p) => antigeneMissed(p.m, ag))) }))
    .filter((d) => d.value > 0);

  /* ---- Enfants manqués par ZS ---- */
  const zonesIdent = uniq(identCs.map((p) => p.g.zone));
  const enfantsManquesByZs: SavCount[] = zonesIdent.map((z) => ({ label: z, value: enfIdentifies(identCs.filter((p) => p.g.zone === z)) })).filter((d) => d.value > 0);

  /* ---- Top AS enfants manqués ---- */
  const airesIdent = uniq(identCs.map((p) => p.g.aire));
  const topAsManques: SavCount[] = airesIdent
    .map((a) => ({ label: a, value: enfIdentifies(identCs.filter((p) => p.g.aire === a)) }))
    .sort((x, y) => y.value - x.value).slice(0, 5).filter((d) => d.value > 0);

  /* ---- Planification ---- */
  const sessions = (ps: Parsed[]) => sum(ps.map((p) => getNum(p.m, "session") || 1));
  const enfAttendus = (ps: Parsed[]) => sum(ps.map((p) => getNum(p.m, "enfant", "attendu") || getNum(p.m, "attendu")));
  const planifSessions = sum(planif.map((p) => getNum(p.m, "session", "planifi") || getNum(p.m, "nombre", "session") || 1));
  const planifEnfants = enfAttendus(planif);
  const asWithProg = uniq(planif.filter((p) => (getNum(p.m, "session") || 1) > 0).map((p) => p.g.aire));
  const sessionType = (p: Parsed) => {
    const t = norm(getStr(p.m, "type", "session") || getStr(p.m, "strategie") || getStr(p.m, "type"));
    if (/avanc/.test(t)) return "avancee"; if (/mobile/.test(t)) return "mobile"; if (/fixe|autre/.test(t)) return "fixe";
    return "avancee";
  };
  const sessionsParType = { avancee: 0, fixe: 0, mobile: 0 };
  for (const p of planif) sessionsParType[sessionType(p) as keyof typeof sessionsParType] += getNum(p.m, "session") || 1;

  /* ---- Identification CS totals ---- */
  const identCsIdent = enfIdentifies(identCs);
  const identCsZero = zeroDose(identCs);
  const identCsSous = sousVacc(identCs);

  /* ---- Relais totals ---- */
  const relaisIdent = enfIdentifies(relais);

  /* ---- Résultats ---- */
  const recuperes = sum(resultats.map((p) => getNum(p.m, "vaccin") || getNum(p.m, "recuper")));
  const tauxRecupGlobal = pct(recuperes, identCsIdent || relaisIdent);

  /* ---- Supervision : proportion de Oui par question ---- */
  const supQuestions = (() => {
    if (sup.length === 0) return [] as SavCount[];
    const keys = new Set<string>();
    for (const p of sup) for (const [k, v] of p.m) {
      const val = norm(str(v));
      if (/^(oui|non)$/.test(val) && !/submission|uuid|validation/.test(k)) keys.add(k);
    }
    return [...keys].map((k) => {
      const considered = sup.filter((p) => { const v = norm(str(p.m.get(k))); return v === "oui" || v === "non"; });
      const oui = considered.filter((p) => norm(str(p.m.get(k))) === "oui").length;
      return { label: prettyQuestion(k), value: pct(oui, considered.length) ?? 0 };
    }).filter((d) => d.value > 0);
  })();
  const supAires = uniq(sup.map((p) => p.g.aire));
  const ouiGlobalPct = supQuestions.length ? Math.round((sum(supQuestions.map((q) => q.value)) / supQuestions.length) * 10) / 10 : null;

  /* ---- Synthèse par ZS (vue d'ensemble) ---- */
  const zonesAll = uniq([...identCs, ...planif, ...resultats].map((p) => p.g.zone));
  const syntheseByZs = zonesAll.map((z) => {
    const ic = identCs.filter((p) => p.g.zone === z), pl = planif.filter((p) => p.g.zone === z), rs = resultats.filter((p) => p.g.zone === z);
    const ident = enfIdentifies(ic), attendus = enfAttendus(pl), recup = sum(rs.map((p) => getNum(p.m, "vaccin") || getNum(p.m, "recuper")));
    return {
      zone: z, cs: uniq(ic.map((p) => p.g.aire)).length, enfantsIdentifies: ident,
      zeroDose: zeroDose(ic), sousVaccines: sousVacc(ic), sessions: sessions(pl),
      enfantsAttendus: attendus, enfantsRecuperes: recup, tauxRecup: pct(recup, ident),
    };
  });

  const hasData = sources.some((s) => s.rows.length > 0);

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      sources: sources.map((s) => ({ key: s.key, label: s.label, rows: s.rows.length, ok: s.ok, error: s.error })),
      baseSaisie: { configured: baseSaisie.configured, ok: baseSaisie.ok, rows: baseSaisie.rows.length, error: baseSaisie.error },
      hasData,
    },
    filters: filterOptions,
    dedup: { identCs: identCsDedup.info, planif: planifDedup.info },

    vue: {
      kpi: {
        identCsFiches: identCsDedup.info.kept,
        planifFiches: planifDedup.info.kept,
        asRelais: uniq(relais.map((p) => p.g.aire)).length, asRelaisTotal: filterOptions.aires.length,
        asRelaisPct: pct(uniq(relais.map((p) => p.g.aire)).length, filterOptions.aires.length),
        asResultats: uniq(resultats.map((p) => p.g.aire)).length, asResultatsTotal: filterOptions.aires.length,
        asResultatsPct: pct(uniq(resultats.map((p) => p.g.aire)).length, filterOptions.aires.length),
        supervisionForms: sup.length,
      },
      formsByType: [
        { label: "Identification CS", value: identCs.length },
        { label: "Planification", value: planif.length },
        { label: "Ident. relais", value: relais.length },
        { label: "Résultats", value: resultats.length },
        { label: "Supervision", value: sup.length },
      ],
      enfantsManquesByZs,
      statutVaccinal: { zeroDose: identCsZero, sousVaccines: identCsSous, autres: Math.max(0, identCsIdent - identCsZero - identCsSous) },
      dosesByAntigene,
      topAsManques,
      syntheseByZs,
    },

    identCs: {
      kpi: { identifies: identCsIdent, zeroDose: identCsZero, sousVaccines: identCsSous, dosesManquees: dosesManquees(identCs), csUniques: identCsDedup.info.kept },
      parTrancheAge: ageSplit(identCs),
      parZsTrancheAge: zonesIdent.map((z) => ({ zone: z, ...ageSplitTriple(identCs.filter((p) => p.g.zone === z)) })),
      dosesParTrancheAntigene: ageAntigeneTable(baseSaisie, identCs),
      parAsTrancheAge: asAgeTable(identCs),
      topAs: topAsManques,
    },

    identRelais: {
      kpi: { identifies: relaisIdent, zeroDose: zeroDose(relais), sousVaccines: sousVacc(relais), relais: relais.length, asCount: uniq(relais.map((p) => p.g.aire)).length },
      parTrancheAge: ageSplit(relais),
      parZsTrancheAge: uniq(relais.map((p) => p.g.zone)).map((z) => ({ zone: z, ...ageSplitTriple(relais.filter((p) => p.g.zone === z)) })),
      comparaisonCsCommunaute: zonesAll.map((z) => ({ zone: z, cs: enfIdentifies(identCs.filter((p) => p.g.zone === z)), communaute: enfIdentifies(relais.filter((p) => p.g.zone === z)) })),
      parAsTrancheAge: asAgeTable(relais),
      topAs: uniq(relais.map((p) => p.g.aire)).map((a) => ({ label: a, value: enfIdentifies(relais.filter((p) => p.g.aire === a)) })).sort((x, y) => y.value - x.value).slice(0, 5).filter((d) => d.value > 0),
    },

    planif: {
      kpi: { sessions: planifSessions, enfantsAttendus: planifEnfants, asAvecProgramme: asWithProg.length, asTotal: filterOptions.aires.length, ratio: identCsIdent > 0 ? Math.round((planifEnfants / identCsIdent) * 10) / 10 : null },
      sessionsParType,
      asProgramme: { avec: asWithProg.length, sans: Math.max(0, filterOptions.aires.length - asWithProg.length) },
      enfantsAttendusByZs: uniq(planif.map((p) => p.g.zone)).map((z) => ({ label: z, value: enfAttendus(planif.filter((p) => p.g.zone === z)) })).filter((d) => d.value > 0),
      asProgrammeTable: airesProgrammeTable(filterOptions.aires, planif, geoTuples),
      programmeParAs: planif.map((p) => ({
        aire: p.g.aire ?? "—",
        date: getStr(p.m, "date", "prevu") || getStr(p.m, "date", "session") || getStr(p.m, "date") || null,
        type: sessionTypeLabel(sessionType(p)),
        site: getStr(p.m, "site") || getStr(p.m, "localite") || getStr(p.m, "lieu") || null,
        enfantsAttendus: getNum(p.m, "enfant", "attendu") || getNum(p.m, "attendu"),
        equipe: getStr(p.m, "membre") || getStr(p.m, "equipe") || getStr(p.m, "vaccinateur") || null,
      })).sort((a, b) => (a.aire || "").localeCompare(b.aire || "")),
    },

    resultats: {
      kpi: {
        recuperes, tauxRecup: tauxRecupGlobal,
        zeroDoseRecuperes: null,
        asSousSeuil: uniq(resultats.map((p) => p.g.aire)).filter((a) => { const ident = enfIdentifies(identCs.filter((q) => q.g.aire === a)); const rec = sum(resultats.filter((q) => q.g.aire === a).map((q) => getNum(q.m, "vaccin") || getNum(q.m, "recuper"))); const t = pct(rec, ident); return t != null && t < 50; }).length,
      },
      tauxByZsAntigene: ["Penta1", "Penta3", "VPI1", "VPI2", "RR1", "RR2"].map((ag) => ({
        antigene: ag,
        zones: zonesAll.map((z) => {
          const ident = identCs.filter((p) => p.g.zone === z).reduce((a, p) => a + (1), 0);
          const rec = resultats.filter((p) => p.g.zone === z).reduce((a, p) => a + antigeneVaccine(p.m, ag), 0);
          const idn = identCs.filter((p) => p.g.zone === z).reduce((a, p) => a + antigeneMissed(p.m, ag as SavAntigene), 0);
          return { zone: z, taux: pct(rec, idn || ident) };
        }),
      })),
      enfantsByTrancheAge: ageSplit(resultats, true),
      parAsTable: uniq(resultats.map((p) => p.g.aire)).map((a) => {
        const rr = resultats.filter((p) => p.g.aire === a);
        const values: Record<string, number> = {};
        for (const ag of ["Penta1", "Penta3", "VPI1", "RR1", "VAA"]) values[ag] = rr.reduce((s, p) => s + antigeneVaccine(p.m, ag), 0);
        const total = rr.reduce((s, p) => s + (getNum(p.m, "vaccin") || getNum(p.m, "recuper")), 0);
        const ident = enfIdentifies(identCs.filter((p) => p.g.aire === a));
        return { aire: a, values, total, identifies: ident, taux: pct(total, ident) };
      }),
      topAsFaibles: uniq(resultats.map((p) => p.g.aire)).map((a) => {
        const ident = enfIdentifies(identCs.filter((p) => p.g.aire === a));
        const rec = sum(resultats.filter((p) => p.g.aire === a).map((p) => getNum(p.m, "vaccin") || getNum(p.m, "recuper")));
        return { label: a, value: pct(rec, ident) ?? 0 };
      }).filter((d) => d.value > 0).sort((x, y) => x.value - y.value).slice(0, 5),
      syntheseAntigenes: ["Penta1", "Penta3", "VPI1", "VPI2", "RR1", "RR2"].map((ag) => ({
        antigene: ag,
        a0: resultats.reduce((s, p) => s + antigeneVaccine(p.m, ag), 0), a1: 0, a2: 0,
        pctRecup: pct(resultats.reduce((s, p) => s + antigeneVaccine(p.m, ag), 0), identCs.reduce((s, p) => s + antigeneMissed(p.m, ag as SavAntigene), 0)),
      })),
      antigeneOptions: ["Penta1", "Penta3", "VPI1", "VPI2", "RR1", "RR2"],
    },

    supervision: {
      kpi: { realisees: sup.length, asCount: supAires.length, ouiGlobalPct, questionsCount: supQuestions.length },
      ouiParQuestion: supQuestions.sort((a, b) => b.value - a.value),
      ouiParQuestionAs: supAires.map((a) => {
        const rr = sup.filter((p) => p.g.aire === a);
        const values: Record<string, number | null> = {};
        for (const q of supQuestions.slice(0, 7)) {
          const key = [...rr[0]?.m.keys() ?? []].find((k) => prettyQuestion(k) === q.label);
          if (!key) { values[q.label] = null; continue; }
          const considered = rr.filter((p) => { const v = norm(str(p.m.get(key))); return v === "oui" || v === "non"; });
          values[q.label] = pct(considered.filter((p) => norm(str(p.m.get(key))) === "oui").length, considered.length);
        }
        return { aire: a, values };
      }),
      topProblemes: topText(sup, ["probleme", "constat", "difficulte"], 7),
      topActions: topText(sup, ["action", "correctrice", "corrective"], 7),
      topRecommandations: topText(sup, ["recommand"], 7),
    },
  };
}

/* ---- Antigène vacciné (résultats) ---- */
function antigeneVaccine(m: Map<string, unknown>, ag: string): number {
  const tight = normTight(ag);
  for (const [k, v] of m) { const kt = normTight(k); if (kt.includes(tight) && /(vaccin|recup|recu)/.test(kt)) return num(v); }
  return 0;
}

/* ---- Répartition par tranche d'âge (best effort) ---- */
function ageSplit(ps: Parsed[], vacc = false): { age_0_11: number; age_12_23: number; age_24_59: number } {
  const a0 = sum(ps.map((p) => getNum(p.m, "0", "11") || getNum(p.m, "0 a 11") || getNum(p.m, "moins", "12")));
  const a1 = sum(ps.map((p) => getNum(p.m, "12", "23")));
  const a2 = sum(ps.map((p) => getNum(p.m, "24", "59")));
  if (a0 + a1 + a2 > 0) return { age_0_11: a0, age_12_23: a1, age_24_59: a2 };
  return { ...EMPTY_AGE };
}
function ageSplitTriple(ps: Parsed[]): { a0: number; a1: number; a2: number } {
  const s = ageSplit(ps);
  return { a0: s.age_0_11, a1: s.age_12_23, a2: s.age_24_59 };
}
function asAgeTable(ps: Parsed[]): { aire: string; zone: string | null; a0: number; a1: number; a2: number; total: number }[] {
  const aires = uniq(ps.map((p) => p.g.aire));
  return aires.map((a) => {
    const rr = ps.filter((p) => p.g.aire === a); const s = ageSplitTriple(rr);
    return { aire: a, zone: rr[0]?.g.zone ?? null, a0: s.a0, a1: s.a1, a2: s.a2, total: s.a0 + s.a1 + s.a2 };
  }).filter((r) => r.total > 0).sort((x, y) => y.total - x.total);
}

/** Tableau doses manquées par tranche d'âge × antigène (BASE SAISIE prioritaire). */
function ageAntigeneTable(base: BaseSaisieFetch, identCs: Parsed[]) {
  const antigenes = ["BCG", "VPO1", "Penta1", "PCV1", "Rota1", "VPO3", "VPI1", "Penta3", "RR1", "VAA", "VAP1"];
  const ages = [
    { key: "age_0_11", label: "0 – 11 mois" },
    { key: "age_12_23", label: "12 – 23 mois" },
    { key: "age_24_59", label: "24 – 59 mois" },
  ];
  // Source BASE SAISIE si disponible (lignes par AS avec colonnes par antigène/âge),
  // sinon répartition approximative depuis l'export Kobo.
  const rows = base.ok && base.rows.length ? base.rows.map(rowMap) : identCs.map((p) => p.m);
  return ages.map((ag) => {
    const values: Record<string, number> = {};
    for (const anti of antigenes) values[anti] = sum(rows.map((m) => antigeneMissed(m, anti as SavAntigene)));
    return { ageLabel: ag.label, values };
  });
}

/* ---- Tableau AS avec/sans programme ---- */
function airesProgrammeTable(aires: string[], planif: Parsed[], _geo: unknown) {
  return aires.map((a) => {
    const rr = planif.filter((p) => p.g.aire === a);
    const sessions = sum(rr.map((p) => num(get(p.m, "session")) || 1));
    const enfantsAttendus = sum(rr.map((p) => getNum(p.m, "enfant", "attendu") || getNum(p.m, "attendu")));
    return { aire: a, zone: rr[0]?.g.zone ?? null, sessions, enfantsAttendus, programme: rr.length > 0 && sessions > 0 };
  }).sort((x, y) => Number(y.programme) - Number(x.programme) || y.enfantsAttendus - x.enfantsAttendus);
}

function sessionTypeLabel(t: string): string { return t === "avancee" ? "Avancée" : t === "mobile" ? "Mobile" : "Fixe"; }

/* ---- Texte libre top-N ---- */
function topText(ps: Parsed[], tokens: string[], n: number): string[] {
  const counts = new Map<string, number>();
  for (const p of ps) for (const [k, v] of p.m) {
    if (!tokens.some((t) => k.includes(norm(t)))) continue;
    const s = str(v); if (s.length < 4) continue;
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map((e) => e[0]);
}

/* ---- Libellé de question de supervision ---- */
function prettyQuestion(k: string): string {
  const s = k.replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

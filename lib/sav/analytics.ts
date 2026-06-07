/**
 * Analytique SAV (Semaine Africaine de Vaccination) — couvre les 6 pages.
 *
 * Source : seed normalisé `data/sav/sav-seed.json` (exports Kobo SAV figés —
 * activité terminée). Les deux formulaires soumis une fois par CS (`ident_cs`,
 * `planif`) sont dédupliqués par centre de santé AVANT tout calcul
 * (`dedupeByCs`, 1 fiche/CS = la plus récente). Aucune page ne plante.
 */
import { canonAntenne, norm } from "@/lib/geo";
import type { SavBundle, DedupInfo, SavCount } from "./types";
import {
  SAV_SEED, ANTIGENE_ORDER, ANTIGENE_LABEL,
  type AntigeneKey, type SeedFiche, type SeedChild, type SeedResult, type SeedPlanFiche, type SeedSession, type SeedSupRow,
} from "./seed";

export interface SavFilters { province: string | null; antenne: string | null; zone: string | null; aire: string | null; months: string[] }

const eq = (a: string | null, b: string | null) => norm(a ?? "") === norm(b ?? "");
const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, "fr"));
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const pct = (n: number, d: number): number | null => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);

interface GeoMonth { province: string | null; antenne: string | null; zone: string | null; aire: string | null; month: string | null }
function matchF(g: GeoMonth, f: SavFilters): boolean {
  return (!f.province || eq(g.province, f.province)) &&
    (!f.antenne || eq(canonAntenne(g.antenne), canonAntenne(f.antenne))) &&
    (!f.zone || eq(g.zone, f.zone)) &&
    (!f.aire || eq(g.aire, f.aire)) &&
    (f.months.length === 0 || (g.month != null && f.months.includes(g.month)));
}

/* ============================ Déduplication par CS ============================ */
/** Clé CS = norm(Zone) | norm(Centre de santé || Aire). */
function csKey(f: { zone: string | null; cs?: string | null; aire: string | null }): string {
  return `${norm(f.zone ?? "")}|${norm(f.cs ?? f.aire ?? "")}`;
}
/** Retourne l'ensemble des ids de fiches retenues (1 par CS = la plus récente). */
function dedupeFiches<T extends { id: string; time: number; zone: string | null; aire: string | null; cs?: string | null; identifies?: number; sessionsPlanifiees?: number }>(
  fiches: T[]
): { keptIds: Set<string>; info: DedupInfo } {
  const best = new Map<string, T>();
  for (const f of fiches) {
    const k = csKey(f);
    const cur = best.get(k);
    const w = (f.identifies ?? 0) + (f.sessionsPlanifiees ?? 0);
    const cw = cur ? (cur.identifies ?? 0) + (cur.sessionsPlanifiees ?? 0) : -1;
    if (!cur || f.time > cur.time || (f.time === cur.time && w > cw)) best.set(k, f);
  }
  const keptIds = new Set([...best.values()].map((f) => f.id));
  return { keptIds, info: { raw: fiches.length, kept: keptIds.size, removed: fiches.length - keptIds.size } };
}

/** Helper exposé (compat) : déduplique une liste de fiches et renvoie celles retenues. */
export function dedupeByCs<T extends { id: string; time: number; zone: string | null; aire: string | null; cs?: string | null; identifies?: number; sessionsPlanifiees?: number }>(fiches: T[]) {
  const { keptIds, info } = dedupeFiches(fiches);
  return { kept: fiches.filter((f) => keptIds.has(f.id)), info };
}

/* ============================ Agrégations enfants ============================ */
function ageCounts(children: SeedChild[]) {
  return {
    age_0_11: children.filter((c) => c.ageGroup === "age_0_11").length,
    age_12_23: children.filter((c) => c.ageGroup === "age_12_23").length,
    age_24_59: children.filter((c) => c.ageGroup === "age_24_59").length,
  };
}
const missedCount = (children: SeedChild[], ag: AntigeneKey) => children.reduce((a, c) => a + (c.missed[ag] ? 1 : 0), 0);

/* ============================ Build bundle ============================ */
const RECUP_ANTIGENES: AntigeneKey[] = ["PENTA1", "PENTA3", "VPI1", "VPI2", "RR1", "RR2"];
const RES_AS_ANTIGENES: AntigeneKey[] = ["PENTA1", "PENTA3", "VPI1", "RR1", "VAA"];

export function buildSavBundle(f: SavFilters): SavBundle {
  const seed = SAV_SEED;

  /* --- Déduplication (sur toutes les fiches, avant filtre) --- */
  const identDedup = dedupeFiches(seed.identCs.fiches);
  const planifDedup = dedupeFiches(seed.planif.fiches);

  /* --- Fiches retenues + filtrées --- */
  const identFiches = seed.identCs.fiches.filter((x) => identDedup.keptIds.has(x.id) && matchF(x, f));
  const identFicheIds = new Set(identFiches.map((x) => x.id));
  const identChildren = seed.identCs.enfants.filter((c) => identFicheIds.has(c.ficheId));

  const planifFiches = seed.planif.fiches.filter((x) => planifDedup.keptIds.has(x.id) && matchF(x, f));
  const planifFicheIds = new Set(planifFiches.map((x) => x.id));
  const planifSessions = seed.planif.sessions.filter((sx) => planifFicheIds.has(sx.ficheId) && matchF(sx, f));

  const relaisFiches = seed.identRelais.fiches.filter((x) => matchF(x, f));
  const relaisFicheIds = new Set(relaisFiches.map((x) => x.id));
  const relaisChildren = seed.identRelais.enfants.filter((c) => relaisFicheIds.has(c.ficheId));

  const resultats = seed.resultats.filter((r) => matchF(r, f));
  const sup = seed.supervision.rows.filter((r) => matchF(r, f));

  /* --- BASE SAISIE DONNEES SAV : filtrée par Province/Antenne/ZS (les noms d'AS de
     la BASE SAISIE diffèrent des aires Kobo → on n'applique pas le filtre Aire). --- */
  const bsMatch = (g: { antenne: string | null; zone: string | null }) =>
    (!f.antenne || eq(canonAntenne(g.antenne), canonAntenne(f.antenne))) &&
    (!f.zone || eq(g.zone, f.zone));
  const bsIdent = seed.baseSaisie.identifies.filter(bsMatch);
  const bsVacc = seed.baseSaisie.vaccines.filter(bsMatch);
  const bsAgg = (rows: typeof bsIdent, age: "age_0_11" | "age_12_23" | "age_24_59", ag: AntigeneKey) =>
    sum(rows.map((r) => r.byAgeAntigene[age]?.[ag] ?? 0));
  const AGE_ROWS: [("age_0_11" | "age_12_23" | "age_24_59"), string][] = [["age_0_11", "0 – 11 mois"], ["age_12_23", "12 – 23 mois"], ["age_24_59", "24 – 59 mois"]];
  const baseAgeTable = (rows: typeof bsIdent) => AGE_ROWS.map(([g, label]) => {
    const values: Record<string, number> = {};
    for (const ag of ANTIGENE_ORDER) values[ANTIGENE_LABEL[ag]] = bsAgg(rows, g, ag);
    return { ageLabel: label, values };
  });

  /* --- Options de filtres (toutes sources, avant filtre géo) --- */
  const allGeo = [
    ...seed.identCs.fiches, ...seed.planif.fiches, ...seed.identRelais.fiches, ...seed.resultats,
    ...seed.supervision.rows.map((r) => ({ ...r })),
  ];
  const filterOptions = {
    provinces: uniq(allGeo.map((x) => x.province)),
    antennes: uniq(allGeo.map((x) => canonAntenne(x.antenne))),
    zones: uniq(allGeo.map((x) => x.zone)),
    aires: uniq(allGeo.map((x) => x.aire)),
    months: uniq(allGeo.map((x) => (x as { month?: string | null }).month ?? null)),
    geo: allGeo.map((x) => ({ province: x.province, antenne: canonAntenne(x.antenne), zone: x.zone, aire: x.aire })),
  };
  const airesTotal = filterOptions.aires.length;

  /* --- Identification CS --- */
  const identCount = identChildren.length;
  const identZero = identChildren.filter((c) => c.zeroDose).length;
  const identSous = identChildren.filter((c) => c.sousVaccine).length;
  const identDoses = sum(identChildren.map((c) => ANTIGENE_ORDER.reduce((a, ag) => a + (c.missed[ag] ? 1 : 0), 0)));
  const zonesIdent = uniq(identChildren.map((c) => c.zone));
  const airesIdent = uniq(identChildren.map((c) => c.aire));

  const dosesByAntigene: SavCount[] = ANTIGENE_ORDER
    .map((ag) => ({ label: ANTIGENE_LABEL[ag], value: missedCount(identChildren, ag) }))
    .filter((d) => d.value > 0);
  const enfantsManquesByZs: SavCount[] = zonesIdent.map((z) => ({ label: z, value: identChildren.filter((c) => c.zone === z).length })).filter((d) => d.value > 0);
  const topAsManques: SavCount[] = airesIdent
    .map((a) => ({ label: a, value: identChildren.filter((c) => c.aire === a).length }))
    .sort((x, y) => y.value - x.value).slice(0, 5).filter((d) => d.value > 0);

  /* --- Planification --- */
  const planSessions = sum(planifFiches.map((x) => x.sessionsPlanifiees));
  const planEnfants = sum(planifFiches.map((x) => x.enfantsAttendus));
  const planAvancees = sum(planifFiches.map((x) => x.sessionsAvancees));
  const planMobiles = sum(planifFiches.map((x) => x.sessionsMobiles));
  const planFixes = Math.max(0, planSessions - planAvancees - planMobiles);
  const airesAvecProg = uniq(planifFiches.filter((x) => x.sessionsPlanifiees > 0).map((x) => x.aire));

  /* --- Résultats --- */
  const recuperes = sum(resultats.map((r) => r.totalDoses));
  const zonesAll = uniq([...identChildren.map((c) => c.zone), ...planifFiches.map((p) => p.zone), ...resultats.map((r) => r.zone)]);
  const airesResult = uniq(resultats.map((r) => r.aire));
  const recupByAire = (a: string | null) => sum(resultats.filter((r) => r.aire === a).map((r) => r.totalDoses));
  const identByAire = (a: string | null) => identChildren.filter((c) => c.aire === a).length;
  // Doses manquées identifiées par AS (dénominateur du taux de récupération, niveau doses).
  const missDosesByAire = (a: string | null) => sum(identChildren.filter((c) => c.aire === a).map((c) => ANTIGENE_ORDER.reduce((x, ag) => x + (c.missed[ag] ? 1 : 0), 0)));
  const tauxByAire = (a: string | null) => pct(recupByAire(a), missDosesByAire(a));
  const asSousSeuil = airesResult.filter((a) => { const t = tauxByAire(a); return t != null && t < 50; }).length;

  /* --- Supervision --- */
  const questions = seed.supervision.questions;
  const ouiParQuestion: SavCount[] = questions.map((q) => {
    const considered = sup.filter((r) => r.q[q] === "oui" || r.q[q] === "non");
    return { label: q.replace(/\s*\?$/, ""), value: pct(considered.filter((r) => r.q[q] === "oui").length, considered.length) ?? 0, _key: q } as SavCount & { _key: string };
  }).filter((d) => (d as { value: number }).value >= 0 && sup.some((r) => r.q[(d as { _key: string })._key] != null));
  const ouiSorted = [...ouiParQuestion].sort((a, b) => b.value - a.value);
  const top7Q = ouiSorted.slice().sort((a, b) => a.value - b.value).slice(0, 7); // les plus problématiques d'abord pour la heatmap
  const supAires = uniq(sup.map((r) => r.aire));
  const ouiGlobal = ouiParQuestion.length ? Math.round((sum(ouiParQuestion.map((q) => q.value)) / ouiParQuestion.length) * 10) / 10 : null;

  const topList = (arr: string[]) => {
    const m = new Map<string, number>();
    for (const v of arr) { const t = (v ?? "").trim(); if (t.length < 3) continue; m.set(t, (m.get(t) ?? 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7).map((e) => e[0]);
  };
  const topProblemes = topList(sup.flatMap((r) => r.difficultesList ?? []));
  const topActions = topList(sup.map((r) => r.actions ?? "").filter(Boolean));
  const topReco = topList(sup.map((r) => r.recommandations ?? "").filter(Boolean));

  /* --- Synthèse par ZS (vue) --- */
  const syntheseByZs = zonesAll.map((z) => {
    const ic = identChildren.filter((c) => c.zone === z);
    const pl = planifFiches.filter((p) => p.zone === z);
    const rs = resultats.filter((r) => r.zone === z);
    const ident = ic.length, recup = sum(rs.map((r) => r.totalDoses));
    return {
      zone: z, cs: uniq(ic.map((c) => c.cs ?? c.aire)).length, enfantsIdentifies: ident,
      zeroDose: ic.filter((c) => c.zeroDose).length, sousVaccines: ic.filter((c) => c.sousVaccine).length,
      sessions: sum(pl.map((p) => p.sessionsPlanifiees)), enfantsAttendus: sum(pl.map((p) => p.enfantsAttendus)),
      enfantsRecuperes: recup, tauxRecup: pct(recup, ident),
    };
  });

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      sources: [
        { key: "ident_cs", label: "SAV — Identification EZD/ESV par CS", rows: seed.identCs.fiches.length, ok: true },
        { key: "ident_relais", label: "SAV — Identification par relais", rows: seed.identRelais.fiches.length, ok: true },
        { key: "resultats", label: "SAV — Résultats vaccination", rows: seed.resultats.length, ok: true },
        { key: "supervision", label: "SAV — Supervision des équipes", rows: seed.supervision.rows.length, ok: true },
        { key: "planif", label: "SAV — Planification", rows: seed.planif.fiches.length, ok: true },
      ],
      baseSaisie: { configured: true, ok: true, rows: seed.identCs.enfants.length },
      hasData: identCount + recuperes + sup.length > 0,
    },
    filters: filterOptions,
    dedup: { identCs: identDedup.info, planif: planifDedup.info },

    vue: {
      kpi: {
        identCsFiches: identFiches.length,
        planifFiches: planifFiches.length,
        asRelais: uniq(relaisChildren.map((c) => c.aire)).length, asRelaisTotal: airesTotal,
        asRelaisPct: pct(uniq(relaisChildren.map((c) => c.aire)).length, airesTotal),
        asResultats: airesResult.length, asResultatsTotal: airesTotal, asResultatsPct: pct(airesResult.length, airesTotal),
        supervisionForms: sup.length,
      },
      formsByType: [
        { label: "Identification CS", value: identFiches.length },
        { label: "Planification", value: planifFiches.length },
        { label: "Ident. relais", value: relaisFiches.length },
        { label: "Résultats", value: resultats.length },
        { label: "Supervision", value: sup.length },
      ],
      enfantsManquesByZs,
      statutVaccinal: { zeroDose: identZero, sousVaccines: identSous, autres: Math.max(0, identCount - identZero - identSous) },
      dosesByAntigene,
      topAsManques,
      syntheseByZs,
    },

    identCs: {
      kpi: { identifies: identCount, zeroDose: identZero, sousVaccines: identSous, dosesManquees: identDoses, csUniques: identFiches.length },
      parTrancheAge: ageCounts(identChildren),
      parZsTrancheAge: zonesIdent.map((z) => { const a = ageCounts(identChildren.filter((c) => c.zone === z)); return { zone: z, a0: a.age_0_11, a1: a.age_12_23, a2: a.age_24_59 }; }),
      // Source : BASE SAISIE DONNEES SAV (Google Sheet) — enfants manqués par âge × antigène.
      dosesParTrancheAntigene: baseAgeTable(bsIdent),
      parAsTrancheAge: airesIdent.map((a) => { const grp = identChildren.filter((c) => c.aire === a); const ac = ageCounts(grp); return { aire: a, zone: grp[0]?.zone ?? null, a0: ac.age_0_11, a1: ac.age_12_23, a2: ac.age_24_59, total: grp.length }; }).filter((r) => r.total > 0).sort((x, y) => y.total - x.total),
      topAs: topAsManques,
    },

    identRelais: {
      kpi: { identifies: relaisChildren.length, zeroDose: relaisChildren.filter((c) => c.zeroDose).length, sousVaccines: relaisChildren.filter((c) => c.sousVaccine).length, relais: relaisFiches.length, asCount: uniq(relaisChildren.map((c) => c.aire)).length },
      parTrancheAge: ageCounts(relaisChildren),
      parZsTrancheAge: uniq(relaisChildren.map((c) => c.zone)).map((z) => { const a = ageCounts(relaisChildren.filter((c) => c.zone === z)); return { zone: z, a0: a.age_0_11, a1: a.age_12_23, a2: a.age_24_59 }; }),
      comparaisonCsCommunaute: zonesAll.map((z) => ({ zone: z, cs: identChildren.filter((c) => c.zone === z).length, communaute: relaisChildren.filter((c) => c.zone === z).length })),
      parAsTrancheAge: uniq(relaisChildren.map((c) => c.aire)).map((a) => { const grp = relaisChildren.filter((c) => c.aire === a); const ac = ageCounts(grp); return { aire: a, zone: grp[0]?.zone ?? null, a0: ac.age_0_11, a1: ac.age_12_23, a2: ac.age_24_59, total: grp.length }; }).filter((r) => r.total > 0).sort((x, y) => y.total - x.total),
      topAs: uniq(relaisChildren.map((c) => c.aire)).map((a) => ({ label: a, value: relaisChildren.filter((c) => c.aire === a).length })).sort((x, y) => y.value - x.value).slice(0, 5).filter((d) => d.value > 0),
    },

    planif: {
      kpi: { sessions: planSessions, enfantsAttendus: planEnfants, asAvecProgramme: airesAvecProg.length, asTotal: airesTotal, ratio: identCount > 0 ? Math.round((planEnfants / identCount) * 10) / 10 : null },
      sessionsParType: { avancee: planAvancees, fixe: planFixes, mobile: planMobiles },
      asProgramme: { avec: airesAvecProg.length, sans: Math.max(0, airesTotal - airesAvecProg.length) },
      enfantsAttendusByZs: uniq(planifFiches.map((p) => p.zone)).map((z) => ({ label: z, value: sum(planifFiches.filter((p) => p.zone === z).map((p) => p.enfantsAttendus)) })).filter((d) => d.value > 0),
      asProgrammeTable: filterOptions.aires.map((a) => {
        const pf = planifFiches.filter((p) => p.aire === a);
        const sessions = sum(pf.map((p) => p.sessionsPlanifiees));
        return { aire: a, zone: pf[0]?.zone ?? null, sessions, enfantsAttendus: sum(pf.map((p) => p.enfantsAttendus)), programme: sessions > 0 };
      }).filter((r) => r.zone != null || r.sessions > 0).sort((x, y) => Number(y.programme) - Number(x.programme) || y.enfantsAttendus - x.enfantsAttendus),
      programmeParAs: planifSessions.map((sx) => ({
        aire: sx.aire ?? "—", date: sx.date, type: sessionTypeLabel(sx.type, sx.autreType),
        site: sx.site, enfantsAttendus: sx.enfantsAttendus, equipe: sx.equipe ? sx.equipe.replace(/\n/g, " · ") : null,
      })).sort((a, b) => (a.aire || "").localeCompare(b.aire || "")),
    },

    resultats: {
      kpi: {
        recuperes,
        // Taux de récupération au niveau DOSES (comparable) : doses de récupération
        // administrées ÷ doses manquées identifiées au CS. Peut dépasser 100 % car la
        // récupération couvre au-delà des seuls enfants identifiés au centre de santé.
        tauxRecup: pct(sum(resultats.map((r) => r.totalDoses)), identDoses),
        // Zéro dose récupérés ≈ doses PENTA1 administrées en récupération (le zéro dose
        // se définit par PENTA1 non reçu → l'administration de PENTA1 le récupère).
        zeroDoseRecuperes: sum(resultats.map((r) => r.byAntigene.PENTA1)),
        asSousSeuil,
      },
      tauxByZsAntigene: RECUP_ANTIGENES.map((ag) => ({
        antigene: ANTIGENE_LABEL[ag],
        zones: zonesAll.map((z) => {
          const vacc = sum(resultats.filter((r) => r.zone === z).map((r) => r.byAntigene[ag]));
          const miss = missedCount(identChildren.filter((c) => c.zone === z), ag);
          return { zone: z, taux: pct(vacc, miss) };
        }),
      })),
      enfantsByTrancheAge: { age_0_11: sum(resultats.map((r) => r.a0)), age_12_23: sum(resultats.map((r) => r.a1)), age_24_59: sum(resultats.map((r) => r.a2)) },
      parAsTable: airesResult.map((a) => {
        const rr = resultats.filter((r) => r.aire === a);
        const values: Record<string, number> = {};
        for (const ag of RES_AS_ANTIGENES) values[ANTIGENE_LABEL[ag]] = sum(rr.map((r) => r.byAntigene[ag]));
        const total = sum(rr.map((r) => r.totalDoses)); const ident = identByAire(a);
        return { aire: a, values, total, identifies: ident, taux: tauxByAire(a) };
      }).sort((x, y) => y.total - x.total),
      topAsFaibles: airesResult.map((a) => ({ label: a, value: tauxByAire(a) ?? 0 })).filter((d) => missDosesByAire(d.label) > 0).sort((x, y) => x.value - y.value).slice(0, 5),
      // Graphique/tableau unique PENTA1/PENTA3/VPI1/VPI2/RR1/RR2 par tranche d'âge + % récupérés.
      // Source : BASE SAISIE DONNEES SAV (vaccinés ÷ identifiés).
      syntheseAntigenes: RECUP_ANTIGENES.map((ag) => {
        const a0 = bsAgg(bsVacc, "age_0_11", ag), a1 = bsAgg(bsVacc, "age_12_23", ag), a2 = bsAgg(bsVacc, "age_24_59", ag);
        const identTot = bsAgg(bsIdent, "age_0_11", ag) + bsAgg(bsIdent, "age_12_23", ag) + bsAgg(bsIdent, "age_24_59", ag);
        return { antigene: ANTIGENE_LABEL[ag], a0, a1, a2, pctRecup: pct(a0 + a1 + a2, identTot) };
      }),
      antigeneOptions: RECUP_ANTIGENES.map((ag) => ANTIGENE_LABEL[ag]),
      // Nb d'enfants vaccinés par antigène × tranche d'âge (Source : BASE SAISIE).
      vaccinesParTrancheAntigene: baseAgeTable(bsVacc),
      // % enfants vaccinés par antigène × tranche d'âge (vaccinés ÷ identifiés, BASE SAISIE).
      pctParTrancheAntigene: AGE_ROWS.map(([g, label]) => {
        const values: Record<string, number | null> = {};
        for (const ag of ANTIGENE_ORDER) values[ANTIGENE_LABEL[ag]] = pct(bsAgg(bsVacc, g, ag), bsAgg(bsIdent, g, ag));
        return { ageLabel: label, values };
      }),
    },

    supervision: {
      kpi: { realisees: sup.length, asCount: supAires.length, ouiGlobalPct: ouiGlobal, questionsCount: ouiParQuestion.length },
      ouiParQuestion: ouiSorted.map((q) => ({ label: q.label, value: q.value })),
      ouiParQuestionAs: supAires.map((a) => {
        const rr = sup.filter((r) => r.aire === a);
        const values: Record<string, number | null> = {};
        for (const q of top7Q) { const key = (q as SavCount & { _key: string })._key; const cons = rr.filter((r) => r.q[key] === "oui" || r.q[key] === "non"); values[q.label] = pct(cons.filter((r) => r.q[key] === "oui").length, cons.length); }
        return { aire: a, values };
      }),
      topProblemes, topActions, topRecommandations: topReco,
    },
  };
}

function sessionTypeLabel(type: string | null, autre: string | null): string {
  const t = norm(type ?? "");
  if (/avanc/.test(t)) return "Avancée";
  if (/mobile/.test(t)) return "Mobile";
  if (/fixe/.test(t)) return "Fixe";
  if (/autre/.test(t)) return autre || "Fixe"; // « Autre » = Fixe (cf. spec)
  return type || "—";
}

/**
 * Moteur analytique « Qualité des données » (CQD).
 *
 * Indicateurs (cf. spec) :
 *  - Concordance PENTA3 / RR2 = DHIS2 / référence × 100, classée :
 *      < 95 → sous-rapportage ; > 105 → sur-rapportage ; sinon Normal.
 *  - Taux d'erreur de transcription = discordances / valeurs vérifiées × 100.
 *  - Complétude des outils (registre / feuille de pointage / canevas SNIS).
 *  - Enfants perdus de vue identifiés / retrouvés / récupérés.
 *
 * Les colonnes sont résolues par NOM technique (export Kobo « valeurs XML »),
 * avec repli sur des libellés. Niveau AS : noms plats (total_*, registre_*…).
 * Niveau ZS : champs de somme s_snis_* / s_dhis2_* (totaux des 3 aires).
 */
import { norm, findColumn, getColumns } from "@/lib/supervision/schema";
import { resolveTypeLabel } from "@/lib/supervision/schema";
import type { CqdFetch } from "@/lib/supervision/kobo-client";
import type { RawRow } from "@/lib/supervision/types";
import type {
  CqdBundle,
  CqdLevelBundle,
  CqdRecord,
  CqdTrendPoint,
  ConcordanceClass,
  ConcordanceStat,
} from "./types";

export interface CqdFilters {
  province?: string | null;
  antenne?: string | null;
  zone?: string | null;
  aire?: string | null;
  months?: string[] | null;
  types?: string[] | null;
}

function num(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
function toMonth(v: unknown): string | null {
  const s = String(v ?? "").trim();
  const iso = s.match(/(\d{4})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (dmy) {
    const yr = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${yr}-${dmy[2].padStart(2, "0")}`;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 7);
}
/**
 * Normalisation de campagne (Tshuapa, Mai 2026) : les contrôles qualité ont été
 * menés en mai, mais quelques soumissions ont été datées début juin (saisie
 * tardive). On rattache juin 2026 à mai 2026 pour éviter un faux découpage de la
 * période sur deux mois — cohérent avec l'analytique de supervision.
 */
function normalizeCqdMonth(month: string | null): string | null {
  return month === "2026-06" ? "2026-05" : month;
}
function boolFr(v: unknown): boolean | null {
  const n = norm(v);
  if (!n) return null;
  if (["oui", "yes", "1", "true", "vrai"].includes(n)) return true;
  if (["non", "no", "0", "false", "faux"].includes(n)) return false;
  return null;
}

/** Met en forme un nom de structure : « lofima 2 » → « Lofima 2 ». */
function prettifyName(s: string): string {
  return s
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => (/^\d+$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

/**
 * Nettoie un nom de centre/aire encodé « aire_zs_antenne » (valeurs XML Kobo)
 * en retirant les segments terminaux correspondant à la ZS et à l'antenne, puis
 * met le résultat en forme. Ex. « lofima_2_bokungu_bokungu » → « Lofima 2 ».
 */
function cleanStructureName(raw: string | null, zone: string | null, antenne: string | null): string | null {
  if (!raw) return raw;
  const suffixes = new Set([zone, antenne].filter((x): x is string => !!x).map((x) => norm(x)));
  const parts = raw.split("_").filter(Boolean);
  while (parts.length > 1 && suffixes.has(norm(parts[parts.length - 1]))) parts.pop();
  const cleaned = prettifyName(parts.join("_"));
  return cleaned || prettifyName(raw);
}

function classify(taux: number | null): ConcordanceClass {
  if (taux === null) return "na";
  if (taux < 95) return "sous";
  if (taux > 105) return "sur";
  return "normal";
}

/** Première colonne existante parmi des candidats (nom technique exact prioritaire). */
function col(columns: string[], candidates: string[]): string | null {
  for (const c of candidates) if (columns.includes(c)) return c;
  return findColumn(columns, candidates);
}

function buildRecords(src: CqdFetch): CqdRecord[] {
  const rows = src.rows;
  const columns = getColumns(rows);
  const c = (cands: string[]) => col(columns, cands);

  const province = c(["province", "liste_province"]);
  const antenne = c(["antenne", "liste_antenne"]);
  const zone = c(["zone_sante", "zone de sante", "zone"]);
  const aire = c(["aire_sante", "aire de sante", "aire"]);
  const ess = c(["ess", "nom_ess", "etablissement"]);
  const dateCol = c(["date_supervision", "date de supervision", "date", "today", "end"]);
  const typeCol = c(["Type_de_supervision", "type de supervision", "type_supervision"]);

  // Sommes par source : AS-form (total_*) ; ZS-form (s_snis_* / s_dhis2_*).
  const srcCols = (prefix: string) => ({
    p1: c([`total_${prefix}_penta1`, `s_${prefix}_p1`, `${prefix}_penta1`]),
    p3: c([`total_${prefix}_penta3`, `s_${prefix}_p3`, `${prefix}_penta3`]),
    rr1: c([`total_${prefix}_rr1`, `s_${prefix}_rr1`, `${prefix}_rr1`]),
    rr2: c([`total_${prefix}_rr2`, `s_${prefix}_rr2`, `${prefix}_rr2`]),
  });
  const reg = srcCols("registre");
  const poi = srcCols("pointage");
  const sni = srcCols("snis");
  const dhi = srcCols("dhis2");

  const nbVerif = c(["nb_valeurs_verifiees", "nb_val_verif"]);
  const nbDiscSD = c(["nb_discordances_snis_dhis2", "disc_snis_dhis2"]);
  const nbDiscPR = c(["nb_discordances_pointage_registre", "disc_pointage_registre"]);
  const regCorrect = c(["registre_correct"]);
  const poiCorrect = c(["pointage_correct"]);
  const sniCorrect = c(["snis_correct"]);
  const eARec = c(["nb_enfants_a_recuperer", "enfants_a_recuperer"]);
  const eIdent = c(["nb_enfants_identifies_precedemment", "enfants_identifies_precedemment"]);
  const eRetr = c(["nb_enfants_retrouves_relais", "enfants_retrouves_relais"]);
  const eRecup = c(["nb_enfants_effectivement_recuperes", "enfants_effectivement_recuperes"]);

  const grab = (row: RawRow, cc: { p1: string | null; p3: string | null; rr1: string | null; rr2: string | null }) => ({
    p1: cc.p1 ? num(row[cc.p1]) : 0,
    p3: cc.p3 ? num(row[cc.p3]) : 0,
    rr1: cc.rr1 ? num(row[cc.rr1]) : 0,
    rr2: cc.rr2 ? num(row[cc.rr2]) : 0,
  });

  return rows.map((row, i) => {
    const z = zone ? str(row[zone]) : null;
    const a = aire ? str(row[aire]) : null;
    const e = ess ? str(row[ess]) : null;
    const an = antenne ? str(row[antenne]) : null;
    const rawStruct = src.key === "zs" ? z : (a ?? e);
    const structure = cleanStructureName(rawStruct, z, an);
    return {
      id: `cqd-${src.key}-${i}`,
      level: src.key,
      province: province ? str(row[province]) : null,
      antenne: an,
      zone: z,
      aire: a,
      structure: structure ?? `${src.key.toUpperCase()} ${i + 1}`,
      month: normalizeCqdMonth(dateCol ? toMonth(row[dateCol]) : null),
      typeLabel: typeCol ? resolveTypeLabel(row[typeCol]) : resolveTypeLabel(null),
      registre: grab(row, reg),
      pointage: grab(row, poi),
      snis: grab(row, sni),
      dhis2: grab(row, dhi),
      nbValeursVerifiees: nbVerif ? num(row[nbVerif]) : 0,
      nbDiscordSnisDhis2: nbDiscSD ? num(row[nbDiscSD]) : 0,
      nbDiscordPointageRegistre: nbDiscPR ? num(row[nbDiscPR]) : 0,
      registreCorrect: regCorrect ? boolFr(row[regCorrect]) : null,
      pointageCorrect: poiCorrect ? boolFr(row[poiCorrect]) : null,
      snisCorrect: sniCorrect ? boolFr(row[sniCorrect]) : null,
      enfantsARecuperer: eARec ? num(row[eARec]) : 0,
      enfantsIdentifies: eIdent ? num(row[eIdent]) : 0,
      enfantsRetrouves: eRetr ? num(row[eRetr]) : 0,
      enfantsRecuperes: eRecup ? num(row[eRecup]) : 0,
    };
  });
}

function pass(r: CqdRecord, f: CqdFilters): boolean {
  if (f.province && r.province && norm(r.province) !== norm(f.province)) return false;
  if (f.antenne && r.antenne && norm(r.antenne) !== norm(f.antenne)) return false;
  if (f.zone && r.zone && norm(r.zone) !== norm(f.zone)) return false;
  if (f.aire && r.aire && norm(r.aire) !== norm(f.aire)) return false;
  if (f.months && f.months.length && (!r.month || !f.months.includes(r.month))) return false;
  if (f.types && f.types.length && (!r.typeLabel || !f.types.some((t) => norm(t) === norm(r.typeLabel)))) return false;
  return true;
}

const r1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

function concordance(dhis2Sum: number, refSum: number): ConcordanceStat {
  if (refSum <= 0) return { taux: null, classe: "na" };
  const taux = r1((dhis2Sum / refSum) * 100);
  return { taux, classe: classify(taux) };
}

type Antigen4 = { p1: number; p3: number; rr1: number; rr2: number };
const ANTIGEN_KEYS: (keyof Antigen4)[] = ["p1", "p3", "rr1", "rr2"];

/**
 * Taux d'erreur de transcription = nombre de non-concordances / nombre
 * d'antigènes comparés (× 100). Un antigène est « comparé » dès que l'une des
 * deux sources est renseignée ; il est « non concordant » si les sommes
 * diffèrent. Lorsque tous les antigènes comparés sont non concordants, le taux
 * vaut donc 100 %.
 */
function discordRate(records: CqdRecord[], srcA: (r: CqdRecord) => Antigen4, srcB: (r: CqdRecord) => Antigen4): number | null {
  let comparable = 0;
  let discordant = 0;
  for (const k of ANTIGEN_KEYS) {
    const a = records.reduce((s, r) => s + srcA(r)[k], 0);
    const b = records.reduce((s, r) => s + srcB(r)[k], 0);
    if (a > 0 || b > 0) {
      comparable++;
      if (a !== b) discordant++;
    }
  }
  return comparable > 0 ? r1((discordant / comparable) * 100) : null;
}

/** Taux d'erreur de transcription SNIS → DHIS2 (niveau ZS : DHIS2 saisi à la ZS). */
const errSnisDhis2 = (records: CqdRecord[]) => discordRate(records, (r) => r.snis, (r) => r.dhis2);
/** Taux d'erreur de transcription feuille de pointage → registre. */
const errPointageRegistre = (records: CqdRecord[]) => discordRate(records, (r) => r.pointage, (r) => r.registre);
/** Taux d'erreur de transcription registre → SNIS. */
const errRegistreSnis = (records: CqdRecord[]) => discordRate(records, (r) => r.registre, (r) => r.snis);

function buildLevel(level: "zs" | "as", records: CqdRecord[]): CqdLevelBundle {
  const sumOf = (pick: (r: CqdRecord) => number) => records.reduce((a, r) => a + pick(r), 0);

  // Concordance globale (DHIS2 vs Registre pour AS, DHIS2 vs SNIS pour ZS selon
  // spec ; on calcule les deux références et on privilégie le registre s'il est
  // renseigné, sinon SNIS).
  const dhis2P3 = sumOf((r) => r.dhis2.p3);
  const dhis2Rr2 = sumOf((r) => r.dhis2.rr2);
  const regP3 = sumOf((r) => r.registre.p3);
  const regRr2 = sumOf((r) => r.registre.rr2);
  const snisP3 = sumOf((r) => r.snis.p3);
  const snisRr2 = sumOf((r) => r.snis.rr2);
  const refP3 = regP3 > 0 ? regP3 : snisP3;
  const refRr2 = regRr2 > 0 ? regRr2 : snisRr2;

  const okPct = (pick: (r: CqdRecord) => boolean | null) => {
    const vals = records.map(pick).filter((v): v is boolean => v !== null);
    return vals.length ? r1((vals.filter(Boolean).length / vals.length) * 100) : null;
  };

  const eIdent = sumOf((r) => r.enfantsIdentifies);
  const eRetr = sumOf((r) => r.enfantsRetrouves);
  const eRecup = sumOf((r) => r.enfantsRecuperes);
  const eARec = sumOf((r) => r.enfantsARecuperer);

  // Évolution mensuelle.
  const byMonth = new Map<string, CqdRecord[]>();
  for (const r of records) {
    if (!r.month) continue;
    if (!byMonth.has(r.month)) byMonth.set(r.month, []);
    byMonth.get(r.month)!.push(r);
  }
  const trend: CqdTrendPoint[] = Array.from(byMonth.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, recs]) => {
      const s = (pick: (r: CqdRecord) => number) => recs.reduce((a, r) => a + pick(r), 0);
      const ref3 = s((r) => r.registre.p3) || s((r) => r.snis.p3);
      const refR = s((r) => r.registre.rr2) || s((r) => r.snis.rr2);
      return {
        month,
        concordanceP3: ref3 > 0 ? r1((s((r) => r.dhis2.p3) / ref3) * 100) : null,
        concordanceRr2: refR > 0 ? r1((s((r) => r.dhis2.rr2) / refR) * 100) : null,
        erreurSnisDhis2: errSnisDhis2(recs),
        erreurPointageRegistre: errPointageRegistre(recs),
        erreurRegistreSnis: errRegistreSnis(recs),
      };
    });

  // Détail par structure.
  const byStruct = new Map<string, CqdRecord[]>();
  for (const r of records) {
    const name = r.structure ?? "—";
    if (!byStruct.has(name)) byStruct.set(name, []);
    byStruct.get(name)!.push(r);
  }
  const firstBool = (recs: CqdRecord[], pick: (r: CqdRecord) => boolean | null): boolean | null => {
    for (const r of recs) { const v = pick(r); if (v !== null) return v; }
    return null;
  };
  const parStructure = Array.from(byStruct.entries()).map(([name, recs]) => {
    const s = (pick: (r: CqdRecord) => number) => recs.reduce((a, r) => a + pick(r), 0);
    const ref3 = s((r) => r.registre.p3) || s((r) => r.snis.p3);
    const refR = s((r) => r.registre.rr2) || s((r) => r.snis.rr2);
    const tauxP3 = ref3 > 0 ? r1((s((r) => r.dhis2.p3) / ref3) * 100) : null;
    const tauxR2 = refR > 0 ? r1((s((r) => r.dhis2.rr2) / refR) * 100) : null;
    // Concordance Registre/SNIS (niveau CS — pas de DHIS2 à ce niveau).
    const snisP3s = s((r) => r.snis.p3); const snisR2s = s((r) => r.snis.rr2);
    const tauxRSP3 = snisP3s > 0 ? r1((s((r) => r.registre.p3) / snisP3s) * 100) : null;
    const tauxRSR2 = snisR2s > 0 ? r1((s((r) => r.registre.rr2) / snisR2s) * 100) : null;
    const outilsOk = recs.reduce((a, r) => a + ((r.registreCorrect ? 1 : 0) + (r.pointageCorrect ? 1 : 0) + (r.snisCorrect ? 1 : 0)), 0);
    return {
      name,
      zone: recs[0]?.zone ?? null,
      concordanceP3: tauxP3,
      classeP3: classify(tauxP3),
      concordanceRr2: tauxR2,
      classeRr2: classify(tauxR2),
      concordanceRsP3: tauxRSP3,
      classeRsP3: classify(tauxRSP3),
      concordanceRsRr2: tauxRSR2,
      classeRsRr2: classify(tauxRSR2),
      erreurSnisDhis2: errSnisDhis2(recs),
      erreurPointageRegistre: errPointageRegistre(recs),
      erreurRegistreSnis: errRegistreSnis(recs),
      registreOk: firstBool(recs, (r) => r.registreCorrect),
      pointageOk: firstBool(recs, (r) => r.pointageCorrect),
      snisOk: firstBool(recs, (r) => r.snisCorrect),
      outilsOk,
      enfantsIdentifies: s((r) => r.enfantsIdentifies),
      enfantsRecuperes: s((r) => r.enfantsRecuperes),
    };
  }).sort((a, b) => (a.name.localeCompare(b.name)));

  return {
    level,
    records: records.length,
    structuresControlees: byStruct.size,
    concordanceP3: concordance(dhis2P3, refP3),
    concordanceRr2: concordance(dhis2Rr2, refRr2),
    erreurSnisDhis2: errSnisDhis2(records),
    erreurPointageRegistre: errPointageRegistre(records),
    erreurRegistreSnis: errRegistreSnis(records),
    outils: {
      registre: okPct((r) => r.registreCorrect),
      pointage: okPct((r) => r.pointageCorrect),
      snis: okPct((r) => r.snisCorrect),
    },
    enfants: {
      aRecuperer: eARec,
      identifies: eIdent,
      retrouves: eRetr,
      recuperes: eRecup,
      tauxRecuperes: eIdent > 0 ? r1((eRecup / eIdent) * 100) : null,
    },
    antigenes: [
      { antigene: "PENTA1", registre: sumOf((r) => r.registre.p1), pointage: sumOf((r) => r.pointage.p1), snis: sumOf((r) => r.snis.p1), dhis2: sumOf((r) => r.dhis2.p1) },
      { antigene: "PENTA3", registre: regP3, pointage: sumOf((r) => r.pointage.p3), snis: snisP3, dhis2: dhis2P3 },
      { antigene: "RR1", registre: sumOf((r) => r.registre.rr1), pointage: sumOf((r) => r.pointage.rr1), snis: sumOf((r) => r.snis.rr1), dhis2: sumOf((r) => r.dhis2.rr1) },
      { antigene: "RR2", registre: regRr2, pointage: sumOf((r) => r.pointage.rr2), snis: snisRr2, dhis2: dhis2Rr2 },
    ],
    parAntigene: (() => {
      const keys: [string, (r: CqdRecord) => number, (r: CqdRecord) => number, (r: CqdRecord) => number, (r: CqdRecord) => number][] = [
        ["PENTA1", (r) => r.dhis2.p1, (r) => r.registre.p1, (r) => r.snis.p1, (r) => r.dhis2.p1],
        ["PENTA3", (r) => r.dhis2.p3, (r) => r.registre.p3, (r) => r.snis.p3, (r) => r.dhis2.p3],
        ["RR1", (r) => r.dhis2.rr1, (r) => r.registre.rr1, (r) => r.snis.rr1, (r) => r.dhis2.rr1],
        ["RR2", (r) => r.dhis2.rr2, (r) => r.registre.rr2, (r) => r.snis.rr2, (r) => r.dhis2.rr2],
      ];
      return keys.map(([antigene, dh, reg, sn, dh2]) => {
        const dhSum = sumOf(dh);
        const ref = sumOf(reg) || sumOf(sn);
        const snSum = sumOf(sn);
        const dh2Sum = sumOf(dh2);
        // erreur SNIS↔DHIS2 sur l'antigène : |SNIS−DHIS2| / max(SNIS,DHIS2)
        const denom = Math.max(snSum, dh2Sum);
        return {
          antigene,
          concordance: ref > 0 ? r1((dhSum / ref) * 100) : null,
          erreur: denom > 0 ? r1((Math.abs(snSum - dh2Sum) / denom) * 100) : null,
        };
      });
    })(),
    trend,
    parStructure,
  };
}

function uniq(values: (string | null)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
}

export function buildCqdBundle(sources: CqdFetch[], filters: CqdFilters): CqdBundle {
  const parsed = sources.map((s) => ({ src: s, records: buildRecords(s) }));
  const allUnfiltered = parsed.flatMap((p) => p.records);

  const byLevel: Record<"zs" | "as", CqdRecord[]> = { zs: [], as: [] };
  for (const p of parsed) {
    byLevel[p.src.key] = p.records.filter((r) => pass(r, filters));
  }
  const allFiltered = [...byLevel.zs, ...byLevel.as];
  const months = uniq(allFiltered.map((r) => r.month));

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      months,
      sources: sources.map((s) => ({ key: s.key, label: s.label, rows: s.rows.length, ok: s.ok, error: s.error })),
    },
    filters: {
      provinces: uniq(allUnfiltered.map((r) => r.province)),
      antennes: uniq(allUnfiltered.map((r) => r.antenne)),
      zones: uniq(allUnfiltered.map((r) => r.zone)),
      aires: uniq(allUnfiltered.map((r) => r.aire)),
      months: uniq(allUnfiltered.map((r) => r.month)),
      types: uniq(allUnfiltered.map((r) => r.typeLabel)),
    },
    levels: {
      zs: buildLevel("zs", byLevel.zs),
      as: buildLevel("as", byLevel.as),
    },
  };
}

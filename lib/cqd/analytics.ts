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
import { antenneOfZone, canonAntenne, zoneOfAire } from "@/lib/geo";
import type { CqdFetch } from "@/lib/supervision/kobo-client";
import type { RawRow } from "@/lib/supervision/types";
import type {
  CqdBundle,
  CqdConcordanceAS,
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
 * en retirant les SÉQUENCES terminales de segments correspondant à la ZS puis à
 * l'antenne, puis met le résultat en forme. La ZS est elle-même encodée
 * « zs_antenne » (plusieurs segments) : on compare donc des séquences, pas des
 * segments isolés. Ex. « iyongo_monkoto_boende » (ZS « monkoto_boende »,
 * antenne « boende ») → « Iyongo » ; « lofima_2_bokungu_bokungu » → « Lofima 2 ».
 */
function cleanStructureName(raw: string | null, zone: string | null, antenne: string | null): string | null {
  if (!raw) return raw;
  let parts = raw.split("_").filter(Boolean);
  const parentSeqs = [zone, antenne]
    .filter((p): p is string => !!p)
    .map((p) => norm(p).split(" ").filter(Boolean))
    .filter((seq) => seq.length > 0);
  let changed = true;
  while (changed) {
    changed = false;
    for (const seq of parentSeqs) {
      if (parts.length > seq.length && seq.every((tok, k) => norm(parts[parts.length - seq.length + k]) === tok)) {
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
function snapToKnown(name: string | null, isKnown: (s: string) => boolean): string | null {
  if (!name || isKnown(name)) return name;
  const words = name.split(" ");
  for (let n = words.length - 1; n >= 1; n--) {
    const cand = words.slice(0, n).join(" ");
    if (isKnown(cand)) return cand;
  }
  return name;
}
const isKnownZone = (s: string) => antenneOfZone(s) !== null;
const isKnownAire = (s: string) => zoneOfAire(s) !== null;

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

/* ---------- Enfants manqués par antigène × tranche d'âge (feedback TL) ---------- */

/** Antigènes du tableau « enfants manqués par antigène » (ordre du feedback). */
export const MISSED_ANTIGENS: { label: string; tokens: string[] }[] = [
  { label: "BCG", tokens: ["bcg"] },
  { label: "VPO1", tokens: ["vpo1", "opv1"] },
  { label: "VPO2", tokens: ["vpo2", "opv2"] },
  { label: "VPO3", tokens: ["vpo3", "opv3"] },
  { label: "PENTA1", tokens: ["penta1", "dtc1"] },
  { label: "PENTA2", tokens: ["penta2", "dtc2"] },
  { label: "PENTA3", tokens: ["penta3", "dtc3"] },
  { label: "PCV1", tokens: ["pcv13_1", "pcv1"] },
  { label: "PCV2", tokens: ["pcv13_2", "pcv2"] },
  { label: "PCV3", tokens: ["pcv13_3", "pcv3"] },
  { label: "ROTA1", tokens: ["rota1"] },
  { label: "ROTA2", tokens: ["rota2"] },
  { label: "ROTA3", tokens: ["rota3"] },
  { label: "VPI1", tokens: ["vpi1", "vpi_1", "ipv1"] },
  { label: "VPI2", tokens: ["vpi2", "vpi_2", "ipv2"] },
  { label: "VAA", tokens: ["vaa", "yf"] },
  { label: "RR1", tokens: ["rr1", "var1"] },
  { label: "RR2", tokens: ["rr2", "var2"] },
  { label: "VAP1", tokens: ["vap1", "hpv1"] },
  { label: "VAP2", tokens: ["vap2", "hpv2"] },
  { label: "VAP3", tokens: ["vap3", "hpv3"] },
  { label: "VAP4", tokens: ["vap4", "hpv4"] },
];
const AGE_KEYS = ["a0_11", "a12_23", "a24_59"] as const;
const AGE_TOKENS: Record<(typeof AGE_KEYS)[number], string[]> = {
  a0_11: ["0_11", "0a11", "0 11"],
  // « 12_24 » : coquille du formulaire CQD CS (VPO3_12_24_mois) pour 12–23 mois.
  a12_23: ["12_23", "12a23", "12 23", "12_24"],
  a24_59: ["24_59", "24a59", "24 59"],
};

/**
 * Détecte les colonnes « enfants manqués » antigène × âge du formulaire CQD :
 * la feuille du nom doit contenir un jeton d'antigène ET un jeton d'âge ; les
 * colonnes contenant « manq »/« enfant » sont prioritaires en cas d'ambiguïté.
 * Renvoie null si AUCUNE paire n'est trouvée (champs pas encore au formulaire).
 */
function detectMissedAntigenColumns(columns: string[]): Map<string, Partial<Record<(typeof AGE_KEYS)[number], string>>> | null {
  const leafN = (c: string) => norm(c.slice(c.lastIndexOf("/") + 1)).replace(/ /g, "_");
  const out = new Map<string, Partial<Record<(typeof AGE_KEYS)[number], string>>>();
  let found = 0;
  for (const ag of MISSED_ANTIGENS) {
    for (const ageKey of AGE_KEYS) {
      let best: string | null = null;
      let bestScore = -1;
      for (const c of columns) {
        const n = leafN(c);
        if (!ag.tokens.some((t) => n.includes(t))) continue;
        if (!AGE_TOKENS[ageKey].some((t) => n.includes(t.replace(/ /g, "_")))) continue;
        const score = (n.includes("manq") ? 2 : 0) + (n.includes("enfant") ? 1 : 0);
        if (score > bestScore) { bestScore = score; best = c; }
      }
      if (best) {
        if (!out.has(ag.label)) out.set(ag.label, {});
        out.get(ag.label)![ageKey] = best;
        found++;
      }
    }
  }
  return found > 0 ? out : null;
}

function buildRecords(src: CqdFetch): CqdRecord[] {
  const rows = src.rows;
  const columns = getColumns(rows);
  const c = (cands: string[]) => col(columns, cands);

  const province = c(["province", "liste_province"]);
  const antenne = c(["antenne", "liste_antenne"]);
  const zone = c(["zone_sante", "zone de sante", "zone"]);
  const aire = c(["aire_sante", "aire de sante", "aire"]);
  const aireAutre = c(["aire_sante_autre", "preciser l autre aire"]);
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
  // Enfants manqués par antigène × âge + remise des listes aux équipes CS.
  const missedCols = detectMissedAntigenColumns(columns);
  const listeRemiseCol = columns.find((cc) => {
    const n = norm(cc.slice(cc.lastIndexOf("/") + 1));
    return n.includes("liste") && (n.includes("remis") || n.includes("transmis"));
  }) ?? null;

  const grab = (row: RawRow, cc: { p1: string | null; p3: string | null; rr1: string | null; rr2: string | null }) => ({
    p1: cc.p1 ? num(row[cc.p1]) : 0,
    p3: cc.p3 ? num(row[cc.p3]) : 0,
    rr1: cc.rr1 ? num(row[cc.rr1]) : 0,
    rr2: cc.rr2 ? num(row[cc.rr2]) : 0,
  });

  return rows.map((row, i) => {
    const z = zone ? str(row[zone]) : null;
    // AS « Autre à préciser » : le nom réel est dans le champ texte dédié.
    const aSel = aire ? str(row[aire]) : null;
    const a = aSel && norm(aSel).startsWith("autre") && aireAutre && str(row[aireAutre]) ? str(row[aireAutre]) : aSel;
    const e = ess ? str(row[ess]) : null;
    const an = antenne ? str(row[antenne]) : null;
    // Libellés géographiques nettoyés (retrait des suffixes parents encodés
    // « aire_zs_antenne », mise en forme) → filtres sans doublon ni nom collé
    // au parent par underscore/tiret. Les filtres et le prédicat pass()
    // s'appuient sur ces mêmes valeurs : la concordance reste garantie.
    const provRaw = province ? str(row[province]) : null;
    const provClean = provRaw ? prettifyName(provRaw) : null;
    let anClean = an ? prettifyName(canonAntenne(an) ?? an) : null;
    let zoneClean = snapToKnown(cleanStructureName(z, null, an), isKnownZone);
    const aireClean = snapToKnown(cleanStructureName(a, z, an), isKnownAire);
    // Rattachement hiérarchique statique (AS → ZS → antenne, base État de
    // lieux) : corrige les ZS dont l'encodage n'a pas pu être résolu et
    // complète les parents manquants — garantit le matching des filtres
    // (ex. ZS Boende et ses aires de santé au contrôle qualité CS). Au niveau
    // ZS, le champ « aire » agrège plusieurs aires : pas de rattachement par aire.
    const parent = src.key === "as" ? zoneOfAire(aireClean) : null;
    if (parent) {
      if (!zoneClean || !isKnownZone(zoneClean)) zoneClean = parent.zone;
      if (!anClean) anClean = parent.antenne;
    }
    if (zoneClean && !anClean) anClean = antenneOfZone(zoneClean);
    const structure = src.key === "zs" ? zoneClean : (aireClean ?? cleanStructureName(e, z, an));
    return {
      id: `cqd-${src.key}-${i}`,
      level: src.key,
      derived: false,
      province: provClean,
      antenne: anClean,
      zone: zoneClean,
      aire: aireClean,
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
      manquesAntigene: missedCols
        ? (() => {
            const m: Record<string, { a0_11: number; a12_23: number; a24_59: number }> = {};
            for (const [label, cols] of missedCols.entries()) {
              m[label] = {
                a0_11: cols.a0_11 ? num(row[cols.a0_11]) : 0,
                a12_23: cols.a12_23 ? num(row[cols.a12_23]) : 0,
                a24_59: cols.a24_59 ? num(row[cols.a24_59]) : 0,
              };
            }
            return m;
          })()
        : null,
      listeRemise: listeRemiseCol ? boolFr(row[listeRemiseCol]) : null,
    };
  });
}

/* ---------- Dérivation des aires de santé depuis le formulaire CQD ZS ---------- */

type SourceKey = "registre" | "pointage" | "snis" | "dhis2";
const SOURCE_KEYS: SourceKey[] = ["registre", "pointage", "snis", "dhis2"];
const CQD_ANTIGENS: { key: keyof Antigen4; tokens: string[] }[] = [
  { key: "p1", tokens: ["penta1", "p1"] },
  { key: "p3", tokens: ["penta3", "p3"] },
  { key: "rr1", tokens: ["rr1"] },
  { key: "rr2", tokens: ["rr2"] },
];

interface PerAireColumns {
  /** Colonne du nom de l'aire échantillonnée (si le formulaire l'expose). */
  name: string | null;
  /** Colonnes de valeurs par source × antigène. */
  vals: Partial<Record<SourceKey, Partial<Record<keyof Antigen4, string>>>>;
}

/**
 * Détecte les colonnes « par aire échantillonnée » du formulaire CQD ZS (le
 * contrôle ZS porte sur un échantillon d'aires ; les champs s_snis_* /
 * s_dhis2_* en sont les sommes). La détection travaille sur les jetons du
 * chemin complet de la colonne (groupes Kobo inclus) pour être robuste aux
 * nommages : indice d'aire = jeton « as1 » / « aire 2 » / « a3 » ou chiffre
 * isolé 1–3 ; une colonne de VALEUR combine indice + source (registre,
 * pointage, snis, dhis2) + antigène ; une colonne de NOM combine indice +
 * « aire »/« as » sans source ni antigène. Renvoie null si aucune structure
 * par aire n'est détectée.
 */
function detectPerAireColumns(columns: string[]): Map<number, PerAireColumns> | null {
  const out = new Map<number, PerAireColumns>();
  const entry = (idx: number): PerAireColumns => {
    if (!out.has(idx)) out.set(idx, { name: null, vals: {} });
    return out.get(idx)!;
  };
  let foundVals = 0;
  for (const c of columns) {
    const toks = norm(c).split(" ").filter(Boolean);
    let idx: number | null = null;
    let idxIsExplicit = false;
    for (const t of toks) {
      const m = t.match(/^(as|aire|a)?([123])$/);
      if (m) {
        idx = Number(m[2]);
        idxIsExplicit = !!m[1];
        if (idxIsExplicit) break;
      }
    }
    if (idx === null) continue;
    const srcTok = SOURCE_KEYS.find((s2) => toks.includes(s2));
    const antigen = CQD_ANTIGENS.find((a) => a.tokens.some((t) => toks.includes(t)));
    if (srcTok && antigen) {
      const e = entry(idx);
      if (!e.vals[srcTok]) e.vals[srcTok] = {};
      if (!e.vals[srcTok]![antigen.key]) {
        e.vals[srcTok]![antigen.key] = c;
        foundVals++;
      }
    } else if (!srcTok && !antigen && (toks.includes("aire") || toks.includes("as") || idxIsExplicit) && toks.some((t) => ["aire", "as", "nom", "sante"].includes(t))) {
      const e = entry(idx);
      if (!e.name) e.name = c;
    }
  }
  return out.size > 0 && (foundVals > 0 || Array.from(out.values()).some((e) => e.name)) ? out : null;
}

/**
 * Dérive des enregistrements de niveau AS depuis les soumissions du formulaire
 * CQD « Zone de santé » : certaines ZS (ex. Boende) n'ont été contrôlées que
 * via le formulaire ZS, dont l'échantillon liste pourtant les aires de santé
 * visitées. Sans dérivation, les pages « Contrôle qualité — Centres de santé »
 * restent vides pour ces ZS alors que les données existent dans Kobo.
 *
 * Chaque aire échantillonnée devient un enregistrement `derived` rattaché à la
 * ZS de la soumission, portant les valeurs PAR AIRE détectées (souvent
 * seulement SNIS/DHIS2 — seules sources disponibles au niveau ZS). À défaut de
 * colonnes par aire, les noms sont extraits du champ multi-aires : les
 * structures apparaissent alors sans valeurs chiffrées (jamais de chiffres
 * inventés). Les champs non disponibles par aire restent vides/neutres.
 */
function buildDerivedAsRecords(src: CqdFetch): CqdRecord[] {
  if (src.key !== "zs" || src.rows.length === 0) return [];
  const columns = getColumns(src.rows);
  const c = (cands: string[]) => col(columns, cands);
  const province = c(["province", "liste_province"]);
  const antenne = c(["antenne", "liste_antenne"]);
  const zone = c(["zone_sante", "zone de sante", "zone"]);
  const aire = c(["aire_sante", "aire de sante", "aire"]);
  const dateCol = c(["date_supervision", "date de supervision", "date", "today", "end"]);
  const typeCol = c(["Type_de_supervision", "type de supervision", "type_supervision"]);
  const perAire = detectPerAireColumns(columns);

  const out: CqdRecord[] = [];
  src.rows.forEach((row, i) => {
    const zRaw = zone ? str(row[zone]) : null;
    const anRaw = antenne ? str(row[antenne]) : null;
    const provRaw = province ? str(row[province]) : null;
    let zoneClean = snapToKnown(cleanStructureName(zRaw, null, anRaw), isKnownZone);
    let anClean = anRaw ? prettifyName(canonAntenne(anRaw) ?? anRaw) : null;
    if (zoneClean && !anClean) anClean = antenneOfZone(zoneClean);
    const month = normalizeCqdMonth(dateCol ? toMonth(row[dateCol]) : null);
    const typeLabel = typeCol ? resolveTypeLabel(row[typeCol]) : resolveTypeLabel(null);
    // Aires échantillonnées : champ multi-aires (codes XML séparés par des
    // espaces) — sert de repli pour nommer les aires sans colonne dédiée.
    const multi = aire ? str(row[aire]) : null;
    const multiNames = (multi ? multi.split(/\s+/).filter(Boolean) : []).map((raw2) =>
      snapToKnown(cleanStructureName(raw2, zRaw, anRaw), isKnownAire)
    );

    const emptyA4 = (): Antigen4 => ({ p1: 0, p3: 0, rr1: 0, rr2: 0 });
    const grabAire = (cols: Partial<Record<keyof Antigen4, string>> | undefined): Antigen4 => ({
      p1: cols?.p1 ? num(row[cols.p1]) : 0,
      p3: cols?.p3 ? num(row[cols.p3]) : 0,
      rr1: cols?.rr1 ? num(row[cols.rr1]) : 0,
      rr2: cols?.rr2 ? num(row[cols.rr2]) : 0,
    });

    // Indices d'aires couverts : colonnes par aire détectées, sinon autant
    // d'entrées que de noms dans le champ multi-aires.
    const indices = perAire ? Array.from(perAire.keys()).sort((a, b) => a - b) : multiNames.map((_, k) => k + 1);
    for (const idx of indices) {
      const e = perAire?.get(idx);
      const rawName = e?.name ? str(row[e.name]) : null;
      const nameClean = rawName
        ? snapToKnown(cleanStructureName(rawName, zRaw, anRaw), isKnownAire)
        : multiNames[idx - 1] ?? null;
      if (!nameClean) continue;
      const hasVals = e ? SOURCE_KEYS.some((s2) => e.vals[s2] && Object.keys(e.vals[s2]!).length > 0) : false;
      const rec: CqdRecord = {
        id: `cqd-zs-as-${i}-${idx}`,
        level: "as",
        derived: true,
        province: provRaw ? prettifyName(provRaw) : null,
        antenne: anClean,
        zone: zoneClean,
        aire: nameClean,
        structure: nameClean,
        month,
        typeLabel,
        registre: hasVals ? grabAire(e!.vals.registre) : emptyA4(),
        pointage: hasVals ? grabAire(e!.vals.pointage) : emptyA4(),
        snis: hasVals ? grabAire(e!.vals.snis) : emptyA4(),
        dhis2: hasVals ? grabAire(e!.vals.dhis2) : emptyA4(),
        nbValeursVerifiees: 0,
        nbDiscordSnisDhis2: 0,
        nbDiscordPointageRegistre: 0,
        registreCorrect: null,
        pointageCorrect: null,
        snisCorrect: null,
        enfantsARecuperer: 0,
        enfantsIdentifies: 0,
        enfantsRetrouves: 0,
        enfantsRecuperes: 0,
        manquesAntigene: null,
        listeRemise: null,
      };
      out.push(rec);
    }
  });
  return out;
}

function pass(r: CqdRecord, f: CqdFilters): boolean {
  if (f.province && r.province && norm(r.province) !== norm(f.province)) return false;
  if (f.antenne && r.antenne && norm(canonAntenne(r.antenne) ?? "") !== norm(canonAntenne(f.antenne) ?? "")) return false;
  if (f.zone && r.zone && norm(r.zone) !== norm(f.zone)) {
    // Repli hiérarchique : une AS dont la ZS encodée n'a pas pu être résolue
    // reste rattachée à sa ZS canonique via la hiérarchie provinciale.
    const p = zoneOfAire(r.aire);
    if (!p || norm(p.zone) !== norm(f.zone)) return false;
  }
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

/** Vrai si la source est renseignée (au moins une valeur > 0) dans le jeu d'enregistrements. */
const hasSource = (records: CqdRecord[], pick: (r: CqdRecord) => Antigen4) =>
  records.some((r) => ANTIGEN_KEYS.some((k) => pick(r)[k] > 0));

/**
 * discordRate PROTÉGÉ pour les enregistrements dérivés du formulaire ZS : une
 * source entièrement absente (registre/pointage jamais collectés au niveau ZS)
 * ne doit pas compter comme « discordance à 100 % » — le taux est alors
 * inconnu (null), pas une erreur systématique. Les soumissions CS réelles
 * conservent la règle d'origine (un 0 face à une valeur = discordance).
 */
function guardedRate(records: CqdRecord[], srcA: (r: CqdRecord) => Antigen4, srcB: (r: CqdRecord) => Antigen4): number | null {
  if (records.length && records.every((r) => r.derived) && (!hasSource(records, srcA) || !hasSource(records, srcB))) return null;
  return discordRate(records, srcA, srcB);
}

/** Taux d'erreur de transcription SNIS → DHIS2 (niveau ZS : DHIS2 saisi à la ZS). */
const errSnisDhis2 = (records: CqdRecord[]) => guardedRate(records, (r) => r.snis, (r) => r.dhis2);
/** Taux d'erreur de transcription feuille de pointage → registre. */
const errPointageRegistre = (records: CqdRecord[]) => guardedRate(records, (r) => r.pointage, (r) => r.registre);
/** Taux d'erreur de transcription registre → SNIS. */
const errRegistreSnis = (records: CqdRecord[]) => guardedRate(records, (r) => r.registre, (r) => r.snis);

function buildLevel(level: "zs" | "as", records: CqdRecord[]): CqdLevelBundle {
  // AGRÉGATS PROTÉGÉS : les enregistrements dérivés du formulaire ZS sont
  // partiels (souvent SNIS/DHIS2 seuls) — mêlés aux soumissions CS réelles,
  // ils biaiseraient les sommes globales (ex. SNIS gonflé sans registre en
  // face). Les agrégats de niveau (cards, antigènes, tendance, erreurs) ne
  // les incluent donc que si la sélection ne contient QUE des dérivés
  // (ex. filtre ZS Boende) ; les tableaux par structure les affichent
  // toujours, chaque ratio y étant calculé au sein de la même structure.
  const real = records.filter((r) => !r.derived);
  const agg = real.length ? real : records;
  const sumOf = (pick: (r: CqdRecord) => number) => agg.reduce((a, r) => a + pick(r), 0);

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
    const vals = agg.map(pick).filter((v): v is boolean => v !== null);
    return vals.length ? r1((vals.filter(Boolean).length / vals.length) * 100) : null;
  };

  const eIdent = sumOf((r) => r.enfantsIdentifies);
  const eRetr = sumOf((r) => r.enfantsRetrouves);
  const eRecup = sumOf((r) => r.enfantsRecuperes);
  const eARec = sumOf((r) => r.enfantsARecuperer);

  // Évolution mensuelle.
  const byMonth = new Map<string, CqdRecord[]>();
  for (const r of agg) {
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
    // Structure dérivée sans registre collecté → « — » plutôt qu'un faux 0 %.
    const regAbsent = recs.every((r) => r.derived) && !hasSource(recs, (r) => r.registre);
    const snisP3s = s((r) => r.snis.p3); const snisR2s = s((r) => r.snis.rr2);
    const tauxRSP3 = snisP3s > 0 && !regAbsent ? r1((s((r) => r.registre.p3) / snisP3s) * 100) : null;
    const tauxRSR2 = snisR2s > 0 && !regAbsent ? r1((s((r) => r.registre.rr2) / snisR2s) * 100) : null;
    const outilsOk = recs.reduce((a, r) => a + ((r.registreCorrect ? 1 : 0) + (r.pointageCorrect ? 1 : 0) + (r.snisCorrect ? 1 : 0)), 0);
    return {
      name,
      zone: recs[0]?.zone ?? null,
      derived: recs.every((r) => r.derived),
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

  // ---- Concordance niveau CS : Fiche de pointage → Registre → SNIS. ----
  // Taux de concordance = valeur transcrite / référence × 100 :
  //  · SNIS/Registre   = SNIS transcrit du registre (réf. = registre)
  //  · Registre/Pointage = registre compilé depuis la feuille de pointage (réf. = pointage)
  const csMonths = Array.from(new Set(records.map((r) => r.month).filter((m): m is string => !!m))).sort();
  const ratio = (numv: number, denv: number) => (denv > 0 ? r1((numv / denv) * 100) : null);
  const antDefs: [string, keyof Antigen4][] = [["PENTA1", "p1"], ["PENTA3", "p3"], ["RR1", "rr1"], ["RR2", "rr2"]];
  const sumKeys = (recs: CqdRecord[], src: (r: CqdRecord) => Antigen4) =>
    recs.reduce((a, r) => a + ANTIGEN_KEYS.reduce((s, k) => s + src(r)[k], 0), 0);

  const buildConcTable = (numSrc: (r: CqdRecord) => Antigen4, denSrc: (r: CqdRecord) => Antigen4): CqdConcordanceAS[] =>
    Array.from(byStruct.entries())
      .map(([name, recs]) => ({
        name,
        zone: recs[0]?.zone ?? null,
        antigenes: antDefs.map(([antigene, k]) => ({
          antigene,
          byMonth: csMonths.map((m) => {
            const mr = recs.filter((r) => r.month === m);
            return ratio(mr.reduce((a, r) => a + numSrc(r)[k], 0), mr.reduce((a, r) => a + denSrc(r)[k], 0));
          }),
        })),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

  // Cards globales (tous antigènes, toutes AS) — agrégats protégés.
  const totSnis = sumKeys(agg, (r) => r.snis);
  const totReg = sumKeys(agg, (r) => r.registre);
  const totPoi = sumKeys(agg, (r) => r.pointage);

  const totDhis2 = sumKeys(agg, (r) => r.dhis2);

  // Décompte des structures en sous-/sur-rapportage (tous antigènes confondus) :
  //  · AS → base SNIS/Registre ; · ZS → base DHIS2/SNIS.
  let asSous = 0, asSur = 0, zsSous = 0, zsSur = 0;
  for (const recs of byStruct.values()) {
    const tAs = ratio(sumKeys(recs, (r) => r.snis), sumKeys(recs, (r) => r.registre));
    if (tAs !== null) { if (tAs < 95) asSous++; else if (tAs > 105) asSur++; }
    const tZs = ratio(sumKeys(recs, (r) => r.dhis2), sumKeys(recs, (r) => r.snis));
    if (tZs !== null) { if (tZs < 95) zsSous++; else if (tZs > 105) zsSur++; }
  }

  const csConcordance = {
    months: csMonths,
    globalSnisRegistre: ratio(totSnis, totReg),
    globalRegistrePointage: ratio(totReg, totPoi),
    globalDhis2Snis: ratio(totDhis2, totSnis),
    asSousRapportage: asSous,
    asSurRapportage: asSur,
    zsSousRapportage: zsSous,
    zsSurRapportage: zsSur,
    parAntigene: antDefs.map(([antigene, k]) => {
      const sn = agg.reduce((a, r) => a + r.snis[k], 0);
      const rg = agg.reduce((a, r) => a + r.registre[k], 0);
      const po = agg.reduce((a, r) => a + r.pointage[k], 0);
      const dh = agg.reduce((a, r) => a + r.dhis2[k], 0);
      return { antigene, snisRegistre: ratio(sn, rg), registrePointage: ratio(rg, po), dhis2Snis: ratio(dh, sn) };
    }),
    snisRegistre: buildConcTable((r) => r.snis, (r) => r.registre),
    registrePointage: buildConcTable((r) => r.registre, (r) => r.pointage),
    dhis2Snis: buildConcTable((r) => r.dhis2, (r) => r.snis),
  };

  // Enfants manqués par antigène × âge, par structure (si champs présents).
  const withMissed = records.filter((r) => r.manquesAntigene !== null);
  const missedAntigenes = MISSED_ANTIGENS.map((a) => a.label);
  const manquesParAntigene = {
    available: withMissed.length > 0,
    antigenes: missedAntigenes,
    structures: withMissed.length
      ? Array.from(byStruct.entries())
          .map(([name, recs]) => {
            const values: Record<string, { a0_11: number; a12_23: number; a24_59: number }> = {};
            for (const label of missedAntigenes) {
              const acc = { a0_11: 0, a12_23: 0, a24_59: 0 };
              for (const r of recs) {
                const v = r.manquesAntigene?.[label];
                if (v) { acc.a0_11 += v.a0_11; acc.a12_23 += v.a12_23; acc.a24_59 += v.a24_59; }
              }
              values[label] = acc;
            }
            return { name, values };
          })
          .sort((a, b) => a.name.localeCompare(b.name))
      : [],
  };
  const listesVals = agg.map((r) => r.listeRemise).filter((v): v is boolean => v !== null);
  const listesRemisesPct = listesVals.length ? r1((listesVals.filter(Boolean).length / listesVals.length) * 100) : null;

  return {
    level,
    records: records.length,
    structuresControlees: byStruct.size,
    derivedRecords: records.length - real.length,
    derivedStructures: parStructure.filter((p) => p.derived).map((p) => p.name),
    concordanceP3: concordance(dhis2P3, refP3),
    concordanceRr2: concordance(dhis2Rr2, refRr2),
    erreurSnisDhis2: errSnisDhis2(agg),
    erreurPointageRegistre: errPointageRegistre(agg),
    erreurRegistreSnis: errRegistreSnis(agg),
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
    manquesParAntigene,
    listesRemisesPct,
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
    csConcordance,
    trend,
    parStructure,
  };
}

function uniq(values: (string | null)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
}

export function buildCqdBundle(sources: CqdFetch[], filters: CqdFilters): CqdBundle {
  const parsed = sources.map((s) => ({ src: s, records: buildRecords(s) }));

  // Aires dérivées du formulaire ZS (ZS contrôlées sans soumission CS directe,
  // ex. Boende). Dédoublonnage : une aire déjà contrôlée via le formulaire CS
  // sur le même mois n'est pas dérivée une seconde fois.
  const realAs = parsed.find((p) => p.src.key === "as")?.records ?? [];
  const seenAs = new Set(realAs.map((r) => `${norm(r.aire ?? r.structure ?? "")}|${r.month ?? ""}`));
  const zsSrc = sources.find((s) => s.key === "zs");
  const derivedAs = (zsSrc ? buildDerivedAsRecords(zsSrc) : []).filter(
    (r) => !seenAs.has(`${norm(r.aire ?? "")}|${r.month ?? ""}`)
  );

  const allUnfiltered = [...parsed.flatMap((p) => p.records), ...derivedAs];

  const byLevel: Record<"zs" | "as", CqdRecord[]> = { zs: [], as: [] };
  for (const p of parsed) {
    byLevel[p.src.key] = p.records.filter((r) => pass(r, filters));
  }
  byLevel.as = byLevel.as.concat(derivedAs.filter((r) => pass(r, filters)));
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
      // L'aire de santé n'a de sens qu'au niveau AS : au niveau ZS, le champ
      // « aire » est un agrégat des aires échantillonnées (valeurs combinées)
      // qui pollueraient la liste — on ne retient donc que les aires des AS.
      aires: uniq(allUnfiltered.filter((r) => r.level === "as").map((r) => r.aire)),
      months: uniq(allUnfiltered.map((r) => r.month)),
      types: uniq(allUnfiltered.map((r) => r.typeLabel)),
      // Tuples géographiques (antennes canonicalisées) → filtres en cascade
      // Province → Antenne → ZS → Aire, dérivés des données de CET onglet.
      // L'aire n'est renseignée que pour les enregistrements AS (au niveau ZS
      // elle agrège plusieurs aires → on la met à null pour ne pas l'afficher).
      geo: allUnfiltered.map((r) => ({
        province: r.province,
        antenne: canonAntenne(r.antenne),
        zone: r.zone,
        aire: r.level === "as" ? r.aire : null,
      })),
    },
    levels: {
      zs: buildLevel("zs", byLevel.zs),
      as: buildLevel("as", byLevel.as),
    },
  };
}

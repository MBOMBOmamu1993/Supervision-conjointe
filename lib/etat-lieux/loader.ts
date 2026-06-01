/**
 * Lecture de l'Excel « État de lieux » (data/etat_lieux.xlsx), côté serveur.
 *
 * Le classeur comporte des en-têtes parfois fusionnés / colonnes « __EMPTY ».
 * On cible donc les feuilles à en-têtes propres et on agrège par Zone de santé,
 * conformément à la spec (synthèses par ZS + tableaux détaillés par AS).
 */
import * as XLSX from "xlsx";
import { readFileSync } from "fs";
import { join } from "path";
import type { EtatBundle, EtatRow, EtatSheet } from "./types";

let cache: { at: number; value: EtatBundle } | null = null;
const TTL_MS = 10 * 60 * 1000;

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
function cleanZs(v: unknown): string {
  // Normalise les préfixes parasites « ZS »/« AS » présents dans la source.
  return String(v ?? "").replace(/^(ZS|AS)\s+/i, "").trim();
}
const sum = (xs: (number | null)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);
const avg = (xs: (number | null)[]) => {
  const v = xs.filter((n): n is number => n !== null);
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
};

function loadWorkbook(): XLSX.WorkBook {
  const path = join(process.cwd(), "data", "etat_lieux.xlsx");
  return XLSX.read(readFileSync(path), { type: "buffer" });
}

function sheetRows(wb: XLSX.WorkBook, name: string): EtatRow[] {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json<EtatRow>(ws, { defval: null, raw: true });
}

/** Trouve une feuille dont le nom contient le fragment (insensible casse/espaces). */
function findSheet(wb: XLSX.WorkBook, fragment: string): string | null {
  const f = fragment.toLowerCase().replace(/\s+/g, "");
  return wb.SheetNames.find((n) => n.toLowerCase().replace(/\s+/g, "").includes(f)) ?? null;
}

export function loadEtatBundle(): EtatBundle {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const wb = loadWorkbook();

  // --- Stratégies de vaccination (en-têtes propres) ---
  const stratName = findSheet(wb, "STRATEGIES");
  const strat = stratName ? sheetRows(wb, stratName) : [];
  const stratByZs = new Map<string, EtatRow[]>();
  for (const r of strat) {
    const zs = cleanZs(r["Zone de Santé"]);
    if (!zs) continue;
    if (!stratByZs.has(zs)) stratByZs.set(zs, []);
    stratByZs.get(zs)!.push(r);
  }
  const strategiesParZs = Array.from(stratByZs.entries()).map(([zs, rows]) => ({
    zs,
    fixes: avg(rows.map((r) => { const v = num(r["% Fixes réalisées"]); return v === null ? null : v * 100; })),
    avancees: avg(rows.map((r) => { const v = num(r["% Avancées réalisées"]); return v === null ? null : v * 100; })),
    mobiles: avg(rows.map((r) => { const v = num(r["% Mobiles  réalisées"]); return v === null ? null : v * 100; })),
    nbAs: rows.length,
  })).sort((a, b) => a.zs.localeCompare(b.zs));

  // --- Participation communautaire ---
  const partiName = findSheet(wb, "Parti_Com");
  const parti = partiName ? sheetRows(wb, partiName) : [];
  const partiByZs = new Map<string, EtatRow[]>();
  for (const r of parti) {
    const zs = cleanZs(r["Zone de Santé"]);
    if (!zs) continue;
    if (!partiByZs.has(zs)) partiByZs.set(zs, []);
    partiByZs.get(zs)!.push(r);
  }
  const communautaireParZs = Array.from(partiByZs.entries()).map(([zs, rows]) => ({
    zs,
    recoActifs: sum(rows.map((r) => num(r["RECO actifs"]))),
    recoFormes: sum(rows.map((r) => num(r["RECO formés"]))),
    eglises: sum(rows.map((r) => num(r["Nombre\n Eglises"] ?? r["Nombre Eglises"]))),
    nbAs: rows.length,
  })).sort((a, b) => a.zs.localeCompare(b.zs));

  // --- Chaîne de froid (synthèse par ZS, colonnes dédiées ZS_1/Nbr AS/...) ---
  const froidName = findSheet(wb, "Chaine de froid");
  const froid = froidName ? sheetRows(wb, froidName) : [];
  const chaineFroidParZs = froid
    .filter((r) => str(r["ZS_1"]))
    .map((r) => ({
      zs: cleanZs(r["ZS_1"]),
      nbAs: num(r["Nbr AS"]),
      asFrigo: num(r["AS avec refrigérateur "] ?? r["AS avec refrigérateur"]),
      cvFroid: (() => { const v = num(r["CV en chaine de froid "] ?? r["CV en chaine de froid"]); return v === null ? null : Math.round(v * 1000) / 10; })(),
    }));

  // --- Cartographie PTF ---
  const ptfName = findSheet(wb, "Cartographie");
  const ptf = ptfName ? sheetRows(wb, ptfName) : [];
  const partnerCols = ptf.length ? Object.keys(ptf[0]).filter((c) => c !== "Zone de santé") : [];
  const partenairesParZs = ptf
    .filter((r) => str(r["Zone de santé"]))
    .map((r) => ({
      zs: cleanZs(r["Zone de santé"]),
      interventions: partnerCols
        .map((p) => ({ partenaire: p, activite: String(r[p] ?? "").trim() }))
        .filter((x) => x.activite && x.activite.toUpperCase() !== "RAS"),
    }));

  // --- Couverture vaccinale ajustée par ZS ---
  const cvName = findSheet(wb, "CV ajustée");
  const cv = cvName ? sheetRows(wb, cvName) : [];
  const couverture = cv
    .filter((r) => str(r["ZS"]))
    .map((r) => ({
      zs: cleanZs(r["ZS"]),
      penta1: num(r["Penta1"]),
      penta3: num(r["Penta3"]),
      var1: num(r["VAR1"]),
      vaa: num(r["VAA"]),
    }));

  // --- Infos générales ZS ---
  const infoName = findSheet(wb, "Info générale");
  const infoZsRaw = infoName ? sheetRows(wb, infoName) : [];
  const infoZs = infoZsRaw.filter((r) => str(r["ZONE DE SANTE "] ?? r["ZONE DE SANTE"]));
  const infoZsColumns = infoZs.length
    ? Object.keys(infoZs[0]).filter((c) => !c.startsWith("__EMPTY") && infoZs.some((r) => r[c] !== null))
    : [];

  // --- Synthèse globale (page 1) ---
  const antennes = new Set(strat.map((r) => str(r["Antenne"])).filter(Boolean)).size
    || new Set(parti.map((r) => str(r["Antenne"])).filter(Boolean)).size;
  const zones = stratByZs.size || partiByZs.size;
  const aires = strat.length || parti.length;

  const summary = {
    antennes,
    zones,
    aires,
    essTotal: null,
    essVaccinent: null,
    popAdmin: null,
    popAjustee: null,
    cible0_11Admin: null,
    cible0_11Ajustee: null,
  };

  // --- Feuilles détaillées brutes (tableaux par AS) ---
  const detailSheets: { key: string; label: string; name: string | null }[] = [
    { key: "strategies", label: "Stratégies de vaccination par AS", name: stratName },
    { key: "communautaire", label: "Participation communautaire par AS", name: partiName },
    { key: "froid", label: "Chaîne de froid (équipements)", name: froidName },
    { key: "couverture", label: "Couverture vaccinale ajustée 2025", name: cvName },
    { key: "ptf", label: "Cartographie des interventions PTF", name: ptfName },
  ];
  const sheets: EtatSheet[] = detailSheets
    .filter((s) => s.name)
    .map((s) => {
      const rows = sheetRows(wb, s.name!);
      const columns = rows.length
        ? Object.keys(rows[0]).filter((c) => !c.startsWith("__EMPTY") && rows.some((r) => r[c] !== null))
        : [];
      // limiter le volume transféré
      return { key: s.key, label: s.label, columns, rows: rows.filter((r) => columns.some((c) => r[c] !== null)).slice(0, 400) };
    });

  const bundle: EtatBundle = {
    generatedAt: new Date().toISOString(),
    summary,
    couverture,
    strategiesParZs,
    communautaireParZs,
    chaineFroidParZs,
    partenairesParZs,
    infoZs,
    infoZsColumns,
    sheets,
  };
  cache = { at: Date.now(), value: bundle };
  return bundle;
}

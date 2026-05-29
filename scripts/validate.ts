/* Validation hors-ligne du pipeline analytique avec des exports Kobo réels. */
import * as XLSX from "xlsx";
import { buildBundle } from "@/lib/supervision/analytics";
import type { SourceFetch } from "@/lib/supervision/kobo-client";
import type { StructureLevel } from "@/config/supervision.config";

function parse(file: string): Record<string, unknown>[] {
  const wb = XLSX.readFile(file);
  let best: Record<string, unknown>[] = [];
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name], { defval: null, raw: false });
    if (rows.length > best.length) best = rows;
  }
  return best;
}

const U = process.argv[2];
const srcDefs: { level: StructureLevel; label: string; file: string }[] = [
  { level: "zs", label: "ZS", file: `${U}/4c3e4972-Checklist_supervision_PEV_Zone_de_Sant___Tshuapa__all_versions__labels__20260529065255.xlsx` },
  { level: "as", label: "CS", file: `${U}/4a12365c-Checklist_supervision_PEV__Centre_de_Sant___Tshuapa__all_versions__Fran_ais__20260529203207.xlsx` },
];

const sources: SourceFetch[] = srcDefs.map((d) => ({ level: d.level, label: d.label, rows: parse(d.file), ok: true }));
sources.push({ level: "antenne", label: "Antenne", rows: [], ok: true });

const targets = { conjointe_pev_oms: null, conjointe_mca: null, mca_seul: null, ecz_seul: null, antennes: null, zs_conjointe: null, zs_mca: null, cs_conjointe: null, cs_ecz: null };
const b = buildBundle(sources as SourceFetch[], {}, targets);

console.log("MONTHS:", b.meta.months);
console.log("SOURCES:", b.meta.sources.map((s) => `${s.label}:${s.rows}`).join(" "));
console.log("\nKPI:", JSON.stringify(b.kpi, null, 1));
for (const lvl of ["zs", "as"] as StructureLevel[]) {
  const L = b.levels[lvl];
  console.log(`\n=== ${lvl} === records=${L.records} score=`, L.score);
  console.log("  composantes:", L.composantes.map((c) => `${c.short}=${c.score}`).join(" | "));
  console.log("  cotations:", L.cotations.map((c) => `${c.label}:${c.count}`).join(" "));
  console.log("  perStructure:", L.perStructure.map((s) => `${s.name}=${s.score}%(n${s.count})`).join(" "));
  console.log("  topNon:", L.topNon.map((t) => `[${t.pct}% ${t.question.slice(0, 40)}]`).join(" "));
  console.log("  radar entities:", L.radar.entities.map((e) => `${e.name}:${e.values.join(",")}`).join(" | "));
}
console.log("\nHIGHLIGHTS:", JSON.stringify(b.highlights, null, 1));

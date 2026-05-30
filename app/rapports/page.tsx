"use client";

import { Card, CardHeader, SectionBar } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { DataGate } from "@/components/ui/DataGate";
import { Icon } from "@/components/ui/Icon";
import { fmtNum, fmtPct } from "@/lib/client/format";
import { LEVEL_LABEL, type StructureLevel } from "@/config/supervision.config";
import type { SupervisionBundle } from "@/lib/supervision/types";

function exportCsv(d: SupervisionBundle) {
  const lines: string[] = ["Niveau;Structure;Score(%);Supervisions"];
  (["antenne", "zs", "as"] as StructureLevel[]).forEach((lvl) => {
    d.levels[lvl].perStructure.forEach((s) => {
      lines.push(`${LEVEL_LABEL[lvl].short};${s.name};${s.score ?? ""};${s.count}`);
    });
  });
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `supervision-conjointe-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function RapportsPage() {
  return (
    <div className="space-y-4">
      <DataGate>
        {(d) => (
          <>
            {/* Indicateurs de synthèse */}
            <section>
              <SectionBar icon="bars">Indicateurs de synthèse</SectionBar>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <KpiCard icon="doc" tone="navy" label="Total supervisions" value={fmtNum(d.kpi.total_supervisions)} sub="Toutes structures" />
                <KpiCard icon="clinic" tone="brand" label="Structures (conjointe)" value={fmtNum(d.kpi.structures_conjointe)} sub="CS · ZS · Antennes" />
                <KpiCard icon="tower" tone="good" label="Score moyen antennes" value={fmtPct(d.levels.antenne.score.moyen)} sub="Supervision conjointe" />
                <KpiCard icon="hospital" tone="teal" label="Score moyen ZS" value={fmtPct(d.levels.zs.score.moyen)} sub="Supervision conjointe" />
              </div>
            </section>

            {/* Exports */}
            <section>
              <SectionBar icon="report">Rapports & exports</SectionBar>
              <Card>
                <CardHeader
                  icon="doc"
                  iconTone="navy"
                  title="Exporter les données de supervision"
                  subtitle="Générez un fichier exploitable ou imprimez la synthèse complète du tableau de bord."
                />
                <div className="flex flex-wrap gap-2.5">
                  <button className="btn-primary" onClick={() => exportCsv(d)}>
                    <Icon name="bars" className="w-4 h-4" /> Exporter en CSV (Excel)
                  </button>
                  <button className="btn" onClick={() => window.print()}>
                    <Icon name="report" className="w-4 h-4" /> Imprimer / PDF
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="rounded-xl border border-surface-200 bg-surface-50/60 p-3.5 flex items-center gap-3">
                    <span className="w-[38px] h-[38px] rounded-full text-white flex items-center justify-center shrink-0" style={{ backgroundImage: "linear-gradient(145deg,#36b3ec,#0093d5)" }}><Icon name="tower" className="w-4 h-4" /></span>
                    <div>
                      <div className="text-[9.5px] uppercase tracking-wider text-surface-700 font-bold">{LEVEL_LABEL.antenne.plural}</div>
                      <div className="text-[15px] font-extrabold text-navy-700">{fmtNum(d.levels.antenne.perStructure.length)} structures</div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-surface-200 bg-surface-50/60 p-3.5 flex items-center gap-3">
                    <span className="w-[38px] h-[38px] rounded-full text-white flex items-center justify-center shrink-0" style={{ backgroundImage: "linear-gradient(145deg,#9d5cf5,#7c3aed)" }}><Icon name="hospital" className="w-4 h-4" /></span>
                    <div>
                      <div className="text-[9.5px] uppercase tracking-wider text-surface-700 font-bold">{LEVEL_LABEL.zs.plural}</div>
                      <div className="text-[15px] font-extrabold text-[#6d28d9]">{fmtNum(d.levels.zs.perStructure.length)} structures</div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-surface-200 bg-surface-50/60 p-3.5 flex items-center gap-3">
                    <span className="w-[38px] h-[38px] rounded-full text-white flex items-center justify-center shrink-0" style={{ backgroundImage: "linear-gradient(145deg,#2bbd6b,#1f9d57)" }}><Icon name="clinic" className="w-4 h-4" /></span>
                    <div>
                      <div className="text-[9.5px] uppercase tracking-wider text-surface-700 font-bold">{LEVEL_LABEL.as.plural}</div>
                      <div className="text-[15px] font-extrabold text-[#178a44]">{fmtNum(d.levels.as.perStructure.length)} structures</div>
                    </div>
                  </div>
                </div>
              </Card>
            </section>
          </>
        )}
      </DataGate>
    </div>
  );
}

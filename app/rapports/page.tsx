"use client";

import { Card, CardHeader, SectionBar } from "@/components/ui/Card";
import { DataGate } from "@/components/ui/DataGate";
import { fmtPct } from "@/lib/client/format";
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
      <SectionBar>Rapports & exports</SectionBar>
      <DataGate>
        {(d) => (
          <Card>
            <CardHeader title="Exporter les données de supervision" subtitle="Générez un fichier ou imprimez la synthèse." />
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" onClick={() => exportCsv(d)}>Exporter en CSV (Excel)</button>
              <button className="btn" onClick={() => window.print()}>Imprimer / PDF</button>
            </div>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <div className="rounded border border-surface-200 p-3"><div className="kpi-label">Total supervisions</div><div className="kpi-value mt-1">{d.kpi.total_supervisions}</div></div>
              <div className="rounded border border-surface-200 p-3"><div className="kpi-label">Structures (conjointe)</div><div className="kpi-value mt-1">{d.kpi.structures_conjointe}</div></div>
              <div className="rounded border border-surface-200 p-3"><div className="kpi-label">Score moyen antennes</div><div className="kpi-value mt-1">{fmtPct(d.levels.antenne.score.moyen)}</div></div>
              <div className="rounded border border-surface-200 p-3"><div className="kpi-label">Score moyen ZS</div><div className="kpi-value mt-1">{fmtPct(d.levels.zs.score.moyen)}</div></div>
            </div>
          </Card>
        )}
      </DataGate>
    </div>
  );
}

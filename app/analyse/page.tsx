"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardHeader, SectionBar } from "@/components/ui/Card";
import { DataGate } from "@/components/ui/DataGate";
import { fmtPct } from "@/lib/client/format";
import { LEVEL_LABEL, type StructureLevel } from "@/config/supervision.config";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

interface IntrospectSource {
  level: StructureLevel;
  label: string;
  ok: boolean;
  error?: string;
  rowCount: number;
  geo: Record<string, string | null>;
  questionCount: number;
  questions: { scoreCol: string; token: string; composante: string | null; label: string }[];
  unmatchedComposante: string[];
  allColumns: string[];
}

function Diagnostic() {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useSWR<{ sources: IntrospectSource[] }>(open ? "/api/supervision/introspect" : null, fetcher);
  return (
    <Card>
      <CardHeader
        title="Diagnostic du schéma KoboToolbox"
        subtitle="Colonnes détectées automatiquement dans chaque formulaire. Sert à ajuster la config si nécessaire."
        right={<button className="btn" onClick={() => setOpen((o) => !o)}>{open ? "Masquer" : "Analyser les colonnes"}</button>}
      />
      {open && (isLoading || !data) && <div className="text-[12px] text-surface-700 py-4">Lecture des formulaires…</div>}
      {open && data?.sources?.map((s) => (
        <div key={s.level} className="mb-4 last:mb-0">
          <div className="text-[12px] font-semibold text-surface-900">
            {s.label} <span className={`chip ${s.ok ? "chip-good" : "chip-bad"} ml-1`}>{s.ok ? `${s.rowCount} lignes` : "erreur"}</span>
          </div>
          {s.error && <div className="text-[11px] text-danger-600 mt-1">{s.error}</div>}
          <div className="text-[11px] text-surface-700 mt-1">
            <span className="font-medium">Colonnes géo :</span>{" "}
            {Object.entries(s.geo).filter(([, v]) => v).map(([k, v]) => `${k} → « ${v} »`).join(" · ") || "aucune détectée"}
          </div>
          <div className="text-[11px] text-surface-700 mt-1">
            <span className="font-medium">{s.questionCount ?? 0} questions notées détectées</span>
            {s.unmatchedComposante?.length ? <span className="text-warn-600"> · {s.unmatchedComposante.length} token(s) non rattaché(s) : {s.unmatchedComposante.join(", ")}</span> : <span className="text-good-600"> · toutes rattachées à une composante</span>}
          </div>
        </div>
      ))}
    </Card>
  );
}

export default function AnalysePage() {
  return (
    <div className="space-y-4">
      <SectionBar>Analyse & données détaillées</SectionBar>
      <DataGate>
        {(d) => (
          <div className="space-y-2.5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {(["antenne", "zs", "as"] as StructureLevel[]).map((lvl) => {
                const b = d.levels[lvl];
                return (
                  <Card key={lvl}>
                    <CardHeader title={LEVEL_LABEL[lvl].plural} subtitle={`${b.records} supervisions · ${b.perStructure.length} structures`} />
                    <table className="table-default">
                      <thead><tr><th>Structure</th><th>Score</th><th>Sup.</th></tr></thead>
                      <tbody>
                        {b.perStructure.slice(0, 15).map((s) => (
                          <tr key={s.name}><td>{s.name}</td><td>{fmtPct(s.score)}</td><td>{s.count}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                );
              })}
            </div>
            <div className="text-[11px] text-surface-700">
              Sources : {d.meta.sources.map((s) => `${s.label} (${s.rows} lignes${s.ok ? "" : " — ⚠︎"})`).join(" · ")}
            </div>
          </div>
        )}
      </DataGate>
      <Diagnostic />
    </div>
  );
}

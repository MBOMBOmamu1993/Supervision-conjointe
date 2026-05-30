"use client";

import { Card, CardHeader, SectionBar } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { DataGate } from "@/components/ui/DataGate";
import { EmptyState } from "@/components/ui/EmptyState";
import Radar from "@/components/charts/Radar";
import StackedAnswers from "@/components/charts/StackedAnswers";
import HBar from "@/components/charts/HBar";
import { fmtPct } from "@/lib/client/format";
import { cotationFor, COTATION_COLOR } from "@/config/supervision.config";
import type { LevelBundle, TopNonItem } from "@/lib/supervision/types";

function ComposanteTable({ bundle }: { bundle: LevelBundle }) {
  const { indicators, entities } = bundle.radar;
  if (entities.length === 0) return <EmptyState message="Aucune structure évaluée." />;
  return (
    <div className="overflow-x-auto">
      <table className="table-default">
        <thead>
          <tr>
            <th>Structure</th>
            {indicators.map((c) => <th key={c} className="!normal-case">{c}</th>)}
            <th>Global</th>
          </tr>
        </thead>
        <tbody>
          {entities.map((e) => {
            const global = Math.round(e.values.reduce((a, b) => a + b, 0) / (e.values.length || 1));
            return (
              <tr key={e.name}>
                <td>{e.name}</td>
                {e.values.map((v, i) => (
                  <td key={i} style={{ background: `${COTATION_COLOR[cotationFor(v)]}22` }}>{v}%</td>
                ))}
                <td className="font-semibold" style={{ background: `${COTATION_COLOR[cotationFor(global)]}33` }}>{global}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TopNon({ items }: { items: TopNonItem[] }) {
  if (items.length === 0) return <EmptyState message="Aucune question exploitable." />;
  return <HBar colorByCotation={false} data={items.map((i) => ({ name: i.question, value: i.pct }))} height={Math.max(120, items.length * 30 + 30)} />;
}

export default function ComposantesPage() {
  return (
    <DataGate>
      {(d) => (
        <div className="space-y-4">
          {/* KPIs en-tête */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <KpiCard icon="clipboard" tone="brand" label="Composantes suivies" value={d.levels.antenne.composantes.length || 6} sub="Référentiel checklist" />
            <KpiCard icon="tower" tone="good" label="Antennes analysées" value={d.levels.antenne.radar.entities.length} sub="Antennes évaluées" />
            <KpiCard icon="hospital" tone="violet" label="ZS analysées" value={d.levels.zs.radar.entities.length} sub="Zones de santé évaluées" />
            <KpiCard icon="clinic" tone="warn" label="AS / CS analysés" value={d.levels.as.radar.entities.length} sub="Aires / centres évalués" />
          </div>

          {/* Radars */}
          <section>
            <SectionBar icon="component">Radars des 6 composantes</SectionBar>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <Card>
                <CardHeader icon="tower" title="Antennes" />
                {d.levels.antenne.radar.entities.length ? <Radar indicators={d.levels.antenne.radar.indicators} entities={d.levels.antenne.radar.entities} /> : <EmptyState />}
              </Card>
              <Card>
                <CardHeader icon="hospital" title="Zones de santé" />
                {d.levels.zs.radar.entities.length ? <Radar indicators={d.levels.zs.radar.indicators} entities={d.levels.zs.radar.entities} /> : <EmptyState />}
              </Card>
              <Card>
                <CardHeader icon="clinic" title="Aires de santé" />
                {d.levels.as.radar.entities.length ? <Radar indicators={d.levels.as.radar.indicators} entities={d.levels.as.radar.entities} /> : <EmptyState />}
              </Card>
            </div>
          </section>

          {/* Tableaux des scores par composante */}
          <section>
            <SectionBar icon="bars">Tableaux des scores par composante</SectionBar>
            <div className="space-y-2.5">
              <Card><CardHeader icon="tower" title="Scores par antenne" /><ComposanteTable bundle={d.levels.antenne} /></Card>
              <Card><CardHeader icon="hospital" title="Scores par zone de santé" /><ComposanteTable bundle={d.levels.zs} /></Card>
              <Card><CardHeader icon="clinic" title="Scores par aire de santé / CS" /><ComposanteTable bundle={d.levels.as} /></Card>
            </div>
          </section>

          {/* Répartition des réponses par composante */}
          <section>
            <SectionBar icon="component">Répartition des réponses par composante</SectionBar>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <Card><CardHeader icon="tower" title="Antennes" /><StackedAnswers rows={d.levels.antenne.composanteAnswers.map((c) => ({ name: c.short, answers: c.answers }))} /></Card>
              <Card><CardHeader icon="hospital" title="Zones de santé" /><StackedAnswers rows={d.levels.zs.composanteAnswers.map((c) => ({ name: c.short, answers: c.answers }))} /></Card>
              <Card><CardHeader icon="clinic" title="Aires de santé" /><StackedAnswers rows={d.levels.as.composanteAnswers.map((c) => ({ name: c.short, answers: c.answers }))} /></Card>
            </div>
          </section>

          {/* Top 5 réponses NON */}
          <section>
            <SectionBar icon="down">Top 5 des réponses « Non »</SectionBar>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <Card><CardHeader icon="tower" title="Antennes" subtitle="% de réponses « Non » par question" /><TopNon items={d.levels.antenne.topNon} /></Card>
              <Card><CardHeader icon="hospital" title="Zones de santé" subtitle="% de réponses « Non » par question" /><TopNon items={d.levels.zs.topNon} /></Card>
              <Card><CardHeader icon="clinic" title="Centres de santé" subtitle="% de réponses « Non » par question" /><TopNon items={d.levels.as.topNon} /></Card>
            </div>
          </section>

          {/* Faits marquants composantes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            <Card className="border-good-200 bg-good-50/30">
              <div className="text-[10px] uppercase tracking-wider text-good-600 font-semibold">Composante la plus performante</div>
              <div className="text-[15px] font-bold text-good-600 mt-1">{d.highlights.bestComposante?.short ?? "—"}</div>
              <div className="text-[11.5px] text-surface-700 mt-0.5">Score moyen : {fmtPct(d.highlights.bestComposante?.score ?? null)}</div>
            </Card>
            <Card className="border-danger-200 bg-danger-50/30">
              <div className="text-[10px] uppercase tracking-wider text-danger-600 font-semibold">Composante la plus faible</div>
              <div className="text-[15px] font-bold text-danger-600 mt-1">{d.highlights.worstComposante?.short ?? "—"}</div>
              <div className="text-[11.5px] text-surface-700 mt-0.5">Score moyen : {fmtPct(d.highlights.worstComposante?.score ?? null)}</div>
            </Card>
            <Card className="border-warn-200 bg-warn-50/30">
              <div className="text-[10px] uppercase tracking-wider text-warn-600 font-semibold">Alerte principale</div>
              <div className="text-[13px] font-bold text-warn-600 mt-1 leading-snug">{d.highlights.alert ?? "Aucune alerte majeure"}</div>
            </Card>
          </div>
        </div>
      )}
    </DataGate>
  );
}

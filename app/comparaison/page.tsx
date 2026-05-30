"use client";

import { Card, CardHeader, SectionBar } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { DataGate } from "@/components/ui/DataGate";
import { EmptyState } from "@/components/ui/EmptyState";
import HBar from "@/components/charts/HBar";
import LineTrend from "@/components/charts/LineTrend";
import { fmtMonth, fmtNum, fmtPct } from "@/lib/client/format";
import { cotationFor, COTATION_COLOR } from "@/config/supervision.config";
import type { MonthlyMatrixRow, NamedScore, TrendPoint } from "@/lib/supervision/types";

function trendSeries(trend: TrendPoint[], months: string[]) {
  const map = new Map(trend.map((t) => [t.month, t.score]));
  return months.map((m) => map.get(m) ?? null);
}

function Variation({ v }: { v: number | null }) {
  if (v === null) return <span className="text-surface-400">—</span>;
  if (v > 0.5) return <span className="text-good-600 font-semibold">▲ +{v} pts</span>;
  if (v < -0.5) return <span className="text-danger-600 font-semibold">▼ {v} pts</span>;
  return <span className="text-surface-500 font-semibold">▬ {v >= 0 ? "+" : ""}{v} pts</span>;
}

function MonthlyTable({ rows, months }: { rows: MonthlyMatrixRow[]; months: string[] }) {
  if (rows.length === 0) return <EmptyState message="Pas assez de données mensuelles." />;
  return (
    <div className="overflow-x-auto">
      <table className="table-default">
        <thead>
          <tr>
            <th>Structure</th>
            {months.map((m) => <th key={m}>{fmtMonth(m)}</th>)}
            <th>Variation</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 12).map((r) => (
            <tr key={r.name}>
              <td>{r.name}</td>
              {months.map((m) => {
                const v = r.scores[m];
                return (
                  <td key={m} style={v !== null ? { background: `${COTATION_COLOR[cotationFor(v)]}1a` } : undefined}>
                    {v === null ? "—" : `${v}%`}
                  </td>
                );
              })}
              <td><Variation v={r.variation} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ComparaisonPage() {
  return (
    <DataGate>
      {(d) => {
        const months = d.meta.months;
        const periodLabel = months.length ? `${fmtMonth(months[0])} – ${fmtMonth(months[months.length - 1])}` : "—";
        const toBars = (s: NamedScore[]) => s.map((x) => ({ name: x.name, value: x.score }));

        // meilleure progression / stabilité / baisse (page highlights + matrices)
        const zsMatrix = d.levels.zs.monthlyMatrix;
        const asMatrix = d.levels.as.monthlyMatrix;
        const asDrops = asMatrix.filter((m) => m.variation !== null && m.variation < -0.5).sort((a, b) => (a.variation ?? 0) - (b.variation ?? 0));
        const zsStable = [...zsMatrix].filter((m) => m.variation !== null).sort((a, b) => Math.abs(a.variation ?? 0) - Math.abs(b.variation ?? 0))[0];

        return (
          <div className="space-y-4">
            {/* KPIs en-tête */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <KpiCard icon="tower" tone="brand" label="Antennes comparées" value={fmtNum(d.levels.antenne.perStructure.length)} sub="Antennes actives" />
              <KpiCard icon="people" tone="good" label="Zones de santé comparées" value={fmtNum(d.levels.zs.perStructure.length)} sub="Zones de santé" />
              <KpiCard icon="clinic" tone="warn" label="Centres de santé comparés" value={fmtNum(d.levels.as.perStructure.length)} sub="Centres de santé" />
              <KpiCard icon="calendar" tone="violet" label="Période analysée" value={`${months.length} mois`} sub={periodLabel} />
            </div>

            {/* Comparaison globale de performance */}
            <section>
              <SectionBar icon="bars">Comparaison globale de performance</SectionBar>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                <Card>
                  <CardHeader icon="tower" title="Par antenne (supervision conjointe)" />
                  {d.levels.antenne.perStructure.length ? <HBar data={toBars(d.levels.antenne.perStructure)} /> : <EmptyState />}
                </Card>
                <Card>
                  <CardHeader icon="map" title="Par zone de santé (supervision conjointe)" />
                  {d.levels.zs.perStructure.length ? <HBar data={toBars(d.levels.zs.perStructure.slice(0, 12))} /> : <EmptyState />}
                </Card>
                <Card>
                  <CardHeader icon="clinic" title="Par centre de santé (supervision conjointe)" />
                  {d.levels.as.perStructure.length ? <HBar data={toBars(d.levels.as.perStructure.slice(0, 12))} /> : <EmptyState />}
                </Card>
                <div className="grid grid-rows-2 gap-2.5">
                  <Card>
                    <CardHeader icon="map" title="Par zone de santé (supervision MCA)" />
                    {d.zsMca.length ? <HBar data={toBars(d.zsMca.slice(0, 8))} /> : <EmptyState message="Aucune supervision MCA seul détectée." />}
                  </Card>
                  <Card>
                    <CardHeader icon="clinic" title="Par centre de santé (supervision ECZ)" />
                    {d.csEcz.length ? <HBar data={toBars(d.csEcz.slice(0, 8))} /> : <EmptyState message="Aucune supervision ECZ seul détectée." />}
                  </Card>
                </div>
              </div>
            </section>

            {/* Évolution des scores globaux par mois */}
            <section>
              <SectionBar icon="time">Évolution des scores globaux par mois (supervision conjointe)</SectionBar>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <Card>
                  <CardHeader icon="tower" title="Toutes les antennes" />
                  <LineTrend months={months} series={[{ name: "Antennes", data: trendSeries(d.levels.antenne.trend, months), color: "#0d9488" }]} />
                </Card>
                <Card>
                  <CardHeader icon="map" title="Toutes les zones de santé" />
                  <LineTrend months={months} series={[{ name: "ZS", data: trendSeries(d.levels.zs.trend, months), color: "#22b457" }]} />
                </Card>
                <Card>
                  <CardHeader icon="clinic" title="Toutes les aires de santé" />
                  <LineTrend months={months} series={[{ name: "AS", data: trendSeries(d.levels.as.trend, months), color: "#7c3aed" }]} />
                </Card>
              </div>
            </section>

            {/* Comparaison du score par mois successifs */}
            <section>
              <SectionBar icon="component">Comparaison du score global par mois successifs</SectionBar>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                <Card>
                  <CardHeader icon="map" title="Par zone de santé (supervision conjointe)" />
                  <MonthlyTable rows={zsMatrix} months={months} />
                </Card>
                <Card>
                  <CardHeader icon="clinic" title="Par aire de santé (supervision conjointe)" />
                  <MonthlyTable rows={asMatrix} months={months} />
                </Card>
              </div>
            </section>

            {/* Faits marquants */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <Card className="border-good-200 bg-good-50/30">
                <div className="text-[10px] uppercase tracking-wider text-good-600 font-semibold">Meilleure progression — antenne</div>
                {d.highlights.bestProgressAntenne ? (
                  <>
                    <div className="text-[16px] font-bold text-good-600 mt-1">{d.highlights.bestProgressAntenne.name}</div>
                    <div className="text-[11.5px] text-surface-700 mt-0.5">
                      +{d.highlights.bestProgressAntenne.delta} pts ({fmtPct(d.highlights.bestProgressAntenne.from)} → {fmtPct(d.highlights.bestProgressAntenne.to)})
                    </div>
                  </>
                ) : <div className="text-[12px] text-surface-500 mt-1">Données insuffisantes</div>}
              </Card>
              <Card className="border-oms-200 bg-oms-50/30">
                <div className="text-[10px] uppercase tracking-wider text-oms-700 font-semibold">ZS la plus stable</div>
                {zsStable ? (
                  <>
                    <div className="text-[16px] font-bold text-oms-700 mt-1">{zsStable.name}</div>
                    <div className="text-[11.5px] text-surface-700 mt-0.5">Variation : {zsStable.variation! >= 0 ? "+" : ""}{zsStable.variation} pts</div>
                  </>
                ) : <div className="text-[12px] text-surface-500 mt-1">Données insuffisantes</div>}
              </Card>
              <Card className={asDrops.length ? "border-danger-200 bg-danger-50/30" : "border-good-200 bg-good-50/30"}>
                <div className={`text-[10px] uppercase tracking-wider font-semibold ${asDrops.length ? "text-danger-600" : "text-good-600"}`}>Aires de santé en baisse</div>
                {asDrops.length ? (
                  <>
                    <div className="text-[16px] font-bold text-danger-600 mt-1">{asDrops.length} AS en baisse</div>
                    <div className="text-[11.5px] text-surface-700 mt-0.5">Plus forte baisse : {asDrops[0].name} ({asDrops[0].variation} pts)</div>
                  </>
                ) : (
                  <>
                    <div className="text-[16px] font-bold text-good-600 mt-1">Aucune baisse détectée</div>
                    <div className="text-[11.5px] text-surface-700 mt-0.5">Toutes les AS sont stables ou en amélioration</div>
                  </>
                )}
              </Card>
            </div>
          </div>
        );
      }}
    </DataGate>
  );
}

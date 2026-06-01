"use client";

import { useState } from "react";
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
            <th>Variation<br />(dernier vs avant-dernier mois)</th>
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

/** Top N des structures les plus performantes (ZS & AS), basculable 5 / 10. */
function TopPerformers({ zs, as }: { zs: NamedScore[]; as: NamedScore[] }) {
  const [n, setN] = useState(5);
  const top = (s: NamedScore[]) =>
    [...s].filter((x) => x.score !== null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, n).map((x) => ({ name: x.name, value: x.score }));
  const topZs = top(zs);
  const topAs = top(as);
  return (
    <section>
      <div className="flex items-center justify-between gap-2">
        <SectionBar icon="trophy">Top {n} des structures performantes</SectionBar>
        <div className="flex shrink-0 gap-1">
          {[5, 10].map((k) => (
            <button key={k} onClick={() => setN(k)}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-bold transition ${n === k ? "bg-navy-700 text-white" : "bg-surface-100 text-surface-600 hover:bg-surface-200"}`}>
              Top {k}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
        <Card>
          <CardHeader icon="hospital" iconTone="violet" title={`Top ${n} zones de santé performantes`} />
          {topZs.length ? <HBar data={topZs} /> : <EmptyState />}
        </Card>
        <Card>
          <CardHeader icon="clinic" iconTone="green" title={`Top ${n} aires de santé performantes`} />
          {topAs.length ? <HBar data={topAs} /> : <EmptyState />}
        </Card>
      </div>
    </section>
  );
}

export default function ComparaisonPage() {
  return (
    <DataGate>
      {(d) => {
        const months = d.meta.months;
        const periodLabel = months.length ? `${fmtMonth(months[0])} – ${fmtMonth(months[months.length - 1])}` : "—";
        const toBars = (s: NamedScore[]) => s.map((x) => ({ name: x.name, value: x.score }));

        // Comparaison meilleure progression / stable / en baisse : UNIQUEMENT
        // entre le dernier mois et l'avant-dernier (variation = last − penult).
        // Si moins de deux mois sont disponibles, on n'affiche rien (« Aucune »).
        const zsMatrix = d.levels.zs.monthlyMatrix;
        const asMatrix = d.levels.as.monthlyMatrix;
        const hasTwoMonths = months.length >= 2;
        const zsVar = hasTwoMonths ? zsMatrix.filter((m) => m.variation !== null) : [];
        const asVar = hasTwoMonths ? asMatrix.filter((m) => m.variation !== null) : [];
        const bestProg = [...zsVar, ...asVar].sort((a, b) => (b.variation ?? 0) - (a.variation ?? 0))[0];
        const zsStable = [...zsVar].sort((a, b) => Math.abs(a.variation ?? 0) - Math.abs(b.variation ?? 0))[0];
        const asDrops = asVar.filter((m) => (m.variation ?? 0) < -0.5).sort((a, b) => (a.variation ?? 0) - (b.variation ?? 0));

        return (
          <div className="space-y-4">
            {/* KPIs en-tête */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <KpiCard icon="tower" tone="brand" label="Nombre d'antennes supervisées" value={fmtNum(d.levels.antenne.perStructure.length)} sub="Antennes supervisées" />
              <KpiCard icon="hospital" tone="good" label="Nombre des ZS supervisées" value={fmtNum(d.levels.zs.perStructure.length)} sub="Zones de santé" />
              <KpiCard icon="clinic" tone="warn" label="Nombre des Aires de Santé supervisées" value={fmtNum(d.levels.as.perStructure.length)} sub="Aires / centres de santé" />
              <KpiCard icon="calendar" tone="violet" label="Période analysée" value={`${months.length} mois`} sub={periodLabel} />
            </div>

            {/* Top 5 / Top 10 des structures performantes (le TL) */}
            <TopPerformers zs={d.levels.zs.perStructure} as={d.levels.as.perStructure} />

            {/* Comparaison globale de performance */}
            <section>
              <SectionBar icon="bars">Comparaison globale de performance</SectionBar>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                <Card>
                  <CardHeader icon="tower" iconTone="blue" title="Par antenne" />
                  {d.levels.antenne.perStructure.length ? <HBar data={toBars(d.levels.antenne.perStructure)} /> : <EmptyState />}
                </Card>
                <Card>
                  <CardHeader icon="hospital" iconTone="violet" title="Par zone de santé" />
                  {d.levels.zs.perStructure.length ? <HBar data={toBars(d.levels.zs.perStructure.slice(0, 12))} /> : <EmptyState />}
                </Card>
                <Card>
                  <CardHeader icon="clinic" iconTone="green" title="Par centre de santé" />
                  {d.levels.as.perStructure.length ? <HBar data={toBars(d.levels.as.perStructure.slice(0, 12))} /> : <EmptyState />}
                </Card>
                <div className="grid grid-rows-2 gap-2.5">
                  <Card>
                    <CardHeader icon="hospital" iconTone="orange" title="Par zone de santé (supervision MCA)" />
                    {d.zsMca.length ? <HBar data={toBars(d.zsMca.slice(0, 8))} /> : <EmptyState message="Aucune supervision MCA seul détectée." />}
                  </Card>
                  <Card>
                    <CardHeader icon="clinic" iconTone="red" title="Par centre de santé (supervision ECZ)" />
                    {d.csEcz.length ? <HBar data={toBars(d.csEcz.slice(0, 8))} /> : <EmptyState message="Aucune supervision ECZ seul détectée." />}
                  </Card>
                </div>
              </div>
            </section>

            {/* Évolution des scores globaux par mois */}
            <section>
              <SectionBar icon="time">Évolution des scores globaux par mois</SectionBar>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <Card>
                  <CardHeader icon="tower" iconTone="blue" title="Toutes les antennes" />
                  <LineTrend months={months} series={[{ name: "Antennes", data: trendSeries(d.levels.antenne.trend, months), color: "#0d9488" }]} />
                </Card>
                <Card>
                  <CardHeader icon="hospital" iconTone="violet" title="Toutes les zones de santé" />
                  <LineTrend months={months} series={[{ name: "ZS", data: trendSeries(d.levels.zs.trend, months), color: "#22b457" }]} />
                </Card>
                <Card>
                  <CardHeader icon="clinic" iconTone="green" title="Toutes les aires de santé" />
                  <LineTrend months={months} series={[{ name: "AS", data: trendSeries(d.levels.as.trend, months), color: "#7c3aed" }]} />
                </Card>
              </div>
            </section>

            {/* Comparaison du score par mois successifs */}
            <section>
              <SectionBar icon="component">Comparaison du score global — variation des 2 derniers mois</SectionBar>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                <Card>
                  <CardHeader icon="hospital" iconTone="violet" title="Par zone de santé" />
                  <MonthlyTable rows={zsMatrix} months={months} />
                </Card>
                <Card>
                  <CardHeader icon="clinic" iconTone="green" title="Par aire de santé" />
                  <MonthlyTable rows={asMatrix} months={months} />
                </Card>
              </div>
            </section>

            {/* Faits marquants — comparaison dernier mois vs avant-dernier mois */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <Card className="border-good-200 bg-good-50/30">
                <div className="text-[10px] uppercase tracking-wider text-good-600 font-semibold">Meilleure progression</div>
                {bestProg && bestProg.variation !== null && bestProg.variation > 0.5 ? (
                  <>
                    <div className="text-[16px] font-bold text-good-600 mt-1">{bestProg.name}</div>
                    <div className="text-[11.5px] text-surface-700 mt-0.5">
                      +{bestProg.variation} pts (dernier vs avant-dernier mois)
                    </div>
                  </>
                ) : <div className="text-[14px] font-bold text-surface-500 mt-1">Aucune</div>}
              </Card>
              <Card className="border-oms-200 bg-oms-50/30">
                <div className="text-[10px] uppercase tracking-wider text-oms-700 font-semibold">Structure la plus stable</div>
                {zsStable && zsStable.variation !== null ? (
                  <>
                    <div className="text-[16px] font-bold text-oms-700 mt-1">{zsStable.name}</div>
                    <div className="text-[11.5px] text-surface-700 mt-0.5">Variation : {zsStable.variation >= 0 ? "+" : ""}{zsStable.variation} pts</div>
                  </>
                ) : <div className="text-[14px] font-bold text-surface-500 mt-1">Aucune</div>}
              </Card>
              <Card className={asDrops.length ? "border-danger-200 bg-danger-50/30" : ""}>
                <div className={`text-[10px] uppercase tracking-wider font-semibold ${asDrops.length ? "text-danger-600" : "text-surface-600"}`}>En baisse</div>
                {asDrops.length ? (
                  <>
                    <div className="text-[16px] font-bold text-danger-600 mt-1">{asDrops[0].name}</div>
                    <div className="text-[11.5px] text-surface-700 mt-0.5">{asDrops[0].variation} pts · {asDrops.length} structure(s) en baisse</div>
                  </>
                ) : <div className="text-[14px] font-bold text-surface-500 mt-1">Aucune</div>}
              </Card>
            </div>
          </div>
        );
      }}
    </DataGate>
  );
}

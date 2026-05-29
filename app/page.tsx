"use client";

import { Card, SectionBar } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { DataGate } from "@/components/ui/DataGate";
import Donut from "@/components/charts/Donut";
import { fmtNum, fmtPct } from "@/lib/client/format";
import { LEVEL_LABEL } from "@/config/supervision.config";
import type { LevelBundle, ScoreStat, CotationDist } from "@/lib/supervision/types";

function ScoreCard({ title, stat }: { title: string; stat: ScoreStat }) {
  const Item = ({ label, v }: { label: string; v: number | null }) => (
    <div className="text-center">
      <div className="text-[10px] uppercase tracking-wider text-surface-700 font-semibold">{label}</div>
      <div className="text-[22px] font-semibold text-oms-700 tabular-nums leading-none mt-1">{fmtPct(v)}</div>
    </div>
  );
  return (
    <Card className="!p-3">
      <div className="text-[12px] font-semibold text-surface-900 mb-2.5 flex items-center gap-1.5">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-oms-500" /> {title}
        <span className="ml-auto text-[10px] font-normal text-surface-700">{stat.count} sup.</span>
      </div>
      <div className="grid grid-cols-3 gap-1">
        <Item label="Moyen" v={stat.moyen} />
        <Item label="Max" v={stat.max} />
        <Item label="Min" v={stat.min} />
      </div>
    </Card>
  );
}

function CotationCard({ title, dist }: { title: string; dist: CotationDist[] }) {
  const total = dist.reduce((a, b) => a + b.count, 0);
  return (
    <Card className="!p-3">
      <div className="text-[12px] font-semibold text-surface-900 mb-1 text-center">{title}</div>
      <div className="grid grid-cols-5 gap-1 items-center">
        <div className="col-span-2">
          <Donut height={150} data={dist.map((d) => ({ name: d.label, value: d.count, color: d.color }))} />
        </div>
        <div className="col-span-3 space-y-1">
          {dist.map((d) => (
            <div key={d.level} className="flex items-center gap-1.5 text-[11px]">
              <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: d.color }} />
              <span className="text-surface-700 flex-1">{d.label}</span>
              <span className="font-semibold text-surface-900 tabular-nums">{d.count}</span>
              <span className="text-surface-500 tabular-nums w-9 text-right">({d.pct}%)</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-[11px] pt-1 border-t border-surface-100 font-semibold">
            <span className="flex-1 text-surface-700">Total</span>
            <span className="tabular-nums text-surface-900">{total} (100%)</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function SummaryCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: string }) {
  return (
    <div className="rounded-md border border-surface-200 bg-white p-3 flex flex-col">
      <div className="text-[9px] uppercase tracking-wider text-surface-700 font-semibold">{label}</div>
      <div className={`text-[16px] font-bold leading-tight mt-1 ${tone}`}>{value}</div>
      {sub ? <div className="text-[11px] text-surface-700 mt-0.5">{sub}</div> : null}
    </div>
  );
}

export default function VueEnsemblePage() {
  return (
    <DataGate>
      {(d) => {
        const k = d.kpi;
        const levels = d.levels;
        const hl = d.highlights;
        const lvl = (b: LevelBundle) => b;
        return (
          <div className="space-y-4">
            {/* ---- KPI ---- */}
            <section>
              <SectionBar>Indicateurs clés de réalisation</SectionBar>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
                <KpiCard tone="brand" label="Sup. conjointe PEV-Central / OMS-VPD" value={fmtNum(k.conjointe_pev_oms.count)} pct={k.conjointe_pev_oms.pct} />
                <KpiCard tone="good" label="Sup. conjointe MCA / AT / MCZ" value={fmtNum(k.conjointe_mca.count)} pct={k.conjointe_mca.pct} />
                <KpiCard tone="violet" label="Supervision MCA seul" value={fmtNum(k.mca_seul.count)} pct={k.mca_seul.pct} />
                <KpiCard tone="warn" label="Supervision ECZ réalisée" value={fmtNum(k.ecz_seul.count)} pct={k.ecz_seul.pct} />
                <KpiCard tone="teal" label="Antennes supervisées (conjointe)" value={fmtNum(k.antennes_sup.count)} pct={k.antennes_sup.pct} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-2.5">
                <KpiCard tone="bad" label="ZS supervisées (conjointe)" value={fmtNum(k.zs_conjointe.count)} pct={k.zs_conjointe.pct} />
                <KpiCard tone="brand" label="ZS supervisées (MCA seul)" value={fmtNum(k.zs_mca.count)} pct={k.zs_mca.pct} />
                <KpiCard tone="teal" label="CS supervisés (conjointe)" value={fmtNum(k.cs_conjointe.count)} pct={k.cs_conjointe.pct} />
                <KpiCard tone="bad" label="CS supervisés (ECZ seul)" value={fmtNum(k.cs_ecz.count)} pct={k.cs_ecz.pct} />
              </div>
            </section>

            {/* ---- Scores ---- */}
            <section>
              <SectionBar>Scores de supervision</SectionBar>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <ScoreCard title="Score Antennes" stat={lvl(levels.antenne).score} />
                <ScoreCard title="Score Zones de santé" stat={lvl(levels.zs).score} />
                <ScoreCard title="Score Aires de santé" stat={lvl(levels.as).score} />
              </div>
            </section>

            {/* ---- Cotations ---- */}
            <section>
              <SectionBar>Répartition des cotations</SectionBar>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <CotationCard title="Cotation Antenne" dist={levels.antenne.cotations} />
                <CotationCard title="Cotation Zone de santé" dist={levels.zs.cotations} />
                <CotationCard title="Cotation Aire de santé" dist={levels.as.cotations} />
              </div>
            </section>

            {/* ---- Résumé global ---- */}
            <section>
              <SectionBar>Résumé global</SectionBar>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <SummaryCard label="Meilleur niveau" value={hl.bestLevel.label} sub={`Score moyen : ${fmtPct(hl.bestLevel.score)}`} tone="text-good-600" />
                <SummaryCard label="Niveau avec score minimum" value={hl.worstLevel.label} sub={`Score min : ${fmtPct(hl.worstLevel.score)}`} tone="text-danger-600" />
                <SummaryCard
                  label="Structures supervisées (conjointe)"
                  value={fmtNum(k.structures_conjointe)}
                  sub={`CS : ${k.cs_conjointe.count} · ZS : ${k.zs_conjointe.count} · Antennes : ${k.antennes_sup.count}`}
                  tone="text-oms-700"
                />
                <SummaryCard label="Total supervisions réalisées" value={fmtNum(k.total_supervisions)} sub="Toutes structures & types confondus" tone="text-navy-600" />
              </div>
            </section>
          </div>
        );
      }}
    </DataGate>
  );
}

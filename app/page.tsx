"use client";

import { Card, SectionBar, HEADER_TONE, type HeaderTone } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { DataGate } from "@/components/ui/DataGate";
import { Icon, type IconName } from "@/components/ui/Icon";
import Donut from "@/components/charts/Donut";
import { fmtNum, fmtPct } from "@/lib/client/format";
import { LEVEL_LABEL } from "@/config/supervision.config";
import type { LevelBundle, ScoreStat, CotationDist } from "@/lib/supervision/types";

function scoreColor(v: number | null): string {
  if (v === null) return "#94a3b8";
  return v >= 80 ? "#1f9d57" : v >= 60 ? "#0093d5" : v >= 40 ? "#f59e0b" : "#e23636";
}

function ToneBadge({ icon, tone, size = 30 }: { icon: IconName; tone: HeaderTone; size?: number }) {
  const t = HEADER_TONE[tone];
  return (
    <span
      className="rounded-[9px] flex items-center justify-center shrink-0 text-white"
      style={{ width: size, height: size, backgroundImage: `linear-gradient(145deg, ${t.from}, ${t.to})`, boxShadow: `0 5px 13px -5px ${t.to}` }}
    >
      <Icon name={icon} style={{ width: size * 0.55, height: size * 0.55 }} strokeWidth={2} />
    </span>
  );
}

function ScoreCard({ title, stat, icon, tone }: { title: string; stat: ScoreStat; icon: IconName; tone: HeaderTone }) {
  const Item = ({ label, v }: { label: string; v: number | null }) => (
    <div className="text-center">
      <div className="text-[10px] uppercase tracking-wider text-surface-700 font-bold">{label}</div>
      <div className="text-[26px] font-extrabold tabular-nums leading-none mt-1" style={{ color: scoreColor(v) }}>{fmtPct(v)}</div>
    </div>
  );
  return (
    <Card className="!p-3.5">
      <div className="text-[14px] font-extrabold text-navy-700 mb-3 flex items-center gap-2.5">
        <ToneBadge icon={icon} tone={tone} size={32} />
        {title}
        <span className="ml-auto text-[10px] font-medium text-surface-700">{stat.count} sup.</span>
      </div>
      <div className="grid grid-cols-3 gap-1">
        <Item label="Moyen" v={stat.moyen} />
        <Item label="Max" v={stat.max} />
        <Item label="Min" v={stat.min} />
      </div>
    </Card>
  );
}

function CotationCard({ title, dist, icon, tone }: { title: string; dist: CotationDist[]; icon: IconName; tone: HeaderTone }) {
  const total = dist.reduce((a, b) => a + b.count, 0);
  return (
    <Card className="!p-3">
      <div className="flex items-center justify-center gap-2 mb-2">
        <ToneBadge icon={icon} tone={tone} size={26} />
        <div className="text-[13px] font-bold text-surface-900">{title}</div>
      </div>
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

function SummaryCard({ label, value, sub, tone, icon }: { label: string; value: string; sub?: string; tone: string; icon: IconName }) {
  return (
    <Card className="!p-3.5 flex items-center gap-3">
      <div className="w-[42px] h-[42px] rounded-full flex items-center justify-center shrink-0 text-white" style={{ background: tone }}>
        <Icon name={icon} className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <div className="text-[9.5px] uppercase tracking-wider text-surface-700 font-bold">{label}</div>
        <div className="text-[17px] font-extrabold leading-tight mt-0.5" style={{ color: tone }}>{value}</div>
        {sub ? <div className="text-[11px] text-surface-700 mt-0.5">{sub}</div> : null}
      </div>
    </Card>
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
              <SectionBar icon="bars">Indicateurs clés de réalisation</SectionBar>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
                <KpiCard icon="hands" tone="navy" label={<>Sup. conjointe<br />PEV-Central / OMS-VPD</>} value={fmtNum(k.conjointe_pev_oms.count)} pct={k.conjointe_pev_oms.pct} />
                <KpiCard icon="people" tone="good" label={<>Sup. conjointe<br />MCA / AT / MCZ</>} value={fmtNum(k.conjointe_mca.count)} pct={k.conjointe_mca.pct} />
                <KpiCard icon="person" tone="violet" label={<>Supervision<br />MCA seul</>} value={fmtNum(k.mca_seul.count)} pct={k.mca_seul.pct} />
                <KpiCard icon="clipboard" tone="warn" label={<>Supervision<br />ECZ réalisée</>} value={fmtNum(k.ecz_seul.count)} pct={k.ecz_seul.pct} />
                <KpiCard icon="tower" tone="teal" label={<>Antennes supervisées<br />(conjointe)</>} value={fmtNum(k.antennes_sup.count)} pct={k.antennes_sup.pct} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-2.5">
                <KpiCard icon="pin" tone="bad" label={<>ZS supervisées<br />(conjointe)</>} value={fmtNum(k.zs_conjointe.count)} pct={k.zs_conjointe.pct} />
                <KpiCard icon="map" tone="brand" label={<>ZS supervisées<br />(MCA seul)</>} value={fmtNum(k.zs_mca.count)} pct={k.zs_mca.pct} />
                <KpiCard icon="clinic" tone="good" label={<>CS supervisés<br />(conjointe)</>} value={fmtNum(k.cs_conjointe.count)} pct={k.cs_conjointe.pct} />
                <KpiCard icon="clinic" tone="bad" label={<>CS supervisés<br />(ECZ seul)</>} value={fmtNum(k.cs_ecz.count)} pct={k.cs_ecz.pct} />
              </div>
            </section>

            {/* ---- Scores ---- */}
            <section>
              <SectionBar icon="bars">Scores de supervision</SectionBar>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <ScoreCard title="Score Antennes" stat={lvl(levels.antenne).score} icon="tower" tone="blue" />
                <ScoreCard title="Score Zones de santé" stat={lvl(levels.zs).score} icon="hospital" tone="violet" />
                <ScoreCard title="Score Aires de santé" stat={lvl(levels.as).score} icon="clinic" tone="green" />
              </div>
            </section>

            {/* ---- Cotations ---- */}
            <section>
              <SectionBar icon="component">Répartition des cotations</SectionBar>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <CotationCard title="Cotation Antenne" dist={levels.antenne.cotations} icon="tower" tone="blue" />
                <CotationCard title="Cotation Zone de santé" dist={levels.zs.cotations} icon="hospital" tone="violet" />
                <CotationCard title="Cotation Aire de santé" dist={levels.as.cotations} icon="clinic" tone="green" />
              </div>
            </section>

            {/* ---- Résumé global ---- */}
            <section>
              <SectionBar icon="doc">Résumé global</SectionBar>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <SummaryCard icon="trophy" label="Meilleur niveau" value={hl.bestLevel.label} sub={`Score moyen : ${fmtPct(hl.bestLevel.score)}`} tone="#178a44" />
                <SummaryCard icon="down" label="Niveau avec score minimum" value={hl.worstLevel.label} sub={`Score min. : ${fmtPct(hl.worstLevel.score)}`} tone="#c81e1e" />
                <SummaryCard
                  icon="clinic"
                  label="Structures supervisées (conjointe)"
                  value={fmtNum(k.structures_conjointe)}
                  sub={`CS : ${k.cs_conjointe.count} · ZS : ${k.zs_conjointe.count} · Antennes : ${k.antennes_sup.count}`}
                  tone="#0078ae"
                />
                <SummaryCard icon="doc" label="Total supervisions réalisées" value={fmtNum(k.total_supervisions)} sub="% global de réalisation" tone="#00205c" />
              </div>
            </section>
          </div>
        );
      }}
    </DataGate>
  );
}

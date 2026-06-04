"use client";

/* Page « Vue d'ensemble » de la Supervision conjointe — CONSERVÉE À L'IDENTIQUE
   (déplacée depuis app/page.tsx vers le nouveau shell). */
import { Card, SectionBar, HEADER_TONE, type HeaderTone } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { DataGate } from "@/components/ui/DataGate";
import { Icon, type IconName } from "@/components/ui/Icon";
import Donut from "@/components/charts/Donut";
import { fmtNum, fmtPct } from "@/lib/client/format";
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
        <Item label="Max" v={stat.max} />
        <Item label="Moyen" v={stat.moyen} />
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

export default function SupervisionVueEnsemble() {
  return (
    <DataGate>
      {(d) => {
        const k = d.kpi;
        const levels = d.levels;
        const lvl = (b: LevelBundle) => b;
        return (
          <div className="space-y-4">
            <section>
              <SectionBar icon="bars">Nombre des supervisions réalisées</SectionBar>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <KpiCard icon="tower" tone="navy" label={<>Nombre d'antennes<br />supervisées</>} value={fmtNum(k.antennes_total.count)} pct={k.antennes_total.pct} />
                <KpiCard icon="hospital" tone="violet" label={<>Nombre de ZS<br />supervisées</>} value={fmtNum(k.zs_total.count)} pct={k.zs_total.pct} />
                <KpiCard icon="clinic" tone="good" label={<>Nombre d'aires de santé<br />supervisées</>} value={fmtNum(k.as_total.count)} pct={k.as_total.pct} />
                <KpiCard icon="clipboard" tone="bad" label={<>Total supervisions<br />réalisées</>} value={fmtNum(k.total_supervisions)} sub="Toutes catégories" />
              </div>
            </section>

            <section>
              <SectionBar icon="bars">Score global des composantes ACD</SectionBar>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <ScoreCard title="Score global Antenne" stat={lvl(levels.antenne).score} icon="tower" tone="navy" />
                <ScoreCard title="Score global ZS" stat={lvl(levels.zs).score} icon="hospital" tone="green" />
                <ScoreCard title="Score global AS" stat={lvl(levels.as).score} icon="clinic" tone="violet" />
              </div>
            </section>

            <section>
              <SectionBar icon="component">Appréciation des structures sur base du score global ACD</SectionBar>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <CotationCard title="Appréciation — Antenne" dist={levels.antenne.cotations} icon="tower" tone="blue" />
                <CotationCard title="Appréciation — ZS" dist={levels.zs.cotations} icon="hospital" tone="violet" />
                <CotationCard title="Appréciation — AS" dist={levels.as.cotations} icon="clinic" tone="green" />
              </div>
            </section>

            <section>
              <SectionBar icon="doc">Résumé global</SectionBar>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                {([
                  { lvl: levels.antenne, best: "Antenne avec meilleur score", worst: "Antenne avec faible score", icon: "tower" as IconName },
                  { lvl: levels.zs, best: "ZS avec meilleur score", worst: "Zone de santé avec faible score", icon: "hospital" as IconName },
                  { lvl: levels.as, best: "Aire de santé avec meilleur score", worst: "Aire de santé avec faible score", icon: "clinic" as IconName },
                ]).flatMap(({ lvl, best, worst, icon }) => {
                  const scored = lvl.perStructure.filter((s) => s.score !== null);
                  const top = scored[0] ?? null;
                  const low = scored.length ? scored[scored.length - 1] : null;
                  return [
                    <KpiCard key={best} icon={icon} tone="good" label={best} value={top ? top.name : "—"} sub={top ? `Score : ${fmtPct(top.score)}` : "Aucune donnée"} />,
                    <KpiCard key={worst} icon={icon} tone="bad" label={worst} value={low ? low.name : "—"} sub={low ? `Score : ${fmtPct(low.score)}` : "Aucune donnée"} />,
                  ];
                })}
              </div>
            </section>
          </div>
        );
      }}
    </DataGate>
  );
}

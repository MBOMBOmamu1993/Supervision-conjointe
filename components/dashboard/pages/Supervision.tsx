"use client";

/* Pages Supervision conjointe — Antennes / Zones de santé / Aires de santé /
   Synthèse transversale. Données LIVE via /api/supervision (réagissent à tous
   les filtres affichés). Réutilise les composants et la charte existants. */
import { DataGate } from "@/components/ui/DataGate";
import { SectionBar } from "@/components/ui/Card";
import { KpiTile, CardTitle, Banner, HlCard } from "@/components/proto/proto";
import StackedAnswers from "@/components/charts/StackedAnswers";
import HBar from "@/components/charts/HBar";
import Donut from "@/components/charts/Donut";
import { fmtPct, fmtMonth } from "@/lib/client/format";
import { cotationFor, COTATION_COLOR, type StructureLevel, type AnswerValue } from "@/config/supervision.config";
import type { SupervisionBundle, LevelBundle } from "@/lib/supervision/types";

const ANS: AnswerValue[] = ["oui", "partiel", "non", "na"];
function totals(b: LevelBundle) {
  const t: Record<AnswerValue, number> = { oui: 0, partiel: 0, non: 0, na: 0 };
  for (const c of b.composanteAnswers) for (const k of ANS) t[k] += c.answers[k];
  const evaluated = t.oui + t.partiel + t.non;
  const all = evaluated + t.na;
  return { ...t, evaluated, all, ouiPct: evaluated ? Math.round((t.oui / evaluated) * 100) : null };
}
/** Proportion d'une réponse rapportée au total des questions administrées (Oui+Non+Partiel+NA). */
const propTxt = (count: number, all: number) => (all ? `${Math.round((count / all) * 100)} %` : "—");

function MonthTable({ b, months }: { b: LevelBundle; months: string[] }) {
  if (!months.length || !b.composantesMonthly.length) return <div className="py-8 text-center text-[12px] text-surface-500">Pas de données mensuelles.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="dtable">
        <thead><tr><th className="name">Composante</th>{months.map((m) => <th key={m}>{fmtMonth(m)}</th>)}<th>Moyenne</th></tr></thead>
        <tbody>
          {b.composantesMonthly.map((c) => {
            const present = months.map((m) => c.scores[m]).filter((n): n is number => n !== null);
            const avg = present.length ? Math.round(present.reduce((a, x) => a + x, 0) / present.length) : null;
            return (
              <tr key={c.key}>
                <td className="name">{c.short}</td>
                {months.map((m) => { const v = c.scores[m]; return <td key={m} style={v !== null ? { background: `${COTATION_COLOR[cotationFor(v)]}1f` } : undefined}>{v === null ? "—" : `${v}%`}</td>; })}
                <td className="font-semibold" style={avg !== null ? { background: `${COTATION_COLOR[cotationFor(avg)]}33` } : undefined}>{avg === null ? "—" : `${avg}%`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const LEVEL_META: Record<StructureLevel, { icon: "antenne" | "zs" | "as" | "tower" | "hospital" | "clinic"; tone: "navy" | "violet" | "green"; plural: string; kpiBlock: "antennes_total" | "zs_total" | "as_total" }> = {
  antenne: { icon: "tower", tone: "navy", plural: "Antennes", kpiBlock: "antennes_total" },
  zs: { icon: "hospital", tone: "violet", plural: "Zones de santé", kpiBlock: "zs_total" },
  as: { icon: "clinic", tone: "green", plural: "Aires de santé", kpiBlock: "as_total" },
};

export function SupervisionLevelPage({ level }: { level: StructureLevel }) {
  const meta = LEVEL_META[level];
  return (
    <DataGate>
      {(d: SupervisionBundle) => {
        const b = d.levels[level];
        const t = totals(b);
        const block = d.kpi[meta.kpiBlock];
        const months = d.meta.months;
        return (
          <div className="space-y-4">
            <Banner icon={meta.icon} tone={meta.tone} title={`Supervision conjointe — ${meta.plural}`}
              sub={<>Réalisation, qualité et scores au niveau {meta.plural.toLowerCase()} · {b.records} supervision{b.records > 1 ? "s" : ""}</>} />

            <section>
              <SectionBar icon="bars">Indicateurs clés</SectionBar>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <KpiTile icon={meta.icon} tone={meta.tone} label={`${meta.plural} supervisées`} value={block.count} pct={block.pct ?? undefined} />
                <KpiTile icon="clip" tone="navy" label="Questions administrées" value={t.all} sub="Total des réponses" />
                <KpiTile icon="check" tone="green" label="Réponses « Oui »" value={t.oui} sub={`Proportion : <b>${propTxt(t.oui, t.all)}</b>`} />
                <KpiTile icon="component" tone="orange" label="Réponses « Partiellement »" value={t.partiel} sub={`Proportion : <b>${propTxt(t.partiel, t.all)}</b>`} />
                <KpiTile icon="down" tone="red" label="Réponses « Non »" value={t.non} sub={`Proportion : <b>${propTxt(t.non, t.all)}</b>`} />
                <KpiTile icon="legend" tone="blue" label="Réponses « Non applicable »" value={t.na} sub={`Proportion : <b>${propTxt(t.na, t.all)}</b>`} />
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="card card-pad lg:col-span-7">
                <CardTitle icon="component" tone={meta.tone} title="Proportion des réponses Oui, Non, Partiellement et Non applicable par composante" sub="6 composantes ACD" />
                {b.composanteAnswers.length ? <StackedAnswers rows={b.composanteAnswers.map((c) => ({ name: c.short, answers: c.answers }))} /> : <div className="py-8 text-center text-[12px] text-surface-500">Aucune donnée.</div>}
              </div>
              <div className="card card-pad lg:col-span-5">
                <CardTitle icon="down" tone="red" title="Top 10 des questions à forte proportion de « Non »" sub="Survolez une barre pour lire la question" />
                {b.topNon.length ? <HBar colorByCotation={false} data={b.topNon.map((i) => ({ name: i.question, value: i.pct }))} height={Math.max(140, b.topNon.length * 30 + 30)} /> : <div className="py-8 text-center text-[12px] text-surface-500">Aucune question exploitable.</div>}
              </div>
            </div>

            <section>
              <SectionBar icon="time">Proportion des réponses OUI par mois et par composante</SectionBar>
              <div className="card card-pad"><MonthTable b={b} months={months} /></div>
            </section>

            <section>
              <SectionBar icon="bars">Score global par {meta.plural.toLowerCase()}</SectionBar>
              <div className="card card-pad">
                {b.perStructure.length ? <HBar data={b.perStructure.map((s) => ({ name: s.name, value: s.score }))} /> : <div className="py-8 text-center text-[12px] text-surface-500">Aucune structure supervisée.</div>}
              </div>
            </section>
          </div>
        );
      }}
    </DataGate>
  );
}

export function SupervisionSynthese() {
  return (
    <DataGate>
      {(d: SupervisionBundle) => {
        const lv = d.levels;
        const ouiOf = (b: LevelBundle) => totals(b).ouiPct ?? 0;
        // Totaux des réponses consolidés sur les trois niveaux de structure.
        const g = (["antenne", "zs", "as"] as StructureLevel[]).reduce(
          (acc, k) => { const t = totals(lv[k]); acc.oui += t.oui; acc.partiel += t.partiel; acc.non += t.non; acc.na += t.na; acc.all += t.all; return acc; },
          { oui: 0, partiel: 0, non: 0, na: 0, all: 0 },
        );
        const prop = (count: number) => (g.all ? `${Math.round((count / g.all) * 100)} %` : "—");
        return (
          <div className="space-y-4">
            <Banner icon="synthese" tone="navy" title="Synthèse transversale de la supervision conjointe"
              sub={<>Vue consolidée Antenne · Zone de santé · Aire de santé</>} />

            <section>
              <SectionBar icon="bars">Réalisation des supervisions</SectionBar>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiTile icon="tower" tone="navy" label="Antennes supervisées" value={lv.antenne.perStructure.length} />
                <KpiTile icon="hospital" tone="violet" label="Zones de santé supervisées" value={lv.zs.perStructure.length} />
                <KpiTile icon="clinic" tone="green" label="Aires de santé supervisées" value={lv.as.perStructure.length} />
                <KpiTile icon="link" tone="blue" label="Total supervisions réalisées" value={d.kpi.total_supervisions} sub="Toutes catégories" />
              </div>
            </section>

            <section>
              <SectionBar icon="component">Réponses administrées</SectionBar>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <KpiTile icon="clip" tone="navy" label="Questions administrées" value={g.all} sub="Total des réponses" />
                <KpiTile icon="check" tone="green" label="Réponses « Oui »" value={g.oui} sub={`Proportion : <b>${prop(g.oui)}</b>`} />
                <KpiTile icon="component" tone="orange" label="Réponses « Partiellement »" value={g.partiel} sub={`Proportion : <b>${prop(g.partiel)}</b>`} />
                <KpiTile icon="down" tone="red" label="Réponses « Non »" value={g.non} sub={`Proportion : <b>${prop(g.non)}</b>`} />
                <KpiTile icon="legend" tone="blue" label="Réponses « Non applicable »" value={g.na} sub={`Proportion : <b>${prop(g.na)}</b>`} />
              </div>
            </section>

            <section>
              <SectionBar icon="component">Appréciation des structures (cotations)</SectionBar>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {([["antenne", "Antennes"], ["zs", "Zones de santé"], ["as", "Aires de santé"]] as [StructureLevel, string][]).map(([k, lab]) => (
                  <div key={k} className="card card-pad">
                    <CardTitle icon={LEVEL_META[k].icon} tone={LEVEL_META[k].tone} title={`Cotations — ${lab}`} />
                    <Donut height={170} data={lv[k].cotations.map((c) => ({ name: c.label, value: c.count, color: c.color }))} />
                  </div>
                ))}
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="card card-pad">
                <CardTitle icon="bars" tone="navy" title="Proportion des réponses OUI par niveau de structure" />
                <HBar colorByCotation data={[
                  { name: "Antennes", value: ouiOf(lv.antenne) },
                  { name: "Zones de santé", value: ouiOf(lv.zs) },
                  { name: "Aires de santé", value: ouiOf(lv.as) },
                ]} />
              </div>
              <div className="card card-pad">
                <CardTitle icon="check" tone="green" title="Scores globaux moyens par niveau" />
                <table className="dtable">
                  <thead><tr><th className="name">Niveau</th><th>Score moyen</th><th>Min</th><th>Max</th><th>Sup.</th></tr></thead>
                  <tbody>
                    {([["antenne", "Antenne"], ["zs", "Zone de santé"], ["as", "Aire de santé"]] as [StructureLevel, string][]).map(([k, lab]) => (
                      <tr key={k}><td className="name">{lab}</td><td>{fmtPct(lv[k].score.moyen)}</td><td>{fmtPct(lv[k].score.min)}</td><td>{fmtPct(lv[k].score.max)}</td><td>{lv[k].score.count}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <section>
              <SectionBar icon="message">Messages clés</SectionBar>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <HlCard icon="check" tone="green" label="Composante la plus performante" big={d.highlights.bestComposante?.short ?? "—"} sub={`Score moyen : ${fmtPct(d.highlights.bestComposante?.score ?? null)}`} />
                <HlCard icon="alert" tone="red" label="Composante la plus faible" big={d.highlights.worstComposante?.short ?? "—"} sub={`Score moyen : ${fmtPct(d.highlights.worstComposante?.score ?? null)}`} />
                <HlCard icon="flag" tone="orange" label="Alerte principale" big={d.highlights.alert ?? "Aucune alerte majeure"} />
              </div>
            </section>
          </div>
        );
      }}
    </DataGate>
  );
}

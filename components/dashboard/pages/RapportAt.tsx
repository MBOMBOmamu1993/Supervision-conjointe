"use client";

/* Onglet « Rapport mensuel des consultants (AT) ». 6 sections alimentées en
   TEMPS RÉEL via /api/at (hook useRapportAt). Collecte continue : un bouton
   « Actualiser » force la resynchronisation. États vides gérés. */
import { useRapportAt } from "@/lib/client/at-api";
import { SectionBar } from "@/components/ui/Card";
import { KpiTile, CardTitle, Banner, C, cotColor, type Tone } from "@/components/proto/proto";
import { ProtoGroupedBar } from "@/components/proto/charts";
import { ProtoScoreBar } from "@/components/proto/charts-ext";
import Donut from "@/components/charts/Donut";
import { DIcon } from "@/components/dashboard/icons";

const pctTxt = (v: number | null | undefined) => (v == null ? "—" : `${v}%`);
const heatScore = (v: number | null) => (v == null ? undefined : `${cotColor(v)}22`);

function Empty({ msg = "En attente de données." }: { msg?: string }) {
  return <div className="py-10 text-center text-[12px] font-semibold text-surface-500">{msg}</div>;
}
function Pending() {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-[12.5px] font-semibold" style={{ background: "#e6f6f4", borderColor: "#b6e3dd", color: "#0f766e" }}>
      <DIcon name="report" style={{ width: 17, height: 17 }} />
      Aucun rapport mensuel soumis pour l'instant — les visuels se recalculent automatiquement à chaque nouvelle soumission Kobo.
    </div>
  );
}
export function RefreshBar({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-semibold text-surface-500">
      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: C.green }} /> Synchronisation temps réel</span>
      <button type="button" onClick={onRefresh} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11.5px] font-bold text-slate-600 transition hover:border-oms-500 hover:text-oms-600">
        <DIcon name="route" style={{ width: 13, height: 13, display: "none" }} />
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></svg>
        Actualiser
      </button>
    </div>
  );
}
function ListCard({ icon, tone, title, items }: { icon: string; tone: Tone; title: string; items: string[] }) {
  return (
    <div className="card card-pad">
      <CardTitle icon={icon as never} tone={tone} title={title} />
      {items.length ? <ul className="ml-4 list-disc space-y-1 text-[12px] text-surface-700">{items.map((t, i) => <li key={i}>{t}</li>)}</ul> : <Empty />}
    </div>
  );
}

/* Verbatims (texte libre du formulaire Kobo) contextualisés AT · antenne · mois. */
type Verbatim = { at: string; antenne: string | null; month: string | null; monthLabel: string | null; text: string };
function NarrativeCard({ icon, tone, title, sub, items, emptyMsg }: { icon: string; tone: Tone; title: string; sub?: string; items: Verbatim[]; emptyMsg?: string }) {
  return (
    <div className="card card-pad">
      <CardTitle icon={icon as never} tone={tone} title={title} sub={sub} />
      {items.length ? (
        <ul className="space-y-2">
          {items.map((v, i) => (
            <li key={i} className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
              <div className="text-[12.5px] leading-snug text-surface-800">{v.text}</div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10.5px] font-semibold text-surface-500">
                {v.antenne && <span className="rounded bg-white px-1.5 py-0.5 ring-1 ring-slate-200">{v.antenne}</span>}
                <span className="rounded bg-white px-1.5 py-0.5 ring-1 ring-slate-200">{v.at}</span>
                {(v.monthLabel || v.month) && <span className="rounded bg-white px-1.5 py-0.5 ring-1 ring-slate-200">{v.monthLabel ?? v.month}</span>}
              </div>
            </li>
          ))}
        </ul>
      ) : <Empty msg={emptyMsg ?? "Aucun verbatim saisi sur la période."} />}
    </div>
  );
}

/* ===================== 1. Vue d'ensemble / Généralités ===================== */
export function RapVue() {
  const { data, refresh } = useRapportAt();
  if (!data) return <Empty msg="Synchronisation…" />;
  const k = data.vue.kpi; const months = data.vue.months;
  return (
    <div className="space-y-4">
      <RefreshBar onRefresh={refresh} />
      {!data.meta.hasData && <Pending />}
      <Banner icon="report" tone="teal" title="Rapport mensuel des AT — Vue d'ensemble" sub="Couverture, complétude des rapports et score global d'appui" />
      <section>
        <SectionBar icon="bars">Indicateurs clés</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="antenne" tone="teal" label="Antennes appuyées" value={k.antennes} sub="antennes PEV" />
          <KpiTile icon="zs" tone="blue" label="Zones de santé appuyées" value={k.zones} sub="ZS couvertes" />
          <KpiTile icon="report" tone="green" label="Rapports mensuels soumis" value={`${k.rapportsSoumis} / ${k.rapportsAttendus}`} sub={pctTxt(k.rapportsPct)} />
          <KpiTile icon="eval" tone="violet" label="AT ayant rapporté" value={`${k.atsRapporte} / ${k.atsTotal}`} sub={pctTxt(k.atsTotal ? Math.round((k.atsRapporte / k.atsTotal) * 100) : null)} />
        </div>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="card card-pad lg:col-span-5">
          <CardTitle icon="report" tone="teal" title="Rapports soumis par AT" />
          {data.vue.rapportsParAt.length ? <ProtoGroupedBar height={210} unit="" colors={[C.teal]} cats={data.vue.rapportsParAt.map((r) => r.at)} series={[{ name: "Rapports", data: data.vue.rapportsParAt.map((r) => r.count) }]} rotateLabels /> : <Empty />}
        </div>
        <div className="card card-pad lg:col-span-4">
          <CardTitle icon="chart" tone="blue" title="Rapports mensuels soumis par mois" />
          {data.vue.rapportsParMois.length ? <ProtoGroupedBar height={210} unit="" colors={[C.blue]} cats={data.vue.rapportsParMois.map((r) => r.label)} series={[{ name: "Rapports", data: data.vue.rapportsParMois.map((r) => r.count) }]} /> : <Empty />}
        </div>
        <div className="card card-pad lg:col-span-3">
          <CardTitle icon="cotation" tone="green" title="Complétude des rapports" />
          <Donut height={200} data={[{ name: "Soumis", value: k.rapportsSoumis, color: C.green }, { name: "Manquants", value: Math.max(0, k.rapportsAttendus - k.rapportsSoumis), color: C.red }]} />
        </div>
      </div>
      <div className="card card-pad">
        <CardTitle icon="gauge" tone="navy" title="Score global d'appui par AT et par mois (%)" />
        {data.vue.scoreParAtMois.length ? (
          <div className="overflow-x-auto"><table className="dtable">
            <thead><tr><th className="name">Assistant technique</th><th>Antenne</th>{months.map((m) => <th key={m.key}>{m.label}</th>)}<th>Moyenne</th></tr></thead>
            <tbody>{data.vue.scoreParAtMois.map((r) => (
              <tr key={r.at}><td className="name">{r.at}</td><td>{r.antenne ?? "—"}</td>
                {months.map((m) => { const v = r.byMonth[m.key]; return <td key={m.key} style={{ background: heatScore(v) }}>{v == null ? "—" : v}</td>; })}
                <td style={{ background: heatScore(r.moyenne), fontWeight: 800 }}>{r.moyenne == null ? "—" : `${r.moyenne}%`}</td></tr>
            ))}</tbody>
          </table></div>
        ) : <Empty />}
      </div>
      <section>
        <SectionBar icon="message">Problèmes majeurs / constats & recommandations</SectionBar>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <NarrativeCard icon="erreurs" tone="red" title="Problèmes majeurs identifiés / constats"
            sub="Verbatims des supervisions (AS · ZS · Antenne), de la validation des données et du monitorage ZS"
            items={data.vue.constats} emptyMsg="Aucun problème ou constat saisi sur la période filtrée." />
          <NarrativeCard icon="reco" tone="green" title="Recommandations & actions correctrices"
            sub="Verbatims des réunions CCPeV, supervisions, coordination, validation et monitorage ZS"
            items={data.vue.recommandations} emptyMsg="Aucune recommandation saisie sur la période filtrée." />
        </div>
      </section>
    </div>
  );
}

/* ===================== 2. Tenue des réunions ===================== */
export function RapReunions() {
  const { data, refresh } = useRapportAt();
  if (!data) return <Empty msg="Synchronisation…" />;
  const s = data.reunions; const months = s.months;
  return (
    <div className="space-y-4">
      <RefreshBar onRefresh={refresh} />
      {!data.meta.hasData && <Pending />}
      <Banner icon="comment" tone="teal" title="Tenue des réunions" sub="CCPeV · surveillance · validation des données · revues mensuelles ZS" />
      <section>
        <SectionBar icon="bars">Indicateurs clés</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="comment" tone="teal" label="Réunions CCPeV tenues" value={`${s.kpi.ccpevTenues} / ${s.kpi.ccpevPrevues}`} sub="1 prévue / mois" />
          <KpiTile icon="check" tone="blue" label="Réunions surveillance appuyées" value={`${s.kpi.survAppuyees} / ${s.kpi.survPrevues}`} sub={pctTxt(s.tauxParType[1]?.taux)} />
          <KpiTile icon="table" tone="violet" label="Validation des données appuyées" value={`${s.kpi.validAppuyees} / ${s.kpi.validPrevues}`} sub={pctTxt(s.tauxParType[2]?.taux)} />
          <KpiTile icon="reco" tone="green" label="Revues mensuelles ZS appuyées" value={`${s.kpi.revuesAppuyees} / ${s.kpi.revuesPrevues}`} sub={pctTxt(s.tauxParType[3]?.taux)} />
        </div>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="card card-pad lg:col-span-7">
          <CardTitle icon="chart" tone="teal" title="Réunions prévues vs appuyées par type" />
          {s.prevuesVsAppuyees.some((t) => t.prevues || t.appuyees) ? <ProtoGroupedBar height={220} unit="" colors={[C.navy, C.teal]} cats={s.prevuesVsAppuyees.map((t) => t.type)} rotateLabels
            series={[{ name: "Prévues", data: s.prevuesVsAppuyees.map((t) => t.prevues) }, { name: "Appuyées par AT", data: s.prevuesVsAppuyees.map((t) => t.appuyees) }]} /> : <Empty />}
        </div>
        <div className="card card-pad lg:col-span-5">
          <CardTitle icon="gauge" tone="blue" title="Taux d'appui par type de réunion" />
          {s.tauxParType.some((t) => t.taux != null) ? <ProtoScoreBar horiz height={220} unit="%" max={100} cats={s.tauxParType.map((t) => t.type)} vals={s.tauxParType.map((t) => t.taux ?? 0)} /> : <Empty />}
        </div>
      </div>
      <div className="card card-pad">
        <CardTitle icon="table" tone="navy" title="Réunions appuyées par AT et par mois" sub="CCPeV · surveillance · validation · mensuelles" />
        {s.tableParAtMois.length ? (
          <div className="overflow-x-auto"><table className="dtable">
            <thead><tr><th className="name">Assistant technique</th>{months.map((m) => <th key={m.key}>{m.label}</th>)}<th>Total</th></tr></thead>
            <tbody>{s.tableParAtMois.map((r) => (
              <tr key={r.at}><td className="name">{r.at}</td>{months.map((m) => <td key={m.key}>{r.byMonth[m.key] ?? "—"}</td>)}<td><b>{r.total}</b></td></tr>
            ))}</tbody>
          </table></div>
        ) : <Empty />}
      </div>
    </div>
  );
}

/* ===================== 3. Supervisions ===================== */
export function RapSupervisions() {
  const { data, refresh } = useRapportAt();
  if (!data) return <Empty msg="Synchronisation…" />;
  const s = data.supervisions; const months = s.months;
  return (
    <div className="space-y-4">
      <RefreshBar onRefresh={refresh} />
      {!data.meta.hasData && <Pending />}
      <Banner icon="link" tone="blue" title="Supervisions" sub="Antenne · Zone de santé · Aire de santé" />
      <section>
        <SectionBar icon="bars">Indicateurs clés</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="antenne" tone="blue" label="Antennes supervisées" value={`${s.kpi.antSup} / ${s.kpi.antPrev}`} sub={pctTxt(s.tauxParNiveau[0]?.taux)} />
          <KpiTile icon="zs" tone="violet" label="ZS supervisées" value={`${s.kpi.zsSup} / ${s.kpi.zsPrev}`} sub={pctTxt(s.tauxParNiveau[1]?.taux)} />
          <KpiTile icon="as" tone="green" label="AS supervisées" value={`${s.kpi.asSup} / ${s.kpi.asPrev}`} sub={pctTxt(s.tauxParNiveau[2]?.taux)} />
          <KpiTile icon="form" tone="teal" label="Formulaires soumis" value={s.kpi.formsSoumis} sub="Antenne · ZS · AS" />
        </div>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="card card-pad lg:col-span-7">
          <CardTitle icon="chart" tone="blue" title="Supervisions attendues vs réalisées par niveau" />
          {s.attenduVsRealise.some((t) => t.attendues || t.realisees) ? <ProtoGroupedBar height={220} unit="" colors={[C.navy, C.blue]} cats={s.attenduVsRealise.map((t) => t.niveau)}
            series={[{ name: "Attendues", data: s.attenduVsRealise.map((t) => t.attendues) }, { name: "Réalisées", data: s.attenduVsRealise.map((t) => t.realisees) }]} /> : <Empty />}
        </div>
        <div className="card card-pad lg:col-span-5">
          <CardTitle icon="gauge" tone="green" title="Taux de réalisation par niveau" />
          {s.tauxParNiveau.some((t) => t.taux != null) ? <ProtoScoreBar horiz height={220} unit="%" max={100} cats={s.tauxParNiveau.map((t) => t.niveau)} vals={s.tauxParNiveau.map((t) => t.taux ?? 0)} /> : <Empty />}
        </div>
      </div>
      <div className="card card-pad">
        <CardTitle icon="table" tone="navy" title="Supervisions (Antenne · ZS · AS) réalisées par AT et par mois" />
        {s.tableParAtMois.length ? (
          <div className="overflow-x-auto"><table className="dtable">
            <thead><tr><th className="name">Assistant technique</th>{months.map((m) => <th key={m.key}>{m.label}</th>)}<th>Total</th></tr></thead>
            <tbody>{s.tableParAtMois.map((r) => (
              <tr key={r.at}><td className="name">{r.at}</td>{months.map((m) => <td key={m.key}>{r.byMonth[m.key] ?? "—"}</td>)}<td><b>{r.total}</b></td></tr>
            ))}</tbody>
          </table></div>
        ) : <Empty />}
      </div>
    </div>
  );
}

/* ===================== 4. Monitorage de convenance ===================== */
export function RapMonitorage() {
  const { data, refresh } = useRapportAt();
  if (!data) return <Empty msg="Synchronisation…" />;
  const s = data.monitorage; const months = s.months;
  return (
    <div className="space-y-4">
      <RefreshBar onRefresh={refresh} />
      {!data.meta.hasData && <Pending />}
      <Banner icon="gauge" tone="violet" title="Monitorage de convenance" sub="Réalisation par AT et par mois" />
      <section>
        <SectionBar icon="bars">Indicateurs clés</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="gauge" tone="violet" label="Monitorages réalisés" value={`${s.kpi.realises} / ${s.kpi.prevus}`} sub={pctTxt(s.kpi.pct)} />
          <KpiTile icon="as" tone="blue" label="AS couvertes" value={s.kpi.asCouvertes} sub="aires monitorées" />
          <KpiTile icon="form" tone="green" label="Formulaires soumis" value={s.kpi.formsSoumis} sub="monitorage" />
          <KpiTile icon="cotation" tone="teal" label="Taux de couverture" value={pctTxt(s.kpi.pct)} sub="réalisés / prévus" />
        </div>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="card card-pad lg:col-span-7">
          <CardTitle icon="table" tone="violet" title="Monitorages réalisés par AT et par mois" />
          {s.parAtMois.length ? (
            <div className="overflow-x-auto"><table className="dtable">
              <thead><tr><th className="name">Assistant technique</th>{months.map((m) => <th key={m.key}>{m.label}</th>)}<th>Total</th></tr></thead>
              <tbody>{s.parAtMois.map((r) => (
                <tr key={r.at}><td className="name">{r.at}</td>{months.map((m) => <td key={m.key}>{r.byMonth[m.key] ?? "—"}</td>)}<td><b>{r.total}</b></td></tr>
              ))}</tbody>
            </table></div>
          ) : <Empty />}
        </div>
        <div className="card card-pad lg:col-span-5">
          <CardTitle icon="cotation" tone="green" title="Couverture du monitorage" />
          <Donut height={210} data={[{ name: "AS monitorées", value: s.couverture.couvertes, color: C.green }, { name: "AS non couvertes", value: s.couverture.nonCouvertes, color: C.red }]} />
        </div>
      </div>
    </div>
  );
}

/* ===================== 5. Surveillance ===================== */
export function RapSurveillance() {
  const { data, refresh } = useRapportAt();
  if (!data) return <Empty msg="Synchronisation…" />;
  const s = data.surveillance;
  return (
    <div className="space-y-4">
      <RefreshBar onRefresh={refresh} />
      {!data.meta.hasData && <Pending />}
      <Banner icon="erreurs" tone="red" title="Surveillance" sub="Rougeole · TNN · MAPI graves" />
      <section>
        <SectionBar icon="bars">Indicateurs clés</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="erreurs" tone="red" label="Cas suspects rougeole notifiés" value={s.kpi.rougeoleNotifies} sub="période filtrée" />
          <KpiTile icon="check" tone="blue" label="Cas rougeole investigués" value={s.kpi.rougeoleInvestigues} sub={pctTxt(s.kpi.rougeolePct)} />
          <KpiTile icon="syringe" tone="orange" label="Ripostes organisées" value={s.kpi.ripostes} sub="autour des cas" />
          <KpiTile icon="reco" tone="violet" label="Cas TNN notifiés" value={s.kpi.tnnNotifies} sub={`${s.kpi.tnnInvestigues} investigués`} />
        </div>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card card-pad">
          <CardTitle icon="chart" tone="red" title="Rougeole : notifiés vs investigués par antenne" />
          {s.rougeoleParAntenne.length ? <ProtoGroupedBar height={220} unit="" colors={[C.navy, C.blue]} cats={s.rougeoleParAntenne.map((r) => r.antenne)}
            series={[{ name: "Notifiés", data: s.rougeoleParAntenne.map((r) => r.notifies) }, { name: "Investigués", data: s.rougeoleParAntenne.map((r) => r.investigues) }]} /> : <Empty />}
        </div>
        <div className="card card-pad">
          <CardTitle icon="gauge" tone="blue" title="% des cas notifiés investigués par antenne" />
          {s.rougeoleParAntenne.some((r) => r.pct != null) ? <ProtoScoreBar horiz height={220} unit="%" max={100} cats={s.rougeoleParAntenne.map((r) => r.antenne)} vals={s.rougeoleParAntenne.map((r) => r.pct ?? 0)} /> : <Empty />}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="card card-pad lg:col-span-7">
          <CardTitle icon="table" tone="navy" title="Surveillance rougeole — synthèse par antenne" />
          {s.rougeoleParAntenne.length ? (
            <div className="overflow-x-auto"><table className="dtable">
              <thead><tr><th className="name">Antenne</th><th>Notifiés</th><th>Investigués</th><th>% invest.</th></tr></thead>
              <tbody>{s.rougeoleParAntenne.map((r) => (
                <tr key={r.antenne}><td className="name">{r.antenne}</td><td>{r.notifies}</td><td>{r.investigues}</td><td style={{ background: r.pct == null ? undefined : `${cotColor(r.pct)}22` }}>{pctTxt(r.pct)}</td></tr>
              ))}</tbody>
            </table></div>
          ) : <Empty />}
        </div>
        <div className="card card-pad lg:col-span-5">
          <CardTitle icon="erreurs" tone="violet" title="TNN & MAPI graves" />
          <table className="dtable">
            <thead><tr><th className="name">Indicateur</th><th>Notifiés</th><th>Investigués</th></tr></thead>
            <tbody>
              <tr><td className="name">Cas TNN</td><td>{s.tnnMapi.tnnNotifies}</td><td>{s.tnnMapi.tnnInvestigues}</td></tr>
              <tr><td className="name">Ripostes TNN</td><td>{s.tnnMapi.ripostesTnn}</td><td>{s.tnnMapi.ripostesTnn}</td></tr>
              <tr><td className="name">MAPI graves</td><td>{s.tnnMapi.mapiNotifiees}</td><td>{s.tnnMapi.mapiInvestiguees}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ===================== 6. OSP & activités spéciales ===================== */
export function RapOsp() {
  const { data, refresh } = useRapportAt();
  if (!data) return <Empty msg="Synchronisation…" />;
  const s = data.osp;
  return (
    <div className="space-y-4">
      <RefreshBar onRefresh={refresh} />
      {!data.meta.hasData && <Pending />}
      <Banner icon="check" tone="teal" title="OSP, activités spéciales & rapports" sub="Outils de suivi des performances et rapports transmis" />
      <section>
        <SectionBar icon="bars">Indicateurs clés</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="check" tone="green" label="OSP partagés" value={pctTxt(s.kpi.ospPartagesPct)} sub="remplis & transmis" />
          <KpiTile icon="calendar" tone="blue" label="Activités spéciales" value={s.kpi.activitesSpeciales} sub="types recensés" />
          <KpiTile icon="report" tone="violet" label="Rapports trimestriels transmis" value={`${s.kpi.rapportsTrimTransmis} / ${s.kpi.rapportsTrimAttendus}`} sub="antennes" />
          <KpiTile icon="gauge" tone="teal" label="Activités OMS justifiées" value={pctTxt(s.kpi.omsJustifieesPct)} sub="preuve / rapport" />
        </div>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card card-pad">
          <CardTitle icon="chart" tone="blue" title="OSP : disponibles · remplis · transmis (par antenne)" />
          {s.ospParAntenne.length ? <ProtoGroupedBar height={220} unit="%" max={100} colors={[C.navy, C.blue, C.green]} cats={s.ospParAntenne.map((r) => r.antenne)}
            series={[{ name: "Disponible", data: s.ospParAntenne.map((r) => r.disponible ?? 0) }, { name: "Rempli régul.", data: s.ospParAntenne.map((r) => r.rempli ?? 0) }, { name: "Transmis", data: s.ospParAntenne.map((r) => r.transmis ?? 0) }]} /> : <Empty />}
        </div>
        <ListCard icon="legend" tone="violet" title="Types d'activités spéciales appuyées" items={s.typesActivites} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="card card-pad lg:col-span-7">
          <CardTitle icon="table" tone="navy" title="Rapports trimestriels Antenne PEV transmis au niveau national" sub="par antenne" />
          {s.rapportsTrimParAntenne.length ? (
            <div className="overflow-x-auto"><table className="dtable">
              <thead><tr><th className="name">Antenne</th><th>Transmis</th><th>Attendus</th><th>Statut</th></tr></thead>
              <tbody>{s.rapportsTrimParAntenne.map((r) => (
                <tr key={r.antenne}><td className="name">{r.antenne}</td><td>{r.transmis}</td><td>{r.attendus}</td>
                  <td style={{ background: r.statut ? "#e6f6ec" : "#fde2e2", fontWeight: 700, color: r.statut ? "#178a44" : "#c81e1e" }}>{r.statut ? "Bien" : "Mal"}</td></tr>
              ))}</tbody>
            </table></div>
          ) : <Empty />}
        </div>
        <div className="card card-pad lg:col-span-5">
          <CardTitle icon="gauge" tone="teal" title="% d'activités financées par l'OMS justifiées" />
          {s.omsJustifieesParAntenne.some((r) => r.pct != null) ? <ProtoScoreBar horiz height={210} unit="%" max={100} cats={s.omsJustifieesParAntenne.map((r) => r.antenne)} vals={s.omsJustifieesParAntenne.map((r) => r.pct ?? 0)} /> : <Empty />}
        </div>
      </div>
      <section>
        <SectionBar icon="message">Transmission du rapport trimestriel de l'Antenne PEV</SectionBar>
        <NarrativeCard icon="report" tone="violet" title="Commentaires sur la transmission du rapport trimestriel PEV"
          sub="Verbatims saisis par les AT (section 12 du formulaire)"
          items={s.commentairesRapportPev} emptyMsg="Aucun commentaire saisi sur la transmission du rapport trimestriel sur la période filtrée." />
      </section>
    </div>
  );
}

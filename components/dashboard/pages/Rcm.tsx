"use client";

/* Onglet « Monitorage rapide de convenance » (RCM). Données LIVE via /api/rcm
   (hook useRcm). Le formulaire peut être sans soumission : un bandeau l'indique
   et les visuels s'alimentent automatiquement dès les premières données. */
import { useRcm } from "@/lib/client/rcm-api";
import { useDhis2Cv } from "@/lib/client/dhis2-api";
import { useTabFilters } from "@/lib/state/filters";
import { norm } from "@/lib/geo";
import { fmtMonth } from "@/lib/client/format";
import type { RcmBundle } from "@/lib/rcm/types";
import { SectionBar } from "@/components/ui/Card";
import { KpiTile, CardTitle, Banner, C } from "@/components/proto/proto";
import { DIcon } from "@/components/dashboard/icons";
import { ProtoGroupedBar, ProtoHBar } from "@/components/proto/charts";
import Donut from "@/components/charts/Donut";
import { TableExportButtons } from "@/components/ui/TableExport";

const pctTxt = (v: number | null) => (v == null ? "—" : `${v}%`);
function Pending() {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-[12.5px] font-semibold" style={{ background: "#f5f0fe", borderColor: "#e9d7fd", color: "#6d28d9" }}>
      <DIcon name="gauge" style={{ width: 17, height: 17 }} />
      Formulaire RCM sans soumission pour l'instant — les visuels s'alimenteront automatiquement dès les premières données Kobo.
    </div>
  );
}
function Empty({ msg = "En attente de données." }: { msg?: string }) {
  return <div className="py-10 text-center text-[12px] font-semibold text-surface-500">{msg}</div>;
}
const heat = (v: number | null) => (v == null ? undefined : v >= 50 ? "#fde2e2" : v >= 30 ? "#ffe8cc" : v >= 15 ? "#fff3bf" : "#e6f6ec");

/* ===================== 1. Vue d'ensemble ===================== */
export function RcmVue() {
  const { data } = useRcm();
  if (!data) return <Empty msg="Synchronisation…" />;
  const k = data.kpi;
  return (
    <div className="space-y-4">
      {!data.meta.hasData && <Pending />}
      <Banner icon="overview" tone="violet" title="Monitorage rapide de convenance — Vue d'ensemble" sub="Couverture, accessibilité géographique et enfants manqués" />
      <section>
        <SectionBar icon="bars">Indicateurs clés</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiTile icon="enfants" tone="violet" label="AS ayant bénéficié du MRC" value={`${k.asBeneficiaires} / ${k.asTotal}`} />
          <KpiTile icon="pin" tone="navy" label="Localités monitorées" value={k.localites} />
          <KpiTile icon="pin" tone="green" label="Localités < 5 km" value={pctTxt(k.distancePct.moins_5km)} />
          <KpiTile icon="pin" tone="orange" label="Localités > 10 km" value={pctTxt(k.distancePct.plus_10km)} />
          <KpiTile icon="enfants" tone="red" label="Enfants manqués" value={pctTxt(k.missAnyPct)} sub="global" />
          <KpiTile icon="form" tone="blue" label="Enfants avec carte" value={pctTxt(k.cartePct)} />
        </div>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="card card-pad lg:col-span-5">
          <CardTitle icon="cotation" tone="blue" title="Répartition des localités selon la distance au CS" />
          <Donut height={210} data={[
            { name: "< 5 km", value: k.distance.moins_5km, color: C.green },
            { name: "5–10 km", value: k.distance.entre_5_10km, color: C.orange },
            { name: "> 10 km", value: k.distance.plus_10km, color: C.red },
          ]} />
        </div>
        <div className="card card-pad lg:col-span-7">
          <CardTitle icon="table" tone="navy" title="Lecture rapide" right={<TableExportButtons filename="Lecture rapide" />} />
          <table className="dtable">
            <thead><tr><th className="name">Indicateur</th><th>Valeur</th></tr></thead>
            <tbody>
              <tr><td className="name">Couverture du MRC</td><td>{k.asTotal ? `${Math.round((k.asBeneficiaires / k.asTotal) * 100)} %` : "—"}</td></tr>
              <tr><td className="name">Accessibilité géographique (&lt; 10 km)</td><td>{k.distancePct.moins_5km == null ? "—" : `${Math.round((k.distancePct.moins_5km ?? 0) + (k.distancePct.entre_5_10km ?? 0))} %`}</td></tr>
              <tr><td className="name">Enfants manqués</td><td>{pctTxt(k.missAnyPct)}</td></tr>
              <tr><td className="name">Possession de carte</td><td>{pctTxt(k.cartePct)}</td></tr>
              <tr><td className="name">Antigènes prioritaires</td><td>{k.antigenesPrioritaires}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="card card-pad lg:col-span-7">
          <CardTitle icon="syringe" tone="blue" title="% global enfants manqués par antigène" />
          {data.meta.hasData ? <ProtoHBar height={220} byCot={false} color={C.blue} maxName={70} rows={data.missByAntigene.map((m) => [m.antigene, m.pct ?? 0]) as [string, number][]} /> : <Empty />}
        </div>
        <div className="card card-pad lg:col-span-5">
          <CardTitle icon="cotation" tone="green" title="Possession de carte de vaccination" />
          <Donut height={210} data={[
            { name: "Carte disponible", value: k.cartePct ?? 0, color: C.green },
            { name: "Sans carte", value: k.sansCartePct ?? 0, color: C.red },
          ]} />
        </div>
      </div>
    </div>
  );
}

/* ===================== 2. Vaccination ===================== */
export function RcmVaccination() {
  const { data } = useRcm();
  const f = useTabFilters("rcm");
  if (!data) return <Empty msg="Synchronisation…" />;
  const k = data.kpi;
  const ANT = data.missByAntigene.map((m) => m.antigene);
  // Tableau « % enfants manqués » DYNAMIQUE : par ZS par défaut ; dès qu'une
  // ZS (ou une AS) est filtrée, le détail s'affiche par aire de santé.
  const showAires = !!(f.zone || f.aire);
  const missRows = showAires
    ? data.missByAire.map((r) => ({ name: r.aire, values: r.values }))
    : data.missByZs.map((r) => ({ name: r.zone, values: r.values }));
  const missLevel = showAires ? "aire de santé" : "zone de santé";
  return (
    <div className="space-y-4">
      {!data.meta.hasData && <Pending />}
      <Banner icon="syringe" tone="violet" title="Monitorage rapide de convenance — Vaccination" sub="Statut vaccinal par tranche d'âge et par antigène" />
      <section>
        <SectionBar icon="bars">Indicateurs clés</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="form" tone="blue" label="Enfants avec carte" value={pctTxt(k.cartePct)} />
          <KpiTile icon="syringe" tone="green" label="Enfants vaccinés" value={pctTxt(k.vaccinePct)} />
          <KpiTile icon="enfants" tone="red" label="Enfants non vaccinés" value={pctTxt(k.nonVaccinePct)} />
          <KpiTile icon="rr" tone="violet" label="Antigènes prioritaires" value={k.antigenesPrioritaires} />
        </div>
      </section>
      <section>
        <SectionBar icon="component">Enfants vaccinés et non vaccinés par tranche d'âge et antigène</SectionBar>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {data.byAge.map((g) => (
            <div key={g.group} className="card card-pad">
              <CardTitle icon="chart" tone="blue" title={g.label} />
              {data.meta.hasData ? <ProtoGroupedBar height={210} unit="" colors={[C.green, C.red]} cats={g.antigenes.map((a) => a.antigene)}
                series={[{ name: "Vaccinés", data: g.antigenes.map((a) => a.vaccines) }, { name: "Non vacc.", data: g.antigenes.map((a) => a.nonVaccines) }]} /> : <Empty />}
            </div>
          ))}
        </div>
      </section>
      <div className="card card-pad">
        <CardTitle icon="table" tone="navy" title={`% enfants manqués par ${missLevel} et antigène`} right={<TableExportButtons filename={`% enfants manqués par ${missLevel} et antigène`} />} />
        {missRows.length ? (
          <div className="overflow-x-auto"><table className="dtable">
            <thead><tr><th className="name">{showAires ? "Aire de santé" : "Zone de santé"}</th>{ANT.map((a) => <th key={a}>{a}</th>)}</tr></thead>
            <tbody>{missRows.map((r) => (
              <tr key={r.name}><td className="name">{r.name}</td>{ANT.map((a) => { const v = r.values[a]; return <td key={a} style={{ background: heat(v) }}>{pctTxt(v)}</td>; })}</tr>
            ))}</tbody>
          </table></div>
        ) : <Empty />}
      </div>
      <CvComparisonTable data={data} />
    </div>
  );
}

/* ===================== 3. Raisons ===================== */
export function RcmRaisons() {
  const { data } = useRcm();
  if (!data) return <Empty msg="Synchronisation…" />;
  const k = data.kpi;
  const topCarte = data.reasonsCarte[0]?.label ?? "—";
  const topVacc = data.reasonsVacc[0]?.label ?? "—";
  const autres = data.reasonsVacc.slice(3);
  return (
    <div className="space-y-4">
      {!data.meta.hasData && <Pending />}
      <Banner icon="question" tone="violet" title="Monitorage rapide de convenance — Raisons" sub="Non-possession de carte et non-vaccination" />
      <section>
        <SectionBar icon="bars">Indicateurs clés</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="form" tone="red" label="Sans carte" value={pctTxt(k.sansCartePct)} />
          <KpiTile icon="question" tone="orange" label="Raison principale sans carte" value={topCarte} />
          <KpiTile icon="enfants" tone="green" label="Raison principale non vacc." value={topVacc} />
          <KpiTile icon="rank" tone="violet" label="Raisons recensées" value={data.reasonsCarte.length + data.reasonsVacc.length} />
        </div>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card card-pad">
          <CardTitle icon="chart" tone="blue" title="Raisons de non-possession de carte" />
          {data.reasonsCarte.length ? <ProtoHBar height={Math.max(170, data.reasonsCarte.length * 34)} byCot={false} color={C.blue} maxName={170} unit="" max={Math.max(...data.reasonsCarte.map((r) => r.count), 1)} rows={data.reasonsCarte.map((r) => [r.label, r.count]) as [string, number][]} /> : <Empty />}
        </div>
        <div className="card card-pad">
          <CardTitle icon="chart" tone="navy" title="Raisons principales de non vaccination" />
          {data.reasonsVacc.length ? <ProtoHBar height={Math.max(170, data.reasonsVacc.slice(0, 6).length * 34)} byCot={false} color={C.navy} maxName={170} unit="" max={Math.max(...data.reasonsVacc.map((r) => r.count), 1)} rows={data.reasonsVacc.slice(0, 6).map((r) => [r.label, r.count]) as [string, number][]} /> : <Empty />}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card card-pad">
          <CardTitle icon="cotation" tone="violet" title="Autres raisons de non vaccination" />
          {autres.length ? <Donut height={210} data={autres.map((r, i) => ({ name: r.label, value: r.count, color: [C.blue, C.green, C.orange, C.violet, C.red][i % 5] }))} /> : <Empty msg="Raisons secondaires : en attente de données." />}
        </div>
        <div className="card card-pad" style={{ background: "#eaf4fd" }}>
          <CardTitle icon="message" tone="orange" title="Messages clés" />
          <ul className="ml-4 list-disc space-y-1 text-[12.5px] text-surface-700">
            <li>La perte de carte et l'indisponibilité au CS sont les premières causes de non-possession.</li>
            <li>L'absence de l'enfant et l'occupation des parents dominent la non-vaccination.</li>
            <li>Combiner communication, accessibilité et suivi des séances.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ============= Tableau comparatif CV RCM vs CV DHIS2 (SNIS) ============= */

const CV_AGS: { key: "penta1" | "penta3" | "rr1" | "rr2"; label: string }[] = [
  { key: "penta1", label: "PENTA1" },
  { key: "penta3", label: "PENTA3" },
  { key: "rr1", label: "RR1" },
  { key: "rr2", label: "RR2" },
];

/** Fond de cellule selon l'écart |RCM − SNIS| : ≥ 20 pts rouge clair, ≥ 10 pts orange. */
function gapBg(rcm: number | null, snis: number | null): string | undefined {
  if (rcm == null || snis == null) return undefined;
  const gap = Math.abs(rcm - snis);
  if (gap >= 20) return "#fde2e2";
  if (gap >= 10) return "#ffe8cc";
  return undefined;
}

function CvComparisonTable({ data }: { data: RcmBundle }) {
  // Mois de référence DHIS2 calculé à partir de la date de réalisation du RCM
  // (la plus récente de la sélection), et non de la date du jour.
  const { data: dhis2, error } = useDhis2Cv(data.meta.lastRcmDate);
  const moisLabel = dhis2 ? fmtMonth(dhis2.month) : "…";
  // Jointure par nom d'AS normalisé (casse/accents) : lignes = AS couvertes par
  // le RCM (suivent les filtres de l'onglet) ; à défaut de données RCM, les AS
  // DHIS2 sont listées pour exposer au moins la couverture administrative.
  const dhisByName = new Map((dhis2?.aires ?? []).map((a) => [norm(a.name), a]));
  const rcmRows = data.cvParAire;
  const rows = rcmRows.length
    ? rcmRows.map((r) => ({ name: r.name, rcm: r.cv, snis: dhisByName.get(norm(r.name))?.cv ?? null }))
    : (dhis2?.aires ?? []).map((a) => ({ name: a.name, rcm: null as RcmBundle["cvParAire"][number]["cv"] | null, snis: a.cv }));
  const exportData = {
    columns: ["Aire de santé", ...CV_AGS.flatMap((ag) => [`${ag.label} RCM`, `${ag.label} SNIS`])],
    rows: rows.map((r) => [
      r.name,
      ...CV_AGS.flatMap((ag) => [r.rcm?.[ag.key] ?? null, r.snis?.[ag.key] ?? null] as (number | null)[]),
    ]),
  };
  return (
    <div className="card card-pad">
      <CardTitle icon="syringe" tone="violet"
        title={`Couverture vaccinale RCM vs couverture administrative (DHIS2) — ${moisLabel}`}
        right={<TableExportButtons filename={`Couverture vaccinale RCM vs DHIS2 ${moisLabel}`} data={exportData} />} />
      {error ? <Empty msg="Données administratives DHIS2 indisponibles (snis-vaccination-api)." /> : null}
      {!error && rows.length ? (
        <div className="overflow-x-auto">
          <table className="dtable">
            <thead>
              <tr>
                <th className="name" rowSpan={2}>Aire de santé</th>
                {CV_AGS.map((ag) => <th key={ag.key} colSpan={2}>{ag.label}</th>)}
              </tr>
              <tr>
                {CV_AGS.flatMap((ag) => [
                  <th key={`${ag.key}-rcm`}>RCM</th>,
                  <th key={`${ag.key}-snis`}>SNIS</th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <td className="name">{r.name}</td>
                  {CV_AGS.flatMap((ag) => {
                    const rcm = r.rcm?.[ag.key] ?? null;
                    const snis = r.snis?.[ag.key] ?? null;
                    const bg = gapBg(rcm, snis);
                    return [
                      <td key={`${ag.key}-rcm`} style={{ background: bg }}>{pctTxt(rcm)}</td>,
                      <td key={`${ag.key}-snis`} style={{ background: bg }}>{pctTxt(snis)}</td>,
                    ];
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {!error && !rows.length ? <Empty msg="En attente des données RCM et DHIS2." /> : null}
      {!rcmRows.length && rows.length ? (
        <div className="mt-2 text-[11px] text-surface-500">CV RCM en attente des premières soumissions du formulaire — couverture administrative (DHIS2/SNIS) affichée seule.</div>
      ) : null}
    </div>
  );
}

/* ===================== 4. Tableaux ===================== */
export function RcmTableaux() {
  const { data } = useRcm();
  if (!data) return <Empty msg="Synchronisation…" />;
  const carteCats = data.reasonsCarte.map((r) => r);
  const vaccCats = data.reasonsVacc.slice(0, 6);
  const pctOf = (count: number, tot: number) => (tot > 0 ? `${Math.round((count / tot) * 100)}%` : "—");
  return (
    <div className="space-y-4">
      {!data.meta.hasData && <Pending />}
      <Banner icon="table" tone="violet" title="Monitorage rapide de convenance — Tableaux détaillés" sub="Raisons par aire de santé" />
      <section>
        <SectionBar icon="bars">Indicateurs clés</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="enfants" tone="blue" label="AS analysées" value={data.parAire.length} />
          <KpiTile icon="form" tone="green" label="Raisons sans carte" value={`${carteCats.length} catégories`} />
          <KpiTile icon="syringe" tone="orange" label="Raisons non vaccination" value={`${vaccCats.length} catégories`} />
          <KpiTile icon="table" tone="navy" label="Tableaux détaillés" value={2} />
        </div>
      </section>
      <div className="card card-pad">
        <CardTitle icon="table" tone="navy" title="Raisons de non-possession de carte par aire de santé" sub="% des enfants concernés" right={<TableExportButtons filename="Raisons de non-possession de carte par aire de santé" />} />
        {data.parAire.length && carteCats.length ? (
          <div className="overflow-x-auto"><table className="dtable">
            <thead><tr><th className="name">Aire de santé</th>{carteCats.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
            <tbody>{data.parAire.map((r) => { const tot = Object.values(r.reasonsCarte).reduce((a, b) => a + b, 0); return (
              <tr key={r.name}><td className="name">{r.name}</td>{carteCats.map((c) => <td key={c.key}>{pctOf(r.reasonsCarte[c.key] ?? 0, tot)}</td>)}</tr>
            ); })}</tbody>
          </table></div>
        ) : <Empty />}
      </div>
      <div className="card card-pad">
        <CardTitle icon="table" tone="navy" title="Raisons principales de non vaccination par aire de santé" sub="% des enfants concernés" right={<TableExportButtons filename="Raisons principales de non vaccination par aire de santé" />} />
        {data.parAire.length && vaccCats.length ? (
          <div className="overflow-x-auto"><table className="dtable">
            <thead><tr><th className="name">Aire de santé</th>{vaccCats.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
            <tbody>{data.parAire.map((r) => { const tot = Object.values(r.reasonsVacc).reduce((a, b) => a + b, 0); return (
              <tr key={r.name}><td className="name">{r.name}</td>{vaccCats.map((c) => <td key={c.key}>{pctOf(r.reasonsVacc[c.key] ?? 0, tot)}</td>)}</tr>
            ); })}</tbody>
          </table></div>
        ) : <Empty />}
      </div>
    </div>
  );
}

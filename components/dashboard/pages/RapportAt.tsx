"use client";

/* Onglet « Rapport mensuel des consultants (AT) » — REFONTE COMPLÈTE selon la
   maquette Word du Dr Léandre (12/06/2026) :
     · Vue d'ensemble & détails — indicateurs clés (coordination, supervision,
       monitorage, contrôle qualité) + tableaux de détails par AT ;
     · Planification — appuis, mise en œuvre du plan de travail, microplans ;
     · Gestion des vaccins — inventaires + disponibilité PENTA / RR ;
     · Chaîne de froid — fonctionnalité du matériel niveaux ZS et CS ;
     · Prestation de services — sessions (fixes / avancées / mobiles) et
       couvertures vaccinales ≥ 90 % par antigène ;
     · FFOM & recommandations — forces, faiblesses, innovations, difficultés,
       recommandations, appuis attendus, perspectives.
   Source : formulaire Kobo « Rapport mensuel des AT » ACTUALISÉ (nouveaux
   groupes planification / vaccins / chaîne de froid / prestation), temps réel
   via /api/at (hook useRapportAt). Les indicateurs « contrôle qualité » de la
   vue d'ensemble proviennent des formulaires CQ (hook useCqd). */
import { useRapportAt } from "@/lib/client/at-api";
import { useCqd } from "@/lib/client/cqd-api";
import { useDhis2Prestation } from "@/lib/client/dhis2-prestation-api";
import { useDhis2Logistique } from "@/lib/client/dhis2-logistique-api";
import type { OpnCounts, AntenneSeries } from "@/lib/at/types";
import { SectionBar } from "@/components/ui/Card";
import { KpiTile, CardTitle, Banner, C, TONES, covCellStyle, type Tone } from "@/components/proto/proto";
import { ProtoGroupedBar } from "@/components/proto/charts";
import LineTrend from "@/components/charts/LineTrend";
import { DIcon } from "@/components/dashboard/icons";
import { TableExportButtons } from "@/components/ui/TableExport";

const pctTxt = (v: number | null | undefined) => (v == null ? "—" : `${v}%`);

/** Couleur d'une cellule de pourcentage selon la légende (capture TL) :
 *  < 50 % rouge · 50–80 % jaune · 80–90 % vert clair · > 90 % vert. */
function cvLegendStyle(v: number | null | undefined): React.CSSProperties {
  if (v == null) return {};
  if (v < 50) return { background: "#e8313b", color: "#fff", fontWeight: 800 };
  if (v < 80) return { background: "#f5b50a", color: "#5c4500", fontWeight: 800 };
  if (v < 90) return { background: "#a9e3a0", color: "#1e6b2a", fontWeight: 800 };
  return { background: "#22a44a", color: "#fff", fontWeight: 800 };
}
/** Cellule de pourcentage colorée selon la légende de couverture. */
function CvCell({ v }: { v: number | null | undefined }) {
  return <td className="tabular-nums" style={cvLegendStyle(v)}>{pctTxt(v)}</td>;
}

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
/* Indicateur de synchronisation temps réel. Le bouton « Actualiser » est
   UNIQUE, dans l'en-tête du dashboard (GlobalRefreshButton). */
export function RefreshBar() {
  return (
    <div className="flex items-center gap-2 text-[11px] font-semibold text-surface-500">
      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: C.green }} /> Synchronisation temps réel</span>
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

/* Top des problèmes (libellé + nombre d'occurrences). */
function TopBarList({ icon, tone, title, sub, items, color }: { icon: string; tone: Tone; title: string; sub?: string; items: { label: string; count: number }[]; color: string }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="card card-pad">
      <CardTitle icon={icon as never} tone={tone} title={title} sub={sub} />
      {items.length ? (
        <ul className="space-y-2 mt-1">
          {items.map((it, i) => (
            <li key={i} className="text-[12px]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-surface-700">{i + 1}. {it.label}</span>
                <span className="font-bold text-surface-600">{it.count}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full" style={{ width: `${(it.count / max) * 100}%`, background: color }} />
              </div>
            </li>
          ))}
        </ul>
      ) : <Empty msg="Aucun problème signalé sur la période." />}
    </div>
  );
}

/** Carte « activité réalisée » : décompte Oui / Partiel / Non / N-A (maquette planification). */
const OPN_ITEMS: { key: keyof OpnCounts; label: string; color: string }[] = [
  { key: "oui", label: "Oui", color: "#1f9d57" },
  { key: "partiel", label: "Partiel", color: "#0d9488" },
  { key: "non", label: "Non", color: "#f08c00" },
  { key: "na", label: "N/A", color: "#94a3b8" },
];
function OpnCard({ icon, label, counts }: { icon: string; label: string; counts: OpnCounts }) {
  return (
    <div className="card card-pad">
      <div className="mb-2 flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: "linear-gradient(145deg,#0a3a86,#00205c)" }}>
          <DIcon name={icon} style={{ width: 18, height: 18 }} />
        </span>
        <div className="text-[12.5px] font-extrabold leading-tight text-navy-700">{label}</div>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {OPN_ITEMS.map((it) => (
          <div key={it.key} className="rounded-lg px-1.5 py-2 text-center" style={{ background: `${it.color}14` }}>
            <div className="text-[17px] font-extrabold leading-none" style={{ color: it.color }}>{counts[it.key]}</div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-surface-500">{it.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Graphique linéaire mensuel : une série par antenne (+ éventuelle série « Ensemble »). */
function AntenneLines({ months, series, ensemble, title, icon = "up", tone = "blue", exportTitle }: {
  months: { key: string; label: string }[]; series: AntenneSeries[]; ensemble?: (number | null)[];
  title: string; icon?: string; tone?: Tone; exportTitle?: string;
}) {
  const hasData = series.some((s) => s.values.some((v) => v != null)) || (ensemble ?? []).some((v) => v != null);
  return (
    <div className="card card-pad">
      <CardTitle icon={icon as never} tone={tone} title={title} />
      {months.length && hasData ? (
        <LineTrend
          exportTitle={exportTitle ?? title}
          months={months.map((m) => m.key)}
          series={[
            ...series.map((s) => ({ name: s.antenne, data: s.values })),
            ...(ensemble ? [{ name: "Ensemble", data: ensemble, color: "#f29e0b" }] : []),
          ]}
        />
      ) : <Empty />}
    </div>
  );
}

/* ===================== 1. Vue d'ensemble & détails (PREMIÈRE PAGE) ===================== */

/** Indicateurs « contrôle qualité des données » — source : formulaires CQ (CS & ZS). */
function CqKpis() {
  const { data } = useCqd();
  const zs = data?.levels.zs;
  const as = data?.levels.as;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <KpiTile icon="hospital" tone="navy" label="ZS contrôlées" value={zs?.structuresControlees ?? "—"} sub="zones de santé ayant bénéficié du contrôle qualité" />
      <KpiTile icon="clinic" tone="green" label="AS contrôlées" value={as?.structuresControlees ?? "—"} sub="aires de santé ayant bénéficié du contrôle qualité" />
      <KpiTile icon="form" tone="blue" label="Contrôles réalisés" value={(zs?.records ?? 0) + (as?.records ?? 0)} sub="formulaires CQ soumis (ZS + CS)" />
      <KpiTile icon="calendar" tone="teal" label="Mois couverts" value={data?.meta.months.length ?? "—"} sub="période contrôlée" />
    </div>
  );
}

export function RapVue() {
  const { data } = useRapportAt();
  const cqd = useCqd().data;
  if (!data) return <Empty msg="Synchronisation…" />;
  const k = data.vue.kpi;
  const r = data.reunions;
  const s = data.supervisions;
  const m = data.monitorage;
  const months = s.months;
  return (
    <div className="space-y-4">
      <RefreshBar />
      {!data.meta.hasData && <Pending />}
      <Banner icon="report" tone="teal" title="Rapport mensuel des AT — Vue d'ensemble & détails"
        sub="Indicateurs clés (coordination · supervision · monitorage · contrôle qualité) et détails par Assistant Technique" />

      <section>
        <SectionBar icon="bars">Vue d'ensemble</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="report" tone="green" label="Rapports mensuels soumis" value={`${k.rapportsSoumis} / ${k.rapportsAttendus}`} sub={pctTxt(k.rapportsPct)} />
          <KpiTile icon="eval" tone="violet" label="AT ayant rapporté" value={`${k.atsRapporte} / ${k.atsTotal}`} sub={pctTxt(k.atsTotal ? Math.round((k.atsRapporte / k.atsTotal) * 100) : null)} />
          <KpiTile icon="antenne" tone="teal" label="Antennes appuyées" value={k.antennes} sub="antennes PEV" />
          <KpiTile icon="zs" tone="blue" label="Zones de santé appuyées" value={k.zones} sub="ZS couvertes" />
        </div>
      </section>

      <section>
        <SectionBar icon="comment">Coordination — indicateurs clés</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="comment" tone="teal" label="Réunions CCPeV tenues" value={`${r.kpi.ccpevTenues} / ${r.kpi.ccpevPrevues}`} sub="1 prévue / mois" />
          <KpiTile icon="check" tone="blue" label="Réunions surveillance appuyées" value={`${r.kpi.survAppuyees} / ${r.kpi.survPrevues}`} sub={pctTxt(r.tauxParType[1]?.taux)} />
          <KpiTile icon="table" tone="violet" label="Validation des données appuyées" value={`${r.kpi.validAppuyees} / ${r.kpi.validPrevues}`} sub={pctTxt(r.tauxParType[2]?.taux)} />
          <KpiTile icon="reco" tone="green" label="Revues mensuelles ZS appuyées" value={`${r.kpi.revuesAppuyees} / ${r.kpi.revuesPrevues}`} sub={pctTxt(r.tauxParType[3]?.taux)} />
        </div>
      </section>

      <section>
        <SectionBar icon="link">Supervision — indicateurs clés</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="antenne" tone="blue" label="Antennes supervisées" value={`${s.kpi.antSup} / ${s.kpi.antPrev}`} sub={pctTxt(s.tauxParNiveau[0]?.taux)} />
          <KpiTile icon="zs" tone="violet" label="ZS supervisées" value={`${s.kpi.zsSup} / ${s.kpi.zsPrev}`} sub={pctTxt(s.tauxParNiveau[1]?.taux)} />
          <KpiTile icon="as" tone="green" label="AS supervisées" value={`${s.kpi.asSup} / ${s.kpi.asPrev}`} sub={pctTxt(s.tauxParNiveau[2]?.taux)} />
          <KpiTile icon="form" tone="teal" label="Formulaires soumis" value={s.kpi.formsSoumis} sub="Antenne · ZS · AS" />
        </div>
      </section>

      <section>
        <SectionBar icon="gauge">Monitorage rapide de convenance — indicateurs clés</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="gauge" tone="violet" label="Monitorages réalisés" value={`${m.kpi.realises} / ${m.kpi.prevus}`} sub={pctTxt(m.kpi.pct)} />
          <KpiTile icon="as" tone="blue" label="AS couvertes" value={m.kpi.asCouvertes} sub="aires monitorées" />
          <KpiTile icon="form" tone="green" label="Formulaires soumis" value={m.kpi.formsSoumis} sub="monitorage" />
          <KpiTile icon="cotation" tone="teal" label="Taux de couverture" value={pctTxt(m.kpi.pct)} sub="réalisés / prévus" />
        </div>
      </section>

      <section>
        <SectionBar icon="quality">Contrôle qualité des données — indicateurs clés</SectionBar>
        <CqKpis />
      </section>

      <section>
        <SectionBar icon="comment">Détails coordination</SectionBar>
        <div className="card card-pad">
          <CardTitle icon="table" tone="navy" title="Réunions appuyées par AT et par type de réunion" sub="CCPeV · coordination/surveillance · validation des données · revues mensuelles ZS" right={<TableExportButtons filename="Réunions appuyées par AT et par type de réunion" />} />
          {r.parAtType.length ? (
            <div className="overflow-x-auto"><table className="dtable">
              <thead><tr><th className="name">Assistant technique</th><th>CCPeV</th><th>Coordination / surveillance</th><th>Validation des données</th><th>Revues mensuelles ZS</th><th>Total</th></tr></thead>
              <tbody>{r.parAtType.map((row) => (
                <tr key={row.at}><td className="name">{row.at}</td><td>{row.ccpev}</td><td>{row.coordination}</td><td>{row.validation}</td><td>{row.monitorageZs}</td><td><b>{row.total}</b></td></tr>
              ))}</tbody>
            </table></div>
          ) : <Empty />}
        </div>
        <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
          <TopBarList icon="table" tone="red" title="Top 5 des problèmes de qualité des données" sub="Réunions de validation des données — Antenne PEV" items={r.topProblemesQualite} color={C.red} />
          <TopBarList icon="reco" tone="orange" title="Top 5 des problèmes identifiés lors des revues mensuelles" sub="Réunions mensuelles de monitorage des ZS" items={r.topProblemesRevues} color={C.orange} />
        </div>
      </section>

      <section>
        <SectionBar icon="link">Détails supervisions</SectionBar>
        <div className="card card-pad">
          <CardTitle icon="table" tone="navy" title="Supervisions attendues vs réalisées par AT et par niveau" sub="Antenne · Zone de santé · Aire de santé" right={<TableExportButtons filename="Supervisions attendues vs réalisées par AT et par niveau" />} />
          {s.parAtNiveau.length ? (
            <div className="overflow-x-auto"><table className="dtable">
              <thead>
                <tr><th rowSpan={2} className="name">Assistant technique</th><th colSpan={2}>Antenne</th><th colSpan={2}>Zone de santé</th><th colSpan={2}>Aire de santé</th></tr>
                <tr><th>Att.</th><th>Réal.</th><th>Att.</th><th>Réal.</th><th>Att.</th><th>Réal.</th></tr>
              </thead>
              <tbody>{s.parAtNiveau.map((row) => (
                <tr key={row.at}><td className="name">{row.at}</td><td>{row.antAtt}</td><td><b>{row.antReal}</b></td><td>{row.zsAtt}</td><td><b>{row.zsReal}</b></td><td>{row.asAtt}</td><td><b>{row.asReal}</b></td></tr>
              ))}</tbody>
            </table></div>
          ) : <Empty />}
        </div>
        <div className="card card-pad mt-3">
          <CardTitle icon="table" tone="navy" title="Supervisions (Antenne · ZS · AS) réalisées par AT et par mois" right={<TableExportButtons filename="Supervisions réalisées par AT et par mois" />} />
          {s.tableParAtMois.length ? (
            <div className="overflow-x-auto"><table className="dtable">
              <thead><tr><th className="name">Assistant technique</th>{months.map((mc) => <th key={mc.key}>{mc.label}</th>)}<th>Total</th></tr></thead>
              <tbody>{s.tableParAtMois.map((row) => (
                <tr key={row.at}><td className="name">{row.at}</td>{months.map((mc) => <td key={mc.key}>{row.byMonth[mc.key] ?? "—"}</td>)}<td><b>{row.total}</b></td></tr>
              ))}</tbody>
            </table></div>
          ) : <Empty />}
        </div>
        <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
          {s.constatsParNiveau.map((g) => (
            <NarrativeCard key={g.niveau} icon="erreurs" tone="red" title={`Constats — ${g.niveau}`} items={g.items}
              emptyMsg={`Aucun constat saisi pour le niveau ${g.niveau.toLowerCase()}.`} />
          ))}
        </div>
      </section>

      <section>
        <SectionBar icon="gauge">Détails monitorage rapide de convenance</SectionBar>
        <div className="card card-pad">
          <CardTitle icon="table" tone="violet" title="Monitorages réalisés par AT et par mois" right={<TableExportButtons filename="Monitorages réalisés par AT et par mois" />} />
          {m.parAtMois.length ? (
            <div className="overflow-x-auto"><table className="dtable">
              <thead><tr><th className="name">Assistant technique</th>{m.months.map((mc) => <th key={mc.key}>{mc.label}</th>)}<th>Total</th></tr></thead>
              <tbody>{m.parAtMois.map((row) => (
                <tr key={row.at}><td className="name">{row.at}</td>{m.months.map((mc) => <td key={mc.key}>{row.byMonth[mc.key] ?? "—"}</td>)}<td><b>{row.total}</b></td></tr>
              ))}</tbody>
            </table></div>
          ) : <Empty />}
        </div>
      </section>

      <section>
        <SectionBar icon="quality">Détails contrôle qualité</SectionBar>
        <div className="card card-pad">
          <CardTitle icon="table" tone="navy" title="Contrôles qualité réalisés par niveau" sub="Source : formulaires « Contrôle qualité des données » (ZS & CS)" right={<TableExportButtons filename="Contrôles qualité réalisés par niveau" />} />
          {cqd ? (
            <div className="overflow-x-auto"><table className="dtable">
              <thead><tr><th className="name">Niveau</th><th>Structures contrôlées</th><th>Contrôles réalisés</th><th>Mois couverts</th></tr></thead>
              <tbody>
                <tr><td className="name">Zones de santé</td><td>{cqd.levels.zs.structuresControlees}</td><td>{cqd.levels.zs.records}</td><td rowSpan={2}>{cqd.meta.months.length}</td></tr>
                <tr><td className="name">Aires de santé (CS)</td><td>{cqd.levels.as.structuresControlees}</td><td>{cqd.levels.as.records}</td></tr>
              </tbody>
            </table></div>
          ) : <Empty msg="Synchronisation des données de contrôle qualité…" />}
          <div className="mt-2 text-[11px] text-surface-500">
            Les détails complets (écart moyen, facteur de vérification, taux d'erreur par structure) sont disponibles dans l'onglet « Contrôle qualité des données ».
          </div>
        </div>
      </section>
    </div>
  );
}

/* ===================== 2. Planification ===================== */
export function RapPlanification() {
  const { data } = useRapportAt();
  if (!data) return <Empty msg="Synchronisation…" />;
  const p = data.planification;
  const months = p.months;
  const icons = ["check", "calendar", "legend"];
  return (
    <div className="space-y-4">
      <RefreshBar />
      {!data.meta.hasData && <Pending />}
      <Banner icon="calendar" tone="teal" title="Rapport mensuel AT — Planification" sub="Suivi mensuel des activités de planification et de microplanification" />

      <section>
        <SectionBar icon="check">Activités réalisées</SectionBar>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {p.activites.map((a, i) => <OpnCard key={a.key} icon={icons[i] ?? "check"} label={a.label} counts={a.counts} />)}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card card-pad">
          <CardTitle icon="chart" tone="navy" title="Niveau de mise en œuvre des activités du plan de travail par antenne et par mois" sub="Pourcentage (%)" />
          {months.length && p.miseEnOeuvre.some((s) => s.values.some((v) => v != null)) ? (
            <ProtoGroupedBar height={240} unit="%" max={100} cats={months.map((mc) => mc.label)}
              series={p.miseEnOeuvre.map((s) => ({ name: s.antenne, data: s.values.map((v) => v ?? 0) }))} />
          ) : <Empty />}
        </div>
        <AntenneLines months={months} series={p.zsMicroplan} icon="up" tone="blue"
          title="% des ZS avec microplan de qualité et consolidé validé par l'antenne, par mois" />
      </div>

      <div className="card card-pad">
        <CardTitle icon="table" tone="navy" title="Détail mensuel par antenne" sub="Dernier mois renseigné par antenne" right={<TableExportButtons filename="Planification — détail mensuel par antenne" />} />
        {p.detailParAntenne.length ? (
          <div className="overflow-x-auto"><table className="dtable">
            <thead><tr><th className="name">Antenne</th><th>Microplan appuyé<br />(Oui / Partiel / Non / N-A)</th><th>Plan de travail appuyé<br />(Oui / Partiel / Non / N-A)</th><th>État des lieux actualisé<br />(Oui / Partiel / Non / N-A)</th><th>Mise en œuvre du plan (%)</th><th>ZS avec microplan validé (%)</th></tr></thead>
            <tbody>{p.detailParAntenne.map((row) => (
              <tr key={row.antenne}>
                <td className="name">{row.antenne}</td>
                <td>{row.microplan}</td><td>{row.planTravail}</td><td>{row.etatLieux}</td>
                <td className="tabular-nums">{pctTxt(row.miseEnOeuvre)}</td>
                <td className="tabular-nums">{pctTxt(row.zsMicroplan)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <Empty />}
      </div>

      <NarrativeCard icon="message" tone="blue" title="Observations clés" sub="Commentaires sur la planification saisis par les AT"
        items={p.commentaires} emptyMsg="Aucun commentaire de planification saisi sur la période filtrée." />
    </div>
  );
}

/* ===================== 3. Gestion des vaccins ===================== */

/** Cellule du tableau d'inventaires (heatmap Réalisé / Partiel / Non réalisé). */
function InvCell({ v }: { v: string | null }) {
  if (!v) return <td className="text-surface-400">—</td>;
  const style =
    v === "Réalisé" ? { background: "#e6f6ec", color: "#178a44" } :
    v === "Partiel" ? { background: "#e6f3fb", color: "#0078ae" } :
    { background: "#fff5e4", color: "#c87b04" };
  return <td style={{ ...style, fontWeight: 800 }}>{v}</td>;
}

/** Cellule de taux de disponibilité colorée selon la légende de couverture
 *  (rouge < 50 · jaune 50–80 · vert clair 80–90 · vert ≥ 90). */
function DispoCell({ v }: { v: number | null }) {
  return <td className="tabular-nums" style={covCellStyle(v) ?? {}}>{v == null ? "—" : `${v}%`}</td>;
}

/**
 * Taux de disponibilité d'un antigène présenté SOUS FORME DE TABLEAU (feedback
 * TL) : 1re colonne = zone de santé, 1re ligne = mois de l'année, contenu = taux
 * (%) par ZS et par mois. Conserve le design des autres tableaux (.dtable).
 */
function DispoZsTable({ title, tone, months, series }: {
  title: string; tone: Tone; months: { key: string; label: string }[];
  series: { antenne: string; values: (number | null)[] }[];
}) {
  const hasData = months.length > 0 && series.some((s) => s.values.some((v) => v != null));
  return (
    <div className="card card-pad">
      <CardTitle icon="table" tone={tone} title={title} right={<TableExportButtons filename={title} />} />
      {hasData ? (
        <div className="overflow-x-auto"><table className="dtable">
          <thead><tr><th className="name">Zone de santé</th>{months.map((m) => <th key={m.key}>{m.label}</th>)}</tr></thead>
          <tbody>{series.map((s) => (
            <tr key={s.antenne}><td className="name">{s.antenne}</td>{s.values.map((v, i) => <DispoCell key={i} v={v} />)}</tr>
          ))}</tbody>
        </table></div>
      ) : <Empty />}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[10.5px] font-bold text-surface-600">
        <span className="font-extrabold uppercase tracking-wide text-surface-500">Légende :</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-6 rounded-sm" style={{ background: "#dc2626" }} />&lt; 50 %</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-6 rounded-sm" style={{ background: "#f7cf4d" }} />50–80 %</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-6 rounded-sm" style={{ background: "#9ad99e" }} />80–90 %</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-6 rounded-sm" style={{ background: "#36ad56" }} />≥ 90 %</span>
      </div>
    </div>
  );
}

export function RapVaccins() {
  const { data } = useRapportAt();
  // Taux de disponibilité PENTA / RR : source LOGISTIQUE DHIS2/SNIS (situation
  // 2026), méthode identique au dashboard snis-vaccination-api.
  const { data: logi, error: logiErr } = useDhis2Logistique();
  if (!data) return <Empty msg="Synchronisation…" />;
  const v = data.vaccins;
  const months = v.months;
  const dispoMonths = logi?.months ?? [];
  const dispo = logi?.dispo ?? [];
  return (
    <div className="space-y-4">
      <RefreshBar />
      {!data.meta.hasData && <Pending />}
      <Banner icon="syringe" tone="blue" title="Rapport mensuel AT — Gestion des vaccins" sub="Suivi mensuel des inventaires de vaccins et de la disponibilité des antigènes PENTA et RR" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="card card-pad lg:col-span-8">
          <CardTitle icon="table" tone="navy" title="Réalisation des inventaires de vaccins par antenne et par mois" right={<TableExportButtons filename="Réalisation des inventaires de vaccins par antenne et par mois" />} />
          {v.inventaireParAntenneMois.length && months.length ? (
            <div className="overflow-x-auto"><table className="dtable">
              <thead><tr><th className="name">Antenne</th>{months.map((mc) => <th key={mc.key}>{mc.label}</th>)}</tr></thead>
              <tbody>{v.inventaireParAntenneMois.map((row) => (
                <tr key={row.antenne}><td className="name">{row.antenne}</td>{months.map((mc) => <InvCell key={mc.key} v={row.byMonth[mc.key]} />)}</tr>
              ))}</tbody>
            </table></div>
          ) : <Empty />}
          <div className="mt-2 flex flex-wrap gap-3 text-[10.5px] font-bold text-surface-600">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "#2bbd6b" }} />Réalisé</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "#36b3ec" }} />Partiel</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "#fbbf24" }} />Non réalisé</span>
          </div>
        </div>
        <div className="lg:col-span-4 flex flex-col gap-3">
          <div className="card card-pad">
            <CardTitle icon="legend" tone="teal" title="Situation du mois — inventaires" sub={v.inventaire.moisLabel ? `Période : ${v.inventaire.moisLabel}` : undefined} />
            <div className="space-y-2.5 pt-1">
              {[
                { lab: "Antennes ayant réalisé l'inventaire", val: v.inventaire.realises, tone: "green" as Tone, icon: "check" },
                { lab: "Antennes partiellement à jour", val: v.inventaire.partiels, tone: "blue" as Tone, icon: "time" },
                { lab: "Antennes non à jour", val: v.inventaire.nonRealises, tone: "orange" as Tone, icon: "alert" },
              ].map((it) => (
                <div key={it.lab} className="flex items-center gap-3 rounded-xl border px-3 py-2.5" style={{ background: TONES[it.tone].bg, borderColor: TONES[it.tone].border }}>
                  <DIcon name={it.icon} style={{ width: 18, height: 18, color: TONES[it.tone].text }} />
                  <div className="flex-1 text-[12px] font-bold text-surface-700">{it.lab}</div>
                  <div className="text-[16px] font-extrabold" style={{ color: TONES[it.tone].text }}>{it.val}</div>
                  <div className="text-[11px] font-semibold text-surface-500">sur {v.inventaire.total}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {dispo.length ? (
        <>
          {/* Niveau antenne : courbes mensuelles. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {dispo.filter((d) => d.key.endsWith("_antenne")).map((d) => (
              <AntenneLines key={d.key} months={dispoMonths} series={d.series} title={d.label} icon="up" tone={d.key.startsWith("penta") ? "blue" : "violet"} />
            ))}
          </div>
          {/* Niveau zones de santé : tableaux (ZS × mois) — feedback TL. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {dispo.filter((d) => d.key.endsWith("_zs")).map((d) => (
              <DispoZsTable key={d.key} title={d.label} tone={d.key.startsWith("penta") ? "blue" : "violet"} months={dispoMonths} series={d.series} />
            ))}
          </div>
        </>
      ) : (
        <div className="card card-pad">
          <Empty msg={logiErr ? "Données de logistique DHIS2 indisponibles (snis-vaccination-api)." : "Chargement des taux de disponibilité (logistique DHIS2)…"} />
        </div>
      )}
    </div>
  );
}

/* ===================== 4. Chaîne de froid ===================== */
export function RapChaineFroid() {
  const { data } = useRapportAt();
  if (!data) return <Empty msg="Synchronisation…" />;
  const c = data.chaineFroid;
  const months = c.months;
  return (
    <div className="space-y-4">
      <RefreshBar />
      {!data.meta.hasData && <Pending />}
      <Banner icon="gauge" tone="navy" title="Rapport mensuel AT — Gestion matérielle de la chaîne de froid" sub="Suivi mensuel de la fonctionnalité des équipements de chaîne de froid" />

      <section>
        <SectionBar icon="bars">Indicateurs clés</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiTile icon="antenne" tone="blue" label="Antennes suivies" value={c.kpi.antennesSuivies} sub="antennes PEV" />
          <KpiTile icon="zs" tone="teal" label="ZS couvertes" value={c.kpi.zsCouvertes} sub="zones de santé appuyées" />
          <KpiTile icon="report" tone="green" label="Rapports mensuels" value={c.kpi.rapports} sub="soumissions analysées" />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <AntenneLines months={months} series={c.cdfZs} icon="up" tone="navy"
          title="% matériel de chaîne de froid fonctionnel au niveau ZS, par mois" />
        <AntenneLines months={months} series={c.cdfCs} icon="up" tone="blue"
          title="% matériel de chaîne de froid fonctionnel au niveau CS, par mois" />
      </div>

      <div className="card card-pad">
        <CardTitle icon="table" tone="navy" title="Détail mensuel par antenne" right={<TableExportButtons filename="Chaîne de froid — détail mensuel par antenne" />} />
        {c.detailParAntenne.length ? (
          <div className="overflow-x-auto"><table className="dtable">
            <thead><tr><th className="name">Antenne</th><th>Fonctionnalité CDF niveau ZS (%)</th><th>Fonctionnalité CDF niveau CS (%)</th><th>Observations techniques</th></tr></thead>
            <tbody>{c.detailParAntenne.map((row) => (
              <tr key={row.antenne}>
                <td className="name">{row.antenne}</td>
                <td className="tabular-nums">{pctTxt(row.cdfZs)}</td>
                <td className="tabular-nums">{pctTxt(row.cdfCs)}</td>
                <td style={{ whiteSpace: "normal", textAlign: "left" }}>{row.observations ?? "—"}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <Empty />}
      </div>

      <NarrativeCard icon="message" tone="blue" title="Observations clés" sub="Commentaires sur le matériel de chaîne de froid saisis par les AT"
        items={c.commentaires} emptyMsg="Aucun commentaire de chaîne de froid saisi sur la période filtrée." />
    </div>
  );
}

/* Ligne « détail prestation » par antenne (couvertures et sessions, %). */
type PrestaRow = { antenne: string; fixes: number | null; avancees: number | null; mobiles: number | null; p1: number | null; p3: number | null; rr1: number | null; rr2: number | null };

/**
 * Commentaire AUTOMATIQUE rédigé « comme un expert PEV » à partir des données de
 * prestation de la page (couvertures Penta/RR, abandons, stratégies de sessions).
 * Génère une appréciation globale + des constats et recommandations priorisés.
 */
function buildPrestationComment(rows: PrestaRow[]): { tone: Tone; lines: { tone: Tone; text: string }[] } {
  const lines: { tone: Tone; text: string }[] = [];
  const seen = rows.filter((r) => [r.fixes, r.avancees, r.mobiles, r.p1, r.p3, r.rr1, r.rr2].some((v) => v != null));
  if (!seen.length) return { tone: "blue", lines };
  const avg = (k: keyof PrestaRow) => {
    const vals = seen.map((r) => r[k]).filter((v): v is number => typeof v === "number");
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  };
  const p1 = avg("p1"), p3 = avg("p3"), rr1 = avg("rr1"), rr2 = avg("rr2");
  const fixes = avg("fixes"), avancees = avg("avancees"), mobiles = avg("mobiles");
  const lvl = (v: number | null): Tone => (v == null ? "blue" : v >= 90 ? "green" : v >= 80 ? "teal" : v >= 50 ? "orange" : "red");
  const word = (v: number | null) => (v == null ? "non documentée" : v >= 90 ? "atteint la cible (≥ 90 %)" : v >= 80 ? "proche de la cible (80–90 %)" : v >= 50 ? "insuffisant (50–80 %)" : "critique (< 50 %)");

  // Complétude vaccinale (Penta3 = indicateur traceur).
  if (p3 != null) lines.push({ tone: lvl(p3), text: `Complétude vaccinale (Penta3) : ${p3} % des aires de santé ≥ 90 % — niveau ${word(p3)}.` });
  // Abandon Penta1 → Penta3.
  if (p1 != null && p3 != null) {
    const d = p1 - p3;
    if (d >= 10) lines.push({ tone: "red", text: `Taux d'abandon Penta1–Penta3 élevé (${d} points) : des enfants commencent mais ne complètent pas la vaccination — renforcer le suivi des perdus de vue et les rappels communautaires.` });
    else if (d > 0) lines.push({ tone: "green", text: `Abandon Penta1–Penta3 maîtrisé (${d} points), traduisant une bonne rétention des enfants dans le calendrier vaccinal.` });
  }
  // Deuxième dose rougeole-rubéole (RR2) et abandon RR1 → RR2.
  if (rr2 != null) lines.push({ tone: lvl(rr2), text: `Couverture RR2 (2ᵉ dose rougeole-rubéole) ${word(rr2)}${rr2 < 80 ? " — antigène à prioriser dans les stratégies de rattrapage." : "."}` });
  if (rr1 != null && rr2 != null && rr1 - rr2 >= 10) lines.push({ tone: "orange", text: `Abandon RR1–RR2 marqué (${rr1 - rr2} points) : organiser des sessions de rattrapage pour la deuxième dose.` });
  // Stratégies de prestation (fixes / avancées / mobiles).
  const weakStrat = [["sessions fixes", fixes], ["stratégies avancées", avancees], ["sessions mobiles", mobiles]].filter(([, v]) => v != null && (v as number) < 80) as [string, number][];
  if (weakStrat.length) lines.push({ tone: "orange", text: `Réalisation des ${weakStrat.map(([l, v]) => `${l} (${v} %)`).join(", ")} en deçà de 80 % : revoir la micro-planification et la disponibilité des intrants/personnel pour atteindre les populations difficiles d'accès.` });
  else if (fixes != null || avancees != null || mobiles != null) lines.push({ tone: "green", text: `Les stratégies de vaccination (fixes, avancées, mobiles) sont globalement réalisées au-delà du seuil de 80 %.` });

  // Appréciation globale (moyenne des couvertures disponibles).
  const cov = [p1, p3, rr1, rr2].filter((v): v is number => v != null);
  const global = cov.length ? Math.round(cov.reduce((a, b) => a + b, 0) / cov.length) : null;
  const tone = lvl(global);
  if (global != null) {
    const reco = global >= 90 ? "Maintenir la performance et documenter les bonnes pratiques pour les autres antennes."
      : global >= 80 ? "Consolider les acquis et cibler les aires de santé encore en dessous du seuil."
      : "Élaborer un plan de rattrapage priorisant les antigènes et les aires de santé les plus faibles, avec appui rapproché des AT.";
    lines.unshift({ tone, text: `Appréciation globale : performance moyenne des couvertures de ${global} % (Penta1·3 · RR1·2). ${reco}` });
  }
  return { tone, lines };
}

/** Carte de commentaire automatique « expert PEV » sur la prestation de services. */
function PrestationExpert({ rows }: { rows: PrestaRow[] }) {
  const { tone, lines } = buildPrestationComment(rows);
  if (!lines.length) return null;
  return (
    <div className="card card-pad">
      <CardTitle icon="comment" tone={tone} title="Commentaire automatique — analyse d'expert PEV"
        sub="Lecture générée à partir des couvertures, des abandons et des stratégies de sessions de cette page" />
      <ul className="space-y-2 pt-1">
        {lines.map((l, i) => (
          <li key={i} className="flex items-start gap-2 rounded-lg border px-3 py-2 text-[12.5px] font-semibold leading-snug"
            style={{ background: TONES[l.tone].bg, borderColor: TONES[l.tone].border, color: TONES[l.tone].text }}>
            <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: TONES[l.tone].ico }} />
            <span>{l.text}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 text-[10.5px] text-surface-400">Synthèse automatique à visée d'aide à la décision — à interpréter avec le contexte local et la complétude des rapportages.</div>
    </div>
  );
}

/* ===================== 5. Prestation de services ===================== */
export function RapPrestation() {
  const { data } = useRapportAt();
  // Visuels (séances planifiées/réalisées + couvertures) alimentés par le DHIS2
  // (repo snis-vaccination-api) pour les antennes de Boende et Bokungu ; les
  // commentaires libres restent issus du formulaire Kobo des AT.
  const { data: dh } = useDhis2Prestation();
  if (!data) return <Empty msg="Synchronisation…" />;
  const p = data.prestation;
  const months = dh?.months ?? [];
  const sessions = dh?.sessions ?? [];
  const couvertures = dh?.couvertures ?? { cats: [], series: [] };
  const detail = dh?.detail ?? { moisLabel: null, rows: [] };
  const couvHasData = couvertures.series.some((s) => s.data.some((v) => v != null));
  return (
    <div className="space-y-4">
      <RefreshBar />
      {!data.meta.hasData && <Pending />}
      <Banner icon="chart" tone="green" title="Rapport mensuel AT — Prestation de services"
        sub="Sessions de vaccination (fixes · avancées · mobiles) et couvertures vaccinales — données DHIS2/SNIS (antennes Boende · Bokungu)" />

      <section>
        <SectionBar icon="up">Réalisation des sessions de vaccination (% des AS ≥ 80 %) — situation 2026</SectionBar>
        <div className="space-y-3">
          {sessions.map((s2) => (
            <AntenneLines key={s2.key} months={months} series={s2.series} ensemble={s2.ensemble}
              title={`${s2.label}, par mois et par antenne (2026)`} icon="up" tone="blue" />
          ))}
        </div>
      </section>

      <div className="card card-pad">
        <CardTitle icon="chart" tone="navy" title="% des aires de santé avec couverture vaccinale ≥ 90 %"
          sub={`Quatre antigènes (Penta1 · Penta3 · RR1 · RR2), par antenne${detail.moisLabel ? ` — ${detail.moisLabel}` : ""}`} />
        {couvHasData ? (
          <ProtoGroupedBar height={280} unit="%" max={100} rotateLabels
            colors={["#00205c", "#0d9488", "#0093d5", "#7c3aed"]}
            cats={couvertures.cats}
            series={couvertures.series.map((s2) => ({ name: s2.name, data: s2.data.map((v) => v ?? 0) }))} />
        ) : <Empty />}
      </div>

      <div className="card card-pad">
        <CardTitle icon="table" tone="navy" title={`Détail par antenne — ${detail.moisLabel ?? "mois en cours"}`}
          right={<TableExportButtons filename="Prestation de services — détail par antenne" />} />
        {detail.rows.length ? (
          <div className="overflow-x-auto"><table className="dtable">
            <thead><tr><th className="name">Antenne</th><th>Sessions fixes (%)</th><th>Stratégies avancées (%)</th><th>Sessions mobiles (%)</th><th>AS avec Penta1 ≥ 90%</th><th>AS avec Penta3 ≥ 90%</th><th>AS avec RR1 ≥ 90%</th><th>AS avec RR2 ≥ 90%</th></tr></thead>
            <tbody>{detail.rows.map((row) => (
              <tr key={row.antenne}>
                <td className="name">{row.antenne}</td>
                <CvCell v={row.fixes} />
                <CvCell v={row.avancees} />
                <CvCell v={row.mobiles} />
                <CvCell v={row.p1} />
                <CvCell v={row.p3} />
                <CvCell v={row.rr1} />
                <CvCell v={row.rr2} />
              </tr>
            ))}</tbody>
          </table></div>
        ) : <Empty />}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[10.5px] font-bold text-surface-600">
          <span className="font-extrabold uppercase tracking-wide text-surface-500">Légende :</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-6 rounded-sm" style={{ background: "#e8313b" }} />&lt; 50 %</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-6 rounded-sm" style={{ background: "#f5b50a" }} />50–80 %</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-6 rounded-sm" style={{ background: "#a9e3a0" }} />80–90 %</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-6 rounded-sm" style={{ background: "#22a44a" }} />&gt; 90 %</span>
        </div>
      </div>

      <PrestationExpert rows={detail.rows} />

      <NarrativeCard icon="message" tone="green" title="Commentaires sur la prestation de service"
        sub="Saisis par les AT dans le rapport mensuel" items={p.commentaires}
        emptyMsg="Aucun commentaire de prestation saisi sur la période filtrée." />
    </div>
  );
}

/* ===================== 6. FFOM & recommandations ===================== */
export function RapFfom() {
  const { data } = useRapportAt();
  if (!data) return <Empty msg="Synchronisation…" />;
  const f = data.ffom;
  return (
    <div className="space-y-4">
      <RefreshBar />
      {!data.meta.hasData && <Pending />}
      <Banner icon="message" tone="violet" title="Rapport mensuel AT — FFOM, difficultés & innovations"
        sub="Forces · Faiblesses · Innovations & bonnes pratiques · Difficultés — puis recommandations, appuis attendus et perspectives" />

      <section>
        <SectionBar icon="component">FFOM — Difficultés & innovations</SectionBar>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <NarrativeCard icon="check" tone="green" title="Forces" items={f.forces} emptyMsg="Aucun point fort saisi sur la période filtrée." />
          <NarrativeCard icon="up" tone="blue" title="Innovations & bonnes pratiques" items={f.innovations} emptyMsg="Aucune innovation saisie sur la période filtrée." />
          <NarrativeCard icon="down" tone="orange" title="Faiblesses" items={f.faiblesses} emptyMsg="Aucun point faible saisi sur la période filtrée." />
          <NarrativeCard icon="erreurs" tone="red" title="Difficultés" items={f.difficultes} emptyMsg="Aucune difficulté saisie sur la période filtrée." />
        </div>
      </section>

      <section>
        <SectionBar icon="reco">Recommandations · appuis attendus · perspectives</SectionBar>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <NarrativeCard icon="reco" tone="teal" title="Recommandations" items={f.recommandations} emptyMsg="Aucune recommandation saisie sur la période filtrée." />
          <NarrativeCard icon="link" tone="navy" title="Appuis attendus du Bureau Pays OMS" items={f.appuisAttendus} emptyMsg="Aucun appui attendu saisi sur la période filtrée." />
          <NarrativeCard icon="route" tone="violet" title="Perspectives" items={f.perspectives} emptyMsg="Aucune perspective saisie sur la période filtrée." />
        </div>
      </section>
    </div>
  );
}

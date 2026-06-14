"use client";

/* Onglet « Évaluation des consultants (AT) ». 5 pages alimentées en TEMPS RÉEL
   via /api/at (hook useEvaluationAt). Score selon la grille officielle
   (8 composantes /100, score ajusté = obtenu ÷ applicable × 100, 5 niveaux).
   La logique de notation est isolée dans lib/at/analytics.ts → computeAtScore. */
import { useEvaluationAt } from "@/lib/client/at-api";
import type { EvaluationBundle } from "@/lib/at/types";
import { SectionBar } from "@/components/ui/Card";
import { KpiTile, CardTitle, Banner, C } from "@/components/proto/proto";
import { ProtoScoreBar, ProtoGauge, ProtoMultiLine, ProtoStackComp, ProtoRadarMax } from "@/components/proto/charts-ext";
import Donut from "@/components/charts/Donut";
import { DIcon } from "@/components/dashboard/icons";
import { RefreshBar } from "./RapportAt";
import { TableExportButtons } from "@/components/ui/TableExport";

const num = (v: number | null | undefined) => (v == null ? "—" : `${v}`);
const pctTxt = (v: number | null | undefined) => (v == null ? "—" : `${v}%`);

function Empty({ msg = "En attente de données." }: { msg?: string }) {
  return <div className="py-10 text-center text-[12px] font-semibold text-surface-500">{msg}</div>;
}
function Pending() {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-[12.5px] font-semibold" style={{ background: "#fdecec", borderColor: "#f6c4c4", color: "#c81e1e" }}>
      <DIcon name="eval" style={{ width: 17, height: 17 }} />
      Aucune évaluation disponible pour l'instant — la grille de cotation s'applique automatiquement dès les premiers rapports mensuels soumis.
    </div>
  );
}

function niveauDef(data: EvaluationBundle, key: string | null) {
  return data.niveaux.find((n) => n.key === key) ?? null;
}
function NiveauBadge({ data, niveau }: { data: EvaluationBundle; niveau: string | null }) {
  const d = niveauDef(data, niveau);
  if (!d) return <span className="text-surface-400">—</span>;
  return <span className="inline-block rounded-full px-2.5 py-[3px] text-[11px] font-extrabold text-white" style={{ background: d.color }}>{d.label}</span>;
}
function DecisionBadge({ data, niveau }: { data: EvaluationBundle; niveau: string | null }) {
  const d = niveauDef(data, niveau);
  if (!d) return <span className="text-surface-400">—</span>;
  return <span className="inline-block rounded-full px-2.5 py-[3px] text-[11px] font-bold" style={{ background: `${d.color}1e`, color: d.color }}>{d.decision}</span>;
}
function Legend({ data }: { data: EvaluationBundle }) {
  return (
    <div className="card card-pad">
      <CardTitle icon="legend" tone="navy" title="Lecture des niveaux de performance" />
      <div className="flex flex-wrap gap-3">
        {data.niveaux.map((n) => (
          <span key={n.key} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-surface-700">
            <span className="h-3 w-3 rounded-sm" style={{ background: n.color }} /> {n.label} {n.key === "insuffisant" ? "< 60" : `${n.min} – ${n.max}`}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ===================== 1. Vue d'ensemble ===================== */
export function EvalVue() {
  const { data } = useEvaluationAt();
  if (!data) return <Empty msg="Synchronisation…" />;
  const k = data.vue.kpi;
  const classement = data.vue.classement.filter((c) => c.ajuste != null);
  return (
    <div className="space-y-4">
      <RefreshBar />
      {!data.meta.hasData && <Pending />}
      <Banner icon="eval" tone="navy" title="Évaluation des AT — Vue d'ensemble" sub="Score selon la grille officielle (8 composantes · 100 pts) · score ajusté = obtenu ÷ applicable × 100" />
      <section>
        <SectionBar icon="bars">Indicateurs clés</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="up" tone="navy" label="Score moyen" value={pctTxt(k.scoreMoyen)} sub="moyenne des scores ajustés" />
          <KpiTile icon="rank" tone="green" label="Meilleur score" value={pctTxt(k.meilleur)} sub="score le plus élevé" />
          <KpiTile icon="down" tone="red" label="Score faible" value={pctTxt(k.faible)} sub="score le plus bas" />
          <KpiTile icon="eval" tone="blue" label="AT évalués" value={k.atsEvalues} sub="données disponibles" />
        </div>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card card-pad">
          <CardTitle icon="gauge" tone="navy" title="Performance globale moyenne" sub="niveau moyen de performance des AT" />
          {k.scoreMoyen != null ? <ProtoGauge value={k.scoreMoyen} /> : <Empty />}
        </div>
        <div className="card card-pad">
          <CardTitle icon="cotation" tone="violet" title="Répartition des AT par niveau de performance" />
          {data.vue.repartition.some((r) => r.count > 0) ? (
            <Donut height={240} data={data.vue.repartition.map((r) => { const d = niveauDef(data, r.niveau)!; return { name: `${d.label} — ${r.count} AT`, value: r.count, color: d.color }; })} />
          ) : <Empty />}
        </div>
      </div>
      <div className="card card-pad">
        <CardTitle icon="rank" tone="navy" title="Classement des AT du meilleur au plus faible" sub="score moyen ajusté (%)" />
        {classement.length ? <ProtoScoreBar horiz height={Math.max(200, classement.length * 34)} unit="%" max={100} cats={classement.map((c) => c.at)} vals={classement.map((c) => c.ajuste ?? 0)} /> : <Empty />}
      </div>
    </div>
  );
}

/* ===================== 2. Classement mensuel ===================== */
export function EvalClassement() {
  const { data } = useEvaluationAt();
  if (!data) return <Empty msg="Synchronisation…" />;
  const rows = data.rows;
  const best = rows[0]; const worst = rows[rows.length - 1];
  return (
    <div className="space-y-4">
      <RefreshBar />
      {!data.meta.hasData && <Pending />}
      <Banner icon="rank" tone="navy" title="Classement mensuel des AT" sub="Score ajusté = score obtenu ÷ score applicable × 100 (composante NA exclue du dénominateur)" />
      <section>
        <SectionBar icon="bars">Indicateurs clés</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="rank" tone="green" label="Meilleur AT" value={best?.at ?? "—"} sub={best?.antenne ?? ""} />
          <KpiTile icon="up" tone="navy" label="Score le plus élevé" value={num(best?.ajuste)} sub="score ajusté /100" />
          <KpiTile icon="eval" tone="orange" label="AT à accompagner" value={worst?.at ?? "—"} sub="plan correctif" />
          <KpiTile icon="down" tone="red" label="Score le plus faible" value={num(worst?.ajuste)} sub="score ajusté /100" />
        </div>
      </section>
      <div className="card card-pad">
        <CardTitle icon="table" tone="navy" title="Classement des Assistants Techniques" sub="score ajusté et décision" right={<TableExportButtons filename="Classement des Assistants Techniques" />} />
        {rows.length ? (
          <div className="overflow-x-auto"><table className="dtable">
            <thead><tr><th>Rang</th><th className="name">AT</th><th>Antenne</th><th>Mois</th><th>Score obtenu</th><th>Score applicable</th><th>Score ajusté /100</th><th>Niveau</th><th>Décision</th></tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={`${r.at}-${r.month}`}><td>{i + 1}</td><td className="name">{r.at}</td><td>{r.antenne ?? "—"}</td><td>{r.monthLabel}</td><td>{r.obtenu}</td><td>{r.applicable}</td>
                <td style={{ fontWeight: 800 }}>{r.ajuste == null ? "—" : r.ajuste.toFixed(1)}</td>
                <td><NiveauBadge data={data} niveau={r.niveau} /></td><td><DecisionBadge data={data} niveau={r.niveau} /></td></tr>
            ))}</tbody>
          </table></div>
        ) : <Empty />}
      </div>
      <Legend data={data} />
    </div>
  );
}

/* ===================== 3. Performance par composante ===================== */
export function EvalComposantes() {
  const { data } = useEvaluationAt();
  if (!data) return <Empty msg="Synchronisation…" />;
  const comps = data.components;
  const parAt = data.parAt.filter((p) => p.ajusteMoyen != null);
  return (
    <div className="space-y-4">
      <RefreshBar />
      {!data.meta.hasData && <Pending />}
      <Banner icon="component" tone="navy" title="Performance par composante" sub="NA : Non applicable — les scores sont calculés uniquement sur les composantes applicables" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card card-pad">
          <CardTitle icon="chart" tone="navy" title="Contribution de chaque composante au score total" sub="points par composante et par AT" />
          {parAt.length ? <ProtoStackComp height={Math.max(240, parAt.length * 60)} max={105} cats={parAt.map((p) => p.at)}
            series={comps.map((cd) => ({ name: cd.short, color: cd.color, vals: parAt.map((p) => p.components.find((c) => c.key === cd.key)?.points ?? null) }))} /> : <Empty />}
        </div>
        <div className="card card-pad">
          <CardTitle icon="synthese" tone="blue" title="Profil de performance de chaque AT" sub="points obtenus par domaine" />
          {parAt.length ? <ProtoRadarMax height={300} indicators={comps.map((c) => ({ name: c.short, max: c.max }))}
            series={parAt.slice(0, 4).map((p, i) => ({ name: p.at, color: [C.navy, C.green, C.orange, C.violet][i % 4], vals: comps.map((cd) => p.components.find((c) => c.key === cd.key)?.points ?? 0) }))} /> : <Empty />}
        </div>
      </div>
      <div className="card card-pad">
        <CardTitle icon="table" tone="navy" title="Performance par composante et par AT" sub="identifier rapidement les composantes faibles · NA en gris" right={<TableExportButtons filename="Performance par composante et par AT" />} />
        {parAt.length ? (
          <div className="overflow-x-auto"><table className="dtable">
            <thead><tr><th className="name">AT</th>{comps.map((c) => <th key={c.key}>{c.short}</th>)}<th>Score ajusté</th></tr></thead>
            <tbody>{parAt.map((p) => (
              <tr key={p.at}><td className="name">{p.at}</td>
                {comps.map((cd) => { const c = p.components.find((x) => x.key === cd.key)!; const bg = c.points == null ? "#e5e7eb" : `${C.green}${pctHex(c.pct)}`; return <td key={cd.key} style={{ background: bg }}>{c.points == null ? "NA" : c.points}</td>; })}
                <td style={{ fontWeight: 800 }}>{p.ajusteMoyen == null ? "—" : p.ajusteMoyen.toFixed(1)}</td></tr>
            ))}</tbody>
          </table></div>
        ) : <Empty />}
      </div>
      <div className="card card-pad">
        <CardTitle icon="chart" tone="blue" title="Score moyen par domaine de performance" sub="moyenne des scores (%) par composante" />
        {data.scoreMoyenParComposante.some((c) => c.pctMoyen != null) ? <ProtoScoreBar height={230} unit="%" max={100} cats={comps.map((c) => c.short.replace(/ \/\d+/, ""))} vals={data.scoreMoyenParComposante.map((c) => c.pctMoyen ?? 0)} /> : <Empty />}
      </div>
    </div>
  );
}
function pctHex(pct: number | null): string {
  if (pct == null) return "10";
  const a = Math.round((pct / 100) * 200 + 30);
  return Math.min(255, a).toString(16).padStart(2, "0");
}

/* ===================== 4. Évolution des performances ===================== */
export function EvalEvolution() {
  const { data } = useEvaluationAt();
  if (!data) return <Empty msg="Synchronisation…" />;
  const ev = data.evolution;
  const lastIdx = ev.months.length - 1;
  const variations = ev.series.map((s) => {
    const vals = s.values; const first = vals.find((v) => v != null) ?? null; const last = [...vals].reverse().find((v) => v != null) ?? null;
    return { at: s.at, first, last, delta: first != null && last != null ? Math.round((last - first) * 10) / 10 : null };
  });
  const progressions = variations.filter((v) => v.delta != null).sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));
  const lastMonthVals = ev.series.map((s) => ({ at: s.at, v: s.values[lastIdx] ?? null })).filter((x) => x.v != null);
  const bestLast = [...lastMonthVals].sort((a, b) => (b.v ?? 0) - (a.v ?? 0))[0];
  const worstLast = [...lastMonthVals].sort((a, b) => (a.v ?? 0) - (b.v ?? 0))[0];
  const avgLast = lastMonthVals.length ? Math.round((lastMonthVals.reduce((a, b) => a + (b.v ?? 0), 0) / lastMonthVals.length) * 10) / 10 : null;
  return (
    <div className="space-y-4">
      <RefreshBar />
      {!data.meta.hasData && <Pending />}
      <Banner icon="up" tone="navy" title="Évolution des performances" sub="Suivi mensuel des scores ajustés (%) — repérer progressions, stagnations et contre-performances" />
      <section>
        <SectionBar icon="bars">Lecture rapide</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="up" tone="green" label="Meilleure progression" value={progressions[0]?.at ?? "—"} sub={progressions[0]?.delta != null ? `${progressions[0].delta > 0 ? "+" : ""}${progressions[0].delta} pts` : ""} />
          <KpiTile icon="rank" tone="navy" label={`Meilleur score en ${ev.months[lastIdx]?.label ?? "fin"}`} value={bestLast?.at ?? "—"} sub={pctTxt(bestLast?.v ?? null)} />
          <KpiTile icon="gauge" tone="blue" label={`Performance moyenne (${ev.months[lastIdx]?.label ?? "fin"})`} value={pctTxt(avgLast)} sub="tous les AT" />
          <KpiTile icon="down" tone="red" label="AT à accompagner" value={worstLast?.at ?? "—"} sub={pctTxt(worstLast?.v ?? null)} />
        </div>
      </section>
      <div className="card card-pad">
        <CardTitle icon="chart" tone="navy" title="Évolution mensuelle des scores ajustés (%)" sub={ev.months.length ? `${ev.months[0].label} → ${ev.months[lastIdx].label}` : ""} />
        {ev.months.length && ev.series.length ? <ProtoMultiLine height={300} max={110} cats={ev.months.map((m) => m.label)}
          series={ev.series.map((s, i) => ({ name: s.at, color: ["#1f54b8", "#f59e0b", "#178a44", "#e23636", "#7c3aed", "#0d9488"][i % 6], vals: s.values }))} /> : <Empty />}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card card-pad">
          <CardTitle icon="table" tone="navy" title={`Variation ${ev.months[0]?.label ?? ""} – ${ev.months[lastIdx]?.label ?? ""}`} right={<TableExportButtons filename="Variation des performances" />} />
          {variations.length ? (
            <table className="dtable">
              <thead><tr><th className="name">AT</th><th>{ev.months[0]?.label ?? "Début"}</th><th>{ev.months[lastIdx]?.label ?? "Fin"}</th><th>Évolution</th></tr></thead>
              <tbody>{variations.map((v) => (
                <tr key={v.at}><td className="name">{v.at}</td><td>{num(v.first)}</td><td>{num(v.last)}</td>
                  <td style={{ fontWeight: 800, color: v.delta == null ? "#64748b" : v.delta >= 0 ? "#178a44" : "#c81e1e" }}>{v.delta == null ? "—" : `${v.delta >= 0 ? "+" : ""}${v.delta}`}</td></tr>
              ))}</tbody>
            </table>
          ) : <Empty />}
        </div>
        <div className="card card-pad" style={{ background: "#eaf4fd" }}>
          <CardTitle icon="message" tone="blue" title="Interprétation" />
          <ul className="ml-4 list-disc space-y-1 text-[12.5px] text-surface-700">
            <li><b>Hausse continue :</b> AT dont le score ajusté progresse mois après mois — maintenir l'accompagnement.</li>
            <li><b>Progression modérée :</b> amélioration lente mais constante — cibler les composantes faibles.</li>
            <li><b>Baisse / contre-performance :</b> recul à surveiller — accompagnement rapproché requis.</li>
          </ul>
        </div>
      </div>
      <Legend data={data} />
    </div>
  );
}

/* ===================== 5. Grille de cotation ===================== */
const GRILLE_DETAIL: [string, string, string, string][] = [
  ["A. Réunions (15)", "CCPeV tenue dans le mois", "1 prévue / mois — tenue & appuyée = 100 %", "4"],
  ["A. Réunions (15)", "Réunions de surveillance appuyées", "Appuyées ÷ prévues × 100", "3,5"],
  ["A. Réunions (15)", "Réunions de validation des données", "Appuyées ÷ prévues × 100", "3,5"],
  ["A. Réunions (15)", "Revues mensuelles appuyées", "Appuyées ÷ prévues × 100", "4"],
  ["B. Supervisions (20)", "Antennes supervisées", "Supervisées ÷ prévues × 100", "4"],
  ["B. Supervisions (20)", "Zones de santé supervisées", "ZS supervisées ÷ prévues × 100", "5"],
  ["B. Supervisions (20)", "Aires de santé supervisées", "AS supervisées ÷ prévues × 100", "5"],
  ["B. Supervisions (20)", "Supervisions de bonne qualité", "Formulaires conformes ÷ soumis × 100", "6"],
  ["C. Monitorage (10)", "Monitorages réalisés", "Réalisés ÷ prévus × 100", "10"],
  ["D. Rougeole (15)", "Cas investigués", "Investigués ÷ notifiés × 100", "7"],
  ["D. Rougeole (15)", "Riposte autour des cas", "Ripostes ÷ cas nécessitant riposte × 100", "5"],
  ["D. Rougeole (15)", "Liste linéaire dispo. & à jour", "Oui = 3 · partiel = 1,5 · non = 0", "3"],
  ["E. TNN & MAPI (10)", "Cas TNN investigués", "TNN investigués ÷ TNN notifiés × 100", "4"],
  ["E. TNN & MAPI (10)", "Riposte autour des cas TNN", "Ripostes ÷ cas TNN nécessitant riposte × 100", "3"],
  ["E. TNN & MAPI (10)", "MAPI graves investiguées", "Investiguées ÷ notifiées × 100", "3"],
  ["F. OSP (10)", "OSP partagés", "Partagés ÷ attendus × 100", "10"],
  ["G. Rapport PEV (10)", "Rapport trimestriel transmis", "Transmis ÷ attendu × 100 (suivi mensuel)", "10"],
  ["H. Rapport OMS (10)", "Activités OMS justifiées", "Activités justifiées ÷ financées × 100", "6"],
  ["H. Rapport OMS (10)", "Justificatifs transmis", "Transmis dans le délai attendu", "4"],
  ["Total général", "", "", "100"],
];
const CONFORMITE = [
  "Toutes les sections obligatoires sont remplies",
  "Les réponses « Non » / « Partiellement » sont commentées",
  "Les réponses « Non applicable » sont justifiées",
  "Les constats sont cohérents avec les réponses",
  "Les recommandations sont SMART",
  "Les actions correctrices sont réalistes",
  "Les données rapportées sont cohérentes",
];
const COMPOSANTE_NAME: Record<string, string> = {
  reunions: "A. Tenue & appui aux réunions", supervisions: "B. Supervisions", monitorage: "C. Monitorage de convenance",
  rougeole: "D. Surveillance rougeole", tnn_mapi: "E. Surveillance TNN & MAPI graves", osp: "F. OSP & activités spéciales",
  rapport_pev: "G. Rapports trimestriels antenne PEV", rapport_oms: "H. Rapports OMS & justification financière",
};

export function EvalGrille() {
  const { data } = useEvaluationAt();
  if (!data) return <Empty msg="Synchronisation…" />;
  const comps = data.components;
  const parAt = data.parAt;
  return (
    <div className="space-y-4">
      <RefreshBar />
      <Banner icon="cotation" tone="navy" title="Grille officielle de cotation des AT" sub="Points attribués au prorata du % obtenu · total 100 points sur 8 composantes" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card card-pad">
          <CardTitle icon="cotation" tone="navy" title="Pondération par composante" right={<TableExportButtons filename="Pondération par composante" />} />
          <table className="dtable">
            <thead><tr><th className="name">Composante</th><th>Pondération</th></tr></thead>
            <tbody>
              {comps.map((c) => <tr key={c.key}><td className="name">{COMPOSANTE_NAME[c.key]}</td><td>{c.max} pts</td></tr>)}
              <tr><td className="name"><b>Total général</b></td><td><b>100 pts</b></td></tr>
            </tbody>
          </table>
        </div>
        <div className="card card-pad">
          <CardTitle icon="rank" tone="red" title="Classification de la performance" right={<TableExportButtons filename="Classification de la performance" />} />
          <table className="dtable">
            <thead><tr><th className="name">Score ajusté</th><th>Niveau</th><th>Décision</th></tr></thead>
            <tbody>{data.niveaux.map((n) => (
              <tr key={n.key}><td className="name">{n.key === "insuffisant" ? "< 60" : `${n.min} – ${n.max}`}</td>
                <td><span className="inline-block rounded-full px-2.5 py-[2px] text-[11px] font-extrabold text-white" style={{ background: n.color }}>{n.label}</span></td>
                <td>{n.decision}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      <div className="card card-pad">
        <CardTitle icon="table" tone="navy" title="Grille détaillée de cotation — critères & mode de calcul" right={<TableExportButtons filename="Grille détaillée de cotation — critères & mode de calcul" />} />
        <div className="overflow-x-auto"><table className="dtable">
          <thead><tr><th className="name">Composante</th><th>Critère</th><th>Mode de calcul</th><th>Points</th></tr></thead>
          <tbody>{GRILLE_DETAIL.map((r, i) => (
            <tr key={i} style={r[0] === "Total général" ? { fontWeight: 800 } : undefined}><td className="name">{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td></tr>
          ))}</tbody>
        </table></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="card card-pad lg:col-span-7">
          <CardTitle icon="table" tone="navy" title="Matrice de conformité par composante et par AT" sub="« Bien » ≥ 70 % des points · « Mal » < 70 % · « NA » non applicable" right={<TableExportButtons filename="Matrice de conformité par composante et par AT" />} />
          {parAt.length ? (
            <div className="overflow-x-auto"><table className="dtable">
              <thead><tr><th className="name">AT</th>{comps.map((c) => <th key={c.key}>{c.short.replace(/ \/\d+/, "")}</th>)}</tr></thead>
              <tbody>{parAt.map((p) => (
                <tr key={p.at}><td className="name">{p.at}</td>
                  {comps.map((cd) => { const c = p.components.find((x) => x.key === cd.key)!; const ok = c.pct != null && c.pct >= 70; const na = c.points == null;
                    return <td key={cd.key} style={{ background: na ? "#e5e7eb" : ok ? "#e6f6ec" : "#fde2e2", fontWeight: 700, color: na ? "#6b7280" : ok ? "#178a44" : "#c81e1e" }}>{na ? "NA" : ok ? "Bien" : "Mal"}</td>; })}</tr>
              ))}</tbody>
            </table></div>
          ) : <Empty />}
        </div>
        <div className="card card-pad lg:col-span-5">
          <CardTitle icon="form" tone="blue" title="Critères de qualité d'un formulaire de supervision" sub="conditionne la composante « Supervisions de bonne qualité »" />
          <ul className="ml-4 list-disc space-y-1 text-[12px] text-surface-700">{CONFORMITE.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </div>
      </div>
    </div>
  );
}

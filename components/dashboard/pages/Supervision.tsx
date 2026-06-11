"use client";

/* Onglet « Supervision conjointe » — 3 pages à niveau d'org unit DYNAMIQUE
   (cf. specs feedback TL 03/04/05) :
     · Résultats de supervision   — KPI, réponses, évolutions ;
     · Score de conformité        — note de scorage + sections à un visuel ;
     · Constats & recommandations — synthèse des champs texte de la checklist.
   Le niveau affiché découle des filtres : défaut = Antennes ; antenne filtrée →
   Zones de santé ; ZS filtrée → Aires de santé ; AS filtrée → détail de l'AS.
   Données LIVE via /api/supervision. Charte et composants existants. */
import { DataGate } from "@/components/ui/DataGate";
import { SectionBar } from "@/components/ui/Card";
import { KpiTile, CardTitle, Banner, HlCard, TONES, Badge } from "@/components/proto/proto";
import StackedAnswers from "@/components/charts/StackedAnswers";
import HBar from "@/components/charts/HBar";
import LineTrend from "@/components/charts/LineTrend";
import Radar from "@/components/charts/Radar";
import { TableExportButtons } from "@/components/ui/TableExport";
import { fmtPct, fmtMonth } from "@/lib/client/format";
import { useTabFilters, orgLevelOf, ORG_LABEL, type OrgLevel } from "@/lib/state/filters";
import {
  cotationFor, COTATION_COLOR, conformiteFor, CONFORMITE_CLASSES,
  type StructureLevel, type AnswerValue,
} from "@/config/supervision.config";
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

const LEVEL_META: Record<OrgLevel, { icon: "tower" | "hospital" | "clinic"; tone: "navy" | "violet" | "green"; kpiBlock: "antennes_total" | "zs_total" | "as_total" }> = {
  antenne: { icon: "tower", tone: "navy", kpiBlock: "antennes_total" },
  zs: { icon: "hospital", tone: "violet", kpiBlock: "zs_total" },
  as: { icon: "clinic", tone: "green", kpiBlock: "as_total" },
};

/** Niveau d'org unit courant + libellés + bundle correspondant. */
function useOrgLevel() {
  const f = useTabFilters("supervision");
  const lvl = orgLevelOf(f);
  return { lvl, labels: ORG_LABEL[lvl], meta: LEVEL_META[lvl], aire: f.aire };
}

/* ============== Tableau « OUI par mois et par composante » ============== */

function MonthTable({ b, months, showAvg }: { b: LevelBundle; months: string[]; showAvg: boolean }) {
  if (!months.length || !b.composantesMonthly.length) return <div className="py-8 text-center text-[12px] text-surface-500">Pas de données mensuelles.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="dtable">
        <thead><tr><th className="name">Composante</th>{months.map((m) => <th key={m}>{fmtMonth(m)}</th>)}{showAvg ? <th>Moyenne</th> : null}</tr></thead>
        <tbody>
          {b.composantesMonthly.map((c) => {
            const present = months.map((m) => c.scores[m]).filter((n): n is number => n !== null);
            const avg = present.length ? Math.round(present.reduce((a, x) => a + x, 0) / present.length) : null;
            return (
              <tr key={c.key}>
                <td className="name">{c.short}</td>
                {months.map((m) => { const v = c.scores[m]; return <td key={m} style={v !== null ? { background: `${COTATION_COLOR[cotationFor(v)]}1f` } : undefined}>{v === null ? "—" : `${v}%`}</td>; })}
                {showAvg ? <td className="font-semibold" style={avg !== null ? { background: `${COTATION_COLOR[cotationFor(avg)]}33` } : undefined}>{avg === null ? "—" : `${avg}%`}</td> : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ====== Tableau « Évolution de la proportion des oui par org unit » ====== */

function OuiMatrixTable({ b, months, label }: { b: LevelBundle; months: string[]; label: string }) {
  if (!months.length || !b.ouiMonthlyMatrix.length) return <div className="py-8 text-center text-[12px] text-surface-500">Pas de données mensuelles.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="dtable">
        <thead><tr><th className="name">{label}</th>{months.map((m) => <th key={m}>{fmtMonth(m)}</th>)}</tr></thead>
        <tbody>
          {b.ouiMonthlyMatrix.map((r) => (
            <tr key={r.name}>
              <td className="name">{r.name}</td>
              {months.map((m) => { const v = r.scores[m]; return <td key={m} style={v !== null ? { background: `${COTATION_COLOR[cotationFor(v)]}1f` } : undefined}>{v === null ? "—" : `${v}%`}</td>; })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ===================== Page 1 — Résultats de supervision ===================== */

export function SupervisionResultats() {
  const { lvl, labels, meta } = useOrgLevel();
  return (
    <DataGate>
      {(d: SupervisionBundle) => {
        const b = d.levels[lvl as StructureLevel];
        const t = totals(b);
        const block = d.kpi[meta.kpiBlock];
        const months = d.meta.months;
        const nStruct = b.perStructure.length;
        const qParStructure = nStruct ? Math.round(t.all / nStruct) : null;
        // Au niveau antenne, le % de réalisation suit la cible TRIMESTRIELLE
        // (2 antennes / trimestre) ; aux niveaux ZS/AS, cibles existantes.
        const pctRealisation = lvl === "antenne" ? d.kpi.antennes_trimestre.pct : block.pct;
        return (
          <div className="space-y-4">
            <Banner icon={meta.icon} tone={meta.tone} title={`Supervision conjointe — ${labels.plur}`}
              sub={<>Réalisation, qualité et scores au niveau {labels.plur.toLowerCase()} · {b.records} supervision{b.records > 1 ? "s" : ""}{lvl === "antenne" ? " · cible : 2 antennes / trimestre" : ""}</>} />

            <section>
              <SectionBar icon="bars">Indicateurs clés</SectionBar>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <KpiTile icon={meta.icon} tone={meta.tone} label={`${labels.plur} supervisées`} value={block.count} pct={pctRealisation ?? undefined} />
                <KpiTile icon="clip" tone="navy" label="Total questions administrées" value={t.all} sub={qParStructure !== null ? `Questions par structure : <b>${qParStructure}</b>` : "—"} />
                <KpiTile icon="check" tone="green" label={`Total réponses « Oui » — par ${labels.sing.toLowerCase()}`} value={t.oui} sub={`Proportion : <b>${propTxt(t.oui, t.all)}</b>`} />
                <KpiTile icon="component" tone="orange" label={`Total réponses « Partiellement » — par ${labels.sing.toLowerCase()}`} value={t.partiel} sub={`Proportion : <b>${propTxt(t.partiel, t.all)}</b>`} />
                <KpiTile icon="down" tone="red" label={`Total réponses « Non » — par ${labels.sing.toLowerCase()}`} value={t.non} sub={`Proportion : <b>${propTxt(t.non, t.all)}</b>`} />
                <KpiTile icon="legend" tone="blue" label={`Total réponses « Non applicable » — par ${labels.sing.toLowerCase()}`} value={t.na} sub={`Proportion : <b>${propTxt(t.na, t.all)}</b>`} />
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="card card-pad lg:col-span-7">
                <CardTitle icon="component" tone={meta.tone} title="Proportion des réponses Oui, Non, Partiellement et Non applicable par composante"
                  sub="Ce graphique montre la proportion des réponses Oui, Partiel, Non et N/A par composante, calculée sur l'ensemble des réponses enregistrées pour chaque composante." />
                {b.composanteAnswers.length ? <StackedAnswers exportTitle="Proportion des réponses par composante" rows={b.composanteAnswers.map((c) => ({ name: c.short, answers: c.answers }))} /> : <div className="py-8 text-center text-[12px] text-surface-500">Aucune donnée.</div>}
              </div>
              <div className="card card-pad lg:col-span-5">
                <CardTitle icon="down" tone="red" title="Top 10 des questions à forte proportion de « Non »" sub="Survolez une barre pour lire la question" />
                {b.topNon.length ? <HBar exportTitle="Top 10 des questions à forte proportion de Non" colorByCotation={false} data={b.topNon.map((i) => ({ name: i.question, value: i.pct }))} height={Math.max(140, b.topNon.length * 30 + 30)} /> : <div className="py-8 text-center text-[12px] text-surface-500">Aucune question exploitable.</div>}
              </div>
            </div>

            <section>
              <SectionBar icon="time" right={<TableExportButtons variant="bar" filename="Proportion des réponses OUI par mois et par composante" />}>
                Proportion des réponses OUI par mois et par composante
              </SectionBar>
              <div className="card card-pad">
                <div className="mb-2 text-[11.5px] text-surface-500">
                  Ce tableau suit l'évolution mensuelle de la proportion des réponses « Oui » par composante.{lvl === "antenne" ? " La moyenne permet d'apprécier la performance globale de chaque composante sur la période analysée." : ""}
                </div>
                <MonthTable b={b} months={months} showAvg={lvl === "antenne"} />
              </div>
            </section>

            <section>
              <SectionBar icon="time" right={<TableExportButtons variant="bar" filename={`Évolution de la proportion des réponses oui par ${labels.sing.toLowerCase()} et par mois`} />}>
                Évolution de la proportion des réponses « oui » par {labels.sing.toLowerCase()} et par mois
              </SectionBar>
              <div className="card card-pad"><OuiMatrixTable b={b} months={months} label={labels.sing} /></div>
            </section>

          </div>
        );
      }}
    </DataGate>
  );
}

/* ===================== Page 2 — Score de conformité ===================== */

/** Note explicative — Système de scorage (recréée en HTML, cf. feedback TL p.5-6). */
function NoteScorage() {
  const bareme = [
    { rep: "Oui", tone: "green" as const, score: "1, 2 ou 3 points selon la composante", interp: "Le standard attendu est respecté ou l'élément vérifié est disponible, fonctionnel et correctement appliqué." },
    { rep: "Partielle", tone: "orange" as const, score: "La moitié du score prévu pour la question, selon la composante", interp: "Le standard est partiellement respecté ; certains éléments sont en place, mais des insuffisances nécessitent des améliorations." },
    { rep: "Non", tone: "red" as const, score: "0 point pour toutes les composantes", interp: "Le standard attendu n'est pas respecté ou l'élément vérifié est absent, non fonctionnel ou non appliqué." },
    { rep: "Non applicable", tone: "blue" as const, score: "Exclu du calcul", interp: "La question ne s'applique pas au contexte évalué ; elle est exclue du calcul du score de conformité." },
  ];
  return (
    <section>
      <SectionBar icon="legend">Note explicative — Système de scorage</SectionBar>
      <details className="card card-pad" open>
        <summary className="cursor-pointer select-none text-[12.5px] font-bold text-navy-700">
          Mesure de la conformité aux standards du PEV — barème, pondération, formule et interprétation
        </summary>
        <div className="mt-3 space-y-3">
          <div className="rounded-xl px-4 py-3 text-[12.5px] leading-relaxed text-surface-800" style={{ background: "#eaf4fd", borderLeft: "4px solid #0093d5" }}>
            Le score mesure le niveau de conformité des pratiques professionnelles aux standards du PEV, à partir des réponses
            renseignées dans la checklist de supervision. Il ne s'agit pas d'une évaluation directe de la performance, mais d'une
            mesure du respect des normes, directives, procédures et bonnes pratiques attendues dans la mise en œuvre des activités du PEV.
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div>
              <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-navy-700">1. Barème de cotation des réponses</div>
              <table className="dtable">
                <thead><tr><th className="name">Réponses</th><th className="name">Score</th><th className="name">Interprétation</th></tr></thead>
                <tbody>
                  {bareme.map((r) => (
                    <tr key={r.rep}>
                      <td className="name" style={{ color: TONES[r.tone].text, fontWeight: 800 }}>{r.rep}</td>
                      <td className="name" style={{ fontWeight: 600 }}>{r.score}</td>
                      <td className="name" style={{ whiteSpace: "normal" }}>{r.interp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-navy-700">2. Pondération selon la composante</div>
                <div className="rounded-xl border border-surface-200 bg-[#f6f8fb] px-4 py-3 text-[12px] leading-relaxed text-surface-700">
                  Le score attribué à une réponse « Oui » varie selon la composante, afin d'équilibrer le score global entre les
                  composantes qui ne comportent pas le même nombre de questions. Par exemple, pour la composante <b>Planification et
                  gestion de ressources</b> (environ 30 questions), chaque réponse « Oui » correspond à <b>1 point</b>, tandis que pour la
                  composante <b>Prestation de services</b> (environ 10 questions), chaque réponse « Oui » correspond à <b>3 points</b>.
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-navy-700">3. Formule de calcul</div>
                <div className="rounded-xl border border-surface-200 px-4 py-3 text-center text-[13px] font-bold text-navy-700" style={{ background: "#f0fdf6" }}>
                  Score de conformité (%) = score obtenu / score maximum attendu × 100
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-navy-700">4. Interprétation des scores</div>
            <table className="dtable">
              <thead><tr><th>Score de conformité</th><th className="name">Appréciation</th><th className="name">Interprétation</th></tr></thead>
              <tbody>
                {CONFORMITE_CLASSES.map((c) => (
                  <tr key={c.key}>
                    <td style={{ background: `${c.color}26`, color: c.color, fontWeight: 800 }}>
                      {c.min >= 80 ? "≥ 80 %" : c.min >= 60 ? "60 % à 79 %" : c.min >= 40 ? "40 % à 59 %" : "< 40 %"}
                    </td>
                    <td className="name" style={{ color: c.color, fontWeight: 800 }}>{c.label}</td>
                    <td className="name" style={{ whiteSpace: "normal" }}>{c.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </section>
  );
}

/** Cellule heatmap selon les 4 classes d'interprétation du score. */
function ConfCell({ v, strong = false }: { v: number | null; strong?: boolean }) {
  if (v === null) return <td>—</td>;
  const c = conformiteFor(v);
  return <td className={strong ? "font-semibold" : undefined} style={{ background: `${c.color}${strong ? "33" : "1f"}` }}>{v}%</td>;
}

export function SupervisionScore() {
  const { lvl, labels, meta } = useOrgLevel();
  return (
    <DataGate>
      {(d: SupervisionBundle) => {
        const b = d.levels[lvl as StructureLevel];
        const months = d.meta.months;
        const valid = b.perStructure.filter((s) => s.score !== null);
        const sorted = [...valid].sort((a, x) => (x.score ?? 0) - (a.score ?? 0));
        const best = sorted[0] ?? null;
        const worst = sorted.length ? sorted[sorted.length - 1] : null;
        // Évolution mensuelle (score moyen du niveau par mois).
        const trendData = months.map((m) => b.trend.find((t) => t.month === m)?.score ?? null);
        const presentTrend = b.trend.filter((t) => t.score !== null);
        const bestMonth = presentTrend.length ? [...presentTrend].sort((a, x) => (x.score ?? 0) - (a.score ?? 0))[0] : null;
        const worstMonth = presentTrend.length ? [...presentTrend].sort((a, x) => (a.score ?? 0) - (x.score ?? 0))[0] : null;
        const delta = presentTrend.length >= 2 ? (presentTrend[presentTrend.length - 1].score ?? 0) - (presentTrend[0].score ?? 0) : null;
        const tendance = delta === null ? "—" : delta > 1 ? "En progression" : delta < -1 ? "En recul" : "Stable";
        // Composantes.
        const compValid = b.composantes.filter((c) => c.score !== null);
        const compSorted = [...compValid].sort((a, x) => (x.score ?? 0) - (a.score ?? 0));
        const bestComp = compSorted[0] ?? null;
        const worstComp = compSorted.length ? compSorted[compSorted.length - 1] : null;
        const compAvg = compValid.length ? Math.round(compValid.reduce((a, c) => a + (c.score ?? 0), 0) / compValid.length) : null;
        const confColor = (v: number) => conformiteFor(v).color;
        // Cartes « Messages clés » / « Résumé » en vocabulaire de conformité (cf.
        // feedback TL) : « partiellement conforme » = score 60–79 % · « non
        // conforme » = score < 60 % (faible conformité incluse). On retient
        // l'élément au score le plus bas de la classe.
        const partielComp = compValid.filter((c) => c !== bestComp && (c.score ?? 0) >= 60 && (c.score ?? 0) < 80).sort((a, x) => (a.score ?? 0) - (x.score ?? 0))[0] ?? null;
        const nonConfComp = compValid.filter((c) => (c.score ?? 0) < 60).sort((a, x) => (a.score ?? 0) - (x.score ?? 0))[0] ?? null;
        const partielStruct = valid.filter((s) => s !== best && (s.score ?? 0) >= 60 && (s.score ?? 0) < 80).sort((a, x) => (a.score ?? 0) - (x.score ?? 0))[0] ?? null;
        const nonConfStruct = valid.filter((s) => (s.score ?? 0) < 60).sort((a, x) => (a.score ?? 0) - (x.score ?? 0))[0] ?? null;
        return (
          <div className="space-y-4">
            <Banner icon="cotation" tone={meta.tone} title={`Score de conformité — ${labels.plur}`}
              sub={<>Conformité aux standards du PEV · niveau {labels.plur.toLowerCase()} · {b.score.count} supervision{b.score.count > 1 ? "s" : ""} notée{b.score.count > 1 ? "s" : ""}</>} />

            {/* 1. Note explicative — système de scorage */}
            <NoteScorage />

            {/* 2. Scores globaux par niveau (dynamique) */}
            <section>
              <SectionBar icon="bars">Scores globaux — {labels.plur}</SectionBar>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                <div className="lg:col-span-4 flex flex-col gap-3">
                  <KpiTile icon={meta.icon} tone={meta.tone} label={`Score global moyen — ${labels.plur}`} value={fmtPct(b.score.moyen)}
                    sub={`${b.perStructure.length} structure${b.perStructure.length > 1 ? "s" : ""} supervisée${b.perStructure.length > 1 ? "s" : ""}`} />
                  <HlCard icon="trophy" tone="green" label="Points clés — meilleure structure" big={best?.name ?? "—"} sub={`Score : ${fmtPct(best?.score ?? null)}`} />
                  <HlCard icon="alert" tone="red" label="Points clés — structure la plus faible" big={worst?.name ?? "—"} sub={`Score : ${fmtPct(worst?.score ?? null)}`} />
                </div>
                <div className="card card-pad lg:col-span-8">
                  <CardTitle icon="bars" tone={meta.tone} title={`Score global de conformité — ${labels.plur}`} sub="Couleur selon l'interprétation : Conforme · Partiellement conforme · Faible conformité · Non conforme" />
                  {valid.length ? <HBar exportTitle={`Score global de conformité — ${labels.plur}`} colorFor={confColor} data={b.perStructure.map((s) => ({ name: s.name, value: s.score }))} /> : <div className="py-8 text-center text-[12px] text-surface-500">Aucune structure notée.</div>}
                  <div className="mt-2 flex flex-wrap gap-3">
                    {CONFORMITE_CLASSES.map((c) => (
                      <span key={c.key} className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-surface-700">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c.color }} />{c.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="card card-pad mt-3">
                <CardTitle icon="legend" tone="blue" title="Lecture rapide" sub="Synthèse automatique" />
                <ul className="space-y-1.5 pt-1 text-[12.5px] font-semibold text-surface-700">
                  <li>• Score moyen du niveau {labels.plur.toLowerCase()} : <b>{fmtPct(b.score.moyen)}</b> ({b.score.moyen !== null ? conformiteFor(b.score.moyen).label : "—"}).</li>
                  {best ? <li>• Meilleure structure : <b>{best.name}</b> ({fmtPct(best.score)}).</li> : null}
                  {worst && worst !== best ? <li>• Structure la plus faible : <b>{worst.name}</b> ({fmtPct(worst.score)}).</li> : null}
                  <li>• Les scores de conformité s'interprètent séparément à chaque niveau (antennes, zones de santé, aires de santé).</li>
                </ul>
              </div>
            </section>

            {/* 3. Évolution mensuelle (dynamique) */}
            <section>
              <SectionBar icon="time">Évolution mensuelle — {labels.plur}</SectionBar>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <KpiTile icon="trophy" tone="green" label="Meilleur mois" value={bestMonth ? fmtMonth(bestMonth.month) : "—"} sub={bestMonth ? `Score le plus élevé : <b>${fmtPct(bestMonth.score)}</b>` : undefined} />
                <KpiTile icon="down" tone="orange" label="Mois le plus faible" value={worstMonth ? fmtMonth(worstMonth.month) : "—"} sub={worstMonth ? `Score le plus faible : <b>${fmtPct(worstMonth.score)}</b>` : undefined} />
                <KpiTile icon="up" tone="blue" label="Tendance globale" value={tendance} sub={delta !== null ? `${delta >= 0 ? "+" : ""}${Math.round(delta)} pts depuis le premier mois` : undefined} />
              </div>
              <div className="card card-pad mt-3">
                <CardTitle icon="time" tone={meta.tone} title={`Évolution du score global — ${labels.plur}`} sub="Score moyen de conformité du niveau, par mois" />
                {months.length ? <LineTrend exportTitle={`Évolution du score global — ${labels.plur}`} months={months} series={[{ name: `Score moyen — ${labels.plur}`, data: trendData }]} /> : <div className="py-8 text-center text-[12px] text-surface-500">Pas de données mensuelles.</div>}
              </div>
              <div className="card card-pad mt-3">
                <CardTitle icon="table" tone={meta.tone} title={`Évolution du score par mois par ${labels.sing.toLowerCase()}`} sub="Cellules colorées selon les 4 classes d'interprétation"
                  right={<TableExportButtons filename={`Évolution du score par mois par ${labels.sing.toLowerCase()}`} />} />
                {b.monthlyMatrix.length && months.length ? (
                  <div className="overflow-x-auto">
                    <table className="dtable">
                      <thead><tr><th className="name">{labels.sing}</th>{months.map((m) => <th key={m}>{fmtMonth(m)}</th>)}</tr></thead>
                      <tbody>
                        {b.monthlyMatrix.map((r) => (
                          <tr key={r.name}>
                            <td className="name">{r.name}</td>
                            {months.map((m) => <ConfCell key={m} v={r.scores[m]} />)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <div className="py-8 text-center text-[12px] text-surface-500">Pas de données mensuelles.</div>}
              </div>
            </section>

            {/* 4. Score par composante (dynamique) */}
            <section>
              <SectionBar icon="component">Score par composante — {labels.plur}</SectionBar>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <KpiTile icon="check" tone="green" label="Composante la plus forte" value={bestComp?.short ?? "—"} sub={bestComp ? `Score : <b>${fmtPct(bestComp.score)}</b>` : undefined} />
                <KpiTile icon="alert" tone="red" label="Composante la plus faible" value={worstComp?.short ?? "—"} sub={worstComp ? `Score : <b>${fmtPct(worstComp.score)}</b>` : undefined} />
                <KpiTile icon="component" tone="navy" label="Score moyen des composantes" value={compAvg !== null ? `${compAvg}%` : "—"} sub="6 composantes ACD" />
              </div>
              <div className="card card-pad mt-3">
                <CardTitle icon="component" tone={meta.tone} title={`Score de conformité par composante — ${labels.plur}`} sub="Couleur selon l'interprétation 4 classes" />
                {compValid.length ? <HBar exportTitle={`Score de conformité par composante — ${labels.plur}`} colorFor={confColor} data={b.composantes.map((c) => ({ name: c.short, value: c.score }))} /> : <div className="py-8 text-center text-[12px] text-surface-500">Aucune donnée.</div>}
              </div>
            </section>

            {/* 5. Profil radar + suivi mensuel des composantes (dynamique) */}
            <section>
              <SectionBar icon="component">Profil radar et suivi mensuel des composantes — {labels.plur}</SectionBar>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                <div className="card card-pad lg:col-span-5">
                  <CardTitle icon="component" tone={meta.tone} title={`Radar des composantes — ${labels.plur}`} sub="Profil des 6 composantes par structure (8 max)" />
                  {b.radar.entities.length ? <Radar exportTitle={`Radar des composantes — ${labels.plur}`} indicators={b.radar.indicators} entities={b.radar.entities} /> : <div className="py-8 text-center text-[12px] text-surface-500">Aucune donnée.</div>}
                </div>
                <div className="card card-pad lg:col-span-7">
                  <CardTitle icon="table" tone={meta.tone} title="Score de conformité par composante et par mois" sub="Heatmap selon les 4 classes d'interprétation"
                    right={<TableExportButtons filename="Score de conformité par composante et par mois" />} />
                  {months.length && b.composantesMonthly.length ? (
                    <div className="overflow-x-auto">
                      <table className="dtable">
                        <thead><tr><th className="name">Composante</th>{months.map((m) => <th key={m}>{fmtMonth(m)}</th>)}</tr></thead>
                        <tbody>
                          {b.composantesMonthly.map((c) => (
                            <tr key={c.key}>
                              <td className="name">{c.short}</td>
                              {months.map((m) => <ConfCell key={m} v={c.scores[m]} />)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <div className="py-8 text-center text-[12px] text-surface-500">Pas de données mensuelles.</div>}
                </div>
              </div>
            </section>

            {/* 6. Messages clés + résumé — libellés de conformité (cf. feedback TL) */}
            <section>
              <SectionBar icon="message">Messages clés</SectionBar>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <HlCard icon="check" tone="green" label="Composante la plus conforme" big={bestComp?.short ?? "—"} sub={`Score moyen : ${fmtPct(bestComp?.score ?? null)}`} />
                <HlCard icon="component" tone="orange" label="Composante partiellement conforme" big={partielComp?.short ?? "Aucune"} sub={partielComp ? `Score moyen : ${fmtPct(partielComp.score)}` : "Aucune composante entre 60 et 79 %"} />
                <HlCard icon="alert" tone="red" label="Composante non conforme" big={nonConfComp?.short ?? "Aucune"} sub={nonConfComp ? `Score moyen : ${fmtPct(nonConfComp.score)}` : "Aucune composante sous 60 %"} />
              </div>
            </section>

            <section>
              <SectionBar icon="trophy">Résumé score global de conformité</SectionBar>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <HlCard icon="trophy" tone="green" label={`${labels.sing} la plus conforme`} big={best?.name ?? "—"} sub={`Score moyen : ${fmtPct(best?.score ?? null)}`} />
                <HlCard icon="component" tone="orange" label={`${labels.sing} partiellement conforme`} big={partielStruct?.name ?? "Aucune"} sub={partielStruct ? `Score moyen : ${fmtPct(partielStruct.score)}` : "Aucune structure entre 60 et 79 %"} />
                <HlCard icon="alert" tone="red" label={`${labels.sing} non conforme`} big={nonConfStruct?.name ?? "Aucune"} sub={nonConfStruct ? `Score moyen : ${fmtPct(nonConfStruct.score)}` : "Aucune structure sous 60 %"} />
              </div>
            </section>
          </div>
        );
      }}
    </DataGate>
  );
}

/* ================ Page 3 — Constats & recommandations ================ */

export function SupervisionConstats() {
  const { lvl, labels, meta } = useOrgLevel();
  return (
    <DataGate>
      {(d: SupervisionBundle) => {
        const b = d.levels[lvl as StructureLevel];
        const totalReco = b.constats.reduce((a, s) => a + s.recommandations.length, 0);
        const totalConstats = b.constats.reduce((a, s) => a + s.constats.length, 0);
        const forces = b.constats.flatMap((s) => s.constats.filter((c) => c.answer === "oui"));
        const faiblesses = b.constats.flatMap((s) => s.constats.filter((c) => c.answer !== "oui"));
        // Composantes les plus citées dans les faiblesses.
        const compCount = new Map<string, number>();
        for (const c of faiblesses) if (c.composante) compCount.set(c.composante, (compCount.get(c.composante) ?? 0) + 1);
        const topDefis = [...compCount.entries()].sort((a, x) => x[1] - a[1]).slice(0, 2)
          .map(([key]) => b.composantes.find((c) => c.key === key)?.short ?? key);
        return (
          <div className="space-y-4">
            <Banner icon="reco" tone={meta.tone} title={`Constats & recommandations — ${labels.plur}`}
              sub={<>Synthèse par {labels.sing.toLowerCase()} · constats et recommandations issus de la checklist de supervision</>} />

            <section>
              <SectionBar icon="bars">Indicateurs clés</SectionBar>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiTile icon="clip" tone="navy" label="Supervisions réalisées" value={b.records} />
                <KpiTile icon={meta.icon} tone={meta.tone} label={`${labels.plur} analysées`} value={b.perStructure.length} />
                <KpiTile icon="comment" tone="blue" label="Constats renseignés" value={totalConstats} />
                <KpiTile icon="reco" tone="orange" label="Recommandations prioritaires" value={totalReco} />
              </div>
            </section>

            {b.constats.length === 0 ? (
              <div className="card card-pad flex items-center gap-3" style={{ background: TONES.blue.bg, borderColor: TONES.blue.border }}>
                <Badge icon="comment" tone="blue" size={32} />
                <div className="text-[12.5px] text-surface-700">Aucun constat renseigné pour cette sélection. Les constats et recommandations s'afficheront dès que les champs « commentaires » et « recommandations » de la checklist seront remplis.</div>
              </div>
            ) : (
              b.constats.map((s) => (
                <div key={s.name} className="card card-pad">
                  <div className="mb-2 flex items-center gap-2.5 rounded-lg px-3 py-2 text-white" style={{ background: "linear-gradient(90deg,#00205c,#0a3a86)" }}>
                    <Badge icon={meta.icon} tone={meta.tone} size={26} />
                    <div className="text-[13px] font-extrabold">{s.name}</div>
                    <div className="ml-auto text-[10.5px] font-bold text-white/70">{s.constats.length} constat{s.constats.length > 1 ? "s" : ""} · {s.recommandations.length} recommandation{s.recommandations.length > 1 ? "s" : ""}</div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div>
                      <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-navy-700">A. Constats majeurs</div>
                      {s.constats.length ? (
                        <ul className="space-y-1.5">
                          {s.constats.map((c, i) => (
                            <li key={i} className="flex items-start gap-2 text-[12px] leading-snug text-surface-700">
                              <span className="mt-px shrink-0 text-[13px]" style={{ color: c.answer === "oui" ? "#1f9d57" : "#f08c00" }}>{c.answer === "oui" ? "✓" : "⚠"}</span>
                              <span><b>{c.text}</b>{c.question ? <span className="text-surface-500"> — {c.question}</span> : null}</span>
                            </li>
                          ))}
                        </ul>
                      ) : <div className="text-[12px] text-surface-500">Aucun constat renseigné.</div>}
                    </div>
                    <div>
                      <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-navy-700">B. Recommandations prioritaires</div>
                      {s.recommandations.length ? (
                        <ul className="space-y-1.5">
                          {s.recommandations.map((r, i) => (
                            <li key={i} className="flex items-start gap-2 text-[12px] leading-snug text-surface-700">
                              <span className="mt-px shrink-0 text-[13px] font-bold" style={{ color: "#0093d5" }}>➜</span>
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      ) : <div className="text-[12px] text-surface-500">Aucune recommandation renseignée pour cette structure.</div>}
                    </div>
                  </div>
                </div>
              ))
            )}

            <section>
              <SectionBar icon="legend">Lecture rapide</SectionBar>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <HlCard icon="shield" tone="green" label="Forces observées" big={forces.length ? `${forces.length} point${forces.length > 1 ? "s" : ""} positif${forces.length > 1 ? "s" : ""}` : "—"}
                  sub={forces.length ? "Standards respectés et bonnes pratiques relevées lors des supervisions." : "Aucune force renseignée pour cette sélection."} />
                <HlCard icon="flag" tone="red" label="Défis majeurs" big={topDefis.length ? topDefis.join(" · ") : "—"}
                  sub={faiblesses.length ? `${faiblesses.length} constat${faiblesses.length > 1 ? "s" : ""} de non-conformité relevé${faiblesses.length > 1 ? "s" : ""}.` : "Aucun défi renseigné pour cette sélection."} />
                <HlCard icon="reco" tone="blue" label="Priorités d'action" big={totalReco ? `${totalReco} recommandation${totalReco > 1 ? "s" : ""}` : "—"}
                  sub={totalReco ? "Mettre en œuvre et suivre les recommandations formulées par structure." : "Aucune recommandation renseignée pour cette sélection."} />
              </div>
            </section>
          </div>
        );
      }}
    </DataGate>
  );
}

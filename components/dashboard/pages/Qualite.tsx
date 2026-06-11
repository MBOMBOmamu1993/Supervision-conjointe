"use client";

/* Onglet « Qualité des données » — Centres de santé (5 pages) + Zones de santé
   (3 pages). Données LIVE via /api/cqd (hook useCqd) ; réagissent aux filtres.
   Antigènes : PENTA1 · PENTA3 · RR1 · RR2 — sources Pointage · Registre · SNIS · DHIS2. */
import { useCqd } from "@/lib/client/cqd-api";
import type { CqdBundle, CqdConcordanceAS, CqdLevelBundle, ConcordanceClass } from "@/lib/cqd/types";
import { SectionBar } from "@/components/ui/Card";
import { KpiTile, CardTitle, Banner, C, TONES, apprConc } from "@/components/proto/proto";
import { ProtoGroupedBar, ProtoHBar, ProtoConcHBar } from "@/components/proto/charts";
import { fmtMonth } from "@/lib/client/format";
import Donut from "@/components/charts/Donut";
import { TableExportButtons } from "@/components/ui/TableExport";

/* --------------------------- helpers --------------------------- */
const round = (n: number) => Math.round(n * 10) / 10;
const pctTxt = (v: number | null) => (v == null ? "—" : `${v}%`);
const concClass = (c: ConcordanceClass) => (c === "sous" ? "Sous-rapportage" : c === "sur" ? "Sur-rapportage" : c === "normal" ? "Pas de discordance" : "—");
/** Classe de concordance d'une valeur (95–105 normal, <95 sous, >105 sur). */
const classOf = (v: number): ConcordanceClass => (v >= 95 && v <= 105 ? "normal" : v < 95 ? "sous" : "sur");
/** Écart moyen rapporté au registre de vaccination (source de référence).
 *  = moyenne des écarts absolus de chaque source comparée (pointage, SNIS, DHIS2)
 *    par rapport au registre, divisée par la valeur du registre, en %. */
const ecart = (a: { registre: number; pointage: number; snis: number; dhis2: number }) => {
  const ref = a.registre;
  if (!ref || ref <= 0) return null;
  const sources = [a.pointage, a.snis, a.dhis2].filter((x) => x > 0);
  if (!sources.length) return null;
  const sumAbs = sources.reduce((acc, x) => acc + Math.abs(x - ref), 0);
  return round((sumAbs / sources.length / ref) * 100);
};
function errAppr(v: number | null): { label: string; color: string } {
  if (v == null) return { label: "—", color: C.axis };
  if (v >= 50) return { label: "Systématique", color: C.red };
  if (v >= 30) return { label: "À surveiller", color: C.orange };
  return { label: "Aléatoires", color: C.green };
}
const antByLabel = (b: CqdLevelBundle, lab: string) => b.antigenes.find((a) => a.antigene.toUpperCase().startsWith(lab)) ?? null;
const ANT4 = ["PENTA1", "PENTA3", "RR1", "RR2"];

function Empty({ msg = "Aucune donnée disponible." }: { msg?: string }) {
  return <div className="py-10 text-center text-[12px] font-semibold text-surface-500">{msg}</div>;
}
function useLevel(level: "as" | "zs"): { data: CqdBundle | undefined; b: CqdLevelBundle | undefined; live: boolean; months: string[] } {
  const { data } = useCqd();
  const b = data?.levels[level];
  return { data, b, live: !!b && b.records > 0, months: data?.meta.months ?? [] };
}
const Interpretation = () => (
  <div className="card card-pad">
    <CardTitle icon="legend" tone="blue" title="Interprétation" sub="Taux de concordance = valeur transcrite / référence × 100" />
    <div className="space-y-2 pt-1 text-[12.5px] font-semibold text-surface-700">
      <div className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded" style={{ background: C.green }} />95–105 = pas de discordance</div>
      <div className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded" style={{ background: C.orange }} />&lt; 95 = sous-rapportage</div>
      <div className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded" style={{ background: C.red }} />&gt; 105 = sur-rapportage</div>
    </div>
  </div>
);

/** Cellule mensuelle colorée selon la classe de concordance. */
function ConcCell({ v }: { v: number | null }) {
  if (v == null || !Number.isFinite(v)) return <td className="tabular-nums text-surface-400">—</td>;
  const t = TONES[apprConc(v).tone];
  return <td className="tabular-nums" style={{ background: t.bg, color: t.text, fontWeight: 700 }}>{v}%</td>;
}

/** Tableau « Concordance par structure » : une ligne par antigène, colonnes = mois. */
function ConcTable({ icon = "table", title, sub, label, data, months }: {
  icon?: "table"; title: string; sub: string; label: string; data: CqdConcordanceAS[]; months: string[];
}) {
  const ok = data.length > 0 && months.length > 0;
  return (
    <div className="card card-pad">
      <CardTitle icon={icon} tone="navy" title={title} sub={sub} right={<TableExportButtons filename={title} />} />
      {ok ? (
        <div className="overflow-x-auto"><table className="dtable">
          <thead><tr>
            <th className="name">{label}</th><th className="name">Antigène</th>
            {months.map((m) => <th key={m}>{fmtMonth(m)}</th>)}
          </tr></thead>
          <tbody>{data.map((s) => s.antigenes.map((ant, ai) => (
            <tr key={s.name + ant.antigene}>
              {ai === 0 ? <td className="name" rowSpan={s.antigenes.length}>{s.name}</td> : null}
              <td className="name">{ant.antigene}</td>
              {ant.byMonth.map((v, mi) => <ConcCell key={mi} v={v} />)}
            </tr>
          )))}</tbody>
        </table></div>
      ) : <Empty />}
    </div>
  );
}

/* ===================== CS — 1. Comparaison sources ===================== */
export function CqdCsComparaison() {
  const { b, live } = useLevel("as");
  return (
    <div className="space-y-4">
      <Banner icon="chart" tone="blue" title="Centres de santé — Comparaison des sources de données" sub="Source de référence : registre de vaccination — comparé au pointage, SNIS et DHIS2, par antigène" />
      <section>
        <SectionBar icon="bars">Écart moyen par rapport au registre de vaccination, par antigène</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {ANT4.map((lab, i) => { const a = b ? antByLabel(b, lab) : null; const e = a ? ecart(a) : null;
            return <KpiTile key={lab} icon={i < 2 ? "syringe" : "syringe"} tone={["green", "orange", "red", "blue"][i] as never} label={`Écart moyen ${lab}`} value={pctTxt(e)} />; })}
        </div>
      </section>
      <div className="card card-pad">
        <CardTitle icon="component" tone="navy" title="Comparaison des sources (somme des CS)" sub="Pointage · Registre · SNIS · DHIS2" />
        {live && b ? (
          <ProtoGroupedBar height={260} colors={[C.orange, C.green, C.blue, C.navy]} cats={ANT4}
            series={[
              { name: "Pointage", data: ANT4.map((l) => antByLabel(b, l)?.pointage ?? 0) },
              { name: "Registre", data: ANT4.map((l) => antByLabel(b, l)?.registre ?? 0) },
              { name: "SNIS", data: ANT4.map((l) => antByLabel(b, l)?.snis ?? 0) },
              { name: "DHIS2", data: ANT4.map((l) => antByLabel(b, l)?.dhis2 ?? 0) },
            ]} />
        ) : <Empty />}
      </div>
      <div className="card card-pad" style={{ background: "#eaf4fd" }}>
        <div className="text-[12.5px] font-semibold text-surface-700">
          <b>Méthodologie de calcul des écarts :</b> la source de référence est le <b>registre de vaccination</b>.
          L'écart moyen correspond à la somme des écarts absolus de chaque source comparée (pointage, SNIS, DHIS2) par rapport au registre,
          divisée par le nombre de sources comparées, puis rapportée à la valeur du registre et exprimée en pourcentage.
        </div>
      </div>
    </div>
  );
}

/* ===================== CS — 2. Concordance ===================== */
export function CqdCsConcordance() {
  const { b, live } = useLevel("as");
  const cc = b?.csConcordance;
  // Graphique : SNIS/Registre puis Registre/Pointage, par antigène.
  const chartRows: [string, number][] = cc
    ? [
        ...cc.parAntigene.map((a) => [`${a.antigene} SNIS/Registre`, a.snisRegistre ?? 0] as [string, number]),
        ...cc.parAntigene.map((a) => [`${a.antigene} Registre/Pointage`, a.registrePointage ?? 0] as [string, number]),
      ]
    : [];
  return (
    <div className="space-y-4">
      <Banner icon="concord" tone="green" title="Contrôle qualité des données des centres de santé" sub="Taux de concordance — chaîne Fiche de pointage → Registre → SNIS · seuils 95–105" />
      <section>
        <SectionBar icon="bars">Indicateurs de concordance</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="concord" tone="green" label="Concordance globale SNIS / Registre" value={pctTxt(cc?.globalSnisRegistre ?? null)} sub={cc?.globalSnisRegistre == null ? "" : concClass(classOf(cc.globalSnisRegistre))} />
          <KpiTile icon="concord" tone="orange" label="Concordance globale Registre / Pointage" value={pctTxt(cc?.globalRegistrePointage ?? null)} sub={cc?.globalRegistrePointage == null ? "" : concClass(classOf(cc.globalRegistrePointage))} />
          <KpiTile icon="down" tone="orange" label="Sous-rapportage" value={cc ? `${cc.asSousRapportage} AS` : "—"} />
          <KpiTile icon="up" tone="red" label="Sur-rapportage" value={cc ? `${cc.asSurRapportage} AS` : "—"} />
        </div>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="card card-pad lg:col-span-7">
          <CardTitle icon="bars" tone="blue" title="Concordance globale par antigène" sub="SNIS / Registre · Registre / Pointage — seuils 95–105" />
          {live && cc ? <ProtoConcHBar height={250} maxName={150} rows={chartRows} /> : <Empty />}
        </div>
        <div className="lg:col-span-5"><Interpretation /></div>
      </div>
      <ConcTable title="Concordance SNIS / Registre par aire de santé" sub="Par antigène et par mois — SNIS transcrit du registre"
        label="AS" data={cc?.snisRegistre ?? []} months={cc?.months ?? []} />
      <ConcTable title="Concordance Registre / Pointage par aire de santé" sub="Par antigène et par mois — registre compilé depuis la feuille de pointage"
        label="AS" data={cc?.registrePointage ?? []} months={cc?.months ?? []} />
    </div>
  );
}

/* ===================== CS — 3. Erreurs ===================== */
export function CqdCsErreurs() {
  const { b, live, months } = useLevel("as");
  const rows = b?.parStructure ?? [];
  const moyen = b?.erreurRegistreSnis ?? null;
  const systematiques = rows.filter((r) => (r.erreurRegistreSnis ?? 0) >= 50).length;
  // 12 comparaisons par aire de santé : 4 antigènes (PENTA1·3 · RR1·2) × 3 mois.
  const comparaisons = rows.length * 12;
  const top5 = [...rows].sort((a, b2) => (b2.erreurRegistreSnis ?? 0) - (a.erreurRegistreSnis ?? 0)).slice(0, 5);
  return (
    <div className="space-y-4">
      <Banner icon="erreurs" tone="red" title="Centres de santé — Taux d'erreur de transcription" sub="Registre → SNIS · feuille de pointage → registre" />
      <section>
        <SectionBar icon="bars">Indicateurs d'erreur</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="erreurs" tone="red" label="Taux d'erreur (Registre – SNIS)" value={pctTxt(moyen)} sub="Toutes les aires de santé" />
          <KpiTile icon="alert" tone="orange" label="AS avec erreur systématique" value={systematiques} sub="≥ 50 %" />
          <KpiTile icon="scale" tone="navy" label="Taux d'erreur (Pointage – Registre)" value={pctTxt(b?.erreurPointageRegistre ?? null)} sub="Toutes les aires de santé" />
          <KpiTile icon="concord" tone="blue" label="Comparaisons réalisées" value={comparaisons} sub={`${rows.length} AS × 12 (4 antigènes × 3 mois)`} />
        </div>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="card card-pad lg:col-span-7">
          <CardTitle icon="chart" tone="red" title="Taux d'erreur global par mois" sub="Seuil 50 % = erreurs systématiques" />
          {live && b && b.trend.length ? (
            <ProtoGroupedBar height={200} unit="%" max={100} colors={[C.red, C.orange]} cats={b.trend.map((t) => t.month.slice(0, 7))}
              series={[{ name: "Registre – SNIS", data: b.trend.map((t) => t.erreurRegistreSnis ?? 0) }, { name: "Pointage – Registre", data: b.trend.map((t) => t.erreurPointageRegistre ?? 0) }]} />
          ) : <Empty msg="Pas d'évolution mensuelle disponible." />}
        </div>
        <div className="card card-pad lg:col-span-5">
          <CardTitle icon="rank" tone="red" title="Top 5 des AS à plus fort taux d'erreur" />
          {top5.length ? <ProtoHBar height={190} byCot={false} color={C.red} maxName={110} rows={top5.map((r) => [r.name, r.erreurRegistreSnis ?? 0]) as [string, number][]} /> : <Empty />}
        </div>
      </div>
      <div className="card card-pad">
        <CardTitle icon="table" tone="navy" title="Taux d'erreur par aire de santé" sub="Registre/SNIS · Pointage/registre · appréciation" right={<TableExportButtons filename="Taux d'erreur par aire de santé" />} />
        {rows.length ? (
          <div className="overflow-x-auto"><table className="dtable">
            <thead><tr><th className="name">Aire de santé</th><th>Registre – SNIS</th><th>Pointage – Registre</th><th>Appréciation</th></tr></thead>
            <tbody>{rows.map((r) => { const a = errAppr(r.erreurRegistreSnis); return (
              <tr key={r.name}><td className="name">{r.name}</td><td style={{ color: C.red, fontWeight: 700 }}>{pctTxt(r.erreurRegistreSnis)}</td><td>{pctTxt(r.erreurPointageRegistre)}</td><td style={{ color: a.color, fontWeight: 800 }}>{a.label}</td></tr>
            ); })}</tbody>
          </table></div>
        ) : <Empty />}
        <div className="mt-2 text-[11px] text-surface-500">Taux d'erreur = données discordantes / total des comparaisons × 100 ; le total comparé est de 12 par aire de santé (4 antigènes × 3 mois) ; ≥ 50 % = erreurs systématiques.</div>
      </div>
    </div>
  );
}

/* ===================== CS — 4. Qualité outils ===================== */
export function CqdCsOutils() {
  const { b, live } = useLevel("as");
  const o = b?.outils ?? { registre: null, pointage: null, snis: null };
  const rows = b?.parStructure ?? [];
  const aRenforcer = rows.filter((r) => r.outilsOk < 2).length;
  const okTxt = (v: boolean | null) => (v ? "Bien" : "Mal");
  return (
    <div className="space-y-4">
      <Banner icon="form" tone="violet" title="Centres de santé — Qualité de remplissage des outils" sub="Registre · Feuille de pointage · Canevas SNIS" />
      <section>
        <SectionBar icon="bars">Qualité des outils de gestion</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="form" tone="green" label="Registres bien remplis" value={pctTxt(o.registre)} />
          <KpiTile icon="form" tone="orange" label="Pointages bien remplis" value={pctTxt(o.pointage)} />
          <KpiTile icon="form" tone="blue" label="SNIS bien remplis" value={pctTxt(o.snis)} />
          <KpiTile icon="alert" tone="red" label="AS à renforcer" value={aRenforcer} sub="< 2 outils conformes" />
        </div>
      </section>
      <div className="card card-pad">
        <CardTitle icon="chart" tone="green" title="Qualité globale de remplissage par outil" sub="% de CS avec outil correctement rempli" />
        {live ? <ProtoGroupedBar height={200} unit="%" max={100} colors={[C.green, C.red]} cats={["Registre", "Feuille de pointage", "Canevas SNIS"]}
          series={[{ name: "Bien rempli", data: [o.registre ?? 0, o.pointage ?? 0, o.snis ?? 0] }, { name: "Mal rempli", data: [100 - (o.registre ?? 0), 100 - (o.pointage ?? 0), 100 - (o.snis ?? 0)] }]} /> : <Empty />}
      </div>
      <div className="card card-pad">
        <CardTitle icon="table" tone="navy" title="Appréciation par aire de santé" sub="Bien / Mal rempli par outil" right={<TableExportButtons filename="Appréciation par aire de santé" />} />
        {rows.length ? (
          <div className="overflow-x-auto"><table className="dtable">
            <thead><tr><th className="name">Aire de santé</th><th>Registre</th><th>Pointage</th><th>SNIS</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.name}><td className="name">{r.name}</td>
                {[r.registreOk, r.pointageOk, r.snisOk].map((v, i) => <td key={i} style={{ background: v ? "#e6f6ec" : "#fde2e2", color: v ? "#178a44" : "#c81e1e", fontWeight: 800 }}>{okTxt(v)}</td>)}</tr>
            ))}</tbody>
          </table></div>
        ) : <Empty />}
      </div>
    </div>
  );
}

/* ===================== CS — 5. Enfants manqués ===================== */
export function CqdCsEnfants() {
  const { b } = useLevel("as");
  const e = b?.enfants ?? { aRecuperer: 0, identifies: 0, retrouves: 0, recuperes: 0, tauxRecuperes: null };
  const rows = b?.parStructure ?? [];
  const restants = Math.max(0, e.identifies - e.recuperes);
  // Données réelles par AS : identifiés précédemment / récupérés / restant à récupérer.
  const parAs = rows
    .map((r) => {
      const ident = r.enfantsIdentifies;
      const recup = r.enfantsRecuperes;
      const reste = Math.max(0, ident - recup);
      const taux = ident > 0 ? round((recup / ident) * 100) : null;
      return { name: r.name, ident, recup, reste, taux };
    })
    .filter((x) => x.ident > 0)
    .sort((a, c) => c.ident - a.ident);
  const byAs = parAs.map((x) => [x.name, x.ident] as [string, number]).slice(0, 10);
  const asPrioritaire = [...parAs].sort((a, c) => c.reste - a.reste)[0]?.name ?? "—";
  const top = parAs.slice(0, 8);
  // Messages clés dérivés des données réelles.
  const messages: string[] = [];
  if (e.identifies > 0) messages.push(`${e.identifies} enfants identifiés précédemment, dont ${e.recuperes} récupérés (taux ${pctTxt(e.tauxRecuperes)}).`);
  if (restants > 0) messages.push(`${restants} enfants restent à récupérer — prioriser les AS à fort volume.`);
  if (asPrioritaire !== "—") messages.push(`${asPrioritaire} est l'aire de santé la plus concernée.`);
  if (e.aRecuperer > 0) messages.push(`${e.aRecuperer} enfants nouvellement identifiés lors de la supervision en cours.`);

  return (
    <div className="space-y-4">
      <Banner icon="child" tone="blue" title="Contrôle qualité des données des centres de santé" sub="Identification des enfants manqués — identifiés · retrouvés par les relais · récupérés" />
      <section>
        <SectionBar icon="child">Enfants manqués / à récupérer</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiTile icon="child" tone="navy" label="Enfants identifiés précédemment" value={e.identifies} />
          <KpiTile icon="clip" tone="violet" label="Identifiés récemment (supervision en cours)" value={e.aRecuperer} />
          <KpiTile icon="people" tone="orange" label="Retrouvés par les relais" value={e.retrouves} />
          <KpiTile icon="check" tone="green" label="Effectivement récupérés" value={e.recuperes} sub={`Taux : ${pctTxt(e.tauxRecuperes)}`} />
          <KpiTile icon="building" tone="teal" label="AS prioritaire" value={asPrioritaire} />
        </div>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="card card-pad lg:col-span-7">
          <CardTitle icon="chart" tone="blue" title="Enfants manqués par aire de santé" sub="Enfants identifiés précédemment" />
          {byAs.length ? <ProtoHBar height={Math.max(160, byAs.length * 34)} byCot={false} color={C.blue} maxName={120} unit="" max={Math.max(...byAs.map((x) => x[1]), 1)} rows={byAs} /> : <Empty />}
        </div>
        <div className="card card-pad lg:col-span-5">
          <CardTitle icon="cotation" tone="green" title="Récupération des enfants identifiés" sub="Récupérés vs restant à récupérer" />
          <Donut height={200} data={[{ name: "Récupérés", value: e.recuperes, color: C.green }, { name: "Restant à récupérer", value: restants, color: C.orange }]} />
        </div>
      </div>
      <div className="card card-pad">
        <CardTitle icon="building" tone="navy" title="Aires de santé prioritaires" sub="Classées par enfants restant à récupérer" right={<TableExportButtons filename="Aires de santé prioritaires" />} />
        {top.length ? (
          <div className="overflow-x-auto"><table className="dtable">
            <thead><tr><th className="name">Aire de santé</th><th>Identifiés</th><th>Récupérés</th><th>Restant</th><th>Taux récup.</th><th>Priorité</th></tr></thead>
            <tbody>{[...top].sort((a, c) => c.reste - a.reste).map((r) => (
              <tr key={r.name}><td className="name">{r.name}</td>
                <td className="tabular-nums">{r.ident}</td>
                <td className="tabular-nums">{r.recup}</td>
                <td className="tabular-nums">{r.reste}</td>
                <td className="tabular-nums">{pctTxt(r.taux)}</td>
                <td><PrioBadge taux={r.taux} reste={r.reste} /></td></tr>
            ))}</tbody>
          </table></div>
        ) : <Empty />}
      </div>
      <div className="card card-pad">
        <CardTitle icon="report" tone="blue" title="Messages clés" sub="Synthèse automatique" />
        <ul className="space-y-2 pt-1 text-[12.5px] font-semibold text-surface-700">
          {(messages.length ? messages : ["Aucune donnée disponible."]).map((m, i) => (
            <li key={i} className="flex items-start gap-2"><span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: C.blue }} />{m}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Badge de priorité d'une AS pour la récupération des enfants manqués. */
function PrioBadge({ taux, reste }: { taux: number | null; reste: number }) {
  let tone: "red" | "orange" | "green" = "green";
  let label = "Faible";
  if (reste > 0 && (taux == null || taux < 50)) { tone = "red"; label = "Élevée"; }
  else if (reste > 0 && taux != null && taux < 80) { tone = "orange"; label = "Moyenne"; }
  const t = TONES[tone];
  return <span className="inline-flex items-center rounded-full px-[9px] py-[3px] text-[11px] font-extrabold" style={{ background: t.bg, color: t.text }}>{label}</span>;
}

/* ===================== ZS — 1. Comparaison sources ===================== */
export function CqdZsComparaison() {
  const { b, live } = useLevel("zs");
  return (
    <div className="space-y-4">
      <Banner icon="chart" tone="navy" title="Zones de santé — Comparaison SNIS / DHIS2" sub="SNIS des AS – DHIS2 des mêmes AS (échantillon de 3 AS sur 3 mois)" />
      <section>
        <SectionBar icon="bars">Écart moyen SNIS / DHIS2 par antigène</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {ANT4.map((lab, i) => { const a = b ? antByLabel(b, lab) : null; const e = a && a.snis > 0 ? round(Math.abs(a.snis - a.dhis2) / a.snis * 100) : null;
            return <KpiTile key={lab} icon="syringe" tone={["green", "orange", "red", "blue"][i] as never} label={`Écart moyen ${lab}`} value={pctTxt(e)} />; })}
        </div>
      </section>
      <div className="card card-pad">
        <CardTitle icon="component" tone="navy" title="Comparaison SNIS / DHIS2 (somme des CS)" sub="PENTA1 · PENTA3 · RR1 · RR2" />
        {live && b ? <ProtoGroupedBar height={230} colors={[C.orange, C.blue]} cats={ANT4}
          series={[{ name: "SNIS", data: ANT4.map((l) => antByLabel(b, l)?.snis ?? 0) }, { name: "DHIS2", data: ANT4.map((l) => antByLabel(b, l)?.dhis2 ?? 0) }]} /> : <Empty />}
      </div>
      <div className="card card-pad" style={{ background: "#eaf4fd" }}>
        <div className="text-[12.5px] font-semibold text-surface-700">Messages clés : les écarts SNIS/DHIS2 restent globalement modérés ; la comparaison mensuelle facilite l'identification des anomalies de transcription.</div>
      </div>
    </div>
  );
}

/* ===================== ZS — 2. Concordance ===================== */
export function CqdZsConcordance() {
  const { b, live } = useLevel("zs");
  const cc = b?.csConcordance;
  const g = cc?.globalDhis2Snis ?? null;
  const chartRows: [string, number][] = cc
    ? cc.parAntigene.map((a) => [`${a.antigene} DHIS2/SNIS`, a.dhis2Snis ?? 0] as [string, number])
    : [];
  return (
    <div className="space-y-4">
      <Banner icon="concord" tone="blue" title="Contrôle qualité des données des zones de santé" sub="Taux de concordance DHIS2 / SNIS — DHIS2 transcrit du SNIS · seuils 95–105" />
      <section>
        <SectionBar icon="bars">Indicateurs de concordance</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="concord" tone="teal" label="Concordance globale DHIS2 / SNIS" value={pctTxt(g)} sub={g == null ? "" : concClass(classOf(g))} />
          <KpiTile icon="down" tone="orange" label="ZS en sous-rapportage" value={cc ? `${cc.zsSousRapportage} ZS` : "—"} />
          <KpiTile icon="up" tone="red" label="ZS en sur-rapportage" value={cc ? `${cc.zsSurRapportage} ZS` : "—"} />
          <KpiTile icon="calendar" tone="blue" label="Mois analysés" value={cc ? cc.months.length : "—"} />
        </div>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="card card-pad lg:col-span-5">
          <CardTitle icon="bars" tone="blue" title="Concordance globale par antigène" sub="DHIS2 / SNIS — seuils 95–105" />
          {live && cc ? <ProtoConcHBar height={210} maxName={140} rows={chartRows} /> : <Empty />}
        </div>
        <div className="lg:col-span-7">
          <ConcTable title="Concordance DHIS2 / SNIS par zone de santé" sub="Par antigène et par mois"
            label="ZS" data={cc?.dhis2Snis ?? []} months={cc?.months ?? []} />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <LectureRapideZs g={g} sous={cc?.zsSousRapportage ?? 0} sur={cc?.zsSurRapportage ?? 0} parAntigene={cc?.parAntigene} />
        <Interpretation />
      </div>
    </div>
  );
}

/** Encadré « Lecture rapide » pour la concordance ZS (messages dérivés des chiffres). */
function LectureRapideZs({ g, sous, sur, parAntigene }: {
  g: number | null; sous: number; sur: number;
  parAntigene?: { antigene: string; dhis2Snis: number | null }[];
}) {
  const points: string[] = [];
  if (g != null) points.push(g >= 95 && g <= 105 ? "Concordance globale satisfaisante (dans les seuils 95–105)." : g < 95 ? "Concordance globale en sous-rapportage (< 95 %)." : "Concordance globale en sur-rapportage (> 105 %).");
  const hors = (parAntigene ?? []).filter((a) => a.dhis2Snis != null && (a.dhis2Snis < 95 || a.dhis2Snis > 105)).map((a) => a.antigene);
  if (hors.length) points.push(`Discordances ponctuelles sur ${hors.join(", ")}.`);
  if (sous || sur) points.push(`${sous} ZS en sous-rapportage · ${sur} ZS en sur-rapportage.`);
  if (g != null && g >= 95 && g <= 105 && !hors.length) points.push("Les résultats restent globalement conformes.");
  return (
    <div className="card card-pad">
      <CardTitle icon="legend" tone="blue" title="Lecture rapide" sub="Synthèse automatique" />
      <ul className="space-y-2 pt-1 text-[12.5px] font-semibold text-surface-700">
        {(points.length ? points : ["Aucune donnée disponible."]).map((p, i) => (
          <li key={i} className="flex items-start gap-2"><span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: C.blue }} />{p}</li>
        ))}
      </ul>
    </div>
  );
}

/* ===================== ZS — 3. Erreurs ===================== */
export function CqdZsErreurs() {
  const { b, live } = useLevel("zs");
  const rows = b?.parStructure ?? [];
  const systematiques = rows.filter((r) => (r.erreurSnisDhis2 ?? 0) >= 50).length;
  const top5 = [...rows].sort((a, c) => (c.erreurSnisDhis2 ?? 0) - (a.erreurSnisDhis2 ?? 0)).slice(0, 5);
  return (
    <div className="space-y-4">
      <Banner icon="erreurs" tone="red" title="Zones de santé — Taux d'erreur SNIS / DHIS2" sub="36 comparaisons pour 3 AS sur 3 mois × 4 antigènes" />
      <section>
        <SectionBar icon="bars">Indicateurs d'erreur</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="erreurs" tone="red" label="Taux d'erreur moyen" value={pctTxt(b?.erreurSnisDhis2 ?? null)} sub="SNIS / DHIS2" />
          <KpiTile icon="alert" tone="orange" label="ZS erreurs systématiques" value={systematiques} sub="≥ 50 %" />
          <KpiTile icon="concord" tone="navy" label="Comparaisons réalisées" value={rows.length * 4} sub={`${rows.length} ZS × 4 antigènes`} />
          <KpiTile icon="syringe" tone="blue" label="Antigènes suivis" value={4} sub="PENTA1·3 · RR1·2" />
        </div>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="card card-pad lg:col-span-7">
          <CardTitle icon="chart" tone="red" title="Taux d'erreur global par mois" sub="Seuil 50 %" />
          {live && b && b.trend.length ? <ProtoGroupedBar height={200} unit="%" max={100} colors={[C.red]} cats={b.trend.map((t) => t.month.slice(0, 7))}
            series={[{ name: "SNIS / DHIS2", data: b.trend.map((t) => t.erreurSnisDhis2 ?? 0) }]} /> : <Empty msg="Pas d'évolution mensuelle disponible." />}
        </div>
        <div className="card card-pad lg:col-span-5">
          <CardTitle icon="rank" tone="red" title="Top 5 des ZS à plus fort taux d'erreur" />
          {top5.length ? <ProtoHBar height={190} byCot={false} color={C.red} maxName={110} rows={top5.map((r) => [r.name, r.erreurSnisDhis2 ?? 0]) as [string, number][]} /> : <Empty />}
        </div>
      </div>
      <div className="card card-pad">
        <CardTitle icon="table" tone="navy" title="Taux d'erreur SNIS / DHIS2 par zone de santé" sub="Avec appréciation" right={<TableExportButtons filename="Taux d'erreur SNIS / DHIS2 par zone de santé" />} />
        {rows.length ? (
          <div className="overflow-x-auto"><table className="dtable">
            <thead><tr><th className="name">Zone de santé</th><th>Taux d'erreur</th><th>Appréciation</th></tr></thead>
            <tbody>{rows.map((r) => { const a = errAppr(r.erreurSnisDhis2); return (
              <tr key={r.name}><td className="name">{r.name}</td><td style={{ color: C.red, fontWeight: 700 }}>{pctTxt(r.erreurSnisDhis2)}</td><td style={{ color: a.color, fontWeight: 800 }}>{a.label}</td></tr>
            ); })}</tbody>
          </table></div>
        ) : <Empty />}
      </div>
    </div>
  );
}

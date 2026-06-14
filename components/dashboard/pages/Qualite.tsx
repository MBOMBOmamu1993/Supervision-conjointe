"use client";

/* Onglet « Qualité des données » — Centres de santé (5 pages) + Zones de santé
   (3 pages). Données LIVE via /api/cqd (hook useCqd) ; réagissent aux filtres.
   Antigènes : PENTA1 · PENTA3 · RR1 · RR2 — sources Pointage · Registre · SNIS · DHIS2. */
import { Fragment, useState } from "react";
import { useCqd } from "@/lib/client/cqd-api";
import { useTriangulation } from "@/lib/client/triangulation-api";
import type { CqdBundle, CqdConcordanceAS, CqdLevelBundle, ConcordanceClass } from "@/lib/cqd/types";
import { SectionBar } from "@/components/ui/Card";
import { KpiTile, CardTitle, Banner, C, TONES, apprConc, PointerIcon, Badge, type Tone } from "@/components/proto/proto";
import { ProtoGroupedBar, ProtoHBar, ProtoConcHBar } from "@/components/proto/charts";
import { fmtMonth } from "@/lib/client/format";
import Donut from "@/components/charts/Donut";
import EChart from "@/components/charts/EChart";
import { TableExportButtons } from "@/components/ui/TableExport";
import { usePaged, Pager } from "@/components/ui/Pagination";

/* --------------------------- helpers --------------------------- */
const round = (n: number) => Math.round(n * 10) / 10;
const pctTxt = (v: number | null) => (v == null ? "—" : `${v}%`);
const concClass = (c: ConcordanceClass) => (c === "sous" ? "Sous-rapportage" : c === "sur" ? "Sur-rapportage" : c === "normal" ? "Pas de discordance" : "—");
/** Classe de concordance d'une valeur (95–105 normal, <95 sous, >105 sur). */
const classOf = (v: number): ConcordanceClass => (v >= 95 && v <= 105 ? "normal" : v < 95 ? "sous" : "sur");
/** Écart moyen rapporté au registre de vaccination (source de référence).
 *  = moyenne des écarts absolus de chaque source comparée (pointage, SNIS)
 *    par rapport au registre, divisée par la valeur du registre, en %.
 *  DHIS2 est exclu au niveau CS (feedback TL : la chaîne des centres de santé
 *  est Pointage · Registre · SNIS uniquement ; DHIS2 reste au niveau ZS). */
const ecart = (a: { registre: number; pointage: number; snis: number; dhis2: number }) => {
  const ref = a.registre;
  if (!ref || ref <= 0) return null;
  const sources = [a.pointage, a.snis].filter((x) => x > 0);
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
const Interpretation = ({ label = "Taux de concordance" }: { label?: string }) => (
  <div className="card card-pad">
    <CardTitle icon="legend" tone="blue" title="Interprétation" sub={`${label} = valeur transcrite / référence × 100`} />
    <div className="space-y-2 pt-1 text-[12.5px] font-semibold text-surface-700">
      <div className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded" style={{ background: C.green }} />95–105 = pas de discordance</div>
      <div className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded" style={{ background: C.orange }} />&lt; 95 = sous-rapportage</div>
      <div className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded" style={{ background: C.red }} />&gt; 105 = sur-rapportage</div>
    </div>
  </div>
);

/**
 * « Indicateurs de contrôle de qualité des données — Définitions, formules et
 * interprétation » (feedback TL — visuel pédagogique recréé en HTML/React).
 * Affichée en tête des pages Comparaison sources (CS et ZS).
 */
function CqdDefinitions() {
  const defs = [
    {
      n: 1,
      titre: "Facteur de vérification (ou taux de concordance)",
      definition: "Mesure le niveau de cohérence entre les données rapportées dans un outil contrôlé et les données retrouvées dans l'outil de référence. Il permet de vérifier si les chiffres déclarés dans un outil de gestion des données PEV correspondent aux chiffres réellement retrouvés dans l'outil primaire ou l'outil de référence.",
      formule: "(valeur retrouvée dans l'outil vérifié / valeur de l'outil de référence) × 100",
      interp: [
        { txt: "95–105 % : bonne concordance", color: C.green },
        { txt: "> 105 % : sur-rapportage", color: C.red },
        { txt: "< 95 % : sous-rapportage", color: C.orange },
      ],
    },
    {
      n: 2,
      titre: "Écart moyen",
      definition: "Différence moyenne entre les chiffres retrouvés dans les outils comparés (fiche de pointage, canevas SNIS, DHIS2…) et le chiffre de l'outil de référence — au niveau CS le registre de vaccination, au niveau ZS le SNIS comparé au DHIS2.",
      formule: "Σ |valeur outil comparé − valeur de l'outil de référence| ÷ nombre d'outils comparés, rapportée à la valeur de référence (%)",
      interp: [
        { txt: "Plus l'écart moyen est faible, plus les outils sont cohérents avec l'outil de référence.", color: C.green },
      ],
    },
    {
      n: 3,
      titre: "Taux d'erreur",
      definition: "Proportion d'écart entre une valeur rapportée et la valeur attendue/retrouvée dans l'outil de référence.",
      formule: "(nombre de discordances entre l'outil contrôlé et l'outil de référence / total des comparaisons effectuées) × 100",
      interp: [
        { txt: "0 % : aucune différence entre les deux outils", color: C.green },
        { txt: "> 50 % : erreurs systématiques", color: C.red },
      ],
    },
  ];
  return (
    <section>
      <SectionBar icon="legend">Note explicative des indicateurs de contrôle qualité des données</SectionBar>
      {/* Fermée PAR DÉFAUT : un doigt indique qu'un clic déroule / replie la
          note explicative (feedback Dr Léandre). Regroupe TOUTES les définitions
          (facteur de vérification, écart moyen, taux d'erreur) — les encadrés
          autrefois affichés en permanence sont désormais repliés ici. */}
      <details className="card card-pad">
        <summary className="flex cursor-pointer select-none flex-wrap items-center gap-2 text-[12.5px] font-bold text-navy-700">
          <PointerIcon />
          <span>Facteur de vérification · Écart moyen · Taux d'erreur — afficher les définitions</span>
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] text-[10.5px] font-extrabold uppercase tracking-wide text-white" style={{ background: "#0093d5" }}>
            Cliquez ici pour dérouler / replier la note explicative
          </span>
        </summary>
        <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
          {defs.map((d) => (
            <div key={d.n} className="rounded-xl border border-surface-200 bg-[#f6f8fb] p-3.5">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold text-white" style={{ background: "#0a3a86" }}>{d.n}</span>
                <div className="text-[12.5px] font-extrabold text-navy-700">{d.titre}</div>
              </div>
              <div className="text-[11.5px] leading-relaxed text-surface-700">{d.definition}</div>
              <div className="mt-2 rounded-lg border border-surface-200 bg-white px-3 py-2 text-[11.5px] font-bold text-navy-700">
                Formule : <span className="font-semibold text-surface-700">{d.formule}</span>
              </div>
              <ul className="mt-2 space-y-1">
                {d.interp.map((it, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[11.5px] font-semibold" style={{ color: it.color }}>
                    <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: it.color }} />{it.txt}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-lg px-3.5 py-2 text-[11.5px] font-semibold text-surface-700" style={{ background: "#eaf4fd" }}>
          <b>Lecture rapide :</b> ① le taux de concordance évalue la cohérence · ② l'écart moyen mesure l'ampleur moyenne des différences · ③ le taux d'erreur indique la fréquence des discordances.
        </div>
      </details>
    </section>
  );
}

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
  // Pagination par structure : 30 structures par page (feedback TL).
  const pg = usePaged(data, 30);
  return (
    <div className="card card-pad">
      <CardTitle icon={icon} tone="navy" title={title} sub={sub} right={<TableExportButtons filename={title} />} />
      {ok ? (
        <>
        <div className="overflow-x-auto"><table className="dtable">
          <thead><tr>
            <th className="name">{label}</th><th className="name">Antigène</th>
            {months.map((m) => <th key={m}>{fmtMonth(m)}</th>)}
          </tr></thead>
          <tbody>{pg.slice.map((s) => s.antigenes.map((ant, ai) => (
            <tr key={s.name + ant.antigene}>
              {/* La colonne « structure » est présente sur chaque ligne (vide
                  pour les antigènes suivants) afin que la 1re colonne figée
                  reste alignée — équivalent visuel d'un rowSpan. */}
              <td className="name">{ai === 0 ? s.name : ""}</td>
              <td className="name">{ant.antigene}</td>
              {ant.byMonth.map((v, mi) => <ConcCell key={mi} v={v} />)}
            </tr>
          )))}</tbody>
        </table></div>
        <Pager page={pg.page} pageCount={pg.pageCount} setPage={pg.setPage} start={pg.start} end={pg.end} total={pg.total} />
        </>
      ) : <Empty />}
    </div>
  );
}

/* ===================== CS — 1. Comparaison sources ===================== */
export function CqdCsComparaison() {
  const { b, live } = useLevel("as");
  return (
    <div className="space-y-4">
      <Banner icon="chart" tone="blue" title="Centres de santé — Comparaison des sources de données" sub="Source de référence : registre de vaccination — comparé au pointage et au SNIS, par antigène" />
      <CqdDefinitions />
      <section>
        <SectionBar icon="bars">Écart moyen par rapport au registre de vaccination, par antigène</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {ANT4.map((lab, i) => { const a = b ? antByLabel(b, lab) : null; const e = a ? ecart(a) : null;
            return <KpiTile key={lab} icon={i < 2 ? "syringe" : "syringe"} tone={["green", "orange", "red", "blue"][i] as never} label={`Écart moyen ${lab}`} value={pctTxt(e)} />; })}
          {/* Nombre de structures ayant bénéficié du contrôle qualité (feedback Dr Léandre). */}
          <KpiTile icon="clinic" tone="navy" label="Nombre d'AS contrôlées" value={b?.structuresControlees ?? "—"}
            sub="Aires de santé ayant bénéficié du contrôle qualité des données" />
        </div>
      </section>
      <div className="card card-pad">
        <CardTitle icon="component" tone="navy" title="Comparaison des sources (somme des CS)" sub="Pointage · Registre · SNIS" />
        {live && b ? (
          <ProtoGroupedBar height={260} colors={[C.orange, C.green, C.blue]} cats={ANT4}
            series={[
              { name: "Pointage", data: ANT4.map((l) => antByLabel(b, l)?.pointage ?? 0) },
              { name: "Registre", data: ANT4.map((l) => antByLabel(b, l)?.registre ?? 0) },
              { name: "SNIS", data: ANT4.map((l) => antByLabel(b, l)?.snis ?? 0) },
            ]} />
        ) : <Empty />}
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
      <Banner icon="concord" tone="green" title="Contrôle qualité des données des centres de santé" sub="Facteur de vérification — chaîne Fiche de pointage → Registre → SNIS · seuils 95–105" />
      <div className="card card-pad" style={{ background: "#eaf4fd" }}>
        <div className="text-[12px] leading-relaxed text-surface-700">
          <b>Facteur de vérification (ou taux de concordance) :</b> mesure le niveau de cohérence entre les données rapportées
          dans un outil contrôlé et les données retrouvées dans l'outil de référence. Formule : (valeur retrouvée dans l'outil
          vérifié ÷ valeur de l'outil de référence) × 100. Interprétation : <b>95–105 %</b> = bonne concordance ·
          <b> &lt; 95 %</b> = sous-rapportage · <b>&gt; 105 %</b> = sur-rapportage.
        </div>
      </div>
      <section>
        <SectionBar icon="bars">Facteurs de vérification par rapport à l'outil de référence</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="concord" tone="green" label="Facteur de vérification SNIS / Registre" value={pctTxt(cc?.globalSnisRegistre ?? null)} sub={cc?.globalSnisRegistre == null ? "" : concClass(classOf(cc.globalSnisRegistre))} />
          <KpiTile icon="concord" tone="orange" label="Facteur de vérification Registre / Pointage" value={pctTxt(cc?.globalRegistrePointage ?? null)} sub={cc?.globalRegistrePointage == null ? "" : concClass(classOf(cc.globalRegistrePointage))} />
          <KpiTile icon="down" tone="orange" label="Sous-rapportage" value={cc ? `${cc.asSousRapportage} AS` : "—"} />
          <KpiTile icon="up" tone="red" label="Sur-rapportage" value={cc ? `${cc.asSurRapportage} AS` : "—"} />
        </div>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="card card-pad lg:col-span-7">
          <CardTitle icon="bars" tone="blue" title="Facteur de vérification par antigène" sub="SNIS / Registre · Registre / Pointage — seuils 95–105" />
          {live && cc ? <ProtoConcHBar height={250} maxName={150} rows={chartRows} /> : <Empty />}
        </div>
        <div className="lg:col-span-5"><Interpretation label="Facteur de vérification" /></div>
      </div>
      <ConcTable title="Facteur de vérification SNIS / Registre par aire de santé" sub="Par antigène et par mois — SNIS transcrit du registre"
        label="AS" data={cc?.snisRegistre ?? []} months={cc?.months ?? []} />
      <ConcTable title="Facteur de vérification Registre / Pointage par aire de santé" sub="Par antigène et par mois — registre compilé depuis la feuille de pointage"
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
  const pg = usePaged(rows, 30);
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
          <>
          <div className="overflow-x-auto"><table className="dtable">
            <thead><tr><th className="name">Aire de santé</th><th>Registre – SNIS</th><th>Pointage – Registre</th><th>Appréciation</th></tr></thead>
            <tbody>{pg.slice.map((r) => { const a = errAppr(r.erreurRegistreSnis); return (
              <tr key={r.name}><td className="name">{r.name}</td><td style={{ color: C.red, fontWeight: 700 }}>{pctTxt(r.erreurRegistreSnis)}</td><td>{pctTxt(r.erreurPointageRegistre)}</td><td style={{ color: a.color, fontWeight: 800 }}>{a.label}</td></tr>
            ); })}</tbody>
          </table></div>
          <Pager page={pg.page} pageCount={pg.pageCount} setPage={pg.setPage} start={pg.start} end={pg.end} total={pg.total} />
          </>
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
  const pg = usePaged(rows, 30);
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
          <>
          <div className="overflow-x-auto"><table className="dtable">
            <thead><tr><th className="name">Aire de santé</th><th>Registre</th><th>Pointage</th><th>SNIS</th></tr></thead>
            <tbody>{pg.slice.map((r) => (
              <tr key={r.name}><td className="name">{r.name}</td>
                {[r.registreOk, r.pointageOk, r.snisOk].map((v, i) => <td key={i} style={{ background: v ? "#e6f6ec" : "#fde2e2", color: v ? "#178a44" : "#c81e1e", fontWeight: 800 }}>{okTxt(v)}</td>)}</tr>
            ))}</tbody>
          </table></div>
          <Pager page={pg.page} pageCount={pg.pageCount} setPage={pg.setPage} start={pg.start} end={pg.end} total={pg.total} />
          </>
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiTile icon="child" tone="navy" label="Enfants identifiés précédemment" value={e.identifies} />
          <KpiTile icon="people" tone="orange" label="Retrouvés par les relais" value={e.retrouves} />
          <KpiTile icon="check" tone="green" label="Effectivement récupérés" value={e.recuperes} sub={`Taux : ${pctTxt(e.tauxRecuperes)}`} />
          <KpiTile icon="building" tone="teal" label="AS prioritaire" value={asPrioritaire} />
          <KpiTile icon="form" tone="blue" label="Listes d'enfants manqués remises aux équipes CS" value={pctTxt(b?.listesRemisesPct ?? null)} sub="% des centres contrôlés" />
          <KpiTile icon="clip" tone="violet" label="Identifiés récemment (supervision en cours)" value={e.aRecuperer} />
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
        <CardTitle icon="table" tone="navy" title="Enfants manqués par aire de santé et par antigène" sub="Tranches d'âge : 0–11 mois · 12–23 mois · 24–59 mois"
          right={<TableExportButtons filename="Enfants manqués par aire de santé et par antigène" />} />
        <MissedByAntigenTable b={b} />
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

/**
 * Tableau « Enfants manqués par aire de santé et par antigène » (feedback TL) :
 * lignes = antigènes, colonnes = tranches d'âge, sélecteur d'AS au-dessus
 * (agrégat de la sélection par défaut). État vide propre si le formulaire CQD
 * n'expose pas (encore) les champs antigène × âge.
 */
function MissedByAntigenTable({ b }: { b: CqdLevelBundle | undefined }) {
  const [selAs, setSelAs] = useState<string>("");
  const m = b?.manquesParAntigene;
  if (!m || !m.available || !m.structures.length) {
    return (
      <Empty msg="Le champ « enfants manqués par antigène × âge » existe dans le formulaire CQD, mais aucune donnée n'a encore été renseignée pour cette sélection / cette période — le tableau s'alimentera automatiquement dès les premières saisies dans Kobo." />
    );
  }
  const structures = selAs ? m.structures.filter((st) => st.name === selAs) : m.structures;
  const sum = (label: string, key: "a0_11" | "a12_23" | "a24_59") =>
    structures.reduce((a, st) => a + (st.values[label]?.[key] ?? 0), 0);
  const rows = m.antigenes.map((label) => ({
    label,
    a0_11: sum(label, "a0_11"),
    a12_23: sum(label, "a12_23"),
    a24_59: sum(label, "a24_59"),
  }));
  const tot = (key: "a0_11" | "a12_23" | "a24_59") => rows.reduce((a, r) => a + r[key], 0);
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <label className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Aire de santé</label>
        <select
          className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12px] font-bold text-navy-700 outline-none hover:border-oms-500"
          value={selAs}
          onChange={(ev) => setSelAs(ev.target.value)}
        >
          <option value="">Toutes (agrégat de la sélection)</option>
          {m.structures.map((st) => <option key={st.name} value={st.name}>{st.name}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="dtable">
          <thead><tr><th className="name">Antigène</th><th>0–11 mois</th><th>12–23 mois</th><th>24–59 mois</th><th>Total</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="name">{r.label}</td>
                <td>{r.a0_11}</td>
                <td>{r.a12_23}</td>
                <td>{r.a24_59}</td>
                <td style={{ fontWeight: 800, color: C.navy }}>{r.a0_11 + r.a12_23 + r.a24_59}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td className="name">Total</td><td>{tot("a0_11")}</td><td>{tot("a12_23")}</td><td>{tot("a24_59")}</td><td style={{ fontWeight: 800 }}>{tot("a0_11") + tot("a12_23") + tot("a24_59")}</td></tr></tfoot>
        </table>
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
      <CqdDefinitions />
      <section>
        <SectionBar icon="bars">Écart moyen SNIS / DHIS2 par antigène</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {ANT4.map((lab, i) => { const a = b ? antByLabel(b, lab) : null; const e = a && a.snis > 0 ? round(Math.abs(a.snis - a.dhis2) / a.snis * 100) : null;
            return <KpiTile key={lab} icon="syringe" tone={["green", "orange", "red", "blue"][i] as never} label={`Écart moyen ${lab}`} value={pctTxt(e)} />; })}
          {/* Nombre de structures ayant bénéficié du contrôle qualité (feedback Dr Léandre). */}
          <KpiTile icon="hospital" tone="navy" label="Nombre de ZS contrôlées" value={b?.structuresControlees ?? "—"}
            sub="Zones de santé ayant bénéficié du contrôle qualité des données" />
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
      <Banner icon="concord" tone="blue" title="Contrôle qualité des données des zones de santé" sub="Facteur de vérification DHIS2 / SNIS — DHIS2 transcrit du SNIS · seuils 95–105" />
      <div className="card card-pad" style={{ background: "#eaf4fd" }}>
        <div className="text-[12px] leading-relaxed text-surface-700">
          <b>Facteur de vérification (ou taux de concordance) :</b> (valeur retrouvée dans l'outil vérifié — DHIS2 ÷ valeur de
          l'outil de référence — SNIS) × 100. Le facteur de vérification permet de déterminer la concordance des données :
          <b> 95–105 %</b> = bonne concordance · <b>&lt; 95 %</b> = sous-rapportage · <b>&gt; 105 %</b> = sur-rapportage.
        </div>
      </div>
      <section>
        <SectionBar icon="bars">Facteurs de vérification</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="concord" tone="teal" label="Facteur de vérification DHIS2 / SNIS" value={pctTxt(g)} sub={g == null ? "" : concClass(classOf(g))} />
          <KpiTile icon="down" tone="orange" label="ZS en sous-rapportage" value={cc ? `${cc.zsSousRapportage} ZS` : "—"} />
          <KpiTile icon="up" tone="red" label="ZS en sur-rapportage" value={cc ? `${cc.zsSurRapportage} ZS` : "—"} />
          <KpiTile icon="calendar" tone="blue" label="Mois analysés" value={cc ? cc.months.length : "—"} />
        </div>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="card card-pad lg:col-span-5">
          <CardTitle icon="bars" tone="blue" title="Facteur de vérification par antigène" sub="DHIS2 / SNIS — seuils 95–105" />
          {live && cc ? <ProtoConcHBar height={210} maxName={140} rows={chartRows} /> : <Empty />}
        </div>
        <div className="lg:col-span-7">
          <ConcTable title="Facteur de vérification DHIS2 / SNIS par zone de santé" sub="Par antigène et par mois"
            label="ZS" data={cc?.dhis2Snis ?? []} months={cc?.months ?? []} />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <LectureRapideZs g={g} sous={cc?.zsSousRapportage ?? 0} sur={cc?.zsSurRapportage ?? 0} parAntigene={cc?.parAntigene} />
        <Interpretation label="Facteur de vérification" />
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
  if (g != null) points.push(g >= 95 && g <= 105 ? "Facteur de vérification global satisfaisant (dans les seuils 95–105)." : g < 95 ? "Facteur de vérification global en sous-rapportage (< 95 %)." : "Facteur de vérification global en sur-rapportage (> 105 %).");
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
  const { b, live, months } = useLevel("zs");
  const rows = b?.parStructure ?? [];
  const systematiques = rows.filter((r) => (r.erreurSnisDhis2 ?? 0) >= 50).length;
  // Comparaisons : réalisées = ZS contrôlées × 4 antigènes × mois contrôlés ;
  // attendues = dénominateur FIXE du protocole CQD (feedback Dr Léandre) :
  // 4 antigènes × 3 zones de santé × 3 mois = 36 — il ne change pas avec les filtres.
  const COMPARAISONS_ATTENDUES = 4 * 3 * 3;
  const realisees = rows.length * 4 * Math.max(1, months.length);
  const top5 = [...rows].sort((a, c) => (c.erreurSnisDhis2 ?? 0) - (a.erreurSnisDhis2 ?? 0)).slice(0, 5);
  return (
    <div className="space-y-4">
      <Banner icon="erreurs" tone="red" title="Zones de santé — Taux d'erreur SNIS / DHIS2" />
      <section>
        <SectionBar icon="bars">Indicateurs d'erreur</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="erreurs" tone="red" label="Taux d'erreur moyen" value={pctTxt(b?.erreurSnisDhis2 ?? null)} sub="SNIS / DHIS2" />
          <KpiTile icon="alert" tone="orange" label="ZS erreurs systématiques" value={systematiques} sub="≥ 50 %" />
          <KpiTile icon="concord" tone="navy" label="Comparaisons réalisées" value={`${realisees} / ${COMPARAISONS_ATTENDUES}`} sub="Attendues : 4 antigènes × 3 ZS × 3 mois (dénominateur fixe)" />
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

/* ============ Page — Comparaison par structure (CS & ZS) ============ */
/* Maquette Dr Léandre (12/06/2026) : écart moyen, facteur de vérification et
   taux d'erreur PAR STRUCTURE, matrice comparative et structures prioritaires. */

type CmpStruct = CqdLevelBundle["comparaison"]["structures"][number];
const CMP_ANT: { label: string; key: "p1" | "p3" | "rr1" | "rr2"; color: string }[] = [
  { label: "PENTA1", key: "p1", color: C.navy },
  { label: "PENTA3", key: "p3", color: C.teal },
  { label: "RR1", key: "rr1", color: C.orange },
  { label: "RR2", key: "rr2", color: C.violet },
];

/** Barres horizontales EMPILÉES : écart moyen par structure et par antigène. */
function EcartStackBar({ rows }: { rows: CmpStruct[] }) {
  const ordered = [...rows].reverse();
  return (
    <EChart
      height={Math.max(170, rows.length * 34 + 50)}
      option={{
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, confine: true },
        legend: { top: 0, textStyle: { fontSize: 10 } },
        grid: { left: 4, right: 40, top: 26, bottom: 4, containLabel: true },
        xAxis: { type: "value", axisLabel: { fontSize: 10 }, splitLine: { lineStyle: { color: "#f1f5f9" } } },
        yAxis: { type: "category", data: ordered.map((r) => r.name), axisLabel: { fontSize: 10.5, width: 120, overflow: "truncate" }, axisTick: { show: false } },
        series: [
          ...CMP_ANT.map((a) => ({
            name: a.label, type: "bar" as const, stack: "ecart",
            itemStyle: { color: a.color },
            data: ordered.map((r) => r.ecart[a.key] ?? 0),
            label: { show: true, fontSize: 9, color: "#fff", formatter: (p: { value: number }) => (p.value > 0 ? String(p.value) : "") },
          })),
          {
            name: "Total", type: "bar" as const, stack: "ecart", itemStyle: { color: "transparent" },
            data: ordered.map((r) => 0.0001),
            label: {
              show: true, position: "right" as const, fontSize: 10, fontWeight: 700, color: "#334155",
              formatter: (p: { dataIndex: number }) => { const t = ordered[p.dataIndex]?.ecart.total; return t == null ? "" : String(t); },
            },
            tooltip: { show: false },
          },
        ],
      }}
    />
  );
}

/** Barres horizontales : facteur de vérification par structure et par antigène (seuils 95–105). */
function FvGroupedBar({ rows }: { rows: CmpStruct[] }) {
  const ordered = [...rows].reverse();
  return (
    <EChart
      height={Math.max(190, rows.length * 56 + 50)}
      option={{
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, confine: true, valueFormatter: (v: number | null) => (v == null ? "—" : `${v}%`) },
        legend: { top: 0, textStyle: { fontSize: 10 } },
        grid: { left: 4, right: 40, top: 26, bottom: 4, containLabel: true },
        xAxis: {
          type: "value", min: 0, axisLabel: { formatter: "{value}%", fontSize: 10 }, splitLine: { lineStyle: { color: "#f1f5f9" } },
        },
        yAxis: { type: "category", data: ordered.map((r) => r.name), axisLabel: { fontSize: 10.5, width: 120, overflow: "truncate" }, axisTick: { show: false } },
        series: CMP_ANT.map((a) => ({
          name: a.label, type: "bar" as const, barGap: "8%",
          itemStyle: { color: a.color },
          data: ordered.map((r) => r.fv[a.key]),
          label: { show: true, position: "right" as const, fontSize: 8.5, color: "#475569", formatter: (p: { value: number | null }) => (p.value == null ? "" : `${p.value}%`) },
        })),
      }}
    />
  );
}

/** Couleur heatmap d'une cellule « écart » (plus faible = meilleur). */
function ecartCellStyle(v: number | null, max: number): React.CSSProperties | undefined {
  if (v == null || !Number.isFinite(v)) return undefined;
  const ratio = max > 0 ? Math.min(1, v / max) : 0;
  return { background: `rgba(226,54,54,${(0.08 + ratio * 0.45).toFixed(2)})`, fontWeight: 700 };
}
/** Couleur d'une cellule « facteur de vérification » selon les seuils 95–105. */
function fvCellStyle(v: number | null): React.CSSProperties | undefined {
  if (v == null || !Number.isFinite(v)) return undefined;
  const t = TONES[apprConc(v).tone];
  return { background: t.bg, color: t.text, fontWeight: 700 };
}

function CqdComparaisonStructure({ level }: { level: "as" | "zs" }) {
  const { b, live } = useLevel(level);
  const cmp = b?.comparaison;
  const rows = cmp?.structures ?? [];
  const withData = rows.filter((r) => r.ecart.total !== null || r.fv.moyen !== null || r.erreur !== null);
  const pgMat = usePaged(withData, 30);
  const maxEcart = Math.max(1, ...rows.flatMap((r) => CMP_ANT.map((a) => r.ecart[a.key] ?? 0)));
  const labelStruct = level === "as" ? "Aire de santé" : "Zone de santé";
  const errRows: [string, number][] = withData
    .map((r) => [r.name, r.erreur ?? 0] as [string, number])
    .sort((a, c) => c[1] - a[1]);
  const fvG = cmp?.fvMoyenGlobal ?? null;
  const errG = cmp?.erreurMoyenneGlobale ?? null;
  const prioTones: Tone[] = ["red", "orange", "blue"];
  return (
    <div className="space-y-4">
      <Banner icon="rank" tone="navy" title="Contrôle qualité des données : comparaison par structure"
        sub={`Analyse comparative de l'écart moyen, du facteur de vérification et du taux d'erreur selon les structures supervisées · Référence : ${cmp?.reference ?? "—"} — outils comparés : ${cmp?.compares ?? "—"}`} />
      <section>
        <SectionBar icon="bars">Indicateurs clés</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="scale" tone="blue" label="Écart moyen global" value={cmp?.ecartMoyenGlobal ?? "—"}
            sub="Moyenne des écarts cumulés par structure · plus faible = meilleur" />
          <KpiTile icon="concord" tone="green" label="Facteur de vérification moyen" value={pctTxt(fvG)}
            sub={fvG == null ? "" : apprConc(fvG).label} />
          <KpiTile icon="erreurs" tone="orange" label="Taux d'erreur moyen" value={pctTxt(errG)}
            sub={errG == null ? "" : errAppr(errG).label} />
          <KpiTile icon={level === "as" ? "clinic" : "hospital"} tone="navy" label="Nombre de structures évaluées" value={b?.structuresControlees ?? "—"}
            sub={level === "as" ? "Aires de santé contrôlées" : "Zones de santé contrôlées"} />
        </div>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="card card-pad lg:col-span-5">
          <CardTitle icon="bars" tone="navy" title="Écart moyen par structure et par antigène" sub="Écart cumulé PENTA1 · PENTA3 · RR1 · RR2 — plus faible = meilleur" />
          {live && withData.length ? <EcartStackBar rows={withData} /> : <Empty />}
        </div>
        <div className="card card-pad lg:col-span-4">
          <CardTitle icon="concord" tone="green" title="Facteur de vérification par structure et par antigène" sub="95–105 % = bonne concordance" />
          {live && withData.length ? <FvGroupedBar rows={withData} /> : <Empty />}
        </div>
        <div className="card card-pad lg:col-span-3">
          <CardTitle icon="erreurs" tone="orange" title="Taux d'erreur par structure" sub="Plus faible = meilleur" />
          {live && errRows.length ? <ProtoHBar height={Math.max(170, errRows.length * 32 + 30)} byCot={false} color={C.orange} maxName={110} rows={errRows} /> : <Empty />}
        </div>
      </div>
      <div className="card card-pad">
        <CardTitle icon="table" tone="navy" title="Matrice comparative des indicateurs"
          sub="Plus faible = meilleur (écart, erreur) · 95 % – 105 % = bonne concordance (facteur de vérification)"
          right={<TableExportButtons filename="Matrice comparative des indicateurs par structure" />} />
        {withData.length ? (
          <>
          <div className="overflow-x-auto"><table className="dtable">
            <thead>
              <tr>
                <th rowSpan={2} className="name">{labelStruct}</th>
                <th colSpan={5}>Écart moyen</th>
                <th colSpan={5}>Facteur de vérification</th>
                <th rowSpan={2}>Taux d'erreur</th>
              </tr>
              <tr>
                <th>PENTA1</th><th>PENTA3</th><th>RR1</th><th>RR2</th><th>Total</th>
                <th>PENTA1</th><th>PENTA3</th><th>RR1</th><th>RR2</th><th>Moyen</th>
              </tr>
            </thead>
            <tbody>
              {pgMat.slice.map((r) => (
                <tr key={r.name}>
                  <td className="name">{r.name}</td>
                  {CMP_ANT.map((a) => <td key={`e${a.key}`} className="tabular-nums" style={ecartCellStyle(r.ecart[a.key], maxEcart)}>{r.ecart[a.key] ?? "—"}</td>)}
                  <td className="tabular-nums" style={{ ...ecartCellStyle(r.ecart.total, maxEcart * 4), fontWeight: 800 }}>{r.ecart.total ?? "—"}</td>
                  {CMP_ANT.map((a) => <td key={`f${a.key}`} className="tabular-nums" style={fvCellStyle(r.fv[a.key])}>{r.fv[a.key] == null ? "—" : `${r.fv[a.key]}%`}</td>)}
                  <td className="tabular-nums" style={{ ...fvCellStyle(r.fv.moyen), fontWeight: 800 }}>{r.fv.moyen == null ? "—" : `${r.fv.moyen}%`}</td>
                  <td className="tabular-nums" style={{ color: errAppr(r.erreur).color, fontWeight: 800 }}>{pctTxt(r.erreur)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <Pager page={pgMat.page} pageCount={pgMat.pageCount} setPage={pgMat.setPage} start={pgMat.start} end={pgMat.end} total={pgMat.total} />
          </>
        ) : <Empty />}
      </div>
      <div className="card card-pad">
        <CardTitle icon="alert" tone="red" title="Structures prioritaires" sub="Taux d'erreur et écart moyen les plus élevés — appui à prioriser" />
        {cmp?.prioritaires.length ? (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {cmp.prioritaires.map((name, i) => (
              <span key={name} className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12.5px] font-extrabold"
                style={{ background: TONES[prioTones[i] ?? "blue"].bg, borderColor: TONES[prioTones[i] ?? "blue"].border, color: TONES[prioTones[i] ?? "blue"].text }}>
                <span className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] text-white" style={{ background: TONES[prioTones[i] ?? "blue"].ico }}>{i + 1}</span>
                {name}
              </span>
            ))}
          </div>
        ) : <Empty msg="Aucune structure prioritaire identifiée pour cette sélection." />}
      </div>
      <div className="card card-pad flex items-start gap-3" style={{ background: TONES.blue.bg, borderColor: TONES.blue.border }}>
        <Badge icon="legend" tone="blue" size={30} />
        <div className="text-[12.5px] leading-relaxed text-surface-700">
          Cette page permet de comparer, par structure, les principaux indicateurs de contrôle qualité des données. La matrice
          comparative détaille l'écart moyen et le facteur de vérification par antigène (PENTA1, PENTA3, RR1 et RR2), tandis que
          le taux d'erreur est présenté comme un indicateur unique par structure.
        </div>
      </div>
    </div>
  );
}

export function CqdCsStructures() { return <CqdComparaisonStructure level="as" />; }
export function CqdZsStructures() { return <CqdComparaisonStructure level="zs" />; }

/* ============ Page — Comparaison doses disponibles & nombre de vaccinés ============ */
/* « Triangulation » DHIS2/SNIS (Tshuapa) reproduite du dashboard
   snis-vaccination-api : Dose disponible = Stock début + Reçues ; Écart = Dose
   disponible − Vaccinés. Niveau CS → par aire de santé ; niveau ZS → par zone
   de santé. Sans filtres/boutons internes : on réutilise les filtres de l'onglet
   et le design (TableExportButtons) de Supervision conjointe. */
const frNum = (n: number) => n.toLocaleString("fr-FR");

/** Cellule « Écart » : remplissage vert (≥ 0) ou rouge (négatif, doses
 *  insuffisantes), texte blanc pour une lecture immédiate. */
function EcartCell({ v }: { v: number }) {
  const neg = v < 0;
  return (
    <td className="tabular-nums" style={{ fontWeight: 700, textAlign: "center", background: neg ? C.red : C.green, color: "#fff" }}>
      {neg ? "" : "+"}{frNum(v)}
    </td>
  );
}

function TriangulationTable({ level }: { level: "as" | "zs" }) {
  const { data } = useTriangulation(level);
  const labelStruct = level === "as" ? "Aire de santé" : "Zone de santé";
  const rows = data?.rows ?? [];
  const ants = data?.antigenes ?? [];
  const monthsLabel = (data?.months ?? []).map(fmtMonth).join(" · ");
  const tone: Tone = level === "as" ? "teal" : "navy";
  // 30 lignes par page (feedback TL) — un tableau de triangulation peut compter
  // plus de 100 aires de santé.
  const pg = usePaged(rows, 30);
  return (
    <div className="space-y-4">
      <Banner icon="component" tone={tone}
        title={`Comparaison Doses des vaccins disponibles et Nombre de vaccinés${level === "as" ? " — par aire de santé" : " — par zone de santé"}`}
        sub={`Triangulation des données de vaccination et des doses de vaccins disponibles au cours du mois — DHIS2/SNIS Tshuapa${monthsLabel ? ` · ${monthsLabel}` : ""}`} />
      <div className="card card-pad" style={{ background: "#eaf4fd" }}>
        <div className="text-[12px] leading-relaxed text-surface-700">
          <b>Dose disponible</b> = Stock début + Reçues au cours du mois. <b>Écart négatif</b> (rouge) = doses insuffisantes.
          <b> Cohérence</b> : « Oui » si aucun antigène n'a un écart négatif (0 %), « Non » sinon.
        </div>
      </div>
      <div className="card card-pad">
        <CardTitle icon="table" tone={tone}
          title={`Triangulation données de vaccination et doses de vaccins disponibles${monthsLabel ? ` — ${monthsLabel}` : " au cours du mois"}`}
          sub={`Une ligne par ${level === "as" ? "aire de santé" : "zone de santé"} · Dose disponible · Vaccinés · Écart par antigène`}
          right={<TableExportButtons filename={`Triangulation doses disponibles et vaccinés (${labelStruct})`} />} />
        {rows.length && ants.length ? (
          <>
          <div className="overflow-x-auto"><table className="dtable">
            <thead>
              <tr>
                <th rowSpan={2} className="name">{labelStruct}</th>
                {ants.map((a) => <th key={a} colSpan={3} style={{ textAlign: "center" }}>{a}</th>)}
                <th rowSpan={2}>Proportion<br />écarts négatifs</th>
                <th rowSpan={2}>Cohérence<br />vaccinés-doses</th>
              </tr>
              <tr>
                {ants.map((a) => (
                  <Fragment key={`${a}-h`}>
                    <th style={{ minWidth: 64, whiteSpace: "normal", wordBreak: "break-word" }}>Dose disponible</th>
                    <th style={{ minWidth: 56, whiteSpace: "normal", wordBreak: "break-word" }}>Vaccinés</th>
                    <th style={{ minWidth: 52, whiteSpace: "normal", wordBreak: "break-word" }}>Écart</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {pg.slice.map((r) => (
                <tr key={r.name}>
                  <td className="name">{r.name}</td>
                  {r.antigenes.map((ant) => (
                    <Fragment key={ant.label}>
                      <td className="tabular-nums">{frNum(ant.dispo)}</td>
                      <td className="tabular-nums">{frNum(ant.vaccines)}</td>
                      <EcartCell v={ant.ecart} />
                    </Fragment>
                  ))}
                  <td className="tabular-nums" style={{ fontWeight: 700, color: r.propNeg > 0 ? C.red : C.green }}>{r.propNeg}%</td>
                  <td style={{ fontWeight: 800, textAlign: "center", background: r.coherence ? "#e6f6ec" : "#fde2e2", color: r.coherence ? "#178a44" : "#c81e1e" }}>
                    {r.coherence ? "Oui ✓" : "Non ✗"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <Pager page={pg.page} pageCount={pg.pageCount} setPage={pg.setPage} start={pg.start} end={pg.end} total={pg.total} />
          </>
        ) : <Empty msg={data?.error ? `Données DHIS2 indisponibles : ${data.error}` : "Aucune donnée disponible pour cette sélection."} />}
      </div>
    </div>
  );
}

export function CqdCsTriangulation() { return <TriangulationTable level="as" />; }
export function CqdZsTriangulation() { return <TriangulationTable level="zs" />; }

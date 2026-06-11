"use client";

/* =========================================================================
   etatlieux.tsx — Onglet « État de lieux Tshuapa »
   3 pages : Informations générales · Accessibilité/stratégies/engagement · Ressources
   Données réelles : Excel « Final base état de lieu Tshuapa » (data/edl-data.ts),
   filtrées par la sélection Province / Antenne / ZS / Aire (lib/etat-lieux/edl-filter).
   ========================================================================= */
import { useTabFilters } from "@/lib/state/filters";
import { filterEdl } from "@/lib/etat-lieux/edl-filter";
import type { EdlZsPop, EdlData } from "@/data/edl-data";
import { SectionBar } from "@/components/ui/Card";
import { C, TONES, cotColor, fmt, KpiTile, CardTitle, Badge, StatTile, Banner, type Tone } from "./proto";
import { ProtoGroupedBar, ProtoHBar } from "./charts";
import { TableExportButtons } from "@/components/ui/TableExport";

const sortZS = (arr: EdlZsPop[]) => arr.slice().sort((a, b) => a.zs.localeCompare(b.zs));
/** Parse un nombre éventuellement stocké en texte (« 140 », « 12,5 »). */
const dn = (v?: string | null): number | null => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const sumN = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Bandeau affiché lorsque la sélection ne renvoie aucune donnée. */
function NoData() {
  return (
    <div className="card card-pad flex items-center gap-3" style={{ background: TONES.orange.bg, borderColor: TONES.orange.border }}>
      <Badge icon="alert" tone="orange" size={32} />
      <div className="text-[12px] text-surface-700">Aucune donnée « État de lieux » pour cette sélection de filtres. Réinitialisez ou élargissez les filtres.</div>
    </div>
  );
}

function useEdl(): EdlData {
  const f = useTabFilters("etat");
  return filterEdl({ province: f.province, antenne: f.antenne, zone: f.zone, aire: f.aire });
}

/* ---------------- Informations générales ---------------- */
export function Edl1() {
  const E = useEdl();
  const st = E.structure, pt = E.popTotals;
  const ecart = pt.enf0_11_ajuste - pt.enf0_11_micro;
  const zss = sortZS(E.zsPop);
  if (!zss.length) return <div className="space-y-4"><Banner icon="map" tone="navy" title="Informations générales — Province de la Tshuapa" sub="Sélection filtrée" /><NoData /></div>;

  // Top 50 aires de santé par poids démographique (0–11 mois ajustée).
  const topAs = E.asPop.slice().sort((a, b) => b.cAj - a.cAj).slice(0, 50);

  // Niveaux de priorité + nombre de visites attendues / mois (auto-calcul) :
  // très haute = quotidien (≈30), haute = 4×, moyenne = 2×, faible = 1×.
  const prio = zss.map((z) => {
    const il = E.infoZS.find((i) => i.zs.toUpperCase().startsWith(z.zs.toUpperCase().slice(0, 4))) ?? ({} as Partial<typeof E.infoZS[0]>);
    const th = il.ilots ?? 0, ha = il.campPech ?? 0, mo = il.campElev ?? 0, fa = Math.max(0, (z.nAS || 0) - 1);
    return { zs: z.zs, th, ha, mo, fa, visites: th * 30 + ha * 4 + mo * 2 + fa * 1 };
  });
  const topPrio = prio.slice().sort((a, b) => (b.th + b.ha) - (a.th + a.ha)).slice(0, 6);

  return (
    <div className="space-y-4">
      <Banner icon="map" tone="navy" title="Informations générales — Province de la Tshuapa"
        sub={`${st.antennes} antenne(s) · ${st.zs} zones de santé · ${st.as} aires de santé`} />

      <section>
        <SectionBar icon="home">Structures sanitaires</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiTile icon="tower" tone="navy" label="Antennes" value={st.antennes} />
          <KpiTile icon="hospital" tone="violet" label="Zones de santé" value={st.zs} />
          <KpiTile icon="clinic" tone="green" label="Aires de santé" value={st.as} />
          <KpiTile icon="home" tone="blue" label="Total ESS" value={fmt(st.essTotal)} />
          <KpiTile icon="syringe" tone="orange" label="ESS qui vaccinent" value={fmt(st.essVac)} sub={st.essTotal ? `${Math.round(st.essVac / st.essTotal * 100)}% des ESS` : undefined} />
        </div>
      </section>

      <section>
        <SectionBar icon="pop">Population cible</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiTile icon="pop" tone="navy" label={<>Population totale<br />(administrative)</>} value={fmt(pt.snis)} />
          <KpiTile icon="pop" tone="teal" label={<>Population totale<br />(ajustée)</>} value={fmt(pt.ajuste)} />
          <KpiTile icon="child" tone="violet" label={<>Enfants 0–11 mois<br />(administrative)</>} value={fmt(pt.enf0_11_micro)} />
          <KpiTile icon="child" tone="green" label={<>Enfants 0–11 mois<br />(ajustée)</>} value={fmt(pt.enf0_11_ajuste)} />
          <KpiTile icon="scale" tone={ecart >= 0 ? "orange" : "red"} label={<>Écart cible 0–11 mois<br />admin. vs ajustée</>} value={(ecart >= 0 ? "+" : "") + fmt(ecart)} />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card card-pad">
          <CardTitle icon="child" tone="violet" title="Population cible 0–11 mois par ZS" sub="Administrative (microplan) vs ajustée" />
          <ProtoGroupedBar height={260} rotateLabels colors={[C.violet, C.green]} cats={zss.map((z) => z.zs)} series={[
            { name: "0–11 mois admin.", data: zss.map((z) => z.cMicro) },
            { name: "0–11 mois ajustée", data: zss.map((z) => z.cAj) },
          ]} />
        </div>
        <div className="card card-pad">
          <CardTitle icon="syringe" tone="green" title="% des ESS qui vaccinent par ZS" sub="Total possible par zone de santé" />
          <ProtoHBar height={260} maxName={90} rows={zss.map((z) => [z.zs, z.pctVac])} />
        </div>
      </div>

      <section>
        <SectionBar icon="bars" right={<TableExportButtons variant="bar" filename="Population cible administrative et ajustée par aire de santé" />}>Population cible administrative & ajustée — par aire de santé</SectionBar>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="card card-pad lg:col-span-2">
            <div className="mb-2 text-[11px] text-surface-500">{E.asPop.length} aires de santé · tableau défilable · écart = ajustée − administrative</div>
            <div className="overflow-auto" style={{ maxHeight: 330 }}>
              <table className="dtable">
                <thead><tr><th className="name">Aire de santé</th><th className="name">Zone de santé</th><th>Pop. admin.</th><th>Pop. ajustée</th><th>0–11 mois (micro)</th><th>0–11 mois (ajustée)</th><th>Écart 0–11</th></tr></thead>
                <tbody>
                  {E.asPop.map((a, i) => {
                    const ec = a.cAj - a.cMicro;
                    return <tr key={i}><td className="name">{a.as}</td><td className="name">{a.zs}</td><td>{fmt(a.popSnis)}</td><td>{fmt(a.popAj)}</td><td>{fmt(a.cMicro)}</td><td>{fmt(a.cAj)}</td><td style={{ color: ec >= 0 ? C.orange : C.red, fontWeight: 700 }}>{(ec >= 0 ? "+" : "") + fmt(ec)}</td></tr>;
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card card-pad">
            <CardTitle icon="child" tone="green" title="Top 50 aires de santé" sub="Plus grand poids démographique (0–11 mois ajustée)" right={<TableExportButtons filename="Top 50 aires de santé" />} />
            <div className="overflow-auto" style={{ maxHeight: 300 }}>
              <table className="dtable">
                <thead><tr><th>#</th><th className="name">Aire de santé</th><th className="name">ZS</th><th>0–11 (ajustée)</th></tr></thead>
                <tbody>
                  {topAs.map((a, i) => (
                    <tr key={i}><td style={{ fontWeight: 700, color: C.navy }}>{i + 1}</td><td className="name">{a.as}</td><td className="name">{a.zs}</td><td style={{ color: C.green, fontWeight: 700 }}>{fmt(a.cAj)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section>
        <SectionBar icon="alert" right={<TableExportButtons variant="bar" filename="Sites par niveau de priorité par zone de santé" />}>Sites par niveau de priorité (risque) — par zone de santé</SectionBar>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="card card-pad lg:col-span-2">
            <table className="dtable">
              <thead><tr><th className="name">Zone de santé</th><th>Très haute priorité</th><th>Haute priorité</th><th>Moyenne priorité</th><th>Faible priorité</th><th>Visites/mois attendues</th></tr></thead>
              <tbody>
                {prio.map((p) => (
                  <tr key={p.zs}>
                    <td className="name">{p.zs}</td>
                    <td style={{ background: TONES.red.bg, color: C.red, fontWeight: 700 }}>{p.th}</td>
                    <td style={{ background: TONES.orange.bg, color: C.orange, fontWeight: 700 }}>{p.ha}</td>
                    <td style={{ background: TONES.blue.bg, color: C.blue, fontWeight: 700 }}>{p.mo}</td>
                    <td style={{ background: TONES.green.bg, color: C.green, fontWeight: 700 }}>{p.fa}</td>
                    <td style={{ background: TONES.navy.bg, color: C.navy, fontWeight: 800 }}>{fmt(p.visites)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 text-[11px] text-surface-500">Visites/mois = très haute×30 (quotidien) + haute×4 + moyenne×2 + faible×1. Niveaux estimés à partir des îlots, campements de pêcheurs et d'éleveurs recensés par ZS.</div>
          </div>
          <div className="card card-pad">
            <CardTitle icon="alert" tone="red" title="Top 6 ZS avec plus de sites à très haute et haute priorité" sub="Sites très haute + haute priorité" right={<TableExportButtons filename="Top 6 ZS avec plus de sites à très haute et haute priorité" />} />
            <table className="dtable">
              <thead><tr><th>#</th><th className="name">Zone de santé</th><th>Sites prioritaires</th></tr></thead>
              <tbody>
                {topPrio.map((p, i) => (
                  <tr key={p.zs}><td style={{ fontWeight: 700, color: C.navy }}>{i + 1}</td><td className="name">{p.zs}</td><td style={{ color: C.red, fontWeight: 700 }}>{fmt(p.th + p.ha)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------------- Accessibilité, stratégies & engagement communautaire ---------------- */
function CondCell({ v = "", kind }: { v?: string; kind?: "reseau" }) {
  const n = parseFloat(("" + v).replace(",", ".")) || 0;
  let tone: Tone = n >= 100 ? "red" : n >= 50 ? "orange" : "green";
  if (kind === "reseau") tone = ("" + v).toLowerCase().startsWith("o") ? "green" : "red";
  const t = TONES[tone];
  return <td style={{ background: t.bg, color: t.text, fontWeight: 700 }}>{v || "—"}</td>;
}

export function Edl2() {
  const E = useEdl();
  const zss = sortZS(E.zsPop);
  if (!zss.length) return <div className="space-y-4"><Banner icon="road" tone="orange" title="Accessibilité, stratégie de vaccination et engagement communautaire" sub="Sélection filtrée" /><NoData /></div>;

  // --- Stratégies planifiées (microplan) : agrégats par ZS + comparaison ACD ---
  const stratRows = zss.map((z) => ({ zs: z.zs, fix: z.sFix, av: z.sAv, mob: z.sMob, spe: z.sSpe, tot: z.sFix + z.sAv + z.sMob + z.sSpe, attendu: z.attendu }));
  const totPlan = sumN(stratRows.map((r) => r.tot));
  // Top 50 aires de santé par écart positif (planifié − attendu ACD).
  const topGapAs = E.asPop
    .map((a) => ({ as: a.as, zs: a.zs, plan: a.sFix + a.sAv + a.sMob + a.sSpe, attendu: a.attendu, ecart: a.sFix + a.sAv + a.sMob + a.sSpe - a.attendu }))
    .filter((a) => a.ecart > 0)
    .sort((a, b) => b.ecart - a.ecart)
    .slice(0, 50);

  // --- Accessibilité par ZS (depuis les aires de santé) ---
  const zsList = Array.from(new Set(E.asPop.map((a) => a.zs)));
  const acc = zsList.map((zs) => {
    const as = E.asPop.filter((a) => a.zs === zs);
    const far = as.filter((a) => { const d = dn(a.distBCZ); return d !== null && d > 50; }).length;
    const vil20 = as.filter((a) => { const d = dn(a.distVil); return d !== null && d > 20; }).length;
    return { zs, tot: as.length, far, pctFar: as.length ? Math.round(far / as.length * 100) : 0, vil20 };
  }).sort((a, b) => a.zs.localeCompare(b.zs));
  const topVil20 = acc.slice().filter((a) => a.vil20 > 0).sort((a, b) => b.vil20 - a.vil20).slice(0, 5);

  // --- Spécificités géographiques : top 6 ZS îlots/campements ---
  const sum = (f: (z: typeof E.infoZS[0]) => number) => E.infoZS.reduce((s, z) => s + f(z), 0);
  const topDisp = E.infoZS
    .map((z) => ({ zs: z.zs, n: (z.ilots || 0) + (z.campPech || 0) + (z.campElev || 0) + (z.campMin || 0) }))
    .filter((z) => z.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 6);

  return (
    <div className="space-y-4">
      <Banner icon="road" tone="orange" title="Accessibilité, stratégie de vaccination et engagement communautaire"
        sub="Accessibilité, microplanification et mobilisation communautaire" />

      {/* 1) Stratégies de vaccination planifiées — placées en tête de l'onglet */}
      <section>
        <SectionBar icon="flag">Sessions de vaccination planifiées</SectionBar>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="card card-pad lg:col-span-2">
            <CardTitle icon="flag" tone="navy" title="Planification sessions de vaccination par zone de santé" sub="Somme par type de stratégie" right={<TableExportButtons filename="Planification sessions de vaccination par zone de santé" />} />
            <div className="overflow-auto" style={{ maxHeight: 300 }}>
              <table className="dtable">
                <thead><tr><th className="name">Zone de santé</th><th>Fixes</th><th>Avancées</th><th>Mobiles</th><th>Spéciales</th><th>Total planifié</th></tr></thead>
                <tbody>
                  {stratRows.map((r) => (
                    <tr key={r.zs}><td className="name">{r.zs}</td><td>{fmt(r.fix)}</td><td>{fmt(r.av)}</td><td>{fmt(r.mob)}</td><td>{fmt(r.spe)}</td><td style={{ color: C.navy, fontWeight: 800 }}>{fmt(r.tot)}</td></tr>
                  ))}
                </tbody>
                <tfoot><tr><td className="name">Total province</td><td>{fmt(sumN(stratRows.map((r) => r.fix)))}</td><td>{fmt(sumN(stratRows.map((r) => r.av)))}</td><td>{fmt(sumN(stratRows.map((r) => r.mob)))}</td><td>{fmt(sumN(stratRows.map((r) => r.spe)))}</td><td>{fmt(totPlan)}</td></tr></tfoot>
              </table>
            </div>
          </div>
          <div className="card card-pad">
            <CardTitle icon="scale" tone="orange" title="Ratio stratégie fixe et nombre des ESS qui vaccinent" sub="Sessions fixes planifiées rapportées aux ESS qui vaccinent"
              right={<TableExportButtons filename="Ratio stratégie fixe et nombre des ESS qui vaccinent" />} />
            <div className="overflow-auto" style={{ maxHeight: 300 }}>
              <table className="dtable">
                <thead><tr><th className="name">Zone de santé</th><th>Sessions fixes planifiées</th><th>Nbr ESS qui vaccinent</th><th>Ratio fixe / ESS qui vacc.</th></tr></thead>
                <tbody>
                  {zss.map((z) => {
                    const ratio = z.essVac > 0 ? Math.round((z.sFix / z.essVac) * 10) / 10 : null;
                    return (
                      <tr key={z.zs}>
                        <td className="name">{z.zs}</td>
                        <td>{fmt(z.sFix)}</td>
                        <td>{fmt(z.essVac)}</td>
                        <td style={{ color: C.navy, fontWeight: 800 }}>{ratio === null ? "—" : ratio.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot><tr>
                  <td className="name">Total province</td>
                  <td>{fmt(sumN(zss.map((z) => z.sFix)))}</td>
                  <td>{fmt(sumN(zss.map((z) => z.essVac)))}</td>
                  <td>{(() => { const ev = sumN(zss.map((z) => z.essVac)); const fx = sumN(zss.map((z) => z.sFix)); return ev > 0 ? (Math.round((fx / ev) * 10) / 10).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "—"; })()}</td>
                </tr></tfoot>
              </table>
            </div>
          </div>
        </div>
        <div className="card card-pad mt-3">
          <CardTitle icon="bars" tone="navy" title="Stratégies par zone de santé" sub="Fixes · Avancées · Mobiles · Spéciales" />
          <ProtoGroupedBar height={250} rotateLabels cats={zss.map((z) => z.zs)} series={[
            { name: "Fixes", data: zss.map((z) => z.sFix) },
            { name: "Avancées", data: zss.map((z) => z.sAv) },
            { name: "Mobiles", data: zss.map((z) => z.sMob) },
            { name: "Spéciales", data: zss.map((z) => z.sSpe) },
          ]} />
        </div>
        <div className="card card-pad mt-3">
          <CardTitle icon="clinic" tone="green" title="Top 50 des aires de santé avec grand écart" sub="Stratégies planifiées − attendu (ACD)" right={<TableExportButtons filename="Top 50 des aires de santé avec grand écart" />} />
          <div className="overflow-auto" style={{ maxHeight: 280 }}>
            <table className="dtable">
              <thead><tr><th>#</th><th className="name">Aire de santé</th><th className="name">ZS</th><th>Planifié</th><th>Attendu ACD</th><th>Écart</th></tr></thead>
              <tbody>
                {topGapAs.length ? topGapAs.map((a, i) => (
                  <tr key={i}><td style={{ fontWeight: 700, color: C.navy }}>{i + 1}</td><td className="name">{a.as}</td><td className="name">{a.zs}</td><td>{fmt(a.plan)}</td><td>{fmt(a.attendu)}</td><td style={{ color: C.orange, fontWeight: 700 }}>{"+" + fmt(a.ecart)}</td></tr>
                )) : <tr><td colSpan={6} className="name" style={{ color: "#94a3b8" }}>Aucun écart positif pour cette sélection.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 2) Accessibilité — distances & réseau */}
      <section>
        <SectionBar icon="road" right={<TableExportButtons variant="bar" filename="Accessibilité distances et réseau par aire de santé" />}>Accessibilité — distances & réseau par aire de santé</SectionBar>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="card card-pad lg:col-span-2">
            <div className="mb-2 text-[11px] text-surface-500">Mise en forme conditionnée : vert &lt; 50 km · orange 50–99 km · rouge ≥ 100 km. Tableau défilable.</div>
            <div className="overflow-auto" style={{ maxHeight: 300 }}>
              <table className="dtable">
                <thead><tr><th className="name">Aire de santé</th><th className="name">Zone de santé</th><th>Distance AS–BCZ (km)</th><th>Distance dernier village et CS (km)</th><th>Voie d'accès</th><th>Réseau</th></tr></thead>
                <tbody>
                  {E.asPop.map((a, i) => (
                    <tr key={i}><td className="name">{a.as}</td><td className="name">{a.zs}</td><CondCell v={a.distBCZ} /><CondCell v={a.distVil} /><td>{a.voie || "—"}</td><CondCell v={a.reseau} kind="reseau" /></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card card-pad flex flex-col gap-3">
            <StatTile icon="pin" tone="red" label="Nombre d'AS avec dernier village > 20 km" big={fmt(sumN(acc.map((a) => a.vil20)))} sub="Total de la sélection" />
            <div>
              <CardTitle icon="road" tone="orange" title="% des AS à plus de 50 km par ZS" sub="Distance AS → BCZ" right={<TableExportButtons filename="% des AS à plus de 50 km par ZS" />} />
              <div className="overflow-auto" style={{ maxHeight: 150 }}>
                <table className="dtable">
                  <thead><tr><th className="name">Zone de santé</th><th>AS &gt; 50 km</th><th>%</th></tr></thead>
                  <tbody>
                    {acc.map((a) => (
                      <tr key={a.zs}><td className="name">{a.zs}</td><td>{fmt(a.far)}/{fmt(a.tot)}</td><td style={{ color: cotColor(100 - a.pctFar), fontWeight: 700 }}>{a.pctFar}%</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <CardTitle icon="map" tone="red" title="Top 5 ZS avec plus d'AS avec dernier village &gt; 20 km" sub="Nombre d'AS concernées" right={<TableExportButtons filename="Top 5 ZS avec plus d'AS avec dernier village sup 20 km" />} />
              <table className="dtable">
                <thead><tr><th>#</th><th className="name">Zone de santé</th><th>AS &gt; 20 km</th></tr></thead>
                <tbody>
                  {topVil20.length ? topVil20.map((a, i) => (
                    <tr key={a.zs}><td style={{ fontWeight: 700, color: C.navy }}>{i + 1}</td><td className="name">{a.zs}</td><td style={{ color: C.red, fontWeight: 700 }}>{fmt(a.vil20)}</td></tr>
                  )) : <tr><td colSpan={3} className="name" style={{ color: "#94a3b8" }}>—</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* 3) Spécificités géographiques */}
      <section>
        <SectionBar icon="map" right={<TableExportButtons variant="bar" filename="Spécificités géographiques et populations dispersées par ZS" />}>Spécificités géographiques & populations dispersées — par ZS</SectionBar>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="card card-pad lg:col-span-2">
            <table className="dtable">
              <thead><tr><th className="name">Zone de santé</th><th>Îlots</th><th>Campements pêcheurs</th><th>Campements éleveurs</th><th>Camps déplacés internes</th></tr></thead>
              <tbody>
                {E.infoZS.map((z) => (
                  <tr key={z.zs}><td className="name">{z.zs}</td><td>{fmt(z.ilots)}</td><td>{fmt(z.campPech)}</td><td>{fmt(z.campElev)}</td><td>{fmt(z.campsDepl)}</td></tr>
                ))}
              </tbody>
              <tfoot><tr><td className="name">Total province</td><td>{fmt(sum((z) => z.ilots))}</td><td>{fmt(sum((z) => z.campPech))}</td><td>{fmt(sum((z) => z.campElev))}</td><td>{fmt(sum((z) => z.campsDepl))}</td></tr></tfoot>
            </table>
          </div>
          <div className="card card-pad">
            <CardTitle icon="map" tone="violet" title="Top 6 ZS — îlots & campements" sub="Total îlots + campements (pêcheurs, éleveurs, miniers)" right={<TableExportButtons filename="Top 6 ZS — îlots & campements" />} />
            <table className="dtable">
              <thead><tr><th>#</th><th className="name">Zone de santé</th><th>Total</th></tr></thead>
              <tbody>
                {topDisp.length ? topDisp.map((z, i) => (
                  <tr key={z.zs}><td style={{ fontWeight: 700, color: C.navy }}>{i + 1}</td><td className="name">{z.zs}</td><td style={{ color: C.violet, fontWeight: 700 }}>{fmt(z.n)}</td></tr>
                )) : <tr><td colSpan={3} className="name" style={{ color: "#94a3b8" }}>—</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 4) Participation communautaire & points d'entrée — côte à côte */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card card-pad">
          <CardTitle icon="people" tone="green" title="Participation communautaire — CAC & RECO" sub="Cellules d'animation communautaire par ZS" right={<TableExportButtons filename="Participation communautaire — CAC & RECO" />} />
          <div className="overflow-auto" style={{ maxHeight: 300 }}>
            <table className="dtable">
              <thead><tr><th className="name">Zone de santé</th><th>Villages</th><th>CAC prévus</th><th>CAC actifs</th><th>Proportion de CAC actifs</th></tr></thead>
              <tbody>
                {E.infoZS.map((z) => {
                  const prop = z.cac > 0 ? Math.round((z.cacFonc / z.cac) * 100) : null;
                  const col = prop === null ? "#94a3b8" : prop >= 80 ? C.green : prop >= 50 ? C.orange : C.red;
                  return (
                    <tr key={z.zs}><td className="name">{z.zs}</td><td>{fmt(z.villages)}</td><td>{fmt(z.cac)}</td><td style={{ color: C.green, fontWeight: 700 }}>{fmt(z.cacFonc)}</td><td style={{ background: `${col}22`, color: col, fontWeight: 800 }}>{prop === null ? "—" : `${prop}%`}</td></tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card card-pad">
          <CardTitle icon="home" tone="navy" title="Points d'entrée communautaires & localités résistantes" sub="Par zone de santé" right={<TableExportButtons filename="Points d'entrée communautaires & localités résistantes" />} />
          <div className="overflow-auto" style={{ maxHeight: 300 }}>
            <table className="dtable">
              <thead><tr><th className="name">Zone de santé</th><th>Marchés</th><th>Églises</th><th>Éc. mat.</th><th>Éc. prim.</th><th>Éc. sec.</th><th>Localités résistantes</th></tr></thead>
              <tbody>
                {E.infoZS.map((z) => {
                  // Certaines lignes contiennent un nom de localité au lieu d'un
                  // décompte : on affiche alors le nombre (1) et le nom en info-bulle.
                  const raw = ("" + (z.refractaires ?? "")).trim();
                  const parsed = dn(raw);
                  const count = parsed !== null ? parsed : raw ? 1 : 0;
                  const title = parsed === null && raw ? `Localité résistante : ${raw}` : undefined;
                  return (
                    <tr key={z.zs}><td className="name">{z.zs}</td><td>{fmt(z.marches)}</td><td>{fmt(z.eglises)}</td><td>{fmt(z.ecoleMat)}</td><td>{fmt(z.ecolePrim)}</td><td>{fmt(z.ecoleSec)}</td><td style={{ color: C.red, fontWeight: 700 }} title={title}>{fmt(count)}</td></tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Ressources humaines, matérielles & financières ---------------- */
export function Edl3() {
  const E = useEdl();
  const cold = E.cold.slice().sort((a, b) => a.zs.localeCompare(b.zs));
  // Proportion des réfrigérateurs FONCTIONNELS : fonctionnels / total recensés
  // (équipements coldAS), et non % d'AS équipées (feedback TL p.3).
  const frigoStats = (zs: string) => {
    const eq = E.coldAS.filter((a) => a.zs === zs);
    const fonc = eq.filter((a) => ("" + a.etat).toUpperCase().startsWith("F")).length;
    return { total: eq.length, fonc, prop: eq.length ? Math.round((fonc / eq.length) * 100) : null };
  };
  const energie: Record<string, number> = {};
  E.coldAS.forEach((a) => { const k = (a.energie || "Non précisé").trim() || "Non précisé"; energie[k] = (energie[k] || 0) + 1; });
  const energieRows = Object.entries(energie).sort((a, b) => b[1] - a[1]);
  const etatF = E.coldAS.filter((a) => ("" + a.etat).toUpperCase().startsWith("F")).length;
  const totNAS = cold.reduce((s, c) => s + c.nAS, 0);

  if (!cold.length) return <div className="space-y-4"><Banner icon="fridge" tone="teal" title="Ressources humaines, matérielles & financières" sub="Sélection filtrée" /><NoData /></div>;

  return (
    <div className="space-y-4">
      <Banner icon="fridge" tone="teal" title="Ressources humaines, matérielles & financières"
        sub="Chaîne de froid, logistique et partenaires technico-financiers" />

      <section>
        <SectionBar icon="fridge" right={<TableExportButtons variant="bar" filename="Chaîne de froid synthèse par zone de santé" />}>Chaîne de froid — synthèse par zone de santé</SectionBar>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="card card-pad">
            <div className="overflow-auto" style={{ maxHeight: 300 }}>
              <table className="dtable">
                <thead><tr><th className="name">Zone de santé</th><th>Nbr AS</th><th>Réfrigérateurs recensés</th><th>Réfrigérateurs fonctionnels</th><th>Proportion des réfrigérateurs fonctionnels</th></tr></thead>
                <tbody>
                  {cold.map((c) => { const f = frigoStats(c.zs); return (
                    <tr key={c.zs}><td className="name">{c.zs}</td><td>{c.nAS}</td><td>{f.total || "—"}</td><td style={{ color: C.teal, fontWeight: 700 }}>{f.total ? f.fonc : "—"}</td><td style={{ background: f.prop === null ? undefined : cotColor(f.prop) + "22", fontWeight: 800 }}>{f.prop === null ? "—" : `${f.prop}%`}</td></tr>
                  ); })}
                </tbody>
                <tfoot><tr><td className="name">Total province</td><td>{totNAS}</td><td>{E.coldAS.length}</td><td>{etatF}</td><td>{E.coldAS.length ? Math.round(etatF / E.coldAS.length * 100) : 0}%</td></tr></tfoot>
              </table>
            </div>
          </div>
          <div className="card card-pad">
            <CardTitle icon="fridge" tone="teal" title="Proportion des réfrigérateurs fonctionnels" sub="Réfrigérateurs fonctionnels / réfrigérateurs totaux, par ZS" />
            <ProtoHBar height={250} maxName={90} rows={cold.map((c) => { const f = frigoStats(c.zs); return [c.zs, f.prop ?? 0]; })} />
          </div>
        </div>
      </section>

      <section>
        <SectionBar icon="syringe">Source d'énergie des équipements de chaîne de froid</SectionBar>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="card card-pad lg:col-span-1 flex flex-col justify-center gap-3">
            <StatTile icon="fridge" tone="navy" label="Équipements recensés" big={fmt(E.coldAS.length)} />
            <StatTile icon="check" tone="green" label="Fonctionnels (état F)" big={fmt(etatF)} />
          </div>
          <div className="card card-pad lg:col-span-2">
            <CardTitle icon="syringe" tone="orange" title="Répartition par source d'énergie" sub="Nombre d'équipements" />
            <ProtoGroupedBar height={200} colors={[C.orange]} cats={energieRows.map((e) => e[0])} series={[{ name: "Équipements", data: energieRows.map((e) => e[1]) }]} />
          </div>
        </div>
      </section>

      <section>
        <SectionBar icon="hands" right={<TableExportButtons variant="bar" filename="Partenaires technico-financiers par ZS" />}>Partenaires technico-financiers — domaines d'intervention par ZS</SectionBar>
        <div className="card card-pad">
          <div className="overflow-auto" style={{ maxHeight: 360 }}>
            <table className="dtable" style={{ fontSize: 10 }}>
              <thead><tr>
                <th className="name" style={{ position: "sticky", left: 0, background: "#f1f5f9", zIndex: 2 }}>Zone de santé</th>
                {E.partnerCols.map((p) => <th key={p} style={{ minWidth: 78 }}>{p === "GAVI" ? "CAGF" : p}</th>)}
              </tr></thead>
              <tbody>
                {E.partners.map((pr) => (
                  <tr key={pr.zs}>
                    <td className="name" style={{ position: "sticky", left: 0, background: "#fff", zIndex: 1 }}>{pr.zs}</td>
                    {pr.vals.map((v, i) => {
                      const ras = !v || v.toUpperCase() === "RAS";
                      return <td key={i} style={ras ? { color: "#cbd5e1", textAlign: "left", maxWidth: 120 } : { background: TONES.teal.bg, color: TONES.teal.text, fontWeight: 600, textAlign: "left", maxWidth: 120 }}>{ras ? "—" : v}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-[11px] text-surface-500">Partenaires : OMS, CAGF, UNICEF, CDC, Fonds Mondial, Banque Mondiale, SANRU, CDI Bwamanda, CORDAID, Croix Rouge… · « — » = pas d'intervention recensée.</div>
        </div>
      </section>

      <div className="card card-pad flex items-center gap-3" style={{ background: TONES.orange.bg, borderColor: TONES.orange.border }}>
        <Badge icon="alert" tone="orange" size={32} />
        <div className="text-[11.5px] text-surface-700">
          <b>Ressources humaines</b> (infirmiers, formés PEV/surveillance) et <b>logistique moto</b> : champs présents dans le formulaire KOBO « État de lieux » mais non renseignés dans la base Excel actuelle — à brancher dès synchronisation.
        </div>
      </div>
    </div>
  );
}

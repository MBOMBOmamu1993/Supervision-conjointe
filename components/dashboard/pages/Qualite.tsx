"use client";

/* Onglet « Qualité des données » — Centres de santé (5 pages) + Zones de santé
   (3 pages). Données LIVE via /api/cqd (hook useCqd) ; réagissent aux filtres.
   Antigènes : PENTA1 · PENTA3 · RR1 · RR2 — sources Pointage · Registre · SNIS · DHIS2. */
import { useCqd } from "@/lib/client/cqd-api";
import type { CqdBundle, CqdLevelBundle, ConcordanceClass } from "@/lib/cqd/types";
import { SectionBar } from "@/components/ui/Card";
import { KpiTile, CardTitle, Banner, C, ApprBadge } from "@/components/proto/proto";
import { ProtoGroupedBar, ProtoHBar } from "@/components/proto/charts";
import Donut from "@/components/charts/Donut";

/* --------------------------- helpers --------------------------- */
const round = (n: number) => Math.round(n * 10) / 10;
const avg = (xs: (number | null)[]): number | null => {
  const v = xs.filter((x): x is number => x !== null && Number.isFinite(x));
  return v.length ? round(v.reduce((a, b) => a + b, 0) / v.length) : null;
};
const pctTxt = (v: number | null) => (v == null ? "—" : `${v}%`);
const concClass = (c: ConcordanceClass) => (c === "sous" ? "Sous-rapportage" : c === "sur" ? "Sur-rapportage" : c === "normal" ? "Pas de discordance" : "—");
const ecart = (a: { registre: number; pointage: number; snis: number; dhis2: number }) => {
  const xs = [a.registre, a.pointage, a.snis, a.dhis2].filter((x) => x > 0);
  if (xs.length < 2) return null;
  const mx = Math.max(...xs), mn = Math.min(...xs);
  return mx > 0 ? round(((mx - mn) / mx) * 100) : null;
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

/* ===================== CS — 1. Comparaison sources ===================== */
export function CqdCsComparaison() {
  const { b, live } = useLevel("as");
  return (
    <div className="space-y-4">
      <Banner icon="chart" tone="blue" title="Centres de santé — Comparaison des sources de données" sub="Pointage · Registre · SNIS · DHIS2 — par antigène" />
      <section>
        <SectionBar icon="bars">Écart moyen entre sources par antigène</SectionBar>
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
        <div className="text-[12.5px] font-semibold text-surface-700">Messages clés : les valeurs restent globalement proches entre les sources ; les écarts les plus visibles guident les vérifications de transcription par antigène.</div>
      </div>
    </div>
  );
}

/* ===================== CS — 2. Concordance ===================== */
export function CqdCsConcordance() {
  const { b, live } = useLevel("as");
  const rows = b?.parStructure ?? [];
  const sous = rows.filter((r) => r.classeRsP3 === "sous").length;
  const sur = rows.filter((r) => r.classeRsP3 === "sur").length;
  const concRsP3 = avg(rows.map((r) => r.concordanceRsP3));
  const concRsRr2 = avg(rows.map((r) => r.concordanceRsRr2));
  const concAntigene = (l: string) => { const a = b ? antByLabel(b, l) : null; return a && a.snis > 0 ? round((a.registre / a.snis) * 100) : null; };
  return (
    <div className="space-y-4">
      <Banner icon="concord" tone="green" title="Centres de santé — Concordance des données" sub="Registre / SNIS · Registre / Pointage — seuils 95–105" />
      <section>
        <SectionBar icon="bars">Indicateurs de concordance</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="concord" tone="green" label="Concordance PENTA3 (Reg/SNIS)" value={pctTxt(concRsP3)} sub={concRsP3 == null ? "" : concClass(concRsP3 >= 95 && concRsP3 <= 105 ? "normal" : concRsP3 < 95 ? "sous" : "sur")} />
          <KpiTile icon="concord" tone="violet" label="Concordance RR2 (Reg/SNIS)" value={pctTxt(concRsRr2)} />
          <KpiTile icon="down" tone="orange" label="AS en sous-rapportage" value={sous} />
          <KpiTile icon="up" tone="red" label="AS en sur-rapportage" value={sur} />
        </div>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="card card-pad lg:col-span-5">
          <CardTitle icon="bars" tone="blue" title="Concordance globale par antigène" sub="Registre / SNIS (seuils 95–105)" />
          {live ? <ProtoHBar height={180} byCot={false} color={C.blue} maxName={70} rows={ANT4.map((l) => [l, concAntigene(l) ?? 0]) as [string, number][]} /> : <Empty />}
        </div>
        <div className="card card-pad lg:col-span-7">
          <CardTitle icon="table" tone="navy" title="Concordance Registre / SNIS par aire de santé" sub="PENTA3 · RR2" />
          {rows.length ? (
            <div className="overflow-x-auto"><table className="dtable">
              <thead><tr><th className="name">Aire de santé</th><th>Conc. PENTA3</th><th>Appréciation</th><th>Conc. RR2</th><th>Appréciation</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.name}><td className="name">{r.name}</td>
                  <td>{pctTxt(r.concordanceRsP3)}</td><td>{r.concordanceRsP3 == null ? "—" : <ApprBadge p={r.concordanceRsP3} />}</td>
                  <td>{pctTxt(r.concordanceRsRr2)}</td><td>{r.concordanceRsRr2 == null ? "—" : <ApprBadge p={r.concordanceRsRr2} />}</td></tr>
              ))}</tbody>
            </table></div>
          ) : <Empty />}
        </div>
      </div>
      <Interpretation />
    </div>
  );
}

/* ===================== CS — 3. Erreurs ===================== */
export function CqdCsErreurs() {
  const { b, live, months } = useLevel("as");
  const rows = b?.parStructure ?? [];
  const moyen = b?.erreurRegistreSnis ?? null;
  const systematiques = rows.filter((r) => (r.erreurRegistreSnis ?? 0) >= 50).length;
  const comparaisons = rows.length * 4;
  const top5 = [...rows].sort((a, b2) => (b2.erreurRegistreSnis ?? 0) - (a.erreurRegistreSnis ?? 0)).slice(0, 5);
  return (
    <div className="space-y-4">
      <Banner icon="erreurs" tone="red" title="Centres de santé — Taux d'erreur de transcription" sub="Registre → SNIS · feuille de pointage → registre" />
      <section>
        <SectionBar icon="bars">Indicateurs d'erreur</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="erreurs" tone="red" label="Taux d'erreur moyen" value={pctTxt(moyen)} sub="Registre / SNIS" />
          <KpiTile icon="alert" tone="orange" label="AS erreurs systématiques" value={systematiques} sub="≥ 50 %" />
          <KpiTile icon="scale" tone="navy" label="Taux pointage / registre" value={pctTxt(b?.erreurPointageRegistre ?? null)} />
          <KpiTile icon="concord" tone="blue" label="Comparaisons réalisées" value={comparaisons} sub={`${rows.length} CS × 4 antigènes`} />
        </div>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="card card-pad lg:col-span-7">
          <CardTitle icon="chart" tone="red" title="Taux d'erreur global par mois" sub="Seuil 50 % = erreurs systématiques" />
          {live && b && b.trend.length ? (
            <ProtoGroupedBar height={200} unit="%" max={100} colors={[C.red, C.orange]} cats={b.trend.map((t) => t.month.slice(0, 7))}
              series={[{ name: "Registre / SNIS", data: b.trend.map((t) => t.erreurRegistreSnis ?? 0) }, { name: "Pointage / registre", data: b.trend.map((t) => t.erreurPointageRegistre ?? 0) }]} />
          ) : <Empty msg="Pas d'évolution mensuelle disponible." />}
        </div>
        <div className="card card-pad lg:col-span-5">
          <CardTitle icon="rank" tone="red" title="Top 5 des AS à plus fort taux d'erreur" />
          {top5.length ? <ProtoHBar height={190} byCot={false} color={C.red} maxName={110} rows={top5.map((r) => [r.name, r.erreurRegistreSnis ?? 0]) as [string, number][]} /> : <Empty />}
        </div>
      </div>
      <div className="card card-pad">
        <CardTitle icon="table" tone="navy" title="Taux d'erreur par aire de santé" sub="Registre/SNIS · Pointage/registre · appréciation" />
        {rows.length ? (
          <div className="overflow-x-auto"><table className="dtable">
            <thead><tr><th className="name">Aire de santé</th><th>Registre / SNIS</th><th>Pointage / registre</th><th>Appréciation</th></tr></thead>
            <tbody>{rows.map((r) => { const a = errAppr(r.erreurRegistreSnis); return (
              <tr key={r.name}><td className="name">{r.name}</td><td style={{ color: C.red, fontWeight: 700 }}>{pctTxt(r.erreurRegistreSnis)}</td><td>{pctTxt(r.erreurPointageRegistre)}</td><td style={{ color: a.color, fontWeight: 800 }}>{a.label}</td></tr>
            ); })}</tbody>
          </table></div>
        ) : <Empty />}
        <div className="mt-2 text-[11px] text-surface-500">Taux d'erreur = données discordantes / total des comparaisons × 100 ; ≥ 50 % = erreurs systématiques.</div>
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
        <CardTitle icon="table" tone="navy" title="Appréciation par aire de santé" sub="Bien / Mal rempli par outil" />
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
  const byAs = rows.map((r) => [r.name, r.enfantsIdentifies] as [string, number]).filter((x) => x[1] > 0).sort((a, c) => c[1] - a[1]).slice(0, 10);
  return (
    <div className="space-y-4">
      <Banner icon="enfants" tone="teal" title="Centres de santé — Enfants manqués / perdus de vue" sub="Identification via le registre · récupération" />
      <section>
        <SectionBar icon="child">Enfants perdus de vue</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="enfants" tone="navy" label="À récupérer (identifiés)" value={e.aRecuperer} />
          <KpiTile icon="clip" tone="violet" label="Identifiés précédemment" value={e.identifies} />
          <KpiTile icon="people" tone="orange" label="Retrouvés par les relais" value={e.retrouves} />
          <KpiTile icon="check" tone="green" label="Effectivement récupérés" value={e.recuperes} sub={`Taux : ${pctTxt(e.tauxRecuperes)}`} />
        </div>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="card card-pad lg:col-span-7">
          <CardTitle icon="chart" tone="blue" title="Enfants identifiés par aire de santé" />
          {byAs.length ? <ProtoHBar height={Math.max(160, byAs.length * 34)} byCot={false} color={C.blue} maxName={120} unit="" max={Math.max(...byAs.map((x) => x[1]), 1)} rows={byAs} /> : <Empty />}
        </div>
        <div className="card card-pad lg:col-span-5">
          <CardTitle icon="cotation" tone="green" title="Récupération des enfants identifiés" />
          <Donut height={200} data={[{ name: "Récupérés", value: e.recuperes, color: C.green }, { name: "Restant à récupérer", value: restants, color: C.orange }]} />
        </div>
      </div>
      <div className="card card-pad" style={{ background: "#eaf4fd" }}>
        <div className="text-[12.5px] font-semibold text-surface-700">Messages clés : prioriser les aires de santé concentrant le plus d'enfants identifiés non encore récupérés ; renforcer le suivi via le registre des enfants manqués.</div>
      </div>
    </div>
  );
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
  const { b, months } = useLevel("zs");
  const rows = b?.parStructure ?? [];
  const sous = rows.filter((r) => r.classeP3 === "sous").length;
  const sur = rows.filter((r) => r.classeP3 === "sur").length;
  return (
    <div className="space-y-4">
      <Banner icon="concord" tone="green" title="Zones de santé — Concordance DHIS2 / SNIS" sub="Seuils 95–105" />
      <section>
        <SectionBar icon="bars">Indicateurs de concordance</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="concord" tone="green" label="Concordance PENTA3 (DHIS2/SNIS)" value={pctTxt(b?.concordanceP3.taux ?? null)} sub={b ? concClass(b.concordanceP3.classe) : ""} />
          <KpiTile icon="concord" tone="violet" label="Concordance RR2 (DHIS2/SNIS)" value={pctTxt(b?.concordanceRr2.taux ?? null)} sub={b ? concClass(b.concordanceRr2.classe) : ""} />
          <KpiTile icon="down" tone="orange" label="ZS en sous-rapportage" value={sous} />
          <KpiTile icon="up" tone="red" label="ZS en sur-rapportage" value={sur} />
        </div>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="card card-pad lg:col-span-5">
          <CardTitle icon="bars" tone="blue" title="Concordance globale par antigène" sub="DHIS2 / SNIS" />
          {b && b.parAntigene.length ? <ProtoHBar height={180} byCot={false} color={C.blue} maxName={70} rows={b.parAntigene.map((a) => [a.antigene, a.concordance ?? 0]) as [string, number][]} /> : <Empty />}
        </div>
        <div className="card card-pad lg:col-span-7">
          <CardTitle icon="table" tone="navy" title="Concordance DHIS2 / SNIS par zone de santé" sub="PENTA3 · RR2 · taux d'erreur" />
          {rows.length ? (
            <div className="overflow-x-auto"><table className="dtable">
              <thead><tr><th className="name">Zone de santé</th><th>Conc. PENTA3</th><th>Appréciation</th><th>Conc. RR2</th><th>Appréciation</th><th>Erreur SNIS/DHIS2</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.name}><td className="name">{r.name}</td>
                  <td>{pctTxt(r.concordanceP3)}</td><td>{r.concordanceP3 == null ? "—" : <ApprBadge p={r.concordanceP3} />}</td>
                  <td>{pctTxt(r.concordanceRr2)}</td><td>{r.concordanceRr2 == null ? "—" : <ApprBadge p={r.concordanceRr2} />}</td>
                  <td style={{ color: C.orange, fontWeight: 700 }}>{pctTxt(r.erreurSnisDhis2)}</td></tr>
              ))}</tbody>
            </table></div>
          ) : <Empty />}
        </div>
      </div>
      <Interpretation />
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
        <CardTitle icon="table" tone="navy" title="Taux d'erreur SNIS / DHIS2 par zone de santé" sub="Avec appréciation" />
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

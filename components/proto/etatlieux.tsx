"use client";

/* =========================================================================
   etatlieux.tsx — Onglet « État de lieux Tshuapa » (fidèle à apercu/etatlieux.js)
   3 pages : Informations générales · Planification & communauté · Ressources
   Données réelles : Excel « Final base état de lieu Tshuapa » (data/edl-data.ts).
   ========================================================================= */
import { EDL, type EdlZsPop } from "@/data/edl-data";
import { SectionBar } from "@/components/ui/Card";
import { C, TONES, cotColor, fmt, KpiTile, CardTitle, Badge, StatTile, Banner, type Tone } from "./proto";
import { ProtoGroupedBar, ProtoHBar } from "./charts";

const E = EDL;
const sortZS = (arr: EdlZsPop[]) => arr.slice().sort((a, b) => a.zs.localeCompare(b.zs));

/* ---------------- Informations générales ---------------- */
export function Edl1() {
  const st = E.structure, pt = E.popTotals;
  const ecart = pt.enf0_11_ajuste - pt.enf0_11_micro;
  const zss = sortZS(E.zsPop);
  return (
    <div className="space-y-4">
      <Banner icon="map" tone="navy" title="Informations générales — Province de la Tshuapa"
        sub={`2 antennes · ${st.zs} zones de santé · ${st.as} aires de santé`} />

      <section>
        <SectionBar icon="home">Structures sanitaires</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiTile icon="tower" tone="navy" label="Antennes" value={st.antennes} />
          <KpiTile icon="hospital" tone="violet" label="Zones de santé" value={st.zs} />
          <KpiTile icon="clinic" tone="green" label="Aires de santé" value={st.as} />
          <KpiTile icon="home" tone="blue" label="Total ESS" value={fmt(st.essTotal)} />
          <KpiTile icon="syringe" tone="orange" label="ESS qui vaccinent" value={fmt(st.essVac)} sub={`${Math.round(st.essVac / st.essTotal * 100)}% des ESS`} />
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
          <ProtoGroupedBar height={240} colors={[C.violet, C.green]} cats={zss.map((z) => z.zs)} series={[
            { name: "0–11 mois admin.", data: zss.map((z) => z.cMicro) },
            { name: "0–11 mois ajustée", data: zss.map((z) => z.cAj) },
          ]} />
        </div>
        <div className="card card-pad">
          <CardTitle icon="syringe" tone="green" title="% des ESS qui vaccinent par ZS" sub="Total possible par zone de santé" />
          <ProtoHBar height={240} maxName={90} rows={zss.map((z) => [z.zs, z.pctVac])} />
        </div>
      </div>

      <section>
        <SectionBar icon="bars">Population cible administrative & ajustée — par aire de santé</SectionBar>
        <div className="card card-pad">
          <div className="mb-2 text-[11px] text-surface-500">{E.asPop.length} aires de santé · tableau défilable</div>
          <div className="overflow-auto" style={{ maxHeight: 330 }}>
            <table className="grid">
              <thead><tr><th className="name">Aire de santé</th><th className="name">Zone de santé</th><th>Pop. admin.</th><th>Pop. ajustée</th><th>0–11 mois (micro)</th><th>0–11 mois (ajustée)</th></tr></thead>
              <tbody>
                {E.asPop.map((a, i) => (
                  <tr key={i}><td className="name">{a.as}</td><td className="name">{a.zs}</td><td>{fmt(a.popSnis)}</td><td>{fmt(a.popAj)}</td><td>{fmt(a.cMicro)}</td><td>{fmt(a.cAj)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section>
        <SectionBar icon="alert">Sites par niveau de priorité (risque) — par zone de santé</SectionBar>
        <div className="card card-pad">
          <table className="grid">
            <thead><tr><th className="name">Zone de santé</th><th>Très haute priorité</th><th>Haute priorité</th><th>Moyenne priorité</th><th>Faible priorité</th></tr></thead>
            <tbody>
              {zss.map((z) => {
                const il = E.infoZS.find((i) => i.zs.toUpperCase().startsWith(z.zs.toUpperCase().slice(0, 4))) ?? ({} as Partial<typeof E.infoZS[0]>);
                const th = il.ilots ?? 0, ha = il.campPech ?? 0, mo = il.campElev ?? 0, fa = Math.max(0, (z.nAS || 0) - 1);
                return (
                  <tr key={z.zs}>
                    <td className="name">{z.zs}</td>
                    <td style={{ background: TONES.red.bg, color: C.red, fontWeight: 700 }}>{th}</td>
                    <td style={{ background: TONES.orange.bg, color: C.orange, fontWeight: 700 }}>{ha}</td>
                    <td style={{ background: TONES.blue.bg, color: C.blue, fontWeight: 700 }}>{mo}</td>
                    <td style={{ background: TONES.green.bg, color: C.green, fontWeight: 700 }}>{fa}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-2 text-[11px] text-surface-500">Niveaux estimés à partir des îlots, campements de pêcheurs et d'éleveurs recensés par ZS (base état de lieux).</div>
        </div>
      </section>
    </div>
  );
}

/* ---------------- Planification & participation communautaire ---------------- */
function CondCell({ v = "", kind }: { v?: string; kind?: "reseau" }) {
  const n = parseFloat(("" + v).replace(",", ".")) || 0;
  let tone: Tone = n >= 100 ? "red" : n >= 50 ? "orange" : "green";
  if (kind === "reseau") tone = ("" + v).toLowerCase().startsWith("o") ? "green" : "red";
  const t = TONES[tone];
  return <td style={{ background: t.bg, color: t.text, fontWeight: 700 }}>{v || "—"}</td>;
}

export function Edl2() {
  const zss = sortZS(E.zsPop);
  const sum = (f: (z: typeof E.infoZS[0]) => number) => E.infoZS.reduce((s, z) => s + f(z), 0);
  return (
    <div className="space-y-4">
      <Banner icon="road" tone="orange" title="Planification, stratégies avancées & participation communautaire"
        sub="Accessibilité, microplanification et mobilisation communautaire" />

      <section>
        <SectionBar icon="road">Accessibilité — distances & réseau par aire de santé</SectionBar>
        <div className="card card-pad">
          <div className="mb-2 text-[11px] text-surface-500">Mise en forme conditionnée : vert &lt; 50 km · orange 50–99 km · rouge ≥ 100 km. Tableau défilable.</div>
          <div className="overflow-auto" style={{ maxHeight: 300 }}>
            <table className="grid">
              <thead><tr><th className="name">Aire de santé</th><th className="name">Zone de santé</th><th>Distance AS–BCZ (km)</th><th>Dernier village (km)</th><th>Voie d'accès</th><th>Réseau</th></tr></thead>
              <tbody>
                {E.asPop.map((a, i) => (
                  <tr key={i}><td className="name">{a.as}</td><td className="name">{a.zs}</td><CondCell v={a.distBCZ} /><CondCell v={a.distVil} /><td>{a.voie || "—"}</td><CondCell v={a.reseau} kind="reseau" /></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section>
        <SectionBar icon="map">Spécificités géographiques & populations dispersées — par ZS</SectionBar>
        <div className="card card-pad">
          <table className="grid">
            <thead><tr><th className="name">Zone de santé</th><th>Îlots</th><th>Campements pêcheurs</th><th>Campements éleveurs</th><th>Camps déplacés internes</th></tr></thead>
            <tbody>
              {E.infoZS.map((z) => (
                <tr key={z.zs}><td className="name">{z.zs}</td><td>{fmt(z.ilots)}</td><td>{fmt(z.campPech)}</td><td>{fmt(z.campElev)}</td><td>{fmt(z.campsDepl)}</td></tr>
              ))}
            </tbody>
            <tfoot><tr><td className="name">Total province</td><td>{fmt(sum((z) => z.ilots))}</td><td>{fmt(sum((z) => z.campPech))}</td><td>{fmt(sum((z) => z.campElev))}</td><td>{fmt(sum((z) => z.campsDepl))}</td></tr></tfoot>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card card-pad">
          <CardTitle icon="flag" tone="navy" title="Stratégies de vaccination planifiées (microplan)" sub="Somme par zone de santé" />
          <ProtoGroupedBar height={230} cats={zss.map((z) => z.zs)} series={[
            { name: "Fixes", data: zss.map((z) => z.sFix) },
            { name: "Avancées", data: zss.map((z) => z.sAv) },
            { name: "Mobiles", data: zss.map((z) => z.sMob) },
            { name: "Spéciales", data: zss.map((z) => z.sSpe) },
          ]} />
        </div>
        <div className="card card-pad">
          <CardTitle icon="people" tone="green" title="Participation communautaire — CAC & RECO" sub="Cellules d'animation communautaire par ZS" />
          <div className="overflow-auto" style={{ maxHeight: 230 }}>
            <table className="grid">
              <thead><tr><th className="name">Zone de santé</th><th>Villages</th><th>CAC prévus</th><th>CAC actifs</th></tr></thead>
              <tbody>
                {E.infoZS.map((z) => (
                  <tr key={z.zs}><td className="name">{z.zs}</td><td>{fmt(z.villages)}</td><td>{fmt(z.cac)}</td><td style={{ color: C.green, fontWeight: 700 }}>{fmt(z.cacFonc)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <section>
        <SectionBar icon="home">Points d'entrée communautaires & localités résistantes — par ZS</SectionBar>
        <div className="card card-pad">
          <div className="overflow-auto" style={{ maxHeight: 300 }}>
            <table className="grid">
              <thead><tr><th className="name">Zone de santé</th><th>Marchés</th><th>Églises</th><th>École maternelle</th><th>École primaire</th><th>École secondaire</th><th>Localités résistantes</th></tr></thead>
              <tbody>
                {E.infoZS.map((z) => (
                  <tr key={z.zs}><td className="name">{z.zs}</td><td>{fmt(z.marches)}</td><td>{fmt(z.eglises)}</td><td>{fmt(z.ecoleMat)}</td><td>{fmt(z.ecolePrim)}</td><td>{fmt(z.ecoleSec)}</td><td style={{ color: C.red, fontWeight: 700 }}>{z.refractaires || "0"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------------- Ressources humaines, matérielles & financières ---------------- */
export function Edl3() {
  const cold = E.cold.slice().sort((a, b) => a.zs.localeCompare(b.zs));
  const energie: Record<string, number> = {};
  E.coldAS.forEach((a) => { const k = (a.energie || "Non précisé").trim() || "Non précisé"; energie[k] = (energie[k] || 0) + 1; });
  const energieRows = Object.entries(energie).sort((a, b) => b[1] - a[1]);
  const etatF = E.coldAS.filter((a) => ("" + a.etat).toUpperCase().startsWith("F")).length;
  const totNAS = cold.reduce((s, c) => s + c.nAS, 0), totFrigo = cold.reduce((s, c) => s + c.frigo, 0);

  return (
    <div className="space-y-4">
      <Banner icon="fridge" tone="teal" title="Ressources humaines, matérielles & financières"
        sub="Chaîne de froid, logistique et partenaires technico-financiers" />

      <section>
        <SectionBar icon="fridge">Chaîne de froid — synthèse par zone de santé</SectionBar>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="card card-pad">
            <div className="overflow-auto" style={{ maxHeight: 300 }}>
              <table className="grid">
                <thead><tr><th className="name">Zone de santé</th><th>Nbr AS</th><th>AS avec réfrigérateur fonctionnel</th><th>Couverture</th></tr></thead>
                <tbody>
                  {cold.map((c) => { const p = Math.round(c.frigo / c.nAS * 100); return (
                    <tr key={c.zs}><td className="name">{c.zs}</td><td>{c.nAS}</td><td style={{ color: C.teal, fontWeight: 700 }}>{c.frigo}</td><td style={{ background: cotColor(p) + "22", fontWeight: 800 }}>{p}%</td></tr>
                  ); })}
                </tbody>
                <tfoot><tr><td className="name">Total province</td><td>{totNAS}</td><td>{totFrigo}</td><td>{Math.round(totFrigo / totNAS * 100)}%</td></tr></tfoot>
              </table>
            </div>
          </div>
          <div className="card card-pad">
            <CardTitle icon="fridge" tone="teal" title="Couverture en réfrigérateurs fonctionnels" sub="% des AS équipées par ZS" />
            <ProtoHBar height={250} maxName={90} rows={cold.map((c) => [c.zs, Math.round(c.frigo / c.nAS * 100)])} />
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
        <SectionBar icon="hands">Partenaires technico-financiers — domaines d'intervention par ZS</SectionBar>
        <div className="card card-pad">
          <div className="overflow-auto" style={{ maxHeight: 360 }}>
            <table className="grid" style={{ fontSize: 10 }}>
              <thead><tr>
                <th className="name" style={{ position: "sticky", left: 0, background: "#f1f5f9", zIndex: 2 }}>Zone de santé</th>
                {E.partnerCols.map((p) => <th key={p} style={{ minWidth: 78 }}>{p}</th>)}
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
          <div className="mt-2 text-[11px] text-surface-500">Partenaires : OMS, GAVI, UNICEF, CDC, Fonds Mondial, Banque Mondiale, SANRU, CDI Bwamanda, CORDAID, Croix Rouge… · « — » = pas d'intervention recensée.</div>
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

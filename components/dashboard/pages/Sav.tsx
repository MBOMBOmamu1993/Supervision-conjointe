"use client";

/* Onglet « SAV — Semaine Africaine de Vaccination ». 6 pages alimentées en
   LIVE via /api/sav (exports Kobo SAV figés + BASE SAISIE DONNEES SAV).
   Identification ZD/SV par CS et Planification sont dédupliquées par centre de
   santé (cf. lib/sav/analytics.ts). États vides gérés : aucune page ne plante. */
import { useSav } from "@/lib/client/sav-api";
import { SectionBar } from "@/components/ui/Card";
import { KpiTile, CardTitle, Banner, C, type Tone } from "@/components/proto/proto";
import { ProtoHBar, ProtoGroupedBar } from "@/components/proto/charts";
import { ProtoScoreBar } from "@/components/proto/charts-ext";
import Donut from "@/components/charts/Donut";
import { DIcon } from "@/components/dashboard/icons";

const pctTxt = (v: number | null | undefined) => (v == null ? "—" : `${v}%`);
const heat = (v: number | null) => (v == null ? undefined : v >= 60 ? "#e6f6ec" : v >= 50 ? "#fff3bf" : v >= 40 ? "#ffe8cc" : "#fde2e2");

function Empty({ msg = "En attente de données." }: { msg?: string }) {
  return <div className="py-10 text-center text-[12px] font-semibold text-surface-500">{msg}</div>;
}
function Pending() {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-[12.5px] font-semibold" style={{ background: "#fff8eb", borderColor: "#fbd88a", color: "#b45309" }}>
      <DIcon name="route" style={{ width: 17, height: 17 }} />
      Aucune soumission SAV pour l'instant — les visuels s'alimenteront automatiquement dès les premières données Kobo.
    </div>
  );
}
function Dedup({ html }: { html: string }) {
  return (
    <div className="rounded-xl border px-4 py-2.5 text-[12px] leading-snug" style={{ background: "#eef2f7", borderColor: "#cdd7e5", color: "#334155" }}
      dangerouslySetInnerHTML={{ __html: html }} />
  );
}

/* ===================== 1. Vue d'ensemble ===================== */
export function SavVue() {
  const { data } = useSav();
  if (!data) return <Empty msg="Synchronisation…" />;
  const k = data.vue.kpi;
  const d = data.dedup;
  return (
    <div className="space-y-4">
      {!data.meta.hasData && <Pending />}
      <Banner icon="route" tone="orange" title="SAV — Semaine Africaine de Vaccination · Vue d'ensemble" sub="Identification, planification, résultats et supervision des équipes" />
      <Dedup html={`<b>Identification ZD/SV par CS</b> et <b>Planification</b> dédupliquées par centre de santé (1 fiche/CS, la plus récente) : Ident. CS ${d.identCs.raw}→<b>${d.identCs.kept}</b>, Planification ${d.planif.raw}→<b>${d.planif.kept}</b> fiches.`} />
      <section>
        <SectionBar icon="bars">Indicateurs clés</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiTile icon="enfants" tone="orange" label="CS — identification soumise" value={k.identCsFiches} sub="CS uniques · doublons retirés" />
          <KpiTile icon="calendar" tone="blue" label="CS — planification soumise" value={k.planifFiches} sub="CS uniques · doublons retirés" />
          <KpiTile icon="pin" tone="violet" label="AS — identification relais" value={`${k.asRelais} / ${k.asRelaisTotal}`} sub={pctTxt(k.asRelaisPct)} />
          <KpiTile icon="syringe" tone="green" label="AS — résultats soumis" value={`${k.asResultats} / ${k.asResultatsTotal}`} sub={pctTxt(k.asResultatsPct)} />
          <KpiTile icon="check" tone="teal" label="Formulaires supervision" value={k.supervisionForms} sub="soumissions" />
        </div>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="card card-pad lg:col-span-5">
          <CardTitle icon="form" tone="orange" title="Formulaires SAV soumis par type" sub="Ident. CS & Planification après déduplication par CS" />
          {data.vue.formsByType.some((x) => x.value > 0) ? <ProtoHBar height={210} byCot={false} color={C.orange} unit="" maxName={120} max={Math.max(...data.vue.formsByType.map((x) => x.value), 1)} rows={data.vue.formsByType.map((x) => [x.label, x.value]) as [string, number][]} /> : <Empty />}
        </div>
        <div className="card card-pad lg:col-span-4">
          <CardTitle icon="enfants" tone="blue" title="Enfants manqués identifiés par zone de santé" />
          {data.vue.enfantsManquesByZs.length ? <ProtoHBar height={210} byCot={false} color={C.blue} unit="" maxName={90} max={Math.max(...data.vue.enfantsManquesByZs.map((x) => x.value), 1)} rows={data.vue.enfantsManquesByZs.map((x) => [x.label, x.value]) as [string, number][]} /> : <Empty />}
        </div>
        <div className="card card-pad lg:col-span-3">
          <CardTitle icon="cotation" tone="red" title="Statut vaccinal des enfants identifiés" />
          <Donut height={210} data={[
            { name: "Zéro dose", value: data.vue.statutVaccinal.zeroDose, color: C.red },
            { name: "Sous-vaccinés", value: data.vue.statutVaccinal.sousVaccines, color: C.orange },
            { name: "Autres manqués", value: data.vue.statutVaccinal.autres, color: C.blue },
          ]} />
        </div>
      </div>
      <div className="card card-pad">
        <CardTitle icon="table" tone="navy" title="Synthèse SAV par zone de santé" sub="Identification & planification dédupliquées par centre de santé" />
        {data.vue.syntheseByZs.length ? (
          <div className="overflow-x-auto"><table className="dtable">
            <thead><tr><th className="name">Zone de santé</th><th>CS</th><th>Enfants identifiés</th><th>Zéro dose</th><th>Sous-vacc.</th><th>Sessions planifiées</th><th>Enfants attendus</th><th>Enfants récupérés</th><th>Taux récup.</th></tr></thead>
            <tbody>{data.vue.syntheseByZs.map((r) => (
              <tr key={r.zone}><td className="name">{r.zone}</td><td>{r.cs}</td><td>{r.enfantsIdentifies}</td><td>{r.zeroDose}</td><td>{r.sousVaccines}</td><td>{r.sessions}</td><td>{r.enfantsAttendus}</td><td>{r.enfantsRecuperes}</td><td style={{ background: heat(r.tauxRecup) }}>{pctTxt(r.tauxRecup)}</td></tr>
            ))}</tbody>
          </table></div>
        ) : <Empty />}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="card card-pad lg:col-span-7">
          <CardTitle icon="chart" tone="orange" title="Doses manquées par antigène (province)" sub="après déduplication par CS" />
          {data.vue.dosesByAntigene.length ? <ProtoHBar height={Math.max(220, data.vue.dosesByAntigene.length * 16)} byCot={false} color="#c87b04" unit="" maxName={70} max={Math.max(...data.vue.dosesByAntigene.map((x) => x.value), 1)} rows={data.vue.dosesByAntigene.map((x) => [x.label, x.value]) as [string, number][]} /> : <Empty />}
        </div>
        <div className="card card-pad lg:col-span-5">
          <CardTitle icon="rank" tone="red" title="Top 5 aires de santé — enfants manqués" />
          {data.vue.topAsManques.length ? <ProtoHBar height={210} byCot={false} color={C.red} unit="" maxName={120} max={Math.max(...data.vue.topAsManques.map((x) => x.value), 1)} rows={data.vue.topAsManques.map((x) => [x.label, x.value]) as [string, number][]} /> : <Empty />}
        </div>
      </div>
    </div>
  );
}

/* ===================== 2. Identification CS ===================== */
export function SavIdentCs() {
  const { data } = useSav();
  if (!data) return <Empty msg="Synchronisation…" />;
  const s = data.identCs; const d = data.dedup.identCs;
  const antigenes = s.dosesParTrancheAntigene[0] ? Object.keys(s.dosesParTrancheAntigene[0].values) : [];
  return (
    <div className="space-y-4">
      {!data.meta.hasData && <Pending />}
      <Banner icon="enfants" tone="orange" title="Identification ZD/SV par CS (IT)" sub="Enfants en conflit avec le calendrier vaccinal identifiés au centre de santé" />
      <Dedup html={`<b>Déduplication par centre de santé</b> : une seule fiche par CS (clé Zone × Aire, la plus récente). <b>${d.raw} soumissions → ${d.kept} CS uniques</b> (${d.removed} doublons retirés). Tous les comptages ci-dessous sont dédupliqués.`} />
      <section>
        <SectionBar icon="bars">Indicateurs clés</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="enfants" tone="orange" label="Enfants manqués identifiés" value={s.kpi.identifies} sub={`${s.kpi.csUniques} CS uniques`} />
          <KpiTile icon="erreurs" tone="red" label="Enfants zéro dose" value={s.kpi.zeroDose} sub="Penta 1 non reçu" />
          <KpiTile icon="gauge" tone="orange" label="Enfants sous-vaccinés" value={s.kpi.sousVaccines} sub="Penta 3 non reçu" />
          <KpiTile icon="syringe" tone="blue" label="Total doses manquées" value={s.kpi.dosesManquees} sub="tous antigènes" />
        </div>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card card-pad">
          <CardTitle icon="enfants" tone="orange" title="Enfants manqués par tranche d'âge" />
          <Donut height={210} data={[
            { name: "0 – 11 mois", value: s.parTrancheAge.age_0_11, color: C.orange },
            { name: "12 – 23 mois", value: s.parTrancheAge.age_12_23, color: C.blue },
            { name: "24 – 59 mois", value: s.parTrancheAge.age_24_59, color: C.violet },
          ]} />
        </div>
        <div className="card card-pad">
          <CardTitle icon="chart" tone="blue" title="Enfants manqués par zone de santé et tranche d'âge" />
          {s.parZsTrancheAge.length ? <ProtoGroupedBar height={210} unit="" colors={[C.orange, C.blue, C.violet]} cats={s.parZsTrancheAge.map((r) => r.zone)}
            series={[{ name: "0 – 11 mois", data: s.parZsTrancheAge.map((r) => r.a0) }, { name: "12 – 23 mois", data: s.parZsTrancheAge.map((r) => r.a1) }, { name: "24 – 59 mois", data: s.parZsTrancheAge.map((r) => r.a2) }]} /> : <Empty />}
        </div>
      </div>
      <div className="card card-pad">
        <CardTitle icon="table" tone="navy" title="Doses manquées par antigène et par tranche d'âge" sub="Source : BASE SAISIE DONNEES SAV · après déduplication par CS" />
        {antigenes.length ? (
          <div className="overflow-x-auto"><table className="dtable">
            <thead><tr><th className="name">Tranche d'âge</th>{antigenes.map((a) => <th key={a}>{a}</th>)}</tr></thead>
            <tbody>{s.dosesParTrancheAntigene.map((r) => (
              <tr key={r.ageLabel}><td className="name">{r.ageLabel}</td>{antigenes.map((a) => <td key={a}>{r.values[a] ?? 0}</td>)}</tr>
            ))}</tbody>
          </table></div>
        ) : <Empty msg="Ventilation par antigène : en attente de la BASE SAISIE DONNEES SAV." />}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="card card-pad lg:col-span-7">
          <CardTitle icon="table" tone="blue" title="Enfants manqués par aire de santé et tranche d'âge" />
          {s.parAsTrancheAge.length ? (
            <div className="overflow-x-auto"><table className="dtable">
              <thead><tr><th className="name">Aire de santé</th><th>0–11</th><th>12–23</th><th>24–59</th><th>Total</th></tr></thead>
              <tbody>{s.parAsTrancheAge.map((r) => (
                <tr key={r.aire}><td className="name">{r.aire}</td><td>{r.a0}</td><td>{r.a1}</td><td>{r.a2}</td><td><b>{r.total}</b></td></tr>
              ))}</tbody>
            </table></div>
          ) : <Empty />}
        </div>
        <div className="card card-pad lg:col-span-5">
          <CardTitle icon="rank" tone="red" title="Top 5 AS — plus grand nombre d'enfants manqués" />
          {s.topAs.length ? <ProtoHBar height={210} byCot={false} color={C.red} unit="" maxName={120} max={Math.max(...s.topAs.map((x) => x.value), 1)} rows={s.topAs.map((x) => [x.label, x.value]) as [string, number][]} /> : <Empty />}
        </div>
      </div>
    </div>
  );
}

/* ===================== 3. Identification relais ===================== */
export function SavIdentRelais() {
  const { data } = useSav();
  if (!data) return <Empty msg="Synchronisation…" />;
  const s = data.identRelais;
  return (
    <div className="space-y-4">
      {!data.meta.hasData && <Pending />}
      <Banner icon="pin" tone="violet" title="Identification relais (communauté)" sub="Enfants en conflit avec le calendrier vaccinal identifiés par les relais communautaires" />
      <section>
        <SectionBar icon="bars">Indicateurs clés</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="enfants" tone="violet" label="Enfants manqués (communauté)" value={s.kpi.identifies} sub={`${s.kpi.asCount} AS`} />
          <KpiTile icon="erreurs" tone="red" label="Enfants zéro dose" value={s.kpi.zeroDose} sub="Penta 1 non reçu" />
          <KpiTile icon="gauge" tone="orange" label="Enfants sous-vaccinés" value={s.kpi.sousVaccines} sub="Penta 3 non reçu" />
          <KpiTile icon="pin" tone="blue" label="Relais ayant rapporté" value={s.kpi.relais} sub={`sur ${s.kpi.asCount} AS`} />
        </div>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card card-pad">
          <CardTitle icon="enfants" tone="violet" title="Enfants manqués (communauté) par tranche d'âge" />
          <Donut height={210} data={[
            { name: "0 – 11 mois", value: s.parTrancheAge.age_0_11, color: C.orange },
            { name: "12 – 23 mois", value: s.parTrancheAge.age_12_23, color: C.blue },
            { name: "24 – 59 mois", value: s.parTrancheAge.age_24_59, color: C.violet },
          ]} />
        </div>
        <div className="card card-pad">
          <CardTitle icon="chart" tone="blue" title="Enfants manqués par zone de santé et tranche d'âge" />
          {s.parZsTrancheAge.length ? <ProtoGroupedBar height={210} unit="" colors={[C.orange, C.blue, C.violet]} cats={s.parZsTrancheAge.map((r) => r.zone)}
            series={[{ name: "0 – 11 mois", data: s.parZsTrancheAge.map((r) => r.a0) }, { name: "12 – 23 mois", data: s.parZsTrancheAge.map((r) => r.a1) }, { name: "24 – 59 mois", data: s.parZsTrancheAge.map((r) => r.a2) }]} /> : <Empty />}
        </div>
      </div>
      <div className="card card-pad">
        <CardTitle icon="concord" tone="teal" title="Identification CS vs communauté (relais) par zone de santé" />
        {s.comparaisonCsCommunaute.length ? <ProtoGroupedBar height={220} unit="" colors={[C.blue, C.violet]} cats={s.comparaisonCsCommunaute.map((r) => r.zone)}
          series={[{ name: "Centre de santé (IT)", data: s.comparaisonCsCommunaute.map((r) => r.cs) }, { name: "Communauté (relais)", data: s.comparaisonCsCommunaute.map((r) => r.communaute) }]} /> : <Empty />}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="card card-pad lg:col-span-7">
          <CardTitle icon="table" tone="navy" title="Enfants manqués (relais) par aire de santé et tranche d'âge" />
          {s.parAsTrancheAge.length ? (
            <div className="overflow-x-auto"><table className="dtable">
              <thead><tr><th className="name">Aire de santé</th><th>0–11</th><th>12–23</th><th>24–59</th><th>Total</th></tr></thead>
              <tbody>{s.parAsTrancheAge.map((r) => (
                <tr key={r.aire}><td className="name">{r.aire}</td><td>{r.a0}</td><td>{r.a1}</td><td>{r.a2}</td><td><b>{r.total}</b></td></tr>
              ))}</tbody>
            </table></div>
          ) : <Empty />}
        </div>
        <div className="card card-pad lg:col-span-5">
          <CardTitle icon="rank" tone="violet" title="Top 5 AS — enfants manqués (communauté)" />
          {s.topAs.length ? <ProtoHBar height={210} byCot={false} color={C.violet} unit="" maxName={120} max={Math.max(...s.topAs.map((x) => x.value), 1)} rows={s.topAs.map((x) => [x.label, x.value]) as [string, number][]} /> : <Empty />}
        </div>
      </div>
    </div>
  );
}

/* ===================== 4. Planification ===================== */
export function SavPlanif() {
  const { data } = useSav();
  if (!data) return <Empty msg="Synchronisation…" />;
  const s = data.planif; const d = data.dedup.planif;
  return (
    <div className="space-y-4">
      {!data.meta.hasData && <Pending />}
      <Banner icon="calendar" tone="blue" title="Planification des sessions de récupération" sub="Sessions avancées, mobiles & fixes" />
      <Dedup html={`<b>Déduplication par centre de santé</b> : une seule fiche de planification par CS (la plus récente). <b>${d.raw} soumissions → ${d.kept} CS uniques</b> (${d.removed} doublons retirés). Sessions & enfants attendus dédupliqués.`} />
      <section>
        <SectionBar icon="bars">Indicateurs clés</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="calendar" tone="blue" label="Sessions planifiées" value={s.kpi.sessions} sub={`${s.sessionsParType.avancee} avancées · ${s.sessionsParType.fixe} fixes · ${s.sessionsParType.mobile} mobiles`} />
          <KpiTile icon="enfants" tone="orange" label="Enfants attendus" value={s.kpi.enfantsAttendus} sub="récupération" />
          <KpiTile icon="as" tone="green" label="AS avec programme" value={`${s.kpi.asAvecProgramme} / ${s.kpi.asTotal}`} sub={pctTxt(s.kpi.asTotal ? Math.round((s.kpi.asAvecProgramme / s.kpi.asTotal) * 100) : null)} />
          <KpiTile icon="gauge" tone="violet" label="Ratio attendus / identifiés" value={s.kpi.ratio ?? "—"} sub={`${s.kpi.enfantsAttendus} / ${data.identCs.kpi.identifies}`} />
        </div>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="card card-pad">
          <CardTitle icon="cotation" tone="green" title="Aires de santé ayant un programme de vaccination" />
          <Donut height={200} data={[{ name: "Avec programme", value: s.asProgramme.avec, color: C.green }, { name: "Sans programme", value: s.asProgramme.sans, color: C.red }]} />
        </div>
        <div className="card card-pad">
          <CardTitle icon="chart" tone="blue" title="Sessions planifiées par type" />
          <Donut height={200} data={[{ name: "Avancée", value: s.sessionsParType.avancee, color: C.blue }, { name: "Fixe", value: s.sessionsParType.fixe, color: C.violet }, { name: "Mobile", value: s.sessionsParType.mobile, color: C.orange }]} />
        </div>
        <div className="card card-pad">
          <CardTitle icon="enfants" tone="orange" title="Enfants attendus par zone de santé" />
          {s.enfantsAttendusByZs.length ? <ProtoHBar height={200} byCot={false} color={C.orange} unit="" maxName={90} max={Math.max(...s.enfantsAttendusByZs.map((x) => x.value), 1)} rows={s.enfantsAttendusByZs.map((x) => [x.label, x.value]) as [string, number][]} /> : <Empty />}
        </div>
      </div>
      <div className="card card-pad">
        <CardTitle icon="check" tone="navy" title="Aires de santé ayant / n'ayant pas de programme de vaccination" sub="après déduplication par centre de santé" />
        {s.asProgrammeTable.length ? (
          <div className="overflow-x-auto"><table className="dtable">
            <thead><tr><th className="name">Aire de santé</th><th>Zone de santé</th><th>Sessions</th><th>Enfants attendus</th><th>Programme</th></tr></thead>
            <tbody>{s.asProgrammeTable.map((r) => (
              <tr key={r.aire}><td className="name">{r.aire}</td><td>{r.zone ?? "—"}</td><td>{r.sessions}</td><td>{r.enfantsAttendus}</td>
                <td style={{ background: r.programme ? "#e6f6ec" : "#fde2e2", fontWeight: 700, color: r.programme ? "#178a44" : "#c81e1e" }}>{r.programme ? "Bien" : "Mal"}</td></tr>
            ))}</tbody>
          </table></div>
        ) : <Empty />}
      </div>
      <div className="card card-pad">
        <CardTitle icon="table" tone="blue" title="Programme de vaccination par aire de santé" sub="une ligne par AS après déduplication" />
        {s.programmeParAs.length ? (
          <div className="overflow-x-auto"><table className="dtable">
            <thead><tr><th>N°</th><th className="name">Aire de santé</th><th>Date prévue</th><th>Type de session</th><th>Site / localité</th><th>Enfants attendus</th><th>Membres de l'équipe</th></tr></thead>
            <tbody>{s.programmeParAs.map((r, i) => (
              <tr key={i}><td>{i + 1}</td><td className="name">{r.aire}</td><td>{r.date ?? "—"}</td><td>{r.type}</td><td>{r.site ?? "—"}</td><td>{r.enfantsAttendus}</td><td>{r.equipe ?? "—"}</td></tr>
            ))}</tbody>
          </table></div>
        ) : <Empty />}
      </div>
    </div>
  );
}

/* ===================== 5. Résultats vaccination ===================== */
export function SavResultats() {
  const { data } = useSav();
  if (!data) return <Empty msg="Synchronisation…" />;
  const s = data.resultats;
  return (
    <div className="space-y-4">
      {!data.meta.hasData && <Pending />}
      <Banner icon="syringe" tone="green" title="Résultats de la récupération" sub="Taux de récupération = enfants vaccinés ÷ enfants identifiés" />
      <section>
        <SectionBar icon="bars">Indicateurs clés</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="syringe" tone="green" label="Enfants récupérés" value={s.kpi.recuperes} sub="vaccinés" />
          <KpiTile icon="gauge" tone="blue" label="Taux de récupération" value={pctTxt(s.kpi.tauxRecup)} sub="vaccinés / identifiés" />
          <KpiTile icon="enfants" tone="orange" label="Zéro dose récupérés" value={s.kpi.zeroDoseRecuperes ?? "—"} sub="des zéro dose" />
          <KpiTile icon="rank" tone="red" label="AS sous le seuil (50 %)" value={s.kpi.asSousSeuil} sub="à relancer" />
        </div>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="card card-pad lg:col-span-7">
          <CardTitle icon="chart" tone="green" title="Taux de récupération par zone de santé et antigène" sub="vaccinés ÷ identifiés" />
          {s.tauxByZsAntigene.length && s.tauxByZsAntigene[0].zones.length ? (
            <ProtoGroupedBar height={230} unit="%" max={100} cats={s.tauxByZsAntigene.map((a) => a.antigene)}
              colors={[C.blue, C.orange, C.green]}
              series={s.tauxByZsAntigene[0].zones.map((z, zi) => ({ name: z.zone, data: s.tauxByZsAntigene.map((a) => a.zones[zi]?.taux ?? 0) }))} />
          ) : <Empty />}
        </div>
        <div className="card card-pad lg:col-span-5">
          <CardTitle icon="enfants" tone="violet" title="Enfants vaccinés par tranche d'âge" sub="Source : BASE SAISIE DONNEES SAV" />
          <Donut height={210} data={[
            { name: "0 – 11 mois", value: s.enfantsByTrancheAge.age_0_11, color: C.orange },
            { name: "12 – 23 mois", value: s.enfantsByTrancheAge.age_12_23, color: C.blue },
            { name: "24 – 59 mois", value: s.enfantsByTrancheAge.age_24_59, color: C.violet },
          ]} />
        </div>
      </div>
      <div className="card card-pad">
        <CardTitle icon="table" tone="navy" title="Enfants vaccinés par aire de santé et antigène (extrait)" sub="Source : BASE SAISIE DONNEES SAV" />
        {s.parAsTable.length ? (
          <div className="overflow-x-auto"><table className="dtable">
            <thead><tr><th className="name">Aire de santé</th>{Object.keys(s.parAsTable[0].values).map((a) => <th key={a}>{a}</th>)}<th>Total</th><th>Identifiés</th><th>Taux récup.</th></tr></thead>
            <tbody>{s.parAsTable.map((r) => (
              <tr key={r.aire}><td className="name">{r.aire}</td>{Object.keys(s.parAsTable[0].values).map((a) => <td key={a}>{r.values[a] ?? 0}</td>)}<td>{r.total}</td><td>{r.identifies}</td><td style={{ background: heat(r.taux) }}>{pctTxt(r.taux)}</td></tr>
            ))}</tbody>
          </table></div>
        ) : <Empty />}
      </div>
      <div className="card card-pad">
        <CardTitle icon="rank" tone="red" title="Top 5 aires de santé — taux de récupération le plus faible" />
        {s.topAsFaibles.length ? <ProtoScoreBar horiz height={210} unit="%" max={100} cats={s.topAsFaibles.map((x) => x.label)} vals={s.topAsFaibles.map((x) => x.value)} /> : <Empty />}
      </div>
    </div>
  );
}

/* ===================== 6. Supervision équipes ===================== */
export function SavSupervision() {
  const { data } = useSav();
  if (!data) return <Empty msg="Synchronisation…" />;
  const s = data.supervision;
  const cols = s.ouiParQuestion.slice(0, 7).map((q) => q.label);
  const ListCard = ({ icon, tone, title, items }: { icon: string; tone: Tone; title: string; items: string[] }) => (
    <div className="card card-pad">
      <CardTitle icon={icon as never} tone={tone} title={title} />
      {items.length ? <ol className="ml-4 list-decimal space-y-1 text-[12px] text-surface-700">{items.map((t, i) => <li key={i}>{t}</li>)}</ol> : <Empty />}
    </div>
  );
  return (
    <div className="space-y-4">
      {!data.meta.hasData && <Pending />}
      <Banner icon="check" tone="blue" title="Supervision des équipes" sub="Proportion de réponses « Oui » par question" />
      <section>
        <SectionBar icon="bars">Indicateurs clés</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="check" tone="green" label="Supervisions réalisées" value={s.kpi.realisees} sub={`${s.kpi.asCount} AS`} />
          <KpiTile icon="gauge" tone="blue" label="Proportion globale de « Oui »" value={pctTxt(s.kpi.ouiGlobalPct)} sub={`${s.kpi.questionsCount} questions`} />
          <KpiTile icon="erreurs" tone="red" label="Questions évaluées" value={s.kpi.questionsCount} sub="items de la checklist" />
          <KpiTile icon="reco" tone="violet" label="Aires supervisées" value={s.kpi.asCount} sub="sites supervisés" />
        </div>
      </section>
      <div className="card card-pad">
        <CardTitle icon="chart" tone="blue" title="Proportion de « Oui » par question (global)" />
        {s.ouiParQuestion.length ? <ProtoScoreBar horiz height={Math.max(260, s.ouiParQuestion.length * 22)} unit="%" max={100} cats={s.ouiParQuestion.map((q) => q.label)} vals={s.ouiParQuestion.map((q) => q.value)} /> : <Empty />}
      </div>
      <div className="card card-pad">
        <CardTitle icon="table" tone="navy" title="Proportion de « Oui » par question et par aire de santé (extrait)" />
        {s.ouiParQuestionAs.length && cols.length ? (
          <div className="overflow-x-auto"><table className="dtable">
            <thead><tr><th className="name">Aire de santé</th>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>{s.ouiParQuestionAs.map((r) => (
              <tr key={r.aire}><td className="name">{r.aire}</td>{cols.map((c) => { const v = r.values[c]; return <td key={c} style={{ background: heat(v) }}>{pctTxt(v)}</td>; })}</tr>
            ))}</tbody>
          </table></div>
        ) : <Empty />}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <ListCard icon="erreurs" tone="red" title="Top 7 problèmes prioritaires" items={s.topProblemes} />
        <ListCard icon="reco" tone="blue" title="Top 7 actions correctrices" items={s.topActions} />
        <ListCard icon="comment" tone="violet" title="Top 7 recommandations" items={s.topRecommandations} />
      </div>
    </div>
  );
}

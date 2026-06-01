"use client";

/* =========================================================================
   qualite.tsx — Onglet « Qualité des données » (contrôle qualité)
   Données LIVE KoboToolbox via /api/cqd (hook useCqd), filtrables par
   période / antenne / ZS / AS. Repli sur les données représentatives
   (data/cq-data) tant que Kobo est momentanément indisponible.
   ========================================================================= */
import { CQ } from "@/data/cq-data";
import { useCqd } from "@/lib/client/cqd-api";
import type { CqdBundle, ConcordanceClass } from "@/lib/cqd/types";
import { Icon } from "@/components/ui/Icon";
import { SectionBar } from "@/components/ui/Card";
import {
  C, TONES, Badge, KpiTile, CardTitle, ApprBadge, Banner,
} from "./proto";
import { ProtoGroupedBar, ProtoHBar } from "./charts";

/* ----------------------------- Helpers -------------------------------- */
const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const monthLabel = (m: string): string => {
  const x = m.match(/(\d{4})-(\d{2})/);
  return x ? `${MOIS[parseInt(x[2], 10) - 1]} ${x[1]}` : m;
};
const classLabel = (c: ConcordanceClass): string =>
  c === "sous" ? "Sous-rapportage" : c === "sur" ? "Sur-rapportage" : c === "normal" ? "Pas de discordance" : "—";
const okFromPct = (p: number | null): "Oui" | "Non" => (p !== null && p >= 50 ? "Oui" : "Non");
const Pct = ({ v, color }: { v: number | null; color?: string }) =>
  <b style={{ color: color ?? "inherit" }}>{v === null ? "—" : `${v}%`}</b>;
const Appr = ({ v }: { v: number | null }) => (v === null ? <span>—</span> : <ApprBadge p={v} />);

interface AntS { lab: string; snis: number; dhis2: number }
interface RowView {
  name: string; zone: string | null;
  concP3: number | null; classP3: string;
  concRR2: number | null; classRR2: string;
  errSD: number | null; errPR: number | null;
  registreOk: "Oui" | "Non"; pointageOk: "Oui" | "Non"; snisOk: "Oui" | "Non";
  enfIdent: number; enfRecup: number;
}
interface CsView {
  live: boolean; ess: string; months: string[];
  nbControles: number; nbAttendus: number;
  concP3: number | null; classP3: string; concRR2: number | null; classRR2: string; errSD: number | null;
  antS: AntS[];
  sources: { antigene: string; registre: number; pointage: number; snis: number; dhis2: number }[];
  outils: { registre: number | null; pointage: number | null; snis: number | null };
  enf: { identifies: number; retrouves: number; recuperes: number; aRecuperer: number };
  trend: { month: string; concP3: number | null; concRR2: number | null; errSD: number | null; errPR: number | null }[];
  rows: RowView[];
}

function csView(data: CqdBundle | undefined): CsView {
  const as = data?.levels.as;
  if (as && as.records > 0) {
    const antByName = (n: string) => as.antigenes.find((a) => a.antigene.toUpperCase().startsWith(n)) ?? { registre: 0, pointage: 0, snis: 0, dhis2: 0, antigene: n };
    return {
      live: true,
      ess: `${as.structuresControlees} CS contrôlé${as.structuresControlees > 1 ? "s" : ""}`,
      months: (data!.meta.months.length ? data!.meta.months : CQ.cs.rows[0].mois).map((m) => (m.includes("-") ? monthLabel(m) : m)),
      nbControles: as.structuresControlees,
      nbAttendus: CQ.cs.nbAttendus,
      concP3: as.concordanceP3.taux, classP3: classLabel(as.concordanceP3.classe),
      concRR2: as.concordanceRr2.taux, classRR2: classLabel(as.concordanceRr2.classe),
      errSD: as.erreurSnisDhis2,
      antS: ["PENTA1", "PENTA3", "RR1", "RR2"].map((n) => { const a = antByName(n); return { lab: n.replace("PENTA", "Penta"), snis: a.snis, dhis2: a.dhis2 }; }),
      sources: as.antigenes,
      outils: as.outils,
      enf: { identifies: as.enfants.identifies, retrouves: as.enfants.retrouves, recuperes: as.enfants.recuperes, aRecuperer: as.enfants.aRecuperer },
      trend: as.trend.map((t) => ({ month: monthLabel(t.month), concP3: t.concordanceP3, concRR2: t.concordanceRr2, errSD: t.erreurSnisDhis2, errPR: t.erreurPointageRegistre })),
      rows: as.parStructure.map((s) => ({
        name: s.name, zone: s.zone,
        concP3: s.concordanceP3, classP3: classLabel(s.classeP3),
        concRR2: s.concordanceRr2, classRR2: classLabel(s.classeRr2),
        errSD: s.erreurSnisDhis2, errPR: s.erreurPointageRegistre,
        registreOk: s.registreOk === null ? "Non" : s.registreOk ? "Oui" : "Non",
        pointageOk: s.pointageOk === null ? "Non" : s.pointageOk ? "Oui" : "Non",
        snisOk: s.snisOk === null ? "Non" : s.snisOk ? "Oui" : "Non",
        enfIdent: s.enfantsIdentifies, enfRecup: s.enfantsRecuperes,
      })),
    };
  }
  // Repli statique
  const cs = CQ.cs; const r0 = cs.rows[0];
  return {
    live: false, ess: r0.ess, months: CQ.moisDisponibles,
    nbControles: cs.nbControles, nbAttendus: cs.nbAttendus,
    concP3: r0.concPenta3, classP3: r0.classPenta3, concRR2: r0.concRR2, classRR2: r0.classRR2, errSD: r0.errSnisDhis2,
    antS: [["Penta1", r0.snis.p1, r0.dhis2.p1], ["Penta3", r0.snis.p3, r0.dhis2.p3], ["RR1", r0.snis.rr1, r0.dhis2.rr1], ["RR2", r0.snis.rr2, r0.dhis2.rr2]].map((a) => ({ lab: a[0] as string, snis: a[1] as number, dhis2: a[2] as number })),
    sources: ["p1", "p3", "rr1", "rr2"].map((k, i) => ({ antigene: ["PENTA1", "PENTA3", "RR1", "RR2"][i], registre: (r0.registre as any)[k], pointage: (r0.pointage as any)[k], snis: (r0.snis as any)[k], dhis2: (r0.dhis2 as any)[k] })),
    outils: { registre: r0.registreOk === "Oui" ? 100 : 0, pointage: r0.pointageOk === "Oui" ? 100 : 0, snis: r0.snisOk === "Oui" ? 100 : 0 },
    enf: { identifies: r0.enfIdentifies, retrouves: r0.enfRetrouves, recuperes: r0.enfRecuperes, aRecuperer: r0.enfRecup },
    trend: [],
    rows: cs.rows.map((r) => ({
      name: r.as, zone: r.zs, concP3: r.concPenta3, classP3: r.classPenta3, concRR2: r.concRR2, classRR2: r.classRR2,
      errSD: r.errSnisDhis2, errPR: r.errPointageRegistre, registreOk: r.registreOk, pointageOk: r.pointageOk, snisOk: r.snisOk,
      enfIdent: r.enfIdentifies, enfRecup: r.enfRecuperes,
    })),
  };
}

function TauxErrTable({ rows }: { rows: AntS[] }) {
  return (
    <table className="dtable">
      <thead><tr><th className="name">Antigène</th><th>SNIS</th><th>DHIS2</th><th>Concordance</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.lab}>
            <td className="name">{r.lab}</td><td>{r.snis}</td><td>{r.dhis2}</td>
            <td style={{ fontWeight: 800, color: r.snis === r.dhis2 ? C.green : C.red }}>{r.snis === r.dhis2 ? "Oui" : "Non"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ---------------- Vue globale — Centres de santé ---------------- */
export function CqGlobalCS() {
  const { data } = useCqd();
  const v = csView(data);
  const tools: [string, "Oui" | "Non", number | null][] = [
    ["Registre de vaccination", okFromPct(v.outils.registre), v.outils.registre],
    ["Feuilles de pointage", okFromPct(v.outils.pointage), v.outils.pointage],
    ["Canevas SNIS", okFromPct(v.outils.snis), v.outils.snis],
  ];
  const enf: [string, number, "child" | "clip" | "people" | "check"][] = [
    ["Enfants à récupérer (identifiés)", v.enf.aRecuperer, "child"], ["Identifiés précédemment", v.enf.identifies, "clip"],
    ["Retrouvés par les relais", v.enf.retrouves, "people"], ["Effectivement récupérés", v.enf.recuperes, "check"],
  ];
  const pctRecup = v.enf.identifies > 0 ? Math.round(v.enf.recuperes / v.enf.identifies * 100) : 0;

  return (
    <div className="space-y-4">
      <Banner icon="database" tone="blue" title="Vue globale — qualité des données de vaccination des centres de santé"
        sub={<>Synchronisé depuis KoboToolbox · Période vérifiée : <b>{v.months.join(", ")}</b> · {v.nbControles} CS contrôlé{v.nbControles > 1 ? "s" : ""}{v.live ? "" : " (données représentatives)"}</>} />

      <section>
        <SectionBar icon="bars">Indicateurs globaux de qualité</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="clinic" tone="navy" label={<>CS ayant bénéficié<br />du contrôle qualité</>} value={v.nbControles} sub={`sur ${v.nbAttendus} attendus`} />
          <KpiTile icon="scale" tone="green" label={<>Concordance globale<br />PENTA3 (DHIS2/Registre)</>} value={(v.concP3 ?? "—") + "%"} sub={v.classP3} />
          <KpiTile icon="scale" tone="violet" label={<>Concordance globale<br />RR2 (DHIS2/Registre)</>} value={(v.concRR2 ?? "—") + "%"} sub={v.classRR2} />
          <KpiTile icon="alert" tone="orange" label={<>Taux d'erreur transcription<br />SNIS / DHIS2</>} value={(v.errSD ?? "—") + "%"} sub="PENTA1·3 / RR1·2" />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card card-pad">
          <CardTitle icon="scale" tone="orange" title="Taux d'erreur de transcription SNIS → DHIS2" sub="Discordances sur les 4 antigènes" />
          <TauxErrTable rows={v.antS} />
          <div className="mt-2 flex items-center justify-between rounded-lg px-3 py-2 text-[11.5px]" style={{ background: "#fff5e4" }}>
            <span className="font-semibold text-surface-700">Taux d'erreur = discordances / comparaisons</span>
            <b style={{ color: C.orange, fontSize: 15 }}>{v.errSD ?? "—"}%</b>
          </div>
        </div>
        <div className="card card-pad">
          <CardTitle icon="clip" tone="violet" title="Remplissage des outils de gestion" sub="% des CS avec outil correctement rempli" />
          <div className="mt-1 space-y-2">
            {tools.map((t) => {
              const ok = t[1] === "Oui";
              return (
                <div key={t[0]} className="flex items-center gap-2.5">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-[7px]" style={{ background: ok ? TONES.green.bg : TONES.red.bg, color: ok ? C.green : C.red }}>
                    <Icon name={ok ? "check" : "alert"} className="h-3.5 w-3.5" strokeWidth={2.4} />
                  </span>
                  <span className="flex-1 text-[12.5px] font-semibold text-surface-800">{t[0]}</span>
                  <span className="badge-appr" style={{ background: ok ? TONES.green.bg : TONES.red.bg, color: ok ? C.green : C.red }}>{t[2] === null ? (ok ? "Correctement rempli" : "Mal rempli") : `${t[2]}% conformes`}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-surface-500">
            Concordance PENTA3 : <Appr v={v.concP3} /> · RR2 : <Appr v={v.concRR2} />
          </div>
        </div>
      </div>

      <section>
        <SectionBar icon="component">Comparaison des sources de données (somme des CS)</SectionBar>
        <div className="card card-pad">
          <ProtoGroupedBar height={230} cats={["PENTA1", "PENTA3", "RR1", "RR2"]} series={[
            { name: "Registre", data: v.sources.map((s) => s.registre) },
            { name: "Feuille de pointage", data: v.sources.map((s) => s.pointage) },
            { name: "SNIS", data: v.sources.map((s) => s.snis) },
            { name: "DHIS2", data: v.sources.map((s) => s.dhis2) },
          ]} />
        </div>
      </section>

      {v.trend.length > 1 && (
        <section>
          <SectionBar icon="time">Progression de la concordance et du taux d'erreur dans le temps</SectionBar>
          <div className="card card-pad">
            <table className="dtable">
              <thead><tr><th className="name">Indicateur</th>{v.trend.map((t) => <th key={t.month}>{t.month}</th>)}</tr></thead>
              <tbody>
                <tr><td className="name">Concordance PENTA3</td>{v.trend.map((t) => <td key={t.month}><Appr v={t.concP3} /></td>)}</tr>
                <tr><td className="name">Concordance RR2</td>{v.trend.map((t) => <td key={t.month}><Appr v={t.concRR2} /></td>)}</tr>
                <tr><td className="name">Taux d'erreur SNIS / DHIS2</td>{v.trend.map((t) => <td key={t.month}><Pct v={t.errSD} color={C.orange} /></td>)}</tr>
                <tr><td className="name">Taux d'erreur pointage / registre</td>{v.trend.map((t) => <td key={t.month}><Pct v={t.errPR} color={C.red} /></td>)}</tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <SectionBar icon="child">Enfants perdus de vue</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {enf.map((e) => <KpiTile key={e[0]} icon={e[2]} tone="teal" label={e[0]} value={e[1]} />)}
        </div>
        <div className="card card-pad mt-3 flex items-center gap-3" style={{ background: TONES.green.bg, borderColor: TONES.green.border }}>
          <Badge icon="check" tone="green" size={38} />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: TONES.green.text }}>% global des enfants identifiés précédemment récupérés</div>
            <div className="text-[22px] font-extrabold" style={{ color: TONES.green.text }}>{pctRecup}%</div>
            <div className="text-[11.5px] text-surface-700">{v.enf.recuperes} récupérés sur {v.enf.identifies} identifiés précédemment</div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------------- Détail par centre de santé ---------------- */
export function CqDetailCS() {
  const { data } = useCqd();
  const v = csView(data);
  const EvoTable = ({ title, icon, tone, col }: { title: string; icon: "scale" | "alert"; tone: "green" | "violet" | "orange" | "red"; col: (r: RowView) => React.ReactNode }) => (
    <div className="card card-pad">
      <CardTitle icon={icon} tone={tone} title={title} sub="Évolution par mois" />
      <table className="dtable">
        <thead><tr><th className="name">Centre de santé</th>{v.months.map((m) => <th key={m}>{m}</th>)}</tr></thead>
        <tbody>
          {v.rows.map((r) => (
            <tr key={r.name}><td className="name">{r.name}</td>{v.months.map((m) => <td key={m}>{col(r)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  const toolsScore: [string, number][] = v.rows.map((r) => {
    const ok = [r.registreOk, r.pointageOk, r.snisOk].filter((x) => x === "Oui").length;
    return [r.name, Math.round(ok / 3 * 100)];
  });
  const enfByCS: [string, number][] = v.rows.map((r) => [r.name, r.enfIdent > 0 ? Math.round(r.enfRecup / r.enfIdent * 100) : 0]);

  return (
    <div className="space-y-4">
      <Banner icon="clinic" tone="violet" title="Qualité des données de vaccination — par centre de santé"
        sub={`Tableaux d'évolution de l'appréciation & des taux d'erreur, par mois et par CS · ${v.nbControles} CS`} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <EvoTable title="Appréciation concordance PENTA3 (DHIS2/Registre)" icon="scale" tone="green" col={(r) => <Appr v={r.concP3} />} />
        <EvoTable title="Appréciation concordance RR2 (DHIS2/Registre)" icon="scale" tone="violet" col={(r) => <Appr v={r.concRR2} />} />
        <EvoTable title="Taux d'erreur transcription SNIS / DHIS2" icon="alert" tone="orange" col={(r) => <Pct v={r.errSD} color={C.orange} />} />
        <EvoTable title="Taux d'erreur transcription feuille pointage / registre" icon="alert" tone="red" col={(r) => <Pct v={r.errPR} color={C.red} />} />
      </div>
      <section>
        <SectionBar icon="bars">Outils de gestion correctement remplis — par CS</SectionBar>
        <div className="card card-pad"><ProtoHBar height={Math.max(150, toolsScore.length * 42)} maxName={120} rows={toolsScore} /></div>
      </section>
      <section>
        <SectionBar icon="child">Enfants perdus de vue identifiés précédemment récupérés — par CS</SectionBar>
        <div className="card card-pad"><ProtoHBar height={Math.max(150, enfByCS.length * 42)} maxName={120} rows={enfByCS} /></div>
      </section>
    </div>
  );
}

/* ---------------- Par zones de santé ---------------- */
export function CqZS() {
  const { data } = useCqd();
  const zsB = data?.levels.zs;
  const live = !!zsB && zsB.records > 0;
  const staticRow = CQ.zs.rows[0];

  const nbControles = live ? zsB!.structuresControlees : CQ.zs.nbControles;
  const nbAttendus = CQ.zs.nbAttendus;
  const pctControle = nbAttendus > 0 ? Math.round(nbControles / nbAttendus * 100) : 0;
  const concP3 = live ? zsB!.concordanceP3.taux : staticRow.concPenta3;
  const classP3 = live ? classLabel(zsB!.concordanceP3.classe) : staticRow.classPenta3;
  const concRR2 = live ? zsB!.concordanceRr2.taux : staticRow.concRR2;
  const classRR2 = live ? classLabel(zsB!.concordanceRr2.classe) : staticRow.classRR2;
  const errSD = live ? zsB!.erreurSnisDhis2 : staticRow.errSnisDhis2;
  const antByName = (n: string) => live ? (zsB!.antigenes.find((a) => a.antigene.toUpperCase().startsWith(n)) ?? { snis: 0, dhis2: 0 }) : null;
  const antS: AntS[] = live
    ? ["PENTA1", "PENTA3", "RR1", "RR2"].map((n) => { const a = antByName(n)!; return { lab: n.replace("PENTA", "Penta"), snis: a.snis, dhis2: a.dhis2 }; })
    : [["Penta1", staticRow.snis.p1, staticRow.dhis2.p1], ["Penta3", staticRow.snis.p3, staticRow.dhis2.p3], ["RR1", staticRow.snis.rr1, staticRow.dhis2.rr1], ["RR2", staticRow.snis.rr2, staticRow.dhis2.rr2]].map((a) => ({ lab: a[0] as string, snis: a[1] as number, dhis2: a[2] as number }));
  const rows = live
    ? zsB!.parStructure.map((s) => ({ zs: s.name, concP3: s.concordanceP3, classP3: classLabel(s.classeP3), concRR2: s.concordanceRr2, classRR2: classLabel(s.classeRr2), errSD: s.erreurSnisDhis2 }))
    : [{ zs: staticRow.zs, concP3: staticRow.concPenta3, classP3: staticRow.classPenta3, concRR2: staticRow.concRR2, classRR2: staticRow.classRR2, errSD: staticRow.errSnisDhis2 }];
  const subInfo = live
    ? <>Antenne PEV · {nbControles} ZS contrôlée{nbControles > 1 ? "s" : ""} · {(data!.meta.months.length ? data!.meta.months.map(monthLabel) : CQ.zs.rows[0].mois).join(", ")}</>
    : <>ZS <b>{staticRow.zs}</b> · Superviseur {staticRow.superviseur} · Aires vérifiées : {staticRow.airesVerifiees.join(", ")} · {staticRow.mois.join("/")} 2026</>;

  return (
    <div className="space-y-4">
      <Banner icon="hospital" tone="navy" title="Qualité des données de vaccination — par zone de santé" sub={subInfo} />
      <section>
        <SectionBar icon="bars">Indicateurs globaux qualité — niveau ZS</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="hospital" tone="navy" label={<>ZS ayant bénéficié<br />du contrôle qualité</>} value={nbControles} sub={`sur ${nbAttendus} attendues (${pctControle}%)`} />
          <KpiTile icon="scale" tone="green" label={<>Concordance PENTA3<br />(DHIS2 / SNIS)</>} value={(concP3 ?? "—") + "%"} sub={classP3} />
          <KpiTile icon="scale" tone="violet" label={<>Concordance RR2<br />(DHIS2 / SNIS)</>} value={(concRR2 ?? "—") + "%"} sub={classRR2} />
          <KpiTile icon="alert" tone="orange" label={<>Taux d'erreur transcription<br />SNIS / DHIS2</>} value={(errSD ?? "—") + "%"} sub="PENTA1·3 / RR1·2" />
        </div>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card card-pad">
          <CardTitle icon="scale" tone="orange" title="Taux d'erreur transcription SNIS → DHIS2" sub="Par ZS et par mois" />
          <TauxErrTable rows={antS} />
          <div className="mt-2 flex items-center justify-between rounded-lg px-3 py-2 text-[11.5px]" style={{ background: "#fff5e4" }}>
            <span className="font-semibold text-surface-700">Discordances / comparaisons</span>
            <b style={{ color: C.orange, fontSize: 15 }}>{errSD ?? "—"}%</b>
          </div>
        </div>
        <div className="card card-pad">
          <CardTitle icon="component" tone="navy" title="Comparaison SNIS / DHIS2 (somme des CS)" sub="PENTA1 · PENTA3 · RR1 · RR2" />
          <ProtoGroupedBar height={185} colors={[C.orange, C.blue]} cats={["PENTA1", "PENTA3", "RR1", "RR2"]} series={[
            { name: "SNIS", data: antS.map((a) => a.snis) },
            { name: "DHIS2", data: antS.map((a) => a.dhis2) },
          ]} />
        </div>
      </div>
      <section>
        <SectionBar icon="component">Concordance & taux d'erreur par ZS</SectionBar>
        <div className="card card-pad">
          <table className="dtable">
            <thead><tr>
              <th className="name">Zone de santé</th><th>Concordance PENTA3</th><th>Appréciation</th>
              <th>Concordance RR2</th><th>Appréciation</th><th>Taux d'erreur SNIS/DHIS2</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.zs}>
                  <td className="name">{r.zs}</td><td>{r.concP3 ?? "—"}%</td><td><Appr v={r.concP3} /></td>
                  <td>{r.concRR2 ?? "—"}%</td><td><Appr v={r.concRR2} /></td>
                  <td style={{ color: C.orange, fontWeight: 800 }}>{r.errSD ?? "—"}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 text-[11px] text-surface-500">Appréciation concordance : 95–105 % = pas de discordance · &lt; 95 % = sous-rapportage · &gt; 105 % = sur-rapportage.</div>
        </div>
      </section>
    </div>
  );
}

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

interface AntCmp { lab: string; a: number; b: number }
interface RowView {
  name: string; zone: string | null;
  concP3: number | null; concRR2: number | null;
  errPR: number | null; errRS: number | null;
  registreOk: "Oui" | "Non"; pointageOk: "Oui" | "Non"; snisOk: "Oui" | "Non";
  enfIdent: number; enfRecup: number;
}
interface CsView {
  live: boolean; ess: string; months: string[];
  nbControles: number; nbAttendus: number;
  /** Taux d'erreur de transcription — il n'y a pas de saisie DHIS2 au niveau CS. */
  errPR: number | null; errRS: number | null;
  /** Sommes par antigène et par source (registre / feuille de pointage / SNIS). */
  sources: { antigene: string; registre: number; pointage: number; snis: number }[];
  outils: { registre: number | null; pointage: number | null; snis: number | null };
  enf: { identifies: number; retrouves: number; recuperes: number; aRecuperer: number };
  trend: { month: string; errPR: number | null; errRS: number | null }[];
  rows: RowView[];
}

type AntVals = { p1: number; p3: number; rr1: number; rr2: number };
const ANT_KEYS: (keyof AntVals)[] = ["p1", "p3", "rr1", "rr2"];
/** Taux d'erreur = non-concordances / antigènes comparés (100 % si tous discordent). */
function discAnt(a: AntVals, b: AntVals): number | null {
  let comp = 0, disc = 0;
  for (const k of ANT_KEYS) { const x = a[k], y = b[k]; if (x > 0 || y > 0) { comp++; if (x !== y) disc++; } }
  return comp > 0 ? Math.round(disc / comp * 100) : null;
}

function csView(data: CqdBundle | undefined): CsView {
  const as = data?.levels.as;
  if (as && as.records > 0) {
    return {
      live: true,
      ess: `${as.structuresControlees} CS contrôlé${as.structuresControlees > 1 ? "s" : ""}`,
      months: (data!.meta.months.length ? data!.meta.months : CQ.cs.rows[0].mois).map((m) => (m.includes("-") ? monthLabel(m) : m)),
      nbControles: as.structuresControlees,
      nbAttendus: CQ.cs.nbAttendus,
      errPR: as.erreurPointageRegistre,
      errRS: as.erreurRegistreSnis,
      sources: as.antigenes.map((a) => ({ antigene: a.antigene, registre: a.registre, pointage: a.pointage, snis: a.snis })),
      outils: as.outils,
      enf: { identifies: as.enfants.identifies, retrouves: as.enfants.retrouves, recuperes: as.enfants.recuperes, aRecuperer: as.enfants.aRecuperer },
      trend: as.trend.map((t) => ({ month: monthLabel(t.month), errPR: t.erreurPointageRegistre, errRS: t.erreurRegistreSnis })),
      rows: as.parStructure.map((s) => ({
        name: s.name, zone: s.zone,
        concP3: s.concordanceRsP3, concRR2: s.concordanceRsRr2,
        errPR: s.erreurPointageRegistre, errRS: s.erreurRegistreSnis,
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
    errPR: discAnt(r0.pointage, r0.registre),
    errRS: discAnt(r0.registre, r0.snis),
    sources: ["p1", "p3", "rr1", "rr2"].map((k, i) => ({ antigene: ["PENTA1", "PENTA3", "RR1", "RR2"][i], registre: (r0.registre as any)[k], pointage: (r0.pointage as any)[k], snis: (r0.snis as any)[k] })),
    outils: { registre: r0.registreOk === "Oui" ? 100 : 0, pointage: r0.pointageOk === "Oui" ? 100 : 0, snis: r0.snisOk === "Oui" ? 100 : 0 },
    enf: { identifies: r0.enfIdentifies, retrouves: r0.enfRetrouves, recuperes: r0.enfRecuperes, aRecuperer: r0.enfRecup },
    trend: [],
    rows: cs.rows.map((r) => ({
      name: r.as, zone: r.zs,
      concP3: r.snis.p3 > 0 ? Math.round((r.registre.p3 / r.snis.p3) * 1000) / 10 : null,
      concRR2: r.snis.rr2 > 0 ? Math.round((r.registre.rr2 / r.snis.rr2) * 1000) / 10 : null,
      errPR: discAnt(r.pointage, r.registre), errRS: discAnt(r.registre, r.snis),
      registreOk: r.registreOk, pointageOk: r.pointageOk, snisOk: r.snisOk,
      enfIdent: r.enfIdentifies, enfRecup: r.enfRecuperes,
    })),
  };
}

function CompareTable({ rows, colA, colB }: { rows: AntCmp[]; colA: string; colB: string }) {
  return (
    <table className="dtable">
      <thead><tr><th className="name">Antigène</th><th>{colA}</th><th>{colB}</th><th>Concordance</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.lab}>
            <td className="name">{r.lab}</td><td>{r.a}</td><td>{r.b}</td>
            <td style={{ fontWeight: 800, color: r.a === r.b ? C.green : C.red }}>{r.a === r.b ? "Oui" : "Non"}</td>
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
  const lab = (n: string) => n.replace("PENTA", "Penta");
  const antPR: AntCmp[] = v.sources.map((s) => ({ lab: lab(s.antigene), a: s.pointage, b: s.registre }));
  const antRS: AntCmp[] = v.sources.map((s) => ({ lab: lab(s.antigene), a: s.registre, b: s.snis }));

  return (
    <div className="space-y-4">
      <Banner icon="database" tone="blue" title="Vue globale — qualité des données de vaccination des centres de santé"
        sub={<>Synchronisé depuis KoboToolbox · Période vérifiée : <b>{v.months.join(", ")}</b> · {v.nbControles} CS contrôlé{v.nbControles > 1 ? "s" : ""}{v.live ? "" : " (données représentatives)"}</>} />

      <section>
        <SectionBar icon="bars">Indicateurs globaux de qualité</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="clinic" tone="navy" label={<>CS ayant bénéficié<br />du contrôle qualité</>} value={v.nbControles} sub={`sur ${v.nbAttendus} attendus`} />
          <KpiTile icon="alert" tone="orange" label={<>Taux d'erreur transcription<br />feuille de pointage / registre</>} value={(v.errPR ?? "—") + "%"} sub="PENTA1·3 / RR1·2" />
          <KpiTile icon="alert" tone="red" label={<>Taux d'erreur transcription<br />registre / SNIS</>} value={(v.errRS ?? "—") + "%"} sub="PENTA1·3 / RR1·2" />
          <KpiTile icon="check" tone="green" label={<>Enfants identifiés<br />précédemment récupérés</>} value={pctRecup + "%"} sub={`${v.enf.recuperes} / ${v.enf.identifies}`} />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card card-pad">
          <CardTitle icon="scale" tone="orange" title="Taux d'erreur de transcription feuille de pointage → registre" sub="Non-concordances / antigènes comparés" />
          <CompareTable rows={antPR} colA="Pointage" colB="Registre" />
          <div className="mt-2 flex items-center justify-between rounded-lg px-3 py-2 text-[11.5px]" style={{ background: "#fff5e4" }}>
            <span className="font-semibold text-surface-700">Taux d'erreur = non-concordances / antigènes comparés</span>
            <b style={{ color: C.orange, fontSize: 15 }}>{v.errPR ?? "—"}%</b>
          </div>
        </div>
        <div className="card card-pad">
          <CardTitle icon="scale" tone="red" title="Taux d'erreur de transcription registre → SNIS" sub="Non-concordances / antigènes comparés" />
          <CompareTable rows={antRS} colA="Registre" colB="SNIS" />
          <div className="mt-2 flex items-center justify-between rounded-lg px-3 py-2 text-[11.5px]" style={{ background: "#fdecec" }}>
            <span className="font-semibold text-surface-700">Taux d'erreur = non-concordances / antigènes comparés</span>
            <b style={{ color: C.red, fontSize: 15 }}>{v.errRS ?? "—"}%</b>
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <CardTitle icon="clip" tone="violet" title="Remplissage des outils de gestion" sub="% des CS avec outil correctement rempli" />
        <div className="mt-1 grid grid-cols-1 md:grid-cols-3 gap-2">
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
      </div>

      <section>
        <SectionBar icon="component">Comparaison des sources de données (somme des CS)</SectionBar>
        <div className="card card-pad">
          <ProtoGroupedBar height={230} colors={[C.violet, C.orange, C.green]} cats={["PENTA1", "PENTA3", "RR1", "RR2"]} series={[
            { name: "Registre", data: v.sources.map((s) => s.registre) },
            { name: "Feuille de pointage", data: v.sources.map((s) => s.pointage) },
            { name: "SNIS", data: v.sources.map((s) => s.snis) },
          ]} />
        </div>
      </section>

      {v.trend.length > 1 && (
        <section>
          <SectionBar icon="time">Progression du taux d'erreur de transcription dans le temps</SectionBar>
          <div className="card card-pad">
            <table className="dtable">
              <thead><tr><th className="name">Indicateur</th>{v.trend.map((t) => <th key={t.month}>{t.month}</th>)}</tr></thead>
              <tbody>
                <tr><td className="name">Taux d'erreur pointage / registre</td>{v.trend.map((t) => <td key={t.month}><Pct v={t.errPR} color={C.orange} /></td>)}</tr>
                <tr><td className="name">Taux d'erreur registre / SNIS</td>{v.trend.map((t) => <td key={t.month}><Pct v={t.errRS} color={C.red} /></td>)}</tr>
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
      <CardTitle icon={icon} tone={tone} title={title} sub="Par centre de santé" />
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
        sub={`Appréciation de la concordance & taux d'erreur de transcription, par mois et par CS · ${v.nbControles} CS`} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <EvoTable title="Appréciation concordance PENTA3 (Registre/SNIS)" icon="scale" tone="green" col={(r) => <Appr v={r.concP3} />} />
        <EvoTable title="Appréciation concordance RR2 (Registre/SNIS)" icon="scale" tone="violet" col={(r) => <Appr v={r.concRR2} />} />
        <EvoTable title="Taux d'erreur transcription feuille de pointage / registre" icon="alert" tone="orange" col={(r) => <Pct v={r.errPR} color={C.orange} />} />
        <EvoTable title="Taux d'erreur transcription registre / SNIS" icon="alert" tone="red" col={(r) => <Pct v={r.errRS} color={C.red} />} />
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
  const antS: AntCmp[] = live
    ? ["PENTA1", "PENTA3", "RR1", "RR2"].map((n) => { const a = antByName(n)!; return { lab: n.replace("PENTA", "Penta"), a: a.snis, b: a.dhis2 }; })
    : [["Penta1", staticRow.snis.p1, staticRow.dhis2.p1], ["Penta3", staticRow.snis.p3, staticRow.dhis2.p3], ["RR1", staticRow.snis.rr1, staticRow.dhis2.rr1], ["RR2", staticRow.snis.rr2, staticRow.dhis2.rr2]].map((x) => ({ lab: x[0] as string, a: x[1] as number, b: x[2] as number }));
  // Base de calcul du taux d'erreur de transcription, explicitée pour lever
  // toute ambiguïté avec la colonne « Concordance » (qui est un drapeau par
  // antigène). En live (formulaire de sommes ZS) le taux porte sur les antigènes
  // comparés ; en données de démonstration sur les valeurs vérifiées champ par
  // champ — d'où un dénominateur différent (et un % qui n'est pas 4/4).
  const errBase = live
    ? {
        n: antS.filter((x) => (x.a > 0 || x.b > 0) && x.a !== x.b).length,
        tot: antS.filter((x) => x.a > 0 || x.b > 0).length,
        unit: "antigènes comparés",
      }
    : { n: staticRow.nbDiscord, tot: staticRow.nbValVerif, unit: "valeurs vérifiées" };
  // Antigènes discordants (sommes SNIS ≠ DHIS2) — c'est exactement ce que montre
  // la colonne « Concordance ». Métrique volontairement distincte du taux d'erreur
  // de transcription (indicateur dédié), qui porte sur un autre dénominateur.
  const antDisc = antS.filter((x) => x.a !== x.b).length;
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
          <KpiTile icon="alert" tone="orange" label={<>Taux d'erreur transcription<br />SNIS / DHIS2</>} value={(errSD ?? "—") + "%"} sub={`${errBase.n} / ${errBase.tot} ${errBase.unit}`} />
        </div>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card card-pad">
          <CardTitle icon="scale" tone="orange" title="Concordance SNIS / DHIS2 par antigène" sub="Comparaison des sommes — SNIS vs DHIS2" />
          <CompareTable rows={antS} colA="SNIS" colB="DHIS2" />
          <div className="mt-2 flex items-center justify-between rounded-lg px-3 py-2 text-[11.5px]" style={{ background: "#fff5e4" }}>
            <span className="font-semibold text-surface-700">Antigènes discordants</span>
            <b style={{ color: C.orange, fontSize: 15 }}>{antDisc} / {antS.length}</b>
          </div>
          <div className="mt-1 text-[10.5px] leading-snug text-surface-500">Un « <b>Non</b> » signale que le total SNIS ≠ total DHIS2 pour l'antigène, <b>même pour un écart d'une seule dose</b> : c'est un repère oui/non, pas l'ampleur de l'écart. Pour le volume réel, voir la <b>concordance</b> (DHIS2 ÷ SNIS) ci-dessous.</div>
        </div>
        <div className="card card-pad">
          <CardTitle icon="component" tone="navy" title="Comparaison SNIS / DHIS2 (somme des CS)" sub="PENTA1 · PENTA3 · RR1 · RR2" />
          <ProtoGroupedBar height={185} colors={[C.orange, C.blue]} cats={["PENTA1", "PENTA3", "RR1", "RR2"]} series={[
            { name: "SNIS", data: antS.map((x) => x.a) },
            { name: "DHIS2", data: antS.map((x) => x.b) },
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
          <div className="mt-2 rounded-lg px-3 py-2 text-[11px] leading-relaxed text-surface-600" style={{ background: "#f1f5f9" }}>
            <b>Deux indicateurs différents — ils ne s'additionnent pas :</b><br />
            • <b>Concordance</b> (PENTA3, RR2) = DHIS2 ÷ SNIS → mesure l'<b>ampleur</b> de l'écart de volume. Ex. 89,7 % = il manque ~10 % des doses dans DHIS2.<br />
            • <b>Taux d'erreur SNIS/DHIS2</b> = part des antigènes dont les totaux <b>diffèrent, ne serait-ce que d'une dose</b> (ici 4 sur 4 = 100 %). C'est un comptage oui/non, pas un volume.<br />
            Une concordance élevée (~89 %) peut donc coexister avec 100 % d'antigènes discordants : tous les antigènes diffèrent un peu, mais l'écart global reste modéré.
          </div>
          <div className="mt-2 text-[11px] text-surface-500">Appréciation concordance : 95–105 % = pas de discordance · &lt; 95 % = sous-rapportage · &gt; 105 % = sur-rapportage.</div>
        </div>
      </section>
    </div>
  );
}

"use client";

/* =========================================================================
   qualite.tsx — Onglet « Qualité des données » (contrôle qualité)
   Fidèle à apercu/qualite.js — 3 sous-pages.
   Données réelles KOBO (assets Contrôle qualité ZS / CS).
   ========================================================================= */
import { CQ } from "@/data/cq-data";
import { Icon } from "@/components/ui/Icon";
import { SectionBar } from "@/components/ui/Card";
import {
  C, TONES, cotColor, Badge, KpiTile, CardTitle, ApprBadge, Banner,
} from "./proto";
import { ProtoGroupedBar, ProtoHBar } from "./charts";

function TauxErrTable({ rows }: { rows: { lab: string; snis: number; dhis2: number }[] }) {
  return (
    <table className="grid">
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
  const cs = CQ.cs;
  const row = cs.rows[0];
  const antS = [["Penta1", row.snis.p1, row.dhis2.p1], ["Penta3", row.snis.p3, row.dhis2.p3], ["RR1", row.snis.rr1, row.dhis2.rr1], ["RR2", row.snis.rr2, row.dhis2.rr2]]
    .map((a) => ({ lab: a[0] as string, snis: a[1] as number, dhis2: a[2] as number }));
  const tools: [string, "Oui" | "Non"][] = [["Registre de vaccination", row.registreOk], ["Feuilles de pointage", row.pointageOk], ["Canevas SNIS", row.snisOk]];
  const enf: [string, number, "child" | "clip" | "people" | "check"][] = [
    ["Enfants à récupérer (identifiés)", row.enfRecup, "child"], ["Identifiés précédemment", row.enfIdentifies, "clip"],
    ["Retrouvés par les relais", row.enfRetrouves, "people"], ["Effectivement récupérés", row.enfRecuperes, "check"],
  ];
  const pctRecup = Math.round(row.enfRecuperes / row.enfIdentifies * 100);

  return (
    <div className="space-y-4">
      <Banner icon="database" tone="blue" title="Vue globale — qualité des données de vaccination des centres de santé"
        sub={<>Synchronisé depuis KoboToolbox · Période vérifiée : <b>{CQ.moisDisponibles.join(", ")}</b> · 1 soumission CS disponible ({row.ess})</>} />

      <section>
        <SectionBar icon="bars">Indicateurs globaux de qualité</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="clinic" tone="navy" label={<>CS ayant bénéficié<br />du contrôle qualité</>} value={cs.nbControles} sub={`sur ${cs.nbAttendus} attendus`} />
          <KpiTile icon="scale" tone="green" label={<>Concordance globale<br />PENTA3 (DHIS2/Registre)</>} value={row.concPenta3 + "%"} sub={row.classPenta3} />
          <KpiTile icon="scale" tone="violet" label={<>Concordance globale<br />RR2 (DHIS2/Registre)</>} value={row.concRR2 + "%"} sub={row.classRR2} />
          <KpiTile icon="alert" tone="orange" label={<>Taux d'erreur transcription<br />SNIS / DHIS2</>} value={row.errSnisDhis2 + "%"} sub="PENTA1·3 / RR1·2" />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card card-pad">
          <CardTitle icon="scale" tone="orange" title="Taux d'erreur de transcription SNIS → DHIS2" sub="Discordances sur les 4 antigènes" />
          <TauxErrTable rows={antS} />
          <div className="mt-2 flex items-center justify-between rounded-lg px-3 py-2 text-[11.5px]" style={{ background: "#fff5e4" }}>
            <span className="font-semibold text-surface-700">Taux d'erreur = discordances / comparaisons</span>
            <b style={{ color: C.orange, fontSize: 15 }}>{row.errSnisDhis2}%</b>
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
                  <span className="badge-appr" style={{ background: ok ? TONES.green.bg : TONES.red.bg, color: ok ? C.green : C.red }}>{ok ? "Correctement rempli" : "Mal rempli"}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-surface-500">
            Concordance PENTA3 : <ApprBadge p={row.concPenta3} /> · RR2 : <ApprBadge p={row.concRR2} />
          </div>
        </div>
      </div>

      <section>
        <SectionBar icon="component">Comparaison des sources de données (somme des CS)</SectionBar>
        <div className="card card-pad">
          <ProtoGroupedBar height={230} cats={["PENTA1", "PENTA3", "RR1", "RR2"]} series={[
            { name: "Registre", data: [row.registre.p1, row.registre.p3, row.registre.rr1, row.registre.rr2] },
            { name: "Feuille de pointage", data: [row.pointage.p1, row.pointage.p3, row.pointage.rr1, row.pointage.rr2] },
            { name: "SNIS", data: [row.snis.p1, row.snis.p3, row.snis.rr1, row.snis.rr2] },
            { name: "DHIS2", data: [row.dhis2.p1, row.dhis2.p3, row.dhis2.rr1, row.dhis2.rr2] },
          ]} />
        </div>
      </section>

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
            <div className="text-[11.5px] text-surface-700">{row.enfRecuperes} récupérés sur {row.enfIdentifies} identifiés précédemment</div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------------- Détail par centre de santé ---------------- */
export function CqDetailCS() {
  const cs = CQ.cs;
  const EvoTable = ({ title, icon, tone, col }: { title: string; icon: "scale" | "alert"; tone: "green" | "violet" | "orange" | "red"; col: (r: typeof cs.rows[0]) => React.ReactNode }) => (
    <div className="card card-pad">
      <CardTitle icon={icon} tone={tone} title={title} sub="Évolution par mois" />
      <table className="grid">
        <thead><tr><th className="name">Centre de santé</th>{CQ.moisDisponibles.map((m) => <th key={m}>{m}</th>)}</tr></thead>
        <tbody>
          {cs.rows.map((r) => (
            <tr key={r.as}><td className="name">{r.as}</td>{CQ.moisDisponibles.map((m) => <td key={m}>{col(r)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  const toolsScore: [string, number][] = cs.rows.map((r) => {
    const ok = [r.registreOk, r.pointageOk, r.snisOk].filter((x) => x === "Oui").length;
    return [r.as, Math.round(ok / 3 * 100)];
  });
  const enfByCS: [string, number][] = cs.rows.map((r) => [r.as, Math.round(r.enfRecuperes / r.enfIdentifies * 100)]);

  return (
    <div className="space-y-4">
      <Banner icon="clinic" tone="violet" title="Qualité des données de vaccination — par centre de santé"
        sub="Tableaux d'évolution de l'appréciation & des taux d'erreur, par mois et par CS" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <EvoTable title="Appréciation concordance PENTA3 (DHIS2/Registre)" icon="scale" tone="green" col={(r) => <ApprBadge p={r.concPenta3} />} />
        <EvoTable title="Appréciation concordance RR2 (DHIS2/Registre)" icon="scale" tone="violet" col={(r) => <ApprBadge p={r.concRR2} />} />
        <EvoTable title="Taux d'erreur transcription SNIS / DHIS2" icon="alert" tone="orange" col={(r) => <b style={{ color: C.orange }}>{r.errSnisDhis2}%</b>} />
        <EvoTable title="Taux d'erreur transcription feuille pointage / registre" icon="alert" tone="red" col={(r) => <b style={{ color: C.red }}>{r.errPointageRegistre}%</b>} />
      </div>
      <section>
        <SectionBar icon="bars">Outils de gestion correctement remplis — par CS</SectionBar>
        <div className="card card-pad"><ProtoHBar height={160} maxName={120} rows={toolsScore} /></div>
      </section>
      <section>
        <SectionBar icon="child">Enfants perdus de vue identifiés précédemment récupérés — par CS</SectionBar>
        <div className="card card-pad"><ProtoHBar height={150} maxName={120} rows={enfByCS} /></div>
      </section>
    </div>
  );
}

/* ---------------- Par zones de santé ---------------- */
export function CqZS() {
  const zs = CQ.zs;
  const row = zs.rows[0];
  const pctControle = Math.round(zs.nbControles / zs.nbAttendus * 100);
  const antS = [["Penta1", row.snis.p1, row.dhis2.p1], ["Penta3", row.snis.p3, row.dhis2.p3], ["RR1", row.snis.rr1, row.dhis2.rr1], ["RR2", row.snis.rr2, row.dhis2.rr2]]
    .map((a) => ({ lab: a[0] as string, snis: a[1] as number, dhis2: a[2] as number }));

  return (
    <div className="space-y-4">
      <Banner icon="hospital" tone="navy" title="Qualité des données de vaccination — par zone de santé"
        sub={<>ZS <b>{row.zs}</b> · Superviseur {row.superviseur} · Aires vérifiées : {row.airesVerifiees.join(", ")} · {row.mois.join("/")} 2026</>} />
      <section>
        <SectionBar icon="bars">Indicateurs globaux qualité — niveau ZS</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile icon="hospital" tone="navy" label={<>ZS ayant bénéficié<br />du contrôle qualité</>} value={zs.nbControles} sub={`sur ${zs.nbAttendus} attendues (${pctControle}%)`} />
          <KpiTile icon="scale" tone="green" label={<>Concordance PENTA3<br />(DHIS2 / SNIS)</>} value={row.concPenta3 + "%"} sub={row.classPenta3} />
          <KpiTile icon="scale" tone="violet" label={<>Concordance RR2<br />(DHIS2 / SNIS)</>} value={row.concRR2 + "%"} sub={row.classRR2} />
          <KpiTile icon="database" tone="teal" label={<>Score qualité de saisie<br />dans DHIS2</>} value={row.scoreSaisieDhis2 + "%"} sub="Critères de complétude" />
        </div>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card card-pad">
          <CardTitle icon="scale" tone="orange" title="Taux d'erreur transcription SNIS → DHIS2" sub="Par ZS et par mois" />
          <TauxErrTable rows={antS} />
          <div className="mt-2 flex items-center justify-between rounded-lg px-3 py-2 text-[11.5px]" style={{ background: "#fff5e4" }}>
            <span className="font-semibold text-surface-700">{row.nbDiscord} discordances / {row.nbValVerif} comparaisons</span>
            <b style={{ color: C.orange, fontSize: 15 }}>{row.errSnisDhis2}%</b>
          </div>
        </div>
        <div className="card card-pad">
          <CardTitle icon="component" tone="navy" title="Comparaison SNIS / DHIS2 (somme des CS)" sub="PENTA1 · PENTA3 · RR1 · RR2" />
          <ProtoGroupedBar height={185} colors={[C.orange, C.blue]} cats={["PENTA1", "PENTA3", "RR1", "RR2"]} series={[
            { name: "SNIS", data: [row.snis.p1, row.snis.p3, row.snis.rr1, row.snis.rr2] },
            { name: "DHIS2", data: [row.dhis2.p1, row.dhis2.p3, row.dhis2.rr1, row.dhis2.rr2] },
          ]} />
        </div>
      </div>
      <section>
        <SectionBar icon="component">Concordance & qualité de saisie par ZS et par mois</SectionBar>
        <div className="card card-pad">
          <table className="grid">
            <thead><tr>
              <th className="name">Zone de santé</th><th>Concordance PENTA3</th><th>Appréciation</th>
              <th>Concordance RR2</th><th>Appréciation</th><th>Taux d'erreur SNIS/DHIS2</th><th>Qualité saisie DHIS2</th>
            </tr></thead>
            <tbody><tr>
              <td className="name">{row.zs}</td><td>{row.concPenta3}%</td><td><ApprBadge p={row.concPenta3} /></td>
              <td>{row.concRR2}%</td><td><ApprBadge p={row.concRR2} /></td>
              <td style={{ color: C.orange, fontWeight: 800 }}>{row.errSnisDhis2}%</td>
              <td style={{ fontWeight: 800, color: cotColor(row.scoreSaisieDhis2) }}>{row.scoreSaisieDhis2}%</td>
            </tr></tbody>
          </table>
          <div className="mt-2 text-[11px] text-surface-500">Appréciation concordance : 95–105 % = pas de discordance · &lt; 95 % = sous-rapportage · &gt; 105 % = sur-rapportage.</div>
        </div>
      </section>
    </div>
  );
}

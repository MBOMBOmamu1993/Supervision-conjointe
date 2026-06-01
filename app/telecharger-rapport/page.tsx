"use client";

/* =========================================================================
   Onglet « Télécharger Rapport » — fidèle à apercu/rapport.js
   Aperçu des diapositives PPTX (design modèle Angola, logo OMS) + téléchargement.
   3 rapports : Supervision conjointe · CQ ZS · CQ AS.
   ========================================================================= */
import { useState } from "react";
import { SectionBar } from "@/components/ui/Card";
import { Badge, TONES, type Tone } from "@/components/proto/proto";
import { Icon } from "@/components/ui/Icon";

const ANGOLA = { navy: "#001B4D", navy2: "#002A72", body: "#DEE5EE", red: "#E23636", green: "#22B457", blue: "#2563EB", wine: "#7B2D3A", gold: "#F1C40F" };

type Slide = { no: string; title: string; sub?: string; body: React.ReactNode };

function MiniKpis({ items }: { items: { v: string; l: string; c: string }[] }) {
  return <div className="rap-kpis">{items.map((k, i) => <div key={i} className="rap-kpi"><div className="rap-kpi-v" style={{ color: k.c }}>{k.v}</div><div className="rap-kpi-l">{k.l}</div></div>)}</div>;
}
function MiniBars({ vals, colors }: { vals: number[]; colors: string[] }) {
  const max = Math.max(...vals, 1);
  return <div className="rap-bars">{vals.map((v, i) => <div key={i} className="rap-bar" style={{ height: `${Math.max(8, v / max * 100)}%`, background: colors[i % colors.length] }} />)}</div>;
}
function MiniDonut({ c }: { c: number }) {
  return <div className="rap-donut" style={{ background: `conic-gradient(${ANGOLA.green} 0 ${c}%, #c9d4e2 ${c}% 100%)` }}><span>{c}%</span></div>;
}
function Cover({ emb, meta }: { emb: string; meta: string }) {
  return <div className="rap-cover"><div className="rap-cover-emb">{emb}</div><div className="rap-cover-meta">{meta}</div></div>;
}

interface ReportDef { id: string; type: string; title: string; file: string; icon: "hands" | "hospital" | "clinic"; tone: Tone; desc: string; slides: Slide[]; }

const REPORTS: ReportDef[] = [
  {
    id: "sup", type: "sup", title: "Rapport de supervision conjointe PEV-Central / OMS",
    file: "Rapport_Supervision_Conjointe_PEV_OMS_Tshuapa.pptx", icon: "hands", tone: "navy",
    desc: "Synthèse automatique : réalisation, scores globaux, 6 composantes, top questions « Non », recommandations.",
    slides: [
      { no: "01", title: "RAPPORT DE SUPERVISION CONJOINTE", sub: "Programme Élargi de Vaccination · OMS — Province de la Tshuapa", body: <Cover emb="PEV · OMS — RDC" meta="Période : Janvier – Mars 2026 · Antennes Boende & Bokungu" /> },
      { no: "02", title: "Nombre des supervisions réalisées", sub: "Par type de supervision", body: <MiniKpis items={[{ v: "36", l: "Total réalisées", c: ANGOLA.navy2 }, { v: "12", l: "Conjointes", c: ANGOLA.blue }, { v: "2", l: "Antennes", c: ANGOLA.green }, { v: "82%", l: "% réalisation", c: ANGOLA.red }]} /> },
      { no: "03", title: "Score global de toutes les composantes", sub: "Antenne · ZS · AS", body: <div className="rap-row"><MiniDonut c={82} /><MiniDonut c={79} /><MiniDonut c={76} /></div> },
      { no: "04", title: "Performance par composante", sub: "Radar des 6 composantes", body: <MiniBars vals={[84, 72, 80, 58, 55, 76]} colors={[ANGOLA.blue, ANGOLA.green, ANGOLA.navy2, ANGOLA.red, ANGOLA.gold, ANGOLA.wine]} /> },
      { no: "05", title: "Top 5 des questions à réponses « Non »", sub: "Points d'amélioration prioritaires", body: <MiniBars vals={[34, 28, 26, 23, 21]} colors={[ANGOLA.red]} /> },
      { no: "06", title: "Problèmes & actions correctrices", sub: "Recommandations", body: <div className="rap-list"><div>• Renforcer l'analyse mensuelle des données</div><div>• Documenter les réunions de monitorage</div><div>• Recherche active des enfants zéro dose</div></div> },
    ],
  },
  {
    id: "cqzs", type: "cqzs", title: "Rapport contrôle qualité des données — Zones de santé",
    file: "Rapport_Automatise_CQD_ZS_Tshuapa.pptx", icon: "hospital", tone: "violet",
    desc: "Concordance DHIS2/SNIS (PENTA3, RR2), taux d'erreur de transcription, qualité de saisie DHIS2 par ZS et par mois.",
    slides: [
      { no: "01", title: "CONTRÔLE QUALITÉ DES DONNÉES", sub: "Niveau Zones de santé — Province de la Tshuapa", body: <Cover emb="CQD · ZS" meta="ZS Bokungu · Jan – Mars 2026" /> },
      { no: "02", title: "Concordance DHIS2 / SNIS", sub: "PENTA3 & RR2", body: <MiniKpis items={[{ v: "89,7%", l: "PENTA3", c: ANGOLA.red }, { v: "85,1%", l: "RR2", c: ANGOLA.red }, { v: "Sous-rapportage", l: "Appréciation", c: ANGOLA.wine }]} /> },
      { no: "03", title: "Taux d'erreur de transcription", sub: "SNIS → DHIS2", body: <MiniKpis items={[{ v: "55,6%", l: "Taux d'erreur", c: ANGOLA.red }, { v: "20", l: "Discordances", c: ANGOLA.navy2 }, { v: "36", l: "Comparaisons", c: ANGOLA.blue }]} /> },
      { no: "04", title: "Score de qualité de saisie DHIS2", sub: "Par ZS et par mois", body: <div className="rap-row"><MiniDonut c={60} /><div className="rap-list"><div>ZS Bokungu : 60%</div><div>3 critères / 5 remplis</div></div></div> },
    ],
  },
  {
    id: "cqas", type: "cqas", title: "Rapport contrôle qualité des données — Centres de santé",
    file: "Rapport_Automatise_CQD_Centres_Sante_Tshuapa.pptx", icon: "clinic", tone: "green",
    desc: "Concordance Registre/DHIS2, remplissage des outils de gestion, enfants perdus de vue récupérés par centre de santé.",
    slides: [
      { no: "01", title: "CONTRÔLE QUALITÉ DES DONNÉES", sub: "Niveau Centres de santé — Province de la Tshuapa", body: <Cover emb="CQD · CS" meta="AS Lofima 2 · Jan – Mars 2026" /> },
      { no: "02", title: "Concordance Registre / DHIS2", sub: "PENTA3 & RR2", body: <MiniKpis items={[{ v: "114%", l: "PENTA3", c: ANGOLA.red }, { v: "100%", l: "RR2", c: ANGOLA.green }, { v: "Sur-rapportage", l: "Appréciation", c: ANGOLA.wine }]} /> },
      { no: "03", title: "Remplissage des outils de gestion", sub: "Registre · Pointage · SNIS", body: <MiniBars vals={[0, 0, 100]} colors={[ANGOLA.red, ANGOLA.red, ANGOLA.green]} /> },
      { no: "04", title: "Enfants perdus de vue récupérés", sub: "Identifiés précédemment", body: <MiniKpis items={[{ v: "29", l: "Identifiés", c: ANGOLA.navy2 }, { v: "21", l: "Récupérés", c: ANGOLA.green }, { v: "72%", l: "% récupération", c: ANGOLA.blue }]} /> },
    ],
  },
];

function SlideThumb({ s }: { s: Slide }) {
  return (
    <div className="rap-slide">
      <div className="rap-band">
        <img src="/logo/oms.png" className="rap-oms [filter:brightness(0)_invert(1)]" alt="OMS" />
        <div className="rap-band-txt"><div className="rap-title">{s.title}</div>{s.sub ? <div className="rap-sub">{s.sub}</div> : null}</div>
        <div className="rap-no">{s.no}</div>
      </div>
      <div className="rap-body">{s.body}</div>
    </div>
  );
}

export default function TelechargerRapportPage() {
  const [active, setActive] = useState("sup");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const current = REPORTS.find((r) => r.id === active)!;

  async function download(r: ReportDef) {
    setBusy(r.id); setErr(null);
    try {
      const res = await fetch(`/api/rapports/pptx?type=${r.type}`);
      if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(`HTTP ${res.status} — ${t.slice(0, 160)}`); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = r.file;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card card-pad flex items-center gap-3" style={{ background: "linear-gradient(90deg,#e7ecf6,#fff)" }}>
        <Badge icon="report" tone="navy" size={36} />
        <div className="flex-1">
          <div className="text-[14px] font-extrabold text-navy-700">Rapports générés automatiquement</div>
          <div className="text-[11.5px] text-surface-700">Présentations PowerPoint dynamiques (design du modèle polio Angola, logo OMS) — alimentées en temps réel par les données du tableau de bord.</div>
        </div>
      </div>

      {err ? <div className="rounded-lg border border-danger-200 bg-danger-50/50 px-3 py-2 text-[12px] text-danger-700">Erreur : {err}</div> : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {REPORTS.map((r) => {
          const t = TONES[r.tone];
          const sel = active === r.id;
          return (
            <div key={r.id} onClick={() => setActive(r.id)} className="card card-pad cursor-pointer transition"
              style={{ borderColor: sel ? t.ico : "#e2e8f0", boxShadow: sel ? `0 8px 22px -10px ${t.ico}` : undefined }}>
              <div className="flex items-start gap-3">
                <Badge icon={r.icon} tone={r.tone} size={40} />
                <div className="min-w-0">
                  <div className="text-[12.5px] font-bold leading-snug text-navy-700">{r.title}</div>
                  <div className="mt-1 text-[11px] leading-snug text-surface-600">{r.desc}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button onClick={(e) => { e.stopPropagation(); download(r); }} disabled={busy === r.id}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[11.5px] font-bold text-white disabled:opacity-60" style={{ background: t.ico }}>
                  <Icon name={busy === r.id ? "refresh" : "download"} className={`h-3.5 w-3.5 ${busy === r.id ? "animate-spin" : ""}`} />
                  {busy === r.id ? "Génération…" : "Télécharger .pptx"}
                </button>
                <span className="text-[10px] font-semibold text-surface-400">{r.slides.length} diapos</span>
              </div>
            </div>
          );
        })}
      </div>

      <section>
        <SectionBar icon="doc">Aperçu des diapositives</SectionBar>
        <div className="rap-grid">{current.slides.map((s) => <SlideThumb key={s.no} s={s} />)}</div>
      </section>
    </div>
  );
}

"use client";

/* =========================================================================
   Onglet « Télécharger Rapport »
   2 rapports enrichis (alignés sur design_reference/) générés en pptxgenjs :
     1. Supervision PEV & CQD — Zones de santé   (23 diapos)
     2. Supervision PEV & CQD — Centres de santé (26 diapos)
   La carte « Supervision conjointe » séparée a disparu (fusionnée).
   ========================================================================= */
import { useState } from "react";
import { SectionBar } from "@/components/ui/Card";
import { Badge, TONES, type Tone } from "@/components/proto/proto";
import { Icon } from "@/components/ui/Icon";

const PAL = { marine: "#00205c", marine2: "#013a86", cyan: "#0093d5", vert: "#1f9d57", bleu: "#0093d5", jaune: "#f59e0b", rouge: "#e23636" };

type Slide = { no: string; title: string; sub?: string; body: React.ReactNode };

function MiniKpis({ items }: { items: { v: string; l: string; c: string }[] }) {
  return <div className="rap-kpis">{items.map((k, i) => <div key={i} className="rap-kpi"><div className="rap-kpi-v" style={{ color: k.c }}>{k.v}</div><div className="rap-kpi-l">{k.l}</div></div>)}</div>;
}
function MiniBars({ vals, colors }: { vals: number[]; colors: string[] }) {
  const max = Math.max(...vals, 1);
  return <div className="rap-bars">{vals.map((v, i) => <div key={i} className="rap-bar" style={{ height: `${Math.max(8, (v / max) * 100)}%`, background: colors[i % colors.length] }} />)}</div>;
}
function Cover({ emb, meta }: { emb: string; meta: string }) {
  return <div className="rap-cover"><div className="rap-cover-emb">{emb}</div><div className="rap-cover-meta">{meta}</div></div>;
}
function sc(v: number) { return v >= 80 ? PAL.vert : v >= 70 ? PAL.bleu : v >= 60 ? PAL.jaune : PAL.rouge; }
function cc(v: number) { return v >= 95 && v <= 105 ? PAL.vert : v < 95 ? PAL.jaune : PAL.rouge; }

interface ReportDef { id: "zs" | "cs"; title: string; file: string; icon: "hospital" | "clinic"; tone: Tone; slidesCount: number; desc: string; slides: Slide[]; }

const REPORTS: ReportDef[] = [
  {
    id: "zs", title: "Supervision PEV & CQD — Zones de santé",
    file: "Rapport_supervision_PEV_CQD_Tshuapa_Bokungu_Jan-Mars-2026.pptx", icon: "hospital", tone: "navy", slidesCount: 23,
    desc: "23 diapositives : couverture, résumé exécutif, scores par ZS et par composante, chaîne du froid, concordances PENTA3/RR2, erreurs de transcription, goulots, actions correctrices et conclusion.",
    slides: [
      { no: "01", title: "Supervision PEV & CQD — Zones de santé", sub: "Province de la Tshuapa — Antennes Boende & Bokungu", body: <Cover emb="PEV & CQD · ZS" meta="ZS Bokungu · Jan – Mars 2026 · 12 ZS prévues" /> },
      { no: "02", title: "Résumé exécutif", sub: "Lecture rapide PEV & qualité des données", body: <MiniKpis items={[{ v: "1/12", l: "ZS supervisées", c: PAL.bleu }, { v: "74 %", l: "Score moyen", c: PAL.jaune }, { v: "89,7 %", l: "Conc. PENTA3", c: PAL.jaune }, { v: "55,6 %", l: "Erreur transcr.", c: PAL.rouge }]} /> },
      { no: "04", title: "Score global par Zone de Santé", sub: "Couleur par seuil de score", body: <MiniBars vals={[81, 74, 72, 66, 62, 58]} colors={[81, 74, 72, 66, 62, 58].map(sc)} /> },
      { no: "13", title: "Concordance PENTA3 — DHIS2 / SNIS", sub: "Couleur par concordance", body: <MiniBars vals={[89.7, 97, 92, 112, 96, 88]} colors={[89.7, 97, 92, 112, 96, 88].map(cc)} /> },
      { no: "15", title: "Erreurs de transcription", sub: "SNIS/DHIS2 vs Pointage/Registre", body: <MiniBars vals={[34, 38, 22, 40]} colors={[PAL.rouge]} /> },
      { no: "23", title: "Conclusion", sub: "Priorités de mise en œuvre", body: <div className="rap-list"><div>✓ Corriger les écarts DHIS2/SNIS</div><div>✓ Étendre la couverture (1/12 → 12/12)</div><div>✓ Récupération active des enfants manqués</div></div> },
    ],
  },
  {
    id: "cs", title: "Supervision PEV & CQD — Centres de santé",
    file: "Rapport_supervision_PEV_CQD_Tshuapa_CS_Lofima-2_Jan-Mars-2026.pptx", icon: "clinic", tone: "green", slidesCount: 26,
    desc: "26 diapositives : méthode, cadre de scoring, scores par CS et composante, chaîne du froid, prestation de services, récupération des enfants, concordance DHIS2/Registre, comparaison des sources et plan de suivi.",
    slides: [
      { no: "01", title: "Supervision PEV & CQD — Centres de santé", sub: "Province de la Tshuapa — Antenne Boende / Bokungu", body: <Cover emb="PEV CS & CQD" meta="AS Lofima 2 · Jan – Mars 2026 · 279 CS prévus" /> },
      { no: "02", title: "Résumé exécutif", sub: "Lecture rapide des résultats", body: <MiniKpis items={[{ v: "1/279", l: "CS supervisés", c: PAL.rouge }, { v: "64 %", l: "Score moyen", c: PAL.jaune }, { v: "114 %", l: "Conc. PENTA3", c: PAL.rouge }, { v: "72 %", l: "Enf. récupérés", c: PAL.vert }]} /> },
      { no: "06", title: "Score global par Centre de Santé", sub: "Classement par score", body: <MiniBars vals={[81, 73, 66, 64, 57]} colors={[81, 73, 66, 64, 57].map(sc)} /> },
      { no: "12", title: "Récupération des enfants manqués", sub: "Funnel AS Lofima 2", body: <MiniKpis items={[{ v: "29", l: "Identifiés", c: PAL.marine }, { v: "23", l: "Retrouvés", c: PAL.jaune }, { v: "21", l: "Récupérés", c: PAL.vert }, { v: "72 %", l: "Taux final", c: PAL.bleu }]} /> },
      { no: "18", title: "Concordance DHIS2 / Registre", sub: "Couleur par concordance", body: <MiniBars vals={[114, 96, 103, 88, 109]} colors={[114, 96, 103, 88, 109].map(cc)} /> },
      { no: "26", title: "Conclusion", sub: "3 priorités", body: <div className="rap-list"><div>✓ Corriger Registre–Pointage–SNIS–DHIS2</div><div>✓ Suivre l'exécution des recommandations</div><div>✓ Renforcer stratégies avancées</div></div> },
    ],
  },
];

function SlideThumb({ s }: { s: Slide }) {
  return (
    <div className="rap-slide">
      <div className="rap-band">
        <img src="/logo/oms-white.png" className="rap-oms" alt="OMS" />
        <img src="/logo/pev.png" className="rap-oms" alt="PEV" />
        <div className="rap-band-txt"><div className="rap-title">{s.title}</div>{s.sub ? <div className="rap-sub">{s.sub}</div> : null}</div>
        <div className="rap-no">{s.no}</div>
      </div>
      <div className="rap-body">{s.body}</div>
    </div>
  );
}

export default function TelechargerRapportPage() {
  const [active, setActive] = useState<"zs" | "cs">("zs");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const current = REPORTS.find((r) => r.id === active)!;

  async function download(r: ReportDef) {
    setBusy(r.id); setErr(null);
    try {
      const res = await fetch(`/api/rapports/${r.id}`);
      if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(`HTTP ${res.status} — ${t.slice(0, 200)}`); }
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
          <div className="text-[14px] font-extrabold text-navy-700">Rapports automatisés PEV &amp; Contrôle qualité des données</div>
          <div className="text-[11.5px] text-surface-700">Deux présentations PowerPoint enrichies (graphiques épurés, commentaires « Lecture PEV », logos OMS &amp; PEV) — alimentées par les données du tableau de bord et du contrôle qualité KoboToolbox.</div>
        </div>
      </div>

      {err ? <div className="rounded-lg border border-danger-200 bg-danger-50/50 px-3 py-2 text-[12px] text-danger-700">Erreur : {err}</div> : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {REPORTS.map((r) => {
          const t = TONES[r.tone];
          const sel = active === r.id;
          return (
            <div key={r.id} onClick={() => setActive(r.id)} className="card card-pad cursor-pointer transition"
              style={{ borderColor: sel ? t.ico : "#e2e8f0", boxShadow: sel ? `0 8px 22px -10px ${t.ico}` : undefined }}>
              <div className="flex items-start gap-3">
                <Badge icon={r.icon} tone={r.tone} size={40} />
                <div className="min-w-0">
                  <div className="text-[13px] font-bold leading-snug text-navy-700">{r.title}</div>
                  <div className="mt-1 text-[11px] leading-snug text-surface-600">{r.desc}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button onClick={(e) => { e.stopPropagation(); download(r); }} disabled={busy === r.id}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[11.5px] font-bold text-white disabled:opacity-60" style={{ background: t.ico }}>
                  <Icon name={busy === r.id ? "refresh" : "download"} className={`h-3.5 w-3.5 ${busy === r.id ? "animate-spin" : ""}`} />
                  {busy === r.id ? "Génération…" : "Télécharger .pptx"}
                </button>
                <span className="text-[10px] font-semibold text-surface-400">{r.slidesCount} diapos</span>
              </div>
            </div>
          );
        })}
      </div>

      <section>
        <SectionBar icon="doc">Aperçu des diapositives — {current.title}</SectionBar>
        <div className="rap-grid">{current.slides.map((s) => <SlideThumb key={s.no} s={s} />)}</div>
      </section>
    </div>
  );
}

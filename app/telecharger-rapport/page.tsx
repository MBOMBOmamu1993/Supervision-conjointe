"use client";

import { useState } from "react";
import { Card, SectionBar } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";

interface ReportDef {
  type: "zs" | "cs";
  title: string;
  desc: string;
  slides: string[];
}

const REPORTS: ReportDef[] = [
  {
    type: "zs",
    title: "Supervision conjointe + CQD — Zones de Santé",
    desc: "Rapport automatisé des résultats de supervision PEV et du contrôle qualité des données au niveau des Zones de Santé (Tshuapa).",
    slides: [
      "Page de garde (logos OMS / PEV)",
      "Résumé exécutif",
      "Couverture de la supervision",
      "Score global par Zone de Santé",
      "Performance par composante",
      "Concordance DHIS2 / Registre — SNIS",
      "Erreurs de transcription & outils",
      "Comparaison des sources de données",
      "Goulots & actions correctrices",
      "Conclusion",
    ],
  },
  {
    type: "cs",
    title: "Supervision + CQD — Centres de Santé",
    desc: "Rapport automatisé de supervision PEV et de contrôle qualité des données au niveau des Centres de Santé (Tshuapa).",
    slides: [
      "Page de garde (logos OMS / PEV)",
      "Résumé exécutif",
      "Couverture de la supervision des CS",
      "Score global par Centre de Santé",
      "Performance moyenne par composante",
      "Concordance DHIS2 / Registre",
      "Erreurs de transcription & outils",
      "Comparaison des sources de données",
      "Goulots & actions correctrices",
      "Conclusion",
    ],
  },
];

function ReportCard({ def }: { def: ReportDef }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/rapports/pptx?type=${def.type}`);
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} — ${t.slice(0, 160)}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        def.type === "cs"
          ? "Rapport_Supervision_PEV_CQD_Centres_Sante_Tshuapa.pptx"
          : "Rapport_Supervision_PEV_CQD_ZS_Tshuapa.pptx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col">
      <div className="flex items-start gap-3">
        <span className="w-[44px] h-[44px] rounded-xl flex items-center justify-center shrink-0 text-white" style={{ background: "#1F3864" }}>
          <Icon name="report" className="w-6 h-6" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[15px] font-extrabold text-navy-700 leading-tight">{def.title}</h3>
          <p className="text-[12px] text-surface-700 mt-1">{def.desc}</p>
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-surface-50 border border-slate-200 p-3">
        <div className="text-[10px] uppercase tracking-wider text-surface-700 font-bold mb-1.5">Contenu du rapport</div>
        <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-[11.5px] text-surface-700 list-decimal list-inside">
          {def.slides.map((s) => <li key={s}>{s}</li>)}
        </ol>
      </div>

      {err ? <div className="mt-2 text-[11.5px] text-danger-700">Erreur : {err}</div> : null}

      <button
        onClick={download}
        disabled={busy}
        className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-navy-700 disabled:opacity-60"
      >
        <Icon name={busy ? "refresh" : "download"} className={`w-4 h-4 ${busy ? "animate-spin" : ""}`} />
        {busy ? "Génération en cours…" : "Télécharger le rapport PowerPoint"}
      </button>
    </Card>
  );
}

export default function TelechargerRapportPage() {
  return (
    <div className="space-y-4">
      <section>
        <SectionBar icon="download">Télécharger un rapport automatisé</SectionBar>
        <p className="text-[12.5px] text-surface-700 mb-3 px-1">
          Les rapports PowerPoint sont générés dynamiquement à partir des données actuelles du dashboard
          (supervision conjointe et contrôle qualité des données). La page de garde porte le logo de l'OMS
          à gauche et le logo du PEV à droite.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {REPORTS.map((r) => <ReportCard key={r.type} def={r} />)}
        </div>
      </section>
    </div>
  );
}

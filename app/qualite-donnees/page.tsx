"use client";

import { useState } from "react";
import { Card, CardHeader, SectionBar } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { DataTable } from "@/components/ui/DataTable";
import HBar from "@/components/charts/HBar";
import LineTrend from "@/components/charts/LineTrend";
import { fmtNum, fmtPct } from "@/lib/client/format";
import { useCqd } from "@/lib/client/cqd-api";
import type { CqdLevelBundle, ConcordanceClass } from "@/lib/cqd/types";

const CLASS_LABEL: Record<ConcordanceClass, string> = {
  normal: "Concordant (95–105)",
  sous: "Sous-rapportage (<95)",
  sur: "Sur-rapportage (>105)",
  na: "Non disponible",
};
const CLASS_COLOR: Record<ConcordanceClass, string> = {
  normal: "#1f9d57",
  sous: "#e23636",
  sur: "#f59e0b",
  na: "#94a3b8",
};

function ConcordanceCard({ title, taux, classe }: { title: string; taux: number | null; classe: ConcordanceClass }) {
  return (
    <Card className="!p-3.5">
      <div className="text-[12px] font-bold text-navy-700 mb-1">{title}</div>
      <div className="text-[30px] font-extrabold tabular-nums leading-none" style={{ color: CLASS_COLOR[classe] }}>
        {taux === null ? "—" : `${taux}%`}
      </div>
      <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: CLASS_COLOR[classe] }}>
        <span className="inline-block w-2 h-2 rounded-full" style={{ background: CLASS_COLOR[classe] }} />
        {CLASS_LABEL[classe]}
      </div>
    </Card>
  );
}

function LevelView({ d, levelWord }: { d: CqdLevelBundle; levelWord: string }) {
  const months = d.trend.map((t) => t.month);
  return (
    <div className="space-y-4">
      <section>
        <SectionBar icon="bars">Vue globale — qualité des données ({levelWord})</SectionBar>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <KpiCard icon="clinic" tone="navy" label={`${levelWord} contrôlés`} value={fmtNum(d.structuresControlees)} sub={`${d.records} contrôle(s)`} />
          <KpiCard icon="shield" tone="good" label="Erreur transcription SNIS→DHIS2" value={d.erreurSnisDhis2 === null ? "—" : `${d.erreurSnisDhis2}%`} sub="Taux global d'erreur" />
          <KpiCard icon="shield" tone="warn" label="Erreur pointage→registre" value={d.erreurPointageRegistre === null ? "—" : `${d.erreurPointageRegistre}%`} sub="Taux global d'erreur" />
          <KpiCard icon="people" tone="violet" label="Enfants PDV récupérés" value={d.enfants.tauxRecuperes === null ? "—" : `${d.enfants.tauxRecuperes}%`} sub={`${d.enfants.recuperes} / ${d.enfants.identifies} identifiés`} />
        </div>
      </section>

      <section>
        <SectionBar icon="component">Concordance DHIS2 / Registre</SectionBar>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <ConcordanceCard title="Concordance PENTA3 (DHIS2 / référence)" taux={d.concordanceP3.taux} classe={d.concordanceP3.classe} />
          <ConcordanceCard title="Concordance RR2 (DHIS2 / référence)" taux={d.concordanceRr2.taux} classe={d.concordanceRr2.classe} />
        </div>
      </section>

      <section>
        <SectionBar icon="bars">Comparaison des antigènes (sommes des structures)</SectionBar>
        <Card>
          <DataTable
            columns={["Antigène", "Registre", "Feuille de pointage", "SNIS", "DHIS2"]}
            rows={d.antigenes.map((a) => ({
              "Antigène": a.antigene,
              "Registre": a.registre,
              "Feuille de pointage": a.pointage,
              "SNIS": a.snis,
              "DHIS2": a.dhis2,
            }))}
          />
        </Card>
      </section>

      <section>
        <SectionBar icon="shield">Complétude des outils de gestion</SectionBar>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          <KpiCard icon="doc" tone="brand" label="Registre correctement rempli" value={fmtPct(d.outils.registre)} />
          <KpiCard icon="doc" tone="good" label="Feuille de pointage correcte" value={fmtPct(d.outils.pointage)} />
          <KpiCard icon="doc" tone="teal" label="Canevas SNIS correct" value={fmtPct(d.outils.snis)} />
        </div>
      </section>

      {months.length > 0 && (
        <section>
          <SectionBar icon="time">Évolution mensuelle</SectionBar>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <Card>
              <CardHeader icon="component" iconTone="blue" title="Concordance PENTA3 / RR2 (%)" />
              <LineTrend
                months={months}
                series={[
                  { name: "PENTA3", data: d.trend.map((t) => t.concordanceP3), color: "#0093d5" },
                  { name: "RR2", data: d.trend.map((t) => t.concordanceRr2), color: "#7c3aed" },
                ]}
              />
            </Card>
            <Card>
              <CardHeader icon="shield" iconTone="red" title="Taux d'erreur de transcription (%)" />
              <LineTrend
                months={months}
                series={[
                  { name: "SNIS→DHIS2", data: d.trend.map((t) => t.erreurSnisDhis2), color: "#e23636" },
                  { name: "Pointage→Registre", data: d.trend.map((t) => t.erreurPointageRegistre), color: "#f59e0b" },
                ]}
              />
            </Card>
          </div>
        </section>
      )}

      <section>
        <SectionBar icon="doc">Détail par {levelWord.toLowerCase()}</SectionBar>
        <Card>
          {d.parStructure.length ? (
            <DataTable
              columns={["Structure", "Concordance PENTA3 (%)", "Appréciation", "Erreur SNIS→DHIS2 (%)"]}
              rows={d.parStructure.map((s) => ({
                "Structure": s.name,
                "Concordance PENTA3 (%)": s.concordanceP3,
                "Appréciation": CLASS_LABEL[s.classeP3],
                "Erreur SNIS→DHIS2 (%)": s.erreurSnisDhis2,
              }))}
            />
          ) : <EmptyState />}
        </Card>
      </section>
    </div>
  );
}

const SUBTABS = [
  { key: "as", label: "Centres / Aires de santé" },
  { key: "zs", label: "Zones de santé" },
] as const;
type SubKey = (typeof SUBTABS)[number]["key"];

export default function QualiteDonneesPage() {
  const { data, error, isLoading } = useCqd();
  const [tab, setTab] = useState<SubKey>("as");

  if (error) {
    return (
      <div className="card border-danger-200 bg-danger-50/40">
        <div className="text-[13px] font-semibold text-danger-700">Erreur de connexion aux données CQD (KoboToolbox)</div>
        <p className="text-[12px] text-surface-700 mt-1">{error.message}</p>
      </div>
    );
  }
  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-20 text-surface-700">
        <span className="text-[13px]">Synchronisation des données de contrôle qualité…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {SUBTABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
              tab === t.key ? "bg-navy text-white" : "bg-white text-surface-700 border border-slate-200 hover:border-navy/40"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "as"
        ? <LevelView d={data.levels.as} levelWord="Centres de santé" />
        : <LevelView d={data.levels.zs} levelWord="Zones de santé" />}
    </div>
  );
}

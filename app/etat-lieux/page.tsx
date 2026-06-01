"use client";

import { useState } from "react";
import { Card, CardHeader, SectionBar } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { DataTable } from "@/components/ui/DataTable";
import HBar from "@/components/charts/HBar";
import { fmtNum } from "@/lib/client/format";
import { useEtatLieux } from "@/lib/client/etat-api";

const SUBTABS = [
  { key: "general", label: "Informations générales" },
  { key: "planif", label: "Planification & communautaire" },
  { key: "ressources", label: "Ressources & partenaires" },
] as const;
type SubKey = (typeof SUBTABS)[number]["key"];

export default function EtatLieuxPage() {
  const { data, error, isLoading } = useEtatLieux();
  const [tab, setTab] = useState<SubKey>("general");

  if (error) {
    return (
      <div className="card border-danger-200 bg-danger-50/40">
        <div className="text-[13px] font-semibold text-danger-700">Impossible de charger l'état des lieux</div>
        <p className="text-[12px] text-surface-700 mt-1">{error.message}</p>
      </div>
    );
  }
  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-20 text-surface-700">
        <span className="text-[13px]">Chargement de l'état des lieux…</span>
      </div>
    );
  }

  const sheet = (key: string) => data.sheets.find((s) => s.key === key);

  return (
    <div className="space-y-4">
      {/* Sous-onglets internes */}
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

      {tab === "general" && (
        <>
          <section>
            <SectionBar icon="bars">Informations générales</SectionBar>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
              <KpiCard icon="tower" tone="navy" label="Antennes" value={fmtNum(data.summary.antennes)} />
              <KpiCard icon="hospital" tone="brand" label="Zones de santé" value={fmtNum(data.summary.zones)} />
              <KpiCard icon="clinic" tone="good" label="Aires de santé" value={fmtNum(data.summary.aires)} />
              <KpiCard icon="people" tone="violet" label="ZS avec données CV" value={fmtNum(data.couverture.length)} />
              <KpiCard icon="map" tone="teal" label="ZS cartographiées (PTF)" value={fmtNum(data.partenairesParZs.length)} />
            </div>
          </section>

          <section>
            <SectionBar icon="component">Couverture vaccinale ajustée 2025 par ZS</SectionBar>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
              <Card>
                <CardHeader icon="hospital" iconTone="blue" title="Penta 3 (%)" subtitle="Couverture ajustée par zone de santé" />
                {data.couverture.length ? (
                  <HBar data={data.couverture.map((c) => ({ name: c.zs, value: c.penta3 }))} />
                ) : <EmptyState />}
              </Card>
              <Card>
                <CardHeader icon="hospital" iconTone="violet" title="VAR 1 (%)" subtitle="Couverture ajustée par zone de santé" />
                {data.couverture.length ? (
                  <HBar data={data.couverture.map((c) => ({ name: c.zs, value: c.var1 }))} />
                ) : <EmptyState />}
              </Card>
            </div>
          </section>

          <section>
            <SectionBar icon="doc">Informations générales par zone de santé</SectionBar>
            <Card>
              <DataTable columns={data.infoZsColumns} rows={data.infoZs} />
            </Card>
          </section>
        </>
      )}

      {tab === "planif" && (
        <>
          <section>
            <SectionBar icon="bars">Stratégies de vaccination réalisées par ZS (%)</SectionBar>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
              <Card>
                <CardHeader icon="hospital" iconTone="green" title="Stratégies fixes réalisées (%)" />
                <HBar data={data.strategiesParZs.map((s) => ({ name: s.zs, value: s.fixes }))} />
              </Card>
              <Card>
                <CardHeader icon="hospital" iconTone="orange" title="Stratégies avancées réalisées (%)" />
                <HBar data={data.strategiesParZs.map((s) => ({ name: s.zs, value: s.avancees }))} />
              </Card>
            </div>
          </section>

          <section>
            <SectionBar icon="people">Participation communautaire par ZS</SectionBar>
            <Card>
              <DataTable
                columns={["Zone de santé", "Aires de santé", "RECO actifs", "RECO formés", "Églises"]}
                rows={data.communautaireParZs.map((c) => ({
                  "Zone de santé": c.zs,
                  "Aires de santé": c.nbAs,
                  "RECO actifs": c.recoActifs,
                  "RECO formés": c.recoFormes,
                  "Églises": c.eglises,
                }))}
              />
            </Card>
          </section>

          <section>
            <SectionBar icon="doc">Détail des stratégies par aire de santé</SectionBar>
            <Card>
              {sheet("strategies") ? (
                <DataTable columns={sheet("strategies")!.columns} rows={sheet("strategies")!.rows} />
              ) : <EmptyState />}
            </Card>
          </section>
        </>
      )}

      {tab === "ressources" && (
        <>
          <section>
            <SectionBar icon="bars">Chaîne de froid — synthèse par ZS</SectionBar>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
              <Card>
                <CardHeader icon="hospital" iconTone="blue" title="Couverture en chaîne de froid (%)" subtitle="% d'AS disposant d'un réfrigérateur" />
                <HBar data={data.chaineFroidParZs.map((c) => ({ name: c.zs, value: c.cvFroid }))} />
              </Card>
              <Card>
                <CardHeader icon="clinic" iconTone="green" title="Équipements par ZS" />
                <DataTable
                  columns={["Zone de santé", "Nbr AS", "AS avec réfrigérateur", "CV froid (%)"]}
                  rows={data.chaineFroidParZs.map((c) => ({
                    "Zone de santé": c.zs,
                    "Nbr AS": c.nbAs,
                    "AS avec réfrigérateur": c.asFrigo,
                    "CV froid (%)": c.cvFroid,
                  }))}
                />
              </Card>
            </div>
          </section>

          <section>
            <SectionBar icon="map">Cartographie des interventions des partenaires (PTF)</SectionBar>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {data.partenairesParZs.map((p) => (
                <Card key={p.zs}>
                  <CardHeader icon="map" iconTone="violet" title={p.zs} subtitle={`${p.interventions.length} partenaire(s) actif(s)`} />
                  {p.interventions.length ? (
                    <ul className="space-y-1.5 text-[12px]">
                      {p.interventions.map((it, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="font-semibold text-navy shrink-0">{it.partenaire}</span>
                          <span className="text-surface-700">{it.activite}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <EmptyState message="Aucune intervention renseignée." />}
                </Card>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

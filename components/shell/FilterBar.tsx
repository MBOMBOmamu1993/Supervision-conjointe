"use client";

import { usePathname } from "next/navigation";
import { useFilters, TYPE_GROUPS } from "@/lib/state/filters";
import { useSupervision } from "@/lib/client/api";
import { Icon } from "@/components/ui/Icon";
import { cascadeOptions, type GeoTuple } from "@/lib/geo";
import { edlGeoTuples } from "@/lib/etat-lieux/edl-filter";
import { PeriodFilter } from "./PeriodFilter";

/** Pastille de titre court (à gauche de la barre), comme le prototype. */
const PILL: Record<string, string> = {
  "/": "Vue d'ensemble",
  "/comparaison": "Performance structures & temps",
  "/composantes": "Performance par composantes",
  "/qualite-donnees": "Qualité · Vue globale CS",
  "/qualite-donnees/detail": "Qualité · Détail par CS",
  "/qualite-donnees/zs": "Qualité · Par ZS",
  "/etat-lieux": "État de lieux · Informations",
  "/etat-lieux/planification": "État de lieux · Planification",
  "/etat-lieux/ressources": "État de lieux · Ressources",
  "/telecharger-rapport": "Télécharger Rapport",
};

/** Libellé de filtre (au-dessus du contrôle) — corrige le bug « titres invisibles ». */
function FieldLabel({ children, onReset, active }: { children: React.ReactNode; onReset?: () => void; active?: boolean }) {
  return (
    <div className="flex items-center justify-between px-0.5">
      <label className="text-[10px] font-extrabold uppercase tracking-[0.09em] text-slate-500">{children}</label>
      {onReset ? (
        <button
          type="button"
          onClick={onReset}
          disabled={!active}
          title="Réinitialiser ce filtre"
          aria-label="Réinitialiser ce filtre"
          className="inline-flex h-[15px] w-[15px] items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-oms-600 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
        >
          <Icon name="refresh" className="h-[11px] w-[11px]" strokeWidth={2.4} />
        </button>
      ) : null}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  onReset,
  options,
  placeholder,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  onReset?: () => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-[3px]">
      <FieldLabel onReset={onReset} active={!!value}>{label}</FieldLabel>
      <div className="flex items-center rounded-xl border border-slate-200 bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-oms-500">
        <select
          className="w-full cursor-pointer bg-transparent text-[12.5px] font-bold text-navy-700 outline-none"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/** Barre de filtres : Province, Antenne, ZS, Aire, Type de supervision, Période. */
export function FilterBar() {
  const pathname = usePathname();
  const f = useFilters();
  const { data } = useSupervision();
  const opt = data?.filters;
  const pill = PILL[pathname] ?? "Tableau de bord";

  // Options géographiques en cascade : on fusionne les tuples de la base
  // « État de lieux » (hiérarchie complète de la province) avec ceux des
  // données de supervision, puis on dédoublonne et on restreint par parent.
  const tuples: GeoTuple[] = [...edlGeoTuples(), ...((opt?.geo as GeoTuple[]) ?? [])];
  const geo = cascadeOptions(tuples, { province: f.province, antenne: f.antenne, zone: f.zone, aire: f.aire });

  const selectedGroup = TYPE_GROUPS.find((g) => g.key === f.types[0]);
  const anyActive = !!(f.province || f.antenne || f.zone || f.aire || f.months.length || f.types.length);

  return (
    <div className="relative z-20 shrink-0 border-b border-slate-200 bg-white">
      <div className="px-4 py-2.5">
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-[13px] font-extrabold uppercase tracking-[0.04em] text-white shadow-[0_4px_14px_-6px_rgba(0,32,92,.5)]"
            style={{ background: "linear-gradient(90deg,#00205c,#0a3a86)" }}>
            {pill}
          </span>
          <button
            type="button"
            onClick={() => f.reset()}
            disabled={!anyActive}
            title="Réinitialiser tous les filtres"
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11.5px] font-bold text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-oms-500 hover:text-oms-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon name="refresh" className="h-[13px] w-[13px]" strokeWidth={2.2} />
            Réinitialiser les filtres
          </button>
        </div>
        <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <Select
            label="Province"
            placeholder="Toutes"
            value={f.province}
            onChange={(v) => f.set({ province: v, antenne: null, zone: null, aire: null })}
            onReset={() => f.resetField("province")}
            options={geo.provinces}
          />
          <Select
            label="Antenne"
            placeholder="Toutes"
            value={f.antenne}
            onChange={(v) => f.set({ antenne: v, zone: null, aire: null })}
            onReset={() => f.resetField("antenne")}
            options={geo.antennes}
          />
          <Select
            label="Zone de santé"
            placeholder="Toutes"
            value={f.zone}
            onChange={(v) => f.set({ zone: v, aire: null })}
            onReset={() => f.resetField("zone")}
            options={geo.zones}
          />
          <Select
            label="Aire de santé"
            placeholder="Toutes"
            value={f.aire}
            onChange={(v) => f.set({ aire: v })}
            onReset={() => f.resetField("aire")}
            options={geo.aires}
          />
          <Select
            label="Type de supervision"
            placeholder="Tous les types"
            value={selectedGroup?.label ?? null}
            onChange={(v) => {
              const g = TYPE_GROUPS.find((x) => x.label === v);
              f.set({ types: g ? [g.key] : [] });
            }}
            onReset={() => f.resetField("types")}
            options={TYPE_GROUPS.map((g) => g.label)}
          />
          <div className="flex min-w-0 flex-col gap-[3px]">
            <FieldLabel onReset={() => f.resetField("months")} active={f.months.length > 0}>Période</FieldLabel>
            <PeriodFilter value={f.months} available={opt?.months ?? []} onChange={(m) => f.set({ months: m })} />
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { useFilters } from "@/lib/state/filters";
import { useSupervision } from "@/lib/client/api";
import { Icon, type IconName } from "@/components/ui/Icon";
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
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="px-0.5 text-[10px] font-extrabold uppercase tracking-[0.09em] text-slate-500">
      {children}
    </label>
  );
}

function Select({
  label,
  icon,
  from,
  to,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  icon: IconName;
  from: string;
  to: string;
  value: string | null;
  onChange: (v: string | null) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-[3px]">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-oms-500">
        <span className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md text-white" style={{ background: `linear-gradient(145deg, ${from}, ${to})` }}>
          <Icon name={icon} className="h-[13px] w-[13px]" strokeWidth={2} />
        </span>
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

  return (
    <div className="relative z-20 shrink-0 border-b border-slate-200 bg-white">
      <div className="px-4 py-2.5">
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-[13px] font-extrabold uppercase tracking-[0.04em] text-white shadow-[0_4px_14px_-6px_rgba(0,32,92,.5)]"
            style={{ background: "linear-gradient(90deg,#00205c,#0a3a86)" }}>
            {pill}
          </span>
        </div>
        <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <Select
            label="Province"
            icon="map-pin"
            from="#19c2b1"
            to="#0d9488"
            placeholder="Tshuapa"
            value={f.province}
            onChange={(v) => f.set({ province: v })}
            options={opt?.provinces ?? []}
          />
          <Select
            label="Antenne"
            icon="tower"
            from="#36b3ec"
            to="#0093d5"
            placeholder="Toutes"
            value={f.antenne}
            onChange={(v) => f.set({ antenne: v })}
            options={opt?.antennes ?? []}
          />
          <Select
            label="Zone de santé"
            icon="building"
            from="#9d5cf5"
            to="#7c3aed"
            placeholder="Toutes"
            value={f.zone}
            onChange={(v) => f.set({ zone: v })}
            options={opt?.zones ?? []}
          />
          <Select
            label="Aire de santé"
            icon="clinic"
            from="#2bbd6b"
            to="#1f9d57"
            placeholder="Toutes"
            value={f.aire}
            onChange={(v) => f.set({ aire: v })}
            options={opt?.aires ?? []}
          />
          <Select
            label="Type de supervision"
            icon="hands"
            from="#5b8def"
            to="#2a5fd0"
            placeholder="Tous les types"
            value={f.types[0] ?? null}
            onChange={(v) => f.set({ types: v ? [v] : [] })}
            options={opt?.types ?? []}
          />
          <div className="flex min-w-0 flex-col gap-[3px]">
            <FieldLabel>Période</FieldLabel>
            <PeriodFilter value={f.months} available={opt?.months ?? []} onChange={(m) => f.set({ months: m })} />
          </div>
        </div>
      </div>
    </div>
  );
}

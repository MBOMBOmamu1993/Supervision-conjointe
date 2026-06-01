"use client";

import { usePathname } from "next/navigation";
import { useFilters } from "@/lib/state/filters";
import { useSupervision } from "@/lib/client/api";
import { Icon, type IconName } from "@/components/ui/Icon";
import { PeriodFilter } from "./PeriodFilter";

/** Routes où la barre de filtres (supervision/CQD) est pertinente. */
const FILTERED_ROUTES = ["/", "/comparaison", "/composantes", "/qualite-donnees"];

function Select({
  icon,
  tone,
  value,
  onChange,
  options,
  placeholder,
}: {
  icon: IconName;
  tone: string;
  value: string | null;
  onChange: (v: string | null) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: `${tone}1a`, color: tone }}>
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <select
        className="w-full bg-transparent text-sm text-slate-700 outline-none"
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
  );
}

/** Barre de filtres : Province, Antenne, ZS, Aire, Type de supervision, Période. */
export function FilterBar() {
  const pathname = usePathname();
  const f = useFilters();
  const { data } = useSupervision();
  const opt = data?.filters;

  // Masquer la barre sur les pages sans filtres (État de lieux, Télécharger).
  if (!FILTERED_ROUTES.includes(pathname)) return null;

  return (
    <div className="border-b border-slate-200 bg-white/60 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <Select
            icon="map-pin"
            tone="#00205c"
            placeholder="Toutes les provinces"
            value={f.province}
            onChange={(v) => f.set({ province: v })}
            options={opt?.provinces ?? []}
          />
          <Select
            icon="layers"
            tone="#0093d5"
            placeholder="Toutes les antennes"
            value={f.antenne}
            onChange={(v) => f.set({ antenne: v })}
            options={opt?.antennes ?? []}
          />
          <Select
            icon="building"
            tone="#1f9d57"
            placeholder="Toutes les ZS"
            value={f.zone}
            onChange={(v) => f.set({ zone: v })}
            options={opt?.zones ?? []}
          />
          <Select
            icon="home"
            tone="#f59e0b"
            placeholder="Toutes les aires"
            value={f.aire}
            onChange={(v) => f.set({ aire: v })}
            options={opt?.aires ?? []}
          />
          <Select
            icon="clipboard"
            tone="#7c3aed"
            placeholder="Tous les types"
            value={f.types[0] ?? null}
            onChange={(v) => f.set({ types: v ? [v] : [] })}
            options={opt?.types ?? []}
          />
          <PeriodFilter value={f.months} available={opt?.months ?? []} onChange={(m) => f.set({ months: m })} />
        </div>
      </div>
    </div>
  );
}

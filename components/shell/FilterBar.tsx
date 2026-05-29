"use client";

import { useSupervision } from "@/lib/client/api";
import { useFilters } from "@/lib/state/filters";
import { fmtMonth } from "@/lib/client/format";

function Select({
  label,
  value,
  options,
  onChange,
  formatOption,
}: {
  label: string;
  value: string | null;
  options: string[];
  onChange: (v: string | null) => void;
  formatOption?: (v: string) => string;
}) {
  return (
    <label className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[9px] uppercase tracking-wider text-surface-700 font-semibold">{label}</span>
      <select
        className="input"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">Tous</option>
        {options.map((o) => (
          <option key={o} value={o}>{formatOption ? formatOption(o) : o}</option>
        ))}
      </select>
    </label>
  );
}

export default function FilterBar() {
  const { data } = useSupervision();
  const f = useFilters();
  const opts = data?.filters ?? { provinces: [], antennes: [], zones: [], aires: [], months: [] };
  const active = f.province || f.antenne || f.zone || f.aire || f.month;

  return (
    <div className="sticky top-0 z-30 bg-white border-b border-surface-200 px-3 md:px-5 py-2.5">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 items-end">
        <Select label="Province" value={f.province} options={opts.provinces} onChange={(v) => f.set({ province: v })} />
        <Select label="Antenne" value={f.antenne} options={opts.antennes} onChange={(v) => f.set({ antenne: v })} />
        <Select label="Zone de santé" value={f.zone} options={opts.zones} onChange={(v) => f.set({ zone: v })} />
        <Select label="Aire de santé" value={f.aire} options={opts.aires} onChange={(v) => f.set({ aire: v })} />
        <Select label="Mois" value={f.month} options={opts.months} onChange={(v) => f.set({ month: v })} formatOption={fmtMonth} />
        <div className="flex items-end">
          <button onClick={() => f.reset()} disabled={!active} className="btn w-full disabled:opacity-50" title="Réinitialiser les filtres">
            Réinitialiser
          </button>
        </div>
      </div>
    </div>
  );
}

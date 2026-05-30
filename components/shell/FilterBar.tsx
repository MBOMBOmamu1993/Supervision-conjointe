"use client";

import { useSupervision } from "@/lib/client/api";
import { useFilters } from "@/lib/state/filters";
import { fmtMonth } from "@/lib/client/format";
import { Icon, type IconName } from "@/components/ui/Icon";
import { HEADER_TONE, type HeaderTone } from "@/components/ui/Card";
import { cn } from "@/lib/client/cn";

function Select({
  label,
  value,
  options,
  onChange,
  formatOption,
  icon,
  tone = "navy",
}: {
  label: string;
  value: string | null;
  options: string[];
  onChange: (v: string | null) => void;
  formatOption?: (v: string) => string;
  icon?: IconName;
  tone?: HeaderTone;
}) {
  const t = HEADER_TONE[tone];
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-[9px] uppercase tracking-wider text-surface-700 font-semibold">{label}</span>
      <div className="relative">
        {icon ? (
          <span
            className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 w-[23px] h-[23px] rounded-[7px] flex items-center justify-center text-white"
            style={{ backgroundImage: `linear-gradient(145deg, ${t.from}, ${t.to})`, boxShadow: `0 3px 8px -3px ${t.to}` }}
          >
            <Icon name={icon} className="w-[13px] h-[13px]" strokeWidth={2} />
          </span>
        ) : null}
        <select
          className={cn("input font-semibold", icon && "pl-9")}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">Toutes</option>
          {options.map((o) => (
            <option key={o} value={o}>{formatOption ? formatOption(o) : o}</option>
          ))}
        </select>
      </div>
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
        <Select tone="teal" icon="pin" label="Province" value={f.province} options={opts.provinces} onChange={(v) => f.set({ province: v })} />
        <Select tone="blue" icon="tower" label="Antenne" value={f.antenne} options={opts.antennes} onChange={(v) => f.set({ antenne: v })} />
        <Select tone="violet" icon="hospital" label="Zone de santé" value={f.zone} options={opts.zones} onChange={(v) => f.set({ zone: v })} />
        <Select tone="green" icon="clinic" label="Aire de santé" value={f.aire} options={opts.aires} onChange={(v) => f.set({ aire: v })} />
        <Select tone="orange" icon="calendar" label="Mois" value={f.month} options={opts.months} onChange={(v) => f.set({ month: v })} formatOption={fmtMonth} />
        <div className="flex items-end">
          <button onClick={() => f.reset()} disabled={!active} className="btn w-full disabled:opacity-50" title="Réinitialiser les filtres">
            <Icon name="refresh" className="w-3.5 h-3.5" /> Réinitialiser
          </button>
        </div>
      </div>
    </div>
  );
}

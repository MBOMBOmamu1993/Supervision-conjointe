"use client";

/**
 * Barre de filtres du nouveau shell — affichage dynamique selon le niveau de la
 * page (cf. specs/05). Écrit dans le store global `useFilters` : tous les KPI,
 * graphiques et tableaux des pages live réagissent à chaque changement.
 * Apparence simple (sans pastille colorée) ; seule « Période » garde une icône.
 */
import { useFilters, TYPE_GROUPS } from "@/lib/state/filters";
import { useSupervision } from "@/lib/client/api";
import { cascadeOptions, type GeoTuple } from "@/lib/geo";
import { edlGeoTuples } from "@/lib/etat-lieux/edl-filter";
import { PeriodFilter } from "@/components/shell/PeriodFilter";
import { Icon } from "@/components/ui/Icon";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-[3px]">
      <label className="px-0.5 text-[10px] font-extrabold uppercase tracking-[0.09em] text-slate-500">{label}</label>
      {children}
    </div>
  );
}

function Select({ value, onChange, options, placeholder }: {
  value: string | null; onChange: (v: string | null) => void; options: string[]; placeholder: string;
}) {
  return (
    <div className="flex items-center rounded-xl border border-slate-200 bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-oms-500">
      <select
        className="w-full cursor-pointer bg-transparent text-[12.5px] font-bold text-navy-700 outline-none"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

export function FilterBarShell({ allow }: { allow: string[] }) {
  const f = useFilters();
  const { data } = useSupervision();
  const opt = data?.filters;

  const tuples: GeoTuple[] = [...edlGeoTuples(), ...((opt?.geo as GeoTuple[]) ?? [])];
  const geo = cascadeOptions(tuples, { province: f.province, antenne: f.antenne, zone: f.zone, aire: f.aire });
  const selectedGroup = TYPE_GROUPS.find((g) => g.key === f.types[0]);
  const show = (k: string) => allow.includes(k);

  return (
    <div className="relative z-20 shrink-0 border-b border-slate-200 bg-white">
      <div className="flex flex-wrap items-end gap-2.5 px-4 py-2.5">
        {show("province") && (
          <Field label="Province">
            <Select value={f.province} placeholder="Toutes" options={geo.provinces}
              onChange={(v) => f.set({ province: v, antenne: null, zone: null, aire: null })} />
          </Field>
        )}
        {show("antenne") && (
          <Field label="Antenne">
            <Select value={f.antenne} placeholder="Toutes" options={geo.antennes}
              onChange={(v) => f.set({ antenne: v, zone: null, aire: null })} />
          </Field>
        )}
        {show("zs") && (
          <Field label="Zone de santé">
            <Select value={f.zone} placeholder="Toutes" options={geo.zones}
              onChange={(v) => f.set({ zone: v, aire: null })} />
          </Field>
        )}
        {show("as") && (
          <Field label="Aire de santé">
            <Select value={f.aire} placeholder="Toutes" options={geo.aires}
              onChange={(v) => f.set({ aire: v })} />
          </Field>
        )}
        {show("type") && (
          <Field label="Type de supervision">
            <Select
              value={selectedGroup?.label ?? null}
              placeholder="Tous les types"
              options={TYPE_GROUPS.map((g) => g.label)}
              onChange={(v) => { const g = TYPE_GROUPS.find((x) => x.label === v); f.set({ types: g ? [g.key] : [] }); }}
            />
          </Field>
        )}
        {show("periode") && (
          <Field label="Période">
            <PeriodFilter value={f.months} available={opt?.months ?? []} onChange={(m) => f.set({ months: m })} />
          </Field>
        )}
        <button
          type="button"
          onClick={() => f.reset()}
          className="ml-auto inline-flex items-center gap-1.5 self-end rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11.5px] font-bold text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-oms-500 hover:text-oms-600"
        >
          <Icon name="refresh" className="h-[13px] w-[13px]" strokeWidth={2.2} />
          Réinitialiser
        </button>
      </div>
    </div>
  );
}

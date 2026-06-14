"use client";

/**
 * Barre de filtres du nouveau shell — affichage dynamique selon le niveau de la
 * page (cf. specs/05). Écrit dans le store global `useFilters` : tous les KPI,
 * graphiques et tableaux des pages live réagissent à chaque changement.
 *
 * IMPORTANT : les options des listes déroulantes (Province → Antenne → ZS → Aire,
 * Période) proviennent de la source de données de l'ONGLET ACTIF (Supervision,
 * Qualité/CQD, RCM ou État de lieux). Ainsi un filtre ne propose jamais une
 * valeur absente du formulaire de l'onglet — ce qui évitait que tout se vide.
 */
import { useTabFilters, TYPE_GROUPS } from "@/lib/state/filters";
import { useSupervision } from "@/lib/client/api";
import { useCqd } from "@/lib/client/cqd-api";
import { useRcm } from "@/lib/client/rcm-api";
import { useSav } from "@/lib/client/sav-api";
import { useRapportAt, useEvaluationAt } from "@/lib/client/at-api";
import { cascadeOptions, type GeoTuple } from "@/lib/geo";
import { edlGeoTuples } from "@/lib/etat-lieux/edl-filter";
import { PeriodFilter } from "@/components/shell/PeriodFilter";
import { Icon } from "@/components/ui/Icon";

function Field({ label, children, onReset, active }: { label: string; children: React.ReactNode; onReset?: () => void; active?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-[3px]">
      <div className="flex items-center justify-between gap-1 px-0.5">
        <label className="text-[10px] font-extrabold uppercase tracking-[0.09em] text-slate-500">{label}</label>
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
      {children}
    </div>
  );
}

function Select({ value, onChange, options, placeholder, allowEmpty = true }: {
  value: string | null; onChange: (v: string | null) => void; options: string[]; placeholder: string;
  /** false : pas d'état « vide » — la première option est affichée par défaut. */
  allowEmpty?: boolean;
}) {
  const effective = value ?? (allowEmpty ? "" : options[0] ?? "");
  return (
    <div className="flex items-center rounded-xl border border-slate-200 bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-oms-500">
      <select
        className="w-full cursor-pointer bg-transparent text-[12.5px] font-bold text-navy-700 outline-none"
        value={effective}
        onChange={(e) => onChange(e.target.value || null)}
      >
        {allowEmpty ? <option value="">{placeholder}</option> : null}
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

/** Présentation pure : reçoit les tuples géo + mois (+ liste AT) de l'onglet actif.
 *  `provinceLocked` (onglet Supervision conjointe) : la province est unique —
 *  « Tshuapa » est affichée sélectionnée par défaut, jamais d'état « Toutes ». */
function FilterBarView({ tab, allow, geoTuples, months, ats = [], provinceLocked = false }: {
  tab: string; allow: string[]; geoTuples: GeoTuple[]; months: string[]; ats?: string[]; provinceLocked?: boolean;
}) {
  const f = useTabFilters(tab);
  const geo = cascadeOptions(geoTuples, { province: f.province, antenne: f.antenne, zone: f.zone, aire: f.aire });
  const selectedGroup = TYPE_GROUPS.find((g) => g.key === f.types[0]);
  const show = (k: string) => allow.includes(k);

  return (
    <div className="relative z-20 shrink-0 border-b border-slate-200 bg-white">
      <div className="flex flex-wrap items-end gap-2.5 px-4 py-2.5">
        {show("province") && (
          <Field label="Province" active={!provinceLocked && !!f.province} onReset={provinceLocked ? undefined : () => f.resetField("province")}>
            <Select value={f.province} placeholder="Toutes" options={geo.provinces} allowEmpty={!provinceLocked}
              onChange={(v) => f.set({ province: v, antenne: null, zone: null, aire: null })} />
          </Field>
        )}
        {show("antenne") && (
          <Field label="Antenne" active={!!f.antenne} onReset={() => f.resetField("antenne")}>
            <Select value={f.antenne} placeholder="Toutes" options={geo.antennes}
              onChange={(v) => f.set({ antenne: v, zone: null, aire: null })} />
          </Field>
        )}
        {show("zs") && (
          <Field label="Zone de santé" active={!!f.zone} onReset={() => f.resetField("zone")}>
            <Select value={f.zone} placeholder="Toutes" options={geo.zones}
              onChange={(v) => f.set({ zone: v, aire: null })} />
          </Field>
        )}
        {show("as") && (
          <Field label="Aire de santé" active={!!f.aire} onReset={() => f.resetField("aire")}>
            <Select value={f.aire} placeholder="Toutes" options={geo.aires}
              onChange={(v) => f.set({ aire: v })} />
          </Field>
        )}
        {show("at") && (
          <Field label="Assistant technique" active={!!f.at} onReset={() => f.resetField("at")}>
            <Select value={f.at} placeholder="Tous les AT" options={ats}
              onChange={(v) => f.set({ at: v })} />
          </Field>
        )}
        {show("type") && (
          <Field label="Type de supervision" active={f.types.length > 0} onReset={() => f.resetField("types")}>
            <Select
              value={selectedGroup?.label ?? null}
              placeholder="Tous les types"
              options={TYPE_GROUPS.map((g) => g.label)}
              onChange={(v) => { const g = TYPE_GROUPS.find((x) => x.label === v); f.set({ types: g ? [g.key] : [] }); }}
            />
          </Field>
        )}
        {show("periode") && (
          <Field label="Période" active={f.months.length > 0} onReset={() => f.resetField("months")}>
            <PeriodFilter value={f.months} available={months} onChange={(m) => f.set({ months: m })} />
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

/* --- Adaptateurs par source : chacun n'appelle qu'un seul hook de données. --- */

function SupervisionFilters({ allow }: { allow: string[] }) {
  const { data } = useSupervision();
  const opt = data?.filters;
  return <FilterBarView tab="supervision" allow={allow} geoTuples={(opt?.geo as GeoTuple[]) ?? []} months={opt?.months ?? []} provinceLocked />;
}

function CqdFilters({ allow }: { allow: string[] }) {
  const { data } = useCqd();
  const opt = data?.filters;
  return <FilterBarView tab="qualite" allow={allow} geoTuples={(opt?.geo as GeoTuple[]) ?? []} months={opt?.months ?? []} />;
}

function RcmFilters({ allow }: { allow: string[] }) {
  const { data } = useRcm();
  const opt = data?.filters;
  return <FilterBarView tab="rcm" allow={allow} geoTuples={(opt?.geo as GeoTuple[]) ?? []} months={opt?.months ?? []} />;
}

function EdlFilters({ allow }: { allow: string[] }) {
  // L'État de lieux couvre la hiérarchie complète de la province (données statiques).
  return <FilterBarView tab="etat" allow={allow} geoTuples={edlGeoTuples()} months={[]} />;
}

function SavFilters({ allow }: { allow: string[] }) {
  const { data } = useSav();
  const opt = data?.filters;
  return <FilterBarView tab="sav" allow={allow} geoTuples={(opt?.geo as GeoTuple[]) ?? []} months={opt?.months ?? []} />;
}

function RapportFilters({ allow }: { allow: string[] }) {
  const { data } = useRapportAt();
  const opt = data?.filters;
  return <FilterBarView tab="rapport" allow={allow} geoTuples={(opt?.geo as GeoTuple[]) ?? []} months={opt?.months ?? []} ats={opt?.ats ?? []} />;
}

function EvalFilters({ allow }: { allow: string[] }) {
  const { data } = useEvaluationAt();
  const opt = data?.filters;
  return <FilterBarView tab="evaluation" allow={allow} geoTuples={(opt?.geo as GeoTuple[]) ?? []} months={opt?.months ?? []} ats={opt?.ats ?? []} />;
}

/** Sélectionne la source d'options selon l'onglet actif (clé de module). */
export function FilterBarShell({ allow, source }: { allow: string[]; source: string }) {
  if (source === "qualite") return <CqdFilters allow={allow} />;
  if (source === "rcm") return <RcmFilters allow={allow} />;
  if (source === "etat") return <EdlFilters allow={allow} />;
  if (source === "sav") return <SavFilters allow={allow} />;
  if (source === "rapport") return <RapportFilters allow={allow} />;
  if (source === "evaluation") return <EvalFilters allow={allow} />;
  return <SupervisionFilters allow={allow} />;
}

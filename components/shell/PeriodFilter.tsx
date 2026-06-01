"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/client/cn";
import { Icon } from "@/components/ui/Icon";
import { fmtMonth, monthLabel } from "@/lib/client/format";

/**
 * Filtre Période multi-sélection (calendrier) :
 *  - en-tête année avec ◀/▶
 *  - grille de 12 mois (multi-sélectionnables)
 *  - puces rapides T1..T4, S1, S2, « Tout », « Effacer »
 *  - pied de page avec résumé.
 *
 * Valeur = tableau de mois ISO "YYYY-MM" ; supporte plusieurs années.
 */
export function PeriodFilter({
  value,
  available,
  onChange,
}: {
  value: string[];
  /** Mois disponibles dans les données (ISO "YYYY-MM"). */
  available: string[];
  onChange: (months: string[]) => void;
}) {
  const years = useMemo(() => {
    const set = new Set<number>();
    for (const m of available) {
      const y = parseInt(m.slice(0, 4), 10);
      if (Number.isFinite(y)) set.add(y);
    }
    if (!set.size) set.add(new Date().getFullYear());
    return Array.from(set).sort();
  }, [available]);

  const [open, setOpen] = useState(false);
  const [year, setYear] = useState<number>(years[years.length - 1]);

  const iso = (y: number, mIdx: number) => `${y}-${String(mIdx + 1).padStart(2, "0")}`;
  const selected = new Set(value);

  const toggle = (m: string) => {
    const next = new Set(selected);
    if (next.has(m)) next.delete(m);
    else next.add(m);
    onChange(Array.from(next).sort());
  };
  const setRange = (idxs: number[]) => {
    const next = new Set(selected);
    const months = idxs.map((i) => iso(year, i));
    const allOn = months.every((m) => next.has(m));
    for (const m of months) {
      if (allOn) next.delete(m);
      else next.add(m);
    }
    onChange(Array.from(next).sort());
  };
  const selectAll = () => onChange([...available].sort());
  const clear = () => onChange([]);

  const sortedSel = [...value].sort();
  const summary =
    value.length === 0
      ? "Toute la période"
      : `${value.length} mois — ${fmtMonth(sortedSel[0])} → ${fmtMonth(sortedSel[sortedSel.length - 1])}`;

  const QUICK: { label: string; idxs: number[] }[] = [
    { label: "T1", idxs: [0, 1, 2] },
    { label: "T2", idxs: [3, 4, 5] },
    { label: "T3", idxs: [6, 7, 8] },
    { label: "T4", idxs: [9, 10, 11] },
    { label: "S1", idxs: [0, 1, 2, 3, 4, 5] },
    { label: "S2", idxs: [6, 7, 8, 9, 10, 11] },
  ];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 hover:border-navy/40"
      >
        <span className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-navy/10 text-navy">
            <Icon name="calendar" className="h-4 w-4" />
          </span>
          <span className="truncate">{summary}</span>
        </span>
        <Icon name="chevron-down" className="h-4 w-4 text-slate-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[55]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-[60] mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_18px_44px_-12px_rgba(15,23,42,0.32)]">
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                onClick={() => setYear((y) => y - 1)}
              >
                <Icon name="chevron-left" className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold text-navy">{year}</span>
              <button
                type="button"
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
                onClick={() => setYear((y) => y + 1)}
              >
                <Icon name="chevron-right" className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {Array.from({ length: 12 }, (_, i) => {
                const m = iso(year, i);
                const on = selected.has(m);
                const has = available.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggle(m)}
                    className={cn(
                      "rounded-lg px-2 py-1.5 text-xs font-medium transition",
                      on ? "bg-navy text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100",
                      !has && !on && "opacity-50"
                    )}
                  >
                    {monthLabel(i)}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {QUICK.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => setRange(q.idxs)}
                  className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-navy/40 hover:text-navy"
                >
                  {q.label}
                </button>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2">
              <div className="flex gap-2">
                <button type="button" onClick={selectAll} className="text-[11px] font-medium text-navy hover:underline">
                  Tout
                </button>
                <button type="button" onClick={clear} className="text-[11px] font-medium text-slate-400 hover:underline">
                  Effacer
                </button>
              </div>
              <span className="text-[11px] text-slate-400">{summary}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

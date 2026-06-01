"use client";

import { EmptyState } from "@/components/ui/EmptyState";

type Cell = string | number | null | undefined;

/** Tableau générique réutilisant le style `.table-default` du dashboard. */
export function DataTable({
  columns,
  rows,
  maxRows = 60,
  format,
}: {
  columns: string[];
  rows: Record<string, Cell>[];
  maxRows?: number;
  format?: (col: string, value: Cell) => React.ReactNode;
}) {
  if (!rows.length || !columns.length) return <EmptyState message="Aucune donnée disponible." />;
  const render = (col: string, v: Cell): React.ReactNode => {
    if (format) {
      const out = format(col, v);
      if (out !== undefined) return out;
    }
    if (v === null || v === undefined || v === "") return "—";
    if (typeof v === "number") return Number.isInteger(v) ? v.toLocaleString("fr-FR") : v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
    return String(v);
  };
  return (
    <div className="overflow-x-auto">
      <table className="table-default">
        <thead>
          <tr>
            {columns.map((c) => <th key={c} className="!normal-case">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, maxRows).map((r, i) => (
            <tr key={i}>
              {columns.map((c) => <td key={c}>{render(c, r[c])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > maxRows ? (
        <div className="text-[11px] text-surface-500 mt-1.5 px-1">{rows.length - maxRows} ligne(s) supplémentaire(s) non affichée(s).</div>
      ) : null}
    </div>
  );
}

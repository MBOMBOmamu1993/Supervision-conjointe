import { cn } from "@/lib/client/cn";
import { fmtPct } from "@/lib/client/format";

export type KpiTone = "neutral" | "good" | "warn" | "bad" | "brand" | "violet" | "teal";

const TONE: Record<KpiTone, { accent: string; value: string }> = {
  neutral: { accent: "border-l-surface-300", value: "text-surface-900" },
  good: { accent: "border-l-good-500", value: "text-good-600" },
  warn: { accent: "border-l-warn-500", value: "text-warn-600" },
  bad: { accent: "border-l-danger-500", value: "text-danger-600" },
  brand: { accent: "border-l-oms-500", value: "text-oms-700" },
  violet: { accent: "border-l-[#7c3aed]", value: "text-[#6d28d9]" },
  teal: { accent: "border-l-[#0d9488]", value: "text-[#0f766e]" },
};

export function KpiCard({
  label,
  value,
  pct,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: React.ReactNode;
  /** % de réalisation (affiché en sous-titre si fourni). */
  pct?: number | null;
  tone?: KpiTone;
  hint?: string;
}) {
  const t = TONE[tone];
  return (
    <div title={hint} className={cn("relative rounded-md border border-surface-200 bg-white px-4 py-3 border-l-[3px] transition hover:border-surface-300", t.accent)}>
      <div className="kpi-label truncate" title={label}>{label}</div>
      <div className={cn("kpi-value mt-1.5", t.value)}>{value}</div>
      {pct !== undefined ? (
        <div className="kpi-sub mt-1">
          {pct === null ? <span className="text-surface-300">% réalisation : n/d</span> : <>% réalisation : <span className="font-semibold text-surface-800">{fmtPct(pct)}</span></>}
        </div>
      ) : null}
    </div>
  );
}

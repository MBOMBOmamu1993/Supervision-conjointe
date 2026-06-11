"use client";

/* =========================================================================
   proto.tsx — bibliothèque commune fidèle à apercu/shared.js
   (palette, helpers, badges, KPI, tuiles) — Supervision PEV / OMS · Tshuapa
   ========================================================================= */
import { Icon, type IconName } from "@/components/ui/Icon";

export const C = {
  green: "#1f9d57", blue: "#0093d5", orange: "#f59e0b", red: "#e23636",
  navy: "#00205c", navy2: "#0a3a86", violet: "#7c3aed", teal: "#0d9488",
  grid: "#e8eef5", axis: "#64748b", na: "#cbd5e1",
};

export const COTATION = [
  { key: "tres_bon", label: "Très bon", color: C.green },
  { key: "bon", label: "Bon", color: C.blue },
  { key: "moyen", label: "Moyen", color: C.orange },
  { key: "faible", label: "Faible", color: C.red },
];

export const COMPS = [
  "Planification & gestion des ressources", "Atteinte des populations cibles", "Supervision formative",
  "Monitorage pour action", "Engagement communautaire", "Surveillance épidémiologique",
];
export const COMPS_SHORT = [
  "Planification & ressources", "Atteinte des populations", "Supervision formative",
  "Monitorage pour action", "Engagement communautaire", "Surveillance épidémio.",
];
export const MONTHS = ["Jan 2026", "Fév 2026", "Mar 2026"];

export type Tone = "navy" | "green" | "violet" | "orange" | "teal" | "red" | "blue";

export const TONES: Record<Tone, { ico: string; bg: string; border: string; text: string }> = {
  navy: { ico: "#00205c", bg: "#e7ecf6", border: "#c5d2ea", text: "#00205c" },
  green: { ico: "#1f9d57", bg: "#e9f8f0", border: "#bce6cf", text: "#178a44" },
  violet: { ico: "#7c3aed", bg: "#f2ecfe", border: "#ddc9fb", text: "#6d28d9" },
  orange: { ico: "#f59e0b", bg: "#fff5e4", border: "#fbe2ad", text: "#c87b04" },
  teal: { ico: "#0d9488", bg: "#e6f6f4", border: "#b6e3dd", text: "#0f766e" },
  red: { ico: "#e23636", bg: "#fdecec", border: "#f6c4c4", text: "#c81e1e" },
  blue: { ico: "#0093d5", bg: "#e6f3fb", border: "#bce0f3", text: "#0078ae" },
};
export const HT: Record<Tone, { from: string; to: string }> = {
  navy: { from: "#0a3a86", to: "#00205c" }, teal: { from: "#19c2b1", to: "#0d9488" },
  violet: { from: "#9d5cf5", to: "#7c3aed" }, green: { from: "#2bbd6b", to: "#1f9d57" },
  orange: { from: "#fbbf24", to: "#f08c00" }, blue: { from: "#36b3ec", to: "#0093d5" },
  red: { from: "#f4625f", to: "#e23636" },
};

export const cotColor = (p: number) => (p >= 80 ? C.green : p >= 60 ? C.blue : p >= 40 ? C.orange : C.red);
export const fmt = (n: number | string | null | undefined) =>
  typeof n === "number" ? n.toLocaleString("fr-FR") : n == null ? "" : n;

export function apprConc(p: number): { label: string; tone: Tone } {
  if (p >= 95 && p <= 105) return { label: "Pas de discordance", tone: "green" };
  if (p < 95) return { label: "Sous-rapportage", tone: "orange" };
  return { label: "Sur-rapportage", tone: "red" };
}

/* ---------------- Composants ---------------- */

export function Badge({ icon, tone, size = 34 }: { icon: IconName; tone: Tone; size?: number }) {
  const t = HT[tone];
  const s = Math.round(size * 0.55);
  return (
    <span
      className="inline-flex items-center justify-center text-white shrink-0"
      style={{
        width: size, height: size, borderRadius: Math.round(size * 0.3),
        background: `linear-gradient(145deg, ${t.from}, ${t.to})`, boxShadow: `0 5px 13px -5px ${t.to}`,
      }}
    >
      <Icon name={icon} style={{ width: s, height: s }} strokeWidth={2} />
    </span>
  );
}

export function ApprBadge({ p }: { p: number }) {
  const a = apprConc(p);
  const t = TONES[a.tone];
  return (
    <span className="badge-appr inline-flex items-center gap-[5px] rounded-full px-[9px] py-[3px] text-[11px] font-extrabold"
      style={{ background: t.bg, color: t.text }}>
      {a.label}
    </span>
  );
}

export function KpiTile({ icon, tone, label, value, pct, sub }: {
  icon: IconName; tone: Tone; label: React.ReactNode; value: React.ReactNode; pct?: number; sub?: string;
}) {
  const t = TONES[tone];
  return (
    <div className="relative flex flex-col items-center rounded-2xl border p-4 pt-4 text-center transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-12px_rgba(15,23,42,.28)]"
      style={{ background: t.bg, borderColor: t.border }}>
      <div className="mb-2 flex h-[54px] w-[54px] items-center justify-center rounded-full shadow-[0_6px_14px_-6px_rgba(0,0,0,.35)]"
        style={{ background: t.ico, color: "#fff" }}>
        <Icon name={icon} style={{ width: 26, height: 26 }} strokeWidth={1.9} />
      </div>
      <div className="text-[11.5px] font-bold leading-tight" style={{ color: t.text }}>{label}</div>
      <div className="my-1 mt-[7px] text-[30px] font-extrabold leading-none tabular-nums" style={{ color: t.text }}>{fmt(value as never)}</div>
      {pct !== undefined ? (
        <div className="text-[11.5px] font-medium text-surface-700">% réalisation : <b style={{ color: t.text }}>{pct}%</b></div>
      ) : sub ? (
        <div className="text-[11.5px] font-medium text-surface-700" dangerouslySetInnerHTML={{ __html: sub }} />
      ) : null}
    </div>
  );
}

export function CardTitle({ icon, tone, title, sub, right, rightBelow }: { icon: IconName; tone: Tone; title: string; sub?: string; right?: React.ReactNode; rightBelow?: boolean }) {
  // rightBelow : pour les cartes étroites, les actions (ex. boutons d'export)
  // passent sous le titre au lieu de l'écraser sur la même ligne.
  if (right && rightBelow) {
    return (
      <div className="mb-2">
        <div className="flex items-center gap-2.5">
          <Badge icon={icon} tone={tone} size={34} />
          <div className="min-w-0">
            <div className="text-[12.5px] font-bold leading-tight text-navy-700">{title}</div>
            {sub ? <div className="text-[11px] leading-snug text-surface-500">{sub}</div> : null}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">{right}</div>
      </div>
    );
  }
  return (
    <div className="mb-2 flex items-center gap-2.5">
      <Badge icon={icon} tone={tone} size={34} />
      <div className="min-w-0">
        <div className="text-[12.5px] font-bold leading-tight text-navy-700">{title}</div>
        {sub ? <div className="text-[11px] leading-snug text-surface-500">{sub}</div> : null}
      </div>
      {right ? <div className="ml-auto flex shrink-0 items-center gap-2">{right}</div> : null}
    </div>
  );
}

export function HlCard({ icon, tone, label, big, sub }: { icon: IconName; tone: Tone; label: string; big: string; sub?: string }) {
  const t = TONES[tone];
  return (
    <div className="rounded-xl border" style={{ background: t.bg, borderColor: t.border, padding: "14px 16px" }}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full text-white" style={{ background: t.ico }}>
          <Icon name={icon} className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: t.text }}>{label}</div>
          <div className="mt-0.5 text-[15px] font-extrabold leading-snug" style={{ color: t.text }}>{big}</div>
          {sub ? <div className="mt-0.5 text-[11.5px] text-surface-700">{sub}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function StatTile({ icon, tone, label, big, sub }: { icon: IconName; tone: Tone; label: string; big: string; sub?: string }) {
  const t = TONES[tone];
  return (
    <div className="card card-pad flex items-center gap-3">
      <div className="flex h-[42px] w-[42px] items-center justify-center rounded-full text-white" style={{ background: t.ico }}>
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-surface-700">{label}</div>
        <div className="mt-0.5 text-[17px] font-extrabold leading-tight" style={{ color: t.text }}>{big}</div>
        {sub ? <div className="mt-0.5 text-[11px] text-surface-700">{sub}</div> : null}
      </div>
    </div>
  );
}

/** Bannière d'en-tête de page (dégradé clair → blanc). */
export function Banner({ icon, tone, title, sub }: { icon: IconName; tone: Tone; title: string; sub: React.ReactNode }) {
  const t = TONES[tone];
  return (
    <div className="card card-pad flex items-center gap-3" style={{ background: `linear-gradient(90deg, ${t.bg}, #fff)` }}>
      <Badge icon={icon} tone={tone} size={36} />
      <div>
        <div className="text-[14px] font-extrabold text-navy-700">{title}</div>
        <div className="text-[11.5px] text-surface-700">{sub}</div>
      </div>
    </div>
  );
}

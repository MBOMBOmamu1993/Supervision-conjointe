export function fmtPct(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

export function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("fr-FR").format(n);
}

const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

/** Libellé court d'un mois par index 0–11 ("Jan", "Fév", …). */
export function monthLabel(idx: number): string {
  return MONTHS_FR[idx] ?? String(idx + 1);
}

/** "2025-03" → "Mar 2025" */
export function fmtMonth(m: string): string {
  const match = m.match(/(\d{4})-(\d{2})/);
  if (!match) return m;
  const idx = parseInt(match[2], 10) - 1;
  return `${MONTHS_FR[idx] ?? match[2]} ${match[1]}`;
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

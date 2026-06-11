"use client";

import EChart from "./EChart";
import { cotationFor, COTATION_COLOR } from "@/config/supervision.config";
import { wrapText } from "@/lib/client/format";

/** Barres horizontales de score (%), couleur selon cotation. */
export default function HBar({
  data,
  height,
  max = 100,
  colorByCotation = true,
  exportTitle,
  colorFor,
}: {
  data: { name: string; value: number | null }[];
  height?: number;
  max?: number;
  colorByCotation?: boolean;
  exportTitle?: string;
  /** Couleur de barre personnalisée (prioritaire sur la cotation). */
  colorFor?: (value: number) => string;
}) {
  const clean = data.filter((d) => d.value !== null) as { name: string; value: number }[];
  const h = height ?? Math.max(120, clean.length * 28 + 40);
  // ECharts yAxis category affiche de bas en haut → on inverse pour avoir le meilleur en haut
  const ordered = [...clean].reverse();
  return (
    <EChart
      height={h}
      exportTitle={exportTitle}
      option={{
        grid: { left: 4, right: 44, top: 8, bottom: 8, containLabel: true },
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "shadow" },
          confine: true,
          // Ramène à la ligne les libellés longs (questions) pour qu'ils soient
          // lisibles en totalité au survol.
          formatter: (params: { name: string; value: number }[]) => {
            const p = params[0];
            if (!p) return "";
            return `${wrapText(p.name, 40, "<br/>")}<br/><b>${p.value}%</b>`;
          },
        },
        xAxis: { type: "value", max, axisLabel: { formatter: "{value}%", fontSize: 10 }, splitLine: { lineStyle: { color: "#f1f5f9" } } },
        yAxis: { type: "category", data: ordered.map((d) => d.name), axisLabel: { fontSize: 11, width: 130, overflow: "truncate" }, axisTick: { show: false } },
        series: [
          {
            type: "bar",
            data: ordered.map((d) => ({
              value: d.value,
              itemStyle: { color: colorFor ? colorFor(d.value) : colorByCotation ? COTATION_COLOR[cotationFor(d.value)] : "#0093d5", borderRadius: [0, 3, 3, 0] },
            })),
            barWidth: "62%",
            label: { show: true, position: "right", formatter: (p: { value: number }) => `${p.value}%`, fontSize: 10, color: "#475569" },
          },
        ],
      }}
    />
  );
}

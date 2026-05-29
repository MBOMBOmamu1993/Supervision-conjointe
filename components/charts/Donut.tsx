"use client";

import EChart from "./EChart";

export default function Donut({
  data,
  height = 200,
  centerLabel,
}: {
  data: { name: string; value: number; color?: string }[];
  height?: number;
  centerLabel?: string;
}) {
  const total = data.reduce((a, b) => a + b.value, 0);
  return (
    <EChart
      height={height}
      option={{
        tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
        title: centerLabel
          ? { text: centerLabel, left: "center", top: "center", textStyle: { fontSize: 11, color: "#64748b" } }
          : undefined,
        legend: { show: false },
        series: [
          {
            type: "pie",
            radius: ["58%", "82%"],
            avoidLabelOverlap: true,
            itemStyle: { borderRadius: 3, borderColor: "#fff", borderWidth: 2 },
            label: { show: false },
            labelLine: { show: false },
            data: data.map((d) => ({ name: d.name, value: d.value, itemStyle: d.color ? { color: d.color } : undefined })),
          },
        ],
        graphic: total === 0 ? { type: "text", left: "center", top: "center", style: { text: "—", fill: "#cbd5e1", fontSize: 16 } } : undefined,
      }}
    />
  );
}

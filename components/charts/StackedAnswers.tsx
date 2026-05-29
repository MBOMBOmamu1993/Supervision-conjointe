"use client";

import EChart from "./EChart";
import { ANSWER_COLOR, ANSWER_LABEL, type AnswerValue } from "@/config/supervision.config";

/** Barres horizontales 100% empilées Oui / Partiel / Non / NA par composante. */
export default function StackedAnswers({
  rows,
  height,
}: {
  rows: { name: string; answers: Record<AnswerValue, number> }[];
  height?: number;
}) {
  const order: AnswerValue[] = ["oui", "partiel", "non", "na"];
  const cats = rows.map((r) => r.name);
  const h = height ?? Math.max(120, rows.length * 30 + 50);
  // pourcentages par ligne
  const pct = (r: { answers: Record<AnswerValue, number> }, a: AnswerValue) => {
    const tot = order.reduce((s, k) => s + r.answers[k], 0);
    return tot ? Math.round((r.answers[a] / tot) * 100) : 0;
  };
  const ordered = [...rows].reverse();
  return (
    <EChart
      height={h}
      option={{
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v: number) => `${v}%` },
        legend: { top: 0, textStyle: { fontSize: 10 }, data: order.map((a) => ANSWER_LABEL[a]) },
        grid: { left: 4, right: 12, top: 28, bottom: 4, containLabel: true },
        xAxis: { type: "value", max: 100, axisLabel: { formatter: "{value}%", fontSize: 10 } },
        yAxis: { type: "category", data: ordered.map((r) => r.name), axisLabel: { fontSize: 10, width: 130, overflow: "truncate" }, axisTick: { show: false } },
        series: order.map((a) => ({
          name: ANSWER_LABEL[a],
          type: "bar",
          stack: "total",
          data: ordered.map((r) => pct(r, a)),
          itemStyle: { color: ANSWER_COLOR[a] },
          barWidth: "60%",
        })),
      }}
    />
  );
}

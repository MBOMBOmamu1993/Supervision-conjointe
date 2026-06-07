"use client";

/* =========================================================================
   charts-ext.tsx — graphiques additionnels pour les onglets SAV & AT
   (jauge de performance, courbe multi-séries, barres empilées par composante,
   radar à axes gradués). Charte PEV / OMS conservée.
   ========================================================================= */
import EChart from "@/components/charts/EChart";
import { C } from "./proto";

/** Jauge de performance (0–100) segmentée par niveau, aiguille sur la valeur. */
export function ProtoGauge({ value, height = 240, label }: { value: number; height?: number; label?: string }) {
  return (
    <EChart height={height} option={{
      series: [{
        type: "gauge", min: 0, max: 100, startAngle: 210, endAngle: -30,
        radius: "92%", center: ["50%", "62%"],
        axisLine: { lineStyle: { width: 16, color: [[0.6, "#e23636"], [0.7, "#f59e0b"], [0.8, "#facc15"], [0.9, "#2bbd6b"], [1, "#178a44"]] } },
        pointer: { width: 5, length: "62%", itemStyle: { color: C.navy } },
        axisTick: { distance: -16, length: 5, lineStyle: { color: "#fff", width: 1 } },
        splitLine: { distance: -16, length: 16, lineStyle: { color: "#fff", width: 2 } },
        axisLabel: { distance: 18, fontSize: 9, color: C.axis },
        anchor: { show: true, size: 12, itemStyle: { color: C.navy } },
        title: { show: false },
        detail: { valueAnimation: true, formatter: "{value}%", fontSize: 26, fontWeight: 800, color: C.navy, offsetCenter: [0, "38%"] },
        data: [{ value: Math.round(value * 10) / 10, name: label ?? "" }],
      }],
    }} />
  );
}

/** Courbe multi-séries (évolution mensuelle des scores). */
export function ProtoMultiLine({ cats, series, height = 280, max = 110 }: {
  cats: string[]; series: { name: string; color: string; vals: (number | null)[] }[]; height?: number; max?: number;
}) {
  return (
    <EChart height={height} option={{
      color: series.map((s) => s.color),
      tooltip: { trigger: "axis", confine: true },
      legend: { show: true, top: 0, itemWidth: 14, itemHeight: 8, textStyle: { fontSize: 10, color: "#334155" }, data: series.map((s) => s.name) },
      grid: { left: 38, right: 22, top: 30, bottom: 28 },
      xAxis: { type: "category", data: cats, boundaryGap: false, axisLabel: { fontSize: 10, color: C.axis }, axisLine: { lineStyle: { color: C.grid } } },
      yAxis: { type: "value", min: 0, max, axisLabel: { formatter: "{value}%", fontSize: 9, color: C.axis }, splitLine: { lineStyle: { color: C.grid } } },
      series: series.map((s) => ({
        name: s.name, type: "line", data: s.vals, smooth: false, symbol: "circle", symbolSize: 7, connectNulls: true,
        lineStyle: { width: 2.6, color: s.color }, itemStyle: { color: s.color, borderColor: "#fff", borderWidth: 1.5 },
      })),
    }} />
  );
}

/** Barres empilées horizontales : contribution de chaque composante (NA en gris). */
export function ProtoStackComp({ cats, series, height = 280, max = 110 }: {
  cats: string[];
  series: { name: string; color: string; vals: (number | null)[] }[];
  height?: number; max?: number;
}) {
  return (
    <EChart height={height} option={{
      color: series.map((s) => s.color),
      tooltip: {
        trigger: "axis", axisPointer: { type: "shadow" }, confine: true,
        formatter: (ps: { seriesName: string; value: number | null; marker: string }[]) =>
          ps.map((p) => `${p.marker}${p.seriesName}: <b>${p.value == null ? "NA" : p.value}</b>`).join("<br>"),
      },
      legend: { show: true, top: 0, type: "scroll", itemWidth: 11, itemHeight: 8, textStyle: { fontSize: 9, color: "#334155" }, data: series.map((s) => s.name) },
      grid: { left: 60, right: 16, top: 30, bottom: 16 },
      xAxis: { type: "value", max, axisLabel: { fontSize: 9, color: C.axis }, splitLine: { lineStyle: { color: C.grid } } },
      yAxis: { type: "category", data: cats.slice().reverse(), axisLabel: { fontSize: 10.5, color: "#1e293b", fontWeight: 700 }, axisTick: { show: false }, axisLine: { show: false } },
      series: series.map((s) => ({
        name: s.name, type: "bar", stack: "a", barWidth: "55%",
        data: s.vals.slice().reverse().map((v) => (v == null ? 0 : v)),
        label: { show: false },
      })),
    }} />
  );
}

/** Radar à axes gradués (max par axe) et plusieurs profils d'AT. */
export function ProtoRadarMax({ indicators, series, height = 300 }: {
  indicators: { name: string; max: number }[];
  series: { name: string; color: string; vals: number[] }[];
  height?: number;
}) {
  return (
    <EChart height={height} option={{
      color: series.map((s) => s.color),
      legend: { show: true, bottom: 0, itemWidth: 12, itemHeight: 8, textStyle: { fontSize: 9.5, color: "#334155" }, data: series.map((s) => s.name) },
      tooltip: { trigger: "item", confine: true },
      radar: {
        indicator: indicators, radius: "62%", center: ["50%", "46%"],
        name: { textStyle: { fontSize: 8.5, color: "#475569" } }, splitNumber: 4,
        splitLine: { lineStyle: { color: "#dbe3ee" } }, splitArea: { areaStyle: { color: ["#fbfcfe", "#f3f6fb"] } }, axisLine: { lineStyle: { color: "#dbe3ee" } },
      },
      series: [{ type: "radar", data: series.map((s) => ({ name: s.name, value: s.vals, lineStyle: { width: 2, color: s.color }, itemStyle: { color: s.color }, areaStyle: { opacity: 0.06, color: s.color }, symbol: "circle", symbolSize: 3 })) }],
    }} />
  );
}

/** Barres verticales colorées par score (seuils de cotation). */
export function ProtoScoreBar({ cats, vals, height = 220, unit = "%", max = 100, horiz = false }: {
  cats: string[]; vals: number[]; height?: number; unit?: string; max?: number; horiz?: boolean;
}) {
  const col = (v: number) => (v >= 80 ? C.green : v >= 60 ? C.blue : v >= 40 ? C.orange : C.red);
  const data = vals.map((v) => ({ value: v, itemStyle: { color: col(v), borderRadius: horiz ? [0, 4, 4, 0] as number[] : [4, 4, 0, 0] as number[] } }));
  return (
    <EChart height={height} option={{
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, confine: true },
      grid: { left: horiz ? 120 : 40, right: horiz ? 42 : 14, top: 10, bottom: horiz ? 24 : 40 },
      xAxis: horiz
        ? { type: "value", max, axisLabel: { formatter: "{value}" + unit, fontSize: 9, color: C.axis }, splitLine: { lineStyle: { color: C.grid } } }
        : { type: "category", data: cats, axisLabel: { fontSize: 10, color: "#1e293b", fontWeight: 600, interval: 0, rotate: cats.some((c) => c.length > 6) ? 35 : 0 } },
      yAxis: horiz
        ? { type: "category", data: cats.slice().reverse(), axisLabel: { fontSize: 10.5, color: "#1e293b", fontWeight: 600 }, axisTick: { show: false }, axisLine: { show: false } }
        : { type: "value", max, axisLabel: { formatter: "{value}" + unit, fontSize: 9, color: C.axis }, splitLine: { lineStyle: { color: C.grid } } },
      series: [{
        type: "bar", barWidth: "58%",
        data: horiz ? data.slice().reverse() : data,
        label: { show: true, position: horiz ? "right" : "top", formatter: "{c}" + unit, fontSize: 10, fontWeight: 700, color: "#334155" },
      }],
    }} />
  );
}

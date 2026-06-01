"use client";

/* =========================================================================
   charts.tsx — graphiques ECharts fidèles à apercu/shared.js
   ========================================================================= */
import EChart from "@/components/charts/EChart";
import { C, COTATION, COMPS_SHORT, MONTHS, cotColor } from "./proto";

function wrapText(s: string, n = 34): string[] {
  s = ("" + s).trim();
  const words = s.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > n) { if (cur) lines.push(cur); cur = w; }
    else cur = (cur ? cur + " " : "") + w;
  }
  if (cur) lines.push(cur);
  return lines;
}
const ellipsize = (s: string, n = 22) => ((s = "" + s), s.length > n ? s.slice(0, n - 1) + "…" : s);

export function ProtoDonut({ dist, height = 150 }: { dist: number[]; height?: number }) {
  const data = COTATION.map((c, i) => ({ value: dist[i], name: c.label, itemStyle: { color: c.color } }));
  return (
    <EChart height={height} option={{
      tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
      series: [{
        type: "pie", radius: ["52%", "78%"], center: ["50%", "50%"], avoidLabelOverlap: false,
        label: { show: true, position: "outside", formatter: "{d}%", fontSize: 11, color: "#475569", fontWeight: 600 },
        labelLine: { show: true, length: 6, length2: 6 }, data,
      }],
    }} />
  );
}

export function ProtoHBar({ rows, height = 160, color, byCot = true, maxName = 120, unit = "%", max = 100 }: {
  rows: [string, number][]; height?: number; color?: string; byCot?: boolean; maxName?: number; unit?: string; max?: number;
}) {
  const names = rows.map((r) => r[0]), vals = rows.map((r) => r[1]);
  return (
    <EChart height={height} option={{
      grid: { left: maxName, right: 42, top: 6, bottom: 24 },
      tooltip: {
        trigger: "axis", axisPointer: { type: "shadow" }, confine: true,
        formatter: (p: { name: string; value: number }[]) => { const o = p[0]; return wrapText(o.name, 30).join("<br>") + "<br><b>" + o.value + unit + "</b>"; },
      },
      xAxis: { type: "value", max, axisLabel: { formatter: "{value}" + unit, fontSize: 9, color: C.axis }, splitLine: { lineStyle: { color: C.grid } } },
      yAxis: { type: "category", data: names.slice().reverse(), axisLabel: { fontSize: 10.5, color: "#1e293b", fontWeight: 600, formatter: (v: string) => ellipsize(v, 24) }, axisTick: { show: false }, axisLine: { show: false } },
      series: [{
        type: "bar", barWidth: "58%",
        data: vals.slice().reverse().map((v) => ({ value: v, itemStyle: { color: byCot ? cotColor(v) : color, borderRadius: [0, 4, 4, 0] } })),
        label: { show: true, position: "right", formatter: "{c}" + unit, fontSize: 10.5, fontWeight: 700, color: "#334155" },
      }],
    }} />
  );
}

export function ProtoLine({ series, color, height = 175, months = MONTHS }: { series: number[]; color: string; height?: number; months?: string[] }) {
  return (
    <EChart height={height} option={{
      grid: { left: 34, right: 24, top: 24, bottom: 30 },
      tooltip: { trigger: "axis", confine: true },
      xAxis: { type: "category", data: months, boundaryGap: false, axisLabel: { fontSize: 9.5, color: C.axis }, axisLine: { lineStyle: { color: C.grid } } },
      yAxis: { type: "value", min: 0, max: 100, interval: 50, axisLabel: { formatter: "{value}%", fontSize: 9, color: C.axis }, splitLine: { lineStyle: { color: C.grid } } },
      series: [{
        type: "line", data: series, smooth: false, symbol: "circle", symbolSize: 8,
        lineStyle: { width: 3, color }, itemStyle: { color, borderColor: "#fff", borderWidth: 2 },
        label: { show: true, position: "top", formatter: "{c}%", fontSize: 11, fontWeight: 700, color }, areaStyle: { color: color + "18" },
      }],
    }} />
  );
}

export function ProtoGroupedBar({ cats, series, height = 200, unit = "", max, colors }: {
  cats: string[]; series: { name: string; data: number[] }[]; height?: number; unit?: string; max?: number; colors?: string[];
}) {
  return (
    <EChart height={height} option={{
      color: colors || [C.navy, C.blue, C.orange, C.green],
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, confine: true },
      legend: { show: true, top: 0, itemWidth: 11, itemHeight: 8, textStyle: { fontSize: 10, color: "#334155" } },
      grid: { left: 42, right: 14, top: 28, bottom: 22 },
      xAxis: { type: "category", data: cats, axisLabel: { fontSize: 10, color: "#1e293b", fontWeight: 600, interval: 0 } },
      yAxis: { type: "value", max, axisLabel: { fontSize: 9, color: C.axis, formatter: "{value}" + unit }, splitLine: { lineStyle: { color: C.grid } } },
      series: series.map((s) => ({ name: s.name, type: "bar", data: s.data, barGap: "6%", barWidth: series.length > 3 ? "13%" : "17%", label: { show: true, position: "top", fontSize: 8.5, fontWeight: 700, color: "#475569", formatter: "{c}" } })),
    }} />
  );
}

export function ProtoRadar({ indicators, names, vals, height = 280 }: { indicators: string[]; names: string[]; vals: number[][]; height?: number }) {
  return (
    <EChart height={height} option={{
      color: [C.navy, C.green, C.violet, C.orange],
      legend: { show: true, bottom: 0, itemWidth: 12, itemHeight: 8, textStyle: { fontSize: 9.5, color: "#334155" }, data: names },
      radar: {
        indicator: indicators.map((n) => ({ name: n, max: 100 })), radius: "60%", center: ["50%", "46%"],
        name: { textStyle: { fontSize: 9, color: "#475569" } }, splitNumber: 4,
        splitLine: { lineStyle: { color: "#dbe3ee" } }, splitArea: { areaStyle: { color: ["#fbfcfe", "#f3f6fb"] } }, axisLine: { lineStyle: { color: "#dbe3ee" } },
      },
      series: [{ type: "radar", data: names.map((n, i) => ({ name: n, value: vals[i], lineStyle: { width: 2 }, areaStyle: { opacity: 0.05 }, symbol: "circle", symbolSize: 3 })) }],
    }} />
  );
}

export function ProtoStacked({ rows, height = 215 }: { rows: number[][]; height?: number }) {
  const cats = ["Oui", "Partiel", "Non", "NA"], cols = [C.green, C.orange, C.red, C.na];
  const names = COMPS_SHORT;
  const series = cats.map((cat, ci) => ({
    name: cat, type: "bar", stack: "a", barWidth: "62%", itemStyle: { color: cols[ci] },
    label: { show: ci < 3, formatter: (p: { value: number }) => (p.value >= 8 ? p.value + "%" : ""), fontSize: 9, fontWeight: 700, color: ci === 1 ? "#7a4a00" : "#fff" },
    data: rows.map((r) => r[ci]).slice().reverse(),
  }));
  return (
    <EChart height={height} option={{
      legend: { show: true, top: 0, itemWidth: 11, itemHeight: 8, textStyle: { fontSize: 9.5, color: "#334155" }, data: cats },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, confine: true },
      grid: { left: 140, right: 14, top: 26, bottom: 20 },
      xAxis: { type: "value", max: 100, axisLabel: { formatter: "{value}%", fontSize: 9, color: C.axis }, splitLine: { lineStyle: { color: C.grid } } },
      yAxis: { type: "category", data: names.slice().reverse(), axisLabel: { fontSize: 9.5, color: "#1e293b", fontWeight: 600 }, axisTick: { show: false }, axisLine: { show: false } },
      series,
    }} />
  );
}

export function ProtoTopNon({ rows, height = 170 }: { rows: [string, number][]; height?: number }) {
  const names = rows.map((r, i) => `${i + 1}. ${r[0]}`), vals = rows.map((r) => r[1]);
  return (
    <EChart height={height} option={{
      grid: { left: 212, right: 40, top: 4, bottom: 6 },
      tooltip: {
        trigger: "axis", axisPointer: { type: "shadow" }, confine: true,
        formatter: (p: { name: string; value: number }[]) => { const o = p[0]; return wrapText(o.name, 38).join("<br>") + "<br><b style='color:#e23636'>" + o.value + "% de « Non »</b>"; },
      },
      xAxis: { type: "value", max: 40, show: false },
      yAxis: { type: "category", data: names.slice().reverse(), axisLabel: { fontSize: 9.5, color: "#1e293b", fontWeight: 600, width: 200, overflow: "truncate" }, axisTick: { show: false }, axisLine: { show: false } },
      series: [{ type: "bar", barWidth: "55%", data: vals.slice().reverse(), itemStyle: { color: C.red, borderRadius: [0, 4, 4, 0] }, label: { show: true, position: "right", formatter: "{c}%", fontSize: 10.5, fontWeight: 700, color: C.red } }],
    }} />
  );
}

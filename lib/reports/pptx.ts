/**
 * Génération des 2 rapports PowerPoint automatisés (côté serveur, pptxgenjs).
 *
 * 1. Supervision PEV & CQD — Zones de santé   (23 diapositives)
 * 2. Supervision PEV & CQD — Centres de santé (26 diapositives)
 *
 * Rendu calqué sur `handoff_rapports_pptx/design_reference/` :
 *   - bandeau marine OMS (logos OMS + PEV à gauche, liseré cyan) ;
 *   - graphiques ÉPURÉS : aucune ligne de fond, aucun axe vertical, valeur
 *     posée au-dessus de chaque barre, une seule fine ligne de base ;
 *   - couleurs par seuil de score et par concordance ;
 *   - callout « LECTURE PEV / ALERTE PEV » (commentaire d'expert dynamique) ;
 *   - pied de page complet avec champs dynamiques (Période / Source / Date).
 *
 * Le contenu diapo-par-diapo et les commentaires sont définis dans
 * `lib/reports/report-data.ts` (portage fidèle des `data-*.js`).
 */
import PptxGenJS from "pptxgenjs";
import { readFileSync } from "fs";
import { join } from "path";
import {
  PAL,
  scoreColor,
  concColor,
  ZS_DECK,
  CS_DECK,
  type Deck,
  type Slide,
  type Bar,
  type Grouped,
  type ChartOpt,
  type ColorToken,
  type Table as TblSpec,
  type Row,
  type Cell,
  type Kpi,
  type Tone,
  type NoteKind,
  type SideBlock,
} from "@/lib/reports/report-data";

/* --------------------------------- Constantes ----------------------------- */
const W = 13.333;
const H = 7.5;
const HB = 0.95; // hauteur du bandeau
const MX = 0.55; // marge horizontale du corps
const BW = W - MX * 2; // largeur utile du corps
const FONT = "Arial";
const MONO = "Consolas";
const NOTE_Y = 6.02;
const NOTE_H = 0.86;
const FOOT_Y = 7.0;

const dateFr = () => new Date().toLocaleDateString("fr-FR");

function logoDataUri(file: string): string {
  for (const f of [file]) {
    try {
      const buf = readFileSync(join(process.cwd(), "public", "logo", f));
      return `data:image/png;base64,${buf.toString("base64")}`;
    } catch {
      /* ignore */
    }
  }
  return "";
}

interface Ctx {
  pptx: PptxGenJS;
  deck: Deck;
  oms: string;
  pev: string;
}

/* ----------------------------- Couleurs utilitaires ----------------------- */
function resolveColorFn(token?: ColorToken): (v: number) => string {
  if (token === "conc") return concColor;
  if (token === "cyan") return () => PAL.cyan;
  return scoreColor;
}
const toneAccent = (t?: Tone): string =>
  t === "red" ? PAL.rouge : t === "green" ? PAL.vert : t === "amber" ? PAL.jaune : t === "blue" ? PAL.bleu : PAL.cyan;
const toneValue = (t?: Tone): string =>
  t === "red" ? PAL.rouge : t === "green" ? PAL.vert : t === "amber" ? PAL.amberText : t === "blue" ? PAL.bleu : PAL.marine;
const pillColor = (c: string): string => (c === "green" ? PAL.vert : c === "amber" ? PAL.jaune : c === "red" ? PAL.rouge : PAL.bleu);

/* ------------------------------- Primitives ------------------------------- */
function blockH(s: PptxGenJS.Slide, x: number, y: number, w: number, text: string) {
  s.addShape("rect", { x, y: y + 0.06, w: 0.1, h: 0.1, fill: { color: PAL.cyan } });
  s.addText(text, { x: x + 0.18, y, w: w - 0.18, h: 0.3, fontSize: 12.5, bold: true, color: PAL.marine, fontFace: FONT, valign: "middle" });
}

function header(ctx: Ctx, slide: Slide, no?: string): PptxGenJS.Slide {
  const s = ctx.pptx.addSlide();
  s.background = { color: PAL.white };
  // bandeau marine + liseré cyan
  s.addShape("rect", { x: 0, y: 0, w: W, h: HB, fill: { color: PAL.marine } });
  s.addShape("rect", { x: 0, y: HB - 0.05, w: W, h: 0.05, fill: { color: PAL.cyan } });
  // logos OMS + PEV à gauche
  if (ctx.oms) s.addImage({ data: ctx.oms, x: 0.42, y: 0.24, w: 0.95, h: 0.48, sizing: { type: "contain", w: 0.95, h: 0.48 } });
  s.addShape("line", { x: 1.5, y: 0.24, w: 0, h: 0.48, line: { color: "FFFFFF", width: 0.75, transparency: 70 } });
  if (ctx.pev) s.addImage({ data: ctx.pev, x: 1.62, y: 0.22, w: 0.58, h: 0.52, sizing: { type: "contain", w: 0.58, h: 0.52 } });
  // titre + sous-titre
  s.addText(slide.title.toUpperCase(), { x: 2.4, y: slide.sub ? 0.16 : 0.28, w: 8.0, h: 0.44, fontSize: 17, bold: true, color: PAL.white, fontFace: FONT, valign: "middle" });
  if (slide.sub) s.addText(slide.sub, { x: 2.4, y: 0.6, w: 8.0, h: 0.3, fontSize: 11, color: "A9C6EC", fontFace: FONT, valign: "middle" });
  // tag mono + n°
  if (slide.tag) {
    s.addShape("roundRect", { x: 10.7, y: 0.22, w: 2.1, h: 0.28, rectRadius: 0.04, fill: { color: "1A3D7A" } });
    s.addText(slide.tag.toUpperCase(), { x: 10.7, y: 0.22, w: 2.1, h: 0.28, fontSize: 8.5, color: "CFE2F6", fontFace: MONO, align: "center", valign: "middle", charSpacing: 1 });
  }
  if (no) s.addText(no, { x: 10.7, y: 0.55, w: 2.1, h: 0.26, fontSize: 11, bold: true, color: "9FC0E9", fontFace: FONT, align: "right", valign: "middle" });
  // pied de page
  s.addShape("line", { x: MX, y: FOOT_Y - 0.04, w: BW, h: 0, line: { color: PAL.line, width: 0.75 } });
  s.addText(ctx.deck.footer, { x: MX, y: FOOT_Y, w: BW * 0.55, h: 0.32, fontSize: 8, color: PAL.muted, fontFace: FONT, valign: "middle" });
  s.addText(
    [
      { text: "Période : ", options: { bold: true, color: PAL.marine } },
      { text: `${ctx.deck.period}  ·  Source ODK/Kobo/Excel  ·  Généré le ${dateFr()}`, options: { color: PAL.muted } },
    ],
    { x: MX + BW * 0.45, y: FOOT_Y, w: BW * 0.55, h: 0.32, fontSize: 8, fontFace: FONT, align: "right", valign: "middle" }
  );
  return s;
}

function note(s: PptxGenJS.Slide, text: string, kind: NoteKind = "read") {
  const fill = kind === "alert" ? "FDEEEE" : kind === "warn" ? "FFF5EC" : "EEF5FC";
  const border = kind === "alert" ? "F6C9C9" : kind === "warn" ? "FBD9B8" : "CFE1F4";
  const tag = kind === "alert" ? PAL.rouge : kind === "warn" ? PAL.jaune : PAL.cyan;
  const label = kind === "alert" ? "ALERTE PEV" : "LECTURE PEV";
  s.addShape("roundRect", { x: MX, y: NOTE_Y, w: BW, h: NOTE_H, rectRadius: 0.07, fill: { color: fill }, line: { color: border, width: 1 } });
  s.addShape("roundRect", { x: MX + 0.16, y: NOTE_Y + 0.13, w: 1.05, h: 0.27, rectRadius: 0.05, fill: { color: tag } });
  s.addText(label, { x: MX + 0.16, y: NOTE_Y + 0.13, w: 1.05, h: 0.27, fontSize: 8, bold: true, color: PAL.white, fontFace: MONO, align: "center", valign: "middle", charSpacing: 1 });
  s.addText(text, { x: MX + 1.4, y: NOTE_Y + 0.05, w: BW - 1.6, h: NOTE_H - 0.1, fontSize: 10, color: "243A5C", fontFace: FONT, valign: "middle" });
}

function kpiCard(s: PptxGenJS.Slide, x: number, y: number, w: number, h: number, k: Kpi) {
  s.addShape("roundRect", { x, y, w, h, rectRadius: 0.06, fill: { color: PAL.soft }, line: { color: PAL.line, width: 1 } });
  s.addShape("rect", { x, y, w: 0.07, h, fill: { color: toneAccent(k.tone) } });
  const valFs = h >= 1.1 ? 24 : 19;
  s.addText(k.v, { x: x + 0.16, y: y + 0.08, w: w - 0.28, h: h * 0.46, fontSize: valFs, bold: true, color: toneValue(k.tone), fontFace: FONT, valign: "middle" });
  s.addText(k.l, { x: x + 0.16, y: y + h * 0.5, w: w - 0.28, h: h * (k.s ? 0.28 : 0.46), fontSize: 10, bold: true, color: PAL.ink, fontFace: FONT, valign: "top" });
  if (k.s) s.addText(k.s, { x: x + 0.16, y: y + h * 0.74, w: w - 0.28, h: h * 0.24, fontSize: 8.5, color: PAL.muted, fontFace: FONT, valign: "top" });
}

function kpiRow(s: PptxGenJS.Slide, x: number, y: number, w: number, items: Kpi[], h = 0.95) {
  const n = items.length || 1;
  const gap = 0.16;
  const cw = (w - gap * (n - 1)) / n;
  items.forEach((k, i) => kpiCard(s, x + i * (cw + gap), y, cw, h, k));
}

/* --------------------------------- Tables --------------------------------- */
function cellToTbl(c: Cell): PptxGenJS.TableCell {
  if (typeof c === "object" && (c as any).pill) {
    const col = pillColor((c as any).c);
    return { text: (c as any).t, options: { fill: { color: col }, color: "FFFFFF", bold: true, align: "center", valign: "middle", fontSize: 9.5, fontFace: FONT } };
  }
  return { text: String(c), options: { color: PAL.ink, fontSize: 9.5, fontFace: FONT, valign: "middle" } };
}

function addTable(s: PptxGenJS.Slide, x: number, y: number, w: number, cols: string[], rows: Row[], opt: { fontSize?: number } = {}) {
  const fs = opt.fontSize ?? 9.5;
  const head: PptxGenJS.TableCell[] = cols.map((c) => ({ text: c, options: { fill: { color: PAL.marine }, color: "FFFFFF", bold: true, fontSize: fs, fontFace: FONT, valign: "middle" } }));
  const body: PptxGenJS.TableCell[][] = rows.map((r, i) => {
    const cells = r.cells.map(cellToTbl);
    if (r.total) cells.forEach((c) => (c.options = { ...c.options, fill: { color: "E7EEFB" }, bold: true, color: PAL.marine }));
    else if (i % 2 === 1) cells.forEach((c) => { if (!(c.options as any)?.fill) c.options = { ...c.options, fill: { color: PAL.soft } }; });
    return cells;
  });
  // largeurs : 1re colonne un peu plus large
  const weights = cols.map((_, i) => (i === 0 ? 1.5 : 1));
  const sum = weights.reduce((a, b) => a + b, 0);
  const colW = weights.map((wt) => (wt / sum) * w);
  s.addTable([head, ...body], {
    x, y, w, colW,
    border: { type: "solid", color: PAL.line, pt: 0.5 },
    align: "left", valign: "middle", fontSize: fs, fontFace: FONT, autoPage: false, rowH: 0.0,
  });
}

/* ---------------------------------- Charts -------------------------------- */
const CLEAN = {
  showValue: true,
  dataLabelColor: "363636",
  dataLabelFontFace: FONT,
  dataLabelFontBold: true,
  valAxisHidden: true,
  valGridLine: { style: "none" as const },
  catGridLine: { style: "none" as const },
  valAxisLineShow: false,
  catAxisLineShow: true,
  catAxisLineColor: "CDD7E6",
  catAxisLabelColor: PAL.ink,
  catAxisLabelFontFace: FONT,
  chartArea: { fill: { color: "FFFFFF" } },
  plotArea: { fill: { color: "FFFFFF" } },
};

function barChart(s: PptxGenJS.Slide, x: number, y: number, w: number, h: number, bars: Bar[], opt: ChartOpt = {}) {
  if (!bars.length) return;
  const fn = resolveColorFn(opt.colorFn);
  const colors = bars.map((b) => (b.c ? b.c : fn(b.v)));
  s.addChart(
    "bar" as PptxGenJS.CHART_NAME,
    [{ name: "Valeur", labels: bars.map((b) => b.l), values: bars.map((b) => b.v) }],
    {
      x, y, w, h, barDir: "col",
      chartColors: colors,
      ...CLEAN,
      dataLabelFontSize: 11,
      dataLabelPosition: "outEnd",
      valAxisMaxVal: opt.max ?? 100,
      valAxisMinVal: 0,
      catAxisLabelFontSize: 9.5,
      showLegend: false,
      barGapWidthPct: 45,
    } as PptxGenJS.IChartOpts
  );
}

function groupedBar(s: PptxGenJS.Slide, x: number, y: number, w: number, h: number, g: Grouped, opt: ChartOpt = {}) {
  s.addChart(
    "bar" as PptxGenJS.CHART_NAME,
    g.series.map((se) => ({ name: se.name, labels: g.cats, values: se.values })),
    {
      x, y, w, h, barDir: "col",
      chartColors: g.series.map((se) => se.color),
      ...CLEAN,
      dataLabelFontSize: 8,
      dataLabelPosition: "outEnd",
      valAxisMaxVal: opt.max,
      valAxisMinVal: 0,
      catAxisLabelFontSize: 9.5,
      showLegend: true,
      legendPos: "b",
      legendFontSize: 10,
      legendFontFace: FONT,
      barGapWidthPct: 35,
      barGrouping: "clustered",
    } as PptxGenJS.IChartOpts
  );
}

/** Barres horizontales « propres » (rendu manuel par formes). */
function hBars(s: PptxGenJS.Slide, x: number, y: number, w: number, data: Bar[], opt: { colorFn?: ColorToken; max?: number } = {}) {
  const fn = resolveColorFn(opt.colorFn);
  const max = opt.max ?? 100;
  const rowH = 0.3;
  const gap = 0.1;
  const labelW = w * 0.4;
  const trackX = x + labelW + 0.12;
  const trackW = w * 0.4;
  const valX = trackX + trackW + 0.12;
  data.forEach((d, i) => {
    const yy = y + i * (rowH + gap);
    const col = d.c || fn(d.v);
    s.addText(d.l, { x, y: yy, w: labelW, h: rowH, fontSize: 10, color: PAL.ink, fontFace: FONT, align: "right", valign: "middle" });
    s.addShape("roundRect", { x: trackX, y: yy + rowH / 2 - 0.08, w: trackW, h: 0.16, rectRadius: 0.08, fill: { color: "EEF2F7" } });
    const fw = Math.max(0.06, Math.min(1, d.v / max) * trackW);
    s.addShape("roundRect", { x: trackX, y: yy + rowH / 2 - 0.08, w: fw, h: 0.16, rectRadius: 0.08, fill: { color: col } });
    s.addText(`${d.v}%`, { x: valX, y: yy, w: w - (valX - x), h: rowH, fontSize: 10.5, bold: true, color: col, fontFace: FONT, valign: "middle" });
  });
}

/* ------------------------------ Panneau latéral --------------------------- */
function sideBlocks(s: PptxGenJS.Slide, x: number, y: number, w: number, blocks: SideBlock[]) {
  let cy = y;
  for (const b of blocks) {
    if (b.kind === "table") {
      addTable(s, x, cy, w, b.table.cols, b.table.rows, { fontSize: 9 });
      cy += 0.34 + (b.table.rows.length + 1) * 0.3 + 0.18;
    } else if (b.kind === "kpis") {
      kpiRow(s, x, cy, w, b.items, 0.9);
      cy += 1.06;
    } else {
      s.addShape("roundRect", { x, y: cy, w, h: 0.74, rectRadius: 0.06, fill: { color: PAL.soft }, line: { color: PAL.line, width: 1 } });
      s.addText(b.h, { x: x + 0.14, y: cy + 0.08, w: w - 0.28, h: 0.26, fontSize: 10.5, bold: true, color: PAL.marine, fontFace: FONT });
      s.addText(b.p, { x: x + 0.14, y: cy + 0.34, w: w - 0.28, h: 0.36, fontSize: 9.5, color: PAL.muted, fontFace: FONT, valign: "top" });
      cy += 0.86;
    }
  }
}

/* ================================ TEMPLATES =============================== */
function tCover(ctx: Ctx, slide: Slide) {
  const s = ctx.pptx.addSlide();
  s.background = { color: PAL.marine };
  s.addShape("rect", { x: 0, y: H - 0.12, w: W, h: 0.12, fill: { color: PAL.cyan } });
  if (ctx.oms) s.addImage({ data: ctx.oms, x: 0.9, y: 0.62, w: 1.2, h: 0.66, sizing: { type: "contain", w: 1.2, h: 0.66 } });
  s.addShape("line", { x: 2.3, y: 0.62, w: 0, h: 0.66, line: { color: "FFFFFF", width: 1, transparency: 65 } });
  if (ctx.pev) s.addImage({ data: ctx.pev, x: 2.5, y: 0.6, w: 0.72, h: 0.7, sizing: { type: "contain", w: 0.72, h: 0.7 } });
  s.addText(slide.kicker ?? "", { x: 0.92, y: 2.0, w: 11, h: 0.36, fontSize: 13, bold: true, color: PAL.cyan, fontFace: MONO, charSpacing: 2 });
  s.addText(slide.title, { x: 0.9, y: 2.4, w: 11.3, h: 1.5, fontSize: 33, bold: true, color: PAL.white, fontFace: FONT, valign: "top" });
  (slide.meta ?? []).forEach((m, i) =>
    s.addText(m, { x: 0.92, y: 3.95 + i * 0.34, w: 11, h: 0.32, fontSize: 13.5, color: "BCD4F0", fontFace: FONT })
  );
  // kpi « glass »
  const kpis = slide.kpis ?? [];
  const n = kpis.length || 1;
  const gap = 0.22;
  const cw = Math.min(2.7, (11 - gap * (n - 1)) / n);
  kpis.forEach((k, i) => {
    const x = 0.92 + i * (cw + gap);
    s.addShape("roundRect", { x, y: 4.95, w: cw, h: 1.15, rectRadius: 0.08, fill: { color: "0B2A66" }, line: { color: "2C5099", width: 1 } });
    s.addText(k.v, { x: x + 0.14, y: 5.1, w: cw - 0.28, h: 0.55, fontSize: 26, bold: true, color: PAL.white, fontFace: FONT, valign: "middle" });
    s.addText(k.l, { x: x + 0.14, y: 5.66, w: cw - 0.28, h: 0.38, fontSize: 10, color: "A9C6EC", fontFace: FONT, valign: "top" });
  });
  s.addText(`${slide.src ?? ""}  ·  Généré le ${dateFr()}`, { x: 0.92, y: 6.85, w: 11.5, h: 0.3, fontSize: 10, color: "88A6CF", fontFace: MONO });
}

function tExec(ctx: Ctx, slide: Slide, no: string) {
  const s = header(ctx, slide, no);
  let y = 1.25;
  const kpis = slide.kpis ?? [];
  if (kpis.length) {
    const perRow = kpis.length <= 4 ? kpis.length : kpis.length <= 6 ? kpis.length : 4;
    const rows = Math.ceil(kpis.length / perRow);
    const cardH = rows > 1 ? 0.82 : 1.0;
    for (let r = 0; r < rows; r++) {
      kpiRow(s, MX, y + r * (cardH + 0.14), BW, kpis.slice(r * perRow, r * perRow + perRow), cardH);
    }
    y += rows * (cardH + 0.14) + 0.04;
  }
  if (slide.message) {
    s.addShape("roundRect", { x: MX, y, w: BW, h: 0.74, rectRadius: 0.07, fill: { color: slide.noteKind === "alert" ? "FDEEEE" : slide.noteKind === "warn" ? "FFF5EC" : "EEF5FC" }, line: { color: "CFE1F4", width: 1 } });
    s.addText(slide.message, { x: MX + 0.18, y: y + 0.06, w: BW - 0.36, h: 0.62, fontSize: 10, color: "243A5C", fontFace: FONT, valign: "middle" });
    y += 0.9;
  }
  const cols = slide.cols ?? [];
  if (cols.length) {
    const gap = 0.2;
    const cw = (BW - gap * (cols.length - 1)) / cols.length;
    const colH = Math.min(2.9, 6.85 - y);
    cols.forEach((c, i) => {
      const x = MX + i * (cw + gap);
      s.addShape("roundRect", { x, y, w: cw, h: colH, rectRadius: 0.06, fill: { color: PAL.soft }, line: { color: PAL.line, width: 1 } });
      blockH(s, x + 0.16, y + 0.14, cw - 0.32, c.h);
      s.addText(
        c.items.map((it) => ({ text: it, options: { bullet: { code: "2713" } as any, color: PAL.ink, fontSize: 10.5, paraSpaceAfter: 7 } })),
        { x: x + 0.2, y: y + 0.56, w: cw - 0.4, h: colH - 0.7, fontFace: FONT, valign: "top" }
      );
    });
  }
}

function tBarSide(ctx: Ctx, slide: Slide, no: string) {
  const s = header(ctx, slide, no);
  const hasNote = !!slide.note;
  const bottom = hasNote ? NOTE_Y - 0.12 : 6.85;
  const leftW = 6.85;
  const rightX = MX + leftW + 0.3;
  const rightW = BW - leftW - 0.3;
  blockH(s, MX, 1.2, leftW, slide.chartTitle ?? "");
  if (slide.grouped) groupedBar(s, MX, 1.6, leftW, bottom - 1.6, slide.grouped, slide.chartOpt ?? {});
  else barChart(s, MX, 1.6, leftW, bottom - 1.6, slide.bars ?? [], slide.chartOpt ?? {});
  if (slide.side) sideBlocks(s, rightX, 1.3, rightW, slide.side);
  if (hasNote) note(s, slide.note!, slide.noteKind);
}

function tBigBar(ctx: Ctx, slide: Slide, no: string) {
  const s = header(ctx, slide, no);
  const hasNote = !!slide.note;
  const bottom = hasNote ? NOTE_Y - 0.12 : 6.85;
  blockH(s, MX, 1.2, BW, slide.chartTitle ?? "");
  if (slide.grouped) groupedBar(s, MX, 1.62, BW, bottom - 1.62, slide.grouped, slide.chartOpt ?? {});
  else barChart(s, MX, 1.62, BW, bottom - 1.62, slide.bars ?? [], slide.chartOpt ?? {});
  if (hasNote) note(s, slide.note!, slide.noteKind);
}

function tTableBar(ctx: Ctx, slide: Slide, no: string) {
  const s = header(ctx, slide, no);
  const hasNote = !!slide.note;
  const bottom = hasNote ? NOTE_Y - 0.12 : 6.85;
  const leftW = BW * 0.5;
  const rightX = MX + leftW + 0.3;
  const rightW = BW - leftW - 0.3;
  blockH(s, MX, 1.2, leftW, slide.tableTitle ?? "Détail");
  if (slide.tableCols && slide.tableRows) addTable(s, MX, 1.6, leftW, slide.tableCols, slide.tableRows, { fontSize: 9 });
  blockH(s, rightX, 1.2, rightW, slide.chartTitle ?? "");
  if (slide.grouped) groupedBar(s, rightX, 1.6, rightW, bottom - 1.6, slide.grouped, slide.chartOpt ?? {});
  else barChart(s, rightX, 1.6, rightW, bottom - 1.6, slide.bars ?? [], slide.chartOpt ?? {});
  if (hasNote) note(s, slide.note!, slide.noteKind);
}

function tTable(ctx: Ctx, slide: Slide, no: string) {
  const s = header(ctx, slide, no);
  let y = 1.25;
  if (slide.chartTitle) {
    blockH(s, MX, y, BW, slide.chartTitle);
    y += 0.4;
  }
  if (slide.cols2 && slide.rows) {
    addTable(s, MX, y, BW, slide.cols2, slide.rows, { fontSize: 9.5 });
    y += 0.34 + (slide.rows.length + 1) * 0.32 + 0.2;
  }
  if (slide.extra) {
    const tables = slide.extra.tables ?? [];
    const hasLegend = !!slide.extra.legend;
    const cols = tables.length + (hasLegend ? 1 : 0);
    const gap = 0.24;
    const cw = (BW - gap * (cols - 1)) / cols;
    let cx = MX;
    tables.forEach((t) => {
      addTable(s, cx, y, cw, t.cols, t.rows, { fontSize: 9 });
      cx += cw + gap;
    });
    if (hasLegend && slide.extra.legend) {
      s.addShape("roundRect", { x: cx, y, w: cw, h: 1.5, rectRadius: 0.06, fill: { color: PAL.soft }, line: { color: PAL.line, width: 1 } });
      blockH(s, cx + 0.16, y + 0.14, cw - 0.32, slide.extra.legend.h);
      s.addText(slide.extra.legend.p, { x: cx + 0.18, y: y + 0.56, w: cw - 0.36, h: 0.9, fontSize: 10, color: PAL.muted, fontFace: FONT, valign: "top" });
    }
  }
  if (slide.note) note(s, slide.note, slide.noteKind);
}

function tHbarList(ctx: Ctx, slide: Slide, no: string) {
  const s = header(ctx, slide, no);
  const lists = slide.lists ?? [];
  const gap = 0.5;
  const cw = (BW - gap * (lists.length - 1)) / lists.length;
  lists.forEach((l, i) => {
    const x = MX + i * (cw + gap);
    blockH(s, x, 1.3, cw, l.h);
    hBars(s, x, 1.75, cw, l.data, l.opt ?? {});
  });
  if (slide.note) note(s, slide.note, slide.noteKind);
}

function tFunnel(ctx: Ctx, slide: Slide, no: string) {
  const s = header(ctx, slide, no);
  blockH(s, MX, 1.25, BW, slide.chartTitle ?? "Parcours de récupération");
  const steps = slide.fSteps ?? [];
  const arrowW = 0.4;
  const totalArrows = (steps.length - 1) * arrowW;
  const cw = (BW - totalArrows) / steps.length;
  const y = 1.7;
  const cardH = 1.2;
  steps.forEach((st, i) => {
    const x = MX + i * (cw + arrowW);
    s.addShape("roundRect", { x, y, w: cw, h: cardH, rectRadius: 0.08, fill: { color: PAL.soft }, line: { color: PAL.line, width: 1 } });
    s.addText(st.v, { x, y: y + 0.18, w: cw, h: 0.5, fontSize: 26, bold: true, color: st.c || PAL.cyan, fontFace: FONT, align: "center", valign: "middle" });
    s.addText(st.l, { x: x + 0.06, y: y + 0.72, w: cw - 0.12, h: 0.42, fontSize: 10, bold: true, color: PAL.ink, fontFace: FONT, align: "center", valign: "top" });
    if (i < steps.length - 1) s.addText("→", { x: x + cw, y, w: arrowW, h: cardH, fontSize: 20, bold: true, color: PAL.cyan, fontFace: FONT, align: "center", valign: "middle" });
  });
  if (slide.fTable) {
    const ty = y + cardH + 0.3;
    addTable(s, MX, ty, BW, slide.fTable.cols, slide.fTable.rows, { fontSize: 9.5 });
  }
  if (slide.note) note(s, slide.note, slide.noteKind);
}

function tMatrix(ctx: Ctx, slide: Slide, no: string) {
  const s = header(ctx, slide, no);
  const cells = slide.cells ?? [];
  const bottom = slide.note ? NOTE_Y - 0.15 : 6.8;
  const top = 1.3;
  const gap = 0.22;
  const cw = (BW - gap) / 2;
  const ch = (bottom - top - gap) / 2;
  cells.forEach((c, i) => {
    const col = i % 2;
    const rowi = Math.floor(i / 2);
    const x = MX + col * (cw + gap);
    const y = top + rowi * (ch + gap);
    s.addShape("roundRect", { x, y, w: cw, h: ch, rectRadius: 0.1, fill: { color: c.color } });
    s.addText(c.h, { x: x + 0.22, y: y + 0.16, w: cw - 0.44, h: 0.5, fontSize: 14, bold: true, color: PAL.white, fontFace: FONT, valign: "top" });
    s.addText(c.p, { x: x + 0.22, y: y + 0.66, w: cw - 0.44, h: ch - 1.0, fontSize: 11, color: "FFFFFF", fontFace: FONT, valign: "top" });
    s.addText(`→ ${c.act}`, { x: x + 0.22, y: y + ch - 0.42, w: cw - 0.44, h: 0.34, fontSize: 11.5, bold: true, color: PAL.white, fontFace: FONT, valign: "middle" });
  });
  if (slide.note) note(s, slide.note, slide.noteKind);
}

function tProcess(ctx: Ctx, slide: Slide, no: string) {
  const s = header(ctx, slide, no);
  const steps = slide.pSteps ?? [];
  const arrowW = 0.32;
  const cw = (BW - (steps.length - 1) * arrowW) / steps.length;
  const y = 1.3;
  const ch = 1.5;
  steps.forEach((st, i) => {
    const x = MX + i * (cw + arrowW);
    s.addShape("roundRect", { x, y, w: cw, h: ch, rectRadius: 0.08, fill: { color: PAL.soft }, line: { color: PAL.line, width: 1 } });
    s.addShape("ellipse", { x: x + 0.16, y: y + 0.16, w: 0.34, h: 0.34, fill: { color: PAL.marine } });
    s.addText(String(i + 1), { x: x + 0.16, y: y + 0.16, w: 0.34, h: 0.34, fontSize: 12, bold: true, color: PAL.white, fontFace: FONT, align: "center", valign: "middle" });
    s.addText(st.h, { x: x + 0.16, y: y + 0.58, w: cw - 0.32, h: 0.34, fontSize: 11.5, bold: true, color: PAL.marine, fontFace: FONT, valign: "top" });
    s.addText(st.p, { x: x + 0.16, y: y + 0.9, w: cw - 0.32, h: ch - 1.0, fontSize: 9.5, color: PAL.muted, fontFace: FONT, valign: "top" });
    if (i < steps.length - 1) s.addText("→", { x: x + cw, y, w: arrowW, h: ch, fontSize: 16, color: PAL.cyan, fontFace: FONT, align: "center", valign: "middle" });
  });
  const sources = slide.sources ?? [];
  if (sources.length) {
    const sy = y + ch + 0.3;
    const gap = 0.24;
    const sw = (BW - gap * (sources.length - 1)) / sources.length;
    sources.forEach((sc, i) => {
      const x = MX + i * (sw + gap);
      s.addShape("roundRect", { x, y: sy, w: sw, h: 1.7, rectRadius: 0.06, fill: { color: PAL.soft }, line: { color: PAL.line, width: 1 } });
      blockH(s, x + 0.16, sy + 0.14, sw - 0.32, sc.h);
      s.addText(sc.p, { x: x + 0.18, y: sy + 0.56, w: sw - 0.36, h: 1.05, fontSize: 10, color: PAL.muted, fontFace: FONT, valign: "top" });
    });
  }
  if (slide.note) note(s, slide.note, slide.noteKind);
}

function tConclusion(ctx: Ctx, slide: Slide, no: string) {
  const s = header(ctx, slide, no);
  let y = 1.3;
  const points = slide.points ?? [];
  s.addText(
    points.map((p) => ({ text: p, options: { bullet: { code: "2713" } as any, color: PAL.ink, fontSize: 11.5, paraSpaceAfter: 10 } })),
    { x: MX + 0.1, y, w: BW - 0.2, h: 2.4, fontFace: FONT, valign: "top" }
  );
  y += 2.5;
  if (slide.outputs) {
    blockH(s, MX, y, BW, slide.outputs.h);
    addTable(s, MX, y + 0.4, BW, slide.outputs.cols, slide.outputs.rows, { fontSize: 9.5 });
  }
  if (slide.note) note(s, slide.note, slide.noteKind);
}

/* -------------------------------- Dispatch -------------------------------- */
function renderSlide(ctx: Ctx, slide: Slide, no: string) {
  switch (slide.type) {
    case "cover": return tCover(ctx, slide);
    case "exec": return tExec(ctx, slide, no);
    case "barSide": return tBarSide(ctx, slide, no);
    case "bigBar": return tBigBar(ctx, slide, no);
    case "tableBar": return tTableBar(ctx, slide, no);
    case "table": return tTable(ctx, slide, no);
    case "hbarList": return tHbarList(ctx, slide, no);
    case "funnel": return tFunnel(ctx, slide, no);
    case "matrix": return tMatrix(ctx, slide, no);
    case "process": return tProcess(ctx, slide, no);
    case "conclusion": return tConclusion(ctx, slide, no);
    default: return tBigBar(ctx, slide, no);
  }
}

async function buildDeck(deck: Deck): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: W, height: H });
  pptx.layout = "WIDE";
  pptx.theme = { headFontFace: FONT, bodyFontFace: FONT };
  const ctx: Ctx = { pptx, deck, oms: logoDataUri("oms-white.png"), pev: logoDataUri("pev.png") };
  let n = 0;
  for (const slide of deck.slides) {
    let no = "";
    if (slide.type !== "cover") {
      n += 1;
      no = String(n).padStart(2, "0");
    }
    renderSlide(ctx, slide, no);
  }
  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}

/* ------------------------------- API publique ----------------------------- */
export async function buildZsReport(): Promise<Buffer> {
  return buildDeck(ZS_DECK);
}
export async function buildCsReport(): Promise<Buffer> {
  return buildDeck(CS_DECK);
}

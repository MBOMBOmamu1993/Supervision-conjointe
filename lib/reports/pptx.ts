/**
 * Génération des rapports PowerPoint automatisés (côté serveur).
 *
 * Design « modèle polio Angola » (UNIQUEMENT la couleur, comme demandé) :
 *   - bandeau de titre marine #001B4D, texte blanc, titre en capitales + sous-titre,
 *     numéro de diapo en pastille ;
 *   - LOGO OMS BLANC à l'extrême gauche de CHAQUE diapositive ;
 *   - corps sur fond gris-bleu clair #DEE5EE ; format 16:9.
 *
 * 3 rapports, alimentés dynamiquement :
 *   1. Supervision conjointe PEV-Central / OMS (SupervisionBundle).
 *   2. Contrôle qualité des données — Zones de santé (données CQ réelles).
 *   3. Contrôle qualité des données — Centres de santé (données CQ réelles).
 */
import PptxGenJS from "pptxgenjs";
import { readFileSync } from "fs";
import { join } from "path";
import type { SupervisionBundle, ComposanteScore, TopNonItem } from "@/lib/supervision/types";
import { CQ } from "@/data/cq-data";

// Palette Angola
const NAVY = "001B4D";
const NAVY2 = "002A72";
const BODY = "DEE5EE";
const RED = "E23636";
const GREEN = "22B457";
const BLUE = "2563EB";
const WINE = "7B2D3A";
const GOLD = "F1C40F";
const WHITE = "FFFFFF";
const GREY = "475569";
const FOOT = "Rapport automatisé PEV & OMS — Province de la Tshuapa";

function logoDataUri(file: string): string {
  for (const f of [file, "oms.png"]) {
    try {
      const buf = readFileSync(join(process.cwd(), "public", "logo", f));
      return `data:image/png;base64,${buf.toString("base64")}`;
    } catch { /* essaie le suivant */ }
  }
  return "";
}

const pctStr = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? "—" : `${Math.round(n * 10) / 10} %`);
const numStr = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? "—" : new Intl.NumberFormat("fr-FR").format(Math.round(n)));
const scoreColor = (v: number | null | undefined) => (v === null || v === undefined ? GREY : v >= 80 ? GREEN : v >= 60 ? BLUE : v >= 40 ? GOLD : RED);

interface Deck { pptx: PptxGenJS; oms: string; }

function newDeck(): Deck {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
  pptx.layout = "WIDE";
  pptx.theme = { headFontFace: "Calibri", bodyFontFace: "Calibri" };
  return { pptx, oms: logoDataUri("oms-white.png") };
}

/** Diapositive standard : fond clair Angola, bandeau marine, logo OMS à gauche. */
function slide(deck: Deck, title: string, subtitle?: string, no?: string): PptxGenJS.Slide {
  const s = deck.pptx.addSlide();
  s.background = { color: BODY };
  s.addShape("rect", { x: 0, y: 0, w: 13.333, h: 1.0, fill: { color: NAVY } });
  s.addShape("rect", { x: 0, y: 0, w: 4.0, h: 1.0, fill: { color: NAVY2 } });
  if (deck.oms) s.addImage({ data: deck.oms, x: 0.25, y: 0.18, w: 1.15, h: 0.64, sizing: { type: "contain", w: 1.15, h: 0.64 } });
  s.addText(title.toUpperCase(), { x: 1.6, y: 0.12, w: 10.3, h: 0.5, fontSize: 18, bold: true, color: WHITE, valign: "middle" });
  if (subtitle) s.addText(subtitle, { x: 1.6, y: 0.6, w: 10.3, h: 0.32, fontSize: 11, italic: true, color: "BCD0EF" });
  if (no) s.addText(no, { x: 12.55, y: 0.32, w: 0.55, h: 0.35, fontSize: 11, bold: true, color: WHITE, align: "center", fill: { color: NAVY2 } });
  s.addText(FOOT, { x: 0.4, y: 7.18, w: 10, h: 0.25, fontSize: 8, color: GREY });
  return s;
}

function kpiCard(s: PptxGenJS.Slide, x: number, y: number, w: number, h: number, value: string, label: string, accent = BLUE) {
  s.addShape("roundRect", { x, y, w, h, rectRadius: 0.06, fill: { color: WHITE }, line: { color: accent, width: 1 } });
  s.addShape("rect", { x, y, w: 0.09, h, fill: { color: accent } });
  s.addText(value, { x: x + 0.12, y: y + 0.1, w: w - 0.24, h: h * 0.5, fontSize: h > 1.2 ? 22 : 17, bold: true, color: accent, align: "center", valign: "middle" });
  s.addText(label, { x: x + 0.12, y: y + h * 0.55, w: w - 0.24, h: h * 0.42, fontSize: 9.5, color: GREY, align: "center", valign: "top" });
}

function kpiStrip(s: PptxGenJS.Slide, y: number, cards: { value: string; label: string; accent?: string }[], h = 1.3, x0 = 0.4, totalW = 12.5) {
  const n = cards.length || 1, gap = 0.2;
  const cw = (totalW - gap * (n - 1)) / n;
  cards.forEach((c, i) => kpiCard(s, x0 + i * (cw + gap), y, cw, h, c.value, c.label, c.accent ?? BLUE));
}

function barChart(s: PptxGenJS.Slide, x: number, y: number, w: number, h: number, labels: string[], values: (number | null)[], opts: { title?: string; max?: number; color?: string } = {}) {
  if (!labels.length) {
    s.addText("Aucune donnée disponible pour la période.", { x, y: y + h / 2 - 0.2, w, h: 0.4, fontSize: 12, italic: true, color: GREY, align: "center" });
    return;
  }
  s.addChart("bar" as PptxGenJS.CHART_NAME, [{ name: opts.title ?? "Valeur", labels, values: values.map((v) => v ?? 0) }], {
    x, y, w, h, barDir: "col", chartColors: [opts.color ?? BLUE], showValue: true, dataLabelFontSize: 8, dataLabelColor: "333333",
    valAxisMaxVal: opts.max ?? 100, valAxisMinVal: 0, catAxisLabelFontSize: 9, valAxisLabelFontSize: 8, showLegend: false,
  });
}

function groupedBar(s: PptxGenJS.Slide, x: number, y: number, w: number, h: number, labels: string[], series: { name: string; values: number[] }[], colors: string[]) {
  s.addChart("bar" as PptxGenJS.CHART_NAME, series.map((se) => ({ name: se.name, labels, values: se.values })), {
    x, y, w, h, barDir: "col", chartColors: colors, showLegend: true, legendPos: "b", legendFontSize: 9, catAxisLabelFontSize: 9, valAxisLabelFontSize: 8,
  });
}

function noteBox(s: PptxGenJS.Slide, y: number, text: string, h = 0.9) {
  s.addText(text, { x: 0.4, y, w: 12.5, h, fontSize: 10.5, italic: true, color: "333333", fill: { color: "F2F6FC" }, align: "left", valign: "middle" });
}

function bullets(s: PptxGenJS.Slide, y: number, h: number, heading: string, items: string[], color = BLUE) {
  s.addShape("roundRect", { x: 0.4, y, w: 12.5, h, rectRadius: 0.06, fill: { color: WHITE }, line: { color, width: 1 } });
  s.addText(heading, { x: 0.6, y: y + 0.12, w: 12.1, h: 0.4, fontSize: 13, bold: true, color });
  s.addText(items.map((t) => ({ text: t, options: { bullet: true, fontSize: 12, color: "333333", paraSpaceAfter: 6 } })),
    { x: 0.6, y: y + 0.6, w: 12.1, h: h - 0.75, valign: "top" });
}

function periodLabel(months: string[]): string {
  if (!months.length) return "Janvier – Mars 2026";
  const M = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
  const f = (m: string) => { const x = m.match(/(\d{4})-(\d{2})/); return x ? `${M[parseInt(x[2], 10) - 1]} ${x[1]}` : m; };
  return months.length === 1 ? f(months[0]) : `${f(months[0])} → ${f(months[months.length - 1])}`;
}

/** Page de garde Angola : logo OMS à gauche, embème central, KPIs. */
function cover(deck: Deck, emblem: string, title: string, meta: string, kpis: { value: string; label: string; accent?: string }[]) {
  const s = deck.pptx.addSlide();
  s.background = { color: NAVY };
  if (deck.oms) s.addImage({ data: deck.oms, x: 0.3, y: 0.3, w: 1.7, h: 0.95, sizing: { type: "contain", w: 1.7, h: 0.95 } });
  s.addText("PROGRAMME ÉLARGI DE VACCINATION · OMS — RÉPUBLIQUE DÉMOCRATIQUE DU CONGO", { x: 1, y: 1.7, w: 11.333, h: 0.4, fontSize: 12, color: "BCD0EF", align: "center", charSpacing: 1 });
  s.addText(emblem, { x: 4.67, y: 2.25, w: 4, h: 0.5, fontSize: 14, bold: true, color: WHITE, align: "center", fill: { color: NAVY2 } });
  s.addText(title, { x: 0.8, y: 2.95, w: 11.733, h: 1.2, fontSize: 27, bold: true, color: WHITE, align: "center", valign: "middle" });
  s.addText(meta, { x: 1, y: 4.2, w: 11.333, h: 0.5, fontSize: 13, italic: true, color: "BCD0EF", align: "center" });
  kpiStrip(s, 5.0, kpis, 1.35, 0.9, 11.533);
  s.addText(`Source : ODK / Kobo / Excel  ·  Généré le ${new Date().toLocaleDateString("fr-FR")}`, { x: 1, y: 6.7, w: 11.333, h: 0.3, fontSize: 9, color: "BCD0EF", align: "center" });
}

/** Choix du niveau (et des composantes) ayant le plus d'enregistrements. */
function pickLevel(sup: SupervisionBundle) {
  const levels = [sup.levels.as, sup.levels.zs, sup.levels.antenne];
  return levels.reduce((a, b) => (b.records > a.records ? b : a), levels[0]);
}

/* ============================ RAPPORT 1 : Supervision conjointe ============================ */
export async function buildSupReport(sup: SupervisionBundle): Promise<Buffer> {
  const deck = newDeck();
  const period = periodLabel(sup.meta.months);
  const k = sup.kpi;
  const lvl = pickLevel(sup);
  const comps: ComposanteScore[] = lvl.composantes.length ? lvl.composantes : sup.levels.zs.composantes;
  const topNon: TopNonItem[] = (lvl.topNon.length ? lvl.topNon : sup.levels.zs.topNon).slice(0, 5);

  // 1. Couverture
  cover(deck, "PEV · OMS — RDC", "Rapport de supervision conjointe PEV-Central / OMS",
    `Province : Tshuapa  ·  Période : ${period}`,
    [
      { value: numStr(k.total_supervisions), label: "Total supervisions réalisées", accent: BLUE },
      { value: numStr(k.structures_conjointe), label: "Structures (conjointe)", accent: GREEN },
      { value: numStr(k.antennes_sup.count), label: "Antennes supervisées", accent: GOLD },
      { value: pctStr(sup.levels.as.score.moyen ?? sup.levels.zs.score.moyen), label: "Score global moyen", accent: WINE },
    ]);

  // 2. Nombre des supervisions réalisées (par type)
  {
    const s = slide(deck, "Nombre des supervisions réalisées", "Par type de supervision", "02");
    kpiStrip(s, 1.3, [
      { value: numStr(k.total_supervisions), label: "Total réalisées", accent: NAVY2 },
      { value: numStr(k.conjointe_pev_oms.count), label: "Conjointe PEV-Central / OMS", accent: BLUE },
      { value: numStr(k.conjointe_mca.count), label: "Conjointe équipe", accent: GREEN },
      { value: numStr(k.structures_conjointe), label: "Structures supervisées", accent: RED },
    ], 1.35);
    groupedBar(s, 0.4, 3.0, 12.5, 3.2, ["ZS conjointe", "ZS MCA", "CS conjointe", "CS ECZ", "Auto-éval."],
      [{ name: "Supervisions", values: [k.zs_conjointe.count, k.zs_mca.count, k.cs_conjointe.count, k.cs_ecz.count, k.auto_eval.count] }], [BLUE]);
  }

  // 3. Score global de toutes les composantes
  {
    const s = slide(deck, "Score global de toutes les composantes", "Antenne · Zone de santé · Aire de santé", "03");
    kpiStrip(s, 1.6, [
      { value: pctStr(sup.levels.antenne.score.moyen), label: "Score global Antennes", accent: scoreColor(sup.levels.antenne.score.moyen) },
      { value: pctStr(sup.levels.zs.score.moyen), label: "Score global Zones de santé", accent: scoreColor(sup.levels.zs.score.moyen) },
      { value: pctStr(sup.levels.as.score.moyen), label: "Score global Aires de santé", accent: scoreColor(sup.levels.as.score.moyen) },
    ], 1.5);
    barChart(s, 0.4, 3.5, 12.5, 3.0, ["Antennes", "Zones de santé", "Aires de santé"],
      [sup.levels.antenne.score.moyen, sup.levels.zs.score.moyen, sup.levels.as.score.moyen], { title: "Score global", color: BLUE });
  }

  // 4. Performance par composante
  {
    const s = slide(deck, "Performance par composante", "Score moyen des 6 composantes de la checklist", "04");
    barChart(s, 0.4, 1.3, 12.5, 4.0, comps.map((c) => c.short), comps.map((c) => c.score), { title: "Score moyen", color: BLUE });
    const ranked = [...comps].filter((c) => c.score !== null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    if (ranked.length) noteBox(s, 5.6, `Composante la plus performante : ${ranked[0].short} (${pctStr(ranked[0].score)}) · la plus faible : ${ranked[ranked.length - 1].short} (${pctStr(ranked[ranked.length - 1].score)}).`, 1.0);
  }

  // 5. Top 5 des questions à réponses « Non »
  {
    const s = slide(deck, "Top 5 des questions à réponses « Non »", "Points d'amélioration prioritaires", "05");
    if (topNon.length) {
      barChart(s, 0.4, 1.3, 12.5, 4.2, topNon.map((t, i) => `${i + 1}`), topNon.map((t) => t.pct), { title: "% de « Non »", color: RED, max: 100 });
      s.addText(topNon.map((t, i) => ({ text: `${i + 1}. ${t.question} — ${t.pct}%`, options: { bullet: false, fontSize: 9, color: "333333", paraSpaceAfter: 2 } })), { x: 0.4, y: 5.7, w: 12.5, h: 1.3, valign: "top" });
    } else {
      noteBox(s, 3.0, "Aucune question critique détectée sur la période.", 1.0);
    }
  }

  // 6. Problèmes & actions correctrices
  {
    const s = slide(deck, "Problèmes & actions correctrices", "Recommandations issues de la supervision", "06");
    bullets(s, 1.3, 5.2, "Recommandations prioritaires", [
      "Renforcer l'analyse mensuelle des données de vaccination et la documenter.",
      "Documenter les réunions de monitorage par un procès-verbal.",
      "Organiser la recherche active des enfants zéro dose et sous-vaccinés.",
      "Assurer le suivi des actions correctrices décidées jusqu'à clôture.",
      "Vérifier systématiquement la disponibilité des intrants de vaccination.",
    ], BLUE);
  }

  return (await deck.pptx.write({ outputType: "nodebuffer" })) as Buffer;
}

/* ============================ RAPPORT 2 : CQD Zones de santé ============================ */
export async function buildCqdZsReport(): Promise<Buffer> {
  const deck = newDeck();
  const row = CQ.zs.rows[0];

  cover(deck, "CQD · ZS", "Contrôle qualité des données — Zones de santé",
    `ZS ${row.zs}  ·  ${CQ.moisDisponibles.join(" – ")}`,
    [
      { value: pctStr(row.concPenta3), label: `PENTA3 — ${row.classPenta3}`, accent: RED },
      { value: pctStr(row.concRR2), label: `RR2 — ${row.classRR2}`, accent: RED },
      { value: pctStr(row.errSnisDhis2), label: "Taux d'erreur transcription", accent: WINE },
      { value: `${row.scoreSaisieDhis2} %`, label: "Score qualité de saisie DHIS2", accent: BLUE },
    ]);

  // 2. Concordance DHIS2 / SNIS
  {
    const s = slide(deck, "Concordance DHIS2 / SNIS", "PENTA3 & RR2 — appréciation 95–105 % = pas de discordance", "02");
    kpiStrip(s, 1.3, [
      { value: pctStr(row.concPenta3), label: `PENTA3 — ${row.classPenta3}`, accent: RED },
      { value: pctStr(row.concRR2), label: `RR2 — ${row.classRR2}`, accent: RED },
    ], 1.3, 0.4, 6.0);
    groupedBar(s, 6.8, 1.3, 6.1, 4.6, ["PENTA1", "PENTA3", "RR1", "RR2"], [
      { name: "SNIS", values: [row.snis.p1, row.snis.p3, row.snis.rr1, row.snis.rr2] },
      { name: "DHIS2", values: [row.dhis2.p1, row.dhis2.p3, row.dhis2.rr1, row.dhis2.rr2] },
    ], [GOLD, BLUE]);
    noteBox(s, 6.1, "Formule : taux de concordance = données DHIS2 / source de référence (SNIS) × 100.", 0.8);
  }

  // 3. Taux d'erreur de transcription SNIS → DHIS2
  {
    const s = slide(deck, "Taux d'erreur de transcription", "SNIS → DHIS2", "03");
    kpiStrip(s, 1.6, [
      { value: pctStr(row.errSnisDhis2), label: "Taux d'erreur", accent: RED },
      { value: numStr(row.nbDiscord), label: "Discordances", accent: NAVY2 },
      { value: numStr(row.nbValVerif), label: "Comparaisons", accent: BLUE },
    ], 1.5);
    noteBox(s, 3.6, "Formule : taux d'erreur = nombre de valeurs discordantes / nombre de valeurs vérifiées × 100. Les antigènes avec erreur ≥ 25 % doivent être listés pour correction.", 1.2);
  }

  // 4. Score de qualité de saisie DHIS2
  {
    const s = slide(deck, "Score de qualité de saisie DHIS2", "Par ZS et par mois — critères de complétude", "04");
    kpiStrip(s, 1.6, [
      { value: `${row.scoreSaisieDhis2} %`, label: `ZS ${row.zs} — qualité de saisie`, accent: scoreColor(row.scoreSaisieDhis2) },
      { value: "3 / 5", label: "Critères de complétude remplis", accent: BLUE },
    ], 1.5, 0.9, 11.533);
    noteBox(s, 3.6, "Critères : cellules vides, zéros incohérents, valeurs aberrantes, incohérences inter-sources, complétude des rubriques. Superviseur : " + row.superviseur + ".", 1.2);
  }

  return (await deck.pptx.write({ outputType: "nodebuffer" })) as Buffer;
}

/* ============================ RAPPORT 3 : CQD Centres de santé ============================ */
export async function buildCqdCsReport(): Promise<Buffer> {
  const deck = newDeck();
  const row = CQ.cs.rows[0];
  const pctRecup = Math.round(row.enfRecuperes / row.enfIdentifies * 100);

  cover(deck, "CQD · CS", "Contrôle qualité des données — Centres de santé",
    `AS ${row.as}  ·  ${CQ.moisDisponibles.join(" – ")}`,
    [
      { value: pctStr(row.concPenta3), label: `PENTA3 — ${row.classPenta3}`, accent: RED },
      { value: pctStr(row.concRR2), label: `RR2 — ${row.classRR2}`, accent: GREEN },
      { value: pctStr(row.errSnisDhis2), label: "Erreur transcription SNIS/DHIS2", accent: WINE },
      { value: `${pctRecup} %`, label: "Enfants récupérés", accent: BLUE },
    ]);

  // 2. Concordance Registre / DHIS2
  {
    const s = slide(deck, "Concordance Registre / DHIS2", "PENTA3 & RR2 — appréciation", "02");
    kpiStrip(s, 1.3, [
      { value: pctStr(row.concPenta3), label: `PENTA3 — ${row.classPenta3}`, accent: RED },
      { value: pctStr(row.concRR2), label: `RR2 — ${row.classRR2}`, accent: GREEN },
    ], 1.3, 0.4, 6.0);
    groupedBar(s, 6.8, 1.3, 6.1, 4.6, ["PENTA1", "PENTA3", "RR1", "RR2"], [
      { name: "Registre", values: [row.registre.p1, row.registre.p3, row.registre.rr1, row.registre.rr2] },
      { name: "Pointage", values: [row.pointage.p1, row.pointage.p3, row.pointage.rr1, row.pointage.rr2] },
      { name: "SNIS", values: [row.snis.p1, row.snis.p3, row.snis.rr1, row.snis.rr2] },
      { name: "DHIS2", values: [row.dhis2.p1, row.dhis2.p3, row.dhis2.rr1, row.dhis2.rr2] },
    ], [BLUE, "9DC3E6", GOLD, GREEN]);
  }

  // 3. Remplissage des outils de gestion
  {
    const s = slide(deck, "Remplissage des outils de gestion", "Registre · Feuilles de pointage · Canevas SNIS", "03");
    barChart(s, 0.4, 1.3, 12.5, 3.8, ["Registre", "Feuilles de pointage", "Canevas SNIS"],
      [row.registreOk === "Oui" ? 100 : 0, row.pointageOk === "Oui" ? 100 : 0, row.snisOk === "Oui" ? 100 : 0], { title: "% correctement rempli", color: GREEN });
    noteBox(s, 5.4, `Registre : ${row.registreOk} · Feuilles de pointage : ${row.pointageOk} · Canevas SNIS : ${row.snisOk}. Les outils mal remplis doivent faire l'objet d'un coaching ciblé.`, 1.1);
  }

  // 4. Enfants perdus de vue récupérés
  {
    const s = slide(deck, "Enfants perdus de vue récupérés", "Identifiés précédemment", "04");
    kpiStrip(s, 1.3, [
      { value: numStr(row.enfIdentifies), label: "Identifiés précédemment", accent: NAVY2 },
      { value: numStr(row.enfRetrouves), label: "Retrouvés par les relais", accent: BLUE },
      { value: numStr(row.enfRecuperes), label: "Effectivement récupérés", accent: GREEN },
      { value: `${pctRecup} %`, label: "% récupération", accent: BLUE },
    ], 1.35);
    barChart(s, 0.4, 3.0, 12.5, 3.2, ["Identifiés", "Retrouvés", "Récupérés"],
      [row.enfIdentifies, row.enfRetrouves, row.enfRecuperes], { title: "Funnel enfants", color: GREEN, max: Math.max(1, row.enfIdentifies) });
  }

  return (await deck.pptx.write({ outputType: "nodebuffer" })) as Buffer;
}

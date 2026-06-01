/**
 * Génération des rapports PowerPoint automatisés (côté serveur).
 *
 * Design calé sur le modèle « Rapport polio_Angola » :
 *   - format 16:9, bandeau marine, cartes KPI bleu/orange/vert.
 *   - page de garde : logo OMS à l'extrémité GAUCHE, logo PEV à l'extrémité
 *     DROITE, en haut.
 *
 * Deux rapports :
 *   1) Supervision conjointe + CQD au niveau Zone de Santé.
 *   2) Supervision + CQD au niveau Centres de Santé.
 *
 * Les contenus sont alimentés dynamiquement par les bundles du dashboard
 * (SupervisionBundle + CqdBundle), donc se mettent à jour avec les données.
 */
import PptxGenJS from "pptxgenjs";
import { readFileSync } from "fs";
import { join } from "path";
import type { SupervisionBundle } from "@/lib/supervision/types";
import type { CqdBundle, CqdLevelBundle } from "@/lib/cqd/types";
import { COMPOSANTES } from "@/config/supervision.config";

const NAVY = "1F3864";
const BLUE = "2E75B6";
const LIGHT = "DEEBF7";
const ORANGE = "ED7D31";
const GREEN = "548235";
const RED = "C00000";
const GREY = "595959";
const WHITE = "FFFFFF";

function logoDataUri(file: string): string {
  try {
    const buf = readFileSync(join(process.cwd(), "public", "logo", file));
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return "";
  }
}

const pctStr = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? "—" : `${Math.round(n * 10) / 10} %`);
const numStr = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? "—" : new Intl.NumberFormat("fr-FR").format(n));

interface Deck {
  pptx: PptxGenJS;
  oms: string;
  pev: string;
}

function newDeck(): Deck {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
  pptx.layout = "WIDE";
  pptx.theme = { headFontFace: "Calibri", bodyFontFace: "Calibri" };
  return { pptx, oms: logoDataUri("oms.png"), pev: logoDataUri("pev.png") };
}

/** Bandeau de titre commun + logos en filigrane discret. */
function header(slide: PptxGenJS.Slide, title: string, subtitle?: string) {
  slide.background = { color: WHITE };
  slide.addShape("rect", { x: 0, y: 0, w: 13.333, h: 0.9, fill: { color: NAVY } });
  slide.addText(title, { x: 0.4, y: 0.08, w: 12.5, h: 0.5, fontSize: 20, bold: true, color: WHITE });
  if (subtitle) slide.addText(subtitle, { x: 0.4, y: 0.55, w: 12.5, h: 0.3, fontSize: 11, italic: true, color: LIGHT });
  slide.addShape("rect", { x: 0, y: 0.9, w: 13.333, h: 0.06, fill: { color: ORANGE } });
  slide.addText("Rapport automatisé PEV & CQD — Province de la Tshuapa", {
    x: 0.4, y: 7.15, w: 9, h: 0.3, fontSize: 8, color: GREY,
  });
}

/** Carte KPI (valeur + libellé) façon modèle polio. */
function kpiCard(slide: PptxGenJS.Slide, x: number, y: number, w: number, value: string, label: string, accent = BLUE) {
  const h = 1.35;
  slide.addShape("roundRect", { x, y, w, h, rectRadius: 0.08, fill: { color: LIGHT }, line: { color: accent, width: 1 } });
  slide.addShape("rect", { x, y, w: 0.1, h, fill: { color: accent } });
  slide.addText(value, { x: x + 0.15, y: y + 0.12, w: w - 0.3, h: 0.6, fontSize: 26, bold: true, color: accent, align: "center" });
  slide.addText(label, { x: x + 0.15, y: y + 0.78, w: w - 0.3, h: 0.5, fontSize: 11, color: GREY, align: "center" });
}

/** Page de garde : OMS à gauche, PEV à droite, en haut. */
function coverSlide(deck: Deck, title: string, subtitle: string, kpis: { value: string; label: string; accent?: string }[]) {
  const slide = deck.pptx.addSlide();
  slide.background = { color: NAVY };
  // Logos en haut : OMS extrémité gauche, PEV extrémité droite.
  if (deck.oms) slide.addImage({ data: deck.oms, x: 0.4, y: 0.35, w: 1.5, h: 1.0, sizing: { type: "contain", w: 1.5, h: 1.0 } });
  if (deck.pev) slide.addImage({ data: deck.pev, x: 11.4, y: 0.35, w: 1.5, h: 1.0, sizing: { type: "contain", w: 1.5, h: 1.0 } });

  slide.addText("PROGRAMME ÉLARGI DE VACCINATION · OMS — RD CONGO", {
    x: 1, y: 1.9, w: 11.333, h: 0.4, fontSize: 13, color: LIGHT, align: "center", charSpacing: 2,
  });
  slide.addText(title, { x: 1, y: 2.5, w: 11.333, h: 1.2, fontSize: 30, bold: true, color: WHITE, align: "center" });
  slide.addText(subtitle, { x: 1, y: 3.7, w: 11.333, h: 0.6, fontSize: 14, italic: true, color: LIGHT, align: "center" });

  const n = kpis.length || 1;
  const gap = 0.25;
  const totalW = 11.5;
  const cw = (totalW - gap * (n - 1)) / n;
  let x = (13.333 - totalW) / 2;
  for (const k of kpis) {
    kpiCard(slide, x, 4.7, cw, k.value, k.label, k.accent ?? BLUE);
    x += cw + gap;
  }
  slide.addText(`Source : ODK / Kobo / Excel  ·  Généré le ${new Date().toLocaleDateString("fr-FR")}`, {
    x: 1, y: 6.95, w: 11.333, h: 0.3, fontSize: 9, color: LIGHT, align: "center",
  });
}

/** Tableau simple stylé. */
function table(slide: PptxGenJS.Slide, x: number, y: number, w: number, head: string[], rows: (string | number)[][], colW?: number[]) {
  const widths = colW ?? head.map(() => w / head.length);
  const body: PptxGenJS.TableRow[] = [];
  body.push(head.map((h) => ({ text: h, options: { bold: true, color: WHITE, fill: { color: NAVY }, fontSize: 10, align: "center" as const } })));
  rows.forEach((r, i) => {
    body.push(r.map((c) => ({ text: String(c), options: { fontSize: 9.5, color: "333333", fill: { color: i % 2 ? "F2F6FC" : WHITE }, align: "center" as const } })));
  });
  slide.addTable(body, { x, y, w, colW: widths, border: { type: "solid", color: "D9D9D9", pt: 0.5 }, autoPage: false });
}

/** Barres horizontales (image SVG simplifiée via shapes). */
function barList(slide: PptxGenJS.Slide, x: number, y: number, w: number, items: { name: string; value: number | null }[], accent = BLUE, max = 100) {
  const rowH = 0.42;
  items.slice(0, 10).forEach((it, i) => {
    const yy = y + i * rowH;
    slide.addText(it.name, { x, y: yy, w: w * 0.42, h: rowH, fontSize: 9, color: GREY, align: "left", valign: "middle" });
    const barX = x + w * 0.44;
    const barW = w * 0.46;
    slide.addShape("rect", { x: barX, y: yy + 0.08, w: barW, h: rowH - 0.18, fill: { color: "EFEFEF" } });
    const v = it.value ?? 0;
    const fillW = Math.max(0.02, (Math.min(v, max) / max) * barW);
    const col = v >= 80 ? GREEN : v >= 60 ? BLUE : v >= 40 ? ORANGE : RED;
    slide.addShape("rect", { x: barX, y: yy + 0.08, w: fillW, h: rowH - 0.18, fill: { color: accent === BLUE ? col : accent } });
    slide.addText(it.value === null ? "—" : `${Math.round(v)}%`, { x: barX + barW + 0.05, y: yy, w: w * 0.1, h: rowH, fontSize: 9, bold: true, color: GREY, valign: "middle" });
  });
}

function bulletSlide(deck: Deck, title: string, subtitle: string, blocks: { heading: string; items: string[]; color?: string }[]) {
  const slide = deck.pptx.addSlide();
  header(slide, title, subtitle);
  const n = blocks.length || 1;
  const gap = 0.3;
  const totalW = 12.5;
  const cw = (totalW - gap * (n - 1)) / n;
  let x = 0.4;
  for (const b of blocks) {
    slide.addShape("roundRect", { x, y: 1.2, w: cw, h: 5.6, rectRadius: 0.08, fill: { color: "F7FAFE" }, line: { color: b.color ?? BLUE, width: 1 } });
    slide.addText(b.heading, { x: x + 0.15, y: 1.35, w: cw - 0.3, h: 0.5, fontSize: 14, bold: true, color: b.color ?? NAVY });
    slide.addText(
      b.items.map((t) => ({ text: t, options: { bullet: true, fontSize: 11, color: "333333", paraSpaceAfter: 6 } })),
      { x: x + 0.15, y: 1.95, w: cw - 0.3, h: 4.7, valign: "top" }
    );
    x += cw + gap;
  }
}

/* ============================ RAPPORT 1 : Supervision + CQD ZS ============================ */

export async function buildZsReport(sup: SupervisionBundle, cqd: CqdBundle): Promise<Buffer> {
  const deck = newDeck();
  const zs = sup.levels.zs;
  const cqdZs = cqd.levels.zs;

  coverSlide(
    deck,
    "Rapport automatisé des résultats de supervision PEV et du contrôle qualité des données",
    `Province : Tshuapa  ·  Niveau Zones de Santé  ·  Période : ${periodLabel(sup.meta.months)}`,
    [
      { value: numStr(cqdZs.structuresControlees || zs.perStructure.length), label: "ZS supervisées / contrôlées", accent: BLUE },
      { value: numStr(cqdZs.records), label: "Contrôles qualité réalisés", accent: ORANGE },
      { value: pctStr(zs.score.moyen), label: "Score global supervision", accent: GREEN },
      { value: pctStr(cqdZs.concordanceP3.taux), label: "Concordance PENTA3", accent: BLUE },
    ]
  );

  execSummarySlide(deck, sup, cqd, "zs", "Zones de Santé");
  coverageSlide(deck, sup, "zs", "Zones de Santé");
  scoreByStructureSlide(deck, zs.perStructure, "Score global de performance par Zone de Santé");
  composanteSlide(deck, zs.composantes, "Performance par composante de supervision");
  cqdConcordanceSlide(deck, cqdZs, "Zones de Santé");
  cqdTranscriptionSlide(deck, cqdZs, "Zones de Santé");
  cqdSourcesSlide(deck, cqdZs, "Zones de Santé");
  recommendationSlide(deck, sup, cqd, "zs");
  conclusionSlide(deck, sup, cqd, "zs", "Zones de Santé");

  const data = (await deck.pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return data;
}

/* ============================ RAPPORT 2 : Supervision + CQD Centres de Santé ============================ */

export async function buildCsReport(sup: SupervisionBundle, cqd: CqdBundle): Promise<Buffer> {
  const deck = newDeck();
  const as = sup.levels.as;
  const cqdAs = cqd.levels.as;

  coverSlide(
    deck,
    "Rapport automatisé de supervision PEV et de contrôle qualité des données — Centres de Santé",
    `Province : Tshuapa  ·  Niveau Centres de Santé  ·  Période : ${periodLabel(sup.meta.months)}`,
    [
      { value: numStr(as.perStructure.length), label: "Centres de santé supervisés", accent: BLUE },
      { value: numStr(cqdAs.records), label: "Contrôles qualité réalisés", accent: ORANGE },
      { value: pctStr(as.score.moyen), label: "Score global supervision", accent: GREEN },
      { value: pctStr(cqdAs.concordanceP3.taux), label: "Concordance PENTA3", accent: BLUE },
    ]
  );

  execSummarySlide(deck, sup, cqd, "as", "Centres de Santé");
  coverageSlide(deck, sup, "as", "Centres de Santé");
  scoreByStructureSlide(deck, as.perStructure, "Score global de performance par Centre de Santé");
  composanteSlide(deck, as.composantes, "Performance moyenne par composante");
  cqdConcordanceSlide(deck, cqdAs, "Centres de Santé");
  cqdTranscriptionSlide(deck, cqdAs, "Centres de Santé");
  cqdSourcesSlide(deck, cqdAs, "Centres de Santé");
  recommendationSlide(deck, sup, cqd, "as");
  conclusionSlide(deck, sup, cqd, "as", "Centres de Santé");

  const data = (await deck.pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return data;
}

/* ------------------------------ Diapositives partagées ------------------------------ */

function periodLabel(months: string[]): string {
  if (!months.length) return "Toute la période";
  const fmt = (m: string) => {
    const M = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
    const x = m.match(/(\d{4})-(\d{2})/);
    return x ? `${M[parseInt(x[2], 10) - 1]} ${x[1]}` : m;
  };
  return months.length === 1 ? fmt(months[0]) : `${fmt(months[0])} → ${fmt(months[months.length - 1])}`;
}

function execSummarySlide(deck: Deck, sup: SupervisionBundle, cqd: CqdBundle, lvl: "zs" | "as", word: string) {
  const slide = deck.pptx.addSlide();
  header(slide, "Résumé exécutif", `Lecture rapide de la situation PEV et de la qualité des données — ${word}`);
  const s = sup.levels[lvl];
  const c = cqd.levels[lvl];
  const cards: { value: string; label: string; accent: string }[] = [
    { value: numStr(s.perStructure.length), label: `${word} supervisés`, accent: BLUE },
    { value: numStr(c.records), label: "Contrôles qualité", accent: ORANGE },
    { value: pctStr(s.score.moyen), label: "Score moyen supervision", accent: GREEN },
    { value: numStr(s.perStructure.filter((x) => (x.score ?? 0) >= 80).length), label: `${word} ≥ 80%`, accent: BLUE },
    { value: pctStr(c.concordanceP3.taux), label: "Concordance PENTA3", accent: BLUE },
    { value: pctStr(c.concordanceRr2.taux), label: "Concordance RR2", accent: BLUE },
    { value: pctStr(c.erreurSnisDhis2), label: "Erreur transcription", accent: RED },
    { value: pctStr(c.enfants.tauxRecuperes), label: "Enfants récupérés", accent: GREEN },
  ];
  const gap = 0.2, cols = 4, totalW = 12.5;
  const cw = (totalW - gap * (cols - 1)) / cols;
  cards.forEach((k, i) => {
    const x = 0.4 + (i % cols) * (cw + gap);
    const y = 1.2 + Math.floor(i / cols) * 1.55;
    kpiCard(slide, x, y, cw, k.value, k.label, k.accent);
  });
  const best = sup.highlights.bestComposante?.short ?? "—";
  const worst = sup.highlights.worstComposante?.short ?? "—";
  slide.addText(
    `Message automatique : niveau global de performance de ${pctStr(s.score.moyen)}. Forces : ${best}. ` +
    `Goulots prioritaires : ${worst}. Le CQD met en évidence une concordance PENTA3 de ${pctStr(c.concordanceP3.taux)} ` +
    `et un taux d'erreur de transcription de ${pctStr(c.erreurSnisDhis2)}, nécessitant des actions ciblées dans les ${word.toLowerCase()} à écarts importants.`,
    { x: 0.4, y: 4.5, w: 12.5, h: 1.6, fontSize: 12, color: "333333", valign: "top", fill: { color: "F7FAFE" }, align: "left" }
  );
}

function coverageSlide(deck: Deck, sup: SupervisionBundle, lvl: "zs" | "as", word: string) {
  const slide = deck.pptx.addSlide();
  header(slide, "Couverture de la supervision", `Étendue de la supervision — ${word}`);
  const s = sup.levels[lvl];
  kpiCard(slide, 0.4, 1.2, 3.0, numStr(s.perStructure.length), `${word} supervisés`, BLUE);
  kpiCard(slide, 3.6, 1.2, 3.0, numStr(s.records), "Supervisions réalisées", ORANGE);
  kpiCard(slide, 6.8, 1.2, 3.0, pctStr(s.score.moyen), "Score moyen", GREEN);
  kpiCard(slide, 10.0, 1.2, 2.9, numStr(s.perStructure.filter((x) => (x.score ?? 0) >= 80).length), `${word} ≥ 80%`, BLUE);
  slide.addText(`Nombre de supervisions par ${word.toLowerCase()}`, { x: 0.4, y: 2.85, w: 12, h: 0.3, fontSize: 12, bold: true, color: NAVY });
  table(
    slide, 0.4, 3.25, 12.5,
    [word, "Supervisions", "Score moyen", "Appréciation"],
    s.perStructure.slice(0, 12).map((x) => [x.name, x.count, pctStr(x.score), apprec(x.score)]),
    [5.5, 2.3, 2.3, 2.4]
  );
}

function apprec(score: number | null): string {
  if (score === null) return "—";
  if (score >= 80) return "Très bon";
  if (score >= 60) return "Bon";
  if (score >= 40) return "Moyen";
  return "Faible";
}

function scoreByStructureSlide(deck: Deck, items: { name: string; score: number | null }[], title: string) {
  const slide = deck.pptx.addSlide();
  header(slide, title, "Classement automatique du meilleur au plus faible score");
  if (!items.length) {
    slide.addText("Aucune donnée disponible pour la période.", { x: 0.4, y: 3, w: 12, h: 0.5, fontSize: 14, color: GREY, align: "center" });
    return;
  }
  barList(slide, 0.4, 1.3, 12.5, items.map((x) => ({ name: x.name, value: x.score })), BLUE);
}

function composanteSlide(deck: Deck, comps: { short: string; score: number | null }[], title: string) {
  const slide = deck.pptx.addSlide();
  header(slide, title, "Score moyen des 6 composantes de la checklist");
  barList(slide, 0.4, 1.4, 12.5, comps.map((c) => ({ name: c.short, value: c.score })), BLUE);
}

function cqdConcordanceSlide(deck: Deck, c: CqdLevelBundle, word: string) {
  const slide = deck.pptx.addSlide();
  header(slide, "Concordance DHIS2 / Registre — SNIS", `Qualité des données — ${word}`);
  const cls = (k: string) => ({ normal: "Concordant (95–105)", sous: "Sous-rapportage (<95)", sur: "Sur-rapportage (>105)", na: "Non disponible" }[k] ?? "—");
  kpiCard(slide, 0.4, 1.2, 6.1, pctStr(c.concordanceP3.taux), `PENTA3 — ${cls(c.concordanceP3.classe)}`, c.concordanceP3.classe === "normal" ? GREEN : ORANGE);
  kpiCard(slide, 6.8, 1.2, 6.1, pctStr(c.concordanceRr2.taux), `RR2 — ${cls(c.concordanceRr2.classe)}`, c.concordanceRr2.classe === "normal" ? GREEN : ORANGE);
  slide.addText("Détail par structure (concordance PENTA3)", { x: 0.4, y: 2.9, w: 12, h: 0.3, fontSize: 12, bold: true, color: NAVY });
  table(
    slide, 0.4, 3.3, 12.5,
    [word, "Concordance PENTA3", "Appréciation", "Erreur SNIS→DHIS2"],
    c.parStructure.slice(0, 12).map((s) => [s.name, pctStr(s.concordanceP3), cls(s.classeP3), pctStr(s.erreurSnisDhis2)]),
    [5.5, 2.6, 2.4, 2.0]
  );
}

function cqdTranscriptionSlide(deck: Deck, c: CqdLevelBundle, word: string) {
  const slide = deck.pptx.addSlide();
  header(slide, "Erreurs de transcription", `Taux d'erreur entre sources — ${word}`);
  kpiCard(slide, 0.4, 1.2, 4.0, pctStr(c.erreurSnisDhis2), "Erreur SNIS → DHIS2", RED);
  kpiCard(slide, 4.6, 1.2, 4.0, pctStr(c.erreurPointageRegistre), "Erreur Pointage → Registre", ORANGE);
  kpiCard(slide, 8.8, 1.2, 4.1, pctStr(c.enfants.tauxRecuperes), "Enfants PDV récupérés", GREEN);
  slide.addText("Complétude des outils de gestion", { x: 0.4, y: 2.9, w: 12, h: 0.3, fontSize: 12, bold: true, color: NAVY });
  kpiCard(slide, 0.4, 3.3, 4.0, pctStr(c.outils.registre), "Registre correct", BLUE);
  kpiCard(slide, 4.6, 3.3, 4.0, pctStr(c.outils.pointage), "Feuille de pointage correcte", BLUE);
  kpiCard(slide, 8.8, 3.3, 4.1, pctStr(c.outils.snis), "Canevas SNIS correct", BLUE);
}

function cqdSourcesSlide(deck: Deck, c: CqdLevelBundle, word: string) {
  const slide = deck.pptx.addSlide();
  header(slide, "Comparaison des sources de données", `Sommes des ${word.toLowerCase()} par antigène`);
  table(
    slide, 0.4, 1.4, 12.5,
    ["Antigène", "Registre", "Feuille de pointage", "SNIS", "DHIS2"],
    c.antigenes.map((a) => [a.antigene, numStr(a.registre), numStr(a.pointage), numStr(a.snis), numStr(a.dhis2)])
  );
}

function recommendationSlide(deck: Deck, sup: SupervisionBundle, cqd: CqdBundle, lvl: "zs" | "as") {
  const s = sup.levels[lvl];
  const c = cqd.levels[lvl];
  const weak = s.composantes.filter((x) => (x.score ?? 100) < 60).map((x) => x.short);
  const weakStruct = s.perStructure.filter((x) => (x.score ?? 100) < 60).slice(0, 5).map((x) => x.name);
  bulletSlide(deck, "Principaux goulots & actions correctrices", "Synthèse automatique des priorités", [
    {
      heading: "Goulots identifiés",
      color: RED,
      items: [
        ...(weak.length ? weak.map((w) => `Composante faible : ${w}`) : ["Aucune composante < 60%"]),
        c.concordanceP3.classe !== "normal" ? `Concordance PENTA3 hors norme (${pctStr(c.concordanceP3.taux)})` : "Concordance PENTA3 satisfaisante",
        (c.erreurSnisDhis2 ?? 0) > 5 ? `Erreur de transcription élevée (${pctStr(c.erreurSnisDhis2)})` : "Transcription maîtrisée",
      ],
    },
    {
      heading: "Actions immédiates",
      color: ORANGE,
      items: [
        "Corriger les écarts DHIS2 / SNIS / registre",
        "Renforcer la complétude des outils de collecte",
        "Suivre les enfants perdus de vue identifiés",
        ...(weakStruct.length ? [`Appui ciblé : ${weakStruct.join(", ")}`] : []),
      ],
    },
    {
      heading: "Recommandations stratégiques",
      color: GREEN,
      items: [
        "Coaching/formation sur les composantes faibles",
        "Supervision conjointe rapprochée des structures < 60%",
        "Suivi mensuel des recommandations",
        "Documentation et diffusion des bonnes pratiques",
      ],
    },
  ]);
}

function conclusionSlide(deck: Deck, sup: SupervisionBundle, cqd: CqdBundle, lvl: "zs" | "as", word: string) {
  const slide = deck.pptx.addSlide();
  header(slide, "Conclusion", `Synthèse — ${word}`);
  const s = sup.levels[lvl];
  const c = cqd.levels[lvl];
  slide.addText(
    [
      { text: "Performance globale de supervision : ", options: { bold: true } },
      { text: `${pctStr(s.score.moyen)}\n`, options: {} },
      { text: "Qualité des données — concordance PENTA3 : ", options: { bold: true } },
      { text: `${pctStr(c.concordanceP3.taux)} (${c.concordanceP3.classe})\n`, options: {} },
      { text: "Taux d'erreur de transcription : ", options: { bold: true } },
      { text: `${pctStr(c.erreurSnisDhis2)}\n`, options: {} },
      { text: "Enfants perdus de vue récupérés : ", options: { bold: true } },
      { text: `${pctStr(c.enfants.tauxRecuperes)}\n\n`, options: {} },
      { text: "Les actions correctrices prioritaires portent sur les composantes faibles et la fiabilisation des données (DHIS2/SNIS/registre). Un suivi mensuel des recommandations est requis.", options: { italic: true } },
    ],
    { x: 0.6, y: 1.4, w: 12.1, h: 4.5, fontSize: 15, color: "333333", valign: "top", lineSpacingMultiple: 1.2 }
  );
}

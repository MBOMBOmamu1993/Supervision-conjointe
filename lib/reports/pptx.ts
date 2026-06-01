/**
 * Génération des rapports PowerPoint automatisés (côté serveur).
 *
 * Design calé sur le modèle « Rapport polio_Angola » :
 *   - format 16:9, bandeau marine, cartes KPI bleu/orange/vert.
 *   - page de garde : logo OMS à l'extrémité GAUCHE, logo PEV à l'extrémité
 *     DROITE, en haut.
 *
 * Les deux rapports reprennent l'INTÉGRALITÉ des diapositives des modèles PDF
 *   - Rapport ZS  : 23 diapositives (PEV + CQD, niveau Zone de Santé).
 *   - Rapport CS  : 26 diapositives (PEV + CQD, niveau Centre de Santé).
 * Les contenus sont alimentés dynamiquement par les bundles du dashboard
 * (SupervisionBundle + CqdBundle).
 */
import PptxGenJS from "pptxgenjs";
import { readFileSync } from "fs";
import { join } from "path";
import type { SupervisionBundle, LevelBundle } from "@/lib/supervision/types";
import type { CqdBundle, CqdLevelBundle, ConcordanceClass } from "@/lib/cqd/types";

const NAVY = "1F3864";
const BLUE = "2E75B6";
const LIGHT = "DEEBF7";
const ORANGE = "ED7D31";
const GREEN = "548235";
const RED = "C00000";
const GREY = "595959";
const WHITE = "FFFFFF";
const FOOT = "Rapport automatisé PEV & CQD — Province de la Tshuapa";

function logoDataUri(file: string): string {
  try {
    const buf = readFileSync(join(process.cwd(), "public", "logo", file));
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return "";
  }
}

const pctStr = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? "—" : `${Math.round(n * 10) / 10} %`);
const numStr = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? "—" : new Intl.NumberFormat("fr-FR").format(Math.round(n)));
const r0 = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? 0 : Math.round(n));

const CLASS_LABEL: Record<ConcordanceClass, string> = {
  normal: "Concordant (95–105)",
  sous: "Sous-rapportage (<95)",
  sur: "Sur-rapportage (>105)",
  na: "Non disponible",
};
const classColor = (c: ConcordanceClass) => (c === "normal" ? GREEN : c === "na" ? GREY : c === "sur" ? ORANGE : RED);
const scoreColor = (v: number | null) => (v === null ? GREY : v >= 80 ? GREEN : v >= 60 ? BLUE : v >= 40 ? ORANGE : RED);
const apprec = (s: number | null) => (s === null ? "—" : s >= 80 ? "Très bon" : s >= 60 ? "Bon" : s >= 40 ? "Moyen" : "Faible");

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

/** Diapositive de contenu standard : bandeau marine + titre + sous-titre + pied. */
function contentSlide(deck: Deck, title: string, subtitle?: string): PptxGenJS.Slide {
  const slide = deck.pptx.addSlide();
  slide.background = { color: WHITE };
  slide.addShape("rect", { x: 0, y: 0, w: 13.333, h: 0.95, fill: { color: NAVY } });
  slide.addText(title, { x: 0.4, y: 0.1, w: 12.5, h: 0.5, fontSize: 19, bold: true, color: WHITE, valign: "middle" });
  if (subtitle) slide.addText(subtitle, { x: 0.4, y: 0.6, w: 12.5, h: 0.3, fontSize: 11, italic: true, color: LIGHT });
  slide.addShape("rect", { x: 0, y: 0.95, w: 13.333, h: 0.05, fill: { color: ORANGE } });
  slide.addText(FOOT, { x: 0.4, y: 7.18, w: 10, h: 0.25, fontSize: 8, color: GREY });
  return slide;
}

/** Carte KPI (valeur + libellé) façon modèle polio. */
function kpiCard(slide: PptxGenJS.Slide, x: number, y: number, w: number, h: number, value: string, label: string, accent = BLUE) {
  slide.addShape("roundRect", { x, y, w, h, rectRadius: 0.06, fill: { color: LIGHT }, line: { color: accent, width: 1 } });
  slide.addShape("rect", { x, y, w: 0.09, h, fill: { color: accent } });
  slide.addText(value, { x: x + 0.12, y: y + 0.1, w: w - 0.24, h: h * 0.5, fontSize: h > 1.2 ? 24 : 18, bold: true, color: accent, align: "center", valign: "middle" });
  slide.addText(label, { x: x + 0.12, y: y + h * 0.55, w: w - 0.24, h: h * 0.42, fontSize: 9.5, color: GREY, align: "center", valign: "top" });
}

/** Rangée de cartes KPI réparties sur la largeur. */
function kpiStrip(slide: PptxGenJS.Slide, y: number, cards: { value: string; label: string; accent?: string }[], h = 1.3, x0 = 0.4, totalW = 12.5) {
  const n = cards.length || 1;
  const gap = 0.2;
  const cw = (totalW - gap * (n - 1)) / n;
  cards.forEach((c, i) => kpiCard(slide, x0 + i * (cw + gap), y, cw, h, c.value, c.label, c.accent ?? BLUE));
}

/** Tableau stylé. */
function table(slide: PptxGenJS.Slide, x: number, y: number, w: number, head: string[], rows: (string | number)[][], colW?: number[], fontSize = 9.5) {
  const widths = colW ?? head.map(() => w / head.length);
  const body: PptxGenJS.TableRow[] = [];
  body.push(head.map((h) => ({ text: h, options: { bold: true, color: WHITE, fill: { color: NAVY }, fontSize: fontSize + 0.5, align: "center" as const, valign: "middle" as const } })));
  rows.forEach((row, i) => {
    body.push(row.map((c) => ({ text: String(c), options: { fontSize, color: "333333", fill: { color: i % 2 ? "F2F6FC" : WHITE }, align: "center" as const, valign: "middle" as const } })));
  });
  slide.addTable(body, { x, y, w, colW: widths, border: { type: "solid", color: "D9D9D9", pt: 0.5 }, autoPage: false });
}

/** Graphique en barres natif (colonnes). */
function barChart(slide: PptxGenJS.Slide, x: number, y: number, w: number, h: number, labels: string[], values: (number | null)[], opts: { title?: string; max?: number; color?: string } = {}) {
  if (!labels.length) {
    slide.addText("Aucune donnée disponible pour la période.", { x, y: y + h / 2 - 0.2, w, h: 0.4, fontSize: 12, italic: true, color: GREY, align: "center" });
    return;
  }
  slide.addChart(
    "bar" as PptxGenJS.CHART_NAME,
    [{ name: opts.title ?? "Valeur", labels, values: values.map((v) => v ?? 0) }],
    {
      x, y, w, h, barDir: "col",
      chartColors: [opts.color ?? BLUE],
      showValue: true, dataLabelFontSize: 8, dataLabelColor: "333333",
      valAxisMaxVal: opts.max ?? 100, valAxisMinVal: 0,
      catAxisLabelFontSize: 9, valAxisLabelFontSize: 8,
      showLegend: false,
    }
  );
}

/** Graphique en barres groupées (plusieurs séries). */
function groupedBar(slide: PptxGenJS.Slide, x: number, y: number, w: number, h: number, labels: string[], series: { name: string; values: number[] }[], colors: string[]) {
  slide.addChart(
    "bar" as PptxGenJS.CHART_NAME,
    series.map((s) => ({ name: s.name, labels, values: s.values })),
    { x, y, w, h, barDir: "col", chartColors: colors, showLegend: true, legendPos: "b", legendFontSize: 9, catAxisLabelFontSize: 9, valAxisLabelFontSize: 8 }
  );
}

/** Panneau à puces (1 à 3 colonnes). */
function bulletPanels(slide: PptxGenJS.Slide, y: number, h: number, blocks: { heading: string; items: string[]; color?: string }[]) {
  const n = blocks.length || 1;
  const gap = 0.3, totalW = 12.5;
  const cw = (totalW - gap * (n - 1)) / n;
  blocks.forEach((b, i) => {
    const x = 0.4 + i * (cw + gap);
    slide.addShape("roundRect", { x, y, w: cw, h, rectRadius: 0.06, fill: { color: "F7FAFE" }, line: { color: b.color ?? BLUE, width: 1 } });
    slide.addText(b.heading, { x: x + 0.15, y: y + 0.12, w: cw - 0.3, h: 0.45, fontSize: 13, bold: true, color: b.color ?? NAVY });
    slide.addText(
      b.items.map((t) => ({ text: t, options: { bullet: true, fontSize: 10.5, color: "333333", paraSpaceAfter: 5 } })),
      { x: x + 0.15, y: y + 0.62, w: cw - 0.3, h: h - 0.75, valign: "top" }
    );
  });
}

/** Bloc de message automatique (encadré bas de slide). */
function noteBox(slide: PptxGenJS.Slide, y: number, text: string, h = 0.9) {
  slide.addText(text, { x: 0.4, y, w: 12.5, h, fontSize: 10.5, italic: true, color: "333333", fill: { color: "F2F6FC" }, align: "left", valign: "middle" });
}

function periodLabel(months: string[]): string {
  if (!months.length) return "Toute la période";
  const M = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
  const fmt = (m: string) => { const x = m.match(/(\d{4})-(\d{2})/); return x ? `${M[parseInt(x[2], 10) - 1]} ${x[1]}` : m; };
  return months.length === 1 ? fmt(months[0]) : `${fmt(months[0])} → ${fmt(months[months.length - 1])}`;
}

function monthsFr(months: string[]): string[] {
  const M = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
  return months.map((m) => { const x = m.match(/(\d{4})-(\d{2})/); return x ? `${M[parseInt(x[2], 10) - 1]} ${x[1].slice(2)}` : m; });
}

/** Page de garde : OMS extrémité gauche, PEV extrémité droite, en haut. */
function coverSlide(deck: Deck, title: string, subtitle: string, source: string, kpis: { value: string; label: string; accent?: string }[]) {
  const slide = deck.pptx.addSlide();
  slide.background = { color: NAVY };
  if (deck.oms) slide.addImage({ data: deck.oms, x: 0.4, y: 0.35, w: 1.6, h: 1.05, sizing: { type: "contain", w: 1.6, h: 1.05 } });
  if (deck.pev) slide.addImage({ data: deck.pev, x: 11.35, y: 0.35, w: 1.6, h: 1.05, sizing: { type: "contain", w: 1.6, h: 1.05 } });
  slide.addText("PROGRAMME ÉLARGI DE VACCINATION · OMS — RÉPUBLIQUE DÉMOCRATIQUE DU CONGO", {
    x: 1, y: 1.75, w: 11.333, h: 0.4, fontSize: 12, color: LIGHT, align: "center", charSpacing: 1,
  });
  slide.addText(title, { x: 0.8, y: 2.35, w: 11.733, h: 1.3, fontSize: 28, bold: true, color: WHITE, align: "center", valign: "middle" });
  slide.addText(subtitle, { x: 1, y: 3.75, w: 11.333, h: 0.5, fontSize: 13, italic: true, color: LIGHT, align: "center" });
  kpiStrip(slide, 4.55, kpis, 1.45, 0.9, 11.533);
  slide.addText(source, { x: 1, y: 6.4, w: 11.333, h: 0.3, fontSize: 9, color: LIGHT, align: "center" });
  slide.addText(`Source : ODK / Kobo / Excel  ·  Généré le ${new Date().toLocaleDateString("fr-FR")}`, {
    x: 1, y: 6.95, w: 11.333, h: 0.3, fontSize: 9, color: LIGHT, align: "center",
  });
}

/* ====== Briques de slides réutilisées (supervision + CQD) ====== */

function execSummarySlide(deck: Deck, sup: SupervisionBundle, cqd: CqdBundle, lvl: "zs" | "as", word: string) {
  const slide = contentSlide(deck, "Résumé exécutif", `Lecture rapide de la situation PEV et de la qualité des données — ${word}`);
  const s = sup.levels[lvl];
  const c = cqd.levels[lvl];
  const cards = [
    { value: numStr(s.perStructure.length), label: `${word} supervisés`, accent: BLUE },
    { value: numStr(c.records), label: "Contrôles qualité", accent: ORANGE },
    { value: pctStr(s.score.moyen), label: "Score moyen supervision", accent: GREEN },
    { value: numStr(s.perStructure.filter((x) => (x.score ?? 0) >= 80).length), label: `${word} ≥ 80%`, accent: BLUE },
  ];
  kpiStrip(slide, 1.2, cards, 1.25);
  const cards2 = [
    { value: pctStr(c.concordanceP3.taux), label: "Concordance PENTA3", accent: classColor(c.concordanceP3.classe) },
    { value: pctStr(c.concordanceRr2.taux), label: "Concordance RR2", accent: classColor(c.concordanceRr2.classe) },
    { value: pctStr(c.erreurSnisDhis2), label: "Erreur transcription", accent: RED },
    { value: pctStr(c.enfants.tauxRecuperes), label: "Enfants récupérés", accent: GREEN },
  ];
  kpiStrip(slide, 2.65, cards2, 1.25);
  const best = sup.highlights.bestComposante?.short ?? "—";
  const worst = sup.highlights.worstComposante?.short ?? "—";
  noteBox(
    slide, 4.15,
    `Message automatique : niveau global de performance de ${pctStr(s.score.moyen)}. Les forces concernent ${best}, tandis que les goulots prioritaires concernent ${worst}. ` +
    `Le CQD met en évidence une concordance PENTA3 de ${pctStr(c.concordanceP3.taux)} et un taux d'erreur de transcription de ${pctStr(c.erreurSnisDhis2)}, nécessitant des actions ciblées dans les ${word.toLowerCase()} à écarts importants.`,
    1.4
  );
  bulletPanels(slide, 5.75, 1.25, [
    { heading: "Forces", color: GREEN, items: sup.levels[lvl].composantes.filter((x) => (x.score ?? 0) >= 70).slice(0, 3).map((x) => x.short).concat(["Bonnes pratiques à documenter"]).slice(0, 3) },
    { heading: "Goulots", color: RED, items: sup.levels[lvl].composantes.filter((x) => (x.score ?? 100) < 60).slice(0, 3).map((x) => x.short).concat(["Structures à écart"]).slice(0, 3) },
    { heading: "Priorités immédiates", color: ORANGE, items: ["Correction DHIS2/SNIS/registre", "Suivi des recommandations & enfants manqués"] },
  ]);
}

function scoreByStructureSlide(deck: Deck, items: { name: string; score: number | null }[], title: string, word: string) {
  const slide = contentSlide(deck, title, "Classement automatique du meilleur au plus faible score");
  const top = items.slice(0, 12);
  barChart(slide, 0.4, 1.2, 8.2, 4.0, top.map((x) => x.name), top.map((x) => x.score), { title: "Score", color: BLUE });
  // Grille d'appréciation
  table(slide, 8.8, 1.3, 4.1, ["Score", "Appréciation"], [
    ["≥ 80 %", "Très bon — maintenir"],
    ["60–79 %", "Bon / moyen — coaching"],
    ["< 60 %", "Faible — appui rapproché"],
  ], [1.6, 2.5], 9);
  noteBox(slide, 5.4, `Lecture automatique : les ${word.toLowerCase()} en dessous de 60% sont classés prioritaires. Les scores sont calculés à partir des réponses pondérées de la checklist supervision PEV.`, 1.0);
}

function composanteSlide(deck: Deck, comps: { short: string; score: number | null }[], title: string) {
  const slide = contentSlide(deck, title, "Score moyen des composantes de la checklist");
  barChart(slide, 0.4, 1.25, 12.5, 3.9, comps.map((c) => c.short), comps.map((c) => c.score), { title: "Score moyen", color: BLUE });
  const ranked = [...comps].filter((c) => c.score !== null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  bulletPanels(slide, 5.35, 1.5, [
    { heading: "Top composantes", color: GREEN, items: ranked.slice(0, 3).map((c) => `${c.short} (${pctStr(c.score)})`) },
    { heading: "Composantes à prioriser", color: RED, items: ranked.slice(-3).reverse().map((c) => `${c.short} (${pctStr(c.score)})`) },
  ]);
}

function composanteAnswersSlide(deck: Deck, lvlBundle: LevelBundle, title: string, subtitle: string) {
  const slide = contentSlide(deck, title, subtitle);
  const ca = lvlBundle.composanteAnswers;
  const labels = ca.map((c) => c.short);
  groupedBar(slide, 0.4, 1.25, 12.5, 4.0, labels, [
    { name: "Oui", values: ca.map((c) => c.answers.oui) },
    { name: "Partiel", values: ca.map((c) => c.answers.partiel) },
    { name: "Non", values: ca.map((c) => c.answers.non) },
  ], [GREEN, ORANGE, RED]);
  // Top questions « Non »
  const topNon = lvlBundle.topNon.slice(0, 5);
  noteBox(slide, 5.45, topNon.length
    ? `Questions à plusieurs « Non » : ${topNon.map((t) => `${t.question} (${t.pct}%)`).join(" · ")}`
    : "Aucune question critique détectée sur la période.", 1.0);
}

function cqdToolsSlide(deck: Deck, c: CqdLevelBundle, word: string) {
  const slide = contentSlide(deck, "Qualité des outils de collecte", `Registre, feuilles de pointage, canevas SNIS et DHIS2 — ${word}`);
  barChart(slide, 0.4, 1.25, 7.6, 4.2, ["Registre", "Pointage", "SNIS"], [c.outils.registre, c.outils.pointage, c.outils.snis], { title: "% correct", color: BLUE });
  kpiCard(slide, 8.4, 1.4, 4.5, 1.2, pctStr(c.outils.registre), "Registre correctement rempli", BLUE);
  kpiCard(slide, 8.4, 2.8, 4.5, 1.2, pctStr(c.outils.pointage), "Feuille de pointage correcte", BLUE);
  kpiCard(slide, 8.4, 4.2, 4.5, 1.2, pctStr(c.outils.snis), "Canevas SNIS correct", BLUE);
  noteBox(slide, 5.75, "Source : formulaire CQD. Les critères de bon remplissage (cellules vides, zéros, valeurs aberrantes, incohérences) doivent être appliqués de façon standardisée par les superviseurs.", 1.1);
}

function cqdConcordanceP3Slide(deck: Deck, c: CqdLevelBundle, word: string, ref: string) {
  const slide = contentSlide(deck, `Concordance PENTA3 DHIS2 / ${ref}`, "Interprétation : 95–105% concordant, <95% sous-rapportage, >105% sur-rapportage");
  const struct = c.parStructure.slice(0, 12);
  barChart(slide, 0.4, 1.2, 8.0, 4.0, struct.map((s) => s.name), struct.map((s) => s.concordanceP3), { title: "Concordance PENTA3", color: BLUE, max: 120 });
  table(slide, 8.6, 1.3, 4.3, ["Résultat", "Action"], [
    ["95–105 %", "Valider"],
    ["< 95 %", "Rechercher données manquantes"],
    ["> 105 %", "Recompter et corriger"],
  ], [1.7, 2.6], 9);
  kpiCard(slide, 8.6, 3.5, 4.3, 1.1, pctStr(c.concordanceP3.taux), `Global — ${CLASS_LABEL[c.concordanceP3.classe]}`, classColor(c.concordanceP3.classe));
  noteBox(slide, 5.4, `Formule : taux de concordance = données DHIS2 / source de référence (${ref}) × 100.`, 1.0);
}

function cqdConcordanceRr2Slide(deck: Deck, c: CqdLevelBundle, word: string, ref: string) {
  const slide = contentSlide(deck, `Concordance RR2 DHIS2 / ${ref}`, "Même logique de classification que pour PENTA3");
  const struct = c.parStructure.slice(0, 12);
  // RR2 par structure non détaillé : on affiche la concordance RR2 globale + table antigènes.
  kpiStrip(slide, 1.2, [
    { value: pctStr(c.concordanceRr2.taux), label: `RR2 global — ${CLASS_LABEL[c.concordanceRr2.classe]}`, accent: classColor(c.concordanceRr2.classe) },
    { value: pctStr(c.concordanceP3.taux), label: `PENTA3 global — ${CLASS_LABEL[c.concordanceP3.classe]}`, accent: classColor(c.concordanceP3.classe) },
  ], 1.2);
  table(slide, 0.4, 2.7, 12.5, ["Antigène", "Concordance DHIS2 / référence", "Appréciation"],
    c.parAntigene.map((a) => [a.antigene, pctStr(a.concordance), a.concordance === null ? "—" : a.concordance < 95 ? "Sous-rapportage" : a.concordance > 105 ? "Sur-rapportage" : "Concordant"]),
    [3.5, 5.5, 3.5]);
  noteBox(slide, 5.4, `Les ${word.toLowerCase()} en dehors de l'intervalle 95–105% doivent être listés automatiquement dans les actions correctrices.`, 1.0);
}

function cqdErrorsSlide(deck: Deck, c: CqdLevelBundle, word: string) {
  const slide = contentSlide(deck, "Erreurs de transcription", `Écarts entre SNIS/DHIS2 et entre feuille de pointage/registre — ${word}`);
  barChart(slide, 0.4, 1.25, 7.8, 4.0, c.parAntigene.map((a) => a.antigene), c.parAntigene.map((a) => a.erreur), { title: "Taux d'erreur par antigène", color: RED, max: 100 });
  kpiCard(slide, 8.5, 1.4, 4.4, 1.2, pctStr(c.erreurSnisDhis2), "Erreur globale SNIS → DHIS2", RED);
  kpiCard(slide, 8.5, 2.8, 4.4, 1.2, pctStr(c.erreurPointageRegistre), "Erreur Pointage → Registre", ORANGE);
  kpiCard(slide, 8.5, 4.2, 4.4, 1.2, pctStr(c.enfants.tauxRecuperes), "Enfants PDV récupérés", GREEN);
  noteBox(slide, 5.55, "Formule : taux d'erreur = nombre de valeurs discordantes / nombre de valeurs vérifiées × 100. Les structures avec erreur ≥ 25% par antigène doivent être listées.", 1.1);
}

function cqdSourcesSlide(deck: Deck, c: CqdLevelBundle, word: string) {
  const slide = contentSlide(deck, "Comparaison des sources de données", `Registre, feuille de pointage, SNIS et DHIS2 par antigène — ${word}`);
  const labels = c.antigenes.map((a) => a.antigene);
  groupedBar(slide, 0.4, 1.25, 8.0, 4.2, labels, [
    { name: "Registre", values: c.antigenes.map((a) => a.registre) },
    { name: "Pointage", values: c.antigenes.map((a) => a.pointage) },
    { name: "SNIS", values: c.antigenes.map((a) => a.snis) },
    { name: "DHIS2", values: c.antigenes.map((a) => a.dhis2) },
  ], [BLUE, "9DC3E6", ORANGE, GREEN]);
  table(slide, 8.5, 1.3, 4.4, ["Antigène", "Reg.", "DHIS2"], c.antigenes.map((a) => [a.antigene, numStr(a.registre), numStr(a.dhis2)]), [1.6, 1.4, 1.4], 9);
  noteBox(slide, 5.7, "Message automatique : les écarts les plus importants entre sources indiquent un problème probable de transcription, compilation ou saisie DHIS2.", 1.0);
}

function cqdCompositeSlide(deck: Deck, c: CqdLevelBundle, word: string) {
  const slide = contentSlide(deck, `Classement des ${word} selon la qualité des données`, "Score composite de qualité et catégorisation automatique");
  // Score composite simple = pondération concordance/erreur/outils par structure.
  const composite = c.parStructure.map((s) => {
    const cP3 = s.concordanceP3 === null ? 0 : Math.max(0, 100 - Math.abs(100 - s.concordanceP3));
    const err = s.erreurSnisDhis2 === null ? 100 : Math.max(0, 100 - s.erreurSnisDhis2);
    const score = Math.round(cP3 * 0.5 + err * 0.4 + (s.outilsOk > 0 ? 10 : 0));
    return { name: s.name, score };
  }).sort((a, b) => b.score - a.score).slice(0, 12);
  barChart(slide, 0.4, 1.2, 8.0, 4.1, composite.map((x) => x.name), composite.map((x) => x.score), { title: "Score composite qualité", color: BLUE });
  table(slide, 8.6, 1.3, 4.3, ["Critère", "Pond."], [
    ["Concordance PENTA3", "25 %"], ["Concordance RR2", "25 %"],
    ["Erreur SNIS/DHIS2", "20 %"], ["Erreur Pointage/Reg.", "20 %"], ["Qualité des outils", "10 %"],
  ], [2.7, 1.4], 9);
  noteBox(slide, 5.5, "Le score composite aide à prioriser les missions DQS et le coaching en gestion des données (≥90 très bonne, 80–89 bonne, 60–79 moyenne, <60 faible).", 1.0);
}

function crossSlide(deck: Deck, word: string) {
  const slide = contentSlide(deck, `Croisement supervision ${word} + qualité des données`, "Matrice d'identification des structures prioritaires");
  const cell = (x: number, y: number, head: string, sub: string, color: string) => {
    slide.addShape("roundRect", { x, y, w: 6.0, h: 1.7, rectRadius: 0.06, fill: { color: "F7FAFE" }, line: { color, width: 1.5 } });
    slide.addText(head, { x: x + 0.2, y: y + 0.15, w: 5.6, h: 0.7, fontSize: 13, bold: true, color });
    slide.addText(sub, { x: x + 0.2, y: y + 0.85, w: 5.6, h: 0.7, fontSize: 11, color: "333333" });
  };
  cell(0.4, 1.3, "Supervision forte + données bonnes", "Structure performante — maintenir et documenter", GREEN);
  cell(6.9, 1.3, "Supervision forte + données faibles", "Problème de gestion des données — coaching DQS ciblé", ORANGE);
  cell(0.4, 3.2, "Supervision faible + données bonnes", "Appui programmatique — supervision formative", BLUE);
  cell(6.9, 3.2, "Supervision faible + données faibles", "Structure prioritaire — mission d'appui rapproché", RED);
  noteBox(slide, 5.2, "Axe X : score supervision · Axe Y : score qualité des données · La taille du point peut représenter le nombre d'enfants à récupérer.", 1.0);
}

function bottlenecksSlide(deck: Deck, sup: SupervisionBundle, cqd: CqdBundle, lvl: "zs" | "as", word: string) {
  const slide = contentSlide(deck, "Principaux goulots identifiés", "Génération automatique à partir des faibles scores et observations");
  const s = sup.levels[lvl];
  const c = cqd.levels[lvl];
  const weakComp = s.composantes.filter((x) => (x.score ?? 100) < 60);
  const rows: (string | number)[][] = [];
  for (const w of weakComp) rows.push([w.short, "Score faible (< 60%)", pctStr(w.score), "Haute"]);
  if (c.concordanceP3.classe !== "normal" && c.concordanceP3.classe !== "na") rows.push(["Données", `Concordance PENTA3 ${CLASS_LABEL[c.concordanceP3.classe]}`, pctStr(c.concordanceP3.taux), "Haute"]);
  if ((c.erreurSnisDhis2 ?? 0) > 5) rows.push(["Données", "Erreurs de transcription SNIS/DHIS2", pctStr(c.erreurSnisDhis2), "Haute"]);
  if ((c.enfants.tauxRecuperes ?? 100) < 80) rows.push(["Communauté", "Récupération des enfants manqués insuffisante", pctStr(c.enfants.tauxRecuperes), "Moyenne"]);
  if (!rows.length) rows.push(["—", "Aucun goulot majeur détecté sur la période", "—", "—"]);
  table(slide, 0.4, 1.25, 12.5, ["Domaine", "Goulot", "Valeur", "Priorité"], rows, [3.0, 6.0, 1.75, 1.75], 10);
  noteBox(slide, 6.0, "Prioriser les goulots touchant plusieurs structures · relier chaque goulot à une action SMART · suivre chaque action jusqu'à clôture documentée.", 0.9);
}

function actionsSlide(deck: Deck) {
  const slide = contentSlide(deck, "Actions correctrices immédiates", "Actions issues des observations et recommandations du formulaire CQD");
  table(slide, 0.4, 1.25, 12.5, ["Problème", "Action corrective", "Responsable", "Échéance", "Statut"], [
    ["PENTA3 sur/sous-rapporté", "Recompter registre et corriger DHIS2", "IT / BCZ", "72h", "À faire"],
    ["Fiches température incomplètes", "Briefing CDF + suivi journalier", "Logisticien", "7 jours", "En cours"],
    ["Microplan non actualisé", "Actualisation avec les AS", "ECZ", "14 jours", "À faire"],
    ["Relais non actifs", "Relancer briefing et supervision des relais", "ECZ / AS", "14 jours", "À faire"],
    ["Recommandations non exécutées", "Revue de suivi et responsabilisation", "BCZ / Antenne", "30 jours", "À faire"],
  ], [3.2, 4.2, 2.0, 1.6, 1.5], 10);
  noteBox(slide, 5.6, "Le statut doit être mis à jour à chaque revue : À faire, En cours, Clôturé, Bloqué.", 0.9);
}

function strategicRecoSlide(deck: Deck) {
  const slide = contentSlide(deck, "Recommandations stratégiques", "Recommandations générées par niveau de responsabilité");
  bulletPanels(slide, 1.25, 5.4, [
    { heading: "Niveau Zone de Santé / CS", color: BLUE, items: [
      "Corriger les écarts SNIS / DHIS2 / registre / pointage.",
      "Organiser une revue mensuelle des données PEV.",
      "Renforcer la redevabilité sur les données et la récupération.",
      "Assurer le suivi des recommandations de supervision.",
    ]},
    { heading: "Niveau Antenne", color: GREEN, items: [
      "Prioriser les structures à double déficit (supervision + données).",
      "Mettre à jour les microplans dans toutes les AS.",
      "Organiser des missions DQS ciblées.",
      "Harmoniser les outils de collecte et de validation.",
    ]},
    { heading: "Niveau Province", color: ORANGE, items: [
      "Mettre en place un tableau de bord provincial automatisé.",
      "Suivre mensuellement la concordance PENTA3 et RR2.",
      "Documenter les bonnes pratiques des structures performantes.",
      "Standardiser les rapports automatisés par période.",
    ]},
  ]);
}

function followUpSlide(deck: Deck) {
  const slide = contentSlide(deck, "Plan de suivi des recommandations", "Tableau opérationnel de redevabilité");
  table(slide, 0.4, 1.25, 12.5, ["Recommandation", "Responsable", "Échéance", "Indicateur de suivi", "Source de vérification"], [
    ["Corriger les données discordantes", "ZS / AS", "72h", "Données corrigées dans DHIS2", "Capture DHIS2 / SNIS"],
    ["Actualiser les microplans", "ZS / CS", "14 jours", "Microplans disponibles", "Fichier microplan"],
    ["Superviser les structures faibles", "Antenne / ZS", "30 jours", "Nombre de supervisions", "Rapport supervision"],
    ["Suivre les enfants manqués", "IT / RECO", "Hebdomadaire", "% enfants récupérés", "Fiche récupération"],
    ["Clôturer les actions critiques", "BCZ / Antenne", "Mensuel", "% actions clôturées", "PV revue mensuelle"],
  ], [3.2, 1.9, 1.7, 3.0, 2.7], 9.5);
  noteBox(slide, 5.85, "Conseil : intégrer ce tableau dans le rapport mensuel de l'antenne et dans la revue provinciale PEV.", 0.85);
}

function conclusionSlide(deck: Deck, sup: SupervisionBundle, cqd: CqdBundle, lvl: "zs" | "as", word: string) {
  const slide = contentSlide(deck, "Conclusion", `Priorités de mise en œuvre et de suivi — ${word}`);
  const s = sup.levels[lvl];
  const c = cqd.levels[lvl];
  kpiStrip(slide, 1.2, [
    { value: pctStr(s.score.moyen), label: "Score global supervision", accent: scoreColor(s.score.moyen) },
    { value: pctStr(c.concordanceP3.taux), label: "Concordance PENTA3", accent: classColor(c.concordanceP3.classe) },
    { value: pctStr(c.erreurSnisDhis2), label: "Erreur transcription", accent: RED },
    { value: pctStr(c.enfants.tauxRecuperes), label: "Enfants récupérés", accent: GREEN },
  ], 1.25);
  slide.addText(
    [
      { text: "Analyser conjointement la performance PEV et la qualité des données : une structure performante doit aussi produire des données fiables.", options: { bullet: true, paraSpaceAfter: 8 } },
      { text: "Priorités immédiates : correction des écarts DHIS2/SNIS/registre, suivi des recommandations, actualisation des microplans et récupération active des enfants manqués.", options: { bullet: true, paraSpaceAfter: 8 } },
      { text: "Renforcer la supervision formative, les revues de monitorage et l'utilisation régulière des tableaux de bord pour la prise de décision.", options: { bullet: true, paraSpaceAfter: 8 } },
      { text: "Produire des rapports consolidés par structure, par Antenne et au niveau provincial à chaque période de reporting.", options: { bullet: true } },
    ],
    { x: 0.5, y: 2.9, w: 12.3, h: 3.5, fontSize: 13, color: "333333", valign: "top" }
  );
}

/* ============================ RAPPORT 1 : Supervision + CQD ZS (23 diapositives) ============================ */

export async function buildZsReport(sup: SupervisionBundle, cqd: CqdBundle): Promise<Buffer> {
  const deck = newDeck();
  const zs = sup.levels.zs;
  const cqdZs = cqd.levels.zs;
  const ant = sup.levels.antenne;
  const period = periodLabel(sup.meta.months);

  // 1. Page de garde
  coverSlide(
    deck,
    "Rapport automatisé des résultats de supervision PEV et du contrôle qualité des données",
    `Province : Tshuapa  ·  Niveau Zones de Santé  ·  Période : ${period}`,
    "Modèle généré automatiquement à partir des exports ODK/Kobo/Excel des formulaires supervision PEV ZS et contrôle qualité des données.",
    [
      { value: numStr(zs.perStructure.length), label: "ZS supervisées", accent: BLUE },
      { value: numStr(cqdZs.structuresControlees), label: "AS/ESS vérifiées (CQD)", accent: ORANGE },
      { value: pctStr(zs.score.moyen), label: "Score global supervision", accent: GREEN },
      { value: pctStr(cqdZs.concordanceP3.taux), label: "Concordance PENTA3", accent: BLUE },
    ]
  );

  // 2. Résumé exécutif
  execSummarySlide(deck, sup, cqd, "zs", "Zones de Santé");

  // 3. Couverture de la supervision
  {
    const slide = contentSlide(deck, "Couverture de la supervision", "Étendue de la supervision par antenne, ZS et AS/ESS");
    kpiStrip(slide, 1.2, [
      { value: numStr(zs.perStructure.length), label: "ZS supervisées", accent: BLUE },
      { value: numStr(cqdZs.records), label: "AS/ESS contrôlées (CQD)", accent: ORANGE },
      { value: pctStr(zs.score.moyen), label: "Score moyen ZS", accent: GREEN },
      { value: numStr(ant.perStructure.length), label: "Antennes couvertes", accent: BLUE },
    ], 1.25);
    const top = zs.perStructure.slice(0, 12);
    barChart(slide, 0.4, 2.7, 12.5, 3.0, top.map((x) => x.name), top.map((x) => x.count), { title: "Supervisions par ZS", color: BLUE, max: Math.max(5, ...top.map((x) => x.count)) });
    noteBox(slide, 5.95, "Afficher le nombre / % d'AS-ESS supervisées par ZS et le taux de réalisation par rapport au plan de supervision.", 0.9);
  }

  // 4. Score global par ZS
  scoreByStructureSlide(deck, zs.perStructure, "Score global de performance par Zone de Santé", "Zones de Santé");

  // 5. Performance par composante
  composanteSlide(deck, zs.composantes, "Performance par composante de supervision");

  // 6. Analyse détaillée planification (réponses par composante)
  composanteAnswersSlide(deck, zs, "Analyse détaillée — planification et gestion des ressources", "Répartition Oui / Partiel / Non par composante (checklist ZS)");

  // 7. Chaîne du froid (composante planification/CDF)
  {
    const slide = contentSlide(deck, "Chaîne du froid et gestion des vaccins", "Conformité logistique et disponibilité des intrants");
    const comp = zs.composantes.find((c) => c.short.toLowerCase().includes("planif")) ?? zs.composantes[0];
    kpiStrip(slide, 1.2, [
      { value: pctStr(comp?.score ?? null), label: "Score planification & ressources", accent: scoreColor(comp?.score ?? null) },
      { value: pctStr(zs.score.moyen), label: "Score global ZS", accent: GREEN },
      { value: numStr(zs.records), label: "Supervisions réalisées", accent: BLUE },
    ], 1.25);
    const top = zs.perStructure.slice(0, 10);
    barChart(slide, 0.4, 2.7, 12.5, 3.0, top.map((x) => x.name), top.map((x) => x.score), { title: "Score global par ZS", color: BLUE });
    noteBox(slide, 5.95, "Conformité chaîne du froid : inventaire CDF à jour, relevés de température 2×/jour, Fridge-tag, disponibilité vaccins/seringues, application FEFO/PEPS.", 0.9);
  }

  // 8. Atteinte des populations cibles et récupération des enfants
  {
    const slide = contentSlide(deck, "Atteinte des populations cibles et récupération des enfants", "Suivi du funnel des enfants manqués (formulaire CQD)");
    const e = cqdZs.enfants;
    table(slide, 0.4, 1.3, 8.0, ["Étape du funnel", "Nombre", "Taux"], [
      ["Enfants à récupérer", numStr(e.aRecuperer), "—"],
      ["Identifiés précédemment", numStr(e.identifies), "100%"],
      ["Retrouvés par les relais", numStr(e.retrouves), e.identifies ? pctStr((e.retrouves / e.identifies) * 100) : "—"],
      ["Effectivement récupérés", numStr(e.recuperes), pctStr(e.tauxRecuperes)],
    ], [4.0, 2.0, 2.0], 10);
    barChart(slide, 8.6, 1.3, 4.3, 4.0, ["Identifiés", "Retrouvés", "Récupérés"], [e.identifies, e.retrouves, e.recuperes], { title: "Funnel enfants", color: GREEN, max: Math.max(1, e.identifies) });
    noteBox(slide, 5.6, "Indicateurs automatiques : nombre d'enfants à récupérer, retrouvés par les relais et effectivement récupérés ; taux de récupération final.", 0.9);
  }

  // 9. Supervision formative et suivi des recommandations
  {
    const slide = contentSlide(deck, "Supervision formative et suivi des recommandations", "Transformation des constats en décisions et actions suivies");
    const comp = zs.composantes.find((c) => c.short.toLowerCase().includes("superv")) ?? null;
    kpiStrip(slide, 1.2, [
      { value: pctStr(comp?.score ?? null), label: "Score supervision formative", accent: scoreColor(comp?.score ?? null) },
      { value: numStr(zs.records), label: "Supervisions réalisées", accent: BLUE },
      { value: numStr(zs.perStructure.length), label: "ZS suivies", accent: ORANGE },
    ], 1.25);
    const top = zs.perStructure.slice(0, 10);
    barChart(slide, 0.4, 2.7, 12.5, 3.0, top.map((x) => x.name), top.map((x) => x.score), { title: "Score supervision par ZS", color: BLUE });
    noteBox(slide, 5.95, "Alerte : les recommandations non exécutées au-delà de l'échéance doivent être signalées à l'Antenne et au niveau provincial.", 0.9);
  }

  // 10. Monitorage pour action
  {
    const slide = contentSlide(deck, "Monitorage pour action et utilisation des données", "Passer de la donnée collectée à la décision opérationnelle");
    const comp = zs.composantes.find((c) => c.short.toLowerCase().includes("monitor")) ?? null;
    kpiStrip(slide, 1.2, [
      { value: pctStr(comp?.score ?? null), label: "Score monitorage", accent: scoreColor(comp?.score ?? null) },
      { value: pctStr(cqdZs.concordanceP3.taux), label: "Concordance PENTA3", accent: classColor(cqdZs.concordanceP3.classe) },
      { value: pctStr(cqdZs.erreurSnisDhis2), label: "Erreur transcription", accent: RED },
    ], 1.25);
    bulletPanels(slide, 2.7, 3.0, [
      { heading: "Décisions attendues", color: BLUE, items: [
        "Identifier les AS faibles et planifier des sorties avancées.",
        "Corriger les données aberrantes avant validation DHIS2.",
        "Suivre les enfants manqués et les recommandations en réunion mensuelle.",
        "Produire une décision opérationnelle documentée après analyse.",
      ]},
    ]);
  }

  // 11. Engagement communautaire et surveillance
  {
    const slide = contentSlide(deck, "Engagement communautaire et surveillance épidémiologique", "Deux piliers essentiels pour la couverture et la détection");
    const eng = zs.composantes.find((c) => c.short.toLowerCase().includes("comm")) ?? null;
    const surv = zs.composantes.find((c) => c.short.toLowerCase().includes("surv")) ?? null;
    barChart(slide, 0.4, 1.25, 12.5, 4.0, ["Engagement communautaire", "Surveillance épidémiologique"], [eng?.score ?? null, surv?.score ?? null], { title: "Score moyen", color: BLUE });
    noteBox(slide, 5.45, "Lecture croisée : une faible mobilisation communautaire peut expliquer les enfants manqués, tandis qu'une surveillance faible peut masquer les flambées et retarder la réponse.", 1.0);
  }

  // 12. Qualité des outils de collecte
  cqdToolsSlide(deck, cqdZs, "Zones de Santé");

  // 13. Concordance PENTA3
  cqdConcordanceP3Slide(deck, cqdZs, "Zones de Santé", "SNIS / Registre");

  // 14. Concordance RR2
  cqdConcordanceRr2Slide(deck, cqdZs, "Zones de Santé", "SNIS / Registre");

  // 15. Erreurs de transcription
  cqdErrorsSlide(deck, cqdZs, "Zones de Santé");

  // 16. Comparaison des sources
  cqdSourcesSlide(deck, cqdZs, "Zones de Santé");

  // 17. Classement qualité
  cqdCompositeSlide(deck, cqdZs, "Zones de Santé");

  // 18. Croisement supervision + qualité
  crossSlide(deck, "ZS");

  // 19. Goulots
  bottlenecksSlide(deck, sup, cqd, "zs", "Zones de Santé");

  // 20. Actions correctrices
  actionsSlide(deck);

  // 21. Recommandations stratégiques
  strategicRecoSlide(deck);

  // 22. Plan de suivi
  followUpSlide(deck);

  // 23. Conclusion
  conclusionSlide(deck, sup, cqd, "zs", "Zones de Santé");

  return (await deck.pptx.write({ outputType: "nodebuffer" })) as Buffer;
}

/* ============================ RAPPORT 2 : Supervision + CQD Centres de Santé (26 diapositives) ============================ */

export async function buildCsReport(sup: SupervisionBundle, cqd: CqdBundle): Promise<Buffer> {
  const deck = newDeck();
  const as = sup.levels.as;
  const cqdAs = cqd.levels.as;
  const period = periodLabel(sup.meta.months);

  // 1. Page de garde
  coverSlide(
    deck,
    "Rapport automatisé — Supervision PEV des Centres de Santé & Contrôle qualité des données",
    `Province : Tshuapa  ·  Niveau Centres de Santé  ·  Période : ${period}`,
    "Source : données ODK/Kobo exportées depuis la checklist CS et le formulaire de contrôle qualité.",
    [
      { value: numStr(as.perStructure.length), label: "CS supervisés", accent: BLUE },
      { value: pctStr(as.score.moyen), label: "Score moyen supervision", accent: GREEN },
      { value: pctStr(cqdAs.concordanceP3.taux), label: "Concordance PENTA3", accent: BLUE },
      { value: pctStr(cqdAs.enfants.tauxRecuperes), label: "Enfants récupérés", accent: ORANGE },
    ]
  );

  // 2. Résumé exécutif
  execSummarySlide(deck, sup, cqd, "as", "Centres de Santé");

  // 3. Méthode de génération automatique
  {
    const slide = contentSlide(deck, "Méthode de génération automatique", "De la collecte ODK/Kobo au rapport PowerPoint consolidé");
    const steps = ["1. Collecte\nChecklist CS + CQD", "2. Export\nExcel/CSV Kobo/ODK", "3. Calculs\nscores, concordances, erreurs", "4. Classement\nCS faibles/moyens/bons", "5. Rapport\ngraphiques + actions"];
    const w = 2.35, gap = 0.18;
    steps.forEach((s, i) => {
      const x = 0.4 + i * (w + gap);
      slide.addShape("roundRect", { x, y: 1.4, w, h: 1.5, rectRadius: 0.06, fill: { color: LIGHT }, line: { color: BLUE, width: 1 } });
      slide.addText(s, { x: x + 0.1, y: 1.5, w: w - 0.2, h: 1.3, fontSize: 11, color: NAVY, align: "center", valign: "middle", bold: true });
      if (i < steps.length - 1) slide.addText("→", { x: x + w - 0.02, y: 1.4, w: gap + 0.05, h: 1.5, fontSize: 16, color: BLUE, align: "center", valign: "middle" });
    });
    bulletPanels(slide, 3.3, 2.8, [
      { heading: "Checklist supervision PEV CS", color: BLUE, items: ["Planification, chaîne du froid, vaccins, déchets", "Prestation, supervision formative, monitorage", "Engagement communautaire et surveillance"] },
      { heading: "Contrôle qualité des données", color: GREEN, items: ["Registre, feuilles de pointage, canevas SNIS, DHIS2", "Concordance PENTA3 / RR2", "Erreurs de transcription ; enfants à récupérer"] },
    ]);
    noteBox(slide, 6.3, "Champs dynamiques : [Province], [Antenne], [ZS], [AS], [ESS], [Période], [Superviseur], [Date].", 0.7);
  }

  // 4. Couverture de la supervision CS
  {
    const slide = contentSlide(deck, "Couverture de la supervision des Centres de Santé", "Étendue des visites et vérifications réalisées");
    kpiStrip(slide, 1.2, [
      { value: numStr(as.perStructure.length), label: "CS supervisés", accent: BLUE },
      { value: numStr(as.records), label: "Supervisions réalisées", accent: ORANGE },
      { value: pctStr(as.score.moyen), label: "Score moyen", accent: GREEN },
      { value: numStr(as.perStructure.filter((x) => (x.score ?? 0) >= 80).length), label: "CS ≥ 80%", accent: BLUE },
    ], 1.25);
    const top = as.perStructure.slice(0, 12);
    barChart(slide, 0.4, 2.7, 12.5, 3.0, top.map((x) => x.name), top.map((x) => x.count), { title: "Supervisions par CS", color: BLUE, max: Math.max(5, ...top.map((x) => x.count)) });
    noteBox(slide, 5.95, "Afficher le nombre de CS contrôlés par ZS/AS, le taux de réalisation vs plan, et mettre en évidence les CS non visités.", 0.9);
  }

  // 5. Cadre de scoring de la checklist CS
  {
    const slide = contentSlide(deck, "Cadre de scoring de la checklist CS", "Conversion des réponses oui / partiellement / non en score standardisé");
    table(slide, 0.4, 1.3, 6.1, ["Réponse", "Valeur", "Interprétation"], [
      ["Oui", "1 (ou 3/2 selon section)", "Critère rempli"],
      ["Partiellement", "0,5 (moitié de la pondération)", "Partiellement rempli"],
      ["Non", "0 point", "Critère non rempli"],
    ], [1.6, 2.3, 2.2], 9.5);
    table(slide, 6.8, 1.3, 6.1, ["Score global", "Appréciation", "Couleur"], [
      ["≥ 80 %", "Très bon", "Vert"],
      ["70–79 %", "Bon", "Bleu/vert"],
      ["60–69 %", "Moyen", "Jaune"],
      ["< 60 %", "Faible", "Rouge"],
    ], [2.0, 2.4, 1.7], 9.5);
    noteBox(slide, 4.4, "Score CS = somme des points obtenus / somme des points attendus × 100. Les sections dont certaines questions valent 2 ou 3 points conservent la pondération de la checklist.", 1.0);
  }

  // 6. Score global par CS
  scoreByStructureSlide(deck, as.perStructure, "Score global de performance par Centre de Santé", "Centres de Santé");

  // 7. Performance moyenne par composante
  composanteSlide(deck, as.composantes, "Performance moyenne par composante");

  // 8. Planification et gestion au niveau du CS
  composanteAnswersSlide(deck, as, "Planification et gestion au niveau du CS", "Microplan, ressources et réalisation des activités (réponses par composante)");

  // 9. Chaîne du froid et gestion des vaccins
  {
    const slide = contentSlide(deck, "Chaîne du froid et gestion des vaccins", "Disponibilité, température, stocks et règles de conservation");
    const comp = as.composantes.find((c) => c.short.toLowerCase().includes("planif")) ?? as.composantes[0];
    kpiStrip(slide, 1.2, [
      { value: pctStr(comp?.score ?? null), label: "Score planification & ressources", accent: scoreColor(comp?.score ?? null) },
      { value: pctStr(as.score.moyen), label: "Score global CS", accent: GREEN },
      { value: numStr(as.records), label: "Supervisions réalisées", accent: BLUE },
    ], 1.25);
    const top = as.perStructure.slice(0, 10);
    barChart(slide, 0.4, 2.7, 12.5, 3.0, top.map((x) => x.name), top.map((x) => x.score), { title: "Score global par CS", color: BLUE });
    noteBox(slide, 5.95, "Sortie attendue : tableau des CS avec ruptures, écarts de stock, températures hors norme ou Fridge-tag non fonctionnel. Action type : recompter stocks, appliquer FEFO/PEPS.", 0.9);
  }

  // 10. Sécurité des injections et gestion des déchets
  {
    const slide = contentSlide(deck, "Sécurité des injections et gestion des déchets", "Conformité aux normes de sécurité et d'élimination");
    const comp = as.composantes.find((c) => c.short.toLowerCase().includes("planif")) ?? as.composantes[0];
    barChart(slide, 0.4, 1.25, 12.5, 3.9, ["Sécurité injections & déchets", "Score global CS"], [comp?.score ?? null, as.score.moyen], { title: "Score moyen", color: BLUE });
    noteBox(slide, 5.35, "Indicateurs : % CS disposant de SAB et boîtes de sécurité ; respect de la non-recapuchonnage. Toute absence de boîte de sécurité ou recapuchonnage observé génère une action corrective immédiate.", 1.2);
  }

  // 11. Prestation de services de vaccination
  {
    const slide = contentSlide(deck, "Prestation de services de vaccination", "Sessions fixes, avancées, spéciales et rattrapage des enfants");
    const comp = as.composantes.find((c) => c.short.toLowerCase().includes("prestation")) ?? null;
    kpiStrip(slide, 1.2, [
      { value: pctStr(comp?.score ?? null), label: "Score prestation de services", accent: scoreColor(comp?.score ?? null) },
      { value: pctStr(cqdAs.enfants.tauxRecuperes), label: "Enfants récupérés", accent: GREEN },
      { value: numStr(as.perStructure.length), label: "CS évalués", accent: BLUE },
    ], 1.25);
    noteBox(slide, 2.75, "Dimensions suivies : programme mensuel disponible/affiché, stratégies fixes / avancées / spéciales (% réalisées vs planifiées ≥ 80%), identification ZD/SV, rattrapage des enfants identifiés, OMV, conformité des séances.", 1.3);
    noteBox(slide, 4.25, "Lecture automatique : des stratégies avancées/spéciales < 80% indiquent un risque de persistance des enfants manqués.", 0.9);
  }

  // 12. Identification et récupération des enfants manqués
  {
    const slide = contentSlide(deck, "Identification et récupération des enfants manqués", "Suivi des enfants zéro-dose et sous-vaccinés au niveau CS/communauté");
    const e = cqdAs.enfants;
    table(slide, 0.4, 1.3, 8.0, ["Indicateur", "Valeur", "Taux"], [
      ["Enfants à récupérer", numStr(e.aRecuperer), "—"],
      ["Identifiés précédemment", numStr(e.identifies), "100%"],
      ["Retrouvés par les relais", numStr(e.retrouves), e.identifies ? pctStr((e.retrouves / e.identifies) * 100) : "—"],
      ["Effectivement récupérés", numStr(e.recuperes), pctStr(e.tauxRecuperes)],
    ], [4.0, 2.0, 2.0], 10);
    barChart(slide, 8.6, 1.3, 4.3, 4.0, ["Identifiés", "Retrouvés", "Récupérés"], [e.identifies, e.retrouves, e.recuperes], { title: "Funnel rattrapage", color: GREEN, max: Math.max(1, e.identifies) });
    noteBox(slide, 5.6, "Inclure la photo de la fiche d'identification lorsque disponible dans ODK/Kobo. Source : formulaire CQD, suivi relais et registre / fiche de récupération.", 0.9);
  }

  // 13. Supervision formative et suivi des recommandations
  {
    const slide = contentSlide(deck, "Supervision formative et suivi des recommandations", "Supervision des relais, sessions et feedback du BCZ");
    const comp = as.composantes.find((c) => c.short.toLowerCase().includes("superv")) ?? null;
    kpiStrip(slide, 1.2, [
      { value: pctStr(comp?.score ?? null), label: "Score supervision formative", accent: scoreColor(comp?.score ?? null) },
      { value: numStr(as.records), label: "Supervisions réalisées", accent: BLUE },
      { value: numStr(as.perStructure.length), label: "CS suivis", accent: ORANGE },
    ], 1.25);
    const top = as.perStructure.slice(0, 10);
    barChart(slide, 0.4, 2.7, 12.5, 3.0, top.map((x) => x.name), top.map((x) => x.score), { title: "Score par CS", color: BLUE });
    noteBox(slide, 5.95, "Règle automatique : un taux d'exécution des recommandations < 80% doit être classé comme goulot prioritaire (renseigner motif, responsable et échéance).", 0.9);
  }

  // 14. Monitorage des données au CS
  {
    const slide = contentSlide(deck, "Monitorage des données au Centre de Santé", "Disponibilité des outils, analyse et utilisation des données");
    const comp = as.composantes.find((c) => c.short.toLowerCase().includes("monitor")) ?? null;
    kpiStrip(slide, 1.2, [
      { value: pctStr(comp?.score ?? null), label: "Score monitorage", accent: scoreColor(comp?.score ?? null) },
      { value: pctStr(cqdAs.outils.snis), label: "Canevas SNIS correct", accent: BLUE },
      { value: pctStr(cqdAs.erreurSnisDhis2), label: "Erreur transcription", accent: RED },
    ], 1.25);
    noteBox(slide, 2.75, "Le monitorage doit transformer les données en décisions : identifier les CS/AS faibles, programmer des sorties avancées et corriger les données aberrantes.", 1.1);
    noteBox(slide, 4.05, "Alerte : courbes non à jour + absence de réunion = faible utilisation des données pour action. Sortie : liste des CS sans feedback de la ZS ou avec rapports en retard.", 1.1);
  }

  // 15. Engagement communautaire
  {
    const slide = contentSlide(deck, "Engagement communautaire", "CODESA, CAC, leaders, relais et barrières de genre");
    const comp = as.composantes.find((c) => c.short.toLowerCase().includes("comm")) ?? null;
    barChart(slide, 0.4, 1.25, 12.5, 3.9, ["Engagement communautaire"], [comp?.score ?? null], { title: "Score moyen", color: BLUE });
    noteBox(slide, 5.35, "Décision : prioriser les CS où CAC/CODESA sont non fonctionnels et où les causes de non-vaccination ne sont pas analysées. Documenter réunions, rapports, contribution au rattrapage et obstacles de genre.", 1.2);
  }

  // 16. Surveillance épidémiologique au niveau CS
  {
    const slide = contentSlide(deck, "Surveillance épidémiologique au niveau CS", "Notification, investigation, riposte, REH et MAPI");
    const comp = as.composantes.find((c) => c.short.toLowerCase().includes("surv")) ?? null;
    barChart(slide, 0.4, 1.25, 12.5, 3.9, ["Surveillance épidémiologique"], [comp?.score ?? null], { title: "Score moyen", color: BLUE });
    noteBox(slide, 5.35, "Alerte automatique : absence de notification MPV/MAPI sur 6 mois = vérifier la sensibilité du système. Suivre définitions de cas, kits, investigations à temps, REH transmis, concordance REH/registre.", 1.2);
  }

  // 17. Qualité des outils de collecte
  cqdToolsSlide(deck, cqdAs, "Centres de Santé");

  // 18. Concordance DHIS2 / Registre (PENTA3)
  cqdConcordanceP3Slide(deck, cqdAs, "Centres de Santé", "Registre");

  // 19. Erreurs de transcription
  cqdErrorsSlide(deck, cqdAs, "Centres de Santé");

  // 20. Comparaison des sources
  cqdSourcesSlide(deck, cqdAs, "Centres de Santé");

  // 21. Score composite de qualité
  cqdCompositeSlide(deck, cqdAs, "Centres de Santé");

  // 22. Croisement supervision CS + qualité
  crossSlide(deck, "CS");

  // 23. Goulots
  bottlenecksSlide(deck, sup, cqd, "as", "Centres de Santé");

  // 24. Actions correctrices
  actionsSlide(deck);

  // 25. Plan de suivi
  followUpSlide(deck);

  // 26. Conclusion
  conclusionSlide(deck, sup, cqd, "as", "Centres de Santé");

  return (await deck.pptx.write({ outputType: "nodebuffer" })) as Buffer;
}

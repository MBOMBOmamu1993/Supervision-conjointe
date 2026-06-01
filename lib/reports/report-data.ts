/* =========================================================================
   report-data.ts — Contenu diapo-par-diapo des 2 rapports automatisés
   (portage fidèle de design_reference/assets/data-zs.js & data-cs.js).

   RAPPORT 1 — Zones de santé (23 diapos)
   RAPPORT 2 — Centres de santé (26 diapos)

   Province de la Tshuapa · Antennes Boende & Bokungu.
   Données réelles CQD (ZS Bokungu ; AS Lofima 2, Jan–Mars 2026) + valeurs
   représentatives pour les unités non encore contrôlées (CQD = 1 soumission).
   Les commentaires « LECTURE PEV » sont rédigés en lecture d'expert et
   réinjectent les valeurs calculées (cf. §5 de la spec).
   ========================================================================= */

/* ----------------------------- Palette PEV/OMS ---------------------------- */
export const PAL = {
  marine: "00205c",
  marine2: "013a86",
  cyan: "0093d5",
  vert: "1f9d57",
  bleu: "0093d5",
  jaune: "f59e0b",
  rouge: "e23636",
  bordeaux: "7b2d3a",
  gris: "94a3b8",
  grisClair: "e2e8f0",
  ink: "16243d",
  muted: "5b6b86",
  line: "e3e9f2",
  soft: "f4f7fb",
  white: "FFFFFF",
  amberText: "b06f00",
} as const;

/** Couleur d'un score selon les seuils d'appréciation PEV. */
export const scoreColor = (v: number): string =>
  v >= 80 ? PAL.vert : v >= 70 ? PAL.bleu : v >= 60 ? PAL.jaune : PAL.rouge;

/** Couleur d'un taux de concordance (95–105 = concordant). */
export const concColor = (v: number): string =>
  v >= 95 && v <= 105 ? PAL.vert : v < 95 ? PAL.jaune : PAL.rouge;

/* --------------------------------- Types ---------------------------------- */
export type Tone = "blue" | "red" | "green" | "amber";
export type NoteKind = "read" | "warn" | "alert";
export type PillTone = "green" | "amber" | "red" | "blue";

export interface Pill {
  pill: true;
  t: string;
  c: PillTone;
}
export type Cell = string | Pill;
export interface Row {
  cells: Cell[];
  total?: boolean;
}
export interface Table {
  cols: string[];
  rows: Row[];
}
export interface Kpi {
  v: string;
  l: string;
  s?: string;
  tone?: Tone;
}
export interface Bar {
  l: string;
  v: number;
  l2?: string;
  c?: string;
}
export interface Series {
  name: string;
  color: string;
  values: number[];
}
export interface Grouped {
  cats: string[];
  series: Series[];
}
export type ColorToken = "score" | "conc" | "cyan";
export interface ChartOpt {
  max?: number;
  unit?: string;
  colorFn?: ColorToken;
}
export type SideBlock =
  | { kind: "table"; table: Table }
  | { kind: "kpis"; items: Kpi[] }
  | { kind: "legend"; h: string; p: string };

export interface Slide {
  type:
    | "cover"
    | "exec"
    | "barSide"
    | "bigBar"
    | "table"
    | "tableBar"
    | "gauges"
    | "hbarList"
    | "funnel"
    | "matrix"
    | "process"
    | "conclusion";
  tag?: string;
  title: string;
  sub?: string;
  no?: string;
  /* cover */
  kicker?: string;
  meta?: string[];
  kpis?: Kpi[];
  src?: string;
  /* exec */
  message?: string;
  cols?: { h: string; items: string[] }[];
  lead?: string;
  /* charts */
  chartTitle?: string;
  bars?: Bar[];
  grouped?: Grouped;
  chartOpt?: ChartOpt;
  /* barSide / tableBar */
  side?: SideBlock[];
  tableTitle?: string;
  tableCols?: string[];
  tableRows?: Row[];
  /* table */
  cols2?: string[];
  rows?: Row[];
  extra?: { tables?: Table[]; legend?: { h: string; p: string } };
  /* gauges */
  gauges?: { v: number; l: string; fn?: ColorToken }[];
  /* hbarList */
  lists?: { h: string; data: Bar[]; opt?: { colorFn?: ColorToken; max?: number } }[];
  /* funnel */
  fSteps?: { l: string; v: string; c?: string }[];
  fTable?: Table;
  /* matrix */
  cells?: { h: string; p: string; act: string; color: string }[];
  /* process */
  pSteps?: { h: string; p: string }[];
  sources?: { h: string; p: string }[];
  /* conclusion */
  points?: string[];
  outputs?: { h: string; cols: string[]; rows: Row[] };
  /* note */
  note?: string;
  noteKind?: NoteKind;
}

export interface Deck {
  period: string;
  gen: string;
  footer: string;
  fileLabel: string;
  slides: Slide[];
}

/* ------------------------------- Raccourcis ------------------------------- */
const pill = (t: string, c: PillTone): Pill => ({ pill: true, t, c });
const row = (...cells: Cell[]): Row => ({ cells });
const totalRow = (...cells: Cell[]): Row => ({ cells, total: true });
const P = PAL;
const cc = concColor;

/* ========================================================================= */
/*                     RAPPORT 1 — ZONES DE SANTÉ (23)                       */
/* ========================================================================= */

interface ZsRef {
  n: string;
  ant: string;
  score: number;
  conc3: number;
  conc3c: string;
  concRR2: number;
  err: number;
  qual: number;
  reel?: boolean;
}
const ZS: ZsRef[] = [
  { n: "Bokungu", ant: "Bokungu", score: 74, conc3: 89.7, conc3c: "Sous-rapportage", concRR2: 85.1, err: 55.6, qual: 60, reel: true },
  { n: "Boende", ant: "Boende", score: 81, conc3: 97, conc3c: "Concordant", concRR2: 96, err: 18, qual: 84 },
  { n: "Djolu", ant: "Boende", score: 66, conc3: 92, conc3c: "Sous-rapportage", concRR2: 90, err: 31, qual: 61 },
  { n: "Befale", ant: "Boende", score: 58, conc3: 112, conc3c: "Sur-rapportage", concRR2: 108, err: 42, qual: 45 },
  { n: "Ikela", ant: "Bokungu", score: 72, conc3: 96, conc3c: "Concordant", concRR2: 99, err: 24, qual: 73 },
  { n: "Monkoto", ant: "Boende", score: 62, conc3: 88, conc3c: "Sous-rapportage", concRR2: 86, err: 38, qual: 55 },
];

const ZS_SLIDES: Slide[] = [
  /* 01 — Couverture */
  {
    type: "cover",
    tag: "Couverture",
    kicker: "RAPPORT AUTOMATISÉ · PEV & CQD",
    title: "Supervision PEV et contrôle qualité des données — Zones de santé",
    meta: ["Province : Tshuapa  ·  Antennes : Boende & Bokungu", "Période : Janvier – Mars 2026  ·  12 ZS prévues"],
    kpis: [
      { v: "1 / 12", l: "ZS contrôlées" },
      { v: "3", l: "AS/ESS vérifiées" },
      { v: "74 %", l: "Score supervision" },
      { v: "89,7 %", l: "Concordance PENTA3" },
    ],
    src: "Source : exports ODK / Kobo (checklist supervision ZS + contrôle qualité) · Généré automatiquement",
  },

  /* 02 — Résumé exécutif */
  {
    type: "exec",
    tag: "Synthèse",
    title: "Résumé exécutif",
    sub: "Lecture rapide de la situation PEV et de la qualité des données",
    kpis: [
      { v: "1", l: "ZS supervisées", s: "sur 12 prévues", tone: "blue" },
      { v: "3", l: "AS/ESS contrôlées", s: "Bonkone · Buluku · Ikengolaka 2", tone: "blue" },
      { v: "74 %", l: "Score moyen supervision", s: "toutes composantes", tone: "amber" },
      { v: "0", l: "ZS ≥ 80 %", s: "aucune sur la période", tone: "red" },
      { v: "89,7 %", l: "Concordance PENTA3", s: "DHIS2 / SNIS", tone: "amber" },
      { v: "85,1 %", l: "Concordance RR2", s: "DHIS2 / SNIS", tone: "amber" },
      { v: "55,6 %", l: "Erreur transcription", s: "SNIS → DHIS2", tone: "red" },
      { v: "21 / 29", l: "Enfants récupérés", s: "72 % des identifiés", tone: "green" },
    ],
    message:
      "La supervision n'a couvert qu'1 ZS sur 12 (Bokungu) au premier trimestre : la priorité absolue est d'étendre la couverture. Sur la ZS contrôlée, le niveau de performance est moyen (74 %). Le CQD révèle un sous-rapportage marqué (PENTA3 89,7 %, RR2 85,1 %) et surtout un taux d'erreur de transcription SNIS→DHIS2 de 55,6 %, anormalement élevé : la fiabilité des données DHIS2 de Bokungu n'est pas acquise et appelle une mission DQS ciblée.",
    noteKind: "alert",
    cols: [
      { h: "Forces", items: ["Récupération des enfants manqués engagée (72 %)", "Canevas SNIS correctement renseigné", "Supervision documentée par la ZS"] },
      { h: "Goulots", items: ["Erreur de transcription SNIS→DHIS2 (55,6 %)", "Sous-rapportage PENTA3 & RR2", "Couverture de supervision très faible (1/12)"] },
      { h: "Priorités immédiates", items: ["Recompter & corriger DHIS2 (Bokungu)", "Programmer la supervision des 11 ZS restantes", "Suivre les recommandations & enfants manqués"] },
    ],
  },

  /* 03 — Couverture de la supervision */
  {
    type: "barSide",
    tag: "Couverture",
    title: "Couverture de la supervision",
    sub: "Étendue par antenne, ZS et AS/ESS",
    chartTitle: "AS/ESS vérifiées par ZS contrôlée",
    bars: [
      { l: "Bokungu", v: 3 },
      { l: "Boende", v: 0 },
      { l: "Djolu", v: 0 },
      { l: "Befale", v: 0 },
      { l: "Ikela", v: 0 },
      { l: "Monkoto", v: 0 },
    ],
    chartOpt: { max: 6, colorFn: "cyan" },
    side: [
      {
        kind: "table",
        table: {
          cols: ["Antenne", "ZS prévues", "ZS sup.", "% réal."],
          rows: [row("Boende", "7", "0", "0 %"), row("Bokungu", "5", "1", "20 %"), totalRow("Total", "12", "1", "8 %")],
        },
      },
      { kind: "kpis", items: [{ v: "8 %", l: "Réalisation ZS", s: "1 / 12 prévues", tone: "red" }] },
    ],
    note: "Avec 8 % de réalisation, la supervision conjointe au niveau ZS est très en deçà de la norme (4 ZS/mois). Seule l'antenne Bokungu a réalisé une mission (ZS Bokungu, 3 AS vérifiées). Aucune ZS de l'antenne Boende n'a été supervisée : à inscrire en priorité au plan du prochain trimestre.",
  },

  /* 04 — Score global par ZS */
  {
    type: "barSide",
    tag: "Performance",
    title: "Score global de performance par Zone de Santé",
    sub: "Classement du meilleur au plus faible score",
    chartTitle: "Scores globaux de supervision (%)",
    bars: [...ZS].sort((a, b) => b.score - a.score).map((z) => ({ l: z.n, v: z.score })),
    chartOpt: { max: 100, colorFn: "score" },
    side: [
      {
        kind: "table",
        table: {
          cols: ["Score", "Appréciation", "Action"],
          rows: [
            row(pill("≥ 80 %", "green"), "Très bon", "Maintenir / documenter"),
            row(pill("70–79 %", "blue"), "Bon", "Suivi léger"),
            row(pill("60–69 %", "amber"), "Moyen", "Coaching ciblé"),
            row(pill("< 60 %", "red"), "Faible", "Appui rapproché"),
          ],
        },
      },
    ],
    note: "Aucune ZS n'atteint 80 % sur la période. Befale (58 %) est classée prioritaire (appui rapproché) et Monkoto (62 %) en coaching ciblé. Les scores sont calculés à partir des réponses pondérées de la checklist supervision PEV ZS — la base reste fragile (1 ZS réellement contrôlée).",
    noteKind: "warn",
  },

  /* 05 — Performance par composante */
  {
    type: "bigBar",
    tag: "Composantes",
    title: "Performance par composante de supervision",
    sub: "Planification, chaîne du froid, vaccins, monitorage, communauté et surveillance",
    chartTitle: "Score moyen par composante (%)",
    bars: [
      { l: "Planif.", v: 72 },
      { l: "Chaîne froid", v: 64 },
      { l: "Vaccins", v: 70 },
      { l: "Cibles", v: 58 },
      { l: "Superv.", v: 66 },
      { l: "Monitorage", v: 47 },
      { l: "Commun.", v: 55 },
      { l: "Surveill.", v: 76 },
    ],
    chartOpt: { max: 100, colorFn: "score" },
    note: "Forces (Top 3) : surveillance épidémiologique (76 %), planification (72 %), gestion des vaccins (70 %). Goulots (Bottom 3) : monitorage pour action (47 %), atteinte des populations cibles (58 %), engagement communautaire (55 %). Le monitorage en dessous de 50 % doit déclencher automatiquement une recommandation : instaurer une revue mensuelle des données et documenter les décisions.",
  },

  /* 06 — Analyse détaillée planification & ressources */
  {
    type: "barSide",
    tag: "I · Planification",
    title: "Analyse détaillée — planification et gestion des ressources",
    sub: "Sous-composantes à suivre dans la checklist ZS",
    chartTitle: "Score par sous-composante (%)",
    bars: [
      { l: "Planif.", v: 72 },
      { l: "Documents", v: 65 },
      { l: "RH/Fin/Mat", v: 58 },
      { l: "Chaîne froid", v: 62 },
      { l: "Vaccins", v: 70 },
      { l: "Déchets", v: 54 },
    ],
    chartOpt: { max: 100, colorFn: "score" },
    side: [
      {
        kind: "table",
        table: {
          cols: ["Sous-composante", "Gap principal à documenter"],
          rows: [
            row("Planification", "Microplans non actualisés"),
            row("Documents tech.", "Directives IPVS/PEV absentes"),
            row("Chaîne du froid", "Fiches température incomplètes"),
            row("Gestion vaccins", "Stock physique ≠ théorique"),
          ],
        },
      },
    ],
    note: "Les déchets (54 %) et les ressources humaines/financières (58 %) sont les maillons faibles. Règle de gestion : chaque gap critique doit produire une action corrective SMART avec responsable, échéance et statut suivis jusqu'à clôture.",
    noteKind: "warn",
  },

  /* 07 — Chaîne du froid & vaccins */
  {
    type: "barSide",
    tag: "Chaîne du froid",
    title: "Chaîne du froid et gestion des vaccins",
    sub: "Conformité logistique et disponibilité des intrants",
    chartTitle: "Conformité chaîne du froid par ZS (%)",
    bars: [
      { l: "Boende", v: 90 },
      { l: "Ikela", v: 75 },
      { l: "Bokungu", v: 64 },
      { l: "Monkoto", v: 48 },
      { l: "Befale", v: 35 },
    ],
    chartOpt: { max: 100, colorFn: "score" },
    side: [
      { kind: "kpis", items: [{ v: "64 %", l: "Inventaire CDF à jour", tone: "amber" }, { v: "60 %", l: "Température 2×/jour", tone: "amber" }] },
      {
        kind: "table",
        table: {
          cols: ["ZS", "Problème → action"],
          rows: [
            row("Befale", "Températures non relevées → briefing CDF"),
            row("Monkoto", "Stock physique ≠ théorique → recomptage"),
            row("Bokungu", "FEFO non systématique → coaching"),
          ],
        },
      },
    ],
    note: "La conformité chute fortement sur Befale (35 %) et Monkoto (48 %) : risque de rupture vaccinale de la chaîne du froid. Action immédiate : relevé de température 2×/jour, recomptage des stocks et application stricte du FEFO/PEPS.",
    noteKind: "alert",
  },

  /* 08 — Atteinte des populations cibles & récupération */
  {
    type: "tableBar",
    tag: "Populations cibles",
    title: "Atteinte des populations cibles et récupération des enfants",
    sub: "Stratégies vaccinales et suivi des enfants manqués",
    chartTitle: "Réalisation des stratégies (%)",
    grouped: {
      cats: ["Fixe", "Avancée", "Mobile", "Fluviale"],
      series: [
        { name: "Planifié", color: P.gris, values: [100, 100, 100, 100] },
        { name: "Réalisé", color: P.bleu, values: [88, 64, 52, 41] },
      ],
    },
    chartOpt: { max: 120 },
    tableTitle: "Funnel de récupération des enfants",
    tableCols: ["Étape", "Nombre", "Taux"],
    tableRows: [
      row("Enfants identifiés", "29", "—"),
      row("Retrouvés par les relais", "23", "79 %"),
      row("Effectivement récupérés", "21", "72 %"),
      totalRow("Taux de récupération final", "21 / 29", "72 %"),
    ],
    note: "Les stratégies mobile (52 %) et fluviale (41 %) restent très en deçà de 80 % : ce sont les zones difficiles d'accès qui concentrent les enfants manqués. La récupération est encourageante (72 %, 21/29) mais doit être tracée par preuve (registre / fiche).",
  },

  /* 09 — Supervision formative & suivi recommandations */
  {
    type: "barSide",
    tag: "Supervision",
    title: "Supervision formative et suivi des recommandations",
    sub: "Transformation des constats en décisions et actions suivies",
    chartTitle: "Taux d'exécution des recommandations par ZS (%)",
    bars: [
      { l: "Boende", v: 90 },
      { l: "Ikela", v: 72 },
      { l: "Bokungu", v: 55 },
      { l: "Monkoto", v: 40 },
      { l: "Befale", v: 25 },
    ],
    chartOpt: { max: 100, colorFn: "score" },
    side: [
      { kind: "kpis", items: [{ v: "55 %", l: "Recommandations exécutées", tone: "amber" }, { v: "100 %", l: "Checklist standard utilisée", tone: "green" }] },
      {
        kind: "table",
        table: {
          cols: ["ZS", "Total", "Exéc.", "Taux"],
          rows: [row("Bokungu", "11", "6", "55 %"), row("Monkoto", "10", "4", "40 %"), row("Befale", "8", "2", "25 %")],
        },
      },
    ],
    note: "Le suivi des recommandations s'effondre sur Befale (25 %) et Monkoto (40 %). Toute recommandation non exécutée au-delà de l'échéance doit être signalée à l'Antenne et au niveau provincial et faire l'objet d'une responsabilisation nominative.",
    noteKind: "alert",
  },

  /* 10 — Monitorage pour action */
  {
    type: "bigBar",
    tag: "Monitorage",
    title: "Monitorage pour action et utilisation des données",
    sub: "Passer de la donnée collectée à la décision opérationnelle",
    chartTitle: "Indicateurs de monitorage (%)",
    bars: [
      { l: "Rapports à temps", v: 80 },
      { l: "Analyse mensuelle", v: 68 },
      { l: "Indicateurs suivis", v: 72 },
      { l: "Réunions monit.", v: 55 },
      { l: "Dashboards utilisés", v: 47 },
      { l: "AS bonne qualité", v: 60 },
    ],
    chartOpt: { max: 100, colorFn: "score" },
    note: "L'utilisation des tableaux de bord (47 %) et la tenue des réunions de monitorage (55 %) sont les points faibles : les données sont collectées mais peu exploitées pour décider. Recommandation : identifier les AS faibles, corriger les données aberrantes avant validation DHIS2 et documenter une décision opérationnelle après chaque analyse mensuelle.",
  },

  /* 11 — Engagement communautaire & surveillance */
  {
    type: "hbarList",
    tag: "Communauté & Surveillance",
    title: "Engagement communautaire et surveillance épidémiologique",
    sub: "Deux piliers de la couverture et de la détection",
    lists: [
      {
        h: "Engagement communautaire",
        data: [
          { l: "Plan de communication", v: 62 },
          { l: "Leaders engagés", v: 70 },
          { l: "CODESA fonctionnels", v: 55 },
          { l: "CAC fonctionnelles", v: 48 },
          { l: "RC formés & actifs", v: 44 },
        ],
      },
      {
        h: "Surveillance épidémiologique",
        data: [
          { l: "Réunions hebdomadaires", v: 73 },
          { l: "Sites actualisés", v: 66 },
          { l: "Cas investigués < 48h", v: 58 },
          { l: "REH transmis à temps", v: 52 },
          { l: "MAPI notifiées", v: 40 },
        ],
      },
    ],
    note: "Lecture croisée : la faible mobilisation des relais communautaires (44 %) et des CAC (48 %) explique en partie les enfants manqués, tandis que la notification MAPI (40 %) et les REH tardifs (52 %) fragilisent la détection précoce des flambées et la pharmacovigilance vaccinale.",
    noteKind: "warn",
  },

  /* 12 — Qualité des outils de collecte */
  {
    type: "barSide",
    tag: "CQD · Outils",
    title: "Qualité des outils de collecte",
    sub: "Registre, feuilles de pointage, canevas SNIS et DHIS2",
    chartTitle: "Conformité par outil (%)",
    bars: [
      { l: "Registre", v: 58 },
      { l: "Pointage", v: 52 },
      { l: "SNIS", v: 71 },
      { l: "DHIS2", v: 62 },
    ],
    chartOpt: { max: 100, colorFn: "score" },
    side: [
      {
        kind: "table",
        table: {
          cols: ["Problème identifié", "AS/ESS"],
          rows: [
            row("Cellules obligatoires vides", "2"),
            row("Zéros = données manquantes", "1"),
            row("Données aberrantes", "2"),
            row("Incohérences entre antigènes", "1"),
            row("Données non valides", "0"),
          ],
        },
      },
    ],
    note: "Le registre (58 %) et la feuille de pointage (52 %) sont les outils les moins fiables : c'est en amont, à la source, que naissent les erreurs propagées ensuite vers DHIS2. Les critères de bon remplissage doivent être appliqués de façon standardisée par tous les superviseurs.",
    noteKind: "warn",
  },

  /* 13 — Concordance PENTA3 */
  {
    type: "barSide",
    tag: "CQD · PENTA3",
    title: "Concordance PENTA3 — DHIS2 / SNIS",
    sub: "95–105 % concordant · < 95 % sous-rapportage · > 105 % sur-rapportage",
    chartTitle: "Taux de concordance PENTA3 par ZS (%)",
    bars: ZS.map((z) => ({ l: z.n, v: z.conc3, c: cc(z.conc3) })),
    chartOpt: { max: 120, colorFn: "conc" },
    side: [
      {
        kind: "table",
        table: {
          cols: ["Résultat", "Appréc.", "Action"],
          rows: [
            row(pill("95–105 %", "green"), "Concordant", "Valider"),
            row(pill("< 95 %", "amber"), "Sous-rapport.", "Rechercher données manquantes"),
            row(pill("> 105 %", "red"), "Sur-rapport.", "Recompter et corriger"),
          ],
        },
      },
      { kind: "legend", h: "Formule", p: "Concordance = Données DHIS2 / Données source × 100" },
    ],
    note: "Bokungu : 89,7 % → sous-rapportage (DHIS2 166 < SNIS 185 pour PENTA3) : des doses administrées ne remontent pas dans DHIS2. Befale (112 %) sur-rapporte et doit recompter. Les ZS hors de l'intervalle 95–105 % sont listées automatiquement dans les actions correctrices.",
    noteKind: "alert",
  },

  /* 14 — Concordance RR2 */
  {
    type: "tableBar",
    tag: "CQD · RR2",
    title: "Concordance RR2 — DHIS2 / SNIS",
    sub: "Même logique de classification que pour PENTA3",
    chartTitle: "Taux de concordance RR2 (%)",
    bars: ZS.map((z) => ({ l: z.n, v: z.concRR2, c: cc(z.concRR2) })),
    chartOpt: { max: 120, colorFn: "conc" },
    tableTitle: "Détail RR2 par ZS",
    tableCols: ["Zone de Santé", "SNIS", "DHIS2", "Concord.", "Appréciation"],
    tableRows: [
      row("Bokungu", "188", "160", "85,1 %", pill("Sous-rapport.", "amber")),
      row("Boende", "—", "—", "96 %", pill("Concordant", "green")),
      row("Befale", "—", "—", "108 %", pill("Sur-rapport.", "red")),
    ],
    note: "Bokungu confirme le sous-rapportage sur RR2 (85,1 %), cohérent avec le PENTA3 : le problème est systémique (transcription / compilation) et non antigène-spécifique. Prioriser la vérification du flux SNIS→DHIS2 de cette ZS.",
    noteKind: "alert",
  },

  /* 15 — Erreurs de transcription */
  {
    type: "bigBar",
    tag: "CQD · Erreurs",
    title: "Erreurs de transcription",
    sub: "Écarts SNIS / DHIS2 et feuille de pointage / registre",
    chartTitle: "Taux d'erreur par antigène (%)",
    grouped: {
      cats: ["PENTA1", "PENTA3", "RR1", "RR2"],
      series: [
        { name: "SNIS / DHIS2", color: P.rouge, values: [34, 38, 22, 40] },
        { name: "Pointage / Registre", color: P.jaune, values: [28, 31, 16, 34] },
      ],
    },
    chartOpt: { max: 50 },
    note: "Le taux d'erreur global SNIS→DHIS2 atteint 55,6 % à Bokungu (20 discordances / 36 valeurs vérifiées) — anormalement élevé. Les antigènes PENTA3 (38 %) et RR2 (40 %) sont les plus touchés. Formule : taux d'erreur = valeurs discordantes / valeurs vérifiées × 100. Action : recompter à la source et corriger la saisie DHIS2.",
    noteKind: "alert",
  },

  /* 16 — Comparaison des sources */
  {
    type: "bigBar",
    tag: "CQD · Sources",
    title: "Comparaison des sources de données",
    sub: "Registre, feuille de pointage, SNIS et DHIS2 par antigène (ZS Bokungu)",
    chartTitle: "Volumes par source et par antigène",
    grouped: {
      cats: ["PENTA1", "PENTA3", "RR1", "RR2"],
      series: [
        { name: "SNIS", color: P.bleu, values: [212, 185, 176, 188] },
        { name: "DHIS2", color: P.marine, values: [180, 166, 170, 160] },
      ],
    },
    chartOpt: { max: 240 },
    note: "Les écarts les plus importants apparaissent sur PENTA3 (SNIS 185 vs DHIS2 166) et RR2 (188 vs 160) : le DHIS2 sous-estime systématiquement les volumes du SNIS. Ce profil oriente vers un problème de saisie / compilation DHIS2 plutôt que de collecte primaire.",
  },

  /* 17 — Classement ZS qualité des données */
  {
    type: "barSide",
    tag: "CQD · Score",
    title: "Classement des ZS selon la qualité des données",
    sub: "Score composite de qualité et catégorisation automatique",
    chartTitle: "Score composite qualité des données (%)",
    bars: [
      { l: "Boende", v: 84 },
      { l: "Ikela", v: 73 },
      { l: "Djolu", v: 61 },
      { l: "Bokungu", v: 60 },
      { l: "Monkoto", v: 55 },
      { l: "Befale", v: 45 },
    ],
    chartOpt: { max: 100, colorFn: "score" },
    side: [
      {
        kind: "table",
        table: {
          cols: ["Critère", "Pond."],
          rows: [
            row("Concordance PENTA3", "25 %"),
            row("Concordance RR2", "25 %"),
            row("Erreur SNIS/DHIS2", "20 %"),
            row("Erreur Pointage/Reg.", "20 %"),
            row("Qualité des outils", "10 %"),
          ],
        },
      },
      {
        kind: "table",
        table: {
          cols: ["Score", "Catégorie"],
          rows: [
            row(pill("≥ 90 %", "green"), "Très bonne"),
            row(pill("80–89 %", "blue"), "Bonne"),
            row(pill("60–79 %", "amber"), "Moyenne"),
            row(pill("< 60 %", "red"), "Faible"),
          ],
        },
      },
    ],
    note: "Bokungu (60 %) bascule en qualité « moyenne », tirée vers le bas par son taux d'erreur de transcription. Befale (45 %) est en qualité faible. Le score composite aide à prioriser les missions DQS et le coaching en gestion des données.",
    noteKind: "warn",
  },

  /* 18 — Croisement supervision + qualité */
  {
    type: "matrix",
    tag: "Analyse intégrée",
    title: "Croisement supervision + qualité des données",
    sub: "Matrice d'identification des ZS prioritaires",
    cells: [
      { h: "Supervision forte + données bonnes", p: "ZS performante (ex. Boende)", act: "Maintenir et documenter", color: P.vert },
      { h: "Supervision forte + données faibles", p: "Problème de gestion des données (ex. Bokungu)", act: "Coaching DQS ciblé", color: P.jaune },
      { h: "Supervision faible + données bonnes", p: "Appui programmatique requis", act: "Supervision formative", color: P.bleu },
      { h: "Supervision faible + données faibles", p: "ZS prioritaire (ex. Befale)", act: "Mission d'appui rapproché", color: P.rouge },
    ],
    note: "Bokungu illustre le quadrant « supervision correcte mais données faibles » : le coaching doit porter sur la gestion des données (DQS), pas sur la programmation. Befale cumule les deux déficits → mission d'appui rapproché. La taille du point peut représenter le nombre d'enfants à récupérer.",
  },

  /* 19 — Principaux goulots */
  {
    type: "table",
    tag: "Goulots",
    title: "Principaux goulots identifiés",
    sub: "Génération automatique à partir des faibles scores et observations",
    cols2: ["Domaine", "Goulot", "ZS concernées"],
    rows: [
      row("Données", "Erreurs de transcription SNIS/DHIS2 (55,6 %)", "Bokungu"),
      row("Données", "Sous-rapportage PENTA3 & RR2", "Bokungu, Djolu"),
      row("Données", "Sur-rapportage PENTA3", "Befale"),
      row("Chaîne du froid", "Températures non relevées régulièrement", "Befale, Monkoto"),
      row("Planification", "Microplans absents ou non actualisés", "Befale"),
      row("Communauté", "Relais communautaires non actifs", "Befale, Monkoto"),
      row("Supervision", "Recommandations non suivies", "Befale, Monkoto"),
    ],
    note: "Prioriser les goulots qui touchent plusieurs ZS et relier chaque goulot à une action corrective SMART suivie jusqu'à clôture documentée. La qualité des données concentre la majorité des goulots critiques ce trimestre.",
  },

  /* 20 — Actions correctrices immédiates */
  {
    type: "table",
    tag: "Actions",
    title: "Actions correctrices immédiates",
    sub: "Issues des observations et recommandations du formulaire CQD",
    cols2: ["Problème", "Action corrective", "Responsable", "Échéance", "Statut"],
    rows: [
      row("PENTA3/RR2 sous-rapportés (Bokungu)", "Recompter le SNIS et corriger DHIS2", "IT / BCZ", "72 h", pill("À faire", "red")),
      row("Erreur transcription 55,6 %", "Vérification croisée SNIS↔DHIS2 + briefing", "BCZ Bokungu", "7 jours", pill("À faire", "red")),
      row("Fiches température incomplètes", "Briefing CDF + suivi journalier", "Logisticien ZS", "7 jours", pill("En cours", "amber")),
      row("Microplan non actualisé (Befale)", "Actualisation avec les AS", "ECZ", "14 jours", pill("À faire", "red")),
      row("Recommandations non exécutées", "Revue de suivi et responsabilisation", "BCZ / Antenne", "30 jours", pill("À faire", "red")),
    ],
    note: "Le statut est mis à jour à chaque revue : À faire · En cours · Clôturé · Bloqué. Les deux actions à 72 h concernent la correction des données de Bokungu — priorité absolue avant la prochaine validation DHIS2.",
  },

  /* 21 — Recommandations stratégiques */
  {
    type: "exec",
    tag: "Recommandations",
    title: "Recommandations stratégiques",
    sub: "Générées par niveau de responsabilité",
    kpis: [],
    message:
      "Les recommandations sont déclinées par niveau pour assurer la redevabilité : la ZS corrige et exécute, l'Antenne coache et supervise, la Province harmonise et standardise.",
    cols: [
      { h: "Niveau Zone de Santé", items: ["Corriger les écarts SNIS/DHIS2/registre/pointage", "Actualiser les microplans dans toutes les AS", "Revue mensuelle des données PEV (AS faibles)", "Suivi systématique des recommandations"] },
      { h: "Niveau Antenne", items: ["Prioriser les ZS à double déficit (Befale)", "Missions DQS ciblées dans les AS à écarts", "Renforcer la redevabilité données & récupération", "Documenter les bonnes pratiques (Boende)"] },
      { h: "Niveau Province", items: ["Tableau de bord provincial automatisé", "Harmoniser outils de collecte et validation", "Suivre mensuellement concordances PENTA3/RR2", "Standardiser les rapports automatisés"] },
    ],
  },

  /* 22 — Plan de suivi des recommandations */
  {
    type: "table",
    tag: "Suivi",
    title: "Plan de suivi des recommandations",
    sub: "Tableau opérationnel de redevabilité",
    cols2: ["Recommandation", "Responsable", "Échéance", "Indicateur de suivi", "Source de vérification"],
    rows: [
      row("Corriger les données discordantes", "ZS / AS", "72 h", "Données corrigées dans DHIS2", "Capture DHIS2 / SNIS"),
      row("Actualiser les microplans", "ZS", "14 jours", "Microplans disponibles", "Fichier microplan"),
      row("Superviser les AS faibles", "Antenne / ZS", "30 jours", "Nombre d'AS supervisées", "Rapport supervision"),
      row("Suivre les enfants manqués", "IT / RECO", "Hebdomadaire", "% enfants récupérés", "Fiche récupération"),
      row("Clôturer les actions critiques", "BCZ / Antenne", "Mensuel", "% actions clôturées", "PV revue mensuelle"),
    ],
    note: "Intégrer ce tableau dans le rapport mensuel de l'antenne et dans la revue provinciale PEV. Chaque ligne porte un indicateur mesurable et une source de vérification objective.",
  },

  /* 23 — Conclusion */
  {
    type: "conclusion",
    tag: "Conclusion",
    title: "Conclusion",
    sub: "Priorités de mise en œuvre et de suivi",
    points: [
      "Analyser conjointement performance PEV et qualité des données : une ZS performante doit aussi produire des données fiables — ce qui n'est pas encore le cas à Bokungu.",
      "Priorités immédiates : correction des écarts DHIS2/SNIS, extension de la couverture de supervision (1/12 → 12/12), actualisation des microplans et récupération active des enfants manqués.",
      "Renforcer le monitorage pour action, les revues mensuelles et l'utilisation des tableaux de bord pour décider.",
      "Produire des rapports consolidés par ZS, par Antenne et au niveau provincial à chaque période.",
    ],
    outputs: {
      h: "Sorties automatiques attendues",
      cols: ["Rapport", "Nom de fichier proposé"],
      rows: [
        row("Par Zone de Santé", "Rapport_supervision_PEV_CQD_Tshuapa_[ZS]_[Période].pptx"),
        row("Consolidé par Antenne", "Rapport_supervision_PEV_CQD_Tshuapa_[Antenne]_[Période].pptx"),
        row("Consolidé provincial", "Rapport_supervision_PEV_CQD_Tshuapa_[Période].pptx"),
      ],
    },
  },
];

export const ZS_DECK: Deck = {
  period: "Janvier – Mars 2026",
  gen: "1 juin 2026",
  footer: "Rapport automatisé Supervision PEV & Contrôle qualité des données · Zones de santé · Province de la Tshuapa",
  fileLabel: "Supervision PEV & CQD — Zones de santé",
  slides: ZS_SLIDES,
};

/* ========================================================================= */
/*                   RAPPORT 2 — CENTRES DE SANTÉ (26)                       */
/* ========================================================================= */

interface CsRef {
  n: string;
  zs: string;
  score: number;
  conc3: number;
  conc3c: string;
  concRR2: number;
  errSD: number;
  errPR: number;
  qual: number;
  reel?: boolean;
}
const CS: CsRef[] = [
  { n: "Lofima 2", zs: "Bokungu", score: 64, conc3: 114.1, conc3c: "Sur-rapportage", concRR2: 100, errSD: 8.3, errPR: 75, qual: 61, reel: true },
  { n: "Bonkone", zs: "Bokungu", score: 81, conc3: 96, conc3c: "Concordant", concRR2: 98, errSD: 18, errPR: 22, qual: 84 },
  { n: "Buluku", zs: "Bokungu", score: 73, conc3: 103, conc3c: "Concordant", concRR2: 101, errSD: 24, errPR: 31, qual: 73 },
  { n: "Ikengolaka 2", zs: "Bokungu", score: 57, conc3: 88, conc3c: "Sous-rapportage", concRR2: 90, errSD: 37, errPR: 41, qual: 48 },
  { n: "Wangata", zs: "Boende", score: 66, conc3: 109, conc3c: "Sur-rapportage", concRR2: 106, errSD: 31, errPR: 34, qual: 61 },
];

const CS_SLIDES: Slide[] = [
  /* 01 — Couverture */
  {
    type: "cover",
    tag: "Couverture",
    kicker: "RAPPORT AUTOMATISÉ · PEV CS & CQD",
    title: "Supervision PEV des Centres de Santé & contrôle qualité des données",
    meta: ["Province : Tshuapa  ·  Antenne : Boende / Bokungu", "Période : Janvier – Mars 2026  ·  279 CS/ESS prévus"],
    kpis: [
      { v: "1 / 279", l: "CS supervisés" },
      { v: "64 %", l: "Score supervision" },
      { v: "114 %", l: "Concordance PENTA3" },
      { v: "21 / 29", l: "Enfants récupérés" },
    ],
    src: "Source : exports ODK / Kobo (checklist CS + formulaire de contrôle qualité) · Généré automatiquement",
  },

  /* 02 — Résumé exécutif */
  {
    type: "exec",
    tag: "Synthèse",
    title: "Résumé exécutif",
    sub: "Lecture rapide des principaux résultats",
    kpis: [
      { v: "1", l: "CS supervisés", s: "sur 279 prévus", tone: "red" },
      { v: "64 %", l: "Score moyen supervision", s: "toutes composantes", tone: "amber" },
      { v: "114 %", l: "Concordance PENTA3", s: "DHIS2 / Registre", tone: "red" },
      { v: "100 %", l: "Concordance RR2", s: "DHIS2 / Registre", tone: "green" },
      { v: "8,3 %", l: "Erreur transcription", s: "SNIS / DHIS2", tone: "green" },
      { v: "72 %", l: "Enfants récupérés", s: "21 sur 29 identifiés", tone: "green" },
    ],
    message:
      "Un seul centre de santé a été contrôlé ce trimestre (AS Lofima 2, ZS Bokungu) : la couverture de la supervision CS doit impérativement être élargie. Sur ce CS, le score global est moyen (64 %). La qualité des données est contrastée : la transcription SNIS→DHIS2 est bonne (8,3 %) mais le PENTA3 est sur-rapporté (114 %) et l'écart feuille de pointage ↔ registre atteint 75 % — les outils primaires sont mal renseignés.",
    noteKind: "warn",
    cols: [
      { h: "Forces", items: ["Concordance RR2 parfaite (100 %)", "Faible erreur SNIS→DHIS2 (8,3 %)", "72 % des enfants manqués récupérés"] },
      { h: "Goulots", items: ["PENTA3 sur-rapporté (114 %)", "Écart pointage ↔ registre (75 %)", "Registre & pointage mal remplis"] },
      { h: "Priorités immédiates", items: ["Recompter le registre, corriger DHIS2", "Standardiser le remplissage des outils", "Étendre la supervision aux CS restants"] },
    ],
  },

  /* 03 — Méthode de génération automatique */
  {
    type: "process",
    tag: "Processus",
    title: "Méthode de génération automatique",
    sub: "De la collecte ODK/Kobo au rapport PowerPoint consolidé",
    pSteps: [
      { h: "Collecte", p: "Checklist CS + contrôle qualité des données" },
      { h: "Export", p: "Excel / CSV depuis Kobo / ODK" },
      { h: "Calculs", p: "Scores, concordances, taux d'erreur" },
      { h: "Classement", p: "CS faibles, moyens, bons" },
      { h: "Rapport", p: "Graphiques, commentaires, actions" },
    ],
    sources: [
      { h: "Checklist supervision PEV de CS", p: "Planification, chaîne du froid, vaccins, déchets, prestation, supervision formative, monitorage, engagement communautaire et surveillance épidémiologique." },
      { h: "Contrôle qualité des données", p: "Registre, feuilles de pointage, canevas SNIS et DHIS2 ; concordance PENTA3/RR2 ; erreurs de transcription ; suivi des enfants à récupérer." },
    ],
    note: "Le modèle utilise des champs dynamiques — [Province], [Antenne], [ZS], [AS], [ESS], [Période], [Superviseur], [Date] — remplis automatiquement à partir de chaque export Kobo/ODK.",
  },

  /* 04 — Couverture de la supervision CS */
  {
    type: "barSide",
    tag: "Couverture",
    title: "Couverture de la supervision des Centres de Santé",
    sub: "Étendue des visites et vérifications réalisées",
    chartTitle: "Score global des CS supervisés (%)",
    bars: [...CS].sort((a, b) => b.score - a.score).map((c) => ({ l: c.n, v: c.score })),
    chartOpt: { max: 100, colorFn: "score" },
    side: [
      {
        kind: "table",
        table: {
          cols: ["Antenne", "CS prévus", "CS sup.", "% réal."],
          rows: [row("Bokungu", "≈ 25", "1", "4 %"), row("Boende", "≈ 34", "0", "0 %"), totalRow("Total", "279", "1", "0,4 %")],
        },
      },
      { kind: "kpis", items: [{ v: "0,4 %", l: "Réalisation CS", s: "1 / 279 prévus", tone: "red" }] },
    ],
    note: "Avec 1 CS contrôlé sur 279, la base est insuffisante pour conclure au niveau provincial. Afficher systématiquement le nombre de CS contrôlés par ZS/AS, le taux de réalisation et les CS non visités avec motif. Priorité : déployer la supervision sur l'ensemble des aires de santé.",
    noteKind: "alert",
  },

  /* 05 — Cadre de scoring */
  {
    type: "table",
    tag: "Scoring",
    title: "Cadre de scoring de la checklist CS",
    sub: "Conversion des réponses oui / partiellement / non en score standardisé",
    chartTitle: "Barème de cotation",
    cols2: ["Réponse", "Valeur proposée", "Interprétation"],
    rows: [
      row("Oui", "1 pt (ou 2–3 pts selon section)", "Critère rempli"),
      row("Partiellement", "0,5 pt (moitié de la pondération)", "Critère partiellement rempli"),
      row("Non", "0 pt", "Critère non rempli"),
    ],
    extra: {
      tables: [
        {
          cols: ["Score global", "Appréciation", "Couleur"],
          rows: [
            row("≥ 80 %", "Très bon", pill("Vert", "green")),
            row("70–79 %", "Bon", pill("Bleu", "blue")),
            row("60–69 %", "Moyen", pill("Jaune", "amber")),
            row("< 60 %", "Faible", pill("Rouge", "red")),
          ],
        },
      ],
      legend: {
        h: "Formule",
        p: "Score CS = somme des points obtenus / somme des points attendus × 100. Les sections dont certaines questions valent 2 ou 3 points conservent la pondération de la checklist.",
      },
    },
    note: "Les couleurs sont appliquées automatiquement selon les seuils. Lofima 2 obtient 64 % → « Moyen » : coaching ciblé et suivi rapproché recommandés.",
  },

  /* 06 — Score global par CS */
  {
    type: "barSide",
    tag: "Performance",
    title: "Score global de performance par Centre de Santé",
    sub: "Classement automatique des CS selon le score total",
    chartTitle: "Scores globaux par CS (%)",
    bars: [...CS].sort((a, b) => b.score - a.score).map((c) => ({ l: c.n, v: c.score })),
    chartOpt: { max: 100, colorFn: "score" },
    side: [
      { kind: "legend", h: "≥ 80 % · Très bon", p: "Maintien des bonnes pratiques et documentation." },
      { kind: "legend", h: "60–69 % · Moyen", p: "Coaching ciblé et suivi rapproché." },
      { kind: "legend", h: "< 60 % · Faible", p: "Supervision rapprochée, action corrective et revalidation." },
    ],
    note: "Bonkone (81 %) est le seul CS « très bon » et doit être documenté comme bonne pratique. Ikengolaka 2 (57 %) passe sous 60 % → supervision rapprochée. Les couleurs sont appliquées automatiquement selon les seuils.",
  },

  /* 07 — Performance moyenne par composante */
  {
    type: "bigBar",
    tag: "Composantes",
    title: "Performance moyenne par composante",
    sub: "Vue consolidée des forces et faiblesses des centres de santé",
    chartTitle: "Score moyen par composante (%)",
    bars: [
      { l: "Planif.", v: 72 },
      { l: "CDF", v: 68 },
      { l: "Vaccins", v: 61 },
      { l: "Déchets", v: 82 },
      { l: "Prestation", v: 77 },
      { l: "Superv.", v: 55 },
      { l: "Monitor.", v: 58 },
      { l: "Commun.", v: 63 },
      { l: "Surveill.", v: 48 },
    ],
    chartOpt: { max: 100, colorFn: "score" },
    note: "Top 3 : gestion des déchets (82 %), prestation de services (77 %), planification (72 %). Bottom 3 : surveillance épidémiologique (48 %), supervision formative (55 %), monitorage (58 %). Décision : déclencher automatiquement une action corrective dès qu'une composante passe sous 60 %.",
  },

  /* 08 — Planification & gestion CS */
  {
    type: "hbarList",
    tag: "I · Planification",
    title: "Planification et gestion au niveau du CS",
    sub: "Microplan, ressources et réalisation des activités programmées",
    lists: [
      {
        h: "Indicateurs de planification",
        data: [
          { l: "Microplan disponible", v: 78 },
          { l: "État des lieux exhaustif", v: 52 },
          { l: "Analyse des problèmes", v: 61 },
          { l: "Objectifs SMART", v: 70 },
        ],
      },
      {
        h: "Ressources & réalisation",
        data: [
          { l: "Besoins vaccins estimés", v: 65 },
          { l: "Activités réalisées ≥ 80 %", v: 72 },
          { l: "≥ 2 agents formés PEV", v: 55 },
        ],
      },
    ],
    note: "L'état des lieux exhaustif (52 %) — villages, repères, distances, cibles, CODESA/CAC/RECO — et la présence d'agents formés (55 %) sont les points faibles. Alerte automatique : lister les CS sans microplan ou avec besoins vaccins mal estimés.",
    noteKind: "warn",
  },

  /* 09 — Chaîne du froid & vaccins */
  {
    type: "hbarList",
    tag: "CDF & Vaccins",
    title: "Chaîne du froid et gestion des vaccins",
    sub: "Disponibilité, température, stocks et règles de conservation",
    lists: [
      {
        h: "Chaîne du froid",
        data: [
          { l: "Réfrigérateur bien installé", v: 76 },
          { l: "Monitoring température", v: 68 },
          { l: "Température 2×/jour", v: 60 },
          { l: "Température +2 à +8 °C", v: 81 },
          { l: "Maintenance réalisée", v: 43 },
          { l: "Aucun produit non vaccinal", v: 92 },
        ],
      },
      {
        h: "Gestion des vaccins",
        data: [
          { l: "Fiches de stock à jour", v: 57 },
          { l: "Stock physique = théorique", v: 49 },
          { l: "Inventaires réguliers", v: 62 },
          { l: "Vaccins périmés séparés", v: 78 },
          { l: "Flacons entamés respectés", v: 54 },
          { l: "Absence rupture 3 mois", v: 46 },
        ],
      },
    ],
    note: "Maintenance (43 %), absence de rupture (46 %) et stock physique = théorique (49 %) sont critiques. Action type : recompter les stocks, mettre à jour les fiches, appliquer le FEFO/PEPS et renforcer le suivi de température 2×/jour.",
    noteKind: "warn",
  },

  /* 10 — Sécurité injections & déchets */
  {
    type: "bigBar",
    tag: "Déchets",
    title: "Sécurité des injections et gestion des déchets",
    sub: "Conformité aux normes de sécurité et d'élimination",
    chartTitle: "Conformité sécurité des injections (%)",
    bars: [
      { l: "SAB disponibles", v: 84 },
      { l: "Boîtes sécurité", v: 80 },
      { l: "1 seringue/injection", v: 91 },
      { l: "Pas de recapuchonnage", v: 63 },
      { l: "Boîtes bien utilisées", v: 70 },
    ],
    chartOpt: { max: 100, colorFn: "score" },
    note: "Le recapuchonnage persiste (37 % des cas) : tout recapuchonnage observé ou absence de boîte de sécurité doit générer une action corrective immédiate. Vérifier la disponibilité des intrants avant chaque séance et observer directement une session lorsque possible.",
    noteKind: "alert",
  },

  /* 11 — Prestation de services */
  {
    type: "tableBar",
    tag: "II · Services",
    title: "Prestation de services de vaccination",
    sub: "Sessions fixes, avancées, spéciales et rattrapage des enfants",
    tableTitle: "Dimensions & seuils attendus",
    tableCols: ["Dimension", "Indicateur", "Seuil"],
    tableRows: [
      row("Programme mensuel", "Affiché, adapté, respecté", "Oui"),
      row("Stratégies fixes", "% réalisées / planifiées", "≥ 80 %"),
      row("Stratégies avancées", "% réalisées / planifiées", "≥ 80 %"),
      row("Stratégies spéciales", "% réalisées / planifiées", "≥ 80 %"),
      row("Rattrapage ZD/SV", "% enfants identifiés récupérés", "≥ 80 %"),
    ],
    chartTitle: "Réalisation des stratégies (%)",
    bars: [
      { l: "Fixe", v: 83 },
      { l: "Avancée", v: 64 },
      { l: "Spéciale", v: 48 },
      { l: "Rattrapage", v: 58 },
    ],
    chartOpt: { max: 100, colorFn: "score" },
    note: "Les stratégies avancées (64 %) et spéciales (48 %) restent sous 80 % : risque élevé de persistance des enfants manqués dans les villages mal desservis. Replanifier les sorties avancées en priorité.",
    noteKind: "warn",
  },

  /* 12 — Récupération des enfants manqués */
  {
    type: "funnel",
    tag: "Rattrapage",
    title: "Identification et récupération des enfants manqués",
    sub: "Suivi des enfants zéro-dose et sous-vaccinés au niveau CS / communauté",
    chartTitle: "Parcours de récupération (AS Lofima 2)",
    fSteps: [
      { l: "Identifiés", v: "29", c: P.marine },
      { l: "Liste remise aux relais", v: "82 %", c: P.bleu },
      { l: "Retrouvés", v: "23", c: P.jaune },
      { l: "Vaccinés / récupérés", v: "21", c: P.vert },
    ],
    fTable: {
      cols: ["Indicateur", "Valeur", "Source"],
      rows: [
        row("Enfants à récupérer", "29", "Formulaire CQD"),
        row("Identifiés précédemment", "29", "Suivi récupération"),
        row("Retrouvés par les relais", "23", "Suivi relais"),
        row("Effectivement récupérés", "21", "Registre / fiche récupération"),
        totalRow("Taux de récupération final", "72 %", "21 / 29"),
      ],
    },
    note: "La récupération atteint 72 % (21/29) : performance encourageante au regard de la moyenne provinciale. La déperdition se situe entre « retrouvés » (23) et « récupérés » (21) — assurer le suivi nominatif jusqu'à la vaccination effective. Inclure la photo de la fiche d'identification lorsqu'elle est disponible dans Kobo.",
  },

  /* 13 — Supervision formative & recommandations */
  {
    type: "barSide",
    tag: "III · Supervision",
    title: "Supervision formative et suivi des recommandations",
    sub: "Supervision des relais, sessions et feedback du BCZ",
    chartTitle: "Indicateurs de supervision formative (%)",
    bars: [
      { l: "Calendrier", v: 66 },
      { l: "Relais supervisés", v: 52 },
      { l: "Sessions superv.", v: 57 },
      { l: "CS sup./mois", v: 74 },
      { l: "Cahier feedback", v: 49 },
      { l: "Reco. exécutées", v: 41 },
    ],
    chartOpt: { max: 100, colorFn: "score" },
    side: [
      {
        kind: "table",
        table: {
          cols: ["CS", "Reco.", "Exéc.", "Taux"],
          rows: [
            row("Bonkone", "9", "8", "89 %"),
            row("Lofima 2", "11", "5", "45 %"),
            row("Ikengolaka 2", "8", "2", "25 %"),
            totalRow("Total", "28", "15", "54 %"),
          ],
        },
      },
    ],
    note: "Le taux d'exécution des recommandations (41 %) et la tenue du cahier de feedback (49 %) sont préoccupants. Règle automatique : un taux d'exécution < 80 % est classé goulot prioritaire. Chaque recommandation non exécutée doit porter un motif, un responsable et une échéance.",
    noteKind: "alert",
  },

  /* 14 — Monitorage des données CS */
  {
    type: "hbarList",
    tag: "IV · Données",
    title: "Monitorage des données au Centre de Santé",
    sub: "Disponibilité des outils, analyse et utilisation des données",
    lists: [
      {
        h: "Disponibilité & transmission",
        data: [
          { l: "Outils disponibles", v: 85 },
          { l: "Outils archivés/remplis", v: 61 },
          { l: "Concordance des outils", v: 52 },
          { l: "SNIS/REH transmis à temps", v: 78 },
        ],
      },
      {
        h: "Analyse & utilisation",
        data: [
          { l: "Courbes à jour", v: 48 },
          { l: "Données analysées", v: 46 },
          { l: "Réunions de monitorage", v: 39 },
          { l: "Feedback de la ZS", v: 55 },
        ],
      },
    ],
    note: "Courbes non à jour (48 %) + réunions de monitorage rares (39 %) = faible utilisation des données pour l'action. Le monitorage doit transformer la donnée en décision : identifier les CS/AS faibles, programmer des sorties avancées et corriger les données aberrantes avant validation.",
    noteKind: "alert",
  },

  /* 15 — Engagement communautaire */
  {
    type: "bigBar",
    tag: "V · Communauté",
    title: "Engagement communautaire",
    sub: "CODESA, CAC, leaders, relais et barrières de genre",
    chartTitle: "Indicateurs d'engagement communautaire (%)",
    bars: [
      { l: "CODESA", v: 63 },
      { l: "CAC", v: 48 },
      { l: "Leaders", v: 59 },
      { l: "Relais", v: 70 },
      { l: "Supports IEC", v: 44 },
      { l: "Sensibilisation", v: 57 },
      { l: "Genre", v: 36 },
      { l: "Causes NV", v: 51 },
    ],
    chartOpt: { max: 100, colorFn: "score" },
    note: "La prise en compte du genre (36 %), des supports IEC (44 %) et des CAC (48 %) est faible. Décision : prioriser les CS où CAC/CODESA sont non fonctionnels et où les causes de non-vaccination ne sont pas analysées, et lever les obstacles de genre identifiés.",
    noteKind: "warn",
  },

  /* 16 — Surveillance épidémiologique CS */
  {
    type: "barSide",
    tag: "VI · Surveillance",
    title: "Surveillance épidémiologique au niveau CS",
    sub: "Notification, investigation, riposte, REH et MAPI",
    chartTitle: "Indicateurs de surveillance (%)",
    bars: [
      { l: "Définitions", v: 58 },
      { l: "Kits", v: 44 },
      { l: "Notification", v: 40 },
      { l: "Investigation", v: 52 },
      { l: "REH", v: 73 },
      { l: "MAPI", v: 28 },
    ],
    chartOpt: { max: 100, colorFn: "score" },
    side: [
      {
        kind: "table",
        table: {
          cols: ["Critère", "Indicateur auto."],
          rows: [
            row("Définitions de cas", "% CS avec définitions affichées"),
            row("Kits/formulaires", "% CS avec kits disponibles"),
            row("Notification MPV", "% CS ayant notifié ≥ 1 cas / 6 mois"),
            row("MAPI", "% CS ayant notifié ≥ 1 MAPI"),
          ],
        },
      },
    ],
    note: "La notification MAPI (28 %) et la disponibilité des kits (44 %) sont très faibles. Alerte automatique : une absence de notification MPV/MAPI sur 6 mois doit faire vérifier la sensibilité du système de surveillance plutôt que conclure à une absence de cas.",
    noteKind: "alert",
  },

  /* 17 — Qualité des outils de collecte */
  {
    type: "barSide",
    tag: "CQD · Outils",
    title: "Qualité des outils de collecte",
    sub: "Registre, feuilles de pointage et canevas SNIS",
    chartTitle: "Conformité par outil (%)",
    bars: [
      { l: "Registre", v: 68 },
      { l: "Pointage", v: 58 },
      { l: "SNIS", v: 62 },
      { l: "DHIS2", v: 71 },
    ],
    chartOpt: { max: 100, colorFn: "score" },
    side: [
      {
        kind: "table",
        table: {
          cols: ["Outil", "Critères de qualité"],
          rows: [
            row("Registre", "Identification, antigènes/dates, pas de doublons, lisibilité"),
            row("Pointage", "Site, date, stratégie, totaux, signature, archivage"),
            row("SNIS", "Pas de cellule vide, zéros justifiés, pas d'aberrations"),
            row("DHIS2", "Saisie complète, cohérente, sans valeur invalide"),
          ],
        },
      },
    ],
    note: "À Lofima 2, le registre et la feuille de pointage sont jugés « non conformes » alors que le canevas SNIS est « conforme » : les erreurs naissent à la source. Sortie automatique : tableau des problèmes fréquents (cellules vides, zéros non justifiés, incohérences entre antigènes, documents non archivés).",
    noteKind: "warn",
  },

  /* 18 — Concordance DHIS2 / Registre */
  {
    type: "tableBar",
    tag: "CQD · Concordance",
    title: "Concordance DHIS2 / Registre",
    sub: "Précision des données PENTA3 et RR2 au niveau Centre de Santé",
    chartTitle: "Concordance PENTA3 par CS (%)",
    bars: CS.map((c) => ({ l: c.n, v: c.conc3, c: cc(c.conc3) })),
    chartOpt: { max: 120, colorFn: "conc" },
    tableTitle: "Détail PENTA3 par CS",
    tableCols: ["CS/ESS", "Registre", "DHIS2", "Concord.", "Appréciation"],
    tableRows: [
      row("Lofima 2", "92", "105", "114 %", pill("Sur-rapport.", "red")),
      row("Bonkone", "—", "—", "96 %", pill("Concordant", "green")),
      row("Ikengolaka 2", "—", "—", "88 %", pill("Sous-rapport.", "amber")),
    ],
    note: "Lofima 2 : 114 % → sur-rapportage (DHIS2 105 > Registre 92). Le DHIS2 affiche plus de doses que le registre n'en documente : recompter le registre et corriger DHIS2. Formule : concordance = DHIS2 / Registre × 100. Seuils : 95–105 % concordant, < 95 % sous-rapportage, > 105 % sur-rapportage.",
    noteKind: "alert",
  },

  /* 19 — Erreurs de transcription */
  {
    type: "bigBar",
    tag: "CQD · Erreurs",
    title: "Erreurs de transcription",
    sub: "Comparaison SNIS–DHIS2 et feuille de pointage–registre",
    chartTitle: "Taux d'erreur par antigène (%)",
    grouped: {
      cats: ["PENTA1", "PENTA3", "RR1", "RR2"],
      series: [
        { name: "SNIS / DHIS2", color: P.rouge, values: [6, 8, 5, 8] },
        { name: "Pointage / Registre", color: P.jaune, values: [58, 75, 49, 62] },
      ],
    },
    chartOpt: { max: 90 },
    note: "À Lofima 2, l'erreur SNIS→DHIS2 est faible (8,3 %) mais l'écart feuille de pointage ↔ registre est massif (75 % sur PENTA3) : la rupture se produit en amont, entre le pointage et le registre. Générer la liste des CS/ESS avec erreur ≥ 25 % par antigène et indiquer la source probable de l'écart.",
    noteKind: "alert",
  },

  /* 20 — Comparaison des sources */
  {
    type: "bigBar",
    tag: "CQD · Sources",
    title: "Comparaison des sources de données",
    sub: "Registre, pointage, SNIS et DHIS2 — PENTA1, PENTA3, RR1, RR2 (AS Lofima 2)",
    chartTitle: "Volumes par source et par antigène",
    grouped: {
      cats: ["PENTA1", "PENTA3", "RR1", "RR2"],
      series: [
        { name: "Registre", color: P.gris, values: [107, 92, 94, 0] },
        { name: "SNIS", color: P.bleu, values: [93, 105, 91, 89] },
        { name: "DHIS2", color: P.marine, values: [95, 105, 91, 89] },
      ],
    },
    chartOpt: { max: 130 },
    note: "SNIS et DHIS2 sont alignés (saisie fidèle), mais le registre s'écarte fortement : PENTA3 registre 92 vs DHIS2 105, et RR2 registre = 0 (probable non-report). L'écart provient d'un problème de compilation / report depuis le registre. Action : recompter la source primaire et corriger le flux de rapportage.",
  },

  /* 21 — Score composite qualité */
  {
    type: "barSide",
    tag: "CQD · Score",
    title: "Score composite de qualité des données",
    sub: "Classement des CS/ESS selon la fiabilité des données",
    chartTitle: "Score composite qualité (%)",
    bars: [...CS].sort((a, b) => b.qual - a.qual).map((c) => ({ l: c.n, v: c.qual })),
    chartOpt: { max: 100, colorFn: "score" },
    side: [
      {
        kind: "table",
        table: {
          cols: ["Critère", "Pond."],
          rows: [
            row("Concordance PENTA3 DHIS2/Reg.", "25 %"),
            row("Concordance RR2 DHIS2/Reg.", "25 %"),
            row("Erreur SNIS/DHIS2", "20 %"),
            row("Erreur Pointage/Reg.", "20 %"),
            row("Qualité des outils", "10 %"),
          ],
        },
      },
      {
        kind: "table",
        table: {
          cols: ["Score", "Catégorie"],
          rows: [
            row(pill("≥ 90 %", "green"), "Très bonne"),
            row(pill("80–89 %", "blue"), "Bonne"),
            row(pill("60–79 %", "amber"), "Moyenne"),
            row(pill("< 60 %", "red"), "Faible"),
          ],
        },
      },
    ],
    note: "Lofima 2 obtient 61 % → qualité « moyenne » : la bonne concordance RR2 et la faible erreur SNIS/DHIS2 sont contrebalancées par le sur-rapportage PENTA3 et l'écart pointage/registre. Ikengolaka 2 (48 %) est en qualité faible → mission DQS prioritaire.",
    noteKind: "warn",
  },

  /* 22 — Croisement supervision CS + qualité */
  {
    type: "matrix",
    tag: "Analyse intégrée",
    title: "Croisement supervision CS et qualité des données",
    sub: "Identification des centres prioritaires pour appui rapproché",
    cells: [
      { h: "Performance forte + données bonnes", p: "Centre fiable (ex. Bonkone)", act: "Maintenir et documenter", color: P.vert },
      { h: "Performance forte + données faibles", p: "Gestion des données à renforcer", act: "Coaching DQS ciblé", color: P.jaune },
      { h: "Performance faible + données bonnes", p: "Appui programmatique requis", act: "Supervision formative", color: P.bleu },
      { h: "Performance faible + données faibles", p: "Centre prioritaire (ex. Ikengolaka 2)", act: "Mission d'appui prioritaire", color: P.rouge },
    ],
    note: "Axe X : score supervision CS · Axe Y : score qualité des données · taille du point : enfants à récupérer. Lofima 2 se situe entre les quadrants « moyen / données moyennes » → priorité au coaching sur le remplissage des outils primaires.",
  },

  /* 23 — Principaux goulots */
  {
    type: "table",
    tag: "Goulots",
    title: "Principaux goulots identifiés",
    sub: "Synthèse automatique à partir des scores faibles et observations terrain",
    cols2: ["Domaine", "Goulot", "CS concernés", "Priorité"],
    rows: [
      row("Données", "Sur-rapportage PENTA3 (registre ≠ DHIS2)", "Lofima 2, Wangata", pill("Haute", "red")),
      row("Données", "Écart pointage ↔ registre (75 %)", "Lofima 2", pill("Haute", "red")),
      row("Surveillance", "Absence de notification MPV/MAPI", "Lofima 2, Ikengolaka 2", pill("Haute", "red")),
      row("Chaîne du froid", "Maintenance non réalisée", "Plusieurs CS", pill("Haute", "red")),
      row("Prestation", "Stratégies avancées < 80 %", "Lofima 2", pill("Moyenne", "amber")),
      row("Communauté", "CAC/CODESA non fonctionnels", "Ikengolaka 2", pill("Moyenne", "amber")),
    ],
    note: "Chaque goulot doit être relié à une action corrective, un responsable, une échéance et une source de vérification. Les goulots de qualité des données et de surveillance concentrent les priorités hautes.",
  },

  /* 24 — Plan d'actions correctrices */
  {
    type: "table",
    tag: "Actions",
    title: "Plan d'actions correctrices immédiates",
    sub: "Généré depuis observations, actions correctrices et recommandations",
    cols2: ["Problème", "Action corrective", "Responsable", "Échéance", "Statut"],
    rows: [
      row("PENTA3 sur-rapporté (Lofima 2)", "Recompter le registre et corriger DHIS2", "IT / BCZ", "72 h", pill("À faire", "red")),
      row("Écart pointage ↔ registre (75 %)", "Briefing remplissage + vérif. croisée", "IT", "7 jours", pill("À faire", "red")),
      row("Fiche température incomplète", "Briefing CDF + suivi journalier", "IT / Logisticien", "7 jours", pill("En cours", "amber")),
      row("Stratégie avancée non réalisée", "Replanifier les villages mal desservis", "IT / Relais", "14 jours", pill("À faire", "red")),
      row("REH en retard / MAPI non notifiées", "Suivi hebdomadaire de la transmission", "IT / BCZ", "7 jours", pill("À faire", "red")),
    ],
    note: "Niveau CS — corriger les écarts, actualiser le microplan, réaliser les stratégies avancées, suivre les enfants manqués. Niveau ZS/Antenne — coacher les CS faibles, valider les données, suivre les recommandations et organiser les missions ciblées.",
  },

  /* 25 — Plan de suivi des recommandations */
  {
    type: "table",
    tag: "Suivi",
    title: "Plan de suivi des recommandations",
    sub: "Suivi de la redevabilité après la supervision",
    cols2: ["Recommandation", "Responsable", "Échéance", "Indicateur de suivi", "Source de vérification"],
    rows: [
      row("Corriger les données discordantes", "IT / BCZ", "72 h", "Données corrigées", "Registre, SNIS, DHIS2"),
      row("Actualiser le microplan", "IT", "14 jours", "Microplan disponible", "Fichier microplan"),
      row("Superviser relais et sessions", "IT / ZS", "30 jours", "Nombre de supervisions", "Rapports / cahier feedback"),
      row("Récupérer les enfants manqués", "IT / RECO", "Hebdomadaire", "% enfants récupérés", "Fiche récupération"),
      row("Améliorer la surveillance", "IT / RECO", "30 jours", "Notification MPV/MAPI", "REH / registres"),
    ],
    note: "Sortie automatique finale : rapport consolidé Province / Antenne / ZS + rapport spécifique par Centre de Santé + liste des actions à suivre jusqu'à clôture documentée.",
  },

  /* 26 — Conclusion */
  {
    type: "conclusion",
    tag: "Conclusion",
    title: "Conclusion",
    sub: "Utiliser les données pour améliorer simultanément la performance PEV et la fiabilité du rapportage",
    points: [
      "Message clé : un CS performant combine bonne planification, chaîne du froid maîtrisée, disponibilité des vaccins, qualité des séances, rattrapage actif, surveillance sensible et données fiables.",
      "Priorité 1 — corriger les écarts Registre–Pointage–SNIS–DHIS2 et documenter les preuves (le sur-rapportage PENTA3 de Lofima 2 en est l'illustration).",
      "Priorité 2 — suivre l'exécution des recommandations avec responsable, échéance et preuve.",
      "Priorité 3 — renforcer les stratégies avancées et le suivi communautaire des enfants manqués.",
    ],
    outputs: {
      h: "Production du rapport",
      cols: ["Élément", "Fréquence / déclencheur"],
      rows: [
        row("Génération du rapport", "Après chaque export Kobo / ODK"),
        row("Graphiques & commentaires", "Actualisés automatiquement depuis les données"),
        row("CS faibles", "Appui rapproché avant la période suivante"),
      ],
    },
    note: "Les centres faibles (Ikengolaka 2, Lofima 2) doivent faire l'objet d'un appui rapproché avant le prochain trimestre. La couverture (1/279) reste le premier levier d'amélioration.",
  },
];

export const CS_DECK: Deck = {
  period: "Janvier – Mars 2026",
  gen: "1 juin 2026",
  footer: "Rapport automatisé Supervision PEV des Centres de Santé & Contrôle qualité des données · Province de la Tshuapa",
  fileLabel: "Supervision PEV & CQD — Centres de santé",
  slides: CS_SLIDES,
};

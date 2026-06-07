/** Types pour les onglets « Rapport mensuel des AT » et « Évaluation des AT ». */

/* ----------------------- Grille de cotation (8 composantes /100) ----------------------- */

export type AtComponentKey = "reunions" | "supervisions" | "monitorage" | "rougeole" | "tnn_mapi" | "osp" | "rapport_pev" | "rapport_oms";

export interface AtComponentDef {
  key: AtComponentKey;
  label: string;   // libellé long
  short: string;   // libellé court (axes, colonnes)
  max: number;     // pondération (points)
  color: string;
}

/** Niveaux de performance (sur le score ajusté). */
export type AtNiveau = "excellent" | "bon" | "moyen" | "faible" | "insuffisant";
export interface AtNiveauDef { key: AtNiveau; label: string; min: number; max: number; color: string; decision: string }

/** Détail d'une composante pour un AT × mois. */
export interface AtComponentScore {
  key: AtComponentKey;
  points: number | null;   // null = composante non applicable (NA)
  max: number;
  applicable: boolean;
  pct: number | null;      // % du max (NA → null)
}

/** Résultat complet de cotation pour un AT × mois. */
export interface AtScore {
  components: AtComponentScore[];
  obtenu: number;          // somme des points obtenus (composantes applicables)
  applicable: number;      // somme des pondérations applicables
  ajuste: number | null;   // obtenu ÷ applicable × 100
  niveau: AtNiveau | null;
}

/* ----------------------- Champs narratifs (texte libre Kobo) ----------------------- */

/** Verbatims texte saisis dans le formulaire, ventilés par champ d'origine. */
export interface AtNarratives {
  // Supervisions — constats par niveau
  constatsAs: string[];
  constatsZs: string[];
  constatsAntenne: string[];
  // Supervisions — recommandations
  recoSupZs: string[];
  recoSupAntenne: string[];
  // Réunions — recommandations
  recoCcpev: string[];
  recoCoordination: string[];
  // Problèmes (select_multiple → libellés) + précisions « Autre »
  problemesDonnees: string[];
  problemesMonitorageZs: string[];
  problemesDonneesAutre: string[];
  problemesMonitorageZsAutre: string[];
  // Actions correctrices
  actionsDonnees: string[];
  actionsMonitorageZs: string[];
  // Monitorage — observations
  observationsMonitorage: string[];
  // Surveillance — commentaires
  observationsRougeole: string[];
  observationsTnnMapi: string[];
  // Rapports — commentaires
  commentaireRapportTrim: string[];
  commentaireRapportsOms: string[];
}

/** Verbatim contextualisé (AT · antenne · mois) pour l'affichage. */
export interface NarrativeItem {
  at: string;
  antenne: string | null;
  month: string | null;
  monthLabel: string | null;
  text: string;
}

/* ----------------------- Enregistrement AT normalisé ----------------------- */

export interface AtRecord {
  id: string;
  nomAt: string;
  province: string | null;
  antenne: string | null;
  zonesAppuyees: string[];
  month: string | null;      // "YYYY-MM"
  monthLabel: string | null; // ex. "Juin"
  monthIndex: number | null; // 0..11
  score: AtScore;
  raw: Record<string, number | string | null>;
  narratives: AtNarratives;
}

/* ----------------------- Bundles ----------------------- */

export interface AtFilterOptions {
  provinces: string[]; antennes: string[]; months: string[]; monthLabels: string[]; ats: string[];
  geo: { province: string | null; antenne: string | null; zone: string | null; aire: string | null }[];
}

/** Bundle « Rapport mensuel des AT » (6 sections). */
export interface RapportBundle {
  meta: { generatedAt: string; source: { label: string; rows: number; ok: boolean; error?: string }; hasData: boolean };
  filters: AtFilterOptions;
  vue: {
    kpi: { antennes: number; zones: number; rapportsSoumis: number; rapportsAttendus: number; rapportsPct: number | null; atsRapporte: number; atsTotal: number };
    rapportsParAt: { at: string; count: number }[];
    rapportsParMois: { month: string; label: string; count: number }[];
    scoreParAtMois: { at: string; antenne: string | null; byMonth: Record<string, number | null>; moyenne: number | null }[];
    months: { key: string; label: string }[];
  };
  reunions: {
    kpi: { ccpevTenues: number; ccpevPrevues: number; survAppuyees: number; survPrevues: number; validAppuyees: number; validPrevues: number; revuesAppuyees: number; revuesPrevues: number };
    prevuesVsAppuyees: { type: string; prevues: number; appuyees: number }[];
    tauxParType: { type: string; taux: number | null }[];
    tableParAtMois: { at: string; byMonth: Record<string, number | null>; total: number }[];
    /** Réunions appuyées par AT et par type de réunion. */
    parAtType: { at: string; ccpev: number; coordination: number; validation: number; monitorageZs: number; total: number }[];
    /** Synthèse des principales recommandations (CCPeV + coordination). */
    recommandations: NarrativeItem[];
    /** Actions correctrices proposées (validation des données + monitorage ZS). */
    actionsCorrectrices: NarrativeItem[];
    /** Top 5 des problèmes de qualité des données. */
    topProblemesQualite: { label: string; count: number }[];
    /** Top 5 des problèmes identifiés au cours des revues mensuelles ZS. */
    topProblemesRevues: { label: string; count: number }[];
    months: { key: string; label: string }[];
  };
  supervisions: {
    kpi: { antSup: number; antPrev: number; zsSup: number; zsPrev: number; asSup: number; asPrev: number; formsSoumis: number };
    attenduVsRealise: { niveau: string; attendues: number; realisees: number }[];
    tauxParNiveau: { niveau: string; taux: number | null }[];
    tableParAtMois: { at: string; byMonth: Record<string, number | null>; total: number }[];
    /** Supervisions attendues vs réalisées par AT et par niveau. */
    parAtNiveau: { at: string; antAtt: number; antReal: number; zsAtt: number; zsReal: number; asAtt: number; asReal: number }[];
    /** Évolution des supervisions réalisées par mois (par niveau). */
    evolutionParMois: { month: string; label: string; antenne: number; zs: number; as: number; total: number }[];
    /** Principaux constats par niveau (Antenne · ZS · AS). */
    constatsParNiveau: { niveau: string; items: NarrativeItem[] }[];
    /** Tous les constats de supervision. */
    constats: NarrativeItem[];
    /** Principales recommandations de supervision (ZS + Antenne). */
    recommandations: NarrativeItem[];
    months: { key: string; label: string }[];
  };
  monitorage: {
    kpi: { realises: number; prevus: number; pct: number | null; asCouvertes: number; formsSoumis: number };
    parAtMois: { at: string; byMonth: Record<string, number | null>; total: number }[];
    couverture: { couvertes: number; nonCouvertes: number };
    /** Principaux constats / observations du monitorage de convenance. */
    constats: NarrativeItem[];
    months: { key: string; label: string }[];
  };
  surveillance: {
    kpi: {
      rougeoleNotifies: number; rougeoleInvestigues: number; rougeolePct: number | null;
      tnnNotifies: number; tnnInvestigues: number; tnnPct: number | null;
      mapiNotifiees: number; mapiInvestiguees: number; mapiPct: number | null;
      ripostesRougeole: number; ripostesTnn: number;
    };
    rougeoleParAntenne: { antenne: string; notifies: number; investigues: number; pct: number | null }[];
    tnnMapi: { tnnNotifies: number; tnnInvestigues: number; ripostesTnn: number; mapiNotifiees: number; mapiInvestiguees: number };
    /** Séries mensuelles par maladie (cas notifiés, investigués, ZS en épidémie). */
    parMois: { month: string; label: string; rougeoleN: number; rougeoleI: number; rougeolePct: number | null; tnnN: number; tnnI: number; tnnPct: number | null; mapiN: number; mapiI: number; mapiPct: number | null; zsEpidemie: number }[];
    /** Cas notifiés vs ripostes organisées (rougeole · TNN). */
    ripostesParMaladie: { maladie: string; notifies: number; ripostes: number }[];
    /** Listes linéaires rougeole partagées / à jour. */
    listesLineaires: { dispo: number; ajour: number; pct: number | null; parAntenne: { antenne: string; pct: number | null }[] };
    /** Commentaires de surveillance rougeole. */
    commentairesRougeole: NarrativeItem[];
    /** Commentaires de surveillance TNN / MAPI graves. */
    commentairesTnnMapi: NarrativeItem[];
  };
  osp: {
    kpi: { ospPartagesPct: number | null; activitesSpeciales: number; rapportsTrimTransmis: number; rapportsTrimAttendus: number; omsJustifieesPct: number | null };
    ospParAntenne: { antenne: string; disponible: number | null; rempli: number | null; transmis: number | null }[];
    typesActivites: string[];
    rapportsTrimParAntenne: { antenne: string; transmis: number; attendus: number; statut: boolean }[];
    omsJustifieesParAntenne: { antenne: string; pct: number | null }[];
    /** Commentaires sur la transmission du rapport trimestriel de l'Antenne PEV. */
    commentairesRapportPev: NarrativeItem[];
    /** Commentaires sur les rapports des activités sous financement OMS. */
    commentairesRapportsOms: NarrativeItem[];
  };
}

/** Bundle « Évaluation des AT » (5 pages). */
export interface EvaluationBundle {
  meta: { generatedAt: string; source: { label: string; rows: number; ok: boolean; error?: string }; hasData: boolean };
  filters: AtFilterOptions;
  components: AtComponentDef[];
  niveaux: AtNiveauDef[];
  /** Une ligne par AT × mois (classement, composantes). */
  rows: {
    at: string; antenne: string | null; month: string; monthLabel: string;
    obtenu: number; applicable: number; ajuste: number | null; niveau: AtNiveau | null;
    components: { key: AtComponentKey; points: number | null; max: number }[];
  }[];
  /** Agrégat par AT (moyenne des scores ajustés sur la période filtrée). */
  parAt: {
    at: string; antenne: string | null; ajusteMoyen: number | null; niveau: AtNiveau | null;
    components: { key: AtComponentKey; points: number | null; max: number; pct: number | null }[];
    byMonth: Record<string, number | null>;
  }[];
  vue: {
    kpi: { scoreMoyen: number | null; meilleur: number | null; faible: number | null; atsEvalues: number };
    repartition: { niveau: AtNiveau; count: number }[];
    classement: { at: string; ajuste: number | null }[];
  };
  evolution: { months: { key: string; label: string }[]; series: { at: string; values: (number | null)[] }[] };
  scoreMoyenParComposante: { key: AtComponentKey; pctMoyen: number | null }[];
}

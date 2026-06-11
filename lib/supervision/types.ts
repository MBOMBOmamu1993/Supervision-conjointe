import type {
  StructureLevel,
  CotationLevel,
  AnswerValue,
  SupervisionType,
} from "@/config/supervision.config";

/** Ligne brute issue d'un export Kobo (clé = libellé de colonne). */
export type RawRow = Record<string, unknown>;

/** Une supervision normalisée (une soumission de checklist). */
export interface SupervisionRecord {
  id: string;
  level: StructureLevel;
  /** Type de supervision (qui supervise). */
  type: SupervisionType;
  /** Libellé brut du champ « Type de supervision » (défaut : « Supervision conjointe »). */
  typeLabel: string | null;
  /** Hiérarchie géographique (selon disponibilité). */
  province: string | null;
  antenne: string | null;
  zone: string | null;
  aire: string | null;
  /** Nom de la structure supervisée (au niveau de cette soumission). */
  structure: string | null;
  /** Date de la supervision (ISO) et clé mois "YYYY-MM". */
  date: string | null;
  month: string | null;
  /** Score global de la supervision en %. */
  scorePct: number | null;
  cotation: CotationLevel | null;
  /** Score par composante (clé composante → %). */
  composantes: Record<string, number | null>;
  /** Décompte brut des réponses (toutes questions confondues). */
  answers: Record<AnswerValue, number>;
  /** Décompte des réponses par composante. */
  answersByComposante: Record<string, Record<AnswerValue, number>>;
  /** Constats : commentaires/observations renseignés sur les questions notées. */
  constats: { question: string; composante: string | null; answer: AnswerValue; text: string }[];
  /** Recommandations (champs texte « recommand… » du formulaire). */
  recommandations: string[];
}

export interface ScoreStat {
  moyen: number | null;
  max: number | null;
  min: number | null;
  count: number;
}

export interface CotationDist {
  level: CotationLevel;
  label: string;
  count: number;
  pct: number;
  color: string;
}

export interface NamedScore {
  name: string;
  score: number | null;
  count: number;
}

export interface TrendPoint {
  month: string;
  score: number | null;
  count: number;
}

export interface MonthlyMatrixRow {
  name: string;
  scores: Record<string, number | null>;
  first: number | null;
  last: number | null;
  variation: number | null;
}

export interface ComposanteScore {
  key: string;
  label: string;
  short: string;
  score: number | null;
}

/** Score d'une composante par mois (clé "YYYY-MM" → %). */
export interface ComposanteMonthly {
  key: string;
  label: string;
  short: string;
  scores: Record<string, number | null>;
}

export interface ComposanteAnswerDist {
  key: string;
  label: string;
  short: string;
  answers: Record<AnswerValue, number>;
}

export interface TopNonItem {
  question: string;
  nonCount: number;
  total: number;
  pct: number;
}

/** Agrégats pour un niveau de structure (antenne / zs / as). */
export interface LevelBundle {
  level: StructureLevel;
  records: number;
  /**
   * Décompte TOTAL des réponses du niveau (toutes questions notées du
   * formulaire, y compris celles sans composante reconnue) — source du
   * « Total questions administrées ».
   */
  answers: Record<AnswerValue, number>;
  score: ScoreStat;
  cotations: CotationDist[];
  perStructure: NamedScore[];
  composantes: ComposanteScore[];
  composanteAnswers: ComposanteAnswerDist[];
  /** Score par composante et par mois (évolution). */
  composantesMonthly: ComposanteMonthly[];
  trend: TrendPoint[];
  monthlyMatrix: MonthlyMatrixRow[];
  /** % mensuel de réponses « Oui » par structure (lignes = org units, colonnes = mois). */
  ouiMonthlyMatrix: { name: string; scores: Record<string, number | null> }[];
  topNon: TopNonItem[];
  radar: { entities: { name: string; values: number[] }[]; indicators: string[] };
  /** Constats & recommandations par structure (page « Constats & recommandations »). */
  constats: {
    name: string;
    constats: { question: string; composante: string | null; answer: AnswerValue; text: string }[];
    recommandations: string[];
  }[];
}

export interface KpiBlock {
  count: number;
  target: number | null;
  pct: number | null;
}

export interface SupervisionBundle {
  meta: {
    generatedAt: string;
    months: string[];
    sources: { level: StructureLevel; label: string; rows: number; ok: boolean; error?: string }[];
    totalRecords: number;
  };
  /** Options de filtres disponibles. */
  filters: {
    provinces: string[];
    antennes: string[];
    zones: string[];
    aires: string[];
    months: string[];
    types: string[];
    /** Tuples géographiques pour la cascade Province → Antenne → ZS → Aire. */
    geo: { province: string | null; antenne: string | null; zone: string | null; aire: string | null }[];
  };
  kpi: {
    antennes_total: KpiBlock;
    /** Réalisation trimestrielle des antennes (cible : 2 / trimestre). */
    antennes_trimestre: KpiBlock;
    zs_total: KpiBlock;
    as_total: KpiBlock;
    conjointe_pev_oms: KpiBlock;
    conjointe_mca: KpiBlock;
    auto_eval: KpiBlock;
    mca_seul: KpiBlock;
    ecz_seul: KpiBlock;
    antennes_sup: KpiBlock;
    zs_conjointe: KpiBlock;
    zs_mca: KpiBlock;
    cs_conjointe: KpiBlock;
    cs_ecz: KpiBlock;
    structures_conjointe: number;
    total_supervisions: number;
  };
  levels: Record<StructureLevel, LevelBundle>;
  /** Comparaisons spécifiques par type de supervision. */
  zsMca: NamedScore[];
  csEcz: NamedScore[];
  highlights: {
    bestLevel: { level: StructureLevel; label: string; score: number | null };
    worstLevel: { level: StructureLevel; label: string; score: number | null };
    /** Org-unité (antenne / ZS / aire) au meilleur score, tous niveaux confondus. */
    bestStructure: { level: StructureLevel; levelLabel: string; name: string; score: number | null } | null;
    /** Org-unité au score minimum, tous niveaux confondus. */
    worstStructure: { level: StructureLevel; levelLabel: string; name: string; score: number | null } | null;
    bestComposante: ComposanteScore | null;
    worstComposante: ComposanteScore | null;
    bestProgressAntenne: { name: string; from: number | null; to: number | null; delta: number | null } | null;
    alert: string | null;
  };
}

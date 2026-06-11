/** Types pour l'onglet « Qualité des données » (Contrôle Qualité — CQD). */

export type ConcordanceClass = "normal" | "sous" | "sur" | "na";

export interface CqdRecord {
  id: string;
  level: "zs" | "as";
  province: string | null;
  antenne: string | null;
  zone: string | null;
  aire: string | null;
  structure: string | null;
  month: string | null;
  typeLabel: string | null;
  // Sommes des antigènes par source (PENTA1/3, RR1/2).
  registre: { p1: number; p3: number; rr1: number; rr2: number };
  pointage: { p1: number; p3: number; rr1: number; rr2: number };
  snis: { p1: number; p3: number; rr1: number; rr2: number };
  dhis2: { p1: number; p3: number; rr1: number; rr2: number };
  // Discordances / valeurs vérifiées (transcription).
  nbValeursVerifiees: number;
  nbDiscordSnisDhis2: number;
  nbDiscordPointageRegistre: number;
  // Outils correctement remplis.
  registreCorrect: boolean | null;
  pointageCorrect: boolean | null;
  snisCorrect: boolean | null;
  // Enfants perdus de vue.
  enfantsARecuperer: number;
  enfantsIdentifies: number;
  enfantsRetrouves: number;
  enfantsRecuperes: number;
  /** Enfants manqués par antigène × tranche d'âge (si champs présents dans le formulaire). */
  manquesAntigene: Record<string, { a0_11: number; a12_23: number; a24_59: number }> | null;
  /** Liste des enfants manqués remise à l'équipe du CS (oui/non). */
  listeRemise: boolean | null;
}

export interface ConcordanceStat {
  /** Taux = DHIS2 / référence × 100. */
  taux: number | null;
  classe: ConcordanceClass;
}

/**
 * Concordance niveau CS par aire de santé : pour chaque antigène, le taux
 * mensuel (aligné sur le tableau `months` du bloc parent). Utilisé pour les
 * tableaux « Concordance par aire de santé » (SNIS/Registre et Registre/Pointage).
 */
export interface CqdConcordanceAS {
  name: string;
  zone: string | null;
  antigenes: { antigene: string; byMonth: (number | null)[] }[];
}

export interface CqdTrendPoint {
  month: string;
  concordanceP3: number | null;
  concordanceRr2: number | null;
  erreurSnisDhis2: number | null;
  erreurPointageRegistre: number | null;
  /** Taux d'erreur de transcription registre → SNIS (niveau CS, sans DHIS2). */
  erreurRegistreSnis: number | null;
}

export interface CqdLevelBundle {
  level: "zs" | "as";
  records: number;
  structuresControlees: number;
  /** Concordance globale PENTA3 / RR2 (DHIS2 vs référence). */
  concordanceP3: ConcordanceStat;
  concordanceRr2: ConcordanceStat;
  /** Taux global d'erreur de transcription (%). */
  erreurSnisDhis2: number | null;
  erreurPointageRegistre: number | null;
  /** Taux d'erreur de transcription registre → SNIS (niveau CS, sans DHIS2). */
  erreurRegistreSnis: number | null;
  /** Complétude des outils de gestion (%). */
  outils: { registre: number | null; pointage: number | null; snis: number | null };
  /** Enfants perdus de vue : identifiés / retrouvés / récupérés (%). */
  enfants: { aRecuperer: number; identifies: number; retrouves: number; recuperes: number; tauxRecuperes: number | null };
  /**
   * Enfants manqués par antigène × tranche d'âge (0–11 · 12–23 · 24–59 mois),
   * par structure — `available` est faux si le formulaire CQD n'expose pas
   * (encore) les champs antigène × âge.
   */
  manquesParAntigene: {
    available: boolean;
    antigenes: string[];
    structures: { name: string; values: Record<string, { a0_11: number; a12_23: number; a24_59: number }> }[];
  };
  /** % des listes d'enfants manqués remises aux équipes des centres de santé. */
  listesRemisesPct: number | null;
  /** Comparaison des antigènes (sommes) entre sources. */
  antigenes: { antigene: string; registre: number; pointage: number; snis: number; dhis2: number }[];
  /** Concordance DHIS2/référence et erreur SNIS↔DHIS2 par antigène (%). */
  parAntigene: { antigene: string; concordance: number | null; erreur: number | null }[];
  /** Évolution mensuelle. */
  trend: CqdTrendPoint[];
  /**
   * Concordance niveau CS (chaîne Fiche de pointage → Registre → SNIS).
   * Deux comparaisons : SNIS/Registre (SNIS transcrit du registre) et
   * Registre/Pointage (registre compilé depuis la feuille de pointage).
   * Cards globales (tous antigènes), graphique par antigène, tableaux mensuels.
   */
  csConcordance: {
    months: string[];
    /** Concordance globale tous antigènes confondus, toutes structures. */
    globalSnisRegistre: number | null;
    globalRegistrePointage: number | null;
    /** Concordance globale DHIS2/SNIS (niveau ZS). */
    globalDhis2Snis: number | null;
    /** Nombre d'AS en sous-/sur-rapportage (base SNIS/Registre). */
    asSousRapportage: number;
    asSurRapportage: number;
    /** Nombre de ZS en sous-/sur-rapportage (base DHIS2/SNIS). */
    zsSousRapportage: number;
    zsSurRapportage: number;
    /** Concordance globale par antigène (les trois comparaisons). */
    parAntigene: { antigene: string; snisRegistre: number | null; registrePointage: number | null; dhis2Snis: number | null }[];
    /** Tableaux mensuels par structure (aire de santé pour CS, zone pour ZS). */
    snisRegistre: CqdConcordanceAS[];
    registrePointage: CqdConcordanceAS[];
    dhis2Snis: CqdConcordanceAS[];
  };
  /** Détail par structure (concordance + erreur + outils + enfants). */
  parStructure: {
    name: string;
    zone: string | null;
    concordanceP3: number | null;
    classeP3: ConcordanceClass;
    concordanceRr2: number | null;
    classeRr2: ConcordanceClass;
    /** Concordance Registre/SNIS — niveau CS (pas de DHIS2 à ce niveau). */
    concordanceRsP3: number | null;
    classeRsP3: ConcordanceClass;
    concordanceRsRr2: number | null;
    classeRsRr2: ConcordanceClass;
    erreurSnisDhis2: number | null;
    erreurPointageRegistre: number | null;
    erreurRegistreSnis: number | null;
    registreOk: boolean | null;
    pointageOk: boolean | null;
    snisOk: boolean | null;
    outilsOk: number;
    enfantsIdentifies: number;
    enfantsRecuperes: number;
  }[];
}

export interface CqdBundle {
  meta: {
    generatedAt: string;
    months: string[];
    sources: { key: "zs" | "as"; label: string; rows: number; ok: boolean; error?: string }[];
  };
  filters: {
    provinces: string[]; antennes: string[]; zones: string[]; aires: string[]; months: string[]; types: string[];
    /** Tuples géographiques pour les filtres en cascade (dérivés des données CQD). */
    geo: { province: string | null; antenne: string | null; zone: string | null; aire: string | null }[];
  };
  levels: { zs: CqdLevelBundle; as: CqdLevelBundle };
}

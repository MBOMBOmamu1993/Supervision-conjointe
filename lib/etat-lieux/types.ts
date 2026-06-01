/** Types pour l'onglet « État de lieux » (Tshuapa). */

export interface EtatRow {
  [key: string]: string | number | null;
}

export interface EtatSheet {
  /** Clé technique de la feuille. */
  key: string;
  /** Libellé lisible. */
  label: string;
  /** En-têtes de colonnes (ordre d'affichage). */
  columns: string[];
  /** Lignes (objets clé=colonne). */
  rows: EtatRow[];
}

export interface EtatBundle {
  generatedAt: string;
  /** Indicateurs de synthèse (page 1 — informations générales). */
  summary: {
    antennes: number;
    zones: number;
    aires: number;
    essTotal: number | null;
    essVaccinent: number | null;
    popAdmin: number | null;
    popAjustee: number | null;
    cible0_11Admin: number | null;
    cible0_11Ajustee: number | null;
  };
  /** Couverture vaccinale ajustée par ZS (antigènes clés). */
  couverture: { zs: string; penta1: number | null; penta3: number | null; var1: number | null; vaa: number | null }[];
  /** Stratégies de vaccination réalisées (% par AS, agrégé par ZS). */
  strategiesParZs: { zs: string; fixes: number | null; avancees: number | null; mobiles: number | null; nbAs: number }[];
  /** Participation communautaire agrégée par ZS. */
  communautaireParZs: { zs: string; recoActifs: number; recoFormes: number; eglises: number; nbAs: number }[];
  /** Chaîne de froid — synthèse par ZS. */
  chaineFroidParZs: { zs: string; nbAs: number | null; asFrigo: number | null; cvFroid: number | null }[];
  /** Cartographie des interventions des partenaires (PTF) par ZS. */
  partenairesParZs: { zs: string; interventions: { partenaire: string; activite: string }[] }[];
  /** Informations générales par ZS (villages, CAC, etc.). */
  infoZs: EtatRow[];
  infoZsColumns: string[];
  /** Feuilles brutes additionnelles (tableaux détaillés). */
  sheets: EtatSheet[];
}

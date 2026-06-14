/**
 * Définition des onglets (modules) et de leurs pages — porté de `js/app.js`
 * du handoff. La navigation se fait par la barre latérale.
 */
export type PageLevel = "all" | "antenne" | "zs" | "as" | "none";

export interface PageDef {
  id: string;
  label: string;
  icon: string;
  lvl: PageLevel;
}
export interface ModuleDef {
  key: string;
  name: string;
  icon: string;
  tone: string;
  live: boolean;
  desc: string;
  pages?: PageDef[];
  groups?: { name: string; pages: PageDef[] }[];
}

export const MODULES: ModuleDef[] = [
  {
    key: "etat", name: "État de lieux", icon: "map", tone: "oms", live: true,
    desc: "Informations générales, accessibilité, planification, engagement communautaire et ressources de la province.",
    pages: [
      { id: "edl_infos", label: "Informations générales", icon: "legend", lvl: "all" },
      { id: "edl_planif", label: "Session de vaccination et cartographie communautaire", icon: "reco", lvl: "all" },
      { id: "edl_ressources", label: "Ressources & partenaires", icon: "form", lvl: "all" },
    ],
  },
  {
    key: "supervision", name: "Supervision conjointe", icon: "link", tone: "navy", live: true,
    desc: "Réalisation et résultats des supervisions — niveau d'affichage dynamique : Antennes → Zones de santé → Aires de santé selon les filtres.",
    pages: [
      { id: "sc_resultats", label: "Résultats de supervision", icon: "overview", lvl: "all" },
      { id: "sc_score", label: "Score de conformité", icon: "cotation", lvl: "all" },
      { id: "sc_comparaison", label: "Comparaison globale des scores", icon: "rank", lvl: "all" },
      { id: "sc_constats", label: "Constats & recommandations", icon: "reco", lvl: "all" },
    ],
  },
  {
    key: "qualite", name: "Contrôle qualité des données", icon: "quality", tone: "good", live: true,
    desc: "Concordance Pointage · Registre · SNIS · DHIS2, taux d'erreur et qualité des outils.",
    groups: [
      {
        name: "Centres de santé", pages: [
          { id: "cqd_cs_comparaison", label: "Comparaison sources", icon: "chart", lvl: "as" },
          { id: "cqd_cs_concordance", label: "Concordance des données", icon: "concord", lvl: "as" },
          { id: "cqd_cs_erreurs", label: "Erreurs de transcription", icon: "erreurs", lvl: "as" },
          { id: "cqd_cs_structures", label: "Comparaison par structure", icon: "rank", lvl: "as" },
          { id: "cqd_cs_triangulation", label: "Comparaison Doses des vaccins disponibles et Nombre de vaccinés", icon: "component", lvl: "as" },
          { id: "cqd_cs_outils", label: "Qualité outils", icon: "form", lvl: "as" },
          { id: "cqd_cs_enfants", label: "Enfants manqués", icon: "enfants", lvl: "as" },
        ],
      },
      {
        name: "Zones de santé", pages: [
          { id: "cqd_zs_comparaison", label: "Comparaison sources", icon: "chart", lvl: "zs" },
          { id: "cqd_zs_concordance", label: "Concordance des données", icon: "concord", lvl: "zs" },
          { id: "cqd_zs_erreurs", label: "Erreurs de transcription", icon: "erreurs", lvl: "zs" },
          { id: "cqd_zs_structures", label: "Comparaison par structure", icon: "rank", lvl: "zs" },
          { id: "cqd_zs_triangulation", label: "Comparaison Doses des vaccins disponibles et Nombre de vaccinés", icon: "component", lvl: "zs" },
        ],
      },
    ],
  },
  {
    key: "rcm", name: "Monitorage rapide de convenance", icon: "gauge", tone: "violet", live: true,
    desc: "Enfants manqués, statut vaccinal et raisons de non-vaccination (formulaire RCM Kobo).",
    pages: [
      { id: "rcm_vue", label: "Vue d'ensemble", icon: "overview", lvl: "all" },
      { id: "rcm_vaccination", label: "Vaccination", icon: "syringe", lvl: "all" },
      { id: "rcm_raisons", label: "Raisons", icon: "question", lvl: "all" },
      { id: "rcm_tableaux", label: "Tableaux", icon: "table", lvl: "all" },
    ],
  },
  {
    key: "sav", name: "SAV", icon: "route", tone: "warn", live: true,
    desc: "Semaine Africaine de Vaccination — identification des enfants manqués, planification, résultats et supervision des équipes.",
    pages: [
      { id: "sav_vue", label: "Vue d'ensemble", icon: "overview", lvl: "all" },
      { id: "sav_ident_cs", label: "Identification ZD/SV par CS", icon: "enfants", lvl: "all" },
      { id: "sav_ident_relais", label: "Identification relais", icon: "pin", lvl: "all" },
      { id: "sav_planif", label: "Planification", icon: "calendar", lvl: "all" },
      { id: "sav_resultats", label: "Résultats vaccination", icon: "syringe", lvl: "all" },
      { id: "sav_superv", label: "Supervision équipes", icon: "check", lvl: "all" },
    ],
  },
  {
    key: "rapport", name: "Rapport mensuel des consultants", icon: "report", tone: "teal", live: true,
    desc: "Suivi mensuel des activités des Assistants Techniques — vue d'ensemble & détails, planification, gestion des vaccins, chaîne de froid, prestation de services et FFOM (temps réel, formulaire Kobo actualisé).",
    pages: [
      { id: "rap_vue", label: "Vue d'ensemble & détails", icon: "overview", lvl: "all" },
      { id: "rap_planif", label: "Planification", icon: "calendar", lvl: "all" },
      { id: "rap_vaccins", label: "Gestion des vaccins", icon: "syringe", lvl: "all" },
      { id: "rap_cdf", label: "Chaîne de froid", icon: "gauge", lvl: "all" },
      { id: "rap_prestation", label: "Prestation de services", icon: "chart", lvl: "all" },
      { id: "rap_ffom", label: "FFOM & recommandations", icon: "message", lvl: "all" },
    ],
  },
  {
    key: "evaluation", name: "Évaluation des consultants", icon: "eval", tone: "danger", live: true,
    desc: "Évaluation de la performance des Assistants Techniques selon la grille officielle (8 composantes / 100 points, temps réel).",
    pages: [
      { id: "eval_vue", label: "Vue d'ensemble", icon: "overview", lvl: "all" },
      { id: "eval_classement", label: "Classement mensuel", icon: "rank", lvl: "all" },
      { id: "eval_composantes", label: "Performance par composante", icon: "component", lvl: "all" },
      { id: "eval_evolution", label: "Évolution des performances", icon: "up", lvl: "all" },
      { id: "eval_grille", label: "Grille de cotation", icon: "cotation", lvl: "all" },
    ],
  },
  {
    key: "telecharger", name: "Télécharger Bulletin mensuel de l'appui de l'OMS à Tshuapa PEV de routine", icon: "download", tone: "good", live: false,
    desc: "Génération automatique du bulletin mensuel (PowerPoint) — à venir.",
    pages: [
      { id: "tr_rapport", label: "Rapports automatisés", icon: "report", lvl: "none" },
    ],
  },
];

export const LVL_FILTERS: Record<PageLevel, string[]> = {
  all: ["province", "antenne", "zs", "as", "type", "periode"],
  antenne: ["province", "antenne", "type", "periode"],
  zs: ["province", "antenne", "zs", "type", "periode"],
  as: ["province", "antenne", "zs", "as", "type", "periode"],
  none: [],
};
export const LVL_LABEL: Record<PageLevel, string> = {
  all: "Tous les filtres", antenne: "Niveau Antenne", zs: "Niveau Zone de santé", as: "Niveau Aire de santé", none: "Aucun filtre",
};

export const moduleByKey = (k: string) => MODULES.find((m) => m.key === k);
export const pagesOf = (m: ModuleDef): PageDef[] => (m.groups ? m.groups.flatMap((g) => g.pages) : m.pages ?? []);
export const findPage = (m: ModuleDef, id: string) => pagesOf(m).find((p) => p.id === id);

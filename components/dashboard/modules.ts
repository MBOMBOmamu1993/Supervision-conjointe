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
      { id: "edl_planif", label: "Planification & communauté", icon: "reco", lvl: "all" },
      { id: "edl_ressources", label: "Ressources & partenaires", icon: "form", lvl: "all" },
    ],
  },
  {
    key: "supervision", name: "Supervision conjointe", icon: "link", tone: "navy", live: true,
    desc: "Réalisation, scores et cotations des supervisions Antenne · ZS · Aire de santé.",
    pages: [
      { id: "sc_vue", label: "Vue d'ensemble", icon: "overview", lvl: "all" },
      { id: "sc_antennes", label: "Antennes", icon: "antenne", lvl: "antenne" },
      { id: "sc_zones", label: "Zones de santé", icon: "zs", lvl: "zs" },
      { id: "sc_aires", label: "Aires de santé", icon: "as", lvl: "as" },
      { id: "sc_synthese", label: "Synthèse transversale", icon: "synthese", lvl: "all" },
    ],
  },
  {
    key: "qualite", name: "Qualité des données", icon: "quality", tone: "good", live: true,
    desc: "Concordance Pointage · Registre · SNIS · DHIS2, taux d'erreur et qualité des outils.",
    groups: [
      {
        name: "Centres de santé", pages: [
          { id: "cqd_cs_comparaison", label: "Comparaison sources", icon: "chart", lvl: "as" },
          { id: "cqd_cs_concordance", label: "Concordance", icon: "concord", lvl: "as" },
          { id: "cqd_cs_erreurs", label: "Erreurs", icon: "erreurs", lvl: "as" },
          { id: "cqd_cs_outils", label: "Qualité outils", icon: "form", lvl: "as" },
          { id: "cqd_cs_enfants", label: "Enfants manqués", icon: "enfants", lvl: "as" },
        ],
      },
      {
        name: "Zones de santé", pages: [
          { id: "cqd_zs_comparaison", label: "Comparaison sources", icon: "chart", lvl: "zs" },
          { id: "cqd_zs_concordance", label: "Concordance", icon: "concord", lvl: "zs" },
          { id: "cqd_zs_erreurs", label: "Erreurs", icon: "erreurs", lvl: "zs" },
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
  { key: "sav", name: "SAV", icon: "route", tone: "warn", live: false, desc: "Stratégies avancées de vaccination — à intégrer prochainement." },
  { key: "rapport", name: "Rapport hebdomadaire des consultants", icon: "report", tone: "teal", live: false, desc: "Suivi hebdomadaire des activités des consultants — à venir." },
  { key: "evaluation", name: "Évaluation des consultants", icon: "eval", tone: "danger", live: false, desc: "Évaluation de la performance des consultants — à venir." },
  {
    key: "telecharger", name: "Télécharger rapport", icon: "download", tone: "good", live: true,
    desc: "Génération automatique des rapports PEV & Contrôle qualité des données (PowerPoint).",
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

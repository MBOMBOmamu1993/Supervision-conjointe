"use client";

import SupervisionVueEnsemble from "./pages/SupervisionVueEnsemble";
import { SupervisionLevelPage, SupervisionSynthese } from "./pages/Supervision";
import {
  CqdCsComparaison, CqdCsConcordance, CqdCsErreurs, CqdCsOutils, CqdCsEnfants,
  CqdZsComparaison, CqdZsConcordance, CqdZsErreurs,
} from "./pages/Qualite";
import { RcmVue, RcmVaccination, RcmRaisons, RcmTableaux } from "./pages/Rcm";

/** id de page → composant de rendu (toutes les pages sont alimentées en LIVE). */
export const PAGE_REGISTRY: Record<string, () => JSX.Element> = {
  // Supervision conjointe
  sc_vue: SupervisionVueEnsemble,
  sc_antennes: () => <SupervisionLevelPage level="antenne" />,
  sc_zones: () => <SupervisionLevelPage level="zs" />,
  sc_aires: () => <SupervisionLevelPage level="as" />,
  sc_synthese: SupervisionSynthese,
  // Qualité des données — Centres de santé
  cqd_cs_comparaison: CqdCsComparaison,
  cqd_cs_concordance: CqdCsConcordance,
  cqd_cs_erreurs: CqdCsErreurs,
  cqd_cs_outils: CqdCsOutils,
  cqd_cs_enfants: CqdCsEnfants,
  // Qualité des données — Zones de santé
  cqd_zs_comparaison: CqdZsComparaison,
  cqd_zs_concordance: CqdZsConcordance,
  cqd_zs_erreurs: CqdZsErreurs,
  // Monitorage rapide de convenance
  rcm_vue: RcmVue,
  rcm_vaccination: RcmVaccination,
  rcm_raisons: RcmRaisons,
  rcm_tableaux: RcmTableaux,
};

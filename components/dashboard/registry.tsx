"use client";

import { SupervisionResultats, SupervisionScore, SupervisionComparaison, SupervisionConstats } from "./pages/Supervision";
import {
  CqdCsComparaison, CqdCsConcordance, CqdCsErreurs, CqdCsOutils, CqdCsEnfants, CqdCsStructures,
  CqdZsComparaison, CqdZsConcordance, CqdZsErreurs, CqdZsStructures,
} from "./pages/Qualite";
import { RcmVue, RcmVaccination, RcmRaisons, RcmTableaux } from "./pages/Rcm";
import { SavVue, SavIdentCs, SavIdentRelais, SavPlanif, SavResultats, SavSupervision } from "./pages/Sav";
import { RapVue, RapPlanification, RapVaccins, RapChaineFroid, RapPrestation, RapFfom } from "./pages/RapportAt";
import { EvalVue, EvalClassement, EvalComposantes, EvalEvolution, EvalGrille } from "./pages/EvaluationAt";
import { Edl1, Edl2, Edl3 } from "@/components/proto/etatlieux";
import TelechargerRapport from "@/app/telecharger-rapport/page";

/** id de page → composant de rendu (toutes les pages sont alimentées en LIVE). */
export const PAGE_REGISTRY: Record<string, () => JSX.Element> = {
  // Supervision conjointe — niveau d'org unit dynamique selon les filtres.
  // (Les anciens ids sc_antennes/sc_zones/sc_aires/sc_synthese ne sont plus dans
  // modules.ts : un lien enregistré retombe sur la première page du module.)
  sc_resultats: SupervisionResultats,
  sc_score: SupervisionScore,
  sc_comparaison: SupervisionComparaison,
  sc_constats: SupervisionConstats,
  // Qualité des données — Centres de santé
  cqd_cs_comparaison: CqdCsComparaison,
  cqd_cs_concordance: CqdCsConcordance,
  cqd_cs_erreurs: CqdCsErreurs,
  cqd_cs_structures: CqdCsStructures,
  cqd_cs_outils: CqdCsOutils,
  cqd_cs_enfants: CqdCsEnfants,
  // Qualité des données — Zones de santé
  cqd_zs_comparaison: CqdZsComparaison,
  cqd_zs_concordance: CqdZsConcordance,
  cqd_zs_erreurs: CqdZsErreurs,
  cqd_zs_structures: CqdZsStructures,
  // Monitorage rapide de convenance
  rcm_vue: RcmVue,
  rcm_vaccination: RcmVaccination,
  rcm_raisons: RcmRaisons,
  rcm_tableaux: RcmTableaux,
  // SAV — Semaine Africaine de Vaccination
  sav_vue: SavVue,
  sav_ident_cs: SavIdentCs,
  sav_ident_relais: SavIdentRelais,
  sav_planif: SavPlanif,
  sav_resultats: SavResultats,
  sav_superv: SavSupervision,
  // Rapport mensuel des consultants (AT) — refonte complète (maquette Word du
  // Dr Léandre, 12/06/2026) : Vue d'ensemble & détails + appuis techniques
  // (planification, vaccins, chaîne de froid, prestation) + FFOM.
  rap_vue: RapVue,
  rap_planif: RapPlanification,
  rap_vaccins: RapVaccins,
  rap_cdf: RapChaineFroid,
  rap_prestation: RapPrestation,
  rap_ffom: RapFfom,
  // Évaluation des consultants (AT)
  eval_vue: EvalVue,
  eval_classement: EvalClassement,
  eval_composantes: EvalComposantes,
  eval_evolution: EvalEvolution,
  eval_grille: EvalGrille,
  // État de lieux
  edl_infos: Edl1,
  edl_planif: Edl2,
  edl_ressources: Edl3,
  // Télécharger rapport
  tr_rapport: TelechargerRapport,
};

"use client";

import { SupervisionLevelPage, SupervisionSynthese } from "./pages/Supervision";
import {
  CqdCsComparaison, CqdCsConcordance, CqdCsErreurs, CqdCsOutils, CqdCsEnfants,
  CqdZsComparaison, CqdZsConcordance, CqdZsErreurs,
} from "./pages/Qualite";
import { RcmVue, RcmVaccination, RcmRaisons, RcmTableaux } from "./pages/Rcm";
import { SavVue, SavIdentCs, SavIdentRelais, SavPlanif, SavResultats, SavSupervision } from "./pages/Sav";
import { RapVue, RapReunions, RapSupervisions, RapMonitorage, RapSurveillance, RapOsp } from "./pages/RapportAt";
import { EvalVue, EvalClassement, EvalComposantes, EvalEvolution, EvalGrille } from "./pages/EvaluationAt";
import { Edl1, Edl2, Edl3 } from "@/components/proto/etatlieux";
import TelechargerRapport from "@/app/telecharger-rapport/page";

/** id de page → composant de rendu (toutes les pages sont alimentées en LIVE). */
export const PAGE_REGISTRY: Record<string, () => JSX.Element> = {
  // Supervision conjointe
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
  // SAV — Semaine Africaine de Vaccination
  sav_vue: SavVue,
  sav_ident_cs: SavIdentCs,
  sav_ident_relais: SavIdentRelais,
  sav_planif: SavPlanif,
  sav_resultats: SavResultats,
  sav_superv: SavSupervision,
  // Rapport mensuel des consultants (AT)
  rap_vue: RapVue,
  rap_reunions: RapReunions,
  rap_supervisions: RapSupervisions,
  rap_monitorage: RapMonitorage,
  rap_surveillance: RapSurveillance,
  rap_osp: RapOsp,
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

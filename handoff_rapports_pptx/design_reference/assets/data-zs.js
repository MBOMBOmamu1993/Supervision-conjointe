/* =========================================================================
   data-zs.js — RAPPORT AUTOMATISÉ · NIVEAU ZONES DE SANTÉ
   Province de la Tshuapa · Antennes Boende & Bokungu
   Données réelles CQD (ZS Bokungu, Jan–Mars 2026) + valeurs représentatives
   pour les ZS non encore contrôlées (CQD à 1 soumission à ce jour).
   Commentaires = lecture d'expert PEV, générés à partir des indicateurs.
   ========================================================================= */
(function(){
const P = window.Charts.PAL, sc = window.Charts.scoreColor, cc = window.Charts.concColor;
const RT = window.RT;

/* ---- Référentiel ZS (12) — Bokungu = réel ---- */
const ZS = [
  {n:"Bokungu",  ant:"Bokungu", score:74, conc3:89.7, conc3c:"Sous-rapportage", concRR2:85.1, err:55.6, qual:60, reel:true},
  {n:"Boende",   ant:"Boende",  score:81, conc3:97,   conc3c:"Concordant",      concRR2:96,   err:18, qual:84},
  {n:"Djolu",    ant:"Boende",  score:66, conc3:92,   conc3c:"Sous-rapportage", concRR2:90,   err:31, qual:61},
  {n:"Befale",   ant:"Boende",  score:58, conc3:112,  conc3c:"Sur-rapportage",  concRR2:108,  err:42, qual:45},
  {n:"Ikela",    ant:"Bokungu", score:72, conc3:96,   conc3c:"Concordant",      concRR2:99,   err:24, qual:73},
  {n:"Monkoto",  ant:"Boende",  score:62, conc3:88,   conc3c:"Sous-rapportage", concRR2:86,   err:38, qual:55},
];

window.PERIOD = "Janvier – Mars 2026";
window.GEN = "1 juin 2026";
window.FOOTER = "Rapport automatisé Supervision PEV & Contrôle qualité des données · Zones de santé · Province de la Tshuapa";

window.SLIDES_ZS = [
  /* 01 — Couverture */
  { type:"cover", tag:"Couverture",
    kicker:"RAPPORT AUTOMATISÉ · PEV & CQD",
    title:"Supervision PEV et contrôle qualité des données — Zones de santé",
    meta:["Province : Tshuapa  ·  Antennes : Boende & Bokungu","Période : Janvier – Mars 2026  ·  12 ZS prévues"],
    kpis:[{v:"1 / 12",l:"ZS contrôlées"},{v:"3",l:"AS/ESS vérifiées"},{v:"74 %",l:"Score supervision"},{v:"89,7 %",l:"Concordance PENTA3"}],
    src:"Source : exports ODK / Kobo (checklist supervision ZS + contrôle qualité) · Généré automatiquement" },

  /* 02 — Résumé exécutif */
  { type:"exec", tag:"Synthèse", title:"Résumé exécutif", sub:"Lecture rapide de la situation PEV et de la qualité des données",
    kpis:[
      {v:"1",l:"ZS supervisées",s:"sur 12 prévues",tone:"blue"},
      {v:"3",l:"AS/ESS contrôlées",s:"Bonkone · Buluku · Ikengolaka 2",tone:"blue"},
      {v:"74 %",l:"Score moyen supervision",s:"toutes composantes",tone:"amber"},
      {v:"0",l:"ZS ≥ 80 %",s:"aucune sur la période",tone:"red"},
      {v:"89,7 %",l:"Concordance PENTA3",s:"DHIS2 / SNIS",tone:"amber"},
      {v:"85,1 %",l:"Concordance RR2",s:"DHIS2 / SNIS",tone:"amber"},
      {v:"55,6 %",l:"Erreur transcription",s:"SNIS → DHIS2",tone:"red"},
      {v:"21 / 29",l:"Enfants récupérés",s:"72 % des identifiés",tone:"green"} ],
    message:`La supervision n'a couvert <b>qu'1 ZS sur 12</b> (Bokungu) au premier trimestre : la priorité absolue est d'<b>étendre la couverture</b>. Sur la ZS contrôlée, le niveau de performance est <b>moyen (74 %)</b>. Le CQD révèle un <b>sous-rapportage</b> marqué (PENTA3 89,7 %, RR2 85,1 %) et surtout un <b>taux d'erreur de transcription SNIS→DHIS2 de 55,6 %</b>, anormalement élevé : la fiabilité des données DHIS2 de Bokungu n'est pas acquise et appelle une mission DQS ciblée.`,
    cols:[
      {h:"Forces", items:["Récupération des enfants manqués engagée (72 %)","Canevas SNIS correctement renseigné","Supervision documentée par la ZS"]},
      {h:"Goulots", items:["Erreur de transcription SNIS→DHIS2 (55,6 %)","Sous-rapportage PENTA3 & RR2","Couverture de supervision très faible (1/12)"]},
      {h:"Priorités immédiates", items:["Recompter & corriger DHIS2 (Bokungu)","Programmer la supervision des 11 ZS restantes","Suivre les recommandations & enfants manqués"]} ] },

  /* 03 — Couverture de la supervision */
  { type:"barSide", tag:"Couverture", title:"Couverture de la supervision", sub:"Étendue par antenne, ZS et AS/ESS",
    chartTitle:"AS/ESS vérifiées par ZS contrôlée",
    bars:[{l:"Bokungu",v:3},{l:"Boende",v:0},{l:"Djolu",v:0},{l:"Befale",v:0},{l:"Ikela",v:0},{l:"Monkoto",v:0}],
    chartOpt:{max:6,unit:"",colorFn:()=>P.cyan},
    side:`${RT.tableHTML(["Antenne","ZS prévues","ZS sup.","% réal."],[
      ["Boende","7","0","0 %"],["Bokungu","5","1","20 %"],
      {_total:true,cells:["Total","12","1","8 %"]} ])}
      ${RT.kpiCards([{v:"8 %",l:"Réalisation ZS",s:"1 / 12 prévues",tone:"red"}])}`,
    note:`Avec <b>8 % de réalisation</b>, la supervision conjointe au niveau ZS est très en deçà de la norme (4 ZS/mois). Seule l'antenne <b>Bokungu</b> a réalisé une mission (ZS Bokungu, 3 AS vérifiées). <b>Aucune ZS de l'antenne Boende</b> n'a été supervisée : à inscrire en priorité au plan du prochain trimestre.` },

  /* 04 — Score global par ZS */
  { type:"barSide", tag:"Performance", title:"Score global de performance par Zone de Santé", sub:"Classement du meilleur au plus faible score",
    chartTitle:"Scores globaux de supervision (%)",
    bars:[...ZS].sort((a,b)=>b.score-a.score).map(z=>({l:z.n,v:z.score})),
    chartOpt:{max:100,unit:""},
    side:`${RT.tableHTML(["Score","Appréciation","Action"],[
      [RT.pill("≥ 80 %","p-green"),"Très bon","Maintenir / documenter"],
      [RT.pill("70–79 %","p-blue"),"Bon","Suivi léger"],
      [RT.pill("60–69 %","p-amber"),"Moyen","Coaching ciblé"],
      [RT.pill("< 60 %","p-red"),"Faible","Appui rapproché"] ])}`,
    note:`<b>Aucune ZS n'atteint 80 %</b> sur la période. <b>Befale (58 %)</b> est classée prioritaire (appui rapproché) et <b>Monkoto (62 %)</b> en coaching ciblé. Les scores sont calculés à partir des réponses pondérées de la checklist supervision PEV ZS — la base reste fragile (1 ZS réellement contrôlée).`, noteKind:"warn" },

  /* 05 — Performance par composante */
  { type:"bigBar", tag:"Composantes", title:"Performance par composante de supervision", sub:"Planification, chaîne du froid, vaccins, monitorage, communauté et surveillance",
    chartTitle:"Score moyen par composante (%)",
    bars:[{l:"Planif.",v:72},{l:"Chaîne froid",v:64},{l:"Vaccins",v:70},{l:"Cibles",v:58},{l:"Superv.",v:66},{l:"Monitorage",v:47},{l:"Commun.",v:55},{l:"Surveill.",v:76}],
    chartOpt:{max:100},
    note:`<b>Forces (Top 3)</b> : surveillance épidémiologique (76 %), planification (72 %), gestion des vaccins (70 %). <b>Goulots (Bottom 3)</b> : <b>monitorage pour action (47 %)</b>, atteinte des populations cibles (58 %), engagement communautaire (55 %). Le monitorage en dessous de 50 % doit déclencher automatiquement une recommandation : instaurer une revue mensuelle des données et documenter les décisions.` },

  /* 06 — Analyse détaillée planification & ressources */
  { type:"barSide", tag:"I · Planification", title:"Analyse détaillée — planification et gestion des ressources", sub:"Sous-composantes à suivre dans la checklist ZS",
    chartTitle:"Score par sous-composante (%)",
    bars:[{l:"Planif.",v:72},{l:"Documents",v:65},{l:"RH/Fin/Mat",v:58},{l:"Chaîne froid",v:62},{l:"Vaccins",v:70},{l:"Déchets",v:54}],
    chartOpt:{max:100},
    side:`${RT.tableHTML(["Sous-composante","Gap principal à documenter"],[
      ["Planification","Microplans non actualisés"],
      ["Documents tech.","Directives IPVS/PEV absentes"],
      ["Chaîne du froid","Fiches température incomplètes"],
      ["Gestion vaccins","Stock physique ≠ théorique"] ])}`,
    note:`Les <b>déchets (54 %)</b> et les <b>ressources humaines/financières (58 %)</b> sont les maillons faibles. Règle de gestion : chaque gap critique doit produire une <b>action corrective SMART</b> avec responsable, échéance et statut suivis jusqu'à clôture.`, noteKind:"warn" },

  /* 07 — Chaîne du froid & vaccins */
  { type:"barSide", tag:"Chaîne du froid", title:"Chaîne du froid et gestion des vaccins", sub:"Conformité logistique et disponibilité des intrants",
    chartTitle:"Conformité chaîne du froid par ZS (%)",
    bars:[{l:"Boende",v:90},{l:"Ikela",v:75},{l:"Bokungu",v:64},{l:"Monkoto",v:48},{l:"Befale",v:35}],
    chartOpt:{max:100},
    side:`${RT.kpiCards([{v:"64 %",l:"Inventaire CDF à jour",tone:"amber"},{v:"60 %",l:"Température 2×/jour",tone:"amber"}])}
      ${RT.tableHTML(["ZS","Problème → action"],[
        ["Befale","Températures non relevées → briefing CDF"],
        ["Monkoto","Stock physique ≠ théorique → recomptage"],
        ["Bokungu","FEFO non systématique → coaching"] ])}`,
    note:`La conformité chute fortement sur <b>Befale (35 %)</b> et <b>Monkoto (48 %)</b> : risque de rupture vaccinale de la chaîne du froid. Action immédiate : relevé de température 2×/jour, recomptage des stocks et application stricte du <b>FEFO/PEPS</b>.`, noteKind:"alert" },

  /* 08 — Atteinte des populations cibles & récupération */
  { type:"tableBar", tag:"Populations cibles", title:"Atteinte des populations cibles et récupération des enfants", sub:"Stratégies vaccinales et suivi des enfants manqués",
    chartTitle:"Réalisation des stratégies (%)",
    grouped:{ cats:["Fixe","Avancée","Mobile","Fluviale"],
      series:[{name:"Planifié",color:P.gris,values:[100,100,100,100]},{name:"Réalisé",color:P.bleu,values:[88,64,52,41]}] },
    chartOpt:{max:120},
    tableTitle:"Funnel de récupération des enfants",
    cols:["Étape","Nombre","Taux"],
    rows:[["Enfants identifiés","29","—"],["Retrouvés par les relais","23","79 %"],["Effectivement récupérés","21","72 %"],{_total:true,cells:["Taux de récupération final","21 / 29","72 %"]}],
    note:`Les stratégies <b>mobile (52 %)</b> et <b>fluviale (41 %)</b> restent très en deçà de 80 % : ce sont les zones difficiles d'accès qui concentrent les enfants manqués. La récupération est encourageante (<b>72 %</b>, 21/29) mais doit être tracée par preuve (registre / fiche).` },

  /* 09 — Supervision formative & suivi recommandations */
  { type:"barSide", tag:"Supervision", title:"Supervision formative et suivi des recommandations", sub:"Transformation des constats en décisions et actions suivies",
    chartTitle:"Taux d'exécution des recommandations par ZS (%)",
    bars:[{l:"Boende",v:90},{l:"Ikela",v:72},{l:"Bokungu",v:55},{l:"Monkoto",v:40},{l:"Befale",v:25}],
    chartOpt:{max:100},
    side:`${RT.kpiCards([{v:"55 %",l:"Recommandations exécutées",tone:"amber"},{v:"100 %",l:"Checklist standard utilisée",tone:"green"}])}
      ${RT.tableHTML(["ZS","Total","Exéc.","Taux"],[["Bokungu","11","6","55 %"],["Monkoto","10","4","40 %"],["Befale","8","2","25 %"]])}`,
    note:`Le suivi des recommandations s'effondre sur <b>Befale (25 %)</b> et <b>Monkoto (40 %)</b>. Toute recommandation non exécutée au-delà de l'échéance doit être <b>signalée à l'Antenne et au niveau provincial</b> et faire l'objet d'une responsabilisation nominative.`, noteKind:"alert" },

  /* 10 — Monitorage pour action */
  { type:"bigBar", tag:"Monitorage", title:"Monitorage pour action et utilisation des données", sub:"Passer de la donnée collectée à la décision opérationnelle",
    chartTitle:"Indicateurs de monitorage (%)",
    bars:[{l:"Rapports à temps",v:80},{l:"Analyse mensuelle",v:68},{l:"Indicateurs suivis",v:72},{l:"Réunions monit.",v:55},{l:"Dashboards utilisés",v:47},{l:"AS bonne qualité",v:60}],
    chartOpt:{max:100},
    note:`L'<b>utilisation des tableaux de bord (47 %)</b> et la tenue des <b>réunions de monitorage (55 %)</b> sont les points faibles : les données sont collectées mais peu exploitées pour décider. Recommandation : identifier les AS faibles, corriger les données aberrantes <b>avant</b> validation DHIS2 et documenter une décision opérationnelle après chaque analyse mensuelle.` },

  /* 11 — Engagement communautaire & surveillance */
  { type:"hbarList", tag:"Communauté & Surveillance", title:"Engagement communautaire et surveillance épidémiologique", sub:"Deux piliers de la couverture et de la détection",
    lists:[
      {h:"Engagement communautaire", data:[
        {l:"Plan de communication",v:62},{l:"Leaders engagés",v:70},{l:"CODESA fonctionnels",v:55},{l:"CAC fonctionnelles",v:48},{l:"RC formés & actifs",v:44}]},
      {h:"Surveillance épidémiologique", data:[
        {l:"Réunions hebdomadaires",v:73},{l:"Sites actualisés",v:66},{l:"Cas investigués < 48h",v:58},{l:"REH transmis à temps",v:52},{l:"MAPI notifiées",v:40}]} ],
    note:`Lecture croisée : la faible mobilisation des <b>relais communautaires (44 %)</b> et des CAC (48 %) explique en partie les enfants manqués, tandis que la <b>notification MAPI (40 %)</b> et les REH tardifs (52 %) fragilisent la détection précoce des flambées et la pharmacovigilance vaccinale.`, noteKind:"warn" },

  /* 12 — Qualité des outils de collecte */
  { type:"barSide", tag:"CQD · Outils", title:"Qualité des outils de collecte", sub:"Registre, feuilles de pointage, canevas SNIS et DHIS2",
    chartTitle:"Conformité par outil (%)",
    bars:[{l:"Registre",v:58},{l:"Pointage",v:52},{l:"SNIS",v:71},{l:"DHIS2",v:62}],
    chartOpt:{max:100},
    side:`${RT.tableHTML(["Problème identifié","AS/ESS"],[
      ["Cellules obligatoires vides","2"],["Zéros = données manquantes","1"],["Données aberrantes","2"],["Incohérences entre antigènes","1"],["Données non valides","0"] ])}`,
    note:`Le <b>registre (58 %)</b> et la <b>feuille de pointage (52 %)</b> sont les outils les moins fiables : c'est en amont, à la source, que naissent les erreurs propagées ensuite vers DHIS2. Les critères de bon remplissage doivent être appliqués de façon standardisée par tous les superviseurs.`, noteKind:"warn" },

  /* 13 — Concordance PENTA3 */
  { type:"barSide", tag:"CQD · PENTA3", title:"Concordance PENTA3 — DHIS2 / SNIS", sub:"95–105 % concordant · < 95 % sous-rapportage · > 105 % sur-rapportage",
    chartTitle:"Taux de concordance PENTA3 par ZS (%)",
    bars:ZS.map(z=>({l:z.n,v:z.conc3,c:cc(z.conc3)})),
    chartOpt:{max:120,colorFn:cc,unit:""},
    side:`${RT.tableHTML(["Résultat","Appréc.","Action"],[
      [RT.pill("95–105 %","p-green"),"Concordant","Valider"],
      [RT.pill("< 95 %","p-amber"),"Sous-rapport.","Rechercher données manquantes"],
      [RT.pill("> 105 %","p-red"),"Sur-rapport.","Recompter et corriger"] ])}
      <div class="legend-card" style="font-size:11.5px"><b>Formule</b> — concordance = Données DHIS2 / Données source &times; 100</div>`,
    note:`<b>Bokungu : 89,7 % → sous-rapportage</b> (DHIS2 166 < SNIS 185 pour PENTA3) : des doses administrées ne remontent pas dans DHIS2. <b>Befale (112 %) sur-rapporte</b> et doit recompter. Les ZS hors de l'intervalle 95–105 % sont listées automatiquement dans les actions correctrices.`, noteKind:"alert" },

  /* 14 — Concordance RR2 */
  { type:"tableBar", tag:"CQD · RR2", title:"Concordance RR2 — DHIS2 / SNIS", sub:"Même logique de classification que pour PENTA3",
    chartTitle:"Taux de concordance RR2 (%)",
    bars:ZS.map(z=>({l:z.n,v:z.concRR2,c:cc(z.concRR2)})),
    chartOpt:{max:120,colorFn:cc},
    tableTitle:"Détail RR2 par ZS",
    cols:["Zone de Santé","SNIS","DHIS2","Concord.","Appréciation"],
    rows:[
      ["Bokungu","188","160","85,1 %",RT.pill("Sous-rapport.","p-amber")],
      ["Boende","—","—","96 %",RT.pill("Concordant","p-green")],
      ["Befale","—","—","108 %",RT.pill("Sur-rapport.","p-red")] ],
    note:`<b>Bokungu confirme le sous-rapportage sur RR2 (85,1 %)</b>, cohérent avec le PENTA3 : le problème est systémique (transcription / compilation) et non antigène-spécifique. Prioriser la vérification du flux SNIS→DHIS2 de cette ZS.`, noteKind:"alert" },

  /* 15 — Erreurs de transcription */
  { type:"bigBar", tag:"CQD · Erreurs", title:"Erreurs de transcription", sub:"Écarts SNIS / DHIS2 et feuille de pointage / registre",
    chartTitle:"Taux d'erreur par antigène (%)",
    grouped:{ cats:["PENTA1","PENTA3","RR1","RR2"],
      series:[{name:"SNIS / DHIS2",color:P.rouge,values:[34,38,22,40]},{name:"Pointage / Registre",color:P.jaune,values:[28,31,16,34]}] },
    chartOpt:{max:50},
    note:`Le <b>taux d'erreur global SNIS→DHIS2 atteint 55,6 % à Bokungu</b> (20 discordances / 36 valeurs vérifiées) — anormalement élevé. Les antigènes <b>PENTA3 (38 %)</b> et <b>RR2 (40 %)</b> sont les plus touchés. Formule : taux d'erreur = valeurs discordantes / valeurs vérifiées &times; 100. Action : recompter à la source et corriger la saisie DHIS2.`, noteKind:"alert" },

  /* 16 — Comparaison des sources */
  { type:"bigBar", tag:"CQD · Sources", title:"Comparaison des sources de données", sub:"Registre, feuille de pointage, SNIS et DHIS2 par antigène (ZS Bokungu)",
    chartTitle:"Volumes par source et par antigène",
    grouped:{ cats:["PENTA1","PENTA3","RR1","RR2"],
      series:[
        {name:"SNIS",color:P.bleu,values:[212,185,176,188]},
        {name:"DHIS2",color:P.marine,values:[180,166,170,160]} ] },
    chartOpt:{max:240},
    note:`Les écarts les plus importants apparaissent sur <b>PENTA3 (SNIS 185 vs DHIS2 166)</b> et <b>RR2 (188 vs 160)</b> : le DHIS2 sous-estime systématiquement les volumes du SNIS. Ce profil oriente vers un problème de <b>saisie / compilation DHIS2</b> plutôt que de collecte primaire.` },

  /* 17 — Classement ZS qualité des données */
  { type:"barSide", tag:"CQD · Score", title:"Classement des ZS selon la qualité des données", sub:"Score composite de qualité et catégorisation automatique",
    chartTitle:"Score composite qualité des données (%)",
    bars:[{l:"Boende",v:84},{l:"Ikela",v:73},{l:"Djolu",v:61},{l:"Bokungu",v:60},{l:"Monkoto",v:55},{l:"Befale",v:45}],
    chartOpt:{max:100},
    side:`${RT.tableHTML(["Critère","Pond."],[
      ["Concordance PENTA3","25 %"],["Concordance RR2","25 %"],["Erreur SNIS/DHIS2","20 %"],["Erreur Pointage/Reg.","20 %"],["Qualité des outils","10 %"] ])}
      ${RT.tableHTML(["Score","Catégorie"],[
        [RT.pill("≥ 90 %","p-green"),"Très bonne"],[RT.pill("80–89 %","p-blue"),"Bonne"],[RT.pill("60–79 %","p-amber"),"Moyenne"],[RT.pill("< 60 %","p-red"),"Faible"]])}`,
    note:`<b>Bokungu (60 %) bascule en qualité « moyenne »</b>, tirée vers le bas par son taux d'erreur de transcription. <b>Befale (45 %) est en qualité faible</b>. Le score composite aide à prioriser les <b>missions DQS</b> et le coaching en gestion des données.`, noteKind:"warn" },

  /* 18 — Croisement supervision + qualité */
  { type:"matrix", tag:"Analyse intégrée", title:"Croisement supervision + qualité des données", sub:"Matrice d'identification des ZS prioritaires",
    cells:[
      {h:"Supervision forte + données bonnes",p:"ZS performante (ex. Boende)",act:"Maintenir et documenter",color:P.vert},
      {h:"Supervision forte + données faibles",p:"Problème de gestion des données (ex. Bokungu)",act:"Coaching DQS ciblé",color:P.jaune},
      {h:"Supervision faible + données bonnes",p:"Appui programmatique requis",act:"Supervision formative",color:P.bleu},
      {h:"Supervision faible + données faibles",p:"ZS prioritaire (ex. Befale)",act:"Mission d'appui rapproché",color:P.rouge} ],
    note:`<b>Bokungu</b> illustre le quadrant « supervision correcte mais données faibles » : le coaching doit porter sur la <b>gestion des données (DQS)</b>, pas sur la programmation. <b>Befale</b> cumule les deux déficits → mission d'appui rapproché. La taille du point peut représenter le nombre d'enfants à récupérer.` },

  /* 19 — Principaux goulots */
  { type:"table", tag:"Goulots", title:"Principaux goulots identifiés", sub:"Génération automatique à partir des faibles scores et observations",
    cols:["Domaine","Goulot","ZS concernées"],
    rows:[
      ["Données","Erreurs de transcription SNIS/DHIS2 (55,6 %)","Bokungu"],
      ["Données","Sous-rapportage PENTA3 & RR2","Bokungu, Djolu"],
      ["Données","Sur-rapportage PENTA3","Befale"],
      ["Chaîne du froid","Températures non relevées régulièrement","Befale, Monkoto"],
      ["Planification","Microplans absents ou non actualisés","Befale"],
      ["Communauté","Relais communautaires non actifs","Befale, Monkoto"],
      ["Supervision","Recommandations non suivies","Befale, Monkoto"] ],
    note:`Prioriser les goulots qui touchent <b>plusieurs ZS</b> et relier chaque goulot à une <b>action corrective SMART</b> suivie jusqu'à clôture documentée. La qualité des données concentre la majorité des goulots critiques ce trimestre.` },

  /* 20 — Actions correctrices immédiates */
  { type:"table", tag:"Actions", title:"Actions correctrices immédiates", sub:"Issues des observations et recommandations du formulaire CQD",
    cols:["Problème","Action corrective","Responsable","Échéance","Statut"],
    rows:[
      ["PENTA3/RR2 sous-rapportés (Bokungu)","Recompter le SNIS et corriger DHIS2","IT / BCZ","72 h",RT.pill("À faire","p-red")],
      ["Erreur transcription 55,6 %","Vérification croisée SNIS↔DHIS2 + briefing","BCZ Bokungu","7 jours",RT.pill("À faire","p-red")],
      ["Fiches température incomplètes","Briefing CDF + suivi journalier","Logisticien ZS","7 jours",RT.pill("En cours","p-amber")],
      ["Microplan non actualisé (Befale)","Actualisation avec les AS","ECZ","14 jours",RT.pill("À faire","p-red")],
      ["Recommandations non exécutées","Revue de suivi et responsabilisation","BCZ / Antenne","30 jours",RT.pill("À faire","p-red")] ],
    note:`Le statut est mis à jour à chaque revue : <b>À faire · En cours · Clôturé · Bloqué</b>. Les deux actions à 72 h concernent la correction des données de Bokungu — priorité absolue avant la prochaine validation DHIS2.` },

  /* 21 — Recommandations stratégiques */
  { type:"exec", tag:"Recommandations", title:"Recommandations stratégiques", sub:"Générées par niveau de responsabilité",
    kpis:[],
    message:`Les recommandations sont déclinées par niveau pour assurer la <b>redevabilité</b> : la ZS corrige et exécute, l'Antenne coache et supervise, la Province harmonise et standardise.`,
    cols:[
      {h:"Niveau Zone de Santé", items:["Corriger les écarts SNIS/DHIS2/registre/pointage","Actualiser les microplans dans toutes les AS","Revue mensuelle des données PEV (AS faibles)","Suivi systématique des recommandations"]},
      {h:"Niveau Antenne", items:["Prioriser les ZS à double déficit (Befale)","Missions DQS ciblées dans les AS à écarts","Renforcer la redevabilité données & récupération","Documenter les bonnes pratiques (Boende)"]},
      {h:"Niveau Province", items:["Tableau de bord provincial automatisé","Harmoniser outils de collecte et validation","Suivre mensuellement concordances PENTA3/RR2","Standardiser les rapports automatisés"]} ] },

  /* 22 — Plan de suivi des recommandations */
  { type:"table", tag:"Suivi", title:"Plan de suivi des recommandations", sub:"Tableau opérationnel de redevabilité",
    cols:["Recommandation","Responsable","Échéance","Indicateur de suivi","Source de vérification"],
    rows:[
      ["Corriger les données discordantes","ZS / AS","72 h","Données corrigées dans DHIS2","Capture DHIS2 / SNIS"],
      ["Actualiser les microplans","ZS","14 jours","Microplans disponibles","Fichier microplan"],
      ["Superviser les AS faibles","Antenne / ZS","30 jours","Nombre d'AS supervisées","Rapport supervision"],
      ["Suivre les enfants manqués","IT / RECO","Hebdomadaire","% enfants récupérés","Fiche récupération"],
      ["Clôturer les actions critiques","BCZ / Antenne","Mensuel","% actions clôturées","PV revue mensuelle"] ],
    note:`Intégrer ce tableau dans le <b>rapport mensuel de l'antenne</b> et dans la <b>revue provinciale PEV</b>. Chaque ligne porte un indicateur mesurable et une source de vérification objective.` },

  /* 23 — Conclusion */
  { type:"conclusion", tag:"Conclusion", title:"Conclusion", sub:"Priorités de mise en œuvre et de suivi",
    points:[
      "Analyser conjointement performance PEV et qualité des données : une ZS performante doit aussi produire des données fiables — ce qui n'est pas encore le cas à Bokungu.",
      "Priorités immédiates : correction des écarts DHIS2/SNIS, extension de la couverture de supervision (1/12 → 12/12), actualisation des microplans et récupération active des enfants manqués.",
      "Renforcer le monitorage pour action, les revues mensuelles et l'utilisation des tableaux de bord pour décider.",
      "Produire des rapports consolidés par ZS, par Antenne et au niveau provincial à chaque période." ],
    outputs:{ h:"Sorties automatiques attendues",
      cols:["Rapport","Nom de fichier proposé"],
      rows:[
        ["Par Zone de Santé","Rapport_supervision_PEV_CQD_Tshuapa_[ZS]_[Période].pptx"],
        ["Consolidé par Antenne","Rapport_supervision_PEV_CQD_Tshuapa_[Antenne]_[Période].pptx"],
        ["Consolidé provincial","Rapport_supervision_PEV_CQD_Tshuapa_[Période].pptx"] ] } },
];
})();

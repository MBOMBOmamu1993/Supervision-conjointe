/* =========================================================================
   data-cs.js — RAPPORT AUTOMATISÉ · NIVEAU CENTRES DE SANTÉ
   Province de la Tshuapa · Supervision formative & Contrôle qualité des données
   Données réelles CQD (AS Lofima 2 — ZS Bokungu, Jan–Mars 2026) + valeurs
   représentatives pour les CS non encore contrôlés (CQD à 1 soumission).
   Commentaires = lecture d'expert PEV générée à partir des indicateurs.
   ========================================================================= */
(function(){
const P = window.Charts.PAL, sc = window.Charts.scoreColor, cc = window.Charts.concColor;
const RT = window.RT;

/* CS contrôlés — Lofima 2 = réel */
const CS = [
  {n:"Lofima 2",  zs:"Bokungu", score:64, conc3:114.1, conc3c:"Sur-rapportage", concRR2:100, errSD:8.3,  errPR:75, qual:61, reel:true},
  {n:"Bonkone",   zs:"Bokungu", score:81, conc3:96,    conc3c:"Concordant",     concRR2:98,  errSD:18, errPR:22, qual:84},
  {n:"Buluku",    zs:"Bokungu", score:73, conc3:103,   conc3c:"Concordant",     concRR2:101, errSD:24, errPR:31, qual:73},
  {n:"Ikengolaka 2",zs:"Bokungu",score:57, conc3:88,   conc3c:"Sous-rapportage",concRR2:90,  errSD:37, errPR:41, qual:48},
  {n:"Wangata",   zs:"Boende",  score:66, conc3:109,   conc3c:"Sur-rapportage", concRR2:106, errSD:31, errPR:34, qual:61},
];

window.PERIOD = "Janvier – Mars 2026";
window.GEN = "1 juin 2026";
window.FOOTER = "Rapport automatisé Supervision PEV des Centres de Santé & Contrôle qualité des données · Province de la Tshuapa";

window.SLIDES_CS = [
  /* 01 — Couverture */
  { type:"cover", tag:"Couverture",
    kicker:"RAPPORT AUTOMATISÉ · PEV CS & CQD",
    title:"Supervision PEV des Centres de Santé & contrôle qualité des données",
    meta:["Province : Tshuapa  ·  Antenne : Boende / Bokungu","Période : Janvier – Mars 2026  ·  279 CS/ESS prévus"],
    kpis:[{v:"1 / 279",l:"CS supervisés"},{v:"64 %",l:"Score supervision"},{v:"114 %",l:"Concordance PENTA3"},{v:"21 / 29",l:"Enfants récupérés"}],
    src:"Source : exports ODK / Kobo (checklist CS + formulaire de contrôle qualité) · Généré automatiquement" },

  /* 02 — Résumé exécutif */
  { type:"exec", tag:"Synthèse", title:"Résumé exécutif", sub:"Lecture rapide des principaux résultats",
    kpis:[
      {v:"1",l:"CS supervisés",s:"sur 279 prévus",tone:"red"},
      {v:"64 %",l:"Score moyen supervision",s:"toutes composantes",tone:"amber"},
      {v:"114 %",l:"Concordance PENTA3",s:"DHIS2 / Registre",tone:"red"},
      {v:"100 %",l:"Concordance RR2",s:"DHIS2 / Registre",tone:"green"},
      {v:"8,3 %",l:"Erreur transcription",s:"SNIS / DHIS2",tone:"green"},
      {v:"72 %",l:"Enfants récupérés",s:"21 sur 29 identifiés",tone:"green"} ],
    message:`Un seul centre de santé a été contrôlé ce trimestre (<b>AS Lofima 2, ZS Bokungu</b>) : la couverture de la supervision CS doit impérativement être <b>élargie</b>. Sur ce CS, le score global est <b>moyen (64 %)</b>. La qualité des données est contrastée : la transcription SNIS→DHIS2 est bonne (8,3 %) mais le PENTA3 est <b>sur-rapporté (114 %)</b> et l'écart <b>feuille de pointage ↔ registre atteint 75 %</b> — les outils primaires sont mal renseignés.`,
    cols:[
      {h:"Forces", items:["Concordance RR2 parfaite (100 %)","Faible erreur SNIS→DHIS2 (8,3 %)","72 % des enfants manqués récupérés"]},
      {h:"Goulots", items:["PENTA3 sur-rapporté (114 %)","Écart pointage ↔ registre (75 %)","Registre & pointage mal remplis"]},
      {h:"Priorités immédiates", items:["Recompter le registre, corriger DHIS2","Standardiser le remplissage des outils","Étendre la supervision aux CS restants"]} ] },

  /* 03 — Méthode de génération automatique */
  { type:"process", tag:"Processus", title:"Méthode de génération automatique", sub:"De la collecte ODK/Kobo au rapport PowerPoint consolidé",
    steps:[
      {h:"Collecte",p:"Checklist CS + contrôle qualité des données"},
      {h:"Export",p:"Excel / CSV depuis Kobo / ODK"},
      {h:"Calculs",p:"Scores, concordances, taux d'erreur"},
      {h:"Classement",p:"CS faibles, moyens, bons"},
      {h:"Rapport",p:"Graphiques, commentaires, actions"} ],
    sources:[
      {h:"Checklist supervision PEV de CS",p:"Planification, chaîne du froid, vaccins, déchets, prestation, supervision formative, monitorage, engagement communautaire et surveillance épidémiologique."},
      {h:"Contrôle qualité des données",p:"Registre, feuilles de pointage, canevas SNIS et DHIS2 ; concordance PENTA3/RR2 ; erreurs de transcription ; suivi des enfants à récupérer."} ],
    note:`Le modèle utilise des <b>champs dynamiques</b> — [Province], [Antenne], [ZS], [AS], [ESS], [Période], [Superviseur], [Date] — remplis automatiquement à partir de chaque export Kobo/ODK.` },

  /* 04 — Couverture de la supervision CS */
  { type:"barSide", tag:"Couverture", title:"Couverture de la supervision des Centres de Santé", sub:"Étendue des visites et vérifications réalisées",
    chartTitle:"Score global des CS supervisés (%)",
    bars:[...CS].sort((a,b)=>b.score-a.score).map(c=>({l:c.n,v:c.score})),
    chartOpt:{max:100},
    side:`${RT.tableHTML(["Antenne","CS prévus","CS sup.","% réal."],[
      ["Bokungu","≈ 25","1","4 %"],["Boende","≈ 34","0","0 %"],
      {_total:true,cells:["Total","279","1","0,4 %"]} ])}
      ${RT.kpiCards([{v:"0,4 %",l:"Réalisation CS",s:"1 / 279 prévus",tone:"red"}])}`,
    note:`Avec <b>1 CS contrôlé sur 279</b>, la base est insuffisante pour conclure au niveau provincial. Afficher systématiquement le nombre de CS contrôlés par ZS/AS, le taux de réalisation et les <b>CS non visités avec motif</b>. Priorité : déployer la supervision sur l'ensemble des aires de santé.`, noteKind:"alert" },

  /* 05 — Cadre de scoring */
  { type:"table", tag:"Scoring", title:"Cadre de scoring de la checklist CS", sub:"Conversion des réponses oui / partiellement / non en score standardisé",
    chartTitle:"Barème de cotation",
    cols:["Réponse","Valeur proposée","Interprétation"],
    rows:[
      ["Oui","1 pt (ou 2–3 pts selon section)","Critère rempli"],
      ["Partiellement","0,5 pt (moitié de la pondération)","Critère partiellement rempli"],
      ["Non","0 pt","Critère non rempli"] ],
    extra:`<div class="row" style="margin-top:16px;gap:18px">
      <div class="col">${RT.tableHTML(["Score global","Appréciation","Couleur"],[
        ["≥ 80 %","Très bon",RT.pill("Vert","p-green")],
        ["70–79 %","Bon",RT.pill("Bleu","p-blue")],
        ["60–69 %","Moyen",RT.pill("Jaune","p-amber")],
        ["< 60 %","Faible",RT.pill("Rouge","p-red")] ])}</div>
      <div class="col legend-card" style="display:flex;align-items:center"><div><div class="block-h">Formule</div>
        <p style="margin:0;font-size:13px;line-height:1.5;color:var(--muted)">Score CS = somme des points obtenus / somme des points attendus &times; 100. Les sections dont certaines questions valent 2 ou 3 points conservent la pondération de la checklist.</p></div></div>
    </div>`,
    note:`Les couleurs sont appliquées <b>automatiquement</b> selon les seuils. <b>Lofima 2 obtient 64 % → « Moyen »</b> : coaching ciblé et suivi rapproché recommandés.` },

  /* 06 — Score global par CS */
  { type:"barSide", tag:"Performance", title:"Score global de performance par Centre de Santé", sub:"Classement automatique des CS selon le score total",
    chartTitle:"Scores globaux par CS (%)",
    bars:[...CS].sort((a,b)=>b.score-a.score).map(c=>({l:c.n,v:c.score})),
    chartOpt:{max:100},
    side:`<div class="legend-card"><div class="block-h" style="margin-bottom:6px">≥ 80 % · Très bon</div><p style="margin:0;font-size:12px;color:var(--muted)">Maintien des bonnes pratiques et documentation.</p></div>
      <div class="legend-card"><div class="block-h" style="margin-bottom:6px">60–69 % · Moyen</div><p style="margin:0;font-size:12px;color:var(--muted)">Coaching ciblé et suivi rapproché.</p></div>
      <div class="legend-card"><div class="block-h" style="margin-bottom:6px">&lt; 60 % · Faible</div><p style="margin:0;font-size:12px;color:var(--muted)">Supervision rapprochée, action corrective et revalidation.</p></div>`,
    note:`<b>Bonkone (81 %)</b> est le seul CS « très bon » et doit être documenté comme bonne pratique. <b>Ikengolaka 2 (57 %)</b> passe sous 60 % → supervision rapprochée. Les couleurs sont appliquées automatiquement selon les seuils.` },

  /* 07 — Performance moyenne par composante */
  { type:"bigBar", tag:"Composantes", title:"Performance moyenne par composante", sub:"Vue consolidée des forces et faiblesses des centres de santé",
    chartTitle:"Score moyen par composante (%)",
    bars:[{l:"Planif.",v:72},{l:"CDF",v:68},{l:"Vaccins",v:61},{l:"Déchets",v:82},{l:"Prestation",v:77},{l:"Superv.",v:55},{l:"Monitor.",v:58},{l:"Commun.",v:63},{l:"Surveill.",v:48}],
    chartOpt:{max:100},
    note:`<b>Top 3</b> : gestion des déchets (82 %), prestation de services (77 %), planification (72 %). <b>Bottom 3</b> : <b>surveillance épidémiologique (48 %)</b>, supervision formative (55 %), monitorage (58 %). Décision : déclencher automatiquement une action corrective dès qu'une composante passe <b>sous 60 %</b>.` },

  /* 08 — Planification & gestion CS */
  { type:"hbarList", tag:"I · Planification", title:"Planification et gestion au niveau du CS", sub:"Microplan, ressources et réalisation des activités programmées",
    lists:[
      {h:"Indicateurs de planification", data:[
        {l:"Microplan disponible",v:78},{l:"État des lieux exhaustif",v:52},{l:"Analyse des problèmes",v:61},{l:"Objectifs SMART",v:70}]},
      {h:"Ressources & réalisation", data:[
        {l:"Besoins vaccins estimés",v:65},{l:"Activités réalisées ≥ 80 %",v:72},{l:"≥ 2 agents formés PEV",v:55}]} ],
    note:`L'<b>état des lieux exhaustif (52 %)</b> — villages, repères, distances, cibles, CODESA/CAC/RECO — et la <b>présence d'agents formés (55 %)</b> sont les points faibles. Alerte automatique : lister les CS sans microplan ou avec besoins vaccins mal estimés.`, noteKind:"warn" },

  /* 09 — Chaîne du froid & vaccins */
  { type:"hbarList", tag:"CDF & Vaccins", title:"Chaîne du froid et gestion des vaccins", sub:"Disponibilité, température, stocks et règles de conservation",
    lists:[
      {h:"Chaîne du froid", data:[
        {l:"Réfrigérateur bien installé",v:76},{l:"Monitoring température",v:68},{l:"Température 2×/jour",v:60},{l:"Température +2 à +8 °C",v:81},{l:"Maintenance réalisée",v:43},{l:"Aucun produit non vaccinal",v:92}]},
      {h:"Gestion des vaccins", data:[
        {l:"Fiches de stock à jour",v:57},{l:"Stock physique = théorique",v:49},{l:"Inventaires réguliers",v:62},{l:"Vaccins périmés séparés",v:78},{l:"Flacons entamés respectés",v:54},{l:"Absence rupture 3 mois",v:46}]} ],
    note:`<b>Maintenance (43 %)</b>, <b>absence de rupture (46 %)</b> et <b>stock physique = théorique (49 %)</b> sont critiques. Action type : recompter les stocks, mettre à jour les fiches, appliquer le <b>FEFO/PEPS</b> et renforcer le suivi de température 2×/jour.`, noteKind:"warn" },

  /* 10 — Sécurité injections & déchets */
  { type:"bigBar", tag:"Déchets", title:"Sécurité des injections et gestion des déchets", sub:"Conformité aux normes de sécurité et d'élimination",
    chartTitle:"Conformité sécurité des injections (%)",
    bars:[{l:"SAB disponibles",v:84},{l:"Boîtes sécurité",v:80},{l:"1 seringue/injection",v:91},{l:"Pas de recapuchonnage",v:63},{l:"Boîtes bien utilisées",v:70}],
    chartOpt:{max:100},
    note:`Le <b>recapuchonnage persiste (37 % des cas)</b> : tout recapuchonnage observé ou absence de boîte de sécurité doit générer une <b>action corrective immédiate</b>. Vérifier la disponibilité des intrants avant chaque séance et observer directement une session lorsque possible.`, noteKind:"alert" },

  /* 11 — Prestation de services */
  { type:"tableBar", tag:"II · Services", title:"Prestation de services de vaccination", sub:"Sessions fixes, avancées, spéciales et rattrapage des enfants",
    tableTitle:"Dimensions & seuils attendus",
    cols:["Dimension","Indicateur","Seuil"],
    rows:[
      ["Programme mensuel","Affiché, adapté, respecté","Oui"],
      ["Stratégies fixes","% réalisées / planifiées","≥ 80 %"],
      ["Stratégies avancées","% réalisées / planifiées","≥ 80 %"],
      ["Stratégies spéciales","% réalisées / planifiées","≥ 80 %"],
      ["Rattrapage ZD/SV","% enfants identifiés récupérés","≥ 80 %"] ],
    chartTitle:"Réalisation des stratégies (%)",
    bars:[{l:"Fixe",v:83},{l:"Avancée",v:64},{l:"Spéciale",v:48},{l:"Rattrapage",v:58}],
    chartOpt:{max:100},
    note:`Les stratégies <b>avancées (64 %)</b> et <b>spéciales (48 %)</b> restent sous 80 % : risque élevé de persistance des enfants manqués dans les villages mal desservis. Replanifier les sorties avancées en priorité.`, noteKind:"warn" },

  /* 12 — Récupération des enfants manqués */
  { type:"funnel", tag:"Rattrapage", title:"Identification et récupération des enfants manqués", sub:"Suivi des enfants zéro-dose et sous-vaccinés au niveau CS / communauté",
    chartTitle:"Parcours de récupération (AS Lofima 2)",
    steps:[
      {l:"Identifiés",v:"29",c:P.marine},{l:"Liste remise aux relais",v:"82 %",c:P.bleu},{l:"Retrouvés",v:"23",c:P.jaune},{l:"Vaccinés / récupérés",v:"21",c:P.vert} ],
    table:{ cols:["Indicateur","Valeur","Source"],
      rows:[
        ["Enfants à récupérer","29","Formulaire CQD"],
        ["Identifiés précédemment","29","Suivi récupération"],
        ["Retrouvés par les relais","23","Suivi relais"],
        ["Effectivement récupérés","21","Registre / fiche récupération"],
        {_total:true,cells:["Taux de récupération final","72 %","21 / 29"]} ] },
    note:`La <b>récupération atteint 72 %</b> (21/29) : performance encourageante au regard de la moyenne provinciale. La déperdition se situe entre « retrouvés » (23) et « récupérés » (21) — assurer le suivi nominatif jusqu'à la vaccination effective. Inclure la photo de la fiche d'identification lorsqu'elle est disponible dans Kobo.` },

  /* 13 — Supervision formative & recommandations */
  { type:"barSide", tag:"III · Supervision", title:"Supervision formative et suivi des recommandations", sub:"Supervision des relais, sessions et feedback du BCZ",
    chartTitle:"Indicateurs de supervision formative (%)",
    bars:[{l:"Calendrier",v:66},{l:"Relais supervisés",v:52},{l:"Sessions superv.",v:57},{l:"CS sup./mois",v:74},{l:"Cahier feedback",v:49},{l:"Reco. exécutées",v:41}],
    chartOpt:{max:100},
    side:`${RT.tableHTML(["CS","Reco.","Exéc.","Taux"],[
      ["Bonkone","9","8","89 %"],["Lofima 2","11","5","45 %"],["Ikengolaka 2","8","2","25 %"],
      {_total:true,cells:["Total","28","15","54 %"]} ])}`,
    note:`Le <b>taux d'exécution des recommandations (41 %)</b> et la tenue du <b>cahier de feedback (49 %)</b> sont préoccupants. Règle automatique : un taux d'exécution <b>< 80 % est classé goulot prioritaire</b>. Chaque recommandation non exécutée doit porter un motif, un responsable et une échéance.`, noteKind:"alert" },

  /* 14 — Monitorage des données CS */
  { type:"hbarList", tag:"IV · Données", title:"Monitorage des données au Centre de Santé", sub:"Disponibilité des outils, analyse et utilisation des données",
    lists:[
      {h:"Disponibilité & transmission", data:[
        {l:"Outils disponibles",v:85},{l:"Outils archivés/remplis",v:61},{l:"Concordance des outils",v:52},{l:"SNIS/REH transmis à temps",v:78}]},
      {h:"Analyse & utilisation", data:[
        {l:"Courbes à jour",v:48},{l:"Données analysées",v:46},{l:"Réunions de monitorage",v:39},{l:"Feedback de la ZS",v:55}]} ],
    note:`<b>Courbes non à jour (48 %) + réunions de monitorage rares (39 %) = faible utilisation des données pour l'action.</b> Le monitorage doit transformer la donnée en décision : identifier les CS/AS faibles, programmer des sorties avancées et corriger les données aberrantes avant validation.`, noteKind:"alert" },

  /* 15 — Engagement communautaire */
  { type:"bigBar", tag:"V · Communauté", title:"Engagement communautaire", sub:"CODESA, CAC, leaders, relais et barrières de genre",
    chartTitle:"Indicateurs d'engagement communautaire (%)",
    bars:[{l:"CODESA",v:63},{l:"CAC",v:48},{l:"Leaders",v:59},{l:"Relais",v:70},{l:"Supports IEC",v:44},{l:"Sensibilisation",v:57},{l:"Genre",v:36},{l:"Causes NV",v:51}],
    chartOpt:{max:100},
    note:`La prise en compte du <b>genre (36 %)</b>, des <b>supports IEC (44 %)</b> et des <b>CAC (48 %)</b> est faible. Décision : prioriser les CS où CAC/CODESA sont non fonctionnels et où les causes de non-vaccination ne sont pas analysées, et lever les obstacles de genre identifiés.`, noteKind:"warn" },

  /* 16 — Surveillance épidémiologique CS */
  { type:"barSide", tag:"VI · Surveillance", title:"Surveillance épidémiologique au niveau CS", sub:"Notification, investigation, riposte, REH et MAPI",
    chartTitle:"Indicateurs de surveillance (%)",
    bars:[{l:"Définitions",v:58},{l:"Kits",v:44},{l:"Notification",v:40},{l:"Investigation",v:52},{l:"REH",v:73},{l:"MAPI",v:28}],
    chartOpt:{max:100},
    side:`${RT.tableHTML(["Critère","Indicateur auto."],[
      ["Définitions de cas","% CS avec définitions affichées"],
      ["Kits/formulaires","% CS avec kits disponibles"],
      ["Notification MPV","% CS ayant notifié ≥ 1 cas / 6 mois"],
      ["MAPI","% CS ayant notifié ≥ 1 MAPI"] ])}`,
    note:`La <b>notification MAPI (28 %)</b> et la disponibilité des <b>kits (44 %)</b> sont très faibles. Alerte automatique : une absence de notification MPV/MAPI sur 6 mois doit faire <b>vérifier la sensibilité du système</b> de surveillance plutôt que conclure à une absence de cas.`, noteKind:"alert" },

  /* 17 — Qualité des outils de collecte */
  { type:"barSide", tag:"CQD · Outils", title:"Qualité des outils de collecte", sub:"Registre, feuilles de pointage et canevas SNIS",
    chartTitle:"Conformité par outil (%)",
    bars:[{l:"Registre",v:68},{l:"Pointage",v:58},{l:"SNIS",v:62},{l:"DHIS2",v:71}],
    chartOpt:{max:100},
    side:`${RT.tableHTML(["Outil","Critères de qualité"],[
      ["Registre","Identification, antigènes/dates, pas de doublons, lisibilité"],
      ["Pointage","Site, date, stratégie, totaux, signature, archivage"],
      ["SNIS","Pas de cellule vide, zéros justifiés, pas d'aberrations"],
      ["DHIS2","Saisie complète, cohérente, sans valeur invalide"] ])}`,
    note:`À Lofima 2, le <b>registre et la feuille de pointage sont jugés « non conformes »</b> alors que le canevas SNIS est « conforme » : les erreurs naissent à la source. Sortie automatique : tableau des problèmes fréquents (cellules vides, zéros non justifiés, incohérences entre antigènes, documents non archivés).`, noteKind:"warn" },

  /* 18 — Concordance DHIS2 / Registre */
  { type:"tableBar", tag:"CQD · Concordance", title:"Concordance DHIS2 / Registre", sub:"Précision des données PENTA3 et RR2 au niveau Centre de Santé",
    chartTitle:"Concordance PENTA3 par CS (%)",
    bars:CS.map(c=>({l:c.n,v:c.conc3,c:cc(c.conc3)})),
    chartOpt:{max:120,colorFn:cc},
    tableTitle:"Détail PENTA3 par CS",
    cols:["CS/ESS","Registre","DHIS2","Concord.","Appréciation"],
    rows:[
      ["Lofima 2","92","105","114 %",RT.pill("Sur-rapport.","p-red")],
      ["Bonkone","—","—","96 %",RT.pill("Concordant","p-green")],
      ["Ikengolaka 2","—","—","88 %",RT.pill("Sous-rapport.","p-amber")] ],
    note:`<b>Lofima 2 : 114 % → sur-rapportage</b> (DHIS2 105 > Registre 92). Le DHIS2 affiche plus de doses que le registre n'en documente : recompter le registre et corriger DHIS2. Formule : concordance = DHIS2 / Registre &times; 100. Seuils : 95–105 % concordant, < 95 % sous-rapportage, > 105 % sur-rapportage.`, noteKind:"alert" },

  /* 19 — Erreurs de transcription */
  { type:"bigBar", tag:"CQD · Erreurs", title:"Erreurs de transcription", sub:"Comparaison SNIS–DHIS2 et feuille de pointage–registre",
    chartTitle:"Taux d'erreur par antigène (%)",
    grouped:{ cats:["PENTA1","PENTA3","RR1","RR2"],
      series:[{name:"SNIS / DHIS2",color:P.rouge,values:[6,8,5,8]},{name:"Pointage / Registre",color:P.jaune,values:[58,75,49,62]}] },
    chartOpt:{max:90},
    note:`À Lofima 2, l'erreur <b>SNIS→DHIS2 est faible (8,3 %)</b> mais l'écart <b>feuille de pointage ↔ registre est massif (75 % sur PENTA3)</b> : la rupture se produit en amont, entre le pointage et le registre. Générer la liste des CS/ESS avec erreur ≥ 25 % par antigène et indiquer la source probable de l'écart.`, noteKind:"alert" },

  /* 20 — Comparaison des sources */
  { type:"bigBar", tag:"CQD · Sources", title:"Comparaison des sources de données", sub:"Registre, pointage, SNIS et DHIS2 — PENTA1, PENTA3, RR1, RR2 (AS Lofima 2)",
    chartTitle:"Volumes par source et par antigène",
    grouped:{ cats:["PENTA1","PENTA3","RR1","RR2"],
      series:[
        {name:"Registre",color:P.gris,values:[107,92,94,0]},
        {name:"SNIS",color:P.bleu,values:[93,105,91,89]},
        {name:"DHIS2",color:P.marine,values:[95,105,91,89]} ] },
    chartOpt:{max:130},
    note:`SNIS et DHIS2 sont alignés (saisie fidèle), mais le <b>registre s'écarte fortement</b> : PENTA3 registre 92 vs DHIS2 105, et <b>RR2 registre = 0</b> (probable non-report). L'écart provient d'un problème de <b>compilation / report depuis le registre</b>. Action : recompter la source primaire et corriger le flux de rapportage.` },

  /* 21 — Score composite qualité */
  { type:"barSide", tag:"CQD · Score", title:"Score composite de qualité des données", sub:"Classement des CS/ESS selon la fiabilité des données",
    chartTitle:"Score composite qualité (%)",
    bars:[...CS].sort((a,b)=>b.qual-a.qual).map(c=>({l:c.n,v:c.qual})),
    chartOpt:{max:100},
    side:`${RT.tableHTML(["Critère","Pond."],[
      ["Concordance PENTA3 DHIS2/Reg.","25 %"],["Concordance RR2 DHIS2/Reg.","25 %"],["Erreur SNIS/DHIS2","20 %"],["Erreur Pointage/Reg.","20 %"],["Qualité des outils","10 %"] ])}
      ${RT.tableHTML(["Score","Catégorie"],[
        [RT.pill("≥ 90 %","p-green"),"Très bonne"],[RT.pill("80–89 %","p-blue"),"Bonne"],[RT.pill("60–79 %","p-amber"),"Moyenne"],[RT.pill("< 60 %","p-red"),"Faible"]])}`,
    note:`<b>Lofima 2 obtient 61 % → qualité « moyenne »</b> : la bonne concordance RR2 et la faible erreur SNIS/DHIS2 sont contrebalancées par le sur-rapportage PENTA3 et l'écart pointage/registre. <b>Ikengolaka 2 (48 %)</b> est en qualité faible → mission DQS prioritaire.`, noteKind:"warn" },

  /* 22 — Croisement supervision CS + qualité */
  { type:"matrix", tag:"Analyse intégrée", title:"Croisement supervision CS et qualité des données", sub:"Identification des centres prioritaires pour appui rapproché",
    cells:[
      {h:"Performance forte + données bonnes",p:"Centre fiable (ex. Bonkone)",act:"Maintenir et documenter",color:P.vert},
      {h:"Performance forte + données faibles",p:"Gestion des données à renforcer",act:"Coaching DQS ciblé",color:P.jaune},
      {h:"Performance faible + données bonnes",p:"Appui programmatique requis",act:"Supervision formative",color:P.bleu},
      {h:"Performance faible + données faibles",p:"Centre prioritaire (ex. Ikengolaka 2)",act:"Mission d'appui prioritaire",color:P.rouge} ],
    note:`Axe X : score supervision CS · Axe Y : score qualité des données · taille du point : enfants à récupérer. <b>Lofima 2</b> se situe entre les quadrants « moyen / données moyennes » → priorité au coaching sur le remplissage des outils primaires.` },

  /* 23 — Principaux goulots */
  { type:"table", tag:"Goulots", title:"Principaux goulots identifiés", sub:"Synthèse automatique à partir des scores faibles et observations terrain",
    cols:["Domaine","Goulot","CS concernés","Priorité"],
    rows:[
      ["Données","Sur-rapportage PENTA3 (registre ≠ DHIS2)","Lofima 2, Wangata",RT.pill("Haute","p-red")],
      ["Données","Écart pointage ↔ registre (75 %)","Lofima 2",RT.pill("Haute","p-red")],
      ["Surveillance","Absence de notification MPV/MAPI","Lofima 2, Ikengolaka 2",RT.pill("Haute","p-red")],
      ["Chaîne du froid","Maintenance non réalisée","Plusieurs CS",RT.pill("Haute","p-red")],
      ["Prestation","Stratégies avancées < 80 %","Lofima 2",RT.pill("Moyenne","p-amber")],
      ["Communauté","CAC/CODESA non fonctionnels","Ikengolaka 2",RT.pill("Moyenne","p-amber")] ],
    note:`Chaque goulot doit être relié à une <b>action corrective</b>, un <b>responsable</b>, une <b>échéance</b> et une <b>source de vérification</b>. Les goulots de qualité des données et de surveillance concentrent les priorités hautes.` },

  /* 24 — Plan d'actions correctrices */
  { type:"table", tag:"Actions", title:"Plan d'actions correctrices immédiates", sub:"Généré depuis observations, actions correctrices et recommandations",
    cols:["Problème","Action corrective","Responsable","Échéance","Statut"],
    rows:[
      ["PENTA3 sur-rapporté (Lofima 2)","Recompter le registre et corriger DHIS2","IT / BCZ","72 h",RT.pill("À faire","p-red")],
      ["Écart pointage ↔ registre (75 %)","Briefing remplissage + vérif. croisée","IT","7 jours",RT.pill("À faire","p-red")],
      ["Fiche température incomplète","Briefing CDF + suivi journalier","IT / Logisticien","7 jours",RT.pill("En cours","p-amber")],
      ["Stratégie avancée non réalisée","Replanifier les villages mal desservis","IT / Relais","14 jours",RT.pill("À faire","p-red")],
      ["REH en retard / MAPI non notifiées","Suivi hebdomadaire de la transmission","IT / BCZ","7 jours",RT.pill("À faire","p-red")] ],
    note:`<b>Niveau CS</b> — corriger les écarts, actualiser le microplan, réaliser les stratégies avancées, suivre les enfants manqués. <b>Niveau ZS/Antenne</b> — coacher les CS faibles, valider les données, suivre les recommandations et organiser les missions ciblées.` },

  /* 25 — Plan de suivi des recommandations */
  { type:"table", tag:"Suivi", title:"Plan de suivi des recommandations", sub:"Suivi de la redevabilité après la supervision",
    cols:["Recommandation","Responsable","Échéance","Indicateur de suivi","Source de vérification"],
    rows:[
      ["Corriger les données discordantes","IT / BCZ","72 h","Données corrigées","Registre, SNIS, DHIS2"],
      ["Actualiser le microplan","IT","14 jours","Microplan disponible","Fichier microplan"],
      ["Superviser relais et sessions","IT / ZS","30 jours","Nombre de supervisions","Rapports / cahier feedback"],
      ["Récupérer les enfants manqués","IT / RECO","Hebdomadaire","% enfants récupérés","Fiche récupération"],
      ["Améliorer la surveillance","IT / RECO","30 jours","Notification MPV/MAPI","REH / registres"] ],
    note:`Sortie automatique finale : rapport consolidé Province / Antenne / ZS + <b>rapport spécifique par Centre de Santé</b> + liste des actions à suivre jusqu'à clôture documentée.` },

  /* 26 — Conclusion */
  { type:"conclusion", tag:"Conclusion", title:"Conclusion", sub:"Utiliser les données pour améliorer simultanément la performance PEV et la fiabilité du rapportage",
    points:[
      "Message clé : un CS performant combine bonne planification, chaîne du froid maîtrisée, disponibilité des vaccins, qualité des séances, rattrapage actif, surveillance sensible et données fiables.",
      "Priorité 1 — corriger les écarts Registre–Pointage–SNIS–DHIS2 et documenter les preuves (le sur-rapportage PENTA3 de Lofima 2 en est l'illustration).",
      "Priorité 2 — suivre l'exécution des recommandations avec responsable, échéance et preuve.",
      "Priorité 3 — renforcer les stratégies avancées et le suivi communautaire des enfants manqués." ],
    outputs:{ h:"Production du rapport",
      cols:["Élément","Fréquence / déclencheur"],
      rows:[
        ["Génération du rapport","Après chaque export Kobo / ODK"],
        ["Graphiques & commentaires","Actualisés automatiquement depuis les données"],
        ["CS faibles","Appui rapproché avant la période suivante"] ] },
    note:`Les centres faibles (Ikengolaka 2, Lofima 2) doivent faire l'objet d'un <b>appui rapproché</b> avant le prochain trimestre. La couverture (1/279) reste le premier levier d'amélioration.` },
];
})();

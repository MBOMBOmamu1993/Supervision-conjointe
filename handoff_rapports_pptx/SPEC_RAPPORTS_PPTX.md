# Spec — Génération automatique des 2 rapports PowerPoint (PEV & CQD · Tshuapa)

> **Remplace l'ancien `06_RAPPORTS_PPTX.md`.** On ne génère plus 3 rapports « simplifiés »
> mais **2 rapports enrichis** alignés sur les 2 modèles PDF officiels :
> 1. `Rapport_automatise_supervision_PEV_CQD_ZS_Tshuapa.pdf` (23 diapos)
> 2. `Rapport_automatise_supervision_PEV_CQD_Centres_Sante_Tshuapa.pdf` (26 diapos)

## 0. Référence visuelle = obligatoire à reproduire
Le dossier **`design_reference/`** contient l'aperçu HTML **complet et fidèle** des deux
rapports (mêmes diapos, mêmes graphiques épurés, mêmes KPI, mêmes commentaires d'expert PEV) :

| Fichier | Rôle |
|---|---|
| `design_reference/Rapport_Supervision_CQD_ZS.html` | Rapport ZS — 23 diapos, rendu cible |
| `design_reference/Rapport_Supervision_CQD_CS.html` | Rapport CS — 26 diapos, rendu cible |
| `design_reference/index.html` | Page d'accueil (onglet « Télécharger Rapport ») |
| `design_reference/assets/charts.js` | **Rendu exact des graphiques épurés** (barres, barres groupées, jauge, funnel, barres horizontales) |
| `design_reference/assets/report.css` | Système visuel (bandeau, KPI, tableaux, callout « LECTURE PEV ») |
| `design_reference/assets/build.js` | Gabarits de diapo (cover, exec, barSide, bigBar, table, tableBar, gauges, hbarList, funnel, matrix, process, conclusion) |
| `design_reference/assets/data-zs.js` / `data-cs.js` | **Contenu diapo-par-diapo + textes des commentaires** |

Ouvrez les deux HTML dans un navigateur : **ce rendu EST la spécification.** Le PPTX doit
être visuellement équivalent. Les fichiers `data-*.js` donnent, diapo par diapo, le titre,
le sous-titre, les KPI, les séries de graphiques et **le texte exact du commentaire**.

---

## 1. Livrables
Deux fichiers `.pptx` 16:9 (33,87 × 19,05 cm / 1280×720 pt de design) :

| Rapport | Nom de fichier | Diapos |
|---|---|---|
| Zones de santé | `Rapport_supervision_PEV_CQD_Tshuapa_[ZS]_[Période].pptx` | 23 |
| Centres de santé | `Rapport_supervision_PEV_CQD_Tshuapa_CS_[AS]_[Période].pptx` | 26 |

Génération **dynamique** depuis les données du tableau de bord (filtre période/ZS/AS appliqué),
via **`pptxgenjs`** côté serveur (route API `app/api/rapports/[type]/route.ts`).
Bouton « Télécharger .pptx » dans l'onglet **Télécharger Rapport** → déclenche la génération.

---

## 2. RÈGLES DE DESIGN DES GRAPHIQUES (demande explicite)
**AUCUNE ligne en arrière-plan.** Concrètement, pour chaque graphique pptxgenjs :

```js
// barres / barres groupées
chartColors: [...],            // voir palette ci-dessous
showValue: true,               // valeur posée AU-DESSUS de la barre
dataLabelColor: '363636', dataLabelFontFace:'Arial', dataLabelFontSize: 11, dataLabelFontBold:true,
valAxisHidden: true,           // PAS d'axe vertical
valGridLine: { style: 'none' },// PAS de quadrillage horizontal
catGridLine: { style: 'none' },// PAS de quadrillage vertical
valAxisLineShow: false,
catAxisLineShow: true, catAxisLineColor:'CDD7E6', // fine ligne de base seulement
showLegend: <true si séries multiples>, legendPos:'r', legendFontSize:10,
barGapWidthPct: 45, chartArea:{ fill:{color:'FFFFFF'} }, plotArea:{ fill:{color:'FFFFFF'} },
```
- Barres simples : **couleur par seuil** (voir §3). Barres groupées : couleur par série.
- Pas de titre de graphique intégré (le titre est un `addText` au-dessus, style `.block-h`).
- Jauges/donuts : `doughnut` à 2 segments (valeur + reste gris `EEF2F7`), `holeSize:62`,
  `% au centre` via `addText`. Pas de légende.
- Funnel : 4 cartes `addText` + flèches `→` (pas un vrai « funnel chart »).

> Garde-fou : si une diapo du PDF d'origine montrait un quadrillage, **on l'enlève**.
> Le rendu `charts.js` (SVG) montre l'objectif exact : barres pleines, étiquette au sommet,
> une seule ligne de base discrète, fond blanc.

---

## 3. Palette & typo
- Marine OMS `#00205c` / `#013a86` (bandeaux) · liseré cyan `#0093d5`.
- **Seuils de score** : Très bon `#1f9d57` (≥80) · Bon `#0093d5` (70–79) · Moyen `#f59e0b` (60–69) · Faible `#e23636` (<60).
- **Concordance** : Concordant `#1f9d57` (95–105 %) · Sous-rapportage `#f59e0b` (<95 %) · Sur-rapportage `#e23636` (>105 %).
- Texte `#16243d`, secondaire `#5b6b86`, lignes `#e3e9f2`, fond doux `#f4f7fb`.
- Police : **IBM Plex Sans** (substitut PPTX : **Arial**). Mono : IBM Plex Mono → **Consolas**.
- Logo **OMS blanc** + **PEV** à l'extrême gauche de chaque bandeau (`assets/oms-white.png`, `assets/pev.png`).

## 4. Gabarit de diapo (identique pour les deux rapports)
1. **Bandeau** marine (≈ 90 pt de haut) : logos à gauche · titre MAJUSCULES + sous-titre · à droite tag mono + n° de diapo · liseré cyan 4 pt en bas.
2. **Corps** blanc.
3. **Pied** : à gauche le libellé du rapport ; à droite `Période · Source ODK/Kobo/Excel · Généré le [date]`.
4. **Callout « LECTURE PEV »** (commentaire dynamique) : bandeau bas, fond bleu clair `#eef5fc` (warn = orange `#fff5ec`, alerte = rouge `#fdeeee`), petite pastille mono « LECTURE PEV » / « ALERTE PEV ».

---

## 5. COMMENTAIRES DYNAMIQUES — logique « expert PEV »
Chaque diapo porte un commentaire **généré à partir des valeurs**, pas un texte figé. Règles :

- **Concordance** : `tx<95` → « sous-rapportage : des doses ne remontent pas dans DHIS2 → rechercher les données manquantes » ; `95–105` → « concordant → valider » ; `tx>105` → « sur-rapportage → recompter le registre et corriger DHIS2 ». Toujours nommer l'unité (ZS/CS) et citer les volumes (`DHIS2 X vs SNIS/Registre Y`).
- **Score / composante** : citer Top 3 et Bottom 3 ; déclencher une recommandation dès qu'une composante < 60 %.
- **Erreur de transcription** : citer le `% global` et l'antigène le plus touché ; rappeler la formule `discordances / vérifiées ×100` ; si ≥ 25 % → action corrective.
- **Couverture** : si réalisé ≪ prévu → « étendre la couverture » en priorité (mentionner le ratio réel, ex. 1/12, 1/279).
- **Récupération enfants** : citer `récupérés / identifiés` et le point de déperdition.
- **Seuils de criticité** : `kind = 'alert'` (rouge) si concordance hors plage, erreur ≥ 25 %, score < 60 %, notification MPV/MAPI absente ; `'warn'` (orange) si zone grise ; sinon `'read'`.

Le texte exact attendu pour chaque diapo (déjà rédigé en expert PEV) est dans `data-zs.js` /
`data-cs.js`, champ `note` (et `noteKind`). Reprenez-les comme **gabarits de template literals**
en réinjectant les variables calculées.

---

## 6. Mapping KOBO (données réelles — voir `data/cq-data.js`)
Formulaires : Contrôle qualité **ZS** `ajhW22rQEkVs39SuhBuwCC` · **CS/AS** `aaQZRLWXQ6rpTWr3uR3SEU`
(même projet/token Kobo que la supervision). Mois = multi-select « Sélectionner les mois à vérifier ».

**CQ ZS** — `s_snis_p1/p3/rr1/rr2`, `s_dhis2_p1/p3/rr1/rr2`, `tx_concordance_penta3` + `classe_*`,
`tx_concordance_rr2` + `classe_*`, `tx_erreur_snis_dhis2`, `nb_val_verif`, `nb_discord_total`, `score_dhis2_pct`.
**CQ CS** — `total_registre_*`, `total_pointage_*`, `total_snis_*`, `total_dhis2_*`,
`tx_concordance_penta3` + `classe_*`, `tx_concordance_rr2`, `tx_erreur_snis_dhis2`,
`tx_erreur_pointage_registre`, remplissage `registre/pointage/snis`, enfants (à récupérer / identifiés / retrouvés / récupérés).

Données réelles actuelles (1 soumission/niveau, Jan–Mars 2026) :
- **ZS Bokungu** : PENTA3 89,7 % (sous-rapportage), RR2 85,1 % (sous-rapportage), erreur SNIS/DHIS2 55,6 % (20/36), saisie DHIS2 60 % ; 3 AS : Bonkone, Buluku, Ikengolaka 2.
- **AS Lofima 2 (ZS Bokungu)** : PENTA3 114,1 % (sur-rapportage), RR2 100 % (concordant), erreur SNIS/DHIS2 8,3 %, erreur pointage/registre 75 % ; registre & pointage « non conformes », SNIS « conforme » ; enfants 21/29 récupérés (72 %).

Scores de supervision et composantes : depuis les checklists supervision **ZS** / **CS** (mêmes
agrégats que les pages du dashboard). Tant que la couverture est partielle, n'afficher que les
unités réellement renseignées et le commentaire signale la base partielle.

---

## 7. CONTENU DIAPO-PAR-DIAPO

### RAPPORT 1 — ZONES DE SANTÉ (23 diapos) — cf. `data-zs.js`
1. **Couverture** (titre, province/antennes/période, 4 KPI socle).
2. **Résumé exécutif** — 8 KPI (ZS sup., AS contrôlées, score moyen, ZS≥80%, conc. PENTA3, conc. RR2, erreur transcription, enfants récupérés) + message auto + Forces / Goulots / Priorités.
3. **Couverture de la supervision** — barres AS/ESS par ZS + table antenne (prévues/sup./%/AS) + KPI réalisation.
4. **Score global par ZS** — barres triées (couleur par seuil) + table d'appréciation.
5. **Performance par composante** — 8 composantes (Planif., chaîne du froid, vaccins, cibles, supervision, monitorage, communauté, surveillance) + Top3/Bottom3.
6. **Analyse détaillée planification & ressources** — barres sous-composantes + table des gaps.
7. **Chaîne du froid & vaccins** — barres conformité par ZS + KPI (inventaire, température) + table problèmes→actions.
8. **Atteinte des populations cibles & récupération** — barres groupées Planifié/Réalisé (Fixe/Avancée/Mobile/Fluviale) + table funnel enfants.
9. **Supervision formative & suivi des recommandations** — barres taux d'exécution par ZS + KPI + table.
10. **Monitorage pour action** — barres 6 indicateurs.
11. **Engagement communautaire & surveillance** — 2 listes de barres horizontales.
12. **Qualité des outils de collecte** — barres par outil + table problèmes/AS.
13. **Concordance PENTA3 DHIS2/SNIS** — barres par ZS (couleur par concordance) + table seuils + formule.
14. **Concordance RR2** — barres + table détail par ZS.
15. **Erreurs de transcription** — barres groupées par antigène (SNIS/DHIS2 vs Pointage/Registre).
16. **Comparaison des sources** — barres groupées SNIS vs DHIS2 par antigène.
17. **Classement ZS qualité des données** — barres score composite + table pondération + table catégories.
18. **Croisement supervision + qualité** — matrice 2×2.
19. **Principaux goulots** — table domaine/goulot/ZS.
20. **Actions correctrices immédiates** — table problème/action/responsable/échéance/statut.
21. **Recommandations stratégiques** — 3 colonnes ZS / Antenne / Province.
22. **Plan de suivi des recommandations** — table redevabilité.
23. **Conclusion** — bullets + table des sorties (noms de fichiers).

### RAPPORT 2 — CENTRES DE SANTÉ (26 diapos) — cf. `data-cs.js`
1. Couverture. 2. Résumé exécutif (6 KPI + message + forces/goulots/priorités).
3. **Méthode de génération** (process 5 étapes + sources). 4. Couverture supervision CS (barres scores CS + table antenne).
5. **Cadre de scoring** (table réponse→valeur + table seuils/couleur + formule). 6. Score global par CS.
7. Performance par composante (9 composantes). 8. Planification & gestion (listes de barres horizontales).
9. Chaîne du froid & vaccins (14 indicateurs, 2 colonnes). 10. Sécurité injections & déchets.
11. Prestation de services (table seuils + barres stratégies). 12. **Récupération des enfants** (funnel + table).
13. Supervision formative & recommandations. 14. Monitorage des données. 15. Engagement communautaire (8 indicateurs).
16. Surveillance épidémiologique (barres + table critères). 17. Qualité des outils.
18. **Concordance DHIS2/Registre** (barres + table détail). 19. **Erreurs de transcription** (barres groupées SNIS/DHIS2 vs Pointage/Registre).
20. **Comparaison des sources** (Registre/SNIS/DHIS2 par antigène). 21. Score composite qualité.
22. Croisement supervision CS + qualité (matrice 2×2). 23. Principaux goulots (+ colonne priorité).
24. Plan d'actions correctrices. 25. Plan de suivi. 26. Conclusion (message clé + 3 priorités).

---

## 8. Onglet « Télécharger Rapport » (app)
2 cartes (au lieu de 3) : **« Supervision PEV & CQD — Zones de santé »** et
**« … — Centres de santé »**. Chaque carte : titre, description, nb de diapos, bouton
« Télécharger .pptx » + aperçu des diapos (réutiliser le rendu `design_reference`).
Supprimer l'ancienne carte « Supervision conjointe » distincte (fusionnée dans les 2 rapports).

## 9. Définition de fini
- [ ] 2 routes API génèrent les `.pptx` (23 et 26 diapos) sans erreur.
- [ ] **Aucun quadrillage / ligne de fond** sur aucun graphique ; valeurs au sommet des barres.
- [ ] Couleurs par seuil (score) et par concordance respectées.
- [ ] Logos OMS + PEV à gauche de chaque bandeau ; pied de page complet.
- [ ] Commentaires « LECTURE PEV » générés depuis les valeurs (template literals).
- [ ] Champs dynamiques `[Province]/[Antenne]/[ZS]/[AS]/[Période]/[Date]` remplis.
- [ ] Rendu visuellement équivalent aux 2 HTML de `design_reference/`.

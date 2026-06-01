# PROMPT à coller dans Claude Code

Copie-colle le texte ci-dessous dans Claude Code, à la racine du dépôt
**`MBOMBOmamu1993/Supervision-conjointe`** (Next.js 14 / TS / Tailwind / pptxgenjs / KoboToolbox).
Le dossier `handoff_rapports_pptx/` (cette spec + `design_reference/` + `data/cq-data.js`)
doit être présent dans le repo ou joint au message.

---

Tu travailles sur le dépôt **Supervision-conjointe** (dashboard PEV/OMS · Province de la Tshuapa).

**Objectif** : remplacer la génération de rapports PowerPoint par **2 rapports enrichis**
générés dynamiquement avec **pptxgenjs**, alignés sur les 2 modèles officiels :
1. **Supervision PEV & CQD — Zones de santé** (23 diapositives)
2. **Supervision PEV & CQD — Centres de santé** (26 diapositives)

La carte « Supervision conjointe » séparée disparaît : il n'y a plus que **ces 2 rapports**.

**Spécification à suivre à la lettre** : `handoff_rapports_pptx/SPEC_RAPPORTS_PPTX.md`.

**Référence visuelle = vérité** : `handoff_rapports_pptx/design_reference/` contient un aperçu
HTML complet et fidèle des 2 rapports (mêmes diapos, graphiques, KPI et commentaires).
Ouvre `Rapport_Supervision_CQD_ZS.html` et `Rapport_Supervision_CQD_CS.html` : **reproduis ce
rendu en PPTX.** Les fichiers `assets/data-zs.js` et `assets/data-cs.js` donnent, diapo par diapo,
le titre, le sous-titre, les KPI, les séries de graphiques et **le texte exact des commentaires
d'expert PEV**. `assets/charts.js` montre l'allure exacte des graphiques épurés ; `assets/build.js`
définit les 12 gabarits de diapo ; `assets/report.css` le système visuel (couleurs, typo, tableaux,
callout « LECTURE PEV »).

**Exigences impératives** :
1. **Graphiques sans aucune ligne en arrière-plan** : pas d'axe vertical, pas de quadrillage
   (`valAxisHidden`, `valGridLine:{style:'none'}`, `catGridLine:{style:'none'}`), fond blanc,
   **valeur affichée au-dessus de chaque barre**, une seule fine ligne de base. (cf. §2 de la spec)
2. **Couleurs par seuil** (score : vert ≥80 / bleu 70–79 / jaune 60–69 / rouge <60) et
   **par concordance** (vert 95–105 / orange <95 / rouge >105).
3. **KPI** demandés sur chaque diapo concernée (cf. data-*.js).
4. **Commentaires dynamiques « expert PEV »** générés à partir des valeurs (template literals,
   logique §5 de la spec), pas de texte figé. Niveau `read` / `warn` / `alert` selon criticité.
5. **Logos OMS + PEV** à gauche de chaque bandeau marine ; pied de page complet ; champs
   dynamiques `[Province]/[Antenne]/[ZS]/[AS]/[Période]/[Date]`.
6. Format 16:9 ; police Arial (substitut d'IBM Plex Sans).

**Données** :
- Concordances, erreurs, enfants récupérés, remplissage des outils → **API Kobo temps réel**
  (formulaires CQ ZS `ajhW22rQEkVs39SuhBuwCC`, CQ CS `aaQZRLWXQ6rpTWr3uR3SEU`). Mapping des champs
  en §6 de la spec. Données réelles actuelles (1 soumission/niveau) déjà extraites dans
  `handoff_rapports_pptx/data/cq-data.js` (ZS Bokungu ; AS Lofima 2).
- Scores de supervision & composantes → mêmes agrégats que les pages du dashboard (filtre
  période/ZS/AS appliqué). Tant que la couverture est partielle, n'afficher que les unités
  réellement renseignées ; le commentaire signale la base partielle.

**À implémenter** :
- `app/api/rapports/[type]/route.ts` (type = `zs` | `cs`) : construit le `.pptx` avec pptxgenjs
  et le renvoie en téléchargement. Noms de fichiers : voir §1 de la spec.
- Une fonction réutilisable par gabarit de diapo (cover, exec, barSide, bigBar, table, tableBar,
  gauges, hbarList, funnel, matrix, process, conclusion) — calquée sur `build.js`.
- Un module de **génération des commentaires** (un par diapo) prenant les agrégats en entrée.
- Onglet « Télécharger Rapport » : 2 cartes + aperçu, boutons branchés sur les 2 routes.

Ne casse aucune logique de calcul Kobo existante. Commence par lire la spec et la référence
visuelle, propose ton plan, puis implémente. Vérifie la **définition de fini** (§9 de la spec).

---

### Rappel des fichiers du handoff
```
handoff_rapports_pptx/
├── PROMPT_CLAUDE_CODE.md        ← ce fichier
├── SPEC_RAPPORTS_PPTX.md        ← spécification complète (design + diapo-par-diapo + mapping)
├── data/
│   └── cq-data.js               ← données réelles CQD extraites (ZS Bokungu, AS Lofima 2)
└── design_reference/            ← aperçu HTML FIDÈLE des 2 rapports (= vérité visuelle)
    ├── index.html
    ├── Rapport_Supervision_CQD_ZS.html
    ├── Rapport_Supervision_CQD_CS.html
    ├── deck-stage.js
    └── assets/  (charts.js · report.css · build.js · data-zs.js · data-cs.js · logos)
```

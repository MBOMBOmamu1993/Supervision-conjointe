# Supervision conjointe PEV-Central / OMS — RDC

Dashboard web d'aide à la décision pour la **supervision conjointe** des
activités du Programme Élargi de Vaccination (PEV) en République Démocratique
du Congo. Les données proviennent en **temps réel** de trois formulaires
KoboToolbox.

## Pages

1. **Vue d'ensemble** — KPI de réalisation, scores de supervision (moyen / max /
   min) et répartition des cotations (Très bon / Bon / Moyen / Faible) par
   niveau (Antenne, Zone de santé, Aire de santé).
2. **Performance par structure & temps** — comparaison des scores par antenne,
   ZS et CS (conjointe, MCA, ECZ), évolution mensuelle et matrices de progression.
3. **Performance par composante** — radars et tableaux des 6 composantes,
   répartition des réponses (Oui / Partiel / Non / NA) et top-5 des « Non ».
4. **Analyse** — données détaillées + diagnostic du schéma Kobo détecté.
5. **Rapports** — export CSV / impression PDF.

Les **6 composantes** : Planification & gestion des ressources · Atteinte des
populations cibles · Supervision formative · Monitorage pour action ·
Engagement communautaire · Surveillance épidémiologique.

## Sources de données (KoboToolbox)

| Niveau | Formulaire | Asset |
|---|---|---|
| Antenne | Antenne PEV | `axvaHRq3XGozr8o3z4wr5u` |
| Zone de santé | Checklist supervision PEV — ZS | `axsB6RwiENF3FC2eZzsH3m` |
| Aire de santé | Checklist supervision — Centre de santé | `ac8zZ9oE8VWoHXS3iSKRTQ` |

Le dashboard télécharge l'export XLSX de chaque formulaire (fallback API JSON),
le parse et recalcule tous les indicateurs côté serveur. Un cache de
`CACHE_TTL_SECONDS` (300 s par défaut) assure la réactivité ; le bouton
**Actualiser** force une resynchronisation immédiate.

## Configuration (variables d'environnement)

Copier `.env.example` → `.env.local` (local) ou définir sur Vercel :

| Variable | Rôle |
|---|---|
| `KOBO_TOKEN` | Jeton API Kobo (prioritaire) |
| `KOBO_USERNAME` / `KOBO_PASSWORD` | Authentification de repli |
| `KOBO_BASE_URL` | `https://eu.kobotoolbox.org` |
| `KOBO_TARGET_*` | Cibles attendues pour les « % de réalisation » (optionnel) |
| `CACHE_TTL_SECONDS` | Durée du cache serveur (défaut 300) |

## Développement local

```bash
npm install
cp .env.example .env.local   # renseigner les identifiants Kobo
npm run dev                  # http://localhost:3000
npm run build                # build de production
npm run typecheck
```

## Déploiement Vercel

1. Importer ce repo dans Vercel (framework **Next.js** détecté automatiquement).
2. *Settings → Environment Variables* : ajouter `KOBO_TOKEN`,
   `KOBO_USERNAME`, `KOBO_PASSWORD` (et les `KOBO_TARGET_*` si connus).
3. Déployer.

## Ajustement du schéma

Les noms de colonnes Kobo sont résolus automatiquement par mots-clés. Si un
indicateur n'apparaît pas correctement, ouvrir **Analyse → Analyser les
colonnes** (ou `GET /api/supervision/introspect`) pour voir les colonnes
détectées, puis compléter les listes de mots-clés dans
`config/supervision.config.ts`.

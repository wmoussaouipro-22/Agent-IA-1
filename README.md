# Assistant de prospection — suite de tests du MVP

Suite de tests Pytest écrite à partir du cahier des charges (F1 à F7), **avant** le code de
l'application. Elle sert de recette automatique : l'application est terminée quand tout est vert.

Le contrat que l'application doit respecter est décrit dans [`tests/CONTRAT.md`](tests/CONTRAT.md).

## Lancer les tests

```bash
pip install -r requirements-dev.txt
pytest                    # tout
pytest -m unit            # scoring, anti-doublons, stats, sessions, sécurité
pytest -m integration     # Google Places et Outlook (simulés)
pytest -m ai              # garde-fous de l'e-mail IA
pytest -m e2e             # parcours complet en 5 étapes
ruff check . && mypy tests
```

Aucune clé d'API n'est nécessaire : les services externes sont simulés. Le seul test qui appelle la
vraie API Google Places est ignoré tant que `GOOGLE_PLACES_API_KEY` n'est pas définie.

La recette terrain (UAT, 4 à 6 semaines) n'est pas automatisable et reste à suivre à part.

## Agent de débogage et de recette

L'agent `debug-testeur` (`.claude/agents/debug-testeur.md`) s'appuie sur cette suite de tests pour
déboguer, corriger et dérouler les tests utilisateurs. Dans Claude Code :

| Commande | Effet |
|---|---|
| `/debug` | lance tous les tests et corrige les échecs un par un |
| `/debug le scoring classe mal les restaurants` | reproduit le bug, le corrige, ajoute un test de non-régression |
| `/recette` | déroule tous les scénarios utilisateurs de `tests/recette/scenarios.md` |
| `/recette R3` | automatise puis exécute le scénario R3 |
| `/recette un commercial change d'avis après un RDV` | ajoute ce parcours aux scénarios et le teste |

Règle centrale de l'agent : il corrige l'application, jamais les tests. Si un test lui semble
contredire le besoin, il s'arrête et te demande de trancher.

## Recette de la plateforme (maquette, Supabase, n8n)

L'agent `testeur-plateforme` (`.claude/agents/testeur-plateforme.md`) vérifie à la demande les
parcours des commerciaux sur la plateforme Eco-Locaux. Dans Claude Code :

| Commande | Effet |
|---|---|
| `/recette-plateforme` | maquette CRM + règles Supabase + contrôles n8n, puis rapport |
| `/recette-plateforme supabase` | seulement les règles de la base |
| `/recette-plateforme P4` | un seul scénario |

Scénarios : `tests/plateforme/scenarios.md`. Rien n'est écrit dans les vraies données : la maquette
est testée avec des connecteurs simulés, chaque scénario SQL annule ce qu'il crée, n8n est lu sans
être lancé. Recette maquette seule, sans Claude : `cd tests/plateforme && npm install && npm test`
(Node 20+, Python 3 pour reconstruire `maquette/`).

## Infrastructure

| Élément | Où | Rôle |
|---|---|---|
| Supabase « Nouvelles tables Eco locaux SQL » | schéma `prospection` | base de l'application et journal des contrôles `prospection.controles_ci` |
| | schéma `public` | tables métier Eco Locaux (commerces, échanges, recherches, candidats…) |
| Railway « assistant-prospection » | service `Redis` ; variables partagées `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SCHEMA` | cache / file d'attente de la future application, reliée à Supabase |
| Railway « assistant-prospection-postgres » | — | abandonné : le dépôt n'y écrit plus |

Ce que GitHub écrit dans Supabase (secret `DATABASE_URL`, chaîne de connexion « Session pooler ») :
- **à chaque PR et chaque fusion** : le résultat de chaque contrôle dans `prospection.controles_ci` ;
- **à chaque fusion sur `main`** : les migrations de `db/versions/` (Alembic), après un aller-retour
  réussi sur une base de test.

Migrations en local : `DATABASE_URL=... alembic -c db/alembic.ini upgrade head`
(modèle de variables dans `.env.example`).

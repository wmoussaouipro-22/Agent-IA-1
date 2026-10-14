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

## Interface web des commerciaux (`web/`)

Site Next.js hébergé sur Vercel, branché sur la base Supabase « Nouvelles tables Eco locaux SQL »
(commerces, commerciaux, échanges, relances). Détails et lancement local : [`web/README.md`](web/README.md).
Règles d'accès Supabase : `supabase/migrations/`. Contrôle à chaque PR : `.github/workflows/web.yml`.

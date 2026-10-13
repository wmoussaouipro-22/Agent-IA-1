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

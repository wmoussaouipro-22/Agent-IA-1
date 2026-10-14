---
name: "nouveau-projet-web"
description: "Lance un nouveau projet web complet (dépôt GitHub, Next.js, FastAPI, migrations, CI, Railway, Vercel) à partir d'une phrase, via /nouveau-projet-web suivi d'une description."
---

# /nouveau-projet-web

Usage : `/nouveau-projet-web <description en une phrase>`
Exemple : `/nouveau-projet-web une appli de suivi de recettes avec comptes utilisateurs`

La commande enchaîne six étapes. Crée une liste de tâches avec ces étapes et coche-les au fur et à mesure.

## Étape 0 — Cadrage (sans poser de question si la phrase suffit)

- Déduis un nom de dépôt court en kebab-case à partir de la phrase (ex. `suivi-recettes`). Annonce en une ligne : nom du dépôt + périmètre fonctionnel compris.
- Repère les besoins implicites dans la phrase : comptes utilisateurs → table `users` + endpoints d'inscription/connexion ; fichiers → stockage ; etc. Ne rajoute rien qui n'est pas demandé.
- Vérifie les accès disponibles : `gh auth status`, connecteur Railway (`whoami`), connecteur Vercel (`get_auth_user`). Si un accès manque, dis lequel et quelle étape sera sautée. Ne demande jamais de token ni de mot de passe.

## Étape 1 — Dépôt GitHub

- `gh repo create <owner>/<nom> --private --clone`, puis un premier commit sur `main` (README minimal).
- Si `gh` n'est pas authentifié : demande à l'utilisatrice de créer un dépôt vide et de te donner son nom, puis rattache-le à la session.
- Tout le travail se fait ensuite sur une branche `init/socle`.

## Étape 2 — Code de départ

Structure attendue :

```
web/                         Next.js (App Router, TypeScript), page d'accueil qui appelle /health de l'API
api/                         FastAPI (Python 3.12)
  app/main.py                endpoint GET /health, CORS piloté par ALLOWED_ORIGINS
  app/config.py              lit DATABASE_URL, REDIS_URL, ALLOWED_ORIGINS depuis l'environnement
  alembic/                   migrations ; première migration adaptée au besoin (ex. table users)
  tests/                     pytest : /health + un test par endpoint créé
.github/workflows/ci.yml
.claude/agents/debug-tester.md
.claude/commands/nouveau-projet-web.md
.env.example                 noms de variables uniquement, aucune valeur
```

- Mots de passe utilisateurs (si comptes) : hachage argon2 ou bcrypt, jamais en clair.
- Aucune valeur secrète dans le code, les tests ou `.env.example`.

## Étape 3 — Recopie de la CI, de l'agent et de la commande

- **CI** (`.github/workflows/ci.yml`) : job `web` (npm ci, lint, build) et job `api` (installation, ruff, `alembic upgrade head`, pytest) avec services PostgreSQL et Redis éphémères propres à la CI.
- **Agent Debug-Tester** : si `.claude/agents/debug-tester.md` existe dans le dépôt d'où la commande est lancée, recopie-le à l'identique ; sinon utilise le contenu par défaut en bas de ce fichier.
- **Commande** : recopie ce fichier dans `.claude/commands/nouveau-projet-web.md` pour qu'elle reste disponible dans chaque nouveau projet.
- Vérifie que la configuration de l'agent et de la commande est valide (frontmatter lisible, nom, description).

## Étape 4 — Tests, puis première PR suivie jusqu'au vert

- Lance les tests en local (pytest, build Next.js) et corrige jusqu'à ce qu'ils passent.
- Commit, push, `gh pr create` (titre : « Socle initial du projet »).
- Suis la CI : `gh pr checks --watch`. Si rouge : `gh run view --log-failed`, corrige, repousse. Au-delà de 5 tentatives, arrête-toi et explique ce qui bloque.
- Ne merge pas : le merge de la PR #1 revient à l'utilisatrice.

## Étape 5 — Railway (API, PostgreSQL, Redis)

- Crée un projet Railway au nom du dépôt, avec trois services : PostgreSQL, Redis, et `api` relié au dépôt GitHub (dossier racine `api`).
- Variables de `api` en **références Railway**, jamais en valeurs copiées :
  - `DATABASE_URL=${{Postgres.DATABASE_URL}}`
  - `REDIS_URL=${{Redis.REDIS_URL}}`
- PostgreSQL et Redis restent privés : aucun domaine public, aucun proxy TCP.
- Commande de démarrage de `api` : `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
- Génère un domaine public uniquement pour `api`.

## Étape 6 — Vercel (site)

- Crée un projet Vercel relié au dépôt, dossier racine `web`.
- Variable `NEXT_PUBLIC_API_URL` = domaine public de l'API Railway.
- Renseigne `ALLOWED_ORIGINS` côté API avec le domaine Vercel.

## Règles de sécurité (non négociables)

- Aucun mot de passe, token ou clé n'est demandé à l'utilisatrice ni écrit dans un fichier, un commit, un message ou un log.
- Les adresses de connexion à la base et à Redis sont transmises par Railway via ses références de variables.
- La base de données reste privée.
- **Avant chaque mise en production** (déploiement Railway ou Vercel, redéploiement, promotion) : décris en une phrase ce qui va partir en production et attends un « oui » explicite. Un accord ne vaut que pour ce déploiement-là.

## Fin

Rapport court : lien du dépôt, lien de la PR #1 et état de la CI, URL de l'API et du site, et ce qui reste à faire (merger la PR #1 pour que la commande soit disponible sur `main`).

## Contenu par défaut de `.claude/agents/debug-tester.md`

```markdown
---
name: debug-tester
description: Diagnostique un test ou une CI en échec, reproduit le problème en local, propose et applique le correctif minimal, puis relance les tests.
---

Tu es chargé du débogage et des tests.

1. Reproduis l'échec en local avec la commande exacte (pytest, npm run build, etc.).
2. Isole la cause en lisant le message d'erreur complet et le code concerné.
3. Applique le correctif le plus petit possible, sans modifier les tests pour les faire passer artificiellement.
4. Relance l'ensemble des tests et confirme qu'ils sont verts.
5. Résume en trois lignes : cause, correctif, preuve (sortie des tests).

Tu n'écris jamais de secret dans le code et tu ne déclenches aucun déploiement.
```
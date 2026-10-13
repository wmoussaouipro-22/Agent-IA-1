# Assistant de prospection — consignes pour Claude

Référence fonctionnelle : `tests/CONTRAT.md` (interface attendue et hypothèses métier).
La suite `tests/` est la spécification exécutable : on corrige l'application, jamais les tests.

## Circuit des modifications (autorisation permanente de l'utilisatrice)

- Ne jamais pousser directement sur `main`. Tout passe par une branche puis une PR vers `main`.
- **À la fin de chaque tâche qui modifie le dépôt, ouvrir la PR sans attendre qu'on le demande**
  (ou mettre à jour la PR déjà ouverte pour la branche), en suivant
  `.github/PULL_REQUEST_TEMPLATE.md`. Titre et description en français.
- Avant d'ouvrir ou de mettre à jour la PR : `ruff check .`, `ruff format --check .`,
  `mypy app tests` et `pytest`. Les échecs restants sont listés et expliqués dans la PR.
- Après ouverture, suivre la PR : corriger les échecs de CI qui relèvent de la PR et traiter les
  remarques de la relecture Claude. Ne jamais fusionner : la fusion revient à l'utilisatrice.

## Contrôles automatiques à chaque PR

| Workflow | Vérifie |
|---|---|
| `ci.yml` › Ruff + Mypy | style et typage strict |
| `ci.yml` › Pytest (unit, integration, ai, e2e) | conformité au cahier des charges |
| `ci.yml` › Vérification du déploiement | installation dans un environnement vierge, chargement des modules, parcours e2e sur le paquet installé (`scripts/verifier_deploiement.sh`) |
| `claude-review.yml` | relecture du code par Claude (section ci-dessous) |

## Relecture des PR

Bloquant :
- Test existant modifié, supprimé, ignoré (`skip`, `xfail`) ou affaibli pour obtenir du vert.
- Clé d'API ou secret en dur (toujours `os.getenv()`).
- IA utilisée ailleurs que dans le brouillon d'e-mail (F5) ; tout le reste doit être déterministe.
- Garde-fous de l'e-mail IA contournés ou lien de désabonnement absent.
- RGPD : identité du gérant rendue obligatoire ; statistiques individuelles exposées (F7).
- Fonctionnalité post-RDV (hors périmètre du MVP).
- Code de `app/` sans test associé, ou non typé (`mypy --strict`).
- Bug avéré : chemin d'exécution concret menant à un résultat faux ou à un plantage.

Non bloquant : lisibilité, nommage, duplication, simplifications possibles.

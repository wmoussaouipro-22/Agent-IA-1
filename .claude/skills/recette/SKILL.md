---
name: recette
description: Dérouler les tests utilisateurs (parcours des commerciaux) et produire un rapport de recette. Usage — /recette [identifiant de scénario, ou description d'un nouveau parcours]
argument-hint: "[R1…R8 ou nouveau parcours]"
context: fork
background: false
agent: debug-testeur
---

Mode RECETTE.

Périmètre demandé : $ARGUMENTS

Sans précision, déroule tous les scénarios de `tests/recette/scenarios.md`. Si le périmètre décrit
un parcours qui n'existe pas encore, ajoute-le aux scénarios puis automatise-le.
Ne corrige pas l'application dans ce mode : liste les défauts trouvés et propose `/debug` pour
chacun. Termine par le compte rendu au format prévu.

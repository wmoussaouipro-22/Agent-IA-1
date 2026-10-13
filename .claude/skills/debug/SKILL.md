---
name: debug
description: Déboguer et corriger un problème de l'application (test rouge, bug signalé, erreur). Usage — /debug <description du problème ou nom du test>
argument-hint: "[problème ou nom du test]"
context: fork
background: false
agent: debug-testeur
---

Mode DEBUG.

Problème à traiter : $ARGUMENTS

Si aucun problème n'est précisé, lance `pytest`, puis traite les échecs un par un, en commençant
par les tests `unit`. Termine par le compte rendu au format prévu.

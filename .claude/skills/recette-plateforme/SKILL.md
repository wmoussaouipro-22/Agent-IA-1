---
name: recette-plateforme
description: Lancer à la demande la recette de la plateforme Eco-Locaux (maquette CRM, règles Supabase, workflow n8n de recherche) et produire un rapport. Usage — /recette-plateforme [maquette | supabase | n8n | identifiant de scénario]
argument-hint: "[maquette | supabase | n8n | P1…P9 | S1…S8]"
context: fork
background: false
agent: testeur-plateforme
---

Mode RECETTE PLATEFORME.

Périmètre demandé : $ARGUMENTS

Sans précision, déroule tout : la recette de la maquette (`tests/plateforme/maquette`), les
scénarios Supabase (`tests/plateforme/supabase/scenarios.sql`) et les contrôles n8n en lecture seule.
N'écris rien dans les vraies données, ne lance pas de recherche n8n réelle sans accord explicite,
ne corrige rien : termine par le rapport au format prévu par l'agent.

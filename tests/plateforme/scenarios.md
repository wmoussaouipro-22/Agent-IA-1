# Recette de la plateforme Eco-Locaux — scénarios

Lancement à la demande dans Claude Code : `/recette-plateforme` (tout), ou
`/recette-plateforme maquette`, `/recette-plateforme supabase`, `/recette-plateforme n8n`,
`/recette-plateforme P4`…

Aucun scénario n'écrit dans les vraies données : la maquette est testée avec des connecteurs
simulés, les scénarios Supabase annulent tout ce qu'ils créent, et n8n est contrôlé en lecture seule.

## Maquette CRM (`maquette/recette.test.mjs`)

| Id | Parcours du commercial | Ce qui est vérifié |
|---|---|---|
| P1 | Ouvrir la plateforme | Données lues dans Supabase (indicateur « Supabase · lu à »), prospects les plus récents en premier, aucun code interne (Co-, Rech-, Cand-) à l'écran |
| P1b | Ouvrir sans connecteur, ou connecteur refusé | La maquette reste utilisable sur les données figées, sans erreur |
| P2 | Trier les candidats d'une recherche | Onglets Tous / Retenus / Écartés / Connus ; « Retenir » sans fenêtre, enregistré dans Supabase et attribué à Com-02 ; « Connu » enregistré |
| P3 | Voir un candidat déjà connu | Le commercial voit « Déjà connu · Pas intéressé : à ne pas recontacter » |
| P4 | Saisir un échange | Plus de date de relance à saisir ; relance calculée : J+2, visite à J+5 au 3e « Sans réponse », J+7 ou date convenue pour « À rappeler », J+1 pour « Intéressé », veille du RDV ; canaux Appel / E-mail / Visite (pas de SMS) |
| P5 | Déclarer un prospect « Pas intéressé » | Fenêtre de confirmation, mise à jour Supabase, le prospect disparaît des écrans |
| P6 | Traiter les relances en retard | Paliers : J+1 à 3 « À rattraper », J+4 à 14 « En retard », au-delà « À requalifier » avec « Rappeler aujourd'hui » / « Classer injoignable » ; plus de sélecteur Ma zone / Équipe |
| P7 | Lancer une recherche Google Maps | Le workflow n8n actif reçoit ville, rayon, activités, commercial et 10 résultats maximum ; bouton bloqué pendant la recherche |
| P8 | Ouvrir une fiche prospect | Potentiel affiché avec le détail du calcul ; ni section Synthèse, ni Relance, ni « suivi par » |
| P9 | Tableau de bord d'illustration | Aucun prospect « Pas intéressé » dans les chiffres ni dans le pipeline |
| P10 | Enregistrer un RDV (Diagnostic, Présentation devis, Signature) | Échange et statut enregistrés dans Supabase, brouillon d'e-mail demandé au workflow n8n IA, brouillon ouvert pour relecture |
| P11 | Relire et envoyer un e-mail | Brouillon modifiable, enregistré, validé puis envoyé par le workflow n8n Gmail ; passe dans « Envoyés » |
| P12 | Consulter l'agenda | Le RDV apparaît dans sa semaine, avec le repère Google Agenda et l'état de l'e-mail ; clic → fiche |

## Règles Supabase (`supabase/scenarios.sql`)

| Id | Règle | Résultat attendu |
|---|---|---|
| S1 | Arrivée d'un candidat Google Maps | Code Cand-xxx, zone déduite du code postal, statut « À examiner », potentiel calculé |
| S2 | Lecture des horaires | Format Google (« lundi 07:00 to 12:45, … ») et format texte (« Lun-Sam 12h-14h30 ») ; seuils de potentiel |
| S3 | Retenir un candidat | Commerce créé (code Co-xxx, potentiel, GPS, identifiant Google, commercial) ; candidat ensuite verrouillé |
| S4 | Retenir sans type de commerce | Refus « préciser le type de commerce » |
| S5 | Commerce déjà en base retrouvé par une recherche | Candidat classé « Connu » et relié au commerce |
| S6 | Commerce « Pas intéressé » retrouvé | Le commerce reste en base ; le candidat est classé « Connu » |
| S7 | Potentiel corrigé à la main | Jamais écrasé par le calcul automatique |
| S8 | Requête de lecture de la maquette | S'exécute, format attendu, aucun « Pas intéressé » renvoyé |

## n8n (lecture seule)

| Id | Contrôle |
|---|---|
| N1 | Le workflow « Recherche Google Maps → candidats » est actif, webhook `ecolocaux-recherche-google-maps`, rayon appliqué (« Situer la ville » avant Google Maps) |
| N2 | Les 10 dernières exécutions : aucune en échec, sinon nœud et message d'erreur |
| N3 | (seulement avec ton accord) Recherche réelle sur une petite zone : la recherche passe à « Terminée » et des candidats arrivent |

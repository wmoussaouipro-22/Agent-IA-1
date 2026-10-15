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
| P6 | Traiter les relances en retard | « À traiter » en mode « Mes données » lit les vraies relances Supabase ; la relance du jour est dans « Aujourd'hui », puis bascule selon les paliers : J+1 à 3 « À rattraper », J+4 à 14 « En retard », au-delà « À requalifier » avec « Rappeler aujourd'hui » / « Classer injoignable » ; plus de sélecteur Ma zone / Équipe |
| P7 | Lancer une recherche Google Maps | Le workflow n8n actif reçoit ville, rayon, activités, commercial et 10 résultats maximum ; bouton bloqué pendant la recherche |
| P8 | Ouvrir une fiche prospect | Potentiel affiché avec le détail du calcul ; ni section Synthèse, ni Relance, ni « suivi par » |
| P9 | Tableau de bord d'illustration | Aucun prospect « Pas intéressé » dans les chiffres ni dans le pipeline |
| P10 | Enregistrer un RDV (Diagnostic, Présentation devis, Signature) | Échange et statut enregistrés dans Supabase, brouillon d'e-mail demandé au workflow n8n IA, brouillon ouvert pour relecture |
| P11 | Relire et envoyer un e-mail | Brouillon modifiable, enregistré, validé puis envoyé par le workflow n8n Gmail ; passe dans « Envoyés » |
| P12 | Consulter l'agenda | Le RDV apparaît dans sa semaine, avec le repère Google Agenda et l'état de l'e-mail ; clic → fiche |
| P13 | Préparer et faire une tournée terrain | Date choisie dans « Ajouter un prospect », tournée créée au premier arrêt (plus de liste ni de formulaire de création) ; candidats (recherche) et prospects (à revoir) distingués ; ordre modifiable ; horaires du jour et créneau conseillé ; itinéraire Google Maps ; résultat de visite enregistré comme échange « Visite » ; encart dans le tableau de bord |
| P14 | Organiser une tournée | Motif de chaque arrêt : « 1re visite », « Relance terrain » ou « RDV commercial · heure » (heure fixe, boutons RDV réalisé / Reporté / Annulé) ; RDV du jour proposés avec « Ajouter à la tournée », jamais ajoutés d'office ; recherche des prospects avec liste de 20 par page (Précédent / Suivant) ; modifier la date et le nom ; supprimer la tournée après confirmation dans la page |
| P15 | Reporter une relance | « Cette semaine » devient « Ma to do » : une relance reportée (« Reporter » dans « En retard ») y passe, avec sa date d'origine, et le report est enregistré dans Supabase (date_relance_initiale) ; l'onglet regroupe aussi la prochaine tournée et les 5 prochains RDV |
| P16 | Plusieurs tournées le même jour | Signalées, puis regroupées en une seule (arrêts déplacés, tournées vides supprimées) |
| P17 | Ouvrir un prospect depuis « À traiter » | Le nom de l'enseigne ouvre sa fiche ; sans fiche réelle, le formulaire de création s'ouvre pré-rempli et la fiche est créée dans Supabase ; plus de « Saisir le résultat » ni de bouton « Préparer » |
| P18 | Consulter la liste des prospects | Colonne « E-mail » (adresse fournie par Google Maps), vide si le commerce n'en a pas |
| P19 | Présenter le tableau de bord | Données d'illustration par défaut, datées par rapport au jour réel ; bouton « Mes données » pour basculer « À traiter » et les RDV sur Supabase |
| P20 | Saisir un échange (modèle du 15/10) | Motif + résultat ; le statut est seulement proposé (case à cocher, jamais d'office) puis validé depuis la fiche ; l'échange ferme les tâches ouvertes et crée la suivante (table `tache`) ; informations énergétiques avec source, date et validation |
| P21 | Lire le pipeline | Nouveau → Contacté → En qualification → Audit en préparation → Audit prêt → Rendez-vous confirmé, puis Injoignable |

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
| S10 | RDV « Rendez-vous pris » | Défauts du RDV (objet « Présentation du pré-diagnostic ») ; le statut du commerce ne change pas tout seul |
| S11 | Tâche | Reliée à un commerce existant (clé étrangère) ; statut limité à À faire / Faite / Annulée |
| S12 | Information extraite par l'IA | Toujours « À confirmer », même si l'insertion demande « Validée » |
| S9 | Arrêt de tournée | Soit un candidat, soit un prospect : un arrêt vide ou double est refusé |

## n8n (lecture seule)

| Id | Contrôle |
|---|---|
| N1 | Le workflow « Recherche Google Maps → candidats » est actif, webhook `ecolocaux-recherche-google-maps`, rayon appliqué (« Situer la ville » avant Google Maps) |
| N2 | Les 10 dernières exécutions : aucune en échec, sinon nœud et message d'erreur |
| N3 | (seulement avec ton accord) Recherche réelle sur une petite zone : la recherche passe à « Terminée » et des candidats arrivent |

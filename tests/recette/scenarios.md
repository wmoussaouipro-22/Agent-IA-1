# Scénarios de tests utilisateurs (recette)

Chaque scénario décrit un parcours réel d'un commercial terrain. Les personas sont fictives.
Statut : **automatisé** (test existant) ou **à automatiser** (l'agent `debug-testeur` l'écrit à la
demande, via `/recette <id>`).

Personas : Léa et Karim, commerciaux sur Paris 11e ; l'équipe compte 4 commerciaux.

---

### R1 · Première prospection de la journée
- **Persona** : Léa
- **Étapes** : cherche les boulangeries à 2 km → les fiches sont créées → la liste est triée →
  elle génère un e-mail pour le premier prospect → le commerçant accepte → elle clique « RDV pris ».
- **Attendu** : le prospect joignable le plus proche est en tête ; l'e-mail respecte les 6
  garde-fous et contient le lien de désabonnement ; le RDV est dans son agenda avec l'adresse,
  l'itinéraire et la fiche argumentaire ; le statut passe à « RDV pris ».
- **Règles** : F2, F3, F4, F5, F6
- **Statut** : automatisé — `tests/test_e2e.py::test_parcours_complet`

### R2 · Relancer la même recherche le lendemain
- **Persona** : Léa
- **Étapes** : la veille, elle a contacté un prospect ; elle relance la même recherche.
- **Attendu** : aucune fiche en double ; le prospect déjà contacté garde son statut.
- **Règles** : F3 (anti-doublon, statuts)
- **Statut** : automatisé — `test_r2_relancer_la_meme_recherche`

### R3 · Prospect pas intéressé
- **Persona** : Karim
- **Étapes** : il contacte un restaurant qui décline ; il le marque « Pas intéressé » ; plus tard
  il clique par erreur sur « RDV pris ».
- **Attendu** : aucun événement n'est créé dans Outlook et le statut reste « Pas intéressé ».
- **Règles** : F3, F6 — ⚠️ transition depuis « Pas intéressé » non précisée par le cahier des
  charges : à valider avant d'automatiser.
- **Statut** : à automatiser

### R4 · Brouillon IA non conforme rattrapé
- **Persona** : Léa
- **Étapes** : la première proposition de l'IA cite un montant d'économie.
- **Attendu** : Léa ne voit jamais ce brouillon ; elle reçoit une version conforme, avec le lien
  de désabonnement.
- **Règles** : F5 (garde-fous, opt-out)
- **Statut** : automatisé — `test_r4_brouillon_non_conforme_rattrape`

### R5 · Deux commerciaux le même jour
- **Personas** : Léa et Karim
- **Étapes** : chacun prend un RDV avec un commerce différent.
- **Attendu** : chaque RDV est inscrit dans l'agenda de son auteur uniquement ; Karim ne peut pas
  accéder à l'agenda de Léa.
- **Règles** : F1, F6
- **Statut** : automatisé — `test_r5_deux_commerciaux_le_meme_jour`

### R6 · Point d'équipe du lundi
- **Persona** : l'équipe des 4 commerciaux
- **Étapes** : en fin de semaine, l'équipe consulte le compteur.
- **Attendu** : prospects contactés, RDV pris et taux de conversion de l'équipe, sans aucune
  donnée individuelle.
- **Règles** : F7
- **Statut** : automatisé — `test_r6_point_d_equipe`

### R7 · Outlook indisponible au moment du clic
- **Persona** : Karim
- **Étapes** : il clique « RDV pris » pendant une panne d'Outlook, puis réessaie.
- **Attendu** : au premier essai, une erreur et le statut reste « Contacté » ; au second, le RDV
  est créé une seule fois et le statut passe à « RDV pris ».
- **Règles** : F6
- **Statut** : automatisé — `test_r7_outlook_indisponible_puis_retabli`

### R8 · Préparer une visite en boucherie
- **Persona** : Karim
- **Étapes** : avant de passer dans une boucherie, il consulte la fiche argumentaire.
- **Attendu** : objections et réponses adaptées au métier, meilleur moment pour passer ; contenu
  identique à chaque consultation (pas d'IA).
- **Règles** : F5 (téléphone & visite)
- **Statut** : à automatiser

---

## Indicateurs terrain (non automatisables)

À suivre pendant les 4 à 6 semaines d'expérimentation : RDV par semaine, taux de conversion,
temps de saisie par prospect.

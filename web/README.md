# Eco-Locaux · outil de prospection

Interface web des commerciaux Eco-Locaux, branchée sur la base Supabase
« Nouvelles tables Eco locaux SQL » et hébergée sur Vercel.

## Ce que fait l'outil

| Écran | Usage |
|---|---|
| Connexion | e-mail + mot de passe (comptes créés dans Supabase > Authentication) |
| Commerces | liste filtrable par zone, statut, potentiel, recherche par enseigne ou ville |
| Fiche commerce | coordonnées, statut modifiable, historique des échanges, saisie d'un nouvel échange |
| Relances | relances en retard ou prévues dans les 7 jours |

Un commerce en opposition (« ne plus contacter ») est signalé et la saisie d'échange est bloquée.

## Architecture

```
Navigateur ── Next.js (Vercel, dossier web/) ── Supabase (base + comptes)
                                                   └── n8n (workflows du dossier « Eco locaux def »)
```

- Pas de serveur d'API intermédiaire : le site lit et écrit dans Supabase avec la session
  du commercial connecté. Les règles d'accès (RLS) sont dans `supabase/migrations/` à la racine du dépôt.
- Les clés étrangères de la base ont été retirées volontairement : le site rapproche
  commerces, commerciaux et échanges dans son propre code.
- Aucune clé secrète dans le dépôt. Seule la clé publishable Supabase est utilisée.

## Lancer en local

```bash
cp .env.example .env.local   # puis renseigner les deux valeurs
npm install && npm run dev
```

## Contrôles

Le workflow `.github/workflows/web.yml` lance lint, vérification des types et build à chaque PR.

## Reste à faire

- Brancher les boutons « Générer un mail » et « Valider le brouillon » sur les workflows n8n.
- Restreindre chaque commercial à sa zone si besoin (aujourd'hui : tout commercial connecté voit tout).

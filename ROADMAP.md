# Pistes d'évolution

Idées classées par utilité pour le mariage du 13 février 2027. Chaque ligne peut être donnée telle quelle à Claude Code.

## Avant l'envoi des invitations
- [ ] **Import CSV des invités** : importer une liste (foyer, nom, enfant, table, téléphone) depuis un fichier, avec aperçu et détection des doublons.
- [ ] **Aperçu des 4 modèles** côte à côte dans l'écran d'une invitation, sans ouvrir un nouvel onglet.
- [ ] **Plan de table** : écran listant les tables, les invités assignés et le nombre de places restantes (10 par table).
- [ ] **Image de partage (Open Graph)** propre au mariage, pour un bel aperçu du lien dans WhatsApp.

## Pendant les réponses
- [ ] **Relances** : liste des foyers sans réponse avec un message de relance WhatsApp pré-rempli (FR/EN).
- [ ] **Commentaire libre** dans la réponse (allergies, besoin d'un transport, message aux mariés).
- [ ] **Tableau de bord par inviteur** pour l'administrateur.

## Le jour J
- [ ] **Mode kiosque** : grand affichage du nom et de la table de l'invité scanné.
- [ ] **Compteur en direct** des arrivées par moment de la journée.

## Après le mariage
- [ ] **Lien vers l'album photo** partagé ajouté aux remerciements.
- [ ] **Archivage** : export complet (CSV + JSON) avant de supprimer les données personnelles.

## Qualité
- [ ] Tests unitaires (Vitest) pour `lib/format.ts`, `lib/share.ts` et `lib/ics.ts`.
- [ ] ESLint + Prettier.

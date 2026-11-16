# Fred & Rose

Application web pour inviter, suivre les réponses, accueillir les invités le jour J et les remercier ensuite. Conçue pour le mariage de Fred et Rose, réutilisable pour tout événement.

**Coût : 0 FCFA.** React + Vite côté interface, Supabase (offre gratuite) pour la base de données et les comptes, Cloudflare Pages (offre gratuite) pour l'hébergement.

## Ce que fait l'application

**Pour les invités (sur téléphone, en français ou en anglais)**
- Une invitation personnelle par famille ou personne individuelle, qui nomme chaque personne invitée, présentée dans une enveloppe à ouvrir.
- Le programme de la journée : heures, lieux, itinéraire Google Maps, consignes.
- L'ajout au calendrier (Google Agenda ou fichier .ics pour iPhone et Android).
- La confirmation de présence par personne et par moment de la journée (civil, discours, soirée).
- Un pass d'entrée en QR code, avec le numéro de table.

**Pour les organisateurs**
- Les moments de la journée, avec heures, lieux et consignes en deux langues.
- Les invitations par foyer ou par groupe : chaque membre est nommé et compté, enfants signalés, table attribuée.
- 4 modèles visuels : Marine et or, Jardin, Ivoire, Nuit étoilée.
- L'envoi par WhatsApp (message prêt avec le lien), par e-mail ou par simple copie du lien.
- Des comptes « inviteur » avec un quota de personnes fixé par l'administrateur, vérifié par la base de données.
- Un tableau de bord : invitations ouvertes, réponses par moment, adultes et enfants, export CSV.
- Les couleurs de l'application, modifiables depuis l'écran « Thème et paramètres ».

**Le jour J (rôle Sécurité)**
- Le scan des QR codes avec la caméra du téléphone, ou la recherche par nom.
- Le pointage membre par membre, avec une alerte si quelqu'un est déjà entré.
- Le fonctionnement sans réseau : les entrées sont gardées sur le téléphone et envoyées dès que la connexion revient.

**Après le mariage**
- La liste des personnes ou familles présentes, avec un message de remerciement personnalisé, prêt à envoyer par WhatsApp ou par e-mail.

## Déploiement pas à pas (environ 30 minutes)

### 1. Créer la base de données Supabase
1. Créez un compte gratuit sur [supabase.com](https://supabase.com) puis **New project**. Choisissez une région européenne (la plus proche de Douala) et notez le mot de passe.
2. Ouvrez **SQL Editor > New query**, collez le contenu de `supabase/schema.sql` et cliquez **Run**.
3. Facultatif : exécutez `supabase/seed.sql` pour créer les trois moments de la journée du 13 février 2027.
4. Dans **Authentication > Sign In / Providers > Email**, vous pouvez désactiver **Confirm email** pour que les membres de l'équipe n'aient pas à confirmer leur adresse.
5. Dans **Project Settings > API**, copiez la **Project URL** et la clé **anon public**.

### 2. Publier le code sur GitHub
```bash
git init && git add . && git commit -m "Faire-part de mariage"
git branch -M main
git remote add origin https://github.com/<votre-compte>/faire-part-mariage.git
git push -u origin main
```

### 3. Héberger sur Cloudflare Pages
1. Créez un compte gratuit sur [Cloudflare](https://dash.cloudflare.com), puis **Workers & Pages > Create > Pages > Connect to Git**.
2. Choisissez le dépôt. Build command : `npm run build`. Build output directory : `dist`.
3. Dans **Environment variables**, ajoutez `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.
4. Déployez. L'adresse sera du type `https://faire-part-mariage.pages.dev`.
5. Dans Supabase, **Authentication > URL Configuration**, mettez cette adresse dans **Site URL**.

Vercel ou Netlify fonctionnent aussi (offres gratuites). Le fichier `public/_redirects` gère les liens directs vers les invitations.

### 4. Créer le compte administrateur
Ouvrez `https://<votre-site>/admin/login?signup=1` et créez votre compte. **Le premier compte créé devient automatiquement administrateur.** Les suivants restent « en attente » jusqu'à ce que vous leur donniez un rôle dans **Équipe**.

### 5. Empêcher la mise en veille (important)
L'offre gratuite de Supabase met le projet en pause après 7 jours sans activité. Le fichier `.github/workflows/keepalive.yml` interroge la base tous les 3 jours, gratuitement. Dans GitHub, **Settings > Secrets and variables > Actions**, ajoutez `SUPABASE_URL` et `SUPABASE_ANON_KEY`, puis lancez une première fois le workflow depuis l'onglet **Actions**.

Si le projet est quand même mis en pause, relancez-le depuis le tableau de bord Supabase : les données sont conservées.

## Les rôles

| Rôle | Peut faire |
| --- | --- |
| Administrateur | Tout : programme, invitations, équipe et quotas, thème, accueil, remerciements |
| Inviteur | Créer et envoyer ses propres invitations, dans la limite de son quota de personnes |
| Sécurité | Scanner les QR codes et pointer les arrivées le jour J |
| En attente | Rien, tant que l'administrateur n'a pas choisi un rôle |

## Conseils pour le jour J
- La veille, chaque agent de sécurité ouvre **Accueil des invités** sur son téléphone, avec du réseau : la liste complète est enregistrée pour fonctionner hors connexion.
- Sur Android (Chrome) ou iPhone (Safari), **Ajouter à l'écran d'accueil** installe l'application comme une app.
- Gardez la recherche par nom pour les invités qui n'ont pas leur QR code.

## Sécurité
- Chaque invitation a un lien secret de 36 caractères aléatoires : impossible à deviner, il ne permet de voir que ce foyer.
- Les invités ne lisent ni n'écrivent rien directement : deux fonctions de la base (`get_invitation`, `submit_rsvp`) vérifient le lien à chaque appel.
- Les règles d'accès Supabase (RLS) limitent chaque compte à ce que son rôle permet ; le quota est contrôlé par un déclencheur dans la base.
- Le journal `audit_log` garde la trace des réponses et des pointages.

## Développement local
```bash
cp .env.example .env.local   # puis renseignez les deux valeurs Supabase
npm install
npm run dev                  # http://localhost:5173
```
Pour prévisualiser une invitation sans compter l'ouverture : `/i/<lien>?preview=1`, et pour tester un autre modèle : `&template=jardin`.

## Ajouter un modèle d'invitation
1. Ajoutez une classe `.tpl-monmodele` dans `src/styles/invitation.css` (variables `--page`, `--paper`, `--ink`, `--accent`, `--line`).
2. Ajoutez l'identifiant dans `TemplateId` (`src/lib/types.ts`) et dans la liste `TEMPLATES` (`src/pages/admin/InvitationsPage.tsx`).
3. Ajoutez-le à la contrainte `check (template in (...))` de la table `invitations`.

## Limites connues
- WhatsApp : les messages s'ouvrent un par un, prêts à envoyer. L'envoi automatique en masse passe par l'API WhatsApp Business, qui est payante.
- E-mail : l'application ouvre votre messagerie avec le message rempli. Un envoi automatique demanderait un service d'e-mail tiers.
- Les polices viennent de Google Fonts ; sans réseau, une police système proche les remplace.

## Licence
MIT : libre d'utiliser, modifier et partager.

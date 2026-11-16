# Faire-part de mariage — mémoire du projet pour Claude Code

Application web d'invitations de mariage (Fredoly & Rose, Douala, 13 février 2027), réutilisable pour tout événement.
Le développeur principal parle français : **réponds en français**, garde les identifiants de code en anglais.

## Contraintes non négociables
- **Coût zéro.** Aucune dépendance, aucun service ni aucune API payante. Tout doit tenir dans les offres gratuites de Supabase et Cloudflare Pages. Si une fonctionnalité demande un service payant (API WhatsApp Business, envoi d'e-mails en masse, SMS), propose une alternative gratuite ou signale-le avant d'écrire du code.
- **Mobile d'abord.** Les invités ouvrent leur invitation sur téléphone, souvent avec un réseau faible (Douala). Chaque ajout côté invité doit rester léger : pas de grosse librairie dans le bundle public.
- **S'adresser à une ou plusieurs personnes.** Une invitation peut viser une seule personne ou un groupe : les textes invités s'accordent en nombre (`_one`/`_other` avec `count`) et en genre via la civilité (`addressForm()`, `genderOf()` dans `lib/people.ts`), et les messages envoyés nomment toujours chaque personne.
- **Bilingue FR/EN côté invité.** Tout texte visible par un invité passe par `src/i18n/index.ts` (clés `fr` et `en`, l'objet `en` est typé `typeof fr`). L'espace organisateurs est en français seulement.
- **Sécurité.** Les invités n'accèdent jamais aux tables directement : uniquement via les fonctions `get_invitation` et `submit_rsvp` (security definer, vérification du jeton). Ne jamais ajouter de policy RLS ouvrant une table au rôle `anon` (sauf `settings` en lecture).

## Commandes
- `npm run dev` : serveur local (http://localhost:5173), nécessite `.env.local` (voir `.env.example`).
- `npm run build` : vérification TypeScript (`tsc --noEmit`) puis build Vite. **À lancer après chaque modification** ; il doit passer sans erreur.
- `npm run preview` : sert le build (utile pour tester la PWA et le hors-ligne).
- Il n'y a pas encore de tests automatisés.

## Pile technique
React 18 + TypeScript strict + Vite 5, react-router-dom 6, @supabase/supabase-js 2, react-i18next, qrcode.react, html5-qrcode (scanner), idb-keyval (file d'attente hors ligne), vite-plugin-pwa. CSS pur avec variables (pas de Tailwind, pas de librairie UI).

## Architecture
```
src/
  App.tsx                 routes ; pages admin chargées en lazy (ne pas les importer côté invité)
  auth/AuthContext.tsx    session + profil (rôle, quota) ; useAuth().hasRole(...)
  i18n/index.ts           textes invités FR/EN
  lib/
    supabase.ts           client + friendlyError() (traduit QUOTA_EXCEEDED, FORBIDDEN…)
    types.ts              types partagés (Invitation, Guest, EventItem, Settings, Theme…)
    theme.ts              DEFAULT_THEME (couleurs du mariage), PRESETS, applyTheme() → variables CSS
    format.ts             dates en fuseau Africa/Douala (UTC+1), toDoualaInput/fromDoualaInput
    ics.ts                export calendrier .ics + lien Google Agenda
    share.ts              liens wa.me, mailto, normalisation des numéros camerounais (+237), CSV
    offline.ts            cache IndexedDB des invités + file d'attente des pointages hors ligne
    people.ts             noms, civilités, accords (une ou plusieurs personnes), invitationName()
    card.ts               carte A5 imprimable (canvas → JPEG / PDF maison), chargée à la demande
    useSettings.ts        charge settings et applique le thème
  pages/public/           InvitationPage (enveloppe + carte), HomePage
  pages/admin/            AdminLayout, Dashboard, InvitationsPage, EventsPage, UsersPage,
                          SettingsPage, CheckInPage, ThanksPage, LoginPage
  components/             Modal, Scanner (demande d'autorisation caméra), CardExport, RequireRole, Ornament (nœud, feuillage)
  styles/                 global.css (variables), invitation.css (modèles tpl-*), admin.css
functions/_middleware.ts  Cloudflare Pages Function : aperçu des liens (og:image absolue, titre personnalisé pour les robots)
scripts/og-image.html     source de public/og-image.jpg (1200×630), procédure de régénération en commentaire
supabase/
  schema.sql              schéma initial (déjà exécuté en production : NE PLUS LE MODIFIER)
  seed.sql                exemple des 3 moments de la journée
  migrations/             toute évolution de la base, fichiers numérotés (voir plus bas)
```

## Modèle de données (Supabase / Postgres)
- `settings` (ligne unique id=1) : couple_names, wedding_date, rsvp_deadline, theme (jsonb), welcome_fr/en, thanks_fr/en (placeholders `{cher}`, `{noms}` et `{couple}`), contact_phone.
- `profiles` : role (`pending` | `admin` | `inviter` | `security`), quota. Créé par trigger à l'inscription ; le premier compte devient admin.
- `events` : moments de la journée (title_fr/en, starts_at, venue, map_url, stream_url = lien de visio facultatif, notes_fr/en).
- `invitations` : une ou plusieurs personnes ; `household_name` = nom affiché facultatif (vide → noms des personnes, voir `invitationName()` dans `lib/people.ts`) ; `token` secret (36 hex) dans l'URL `/i/:token` ; language ; template (`marine` | `jardin` | `ivoire` | `nuit`) ; inviter_id ; opened_at ; thanked_at.
- `invitation_events` : moments auxquels le foyer est invité.
- `guests` : chaque personne nommée (civility `m`|`mme`|`mlle`|`dr` facultative, is_child, table_label, checked_in_at).
- `rsvps` : réponse par (guest, event), status `yes` | `no` | `remote` (`remote` seulement si l'event a un stream_url).
- `audit_log` : traces (rsvp, check_in…).
- Le quota est appliqué par le trigger `enforce_quota` sur `guests` (erreur `QUOTA_EXCEEDED`).
- Fonctions : `get_invitation(token, track)`, `submit_rsvp(token, answers)` (anon) ; `check_in_guests(ids, at)`, `undo_check_in(id)` (admin/sécurité).

## Faire évoluer la base
1. Crée `supabase/migrations/NNN_description.sql` (NNN = numéro suivant, à 3 chiffres ; 001 correspond à schema.sql).
2. Écris du SQL **idempotent** : `create ... if not exists`, `create or replace function`, `drop policy if exists` avant `create policy`, `add column if not exists`.
3. Toute nouvelle table : `enable row level security` + policies basées sur `is_admin()`, `app_role()`, `can_manage_invitation()`, `can_view_invitation()`.
4. Mets à jour `src/lib/types.ts`.
5. Rappelle au développeur d'exécuter le fichier dans Supabase > SQL Editor (Claude Code n'a pas accès à la base).

## Conventions de code
- Composants fonctionnels + hooks, un fichier par page. Pas de state manager global : `useState` + appels Supabase dans la page.
- Erreurs Supabase affichées via `friendlyError()` ; ajoute-y les nouveaux codes d'erreur levés en SQL.
- Dates : toujours stockées en `timestamptz`, affichées avec les helpers de `lib/format.ts` (fuseau Africa/Douala).
- Couleurs : uniquement via les variables `--navy`, `--marine`, `--gold`, `--sand`, `--ivory` (modifiables par l'admin). Pas de couleur codée en dur, sauf exceptions propres à un modèle (ex. `--leaf` du modèle jardin).
- Accessibilité : labels sur tous les champs, focus visible, cibles tactiles ≥ 40 px, `prefers-reduced-motion` respecté.
- Textes d'interface : phrases courtes, verbes d'action (« Enregistrer l'invitation », pas « Valider »), messages d'erreur qui disent quoi faire.

## Identité visuelle
Palette tirée de l'image d'inspiration : bleu nuit #121A33, marine #1E2A50, or bronze #A88B60, sable #D9C9A9, ivoire #F4F2EE.
Typographies : Bodoni Moda (titres, prénoms) et Jost (texte). Moment signature : l'enveloppe à sceau doré « F&R » qui s'ouvre au toucher. Motif récurrent : le nœud (comme la décoration du mariage, faite de nœuds en tissu).

## Déploiement
Cloudflare Pages (build `npm run build`, sortie `dist`, variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`). `public/_redirects` gère le routage SPA. Le workflow `.github/workflows/keepalive.yml` évite la mise en veille du projet Supabase gratuit.

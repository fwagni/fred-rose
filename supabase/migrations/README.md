# Migrations de la base

`../schema.sql` correspond à la migration **001** : il a déjà été exécuté, ne le modifiez plus.

Chaque évolution de la base se fait dans un nouveau fichier `NNN_description.sql` (002, 003…), écrit de façon idempotente, puis exécuté **une fois** dans Supabase > SQL Editor.

Tenez à jour la liste ci-dessous pour savoir ce qui a été appliqué :

| Migration | Description | Appliquée le |
| --- | --- | --- |
| 001 | Schéma initial (`schema.sql`) | |
| 002 | Schéma initial (`seed.sql`) | |
| 003 | Invitations à une ou plusieurs personnes (nom affiché facultatif, civilité), visioconférence (`events.stream_url`, réponse `remote`), `{cher}` dans les remerciements | |

# Historique des migrations — GoMeCoiffer

Migrations TypeORM de `backend/src/database/migrations/`, dans l'ordre d'application. Une ligne par migration,
ajoutée dans le même commit que la migration. Une migration commitée ne se modifie jamais (hook de garde) :
on en ajoute une nouvelle.

| Fichier | Module | Contenu | Générée / écrite à la main | Destructive (expand/contract) | Date |
|---|---|---|---|---|---|
| `1795085602204-OrganizationsFoundation.ts` | organizations | tables `organizations` (unique `owner_user_id` : une organisation par utilisateur, D-035), `salons` (fuseau `Africa/Douala` et statut `NOT_PUBLISHED` par défaut, index `organization_id`), `salon_memberships` (unique `(salon_id, user_id)`, index partiel `(user_id) WHERE status = 'ACTIVE'`, rôle non contraint en base jusqu'à UC-008) | écrite à la main | non | 2026-11-19 |
| `1795000300000-IdentityPasswordReset.ts` | identity | colonne `users.credentials_version` (version des identifiants, comparée à celle de la session à chaque requête : ferme les sessions après une réinitialisation, D-028/D-031), colonne `sign_in_attempts.password_reset` (marque qui lève les blocages du numéro, D-025), index d'expression `sessions ((sess->>'userId'))` (fermeture des sessions d'un utilisateur) | écrite à la main | non | 2026-11-19 |
| `1795000200000-IdentitySignIn.ts` | identity | tables `sign_in_attempts` (essais de connexion, purgés après 48 h ; index numéro + instant, index partiel adresse + instant sur les échecs d'appareils non reconnus, index instant pour la purge) et `known_devices` (empreinte du jeton, unique par couple jeton + compte, FK `users`) | écrite à la main | non | 2026-11-18 |
| `1795000100000-IdentityAccounts.ts` | identity | tables `users` (numéro unique, mot de passe facultatif pour le client léger) et `otp_challenges` (motif et statut contrôlés, index unique partiel « un seul code actif par numéro et motif », index d'historique d'envoi) | écrite à la main | non | 2026-11-18 |
| `1795000000000-Socle.ts` | socle | extension `btree_gist` ; tables `outbox` (+ index partiel des lignes non traitées), `processed_events` (PK consumer + event_id), `sessions` (store connect-pg-simple, index `expire`), `audit_log` (+ index salon/date) | écrite à la main | non | 2026-11-17 |

Rappels (`CLAUDE.md` §I.8) : SQL généré relu ligne à ligne, `down()` réel, contraintes d'exclusion et index
partiels écrits à la main, `CREATE INDEX CONCURRENTLY` (migration sans transaction) sur une table déjà
volumineuse, jamais `synchronize` ni `schema:sync`.

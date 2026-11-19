# Modules backend — GoMeCoiffer

Référence des modules de `backend/src/modules/`, de leurs commandes et de leurs queries. Mis à jour par
`backend-builder` / `query-perf` à chaque nouveau cas d'usage. État : **prévu** (rien de codé), **en cours**,
**livré**.

**Module modèle** (à reproduire pour un nouveau module) : aucun pour l'instant. Le premier module complet
(cible : `booking`) sera nommé ici et servira de référence de style (skill `ddd`).

## Vue d'ensemble

| Module | Responsabilité | Agrégats (prévus) | PRD | HTTP | État |
|---|---|---|---|---|---|
| `identity` | Comptes, connexion, session, défis SMS (OTP), réinitialisation | `User`, `OtpChallenge`, `KnownDevice` | §3, §7 étape 1, §16 | `/api/public/sign-up/*`, `/api/public/auth`, `/api/salon/session` | en cours (UC-001 et UC-002 livrés côté back) |
| `organizations` | Organisation, salons, publication, appartenances, rôles salon et permissions, salon actif, onboarding | `Organization`, `Salon`, `SalonMembership`, `SalonRoleSet` | §3, §5, §6, §7, F07 | `/api/salon/*` | prévu |
| `catalog` | Prestations, catégories, prix, durées, statut actif | `SalonService` | §7 étape 3, F07 | `/api/salon/services`, lecture publique | prévu |
| `staff` | Intervenants, spécialités, prestations autorisées, horaires, pauses, indisponibilités et blocages temporaires | `StaffMember`, `WorkingSchedule`, `Unavailability` | §5.3, §5.5, §7 étapes 4-5, F02, BR-07 | `/api/salon/staff` | prévu |
| `booking` | Réservations (cycle de vie), planning, client sur place, reprogrammations, disponibilités (lecture) | `Booking`, `RescheduleProposal` | F02, F03, F05, F06, BR-01…BR-03, BR-07…BR-09, BR-11, BR-12 | `/api/public/*`, `/api/salon/bookings` | prévu |
| `payments` | Paiement en ligne (Mobile Money), paiement au salon, webhooks, réconciliation, incidents | `Payment`, `PaymentIncident` | F04, BR-04…BR-06, BR-10 | `/api/public/payments`, `/api/salon/payments`, `/api/webhooks/payments` | prévu |
| `subscriptions` | Abonnement SaaS par salon, périodes, paiements d'abonnement, grâce, suspension | `Subscription` | F08, §10 | `/api/admin/subscriptions`, `/api/salon/subscription` | prévu |
| `platform` | Administration GoMeCoiffer : rôles système, supervision, visibilité marketplace, indicateurs | `PlatformAdmin` | §2.C, §4, F08 | `/api/admin/*` | prévu |

## Commandes par module

| Module | Commande | Route | Permission | UC |
|---|---|---|---|---|
| `identity` | `RequestSignUpCode` — demander un code d'inscription (réponse identique quel que soit le numéro) | `POST /api/public/sign-up/code` | publique, CSRF, 30/h par IP | UC-001 |
| `identity` | `ConfirmSignUp` — confirmer le code et créer ou compléter le compte propriétaire ; refus de code levé par `RefuseAfterCommit` (commit puis erreur métier levée par le bus) | `POST /api/public/sign-up` | publique, CSRF, 60/h par IP | UC-001 |
| `identity` | `SignIn` — se connecter (numéro + mot de passe) sous la politique d'essais D-025 ; une seule vérification argon2id par refus ; refus levé par `RefuseAfterCommit` (essai commité, erreur levée par le bus) ; le répondeur HTTP ouvre la session | `POST /api/public/auth/sign-in` | publique, CSRF, 100/h par appareil + 600/h par adresse (configurables) | UC-002 |
| `identity` | `RequestPasswordResetCode` — demander un code de réinitialisation ; défi enregistré pour tout numéro (même réponse, mêmes limites par motif `PASSWORD_RESET`), SMS seulement pour un compte avec mot de passe, **envoyé après la réponse** (`AfterCommit.registerDetached`) ; une panne est seulement journalisée, la demande compte toujours (D-033) | `POST /api/public/auth/password-reset/code` | publique, CSRF, 30/h par IP | UC-003 |
| `identity` | `ResetPassword` — réinitialiser le mot de passe (code + nouveau mot de passe) ; `User.resetPassword` (version des identifiants +1), sessions de l'utilisateur fermées, marque `password_reset` (lève les blocages du numéro), appareils révoqués puis appareil courant reconnu, audit `PASSWORD_RESET`, flux SSE de l'utilisateur fermés après le commit ; refus levé par `RefuseAfterCommit` ; le répondeur HTTP ouvre la session neuve | `POST /api/public/auth/password-reset` | publique, CSRF, 60/h par IP | UC-003 |
| `identity` | `SignOut` — tracer la déconnexion (`userId` `null` sans session : rien à tracer ; le répondeur HTTP détruit la session et efface les cookies ; idempotent) | `POST /api/public/auth/sign-out` | publique, CSRF | UC-002 |
| `identity` | `PurgeSignInAttempts` — oublier l'historique des essais de plus de 48 h (tâche horaire, `TransactionalCommandBus`) | aucune (`@Interval`) | — | UC-002 |

**Module modèle provisoire** : `identity`, à reproduire pour les modules suivants :
- domaine pur, un fichier par concept (D-024) ;
- ports par token ;
- repositories d'écriture TypeORM à verrou optimiste ;
- repository de lecture en SQL pur (`OtpSendHistory` → `application/read-repositories/sql-otp-send-history.ts`) ;
- commandes en 3 fichiers (commande, handler, réponse) ; refus enregistré par `RefuseAfterCommit` (D-034) ;
- HTTP (D-034) : mappers de requête `infrastructure/http/mappers/*.request-mapper.ts`, répondeur
  `authenticated-session.responder.ts` (session, cookie d'appareil, jeton CSRF, résumé de session), contrôleurs sans
  logique, trackers `@Throttle` nommés (`rate-limit-trackers.ts`) ;
- fakes in-memory et tests unit / intégration / E2E.

**Exceptions « une commande, plusieurs agrégats »** (skill `ddd` §5) : `SignIn` (compte, historique des essais,
appareil reconnu) et `ResetPassword` (défi, compte, essais, appareils, sessions, flux temps réel, audit), justifiées
par D-025 et D-031 : la sécurité du compte doit changer d'un bloc, sans état intermédiaire.

## Queries par module

Format d'une ligne : `module` | query | route | permission | UC | tables lues.

| Module | Query | Route | Permission | UC | Tables lues |
|---|---|---|---|---|---|
| `identity` | `GetMySession` — résumé de session : nom, salons, rôles système, étape suivante (D-027) ; ni téléphone ni e-mail | `GET /api/salon/session` | `@AuthenticatedOnly()` | UC-002 | `users` (clé primaire) ; appartenances et rôles système à ajouter avec UC-004/005/008 |

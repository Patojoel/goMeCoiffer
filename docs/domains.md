# Modules backend — GoMeCoiffer

Référence des modules de `backend/src/modules/`, de leurs commandes et de leurs queries. Mis à jour par
`backend-builder` / `query-perf` à chaque nouveau cas d'usage. État : **prévu** (rien de codé), **en cours**,
**livré**.

**Module modèle** (à reproduire pour un nouveau module) : aucun pour l'instant. Le premier module complet
(cible : `booking`) sera nommé ici et servira de référence de style (skill `ddd`).

## Vue d'ensemble

| Module | Responsabilité | Agrégats (prévus) | PRD | HTTP | État |
|---|---|---|---|---|---|
| `identity` | Comptes, connexion, session, défis SMS (OTP), réinitialisation | `User`, `OtpChallenge`, `KnownDevice` | §3, §7 étape 1, §16 | `/api/public/sign-up/*`, `/api/public/auth`, `/api/salon/session` | en cours (UC-001, UC-002, UC-003 et UC-007 livrés côté back) |
| `organizations` | Organisation, salons, publication, appartenances, rôles salon et permissions, salon actif, onboarding | `Organization`, `Salon`, `SalonMembership`, `Invitation`, `SalonRoleSet` | §3, §5, §6, §7, F07 | `/api/salon/organizations`, `/api/salon/invitations`, `/api/public/invitations/:id/acceptance` | en cours (UC-004, UC-005, UC-006 livrés côté back, sans la liste ; UC-007 côté back, sans la query de liste) |
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
| `organizations` | `CreateOrganization` — fonder son organisation et son premier salon (nom, type, ville, quartier, repère, téléphone) ; `Organization.found` vérifie compte du personnel et organisation unique puis crée organisation, salon non publié (`Africa/Douala`) et appartenance `OWNER` ; audit ×2 ; événements `OrganizationFounded`, `SalonRegistered` ; le répondeur HTTP régénère la session (même instant de connexion et version des identifiants), pose le salon actif et renvoie le nouveau jeton CSRF | `POST /api/salon/organizations` (201) | `@AuthenticatedOnly()`, CSRF | UC-004 |
| `organizations` | `SelectActiveSalon` — ouvrir ou changer de salon actif : vérifie l'appartenance active par le port `ActorRights` (même règle qu'à chaque requête, RG-005-16), `SalonNotFoundError` (404 identique : inexistant, autre organisation, appartenance retirée), aucune écriture ni audit ; le répondeur HTTP lit le résumé, régénère la session (instant de connexion, version des identifiants et dernière activité conservés), renouvelle le jeton CSRF puis ferme les seuls flux SSE de l'ancienne session (`closeStreamsOfSession`) ; le magasin de sessions ne recrée jamais une session authentifiée supprimée (`RotationSafePgStore`, D-039) | `POST /api/salon/session/active-salon` (200) | `@AuthenticatedOnly()`, CSRF | UC-005 |
| `organizations` | `InviteCollaborator` — inviter un collaborateur par son numéro avec un des 4 rôles (D-042 à D-045) : `RoleGrantPolicy` (permissions du rôle ⊆ celles de l'auteur), refus membre actif du salon / invitation déjà en attente (une échue passe à expirée) / limites du salon (20 par 24 h, 50 en attente) ; `Invitation.issue` (7 jours, nom et numéro seulement) ; audit `COLLABORATOR_INVITED` sans nom ni numéro ; SMS d'information sans code par `AfterCommit.registerDetached` (port `InvitationNotifier`), omis au-delà de 3 SMS par numéro et par 24 h (invitation enregistrée, même réponse) ; événement `CollaboratorInvited` | `POST /api/salon/invitations` (201) | `staff:invite`, CSRF | UC-006 |
| `organizations` | `CancelInvitation` — annuler une invitation en attente du salon actif (`InvitationNotFoundError` 404 identique pour inexistante / autre salon, `InvitationNoLongerPendingError` 422), même règle de non-élévation de droits ; audit `INVITATION_CANCELLED` ; événement `InvitationCancelled` | `POST /api/salon/invitations/:id/cancellation` (200) | `staff:invite`, CSRF | UC-006 |
| `organizations` | `PurgeEndedInvitations` — tâche horaire (`@Interval`, `TransactionalCommandBus`) : efface nom et numéro des invitations expirées ou annulées depuis 30 jours (une en attente échue passe à expirée) ; idempotente ; les acceptées ne sont jamais touchées | aucune | — | UC-006 |
| `identity` | `RequestInvitationCode` — demander un code pour rejoindre un salon : défi `INVITATION` enregistré pour tout numéro (même réponse, mêmes limites par motif, D-019/D-049), vrai code seulement si le numéro a une invitation en attente (lecture `PendingInvitationsOfPhone`), SMS à texte fixe sans nom de salon **après la réponse** (`registerDetached`) ; panne seulement journalisée, demande comptée | `POST /api/public/invitations/code` (202) | publique, CSRF, 30/h par IP | UC-007 |
| `identity` | `ProveInvitationPhone` — vérifier le code (refus par `RefuseAfterCommit`, essai compté) puis émettre une `PhoneProof` : jeton aléatoire 256 bits, seule son empreinte HMAC est stockée, 15 min ; le répondeur pose le cookie `gmc.join` (`HttpOnly`, `SameSite=Strict`, chemin `/`, `Secure` et préfixe `__Host-` selon la config) et ne renvoie que `{ provenUntil }` ; l'empreinte du jeton est `HMAC(poivre, "phone-proof:" + jeton)` (séparation de domaine avec les codes OTP) ; `Cache-Control: no-store` sur `/api/public/invitations/*`. **Écart au UC §18** : la liste des invitations n'est pas lue ici mais par `GET /api/public/invitations` (`ListInvitationsForProvenPhone`, `query-perf`) | `POST /api/public/invitations/phone-proof` (200) | publique, CSRF, 60/h par IP | UC-007 |
| `organizations` | `AcceptInvitation` — accepter une invitation avec le numéro prouvé par le cookie (jamais le compte de la session, D-047) : verrou du numéro, invitation lue par (id, numéro) → 404 identique si inconnue ou d'un autre numéro, `assertPendingAt`, refus membre actif, compte fourni par le port `InviteeAccounts` (créé, complété ou existant inchangé), `Invitation.accept` (nom et numéro effacés, compte gardé), `SalonMembership.grantCollaboratorRole`, audit `INVITATION_ACCEPTED` (+ `COLLABORATOR_ACCOUNT_CREATED` ou `CLIENT_ACCOUNT_COMPLETED_AS_COLLABORATOR` par l'adaptateur) ; résultat `session` : `OPEN_NEW` (compte créé ou complété), `REGENERATE` (titulaire déjà connecté ici, identifiants à jour), `NONE` ; le répondeur `InvitationAcceptanceResponder` ouvre ou régénère la session sur le salon rejoint (D-049) ou invite à se connecter. `REGENERATE` exige aussi une session dans sa durée absolue (`SESSION_MAX_AGE_HOURS`, lue par le mapper). Quand plus aucune invitation n'est en attente pour le numéro, ses preuves sont oubliées dans la même transaction (`PhoneProofs.forgetProofsOf`) et le répondeur efface le cookie | `POST /api/public/invitations/:id/acceptance` (200) | publique, CSRF, 60/h par IP | UC-007 |
| `identity` | `SignOut` (UC-002, complété par UC-007) — la déconnexion oublie aussi, côté serveur, la preuve de numéro portée par le navigateur (par son empreinte, session ou non) ; le répondeur efface le cookie `gmc.join` | `POST /api/public/auth/sign-out` | publique, CSRF | UC-007 |
| `identity` | `PurgePhoneProofs` — tâche horaire (`@Interval`, `TransactionalCommandBus`) : oublie les preuves de numéro échues ; idempotente | aucune | — | UC-007 |
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

**Exceptions « une commande, plusieurs agrégats »** (skill `ddd` §5) : `CreateOrganization` (`Organization`, `Salon`, `SalonMembership`, RG-004-03 et RG-004-16 : jamais d'organisation sans salon ni de salon sans propriétaire) ; `SignIn` (compte, historique des essais,
appareil reconnu) et `ResetPassword` (défi, compte, essais, appareils, sessions, flux temps réel, audit), justifiées
par D-025 et D-031 : la sécurité du compte doit changer d'un bloc, sans état intermédiaire ; `AcceptInvitation` (`Invitation`, `SalonMembership` et, par le port `InviteeAccounts` implémenté par `identity`, `User` + audit, RG-007-12, D-047) : sans le tout ou rien, un compte créé sans l'appartenance demandée, ou l'inverse, laisserait la personne sans salon. `PhoneProofs.phoneProvenBy` renvoie un `ProvenPhone` opaque (classe à constructeur privé dans `identity/application/services/proven-phone.ts`) que `InviteeAccounts.provide` exige par `instanceof` : un numéro non prouvé ne peut pas ouvrir de compte. Les ports `InviteeAccounts` et `PhoneProofs` sont déclarés dans `organizations/domain/ports`, implémentés dans `identity/application/services`, liés par des tokens exportés par `IdentityModule` (`@Global`) : `organizations` n'importe jamais l'`infrastructure/` d'`identity` (`pnpm arch` vert). Une seule transaction : celle du `TransactionalCommandBus` (même `TransactionHost`).

## Queries par module

Format d'une ligne : `module` | query | route | permission | UC | tables lues.

| Module | Query | Route | Permission | UC | Tables lues |
|---|---|---|---|---|---|
| `identity` | `GetMySession` — résumé de session : nom, salons (nom, rôle, ville, quartier), rôles système, étape suivante (D-027) ; ni téléphone ni e-mail | `GET /api/salon/session` | `@AuthenticatedOnly()` | UC-002, UC-004, UC-005 | `users` (clé primaire), `salon_memberships` (index partiel des appartenances actives), `salons` (clé primaire) ; rôles système à ajouter avec UC-008 |

## Droits de l'acteur (socle)

`ActorRights` est implémenté par `SqlActorRights` (`organizations/application/read-repositories`), lié au token `ACTOR_RIGHTS` par `OrganizationsModule` (importé par `AppModule`) : le socle ne dépend d'aucun module et `pnpm arch` reste vert. Appartenance active au salon actif, permissions du rôle, `credentialsVersion` toujours renvoyée, rôles système vides jusqu'à UC-008.

- **Droits protégés du propriétaire** (`payout-accounts:manage`, `subscription:manage`, `organization:manage-salons`) : accordés seulement si l'utilisateur est le propriétaire réel de l'organisation (`organizations.owner_user_id`), jamais sur le seul texte `role = 'OWNER'`. Le rôle `OWNER` ne naît que de `Organization.found` ; `grantCollaboratorRole` le refuse (`OWNER_ROLE_RESERVED`).
- **Rôles salon** (provisoires, figés par UC-008) : `OWNER`, `SALON_ADMIN`, `HAIRDRESSER`, `FINANCE_MANAGER`, `PRACTITIONER` (PRD §5), contrôlés en base (`CHECK`).
- **Seed de démo** (`backend/src/database/seed/`) : refuse de tourner hors `APP_ENV` local ou test, avec `NODE_ENV=production`, avec SSL, ou vers un hôte de base non local (`seed-guard.ts`).

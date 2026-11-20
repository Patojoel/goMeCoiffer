# Évolutions de GoMeCoiffer

Journal des évolutions livrées de l'application, **la plus récente en haut**. Une entrée par évolution
(fonctionnalité, lot, correctif notable, changement d'architecture), écrite par la session principale à la fin
du travail, une fois les tests verts. Le détail technique vit dans git ; ici, ce qui a changé pour le produit et
pour l'équipe.

Gabarit d'une entrée :

```markdown
### AAAA-MM-JJ — <Titre court de l'évolution>

- **Quoi** : ce qui change pour l'utilisateur ou pour l'équipe (1 à 3 lignes).
- **Pourquoi** : besoin, exigence (F0x, BR-xx, UC-xxx) ou décision qui l'explique.
- **Périmètre** : modules back/front, migrations, contrats d'API, événements.
- **Vérification** : tests lancés (nombre, niveaux), revues faites (archi, sécurité, front), mode de la session.
- **Suites** : ce qui reste, reporté dans `docs/BACKLOG.md`.
```

---

### 2026-11-20 — UC-007 Accepter une invitation (backend)

- **Quoi** : la personne invitée rejoint l'équipe d'un salon depuis une page publique : elle demande un code SMS
  (réponse identique pour tout numéro, SMS seulement s'il existe une invitation en attente), prouve son numéro
  (preuve de 15 min par cookie), voit ses invitations en attente (salon, ville, quartier, rôle, date limite, jamais
  l'invitant), puis accepte. Sans compte : mot de passe et conditions, compte créé et session ouverte sur le salon
  rejoint ; avec un compte du personnel : un clic, session régénérée si elle est déjà connectée, sinon « connectez-vous ».
  L'appartenance va toujours au titulaire du numéro prouvé. Le frontend n'est pas fait.
- **Pourquoi** : UC-007 (lot 1, EX-022 en partie), décisions du user D-047 à D-049.
- **Périmètre** :
  - **`identity`** : commandes `RequestInvitationCode`, `ProveInvitationPhone`, tâche `PurgePhoneProofs` ;
    `PhoneProof` (empreinte HMAC séparée par domaine), `User.registerCollaborator` / `completeAsCollaborator` ;
    services `InviteeAccountProvider` et `PhoneProofReader` (implémentent les ports d'`organizations`, type opaque
    `ProvenPhone`) ; la déconnexion supprime aussi la preuve du numéro et efface son cookie. `IdentityModule` devient
    `@Global()`.
  - **`organizations`** : commande `AcceptInvitation` (une transaction, invitation + appartenance + compte : exception
    nommée dans `docs/domains.md`), query `ListInvitationsForProvenPhone` ; routes `POST /api/public/invitations/code`,
    `/phone-proof`, `/:id/acceptance` et `GET /api/public/invitations` ; nom et numéro de l'invitation effacés à
    l'acceptation ; preuves du numéro supprimées quand il ne reste plus d'invitation en attente.
  - **Socle** : cookie de preuve `__Host-gmc.join` (`Path=/`, HttpOnly, `SameSite=Strict`) ; `no-store` étendu à
    `/api/public/invitations`.
  - **Base & seed** : migrations `OrganizationsInvitationAcceptance` (`accepted_by_user_id`, index partiel par numéro)
    et `IdentityPhoneProofs` ; invitation de démo au 6 70 00 00 02 (sans compte).
  - **Contrats** : `RequestInvitationCodeSchema`, `ProveInvitationPhoneSchema`, `InvitationPhoneProvenSchema`,
    `InvitationsForProvenPhoneSchema`, `AcceptInvitationSchema`, `InvitationAcceptedSchema`.
- **Vérification** : mode light ; agents `use-case-writer`, `backend-builder`, `query-perf` (rapport d'index : index
  partiel par numéro et `users_phone_key`, aucune migration d'index), `security-reviewer` (0 critique, 2 importants et
  4 durcissements, tous corrigés sauf les durées des rôles système dans le choix de session).
  - Suite complète (`pnpm test`) : backend 69 fichiers, 793 tests verts et 4 `todo` ; 2 fichiers E2E interrompus par
    le plantage connu du worker Windows (aucune assertion rouge), relancés seuls : 42 verts ; frontend 8 fichiers,
    36 verts. `lint` 0 erreur (3 avertissements anciens), `typecheck` vert, `arch` 0 violation (466 modules).
- **Suites** (`docs/BACKLOG.md`) : page « Rejoindre un salon » (front) ; factorisation des « vérifier le code » ;
  mutation T31 ; mesure de non-énumération ; réactivation d'une appartenance retirée (UC-008) ; client léger (UC-009).

---

### 2026-11-19 — UC-006 Inviter un collaborateur dans son salon (backend)

- **Quoi** : un propriétaire de salon peut inviter un collaborateur par son numéro de téléphone (avec nom et rôle),
  consulter les invitations en attente ou expirées du salon actif, et annuler une invitation en attente.
  - Les invitations sont valables 7 jours ; une seule invitation en attente par numéro et par salon.
  - Un SMS d'information à texte 100 % fixe (sans code ni nom du salon, D-046) est envoyé après le commit dans la
    limite de 3 salons distincts par numéro sur 24 h glissantes ; au-delà, l'invitation reste enregistrée sans SMS.
  - Le nom et le numéro des invitations non acceptées sont effacés 30 jours après la fin (`PurgeEndedInvitations`).
  - Le frontend n'est pas fait.
- **Pourquoi** : UC-006 (lot 1, EX-004, EX-006, EX-007, EX-012, EX-015, EX-022 à EX-026, EX-037, EX-038), décisions du
  user D-042 à D-046.
- **Périmètre** :
  - **Module `organizations`** :
    - agrégat `Invitation`, VOs (`InviteeName`, `boundedText` nettoyant les caractères de contrôle, d'inversion de sens
      et invisibles), service `InvitationAdmission`, `RoleGrantPolicy` ;
    - commandes `InviteCollaborator`, `CancelInvitation`, `PurgeEndedInvitations` (tâche planifiée) ;
    - query `ListSalonInvitations` (`GET /api/salon/invitations`, SQL pur, max 100 lignes) ;
    - contrôleur `InvitationsController` (`POST /api/salon/invitations`, `GET /api/salon/invitations`,
      `POST /api/salon/invitations/:id/cancellation`) et verrous `pg_advisory_xact_lock` (salon puis numéro).
  - **Socle** : `noStorePrivateRoutes` (`Cache-Control: no-store` sur `/api/salon/*` et `/api/admin/*` dans `app.setup.ts`).
  - **Base & Seed** : migration `OrganizationsInvitations` (`salon_invitations` + index partiels), seed démo mis à jour.
  - **Contrat** : `InvitableSalonRoleSchema`, `InviteCollaboratorSchema`, `CollaboratorInvitedSchema`,
    `InvitationCancelledSchema`, `SalonInvitationsSchema` dans `packages/contracts/src/organizations.ts`.
- **Vérification** : mode light, agents `use-case-writer`, `backend-builder`, `query-perf`, `security-reviewer`, puis
  application des 5 correctifs de la revue sécurité, durcissement D1 (`UNSAFE_TEXT_CHARS` dans `InviteCollaboratorSchema`)
  et mise à jour des docs.
  - Unitaires `modules/organizations` : 9 fichiers, 126 tests verts.
  - Intégration `modules/organizations` : 2 fichiers, 39 tests verts.
  - E2E `modules/organizations` : `inviting-a-collaborator` (49 verts), `listing-salon-invitations` (9 verts),
    `creating-an-organization` (27 verts), `creating-an-organization-under-stress` (2 verts),
    `opening-and-switching-salons` (24 verts), `switching-salons-while-streams-and-requests-are-open` (6 verts),
    `inviting-as-a-salon-administrator` (2 `todo` prévus pour UC-008).
  - Qualité : `oxlint` (0 erreur), `pnpm typecheck` (`contracts`, `backend`, `frontend` verts), `pnpm arch` (0 violation
    sur 407 modules).
  - Suite complète `pnpm test` sur `develop` (20/11) : backend 57 fichiers, 669 tests verts et 2 `todo` ; frontend
    8 fichiers, 36 tests verts. Aucun plantage de worker sur ce lancement.
- **Suites** :
  - écran « Équipe → Inviter » et liste des invitations (front UC-006) ;
  - `RoleGrantPolicy` dynamique par salon et activation des 2 `it.todo` T28 lors de UC-008 ;
  - effacement nom/numéro à l'acceptation dans UC-007.

---

### 2026-11-19 — UC-005 Ouvrir et changer de salon (backend)

- **Quoi** : un membre du personnel ouvre un de ses salons ou change de salon actif.
  - Un salon inexistant, d'une autre organisation, ou dont il n'est plus membre donne le même 404, sans rien changer
    à la session.
  - Chaque changement régénère la session (nouveau jeton CSRF) et ferme seulement les flux temps réel de l'ancienne
    session.
  - Le résumé de session montre la ville et le quartier de chaque salon.
  - Le frontend n'est pas fait.
- **Pourquoi** : UC-005 (lot 1, EX-008, EX-009), décisions du user D-039 à D-041. L'ajout d'un 2e salon devient
  UC-010.
- **Périmètre** :
  - **Module `organizations`** :
    - commande `SelectActiveSalon`, qui vérifie l'appartenance par `ActorRights` et n'écrit rien ;
    - route `POST /api/salon/session/active-salon`, avec mapper, `ActiveSalonResponder` et contrôleur sans logique.
  - **Socle** :
    - `RotationSafePgStore` : une session authentifiée n'est **créée** que par le code qui vient de l'émettre. Toute
      autre sauvegarde est une mise à jour seule, et une rotation **consomme atomiquement** l'ancienne ligne avant
      d'émettre. Une session détruite (déconnexion) ou déjà remplacée ne revit jamais, et deux changements
      simultanés laissent une seule session.
    - SSE : `closeStreamsOfSession`, avec une mémoire bornée des sessions fermées.
  - **`identity`** : `GetMySession` lit aussi la ville et le quartier (rapport d'index : index partiel des
    appartenances actives, 0,09 ms).
  - **Seed** : Mireille (Akwa et Bastos), Clarisse (Élégance), Paul (coiffeur chez Clarisse), Awa.
  - **Contrat** : `cities.ts` (liste des villes, partagée), `SelectActiveSalonSchema`, `ActiveSalonSelectedSchema`,
    ville et quartier dans `SessionSummary`.
- **Vérification** : mode light, agents `use-case-writer`, `backend-builder`, `security-reviewer` (revue et
  contre-revue).
  - Suite complète verte : 324 unitaires, 75 intégration, 125 E2E, 36 front.
  - Mutations volontaires vues rouges : 404 uniforme, régénération, session remplacée ou détruite jamais recréée,
    fermeture des seuls flux de l'ancienne session, vérification d'appartenance.
  - Revue sécurité, un point corrigé : une rotation pouvait repartir d'une session détruite et annuler une
    déconnexion simultanée. Deux durcissements aussi : marqueur de session neuve effacé, flux SSE ouvert juste après
    la fermeture.
  - Contre-revue : correct, aucun nouveau trou.
- **Suites** :
  - écran « choisir mon salon » (front) ;
  - ancien cookie renvoyé par une requête lente après une rotation ;
  - fermeture des flux SSE au retrait d'une appartenance (UC-008) ;
  - UC-010 à rédiger.

### 2026-11-19 — UC-004 Créer son organisation et son premier salon (backend)

- **Quoi** : un utilisateur connecté crée en une seule action son organisation, son premier salon et son
  appartenance « propriétaire ». Le salon est non publié et utilisable tout de suite. La session est régénérée avec ce
  salon comme salon actif.
  - Le résumé de session liste maintenant les salons et le rôle de l'utilisateur, et conduit à « ouvrir son salon ».
  - La vraie résolution des droits (`SqlActorRights`) remplace `NoRightsYet`.
  - Le frontend n'est pas fait.
- **Pourquoi** : UC-004 (lot 1, PRD §7 étape 2), décisions du user D-035 à D-038 (Q14 inversée : session
  régénérée en devenant propriétaire).
- **Périmètre** :
  - **Nouveau module `organizations`** :
    - agrégats `Organization`, `Salon` et `SalonMembership` ;
    - événements `OrganizationFounded` et `SalonRegistered` ;
    - commande `CreateOrganization` et route `POST /api/salon/organizations`, avec mapper, répondeur
      `OwnerSessionResponder` et contrôleur sans logique (D-034) ;
    - `SqlActorRights` : droits protégés du propriétaire (fonds, abonnement, gestion des salons) accordés seulement au
      propriétaire réel de l'organisation, jamais sur le seul texte du rôle.
  - **`identity`** : `GetMySession` lit les salons et le rôle (rapport d'index : index partiel des appartenances
    actives, 0,35 ms).
  - **Socle** : `regenerateSessionOnSalon`, qui garde l'instant de connexion et la version des identifiants.
  - **Migration** `OrganizationsFoundation` :
    - unicité « une organisation par propriétaire » ;
    - contrôles en base sur la ville (12 villes), le type et le rôle ;
    - `down` testé.
  - **Seed de démo** : Mireille propriétaire de « Go Beauty Akwa », Paul sans organisation. Il refuse de tourner hors
    local et test, en production, avec SSL, ou vers un hôte non local.
  - **Contrat** : `organizations.ts`.
- **Vérification** : mode **light**, agents `use-case-writer`, `backend-builder` et `security-reviewer`.
  - Suite complète verte.
  - Mutations volontaires vues rouges : unicité, régénération de session, instant de connexion prolongé, version des
    identifiants, isolation par salon actif et par utilisateur, appartenance révoquée, compte client léger, droits
    protégés liés au propriétaire réel.
  - Revue sécurité : rien de critique. Le point à corriger (droits protégés liés à un simple texte de rôle) est
    traité, avec deux durcissements : contrôles en base et garde-fou du seed. Le reste est au backlog.
- **Suites** : écran de création (front), rôles et permissions figés par UC-008, UC-005 « ouvrir et changer de salon »
  (voir `docs/BACKLOG.md`).

### 2026-11-19 — Contrôleurs sans logique (D-034) et corrections de la revue d'architecture

- **Quoi** : la construction des commandes et les effets HTTP quittent les contrôleurs. Le contrat HTTP ne change
  pas.
  - **Mappers de requête** : fonctions pures qui transforment la requête en commande ou en query.
  - **Use case** : toute l'orchestration. Un refus enregistré est levé par `RefuseAfterCommit` : le bus commite,
    puis lève l'erreur.
  - **Répondeur** : session, cookie d'appareil, jeton CSRF et résumé de session.
  - **Contrôleurs** : réduits à `execute(to<UseCase>(…))`, suivi au besoin du répondeur.
  - Corrections 🟡 de la revue d'architecture :
    - règles métier sorties de `SignInHandler` (`assessSignIn` dit si un blocage s'audite ; `KnownDevice` ignore
      lui-même un appareil non reconnu) ;
    - fabrique de domaine pour la marque de réinitialisation ;
    - rotation des jetons d'appareil en fonctions pures du domaine ;
    - deux trous de `pnpm arch` bouchés ;
    - exception « une commande, plusieurs agrégats » documentée.
- **Pourquoi** : demande du user (aucune logique dans le contrôleur), conception d'`archi-reviewer` validée (D-034).
- **Périmètre** :
  - socle : `RefuseAfterCommit`, `TransactionalCommandBus` ;
  - module `identity` :
    - 4 contrôleurs, 7 mappers, 1 répondeur, trackers nommés ;
    - handlers `SignIn`, `ResetPassword`, `ConfirmSignUp`, `SignOut` et `GetMySession` (read model = contrat,
      plus de cast) ;
  - `.dependency-cruiser.cjs` : règle `controller-builds-no-command`, imports `type` vérifiés dans le domaine,
    bibliothèques HTTP interdites dans `application/` ;
  - règles du projet :
    - `CLAUDE.md` ;
    - skills `hexagonal`, `nest-stack`, `ddd`, `clean-code`, `tdd` ;
    - agents `backend-builder`, `archi-reviewer`, `query-perf`, `security-reviewer` ;
    - `docs/checklists.md`, `docs/domains.md`.
- **Vérification** : mode light, revue `archi-reviewer` demandée par le user.
  - Nouvelle règle `pnpm arch` vue rouge sur l'ancien code (9 violations), puis verte.
  - Grep des corps de route vide.
  - Tests E2E inchangés et verts : c'est la preuve que le contrat HTTP est identique.
  - Nouveau test d'intégration du refus après commit, vu rouge puis vert.
- **Suites** : suggestions 🟠 de la revue au backlog.

### 2026-11-19 — UC-003 Réinitialiser son mot de passe (backend)

- **Quoi** : un membre du personnel qui a oublié son mot de passe le remplace grâce à un code reçu par SMS, puis il
  est connecté directement. La réinitialisation a plusieurs effets :
  - toutes ses autres sessions sont fermées, même une requête en cours ;
  - ses flux temps réel sont fermés ;
  - tous ses appareils reconnus sont révoqués, sauf celui qui vient de servir ;
  - les blocages de connexion du numéro sont levés.
  Le frontend n'est pas fait.
- **Pourquoi** : UC-003 (lot 1), décisions D-030 à D-033 (D-033 issue de la revue sécurité).
- **Périmètre** :
  - **Module `identity`** :
    - commandes `RequestPasswordResetCode` (un défi pour tout numéro ; SMS seulement pour un compte, envoyé après la
      réponse ; une panne est seulement journalisée et la demande compte) et `ResetPassword` ;
    - version des identifiants sur le compte et dans la session ;
    - marque de réinitialisation dans l'historique des essais ;
    - révocation des appareils ;
    - routes `POST /api/public/auth/password-reset/code` et `POST /api/public/auth/password-reset`.
  - **Socle** :
    - `AuthGuard` refuse une session dont la version des identifiants est périmée ;
    - `AfterCommit.registerDetached` (action après le commit, sans faire attendre la réponse) ;
    - `RealtimePublisher.closeStreamsOfUser`.
  - **Migration** : `IdentityPasswordReset` (`users.credentials_version`, `sign_in_attempts.password_reset`, index
    des sessions par utilisateur).
  - **Contrat** : `RequestPasswordResetCodeSchema`, `ResetPasswordSchema`.
- **Vérification** : mode **light**, agents `use-case-writer`, `backend-builder`, `security-reviewer`.
  - Suite complète verte.
  - Mutations volontaires vues rouges : levée des blocages, révocation des appareils, fermeture des sessions,
    version des identifiants non incrémentée ou non comparée, SMS envoyé à un numéro sans compte, panne retirée des
    limites, fermeture des flux SSE, journal de panne qui recopierait le message.
  - Revue sécurité : 2 points à corriger, tous deux traités (D-033) :
    - une panne SMS effaçait les essais ratés (force brute illimitée pendant une panne) ;
    - elle révélait aussi les comptes existants.
  - Durcissements faits : fermeture des flux SSE, journal de panne sans numéro ni code.
- **Suites** : écran « mot de passe oublié » (front) ; le vrai `ActorRights` devra renvoyer la version des
  identifiants (backlog) ; refactoring des contrôleurs selon D-034 (évolution suivante).

### 2026-11-18 — Outillage : Swagger utilisable, notification Discord, fusion dans develop

- **Quoi** :
  - Swagger (`/api/docs`, hors prod) a un champ « Authorize » pour le jeton CSRF : les routes d'écriture se testent
    depuis le navigateur. Le jeton est à reprendre après une inscription ou une connexion (session régénérée).
  - Workflow GitHub Actions `.github/workflows/notify-discord-develop.yml` : à chaque mise à jour de `develop`, un
    message Discord (auteur, titres des commits, identifiants courts, lien vers les différences). L'URL du webhook
    vit dans le secret `DISCORD_WEBHOOK_URL`, jamais dans le dépôt.
  - `feature/lot-1-comptes` fusionnée dans `develop` (préprod) : UC-001, UC-002 et le refactoring D-024.
- **Pourquoi** : demandes du user (voir les routes faites ; être prévenu des mises à jour de la préprod), D-029.
- **Périmètre** : `backend/src/app.setup.ts`, `.github/workflows/`.
- **Vérification** : appel `POST /api/public/sign-up/code` rejoué avec le jeton (200) ; typecheck et lint verts.
  Workflow non testé en local (`jq` absent) : la première mise à jour de `develop` sert de test.
- **Suites** : créer le secret `DISCORD_WEBHOOK_URL` sur GitHub (user).

### 2026-11-18 — UC-002 Se connecter et se déconnecter (backend)

- **Quoi** : un membre du personnel se connecte avec son numéro et son mot de passe, puis se déconnecte.
  - La connexion ouvre une session neuve (nouvel identifiant, nouveau jeton CSRF, aucun salon actif) et renvoie le
    résumé de session avec l'étape suivante.
  - `GET /api/salon/session` redonne ce résumé à la réouverture de l'application.
  - Le frontend n'est pas fait.
- **Pourquoi** : UC-002 (lot 1). Décisions du user D-025 à D-028 :
  - les blocages ne visent que les appareils non reconnus ;
  - sessions de 24 h / 7 j pour le personnel, 2 h / 12 h pour les rôles système ;
  - étape suivante selon les accès ;
  - audit, purge à 48 h et rehachage.
- **Périmètre** :
  - **Module `identity`** :
    - domaine : politique d'essais (fonction pure), agrégat `KnownDevice`, normalisation des adresses (/64 en IPv6,
      port retiré), règle de l'étape suivante ;
    - commandes `SignIn`, `SignOut`, `PurgeSignInAttempts` (tâche horaire) ; query `GetMySession` en SQL pur ;
      historique des essais en repository de lecture SQL ;
    - une seule vérification argon2id par refus (empreinte factice), verrou PostgreSQL par numéro, refus levé après
      le commit ;
    - appareils reconnus : jetons générés par le serveur, hachés, renouvelés à chaque connexion, un par compte
      (5 au plus par navigateur).
  - **Socle** :
    - `AuthGuard` applique les durées des rôles système ;
    - deux limiteurs de connexion configurables (`SIGN_IN_RATE_LIMIT_PER_HOUR` = 100 par appareil,
      `SIGN_IN_ADDRESS_RATE_LIMIT_PER_HOUR` = 600 par adresse) ;
    - `TRUST_PROXY` devient un nombre de proxys, obligatoire hors local ;
    - `SqlReader` lit dans la transaction en cours.
  - **Migration** : `IdentitySignIn` (`sign_in_attempts`, `known_devices`).
  - **Contrat** : `SignIn`, `SignedIn`, `SignedOut`, `SessionSummary`, `NextStep`.
- **Vérification** : mode **light**, agents `use-case-writer`, `query-perf`, `backend-builder`, `security-reviewer`.
  - Suite complète verte : 200 tests unitaires, 36 d'intégration et 50 E2E côté backend, 36 côté frontend.
    Lint, typecheck et `pnpm arch` verts.
  - Mutations volontaires vues rouges : seuils et fenêtres de la politique, exemption de l'appareil reconnu, verrou
    par numéro, plafond de jetons, /64, renouvellement du jeton, filet par adresse.
  - Revue `security-reviewer` : rien de critique. Les 3 points « à corriger » ont été corrigés :
    - un tiers pouvait bloquer un appareil reconnu par le filet IP ;
    - un jeton venu du client était repris ;
    - un écart de temps révélait les comptes existants.
  - Contre-revue : 1 point corrigé (cookies forgés sans plafond par adresse).
  - Rapport d'index de `GetMySession` : Index Scan sur `users_pkey`.
- **Suites** (`docs/BACKLOG.md`) :
  - écran de connexion (front) ;
  - numéro mal formé : 422 plutôt que 400, à confirmer ;
  - compteur IPv6 au /48 ;
  - plantage natif intermittent des tests sous Windows ;
  - UC-003 doit lever les blocages et fermer les sessions.

### 2026-11-18 — Refactoring de structure du module `identity` (D-024)

- **Quoi** : chaque concept a son fichier, rangé par rôle. Le changement porte sur la structure, sans changer le
  comportement : contrat HTTP, codes d'erreur et schéma de base restent identiques.
  - **Domaine** : `aggregates/`, `value-objects/`, `enums/`, `exceptions/` (9 erreurs, un fichier chacune),
    `ports/` (6 ports), `repositories/write/` et `repositories/read/`, `services/` (politique d'envoi), `messages/`
    (textes des SMS, sortis de `application/`).
  - **Application** : chaque commande a son fichier `.response.ts`. L'étape suivante après l'inscription est
    décidée par l'application ; le contrôleur n'ajoute que le jeton CSRF.
  - **Infrastructure** : `persistence/orm-entities/` et `persistence/typeorm-repositories/`.
- **Pourquoi** : demande du user, pour des fichiers courts, faciles à trouver, et une séparation nette entre
  écriture (TypeORM) et lecture (SQL pur), jusque dans les repositories.
- **Périmètre** :
  - l'historique des codes envoyés (limites D-021/D-023) devient un repository de lecture `OtpSendHistory`,
    implémenté en SQL pur dans `application/read-repositories/` ; le repository TypeORM ne charge et ne sauve plus
    que des agrégats ;
  - `SqlReader` (socle) lit désormais dans la transaction en cours quand il y en a une ;
  - règles du projet mises à jour : `CLAUDE.md` §I.1, skills `hexagonal`, `ddd`, `sql-query`, agent `archi-reviewer`,
    checklist « nouveau module ».
- **Vérification** : mode **light**.
  - Backend : 128 tests verts (78 unitaires, 22 intégration, 28 E2E). Les tests existants n'ont changé que par
    leurs imports.
  - Nouveau test d'intégration (lecture dans la transaction de la commande), vu rouge puis vert.
  - Requête de l'historique cassée volontairement : détectée par l'intégration et par l'E2E « rafale = un seul SMS ».
  - Typecheck, oxlint et `pnpm arch` verts.
  - Revue `security-reviewer` : rien à corriger. Un durcissement noté dans le code et le backlog : la limite d'envoi
    suppose l'isolation READ COMMITTED.
- **Suites** : appliquer la même structure à `shared/domain` si le user le souhaite (backlog).

### 2026-11-18 — UC-001 Créer son compte propriétaire (backend)

- **Quoi** : un responsable de salon crée son compte avec son numéro, prouvé par un code SMS, et un mot de
  passe. Un compte client léger déjà existant est complété plutôt que dupliqué. La session s'ouvre, sans aucun
  rôle, et la suite indiquée est la création de l'organisation. Le frontend n'est pas fait, à la demande du user.
- **Pourquoi** : premier use case du lot 1 (PRD §7 étape 1), décisions D-017 à D-023.
- **Périmètre** :
  - **Module `identity`** :
    - domaine : `OtpChallenge` (défi SMS réutilisable par UC-003, UC-007 et UC-009), politique d'envoi,
      `NewPassword`, `User` ;
    - commandes `RequestSignUpCode` et `ConfirmSignUp`. Un code refusé est **renvoyé**, pas levé, pour que l'essai
      raté soit enregistré ;
    - repositories TypeORM avec verrou optimiste, HMAC des codes, argon2id, liste de mots de passe courants,
      faux fournisseur SMS, journal d'audit.
  - **Routes** : `POST /api/public/sign-up/code` et `POST /api/public/sign-up`.
  - **Migration** : `IdentityAccounts` (`users`, `otp_challenges`, index unique partiel du code actif).
  - **Contrat** : `identity.ts` dans `@gomecoiffer/contracts`.
  - **Docs** : UC-001 (17 scénarios Gherkin et `.feature`), inventaire des exigences du lot 1.
- **Vérification** : mode **light**.
  - Backend : 127 tests, dont 73 pour le module (unitaires, intégration Testcontainers, E2E).
  - Mutations volontaires vues rouges : essai raté non enregistré, refus levé dans la transaction, verrou par
    numéro retiré.
  - Inscription jouée contre l'API réelle et la base locale.
  - Revue `security-reviewer` : rien de critique. Les 4 points « à corriger » sont traités :
    - C1 (rafale de SMS) : verrou PostgreSQL par numéro ;
    - C2 (force brute dans la durée) et C4 (quota partagé) : plafonds sur 24 h par numéro et par motif, D-023 ;
    - C3 (numéros recyclés) : décision du user ajoutée au backlog ;
    - durcissements : code masqué dans les logs hors local, liste de mots de passe renforcée, commande qui masque
      ses secrets, config inutile retirée, test de destruction de la session visiteur.
- **Suites** : écran d'inscription (front), prérequis avant un vrai fournisseur SMS, décision sur les numéros
  recyclés (voir `docs/BACKLOG.md`). Prochain use case du lot : UC-002 Se connecter.

### 2026-11-17 — Socle technique (lot 0) : monorepo, API NestJS + TypeORM, front React

- **Quoi** : l'application démarre de bout en bout. Le monorepo pnpm contient l'API (`backend/`), le front
  (`frontend/`) et des contrats partagés (`packages/contracts`). Le front affiche l'état de l'API via le proxy
  Vite, et les trois espaces (marketplace, salon, administration) sont routés.
- **Pourquoi** : lot 0 du backlog. Tous les lots MVP s'appuient sur ces fondations : transactions, événements,
  sécurité, lectures en SQL pur (D-001), temps réel SSE (D-002).
- **Périmètre** :
  - **API** :
    - config validée au démarrage (secrets forts et distincts, règles de prod) ;
    - TypeORM 1.x sans `synchronize`, registres d'entités et de migrations (D-012), CLI de migration ;
    - gabarit `sql` + `SqlReader`, et `TransactionalCommandBus` avec actions post-commit ;
    - outbox relayée sur un bus local, avec des consommateurs idempotents ;
    - session PostgreSQL et CSRF double-submit ;
    - `AuthGuard` qui refuse par défaut, avec une durée absolue de session et une revalidation du salon actif ;
    - permissions par salon et rôles système séparés ;
    - contrôle au démarrage des protections de route ;
    - `ApiResponse`, erreurs normalisées, validation Standard Schema, SSE privé ;
    - logs sans données personnelles (`safeError`) et OpenAPI hors prod.
  - **Migration** : `1795000000000-Socle` (`btree_gist`, `outbox`, `processed_events`, `sessions`, `audit_log`).
  - **Front** :
    - Vite 8, React 19.3 et React Compiler ;
    - Redux Toolkit avec RTK Query et gateways injectés ;
    - `HttpClient` (CSRF, 401/403) et gestionnaire SSE ;
    - i18n fr, RBAC, formats FCFA et fuseau du salon ;
    - module de démonstration `health` qui sert de référence de style.
  - **Contrats** : `ApiResponse`, `ErrorCode`, jeton CSRF, santé, événement temps réel.
  - **Décisions** : D-009 à D-016.
- **Vérification** : mode **light**.
  - Backend : 60 tests (32 unitaires, 8 d'intégration Testcontainers, 20 E2E). Les règles critiques (idempotence,
    envoi post-commit, CSRF, permissions, durée de session, salon quitté, protection des routes) ont été
    vérifiées par mutation volontaire.
  - Frontend : 36 tests.
  - Typecheck, oxlint, `pnpm arch` et build des deux applications : verts.
  - API démarrée réellement contre PostgreSQL local, avec le front servi par Vite.
  - Revue `security-reviewer` : aucune faille critique. Les 5 points « à corriger » ont été corrigés dans le lot
    (logs, oubli de décorateur, salon actif, durée absolue, config). Les durcissements restants sont dans le backlog.
- **Suites** : lot 1 (connexion et droits réels, voir `docs/BACKLOG.md`), rendu 390 px à vérifier.

### 2026-11-17 — Initialisation de la configuration Claude Code, de la documentation et de l'environnement

- **Quoi** : mise en place de `CLAUDE.md`, de la configuration `.claude/` (8 agents, 9 skills, hooks), du
  dossier `docs/` (backlog, évolutions, décisions, référentiels), de l'infrastructure locale
  (`infra/compose.yml` : PostgreSQL 17, Mailpit) et des fichiers d'environnement du backend.
- **Pourquoi** : démarrer le projet avec les règles de travail reprises de VO'SSOU, adaptées à l'architecture
  NestJS de `backend/backendNestjs.md`, avec **TypeORM** pour les écritures et des **requêtes SQL pures écrites
  dans la couche application** pour les lectures (décision du user, voir `docs/DECISIONS.md` D-001).
- **Périmètre** :
  - agents `backend-builder`, `query-perf`, `front-builder`, `front-ui`, `use-case-writer`, `archi-reviewer`,
    `security-reviewer`, `front-reviewer` ;
  - skills `ddd`, `hexagonal`, `nest-stack` (nouveau), `tdd`, `sql-query`, `security`, `clean-code`,
    `refactoring`, `front-stack` ;
  - hooks : garde-fous sur `.env` et les migrations commitées, garde-fous shell (push forcé, `--no-verify`,
    `schema:sync`), formatage Prettier, contexte de session, worktrees ;
  - `backend/.env.example` (commité) et `backend/.env` / `infra/.env` (secrets générés aléatoirement, ignorés
    par git, lecture réservée au compte Windows courant) ;
  - PRD déplacé dans `docs/cahier-des-charges/prd.md`.
- **Vérification** : 22 cas de test des hooks garde-fous passés, plus le cas de la migration commitée, vérifié
  dans un dépôt git temporaire. Aucun code applicatif à ce stade.
- **Suites** : initialiser git (URGENT du backlog), décisions attendues du user, lot 0 (socle technique).

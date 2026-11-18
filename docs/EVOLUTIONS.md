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

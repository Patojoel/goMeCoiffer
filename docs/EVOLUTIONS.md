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

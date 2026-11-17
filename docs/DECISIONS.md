# Décisions — GoMeCoiffer

Décisions d'architecture et décisions métier tranchées. Une décision ne se rediscute pas sans élément nouveau ;
si elle change, on ajoute une nouvelle entrée qui remplace l'ancienne (« remplace D-00x ») au lieu de réécrire
l'historique. Les décisions encore attendues sont listées dans `docs/BACKLOG.md`.

| ID | Date | Décision | Raison | Source |
|---|---|---|---|---|
| D-001 | 2026-11-17 | Persistance **TypeORM** pour les écritures (entités et repositories derrière des ports). Lectures en **SQL pur écrit dans `application/queries`**, exécuté par le port `SqlReader` avec le gabarit `sql` (paramètres liés), jamais par l'ORM. | Choix du user ; garder les lectures optimisables et lisibles, l'ORM limité au cycle de vie des agrégats. | user |
| D-002 | 2026-11-17 | Temps réel par **SSE**, relecture complète à la reconnexion ; **aucun broker** au MVP (outbox + relais en processus). | PRD §12 (SSE ou équivalent, pas de Kafka/RabbitMQ). | PRD |
| D-003 | 2026-11-17 | Le **salon** est le périmètre (tenant) ; le **salon actif** est porté par la session et change le contexte d'autorisation ; rôles système et permissions salon sont deux mondes séparés. | PRD §2-6, BR-12. | PRD |
| D-004 | 2026-11-17 | Authentification par **session serveur** (cookie HttpOnly, stockage PostgreSQL) + CSRF double-submit ; pas de JWT. | Révocation immédiate, changement de salon actif côté serveur, périmètre critique de `CLAUDE.md`. | archi |
| D-005 | 2026-11-17 | Non-chevauchement des réservations garanti **en base** par une contrainte d'exclusion PostgreSQL (`btree_gist`), en plus de la revalidation applicative. | PRD §12 Concurrence, BR-02. | PRD |
| D-006 | 2026-11-17 | Monorepo pnpm : `backend/` (paquet `api`), `frontend/` (paquet `web`), `packages/contracts` (Zod 4 partagés). | Dossiers existants du projet ; contrat partagé API ↔ web (`backend/backendNestjs.md`). | archi |
| D-007 | 2026-11-17 | Montants en **FCFA (XAF) entiers** ; instants en UTC (`timestamptz`), affichage et calcul des créneaux dans le fuseau IANA du salon (`Africa/Douala` par défaut). | PRD §12 Dates, marché Cameroun. | PRD |
| D-008 | 2026-11-17 | Ports locaux : bloc **10400-10409** (API 10400, Vite 10401, PostgreSQL 10402, Mailpit 10403/10404), publiés sur `127.0.0.1`. | Pas de conflit avec VO'SSOU (10370-10389). | archi |
| D-009 | 2026-11-17 | **ESM confirmé** côté API (les paquets NestJS 12 sont publiés en ESM). La CLI TypeORM tourne sur le code compilé (`dist/database/data-source.js`), jamais sur les sources TS. | Socle lot 0. | archi |
| D-010 | 2026-11-17 | **TypeScript 6.0** (pas 7.0) dans tout le monorepo. | `@nestjs/swagger` 12 n'accepte que TS ^5.5 \|\| ^6. À revoir quand il acceptera TS 7. | archi |
| D-011 | 2026-11-17 | Config de l'API par un module maison `AppConfigModule.forRoot(config)` (Zod), pas `@nestjs/config`. | Config typée validée avant la construction du module ; les tests E2E passent leur propre config sans dépendre de `process.env`. | archi |
| D-012 | 2026-11-17 | Entités et migrations déclarées dans des **registres** (`src/database/entities.ts`, `src/database/migrations.ts`), pas par glob. | Les globs de fichiers ne marchent ni sous Vitest ni de façon fiable en ESM sous Windows ; un registre est vérifié par le typecheck. | archi |
| D-013 | 2026-11-17 | Santé exposée par `GET /api/public/health` (ping SQL), sans `@nestjs/terminus`. | Un seul indicateur utile au MVP ; une dépendance de moins. | archi |
| D-014 | 2026-11-17 | React Compiler activé par l'option native `react({ compiler: true })` de `@vitejs/plugin-react` 6 (marquée expérimentale), pas par Babel. | Pas de chaîne Babel dans Vite 8 ; repli documenté dans `docs/frontend.md` si l'option pose problème. | archi |
| D-015 | 2026-11-17 | pnpm 11 : seul `@swc/core` est autorisé à exécuter un script d'installation (`allowBuilds`) ; les exclusions de la politique d'âge des versions sont tenues dans `pnpm-workspace.yaml`. | Surface « supply-chain » minimale. | archi |
| D-016 | 2026-11-17 | Branches git : `main` = prod, `staging`, `develop` = preprod, `feature/*` pour chaque chantier, fusionnés dans `develop` puis promus vers `main`. | Demande du user. | user |

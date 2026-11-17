# Checklists — GoMeCoiffer

Pas-à-pas pour le socle, un nouveau module backend, une nouvelle query, un nouveau module frontend et la fin
d'une évolution. Les règles de fond sont dans `CLAUDE.md` et les skills ; ici, l'ordre des gestes.

## Socle (lot 0, une seule fois)

**Monorepo**
- [ ] `pnpm-workspace.yaml` (`backend`, `frontend`, `packages/*`), `.nvmrc` (24), `package.json` racine avec `dev`, `test`, `lint`, `typecheck`, `arch`, `mutation`.
- [ ] `packages/contracts` : Zod 4, export ESM, `ApiResponse<T>` et codes d'erreur partagés.
- [ ] Prettier et oxlint/ESLint à la racine (le hook `format-file` utilise `node_modules/.bin/prettier`).
- [ ] dependency-cruiser : `domain/` n'importe que `shared/domain` ; `application/` sans `typeorm` ni HTTP ; aucun import de l'`infrastructure/` d'un autre module ; front : `*HttpGateway` seulement depuis `lib/store/dependencies/`.

**Backend (`backend/`, paquet `api`)**
- [ ] NestJS 12 + `@nestjs/cqrs` ; vérifier `@Body({ schema })` et noter le résultat dans `docs/DECISIONS.md`.
- [ ] `shared/infrastructure/config` : schéma Zod de **toutes** les variables de `backend/.env.example`, validé au démarrage ; secrets avec longueur minimale ; `synchronize` impossible.
- [ ] TypeORM : `database/data-source.ts`, `namingStrategy` snake_case, `synchronize: false`, scripts `migration:*` ; vérification des migrations en attente au démarrage hors local ; décision ESM/CJS dans `docs/DECISIONS.md`.
- [ ] Première migration écrite à la main : `CREATE EXTENSION IF NOT EXISTS btree_gist`, tables `outbox`, `processed_events`, `sessions`, `audit_log`.
- [ ] `nestjs-cls` + `@nestjs-cls/transactional` + adaptateur TypeORM ; `TransactionalCommandBus` ; `AfterCommitQueue`.
- [ ] `shared/application` : `Clock`, `IdGenerator` (UUID v7), `SqlReader` + gabarit `sql` (avec ses propres tests : paramètres numérotés, fragments imbriqués, refus d'une valeur non constante dans `unsafe`), `RealtimePublisher`, `DomainEventSubscriber`.
- [ ] `shared/domain` : `AggregateRoot`, `DomainEvent`, `IntegrationEvent`, erreurs de base (`NotFoundError`, `ScopeViolationError`, `ConflictError`, `ConcurrencyConflictError`, `BusinessRuleViolation`), `Money` (XAF), `TimeRange`, `PhoneNumber`.
- [ ] Événements : `DomainEventDispatcher` (découverte des subscribers par `DiscoveryService`), `OutboxRepository`, `OutboxRelay` (bus local) + poller `@nestjs/schedule`.
- [ ] HTTP : préfixe `/api`, `helmet`, CORS allowlist, `ApiResponse<T>` + intercepteur, `DomainExceptionFilter` (table d'erreurs de `CLAUDE.md` §I.4), OpenAPI hors prod.
- [ ] Sécurité : session PostgreSQL, CSRF double-submit, `AuthGuard` global deny-by-default, `@Public()`, `PermissionsGuard` + `@RequiresPermission()`, `@RequiresSystemRole()`, `@CurrentActor()`, throttler ; **revue `security-reviewer` obligatoire**.
- [ ] SSE : adaptateur `RealtimePublisher`, flux privé authentifié, flux public de disponibilités.
- [ ] Observabilité : `nestjs-pino` avec redaction (`cookie`, `password`, `otp`, `token`, `phone`), `@nestjs/terminus` (`/api/health`).
- [ ] Tests : `vitest.config.ts` (projects unit/integration/e2e, `unplugin-swc`), helper Testcontainers (base modèle migrée + clone par worker), helper E2E (agent supertest avec session + CSRF), fakes (`FixedClock`, `SequentialIdGenerator`, `InMemoryRealtimePublisher`, `FakePaymentGateway`, `FakeSmsSender`).
- [ ] Seed de démo : `database/seed/` + script `db:seed` (une organisation, deux salons, rôles, intervenants, prestations, horaires, réservations sur la semaine).

**Frontend (`frontend/`, paquet `web`)**
- [ ] Vite 8 + React 19.2 + React Compiler ; TypeScript strict ; Tailwind v4 + shadcn/ui.
- [ ] `lib/store` (store, reducer, `AppDependencies`, `createTestStore`), `lib/store/api/appApi.ts` (RTK Query), `lib/http/HttpClient`, `lib/i18n`, `lib/rbac`, `lib/realtime`.
- [ ] Trois layouts paresseux : marketplace (`/`), salon (`/salon/*`), admin (`/admin/*`).
- [ ] Vitest + Testing Library + MSW (intégration du gateway HTTP).

## Nouveau module backend

1. [ ] Use cases rédigés (`use-case-writer`) et contrat d'API figé dans `packages/contracts`.
2. [ ] Dossiers `domain/`, `application/{commands,queries,subscribers}/`, `infrastructure/{persistence,http}/`, `tests/{unit,integration,e2e,builders,fakes}/`.
3. [ ] Liste des règles en phrases métier ; tests unitaires un par un (rouge vu, puis vert).
4. [ ] Agrégat, VO, erreurs nommées, port de repository + token, événements au passé.
5. [ ] Entité `*.orm-entity.ts`, mapper, `TypeOrm<X>Repository` (via `txHost.tx`, périmètre `salonId`, verrou optimiste) ; fake in-memory équivalent.
6. [ ] Migration TypeORM générée **relue** (+ parties écrites à la main) ; ligne dans `docs/migrations-history.md`.
7. [ ] Tests d'intégration du repository (Testcontainers, vraies migrations).
8. [ ] Contrôleur mince + `@RequiresPermission` + `TransactionalCommandBus` ; câblage `<module>.module.ts` ; import dans `app.module.ts`.
9. [ ] Test E2E du parcours, avec cas « autre salon → 404 » et refus de droit en table de cas.
10. [ ] Seed de démo et droits des rôles prédéfinis pour les nouvelles permissions.
11. [ ] `docs/domains.md`, `docs/events.md` à jour ; revue selon le mode (`archi-reviewer` en full ; `security-reviewer` si périmètre critique).

## Nouvelle query (lecture)

1. [ ] Test E2E d'abord (contrat de la réponse, isolation entre salons, « les siennes » vs « toutes » si concerné).
2. [ ] `application/queries/<use-case>/` : query, handler (gabarit `sql` + `SqlReader`), read model `readonly`.
3. [ ] CTE filtrées à l'entrée, projection minimale, alias camelCase, agrégation en SQL.
4. [ ] Mesure réelle : `pg_indexes` + `EXPLAIN (ANALYZE, BUFFERS)` ; migration d'index si besoin.
5. [ ] Rapport d'analyse (structure, problèmes, tableau d'index, récapitulatif 🔴/🟡/🟠).
6. [ ] Ligne dans `docs/domains.md` (queries).

## Nouveau module frontend

1. [ ] Contrat lu dans `packages/contracts` ; port `models/gateway/<Module>Gateway.ts`.
2. [ ] Fake in-memory du gateway ; tests de logique d'abord (thunk/slice/listener/hook).
3. [ ] `infra/repo/<Module>HttpGateway.ts` sur `HttpClient` ; câblage dans `lib/store/dependencies/`.
4. [ ] Endpoints RTK Query (`infra/api/<module>Api.ts`, `providesTags`) ; thunks de commande qui invalident ; abonnements SSE.
5. [ ] Écrans (`infra/ui/`) mobile-first + hooks `use*` ; i18n ; garde de permission ; aides de guidage.
6. [ ] Route paresseuse dans le bon espace (marketplace, salon, admin).
7. [ ] Captures 390 px et ordinateur ; `test`, `lint`, `build` verts ; revue selon le mode.

## Fin d'une évolution (session principale)

- [ ] Diff relu, tests des modules touchés relancés par la session principale (nombre lu), suite complète avant le commit final.
- [ ] Revues exigées par le mode faites, findings traités ou reportés au backlog.
- [ ] Entrée dans `docs/EVOLUTIONS.md` (gabarit en tête du fichier).
- [ ] `docs/BACKLOG.md` : entrée sortie si traitée, nouveaux points relevés ajoutés avec date et source.
- [ ] `docs/domains.md`, `docs/events.md`, `docs/migrations-history.md`, `docs/DECISIONS.md` à jour si concernés.

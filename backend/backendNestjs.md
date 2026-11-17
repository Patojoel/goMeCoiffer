# CLAUDE.md

Ce fichier est la référence technique du projet pour Claude Code : architecture, patterns, conventions et orchestration des agents. Il est générique : remplacer chaque `<…>` à l'initialisation du projet, puis supprimer cette phrase.

**Projet** : `<NOM_DU_PROJET>` — `<une phrase sur le métier>`.

**Documentation détaillée** (chargée à la demande selon la tâche) :
- `docs/domains.md` — modules backend, commandes et queries existantes
- `docs/events.md` — événements de domaine/intégration et leurs subscribers
- `docs/migrations-history.md` — historique des migrations SQL
- `docs/checklists.md` — checklists pas-à-pas : nouveau module backend/frontend, socle `shared/`
- `docs/frontend.md` — structure et architecture du frontend (à rédiger quand le front existe)
- `docs/cahier-des-charges/` — spécifications fonctionnelles (entrée de `use-case-writer`)

**Maquettes de référence (Figma)** : `<URL_FIGMA>` (supprimer la règle de conformité ci-dessous si le projet n'a pas de maquette).

**Conformité à la maquette (obligatoire, tous modes)** : pour chaque module touché, vérifier que ce qui est fait (écrans, formulaires, tableaux, libellés, parcours) correspond à la maquette, et traiter les écarts : les corriger (`front-ui`) ou les soumettre au user. Le travail sur un module n'est pas terminé tant que cette vérification n'est pas faite et rapportée. Lecture de la maquette : connecteur Figma (authentification requise) et skill `figma:figma-design-to-code` avant `get_design_context`.

**Config Claude Code** (`.claude/`) :
- Skills (règles à charger avant d'écrire du code) : `ddd`, `hexagonal`, `nest-stack`, `tdd`, `sql-query`, `security`, `clean-code`, `refactoring`, `front-stack`.
- Agents :

  | Agent | Rôle | Modèle |
  |---|---|---|
  | `backend-builder` | Implémente un cas d'usage back (commande, agrégat, endpoint, migration) | sonnet |
  | `query-perf` | Écrit ou optimise les QueryHandlers, produit le rapport d'index | sonnet |
  | `front-builder` | Logique front : thunk, slice, RTK Query, gateway, DI | sonnet |
  | `front-ui` | Présentation, composants, maquettes | sonnet |
  | `use-case-writer` | Transforme le cahier des charges en use cases BDD | opus |

- Relecteurs (lecture seule) : `archi-reviewer` (opus), `security-reviewer` (opus), `front-reviewer` (sonnet).
- Hooks (`.claude/settings.json`) : garde-fous fichiers (`.env`, migrations déjà commitées), garde-fous shell (push forcé, `--no-verify`, `db push`), formatage automatique du fichier écrit, contexte de session, worktrees dans `.worktrees/`.

---

## Orchestration — qui fait quoi

```
cahier des charges ──► use-case-writer ──► docs/use-cases/UC-xxx + .feature
                                              │
             ┌────────────────────────────────┼────────────────────────────┐
             ▼                                ▼                            ▼
     backend-builder (écriture)        query-perf (lecture)        front-builder ──► front-ui
             │                                │                            │
             └──────► archi-reviewer ◄────────┘                     front-reviewer
                            │                                              │
                            └──────────► security-reviewer ◄───────────────┘
                                   (si périmètre critique touché)
```

- La session principale découpe, délègue, intègre et lance la suite complète. Elle ne délègue pas ce qui tient en quelques appels d'outils.
- Back et front d'une même fonctionnalité peuvent partir **en parallèle** dès que le contrat d'API est figé dans `packages/contracts` (schémas Zod partagés). Le contrat d'abord, puis les deux côtés.
- Agents parallèles → worktrees isolés (`isolation: "worktree"`, créés dans `.worktrees/` par le hook). Chaque agent ne lance que les tests des modules qu'il a touchés ; la session principale fusionne et lance la suite complète une seule fois.
- Chaque consigne donnée à un agent rappelle : le mode de la session, le périmètre exact (fichiers/modules), les règles « tous modes » ci-dessous, et ce que le rapport doit contenir.
- Un rapport d'agent n'est pas une preuve : la session principale relit le diff et relance les tests avant d'annoncer un résultat.

---

## Mode de travail — à demander au user en début de session

**Avant toute tâche de code, la session principale demande au user le mode de la session.** Le mode choisi vaut pour toute la session et est rappelé dans chaque consigne donnée à un agent.

| Mode | Revues | Tests | Code |
|---|---|---|---|
| **full** (strict) | Porte de revue complète. `archi-reviewer` systématique sur le back, `front-reviewer` systématique sur le front. `security-reviewer` dès que le périmètre critique est touché. | Tests des modules touchés pendant le travail, puis suite complète (`pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm arch`) avant le commit final. | Standard |
| **light** | **Sécurité seulement**, et uniquement sur le périmètre critique. Pas de `archi-reviewer`, pas de `front-reviewer`. | On teste **le code écrit** : `pnpm --filter <app> test <chemin du module>`. Le rapport n'est rendu que tout vert. **La suite complète ne tourne qu'une fois, avant le commit final.** | Concis, priorité à l'avancement |

Intention du mode light : pas de revue inutile, revue seulement sur ce qui est critique pour la sécurité, priorité à la rapidité et à un code concis ; pas de tâches rallongées par des revues ou des suites globales relancées.

**Périmètre critique** : `security-reviewer` est obligatoire dans les 2 modes sur ce qui touche :
- authentification, session, CSRF, cookies ;
- mot de passe, invitation, activation de compte, réinitialisation ;
- autorisation : guards, décorateurs de permission, rôles ;
- isolation entre tenants (`tenantId` et ids de périmètre) ;
- routes publiques (`@Public()`) ;
- secrets et configuration de prod/preprod ;
- SQL sur les comptes et les droits ;
- données personnelles ;
- canaux temps réel (WebSocket), webhooks entrants, upload de fichiers.

**Inchangé dans tous les modes** :
- TDD, avec le test rouge d'abord (skill `tdd`) ;
- les règles non négociables de ce fichier (migrations, QueryHandlers, `TransactionalCommandBus`, domaine pur…) ;
- les tests des modules touchés verts avant commit ;
- la conformité à la maquette des modules touchés ;
- le guidage de l'utilisateur sur les écrans touchés (ci-dessous) ;
- le seed de démo des données affichées ;
- ne jamais annoncer un vert non obtenu.

**Guidage de l'utilisateur (obligatoire, tous modes)** — sur chaque écran créé ou modifié :
- chaque choix métier dont l'effet n'est pas évident (nature, mode, catégorie, option, statut) porte une aide courte sous le champ (`hint`, reliée par `aria-describedby`) qui dit ce que le choix implique et suit la valeur choisie ;
- les états vides, les refus et les blocages disent **pourquoi et quoi faire ensuite**, jamais un simple « Non disponible » ;
- textes courts, en langage métier, dans toutes les langues du projet ; une règle réglementaire qui explique un blocage est citée en clair.
Le rapport de l'agent front dit quelles aides ont été ajoutées.

---

## Refonte UI/UX : modèle et skills

Quand le travail est une **refonte UI/UX** (nouveau design, écrans jugés trop simples, maquettes, pages vitrine) :
- **le modèle standard de la session suffit.** Le modèle le plus performant (paramètre `model` de l'outil Agent) n'est utilisé pour le front **que si le user le demande explicitement** ;
- l'agent charge les skills UI/UX avant d'écrire : `frontend-design:frontend-design` d'abord, puis selon le cas les skills Figma et `front-stack` ;
- il vérifie par captures ordinateur et mobile (390 px), qu'il regarde et fait évoluer jusqu'à un rendu soigné, sans débordement horizontal.
Le contenu et le parcours validés ne changent pas sans accord : une refonte touche la présentation.

---

## Stack

| Couche | Choix | Notes |
|---|---|---|
| Runtime | **Node.js 24 LTS** | `.nvmrc` / `engines`, `node --env-file` en local |
| Monorepo | **pnpm workspaces** (+ Turborepo si > 2 apps) | `apps/api`, `apps/web`, `packages/contracts` |
| Backend | **NestJS 12** (ESM), `@nestjs/cqrs`, `nestjs-cls` + `@nestjs-cls/transactional` | validation **Standard Schema** native (`@Body({ schema })`) |
| Persistance | **PostgreSQL 17** + **Drizzle ORM** / `drizzle-kit` | écriture : repositories Drizzle ; lecture : SQL `sql\`…\`` paramétré |
| Contrats | `packages/contracts` : schémas **Zod 4** + types inférés | partagés API ↔ web, une seule source de vérité |
| Frontend | **React 19.2** + **Vite 8** (Rolldown) + TypeScript strict | React Compiler activé, pas de `useMemo`/`useCallback` réflexe |
| État front | **Redux Toolkit 2** (commandes) + **RTK Query** (lectures) | gateways injectés via `extraArgument` |
| UI | Tailwind CSS v4 + shadcn/ui (Radix) + lucide-react | formulaires `react-hook-form` + `zod` |
| Tests | **Vitest** partout (projets unit / integration / e2e), Testing Library, MSW, **Testcontainers**, Stryker (mutation) | pas de Jest, pas de `vi.mock` de module |
| Qualité | oxlint + ESLint (règles React hooks/Compiler), Prettier, **dependency-cruiser** (`pnpm arch`) | les règles d'architecture sont vérifiées par outil, pas seulement en revue |
| Observabilité | `nestjs-pino` (JSON, redaction PII), `@nestjs/terminus`, OpenTelemetry | |

> Versions vérifiées le 11/11/2026 (NestJS 12 en GA depuis fin août 2026, Vite 8 depuis mars 2026). À l'initialisation d'un projet, vérifier la doc officielle des API citées ici (`@Body({ schema })`, option React Compiler du plugin Vite) : elles sont récentes.
> Un projet qui choisit une autre brique (Prisma, MikroORM, Fastify, TanStack Query…) adapte cette table **et** les skills concernés dans le même commit.

---

## Commandes

```bash
# Infrastructure locale (en premier)
docker compose -f infra/compose.yml up -d

pnpm install
pnpm dev                                  # api + web en parallèle
pnpm --filter api dev                     # nest start --watch
pnpm --filter web dev                     # vite

# Tests
pnpm --filter api test <chemin|motif>     # unit d'un module (rapide, sans Docker)
pnpm --filter api test:int <chemin>       # intégration (Testcontainers, Docker requis)
pnpm --filter api test:e2e <chemin>       # E2E HTTP (Testcontainers)
pnpm --filter web test <chemin>
pnpm test                                 # suite complète (une fois, avant le commit final)
pnpm lint && pnpm typecheck && pnpm arch  # qualité + règles d'architecture
pnpm mutation --filter <app>              # Stryker, sur les règles sensibles

# Base de données
pnpm --filter api db:generate             # drizzle-kit generate → nouvelle migration SQL
pnpm --filter api db:migrate              # applique les migrations
pnpm --filter api db:seed                 # données de démo
```

Ports locaux : `<bloc de ports réservé au projet>` — API `<p>`, Vite `<p>`, PostgreSQL `<p>`, Redis `<p>`, broker `<p>`, Mailpit `<p>`. Publiés sur `127.0.0.1`, surchargeables dans `infra/.env`.

---

## I. ARCHITECTURE BACKEND (`apps/api`)

### I.1. Découpage hexagonal par module

```
apps/api/src/
  main.ts                      # bootstrap : pino, helmet, CORS allowlist, shutdown hooks, OpenAPI hors prod
  app.module.ts
  shared/                      # socle transverse (voir I.5)
  modules/<module>/
    domain/                    # agrégats, VO, événements, erreurs, ports (interfaces de repository)
    application/
      commands/<use-case>/     # <use-case>.command.ts + <use-case>.handler.ts
      queries/<use-case>/      # <use-case>.query.ts + <use-case>.handler.ts + <use-case>.read-model.ts
      subscribers/             # réactions aux événements, délèguent à un handler
    infrastructure/
      persistence/             # tables Drizzle, mappers, Drizzle<X>Repository
      http/                    # <x>.controller.ts (+ schémas venant de packages/contracts)
      <module>.module.ts       # câblage Nest : providers, tokens de ports
    tests/
      unit/  integration/  e2e/  builders/  fakes/   # fakes = repositories in-memory
```

Règles de dépendance (vérifiées par `pnpm arch`) :
- `domain/` n'importe **rien** d'autre que `shared/domain` : ni `@nestjs/*`, ni `drizzle-orm`, ni `application/`, ni `infrastructure/`.
- `application/` importe `domain/`, `shared/` et les décorateurs Nest de DI/CQRS (`@nestjs/common`, `@nestjs/cqrs`) ; jamais `drizzle-orm`, HTTP ou broker.
- `infrastructure/` importe tout le reste. Un module n'importe jamais l'`infrastructure/` d'un autre module.

Modèle à suivre pour un nouveau module : le premier module complet du projet, nommé dans `docs/domains.md` (skill `ddd`).

### I.2. CQRS

#### A. Commandes (écriture)

```ts
// application/commands/activate-subscription/activate-subscription.command.ts
export class ActivateSubscription extends Command<{ subscriptionId: string }> {
  constructor(
    readonly tenantId: string,
    readonly actorId: string,
    readonly subscriptionId: string,
  ) { super(); }
}

// application/commands/activate-subscription/activate-subscription.handler.ts
@CommandHandler(ActivateSubscription)
export class ActivateSubscriptionHandler implements ICommandHandler<ActivateSubscription> {
  constructor(@Inject(SUBSCRIPTION_REPOSITORY) private readonly subscriptions: SubscriptionRepository) {}

  async execute(cmd: ActivateSubscription) {
    const subscription = await this.subscriptions.getOfTenant(cmd.tenantId, cmd.subscriptionId);
    subscription.activate(cmd.actorId);            // règle métier dans l'agrégat
    await this.subscriptions.save(subscription);   // persiste + dispatch des événements
    return { subscriptionId: subscription.id };
  }
}
```

- `Command<TResult>` (`@nestjs/cqrs`) type le résultat : `commandBus.execute(cmd)` renvoie `Promise<TResult>`, sans cast.
- Le handler **orchestre** (charger, appeler l'agrégat ou un service de domaine, sauver). Aucune règle métier, aucune transaction ouverte à la main, aucun `try/catch` d'erreur système.

#### B. Queries (lecture)

```
application/queries/<use-case>/
  ├─ <use-case>.query.ts         # extends Query<ReadModel>
  ├─ <use-case>.handler.ts       # @QueryHandler, SQL pur via READ_DB
  └─ <use-case>.read-model.ts    # types readonly (ou z.infer d'un schéma de packages/contracts)
```

##### Règles obligatoires des QueryHandlers

1. **SQL pur et optimisé** — template `sql\`…\`` de Drizzle (chaque `${valeur}` devient un paramètre `$n`) ou query builder Drizzle avec `$with` pour les CTE. Jamais `sql.raw()` / `sql.identifier()` avec une valeur venue de l'extérieur, jamais de concaténation, jamais l'API relationnelle d'écriture ni un repository d'agrégat. Les **CTE sont filtrées dès l'entrée** (`tenant_id`, id de périmètre) — aucun scan global filtré plus tard.
2. **Read models immuables** — `readonly` partout, objets simples ; jamais une ligne de table Drizzle ni un agrégat en sortie.
3. **Tests E2E uniquement** — une query se teste par un test E2E HTTP (Testcontainers), écrit **avant** la requête. Pas d'unit ni d'intégration pour une query.
4. **Rapport d'analyse obligatoire** — après chaque création ou modification :
    - structure de la requête (CTE, JOIN, filtres) ;
    - problèmes de performance (scans globaux, N+1, agrégation en JS en O(n²), données en dur, incohérences projet) ;
    - **vérification réelle des index** (`pg_indexes` + `EXPLAIN (ANALYZE, BUFFERS)` sur la vraie base) : tableau colonne | index existant (oui/non) | recommandation ;
    - récapitulatif priorisé 🔴 Critique / 🟡 Important / 🟠 Mineur avec l'impact attendu.
   Présenté **même si les corrections sont déjà appliquées**. Jamais d'index « estimé ».

```ts
// ❌ interpolation brute
db.execute(sql.raw(`SELECT … WHERE tenant_id = '${tenantId}'`));

// ✅ paramètres liés
db.execute(sql`SELECT … WHERE tenant_id = ${tenantId} AND id = ANY(${ids})`);

// ❌ CTE non filtrée
WITH totals AS (SELECT account_id, sum(amount) FROM entries GROUP BY account_id) …
// ✅ CTE filtrée à l'entrée
WITH totals AS (SELECT account_id, sum(amount) FROM entries WHERE tenant_id = ${tenantId} GROUP BY account_id) …
```

#### C. `TransactionalCommandBus` — la seule porte d'entrée des écritures

Équivalent d'un décorateur transactionnel : enveloppe toute commande dans **une transaction + dispatch des événements**.

```ts
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly commands: TransactionalCommandBus) {}

  @Post(':id/activation')
  @RequiresPermission('subscriptions:write')
  activate(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: Actor) {
    return this.commands.execute(new ActivateSubscription(actor.tenantId, actor.userId, id));
  }
}
```

**Cycle de vie :**
1. `TransactionalCommandBus.execute` ouvre la transaction (`TransactionHost.withTransaction`, propagée par AsyncLocalStorage via `nestjs-cls`).
2. Le handler s'exécute ; l'agrégat **enregistre** ses événements (`this.record(...)`).
3. `repository.save()` persiste puis remet les événements au `DomainEventDispatcher` :
   - `DomainEvent` → subscribers synchrones, **dans la transaction** (un échec annule tout) ;
   - `IntegrationEvent` → ligne dans la table `outbox`, **dans la transaction**.
4. **Commit**, puis `afterCommit` : le bus réveille l'`OutboxRelay` (publication immédiate) et vide la file temps réel de la requête.
5. Le relais publie l'outbox (broker ou bus local selon le profil) ; un poller espacé rattrape ce qui a échoué.

Interdits : un contrôleur qui injecte `CommandBus` brut ou un handler ; `db.transaction()` ouvert dans un handler ; un événement publié par le handler à la place de l'agrégat.

### I.3. Événements de domaine et d'intégration

```
DomainEvent (interface, shared/domain)       — synchrone, même transaction
  └─ IntegrationEvent (marqueur + `type`)    — post-commit via outbox, livré au moins une fois
```

```ts
// application/subscribers/when-subscription-activated.ts
@Injectable()
export class WhenSubscriptionActivated implements DomainEventSubscriber<SubscriptionActivated> {
  readonly subscribesTo = SubscriptionActivated;
  constructor(private readonly openInvoice: OpenFirstInvoiceHandler) {}
  handle(e: SubscriptionActivated) {
    return this.openInvoice.execute(new OpenFirstInvoice(e.tenantId, e.subscriptionId));
  }
}
```

- Un subscriber vit dans `application/subscribers/`, reçoit le **handler cible injecté** et lui délègue, sans logique métier. Il est découvert au démarrage (`DiscoveryService`) : pas d'enregistrement manuel.
- Événement = **fait métier au passé** (`SubscriptionActivated`), jamais `*Created/*Updated/*Saved`.
- Consommateur d'`IntegrationEvent` **idempotent** : table `processed_events (consumer, event_id)` en contrainte d'unicité, insérée dans la même transaction que l'effet.
- Le `type` d'un `IntegrationEvent` est un contrat (stocké dans l'outbox, clé de routage) : il ne se renomme pas.

Tableau des événements et de leurs subscribers : `docs/events.md`.

### I.4. Couche HTTP

- Préfixe global `/api`, versionnement URI (`/api/v1`) quand l'API a des clients externes. OpenAPI : `@nestjs/swagger` (plugin CLI), servi sur `/api/docs` **hors prod**.
- Contrôleur mince : extrait les entrées validées et l'acteur, construit la commande/query, appelle `TransactionalCommandBus` / `QueryBus`. Aucune logique métier.
- **Validation** : schémas Zod de `packages/contracts` passés aux décorateurs (`@Body({ schema: CreateXSchema })`, `@Query({ schema })`), mode strict (clé inconnue = refus). Les ids de route passent par `ParseUUIDPipe`.
- **Réponse standard** : `ApiResponse<T>` (`shared/http`) — `{ status: 'OK', data }` ou `{ status: 'ERROR', message, code, errors? }`, posé par un intercepteur global.

**Convention d'erreur** (filtre global `DomainExceptionFilter`) :

| Cas | Levée par | HTTP |
|---|---|---|
| Entrée invalide | validation Standard Schema | 400 + `errors` par champ |
| Non authentifié / session expirée | `AuthGuard` | 401 |
| Droit insuffisant | `PermissionsGuard` | 403 |
| Ressource absente **ou d'un autre tenant** | `NotFoundError` / `ScopeViolationError` | 404 (ne révèle pas l'existence) |
| Conflit (unicité, verrou optimiste) | `ConflictError` | 409 |
| Règle métier refusée | `BusinessRuleViolation` (et sous-classes nommées) | 422 + `code` stable + `message` lisible |
| Inattendu | tout le reste | 500, seul cas loggé en `error`, aucun détail technique au client |

Les erreurs métier vivent dans `domain/errors` et n'héritent **jamais** de `HttpException` : le mapping HTTP est l'affaire du filtre.

### I.5. Socle partagé (`apps/api/src/shared/`)

| Dossier | Contenu |
|---|---|
| `domain/` | `AggregateRoot` (`record`, `pullEvents`), `DomainEvent`, `IntegrationEvent`, erreurs de base, VO transverses (`Id`, `Money`, `Period`) — uniquement s'ils servent ≥ 3 modules |
| `application/` | `TransactionalCommandBus`, `DomainEventSubscriber`, `Clock` (port), `IdGenerator` (port) |
| `infrastructure/database/` | `DrizzleModule`, tokens `WRITE_DB` / `READ_DB` (réplica possible), `TransactionHost` |
| `infrastructure/events/` | `DomainEventDispatcher`, `OutboxRepository`, `OutboxRelay`, `ProcessedEvents` |
| `infrastructure/security/` | `AuthGuard` (deny-by-default), `@Public()`, `PermissionsGuard`, `@RequiresPermission()`, `@CurrentActor()`, contexte CLS (tenant, user, requestId) |
| `infrastructure/http/` | `ApiResponse<T>`, intercepteur de réponse, `DomainExceptionFilter` |
| `infrastructure/config/` | `ConfigModule` validé par schéma Zod au démarrage (fail-fast) |
| `infrastructure/realtime/` | `UserRealtimePublisher` (port) + adapter WebSocket |

Création pas à pas du socle : `docs/checklists.md` § Socle.

**Suppression logique** (si le projet en fait) : colonne `deleted_at`, filtre `deleted_at IS NULL` **explicite** dans chaque requête et index partiel `WHERE deleted_at IS NULL`. Un contrôle « identifiant déjà utilisé » inclut les lignes supprimées.

**Verrou optimiste** : colonne `version` sur chaque racine d'agrégat ; `UPDATE … WHERE id = $1 AND version = $2`, 0 ligne → `ConcurrencyConflictError` (409).

**Horloge et identifiants** : jamais `new Date()` ni `randomUUID()` dans le domaine ou un handler — ports `Clock` et `IdGenerator` (UUID v7, triables) injectés.

### I.6. Messagerie et tâches

- Publication post-commit **uniquement via l'outbox** (garantie at-least-once). Transport : `<RabbitMQ | Kafka | NATS | bus local>` selon le profil ; en test, bus en mémoire qui enregistre les événements.
- Tâches différées/planifiées : `<BullMQ (Redis) | @nestjs/schedule>`. Une tâche est idempotente et rejouable.
- Routing keys : `<contexte>.<fait>` (ex. `billing.invoice_issued`), listées dans `docs/events.md`.

### I.7. Tests backend

| Niveau | Dossier / suffixe | Dépendances | Ce qu'il prouve |
|---|---|---|---|
| Unit | `tests/unit/*.test.ts` | aucune I/O, repositories in-memory (`tests/fakes/`) | les règles métier du cas d'usage |
| Intégration | `tests/integration/*.int.test.ts` | **Testcontainers** (PostgreSQL, broker…) | le branchement d'un adapter réel |
| E2E | `tests/e2e/*.e2e.test.ts` | app Nest complète + Testcontainers + `supertest` | un parcours métier HTTP de bout en bout |

- Vitest avec des **projects** (`unit`, `integration`, `e2e`) dans un seul `vitest.config.ts` ; transformation des décorateurs par le pipeline Vitest du projet (OXC ou SWC, metadata activée).
- Unit : `new Handler(new InMemoryXRepository(...), fixedClock)` — pas de `Test.createTestingModule`, pas de mock framework.
- Intégration/E2E : une base par worker Vitest (template database PostgreSQL clonée), schéma posé par les **vraies migrations**. Isolation par base ou par transaction annulée, jamais par ordre d'exécution.
- **Un test = une règle métier** (skill `tdd`), nommé en langage métier, jamais `XxxHandler.test.ts`.

### I.8. Base de données (migrations)

- Schéma Drizzle dans `infrastructure/persistence/*.table.ts` de chaque module ; `drizzle-kit generate` produit une migration SQL **relue** dans `apps/api/drizzle/`.
- **Règle absolue** : tout changement de table/colonne/index/contrainte passe par une migration versionnée et commitée. **Une migration commitée ne se modifie jamais** (hook de garde) : on en ajoute une nouvelle. `drizzle-kit push` est interdit hors bac à sable jetable.
- Au démarrage hors local, l'app vérifie que toutes les migrations sont appliquées et refuse de démarrer sinon.
- Migration destructive (drop, rename, `NOT NULL` sur table remplie) : en deux temps (expand → migrate → contract), jamais dans la même release que le code qui en dépend.
- Historique : `docs/migrations-history.md`.

### I.9. Temps réel (WebSocket)

Canal standard pour prévenir un utilisateur d'un fait qu'il attend (fin de traitement, notification). Pas de polling ; une relecture de secours espacée (20-30 s, bornée) si la socket peut tomber. Ce qui doit être garanti passe par l'outbox, pas par ce canal.

- **Back** : port `UserRealtimePublisher.publish(userId, { type, payload })` appelé depuis un handler ; l'envoi part **après le commit** ; panne du transport loggée, jamais propagée. Charge minimale : identifiants et statut, aucune donnée personnelle.
- **Front** : un seul abonnement ouvert à la connexion ; routage par `type` (`onRealtimeEvent(type, handler)`), charge validée par schéma ; un événement peut devancer la réponse HTTP.
- **Sécurité** : destinataire choisi par le serveur ; room privée `user:<id>` rejointe côté serveur après authentification de la poignée de main (session + origine) ; deny-by-default sur toute autre room.

---

## II. ARCHITECTURE FRONTEND (`apps/web`)

SPA Vite (pas de SSR). Détail et idiomes : skill `front-stack`.

```
apps/web/src/
  app/                 # router, providers, layout racine
  lib/store/           # store, reducer, dependencies (DI des gateways), api (RTK Query)
  lib/http/            # HttpClient (credentials, CSRF, 401)
  lib/i18n/  lib/rbac/  lib/realtime/
  components/ui/       # shadcn/ui
  components/          # composants transverses
  modules/<module>/
    models/            # entités + gateway/<Module>Gateway.ts (port)
    usecases/<cas>/    # thunk de commande + Command + Response
    slice/  listeners/
    infra/             # repo/<Module>HttpGateway.ts, api/<module>Api.ts (RTK Query), ui/, validators/
```

- Lectures : **RTK Query** (`injectEndpoints` par module, `queryFn` via le gateway injecté). Écritures : thunks `createAppAsyncThunk` qui invalident les tags concernés.
- **Jamais** d'import d'un `*HttpGateway` hors de `lib/store/dependencies/`.
- Routes paresseuses (`lazy`) par module, préchargement au survol des liens principaux.
- Schémas de formulaire repris de `packages/contracts` : le front et l'API valident la même chose.

---

## III. ENVIRONNEMENT

- **API** : `@nestjs/config` + schéma Zod de toutes les variables, validé au démarrage (fail-fast). `apps/api/.env.example` liste chaque variable avec un placeholder ; `.env` jamais commité.
- **Web** : `VITE_API_BASE_URL` (défaut `http://localhost:<port API>`), `VITE_APP_NAME`. Toute variable `VITE_*` est **publique** (figée dans le bundle) : jamais de secret.
- Profils : `local`, `test`, `preprod`, `prod` (`NODE_ENV` + `APP_ENV`).

---

## IV. NOUVEAU MODULE

Checklists complètes (backend, frontend, socle) : `docs/checklists.md`.

---

## V. POINTS DE VIGILANCE

- **Tests obligatoires après tout changement** : après toute création ou modification d'un handler, d'une query ou d'un cas d'usage, lancer les tests du module avant de valider. Lire le **nombre** de tests exécutés : « 0 test » est un faux vert.
- **Seed obligatoire** : tout nouveau module ou nouvelle donnée affichée livre ses données de démo (`apps/api/src/seed/`), droits des rôles compris. Un écran vide au démarrage faute de seed n'est pas terminé.
- **Migrations** : jamais modifier une migration commitée, jamais `db push`, toujours relire le SQL généré.
- **`TransactionalCommandBus`** : seule porte d'entrée des écritures depuis HTTP, un consumer ou une tâche.
- **Domaine pur** : aucun import `@nestjs/*` / `drizzle-orm` dans `domain/` (`pnpm arch` le vérifie).
- **Identité et tenant** lus dans le contexte de session côté serveur, jamais dans le body, la query ou un en-tête client.
- **Gateways injectés** côté front : jamais importés dans un thunk, un slice ou un composant.
- **Redux Persist** : seuls les slices explicitement listés en `whitelist` sont persistés ; le cache RTK Query ne l'est jamais.
- **Contrats partagés** : un changement de schéma dans `packages/contracts` se répercute sur l'API, le web et l'OpenAPI dans le même commit.
- **Doc d'API publique/mobile à jour** : toute route consommée par un client externe met à jour son OpenAPI (`summary`, `description`, exemples) dans le même commit ; un test de garde vérifie qu'aucune route n'est sans description.
- **ESM** : imports relatifs avec extension `.js` côté API, `import.meta.dirname` au lieu de `__dirname`.

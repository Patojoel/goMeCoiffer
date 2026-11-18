# CLAUDE.md

Référence technique de GoMeCoiffer pour Claude Code : architecture, patterns, conventions et orchestration des agents.

**Projet** : GoMeCoiffer — SaaS multi-salons et marketplace de réservation de prestations de coiffure, barbering, esthétique et soins (marché initial : Cameroun). Cycle cible du MVP : *Disponibilité → Réservation → Paiement → Prestation terminée*.

**Documentation** (chargée à la demande selon la tâche) :
- `docs/cahier-des-charges/prd.md` — PRD du MVP, **source fonctionnelle de vérité** (entrée de `use-case-writer`)
- `docs/BACKLOG.md` — travaux décidés, en attente, à reprendre ; section **URGENT** lue à chaque reprise
- `docs/EVOLUTIONS.md` — journal des évolutions livrées (une entrée par évolution, la plus récente en haut)
- `docs/DECISIONS.md` — décisions d'architecture et décisions métier tranchées par le user (date + raison)
- `docs/domains.md` — modules backend, commandes et queries existantes
- `docs/events.md` — événements de domaine/intégration et leurs subscribers
- `docs/migrations-history.md` — historique des migrations TypeORM
- `docs/checklists.md` — checklists : nouveau module backend/frontend, socle `shared/`
- `docs/use-cases/` — use cases BDD (`UC-xxx`), inventaire des exigences, index
- `docs/frontend.md` — structure du frontend (à rédiger quand le front existe)

**Maquettes** : aucune pour l'instant. Dès qu'une maquette (Figma ou autre) est fournie, son lien s'ajoute ici et elle devient un **contrat** : pour chaque module touché, vérifier que les écrans, formulaires, libellés et parcours lui correspondent, corriger les écarts (`front-ui`) ou les soumettre au user. Lecture Figma : skill `figma:figma-design-to-code` avant `get_design_context`.

**Config Claude Code** (`.claude/`) :
- Skills (règles à charger avant d'écrire du code) : `ddd`, `hexagonal`, `nest-stack`, `tdd`, `sql-query`, `security`, `clean-code`, `refactoring`, `front-stack`.
- Agents :

  | Agent | Rôle | Modèle |
  |---|---|---|
  | `backend-builder` | Implémente un cas d'usage back (commande, agrégat, endpoint, migration) | sonnet |
  | `query-perf` | Écrit ou optimise les QueryHandlers (SQL pur), produit le rapport d'index | sonnet |
  | `front-builder` | Logique front : thunk, slice, RTK Query, gateway, DI | sonnet |
  | `front-ui` | Présentation, composants, écrans, maquettes | sonnet |
  | `use-case-writer` | Transforme le PRD en use cases BDD | opus |

- Relecteurs (lecture seule) : `archi-reviewer` (opus), `security-reviewer` (opus), `front-reviewer` (sonnet).
- Hooks (`.claude/settings.json`, scripts dans `.claude/hooks/`) : garde-fous fichiers (`.env`, migrations déjà commitées), garde-fous shell (push forcé, `--no-verify`, `schema:sync`/`schema:drop`), formatage Prettier du fichier écrit, contexte de session (mode, URGENT du backlog), worktrees dans `.worktrees/`.

---

## Orchestration — qui fait quoi

```
PRD ──► use-case-writer ──► docs/use-cases/UC-xxx + features/*.feature
                                   │
          ┌────────────────────────┼─────────────────────────┐
          ▼                        ▼                         ▼
  backend-builder (écriture)  query-perf (lecture)   front-builder ──► front-ui
          │                        │                         │
          └────► archi-reviewer ◄──┘                  front-reviewer
                        │                                    │
                        └────────► security-reviewer ◄───────┘
                              (si périmètre critique touché)
```

- La session principale découpe, délègue, intègre et lance la suite complète. Elle ne délègue pas ce qui tient en quelques appels d'outils.
- Back et front d'une même fonctionnalité partent **en parallèle** dès que le contrat d'API est figé dans `packages/contracts` (schémas Zod partagés). Le contrat d'abord, puis les deux côtés.
- Agents parallèles → worktrees isolés (`isolation: "worktree"`, créés dans `.worktrees/` par le hook). Chaque agent ne lance que les tests des modules qu'il a touchés ; la session principale fusionne et lance la suite complète une seule fois.
- Chaque consigne donnée à un agent rappelle : le mode de la session, le périmètre exact (fichiers/modules), les règles « tous modes » ci-dessous, et ce que le rapport doit contenir.
- Un rapport d'agent n'est pas une preuve : la session principale relit le diff et relance les tests avant d'annoncer un résultat.
- **Fin d'une évolution** : la session principale ajoute l'entrée de `docs/EVOLUTIONS.md`, met à jour `docs/BACKLOG.md` (sortie de ce qui est fait, ajout de ce qui est relevé et non traité) et les docs de référence touchées (`domains.md`, `events.md`, `migrations-history.md`).

---

## Mode de travail — à demander au user en début de session

**Avant toute tâche de code, la session principale demande au user le mode de la session.** Le mode choisi vaut pour toute la session et est rappelé dans chaque consigne donnée à un agent.

| Mode | Revues | Tests | Code |
|---|---|---|---|
| **full** (strict) | Porte de revue complète. `archi-reviewer` systématique sur le back, `front-reviewer` systématique sur le front. `security-reviewer` dès que le périmètre critique est touché. | Tests des modules touchés pendant le travail, puis suite complète (`pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm arch`) avant le commit final. | Standard |
| **light** | **Sécurité seulement**, et uniquement sur le périmètre critique. Pas de `archi-reviewer`, pas de `front-reviewer`. | On teste **le code écrit** : `pnpm --filter api test <chemin du module>` (idem `web`). Le rapport n'est rendu que tout vert. **La suite complète ne tourne qu'une fois, avant le commit final.** | Concis, priorité à l'avancement |

Intention du mode light : pas de revue inutile, revue seulement sur ce qui est critique pour la sécurité, priorité à la rapidité et à un code concis ; pas de tâches rallongées par des revues ou des suites globales relancées.

**Périmètre critique** : `security-reviewer` est obligatoire dans les 2 modes sur ce qui touche :
- authentification, session, CSRF, cookies, OTP et liens sécurisés de réservation ;
- mot de passe, invitation de collaborateur, activation de compte, réinitialisation ;
- autorisation : guards, `@RequiresPermission`, `@RequiresSystemRole`, rôles salon et rôles système, droits protégés du propriétaire ;
- isolation entre salons (`salonId`, `organizationId` et tout id de périmètre) ;
- routes publiques (`@Public()`) : marketplace, page de réservation, page d'acceptation de reprogrammation ;
- **paiements** : initiation, webhooks de l'agrégateur, réconciliation, déclaration d'encaissement au salon, remboursements ;
- abonnements SaaS, suspension/rétablissement d'un salon ;
- secrets et configuration de prod/preprod ;
- SQL sur les comptes, les appartenances et les droits ;
- données personnelles des clients (téléphone, nom) et des collaborateurs ;
- canal temps réel (SSE), upload de fichiers (photo du salon).

**Inchangé dans tous les modes** :
- TDD, avec le test rouge d'abord (skill `tdd`) ;
- les règles non négociables de ce fichier (migrations, QueryHandlers en SQL pur, `TransactionalCommandBus`, domaine pur, contrainte de non-chevauchement…) ;
- les tests des modules touchés verts avant commit ;
- la conformité à la maquette des modules touchés, quand une maquette existe ;
- le guidage de l'utilisateur sur les écrans touchés (ci-dessous) ;
- le seed de démo des données affichées ;
- la mise à jour de `docs/EVOLUTIONS.md` et `docs/BACKLOG.md` en fin d'évolution ;
- ne jamais annoncer un vert non obtenu.

**Guidage de l'utilisateur (obligatoire, tous modes)** — le PRD vise des propriétaires de salon non techniques. Sur chaque écran créé ou modifié :
- chaque choix métier dont l'effet n'est pas évident (mode de paiement, rôle, permission, statut, « Peu importe ») porte une aide courte sous le champ (`hint`, reliée par `aria-describedby`) qui dit ce que le choix implique et suit la valeur choisie ;
- les états vides, les refus et les blocages disent **pourquoi et quoi faire ensuite** (« Ajoutez au moins une prestation et des horaires pour publier votre salon »), jamais un simple « Non disponible » ;
- textes courts, en langage de salon, dans toutes les langues du projet.
Le rapport de l'agent front dit quelles aides ont été ajoutées.

---

## Refonte UI/UX : modèle et skills

Quand le travail est une **refonte UI/UX** (nouveau design, écrans jugés trop simples, maquettes, pages marketplace) :
- **le modèle standard de la session suffit.** Le modèle le plus performant (paramètre `model` de l'outil Agent) n'est utilisé pour le front **que si le user le demande explicitement** ;
- l'agent charge les skills UI/UX avant d'écrire : `frontend-design:frontend-design` d'abord, puis selon le cas les skills Figma et `front-stack` ;
- il vérifie par captures ordinateur et **mobile (390 px) en priorité** (produit mobile-first), qu'il regarde et fait évoluer jusqu'à un rendu soigné, sans débordement horizontal.
Le contenu et le parcours validés ne changent pas sans accord : une refonte touche la présentation.

---

## Stack

| Couche | Choix | Notes |
|---|---|---|
| Runtime | **Node.js 24 LTS**, **pnpm 11** | `.nvmrc` / `engines` ; pnpm 11 applique une politique d'âge des versions (`minimumReleaseAgeExclude`) et n'exécute que les scripts d'install listés dans `allowBuilds` (`pnpm-workspace.yaml`) |
| Langage | **TypeScript 6.0** (pas 7 : `@nestjs/swagger` 12 ne l'accepte pas), ESM partout | côté API, build et tests par **SWC** (décorateurs + metadata) |
| Monorepo | **pnpm workspaces** | `backend/` (paquet `api`), `frontend/` (paquet `web`), `packages/contracts` (`@gomecoiffer/contracts`) |
| Backend | **NestJS 12**, `@nestjs/cqrs`, `nestjs-cls` + `@nestjs-cls/transactional` + `@nestjs-cls/transactional-adapter-typeorm` | validation **Standard Schema** native (`@Body({ schema })`) |
| Persistance | **PostgreSQL 17** + **TypeORM** (migrations TypeORM) | écriture : entités et repositories TypeORM ; **lecture : SQL pur écrit dans `application/`**, exécuté par le port `SqlReader` (paramètres liés) |
| Contrats | `packages/contracts` : schémas **Zod 4** + types inférés | partagés API ↔ web, une seule source de vérité |
| Temps réel | **SSE** (`@Sse()`) + relecture complète à la reconnexion | exigence PRD §12 ; aucun broker pour le MVP |
| Tâches | `@nestjs/schedule` | expiration des réservations en attente de paiement, relais d'outbox, réconciliation des paiements |
| Paiement | adaptateur isolé vers l'agrégateur Mobile Money (Orange Money, MTN MoMo) | agrégateur à choisir (PRD §16) ; adaptateur `fake` en local et en test |
| Frontend | **React 19.2** + **Vite 8** + TypeScript strict | React Compiler activé, mobile-first |
| État front | **Redux Toolkit 2** (commandes) + **RTK Query** (lectures) | gateways injectés via `extraArgument` |
| UI | Tailwind CSS v4 + shadcn/ui (Radix) + lucide-react | formulaires `react-hook-form` + `zod` |
| Tests | **Vitest** partout (projets unit / integration / e2e), Testing Library, MSW, **Testcontainers**, Stryker (mutation) | pas de Jest, pas de `vi.mock` de module |
| Qualité | oxlint + ESLint, Prettier, **dependency-cruiser** (`pnpm arch`) | les règles d'architecture sont vérifiées par outil |
| Observabilité | `nestjs-pino` (JSON, redaction PII), `GET /api/public/health` (ping de la base) | |

> Versions vérifiées au socle (17/11/2026) : NestJS 12.5, TypeORM 1.1, nestjs-cls 7 / transactional 4, Zod 4.6, Vite 8.3, React 19.3, Vitest 5.1. `@Body({ schema })` + `StandardSchemaValidationPipe` confirmés dans `@nestjs/common` 12. Toute brique remplacée met à jour cette table **et** les skills concernés dans le même commit, avec une ligne dans `docs/DECISIONS.md`.

---

## Commandes

```bash
# Infrastructure locale (en premier) : PostgreSQL + Mailpit
docker compose -f infra/compose.yml up -d

pnpm install
pnpm dev                                    # api + web en parallèle
pnpm --filter api dev                       # nest start --watch
pnpm --filter web dev                       # vite

# Tests
pnpm --filter api test <chemin|motif>       # unit d'un module (rapide, sans Docker)
pnpm --filter api test:int <chemin>         # intégration (Testcontainers, Docker requis)
pnpm --filter api test:e2e <chemin>         # E2E HTTP (Testcontainers)
pnpm --filter web test <chemin>
pnpm test                                   # suite complète (une fois, avant le commit final)
pnpm lint && pnpm typecheck && pnpm arch    # qualité + règles d'architecture
pnpm mutation --filter <app>                # Stryker, sur les règles sensibles

# Base de données (TypeORM) — les scripts compilent d'abord (nest build) puis lisent backend/.env
pnpm --filter api migration:create <NomEnPascalCase>   # migration écrite à la main, ajoutée au registre automatiquement
pnpm --filter api migration:generate src/database/migrations/<NomEnPascalCase>   # diff des entités : RELIRE, puis l'ajouter à src/database/migrations.ts
pnpm --filter api migration:run
pnpm --filter api migration:show            # migrations en attente
pnpm --filter api migration:revert
pnpm --filter api db:seed                   # données de démo
```

Ports locaux (bloc **10400-10409**, publiés sur `127.0.0.1`, surchargeables dans `infra/.env`) : API 10400, Vite 10401, PostgreSQL 10402, Mailpit UI 10403, Mailpit SMTP 10404.

---

## I. ARCHITECTURE BACKEND (`backend/`)

### I.1. Découpage hexagonal par module

```
backend/src/
  main.ts                      # bootstrap : pino, helmet, CORS allowlist, session, CSRF, shutdown hooks, OpenAPI hors prod
  app.module.ts
  app.setup.ts                 # middlewares HTTP communs à main.ts et aux tests E2E
  database/
    data-source.ts  cli.ts     # DataSource de la CLI TypeORM (même config que l'app) ; run/revert/show
    entities.ts                # REGISTRE des entités TypeORM (aucun glob : ESM + tests)
    migrations.ts              # REGISTRE des migrations, dans l'ordre
    migrations/                # migrations TypeORM versionnées (<timestamp>-<Nom>.ts)
    seed/                      # données de démo (un seeder idempotent par module)
  test-support/                # Testcontainers (base modèle migrée, clone par fichier), startTestApp, Browser (session + CSRF), fakes
  shared/                      # socle transverse (voir I.5)
  modules/<module>/
    domain/                    # pur ; un fichier par concept, rangé par rôle (D-024)
      aggregates/              # racines d'agrégat (<x>.ts)
      value-objects/           # un VO par fichier
      enums/                   # <x>.enum.ts : objet `as const` + type du même nom
      exceptions/              # une erreur métier par fichier (<intention>.error.ts)
      events/                  # un événement par fichier (fait au passé)
      repositories/
        write/                 # <x>.repository.ts : port + token, charge et sauve un agrégat (impl. TypeORM)
        read/                  # <x>.read-repository.ts : port + token, lecture pour une commande (impl. SQL pur en application)
      ports/                   # <x>.port.ts : passerelles externes (SMS, paiement, hachage…) + token
      services/                # services de domaine sans état (règles sur plusieurs instances)
      messages/                # textes métier envoyés à l'utilisateur (SMS…)
    application/
      commands/<use-case>/     # <use-case>.command.ts + <use-case>.handler.ts + <use-case>.response.ts
      queries/<use-case>/      # <use-case>.query.ts + <use-case>.handler.ts (SQL pur) + <use-case>.read-model.ts
      read-repositories/       # sql-<x>.ts : implémente un port domain/repositories/read en SQL pur (SqlReader)
      subscribers/             # réactions aux événements, délèguent à un handler
    infrastructure/
      persistence/
        orm-entities/          # <x>.orm-entity.ts, une entité TypeORM par fichier
        typeorm-repositories/  # typeorm-<x>.repository.ts, implémente un port domain/repositories/write
        mappers/               # <x>.mapper.ts, seulement si la conversion ne tient pas dans restore()/snapshot()
      http/                    # <x>.controller.ts (+ schémas venant de packages/contracts)
      <adapter>/               # passerelles externes (paiement, SMS…) : couche de traduction
      <module>.module.ts       # câblage Nest : providers, tokens de ports
    tests/
      unit/  integration/  e2e/  builders/  fakes/   # fakes = repositories in-memory
```

Modules prévus (détail et état dans `docs/domains.md`) : `identity` (comptes, session, OTP), `organizations` (organisation, salons, appartenances, rôles et permissions salon), `catalog` (prestations), `staff` (intervenants, spécialités, prestations autorisées, horaires, indisponibilités), `booking` (réservations, reprogrammations), `payments` (paiements en ligne et au salon), `subscriptions` (abonnements SaaS), `platform` (administration GoMeCoiffer). Les disponibilités (F02) sont une **lecture** (`booking/application/queries`) recalculée depuis horaires, indisponibilités et réservations, et revalidée côté écriture à la confirmation.

Règles de dépendance (vérifiées par `pnpm arch`) :
- `domain/` n'importe **rien** d'autre que `shared/domain` : ni `@nestjs/*`, ni `typeorm`, ni `application/`, ni `infrastructure/`.
- `application/` importe `domain/`, `shared/domain`, `shared/application` et les décorateurs Nest de DI/CQRS (`@nestjs/common`, `@nestjs/cqrs`) ; **jamais `typeorm`**, HTTP ou SDK externe. Le SQL des queries y est écrit en texte pur et exécuté par le port `SqlReader`.
- `infrastructure/` importe tout le reste. Un module n'importe jamais l'`infrastructure/` d'un autre module.

Modèle à suivre pour un nouveau module : le premier module complet du projet, nommé dans `docs/domains.md` (skill `ddd`).

### I.2. CQRS

#### A. Commandes (écriture, TypeORM)

```ts
// application/commands/confirm-booking/confirm-booking.command.ts
export class ConfirmBooking extends Command<{ bookingId: string }> {
  constructor(
    readonly salonId: string,
    readonly actorId: string,
    readonly bookingId: string,
  ) { super(); }
}

// application/commands/confirm-booking/confirm-booking.handler.ts
@CommandHandler(ConfirmBooking)
export class ConfirmBookingHandler implements ICommandHandler<ConfirmBooking> {
  constructor(
    @Inject(BOOKING_REPOSITORY) private readonly bookings: BookingRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(cmd: ConfirmBooking) {
    const booking = await this.bookings.getOfSalon(cmd.salonId, cmd.bookingId);
    booking.confirm(cmd.actorId, this.clock.now());   // règle métier dans l'agrégat
    await this.bookings.save(booking);                // persiste (TypeORM) + dispatch des événements
    return { bookingId: booking.id };
  }
}
```

- `Command<TResult>` (`@nestjs/cqrs`) type le résultat : `commandBus.execute(cmd)` renvoie `Promise<TResult>`, sans cast.
- Le handler **orchestre** (charger, appeler l'agrégat ou un service de domaine, sauver). Aucune règle métier, aucune transaction ouverte à la main, aucun `try/catch` d'erreur système.
- Persistance : entité TypeORM (`*.orm-entity.ts`) **distincte** de l'agrégat, mapper aller-retour, repository `TypeOrm<X>Repository` qui implémente le port du domaine et passe par `TransactionHost<TransactionalAdapterTypeOrm>` (`this.txHost.tx.getRepository(XOrmEntity)`), jamais par un `EntityManager` global. Jamais d'entité TypeORM hors de `infrastructure/persistence/`.

#### B. Queries (lecture, SQL pur depuis `application/`)

```
application/queries/<use-case>/
  ├─ <use-case>.query.ts         # extends Query<ReadModel>
  ├─ <use-case>.handler.ts       # @QueryHandler, SQL pur exécuté par SqlReader (READ_DB)
  └─ <use-case>.read-model.ts    # types readonly (ou z.infer d'un schéma de packages/contracts)
```

```ts
@QueryHandler(ListSalonDayPlanning)
export class ListSalonDayPlanningHandler implements IQueryHandler<ListSalonDayPlanning> {
  constructor(@Inject(READ_DB) private readonly db: SqlReader) {}

  execute(q: ListSalonDayPlanning): Promise<readonly PlanningEntry[]> {
    return this.db.many<PlanningEntry>(sql`
      WITH day_bookings AS (
        SELECT b.id, b.staff_id, b.service_id, b.starts_at, b.ends_at, b.status
        FROM bookings b
        WHERE b.salon_id = ${q.salonId}
          AND b.starts_at >= ${q.dayStart} AND b.starts_at < ${q.dayEnd}
      )
      SELECT d.id, d.starts_at AS "startsAt", d.ends_at AS "endsAt", d.status,
             s.display_name AS "staffName", sv.name AS "serviceName"
      FROM day_bookings d
      JOIN staff_profiles s ON s.id = d.staff_id AND s.salon_id = ${q.salonId}
      JOIN salon_services sv ON sv.id = d.service_id
      ORDER BY d.starts_at`);
  }
}
```

##### Règles obligatoires des QueryHandlers

1. **SQL pur et optimisé, écrit dans le handler** — gabarit `sql\`…\`` de `shared/application/sql` : chaque `${valeur}` devient un paramètre lié `$n` (node-postgres), jamais du texte. Exécution par le port `SqlReader` (`many`, `one`, `maybeOne`) injecté par le token `READ_DB` ; son adaptateur TypeORM (`txHost.tx.query(text, values)` : dans une commande, la lecture passe par la transaction en cours) vit dans `shared/infrastructure/database/`. Jamais de concaténation, jamais `sql.unsafe()` avec une valeur venue de l'extérieur (identifiants dynamiques : liste blanche de constantes), jamais de QueryBuilder, de `find*` TypeORM, de repository d'agrégat ni d'entité TypeORM dans une lecture. Les **CTE sont filtrées dès l'entrée** (`salon_id`, id de périmètre) — aucun scan global filtré plus tard.
2. **Read models immuables** — `readonly` partout, objets simples, colonnes aliasées en camelCase dans le SQL (`AS "startsAt"`) ; jamais une entité TypeORM ni un agrégat en sortie.
3. **Tests E2E uniquement** — une query se teste par un test E2E HTTP (Testcontainers), écrit **avant** la requête. Pas d'unit ni d'intégration pour une query.
4. **Rapport d'analyse obligatoire** — après chaque création ou modification :
    - structure de la requête (CTE, JOIN, filtres) ;
    - problèmes de performance (scans globaux, N+1, agrégation en JS en O(n²), données en dur, incohérences projet) ;
    - **vérification réelle des index** (`pg_indexes` + `EXPLAIN (ANALYZE, BUFFERS)` sur la vraie base) : tableau colonne | index existant (oui/non) | recommandation ;
    - récapitulatif priorisé 🔴 Critique / 🟡 Important / 🟠 Mineur avec l'impact attendu.
   Présenté **même si les corrections sont déjà appliquées**. Jamais d'index « estimé ».

```ts
// ❌ interpolation brute
this.db.many(sql.unsafe(`SELECT … WHERE salon_id = '${salonId}'`));
// ❌ lecture par l'ORM
this.dataSource.getRepository(BookingOrmEntity).find({ where: { salonId } });

// ✅ paramètres liés
this.db.many(sql`SELECT … WHERE salon_id = ${salonId} AND id = ANY(${ids}::uuid[])`);

// ❌ CTE non filtrée
WITH totals AS (SELECT staff_id, count(*) FROM bookings GROUP BY staff_id) …
// ✅ CTE filtrée à l'entrée
WITH totals AS (SELECT staff_id, count(*) FROM bookings WHERE salon_id = ${salonId} GROUP BY staff_id) …
```

#### C. `TransactionalCommandBus` — la seule porte d'entrée des écritures

Enveloppe toute commande dans **une transaction + dispatch des événements**.

```ts
@Controller('bookings')
export class BookingsController {
  constructor(private readonly commands: TransactionalCommandBus) {}

  @Post(':id/confirmation')
  @RequiresPermission('bookings:manage')
  confirm(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: Actor) {
    return this.commands.execute(new ConfirmBooking(actor.activeSalonId, actor.userId, id));
  }
}
```

**Cycle de vie :**
1. `TransactionalCommandBus.execute` ouvre la transaction (`TransactionHost.withTransaction`, propagée par AsyncLocalStorage via `nestjs-cls`, adaptateur TypeORM).
2. Le handler s'exécute ; l'agrégat **enregistre** ses événements (`this.record(...)`).
3. `repository.save()` persiste puis remet les événements au `DomainEventDispatcher` :
   - `DomainEvent` → subscribers synchrones, **dans la transaction** (un échec annule tout) ;
   - `IntegrationEvent` → ligne dans la table `outbox`, **dans la transaction**.
4. **Commit**, puis `afterCommit` : le bus réveille l'`OutboxRelay` (publication immédiate sur le bus local) et vide la file temps réel de la requête.
5. Le relais traite l'outbox ; un poller espacé (`@nestjs/schedule`) rattrape ce qui a échoué.

Interdits : un contrôleur qui injecte `CommandBus` brut ou un handler ; `dataSource.transaction()` / `queryRunner.startTransaction()` ouvert dans un handler ou un repository ; un événement publié par le handler à la place de l'agrégat.

### I.3. Événements de domaine et d'intégration

```
DomainEvent (interface, shared/domain)       — synchrone, même transaction
  └─ IntegrationEvent (marqueur + `type`)    — post-commit via outbox, livré au moins une fois
```

```ts
// application/subscribers/when-booking-payment-confirmed.ts
@Injectable()
export class WhenBookingPaymentConfirmed implements DomainEventSubscriber<OnlinePaymentConfirmed> {
  readonly subscribesTo = OnlinePaymentConfirmed;
  constructor(private readonly confirmBooking: ConfirmPaidBookingHandler) {}
  handle(e: OnlinePaymentConfirmed) {
    return this.confirmBooking.execute(new ConfirmPaidBooking(e.salonId, e.bookingId, e.paymentId));
  }
}
```

- Un subscriber vit dans `application/subscribers/`, reçoit le **handler cible injecté** et lui délègue, sans logique métier. Il est découvert au démarrage (`DiscoveryService`) : pas d'enregistrement manuel.
- Événement = **fait métier au passé** (`BookingConfirmed`, `ClientMarkedAbsent`, `RescheduleProposed`), jamais `*Created/*Updated/*Saved`.
- Consommateur d'`IntegrationEvent` **idempotent** : table `processed_events (consumer, event_id)` en contrainte d'unicité, insérée dans la même transaction que l'effet.
- Le `type` d'un `IntegrationEvent` est un contrat (stocké dans l'outbox, clé de routage `<contexte>.<fait>`, ex. `booking.booking_confirmed`) : il ne se renomme pas.

Tableau des événements et de leurs subscribers : `docs/events.md`.

### I.4. Couche HTTP

- Préfixe global `/api`. OpenAPI : `@nestjs/swagger` (plugin CLI), servi sur `/api/docs` **hors prod**.
- Espaces de routes : `/api/public/*` (marketplace, réservation client, liens de reprogrammation — `@Public()`), `/api/salon/*` (back-office, salon actif de la session, `@RequiresPermission` ou `@AuthenticatedOnly()`), `/api/admin/*` (administration GoMeCoiffer, `@RequiresSystemRole`), `/api/webhooks/*` (agrégateur de paiement, `@Public()` + `@SkipCsrf()` + signature). **`RouteProtectionCheck` refuse de démarrer l'API** si une route sort de ces espaces ou oublie la protection de son espace.
- Session : expiration glissante (`SESSION_TTL_HOURS`) **et** durée absolue depuis la connexion (`SESSION_MAX_AGE_HOURS`, `session.authenticatedAt`) ; l'appartenance au salon actif est relue à chaque requête (`ActorRights.resolve` → `isMember`), un salon quitté est oublié. Un flux SSE se referme au bout de 30 min.
- Logs : sérialiseur `safeError` (jamais requête SQL, paramètres ni `detail` PostgreSQL) ; journalisation SQL de TypeORM seulement avec `DB_LOGGING=true`, interdit hors local.
- Contrôleur mince : extrait les entrées validées et l'acteur, construit la commande/query, appelle `TransactionalCommandBus` / `QueryBus`. Aucune logique métier.
- **Validation** : schémas Zod de `packages/contracts` passés aux décorateurs (`@Body({ schema: CreateBookingSchema })`, `@Query({ schema })`), mode strict (clé inconnue = refus). Les ids de route passent par `ParseUUIDPipe`.
- **Réponse standard** : `ApiResponse<T>` (`shared/infrastructure/http`) — `{ status: 'OK', data }` ou `{ status: 'ERROR', message, code, errors? }`, posé par un intercepteur global.

**Convention d'erreur** (filtre global `DomainExceptionFilter`) :

| Cas | Levée par | HTTP |
|---|---|---|
| Entrée invalide | validation Standard Schema | 400 + `errors` par champ |
| Non authentifié / session expirée | `AuthGuard` | 401 |
| Droit insuffisant | `PermissionsGuard` | 403 |
| Ressource absente **ou d'un autre salon** | `NotFoundError` / `ScopeViolationError` | 404 (ne révèle pas l'existence) |
| Conflit (unicité, verrou optimiste, **créneau pris** — violation de la contrainte d'exclusion `23P01`) | `ConflictError`, `SlotNoLongerAvailableError` | 409 |
| Règle métier refusée | `BusinessRuleViolation` (et sous-classes nommées) | 422 + `code` stable + `message` lisible |
| Inattendu | tout le reste | 500, seul cas loggé en `error`, aucun détail technique au client |

Les erreurs métier vivent dans `domain/exceptions/` (une erreur par fichier) et n'héritent **jamais** de `HttpException` : le mapping HTTP est l'affaire du filtre.

### I.5. Socle partagé (`backend/src/shared/`)

| Dossier | Contenu |
|---|---|
| `domain/` | `AggregateRoot` (`record`, `pullEvents`), `DomainEvent`, `IntegrationEvent`, erreurs de base, VO transverses (`Id`, `Money` en XAF entiers, `TimeRange`, `PhoneNumber`) — uniquement s'ils servent ≥ 3 modules |
| `application/` | `TransactionalCommandBus`, `DomainEventSubscriber`, `Clock` (port), `IdGenerator` (port), `SqlReader` (port) + gabarit `sql`, `RealtimePublisher` (port) |
| `infrastructure/database/` | `TypeOrmModule` (config), `TransactionHost` (adaptateur TypeORM), `TypeOrmSqlReader` (token `READ_DB`, lit dans la transaction en cours s'il y en a une), vérification des migrations au démarrage |
| `infrastructure/events/` | `DomainEventDispatcher`, `OutboxRepository`, `OutboxRelay`, `ProcessedEvents` |
| `infrastructure/security/` | `AuthGuard` (deny-by-default), `@Public()`, `PermissionsGuard`, `@RequiresPermission()`, `@RequiresSystemRole()`, `@CurrentActor()`, session (PostgreSQL), CSRF, contexte CLS (user, salon actif, requestId) |
| `infrastructure/http/` | `ApiResponse<T>`, intercepteur de réponse, `DomainExceptionFilter` |
| `infrastructure/config/` | `ConfigModule` validé par schéma Zod au démarrage (fail-fast) |
| `infrastructure/realtime/` | adaptateur SSE du port `RealtimePublisher` |

Création pas à pas du socle : `docs/checklists.md` § Socle.

**Configuration TypeORM non négociable** : `synchronize: false` et `dropSchema: false` dans **tous** les profils (tests compris : le schéma vient des vraies migrations), `migrationsRun: false`, `namingStrategy` snake_case, colonnes `timestamptz`. Au démarrage hors local, l'app vérifie qu'aucune migration n'est en attente (`dataSource.showMigrations()`) et refuse de démarrer sinon.

**Non-chevauchement des réservations (BR-02)** : garanti **en base** par une contrainte d'exclusion PostgreSQL (`btree_gist`) sur `(staff_id, tstzrange(starts_at, ends_at))` limitée aux statuts bloquants (`PENDING_PAYMENT` non expiré, `CONFIRMED`, `IN_PROGRESS`) et aux blocages temporaires, en plus de la revalidation applicative. La violation `23P01` est traduite en `SlotNoLongerAvailableError` par le repository. Un contrôle applicatif seul n'est jamais suffisant.

**Suppression logique** (si un module en fait) : colonne `deleted_at`, filtre `deleted_at IS NULL` **explicite** dans chaque requête et index partiel `WHERE deleted_at IS NULL`. Un contrôle « identifiant déjà utilisé » inclut les lignes supprimées. Les réservations, paiements et décisions de permission ne se suppriment jamais : ils changent de statut (trace d'audit, PRD §11).

**Verrou optimiste** : colonne `version` sur chaque racine d'agrégat ; le repository écrit `UPDATE … SET …, version = version + 1 WHERE id = $1 AND version = $2` (QueryBuilder `update()`), 0 ligne → `ConcurrencyConflictError` (409). Ne pas compter sur `@VersionColumn` seul : `save()` ne vérifie pas la version lue.

**Horloge, identifiants, fuseaux, argent** : jamais `new Date()` ni `randomUUID()` dans le domaine ou un handler — ports `Clock` et `IdGenerator` (UUID v7) injectés. Instants stockés en UTC (`timestamptz`) ; chaque salon porte son fuseau IANA (`Africa/Douala` par défaut) et les créneaux se calculent dans ce fuseau. Montants en **FCFA (XAF) entiers**, jamais de flottant.

**Audit** : les modifications de permissions, de réservations (qui a initié une reprogrammation, BR-09) et de paiements écrivent une trace (`audit_log` ou historique dédié) dans la même transaction.

### I.6. Événements post-commit et tâches

- Publication post-commit **uniquement via l'outbox** (garantie at-least-once). Transport MVP : **bus local en processus** (le PRD exclut tout broker) ; en test, bus en mémoire qui enregistre les événements. Passer à un broker plus tard ne change que l'adaptateur du relais.
- Tâches planifiées : `@nestjs/schedule`. Une tâche est idempotente et rejouable : expiration des `PENDING_PAYMENT` (10 min, BR-04), expiration des propositions de reprogrammation, réconciliation des paiements non confirmés (BR-05/06), période de grâce des abonnements expirés (F08), relais d'outbox.
- Une tâche passe elle aussi par le `TransactionalCommandBus`.

### I.7. Tests backend

| Niveau | Dossier / suffixe | Dépendances | Ce qu'il prouve |
|---|---|---|---|
| Unit | `tests/unit/*.test.ts` | aucune I/O, repositories in-memory (`tests/fakes/`) | les règles métier du cas d'usage |
| Intégration | `tests/integration/*.int.test.ts` | **Testcontainers** (PostgreSQL 17) | le branchement d'un adapter réel (repository TypeORM, contrainte d'exclusion, adaptateur de paiement contre un faux serveur) |
| E2E | `tests/e2e/*.e2e.test.ts` | app Nest complète + Testcontainers + `supertest` | un parcours métier HTTP de bout en bout |

- Vitest avec des **projects** (`unit`, `integration`, `e2e`) dans un seul `vitest.config.ts` ; décorateurs et `emitDecoratorMetadata` transformés par SWC (`unplugin-swc`), indispensable à TypeORM et à la DI Nest.
- Unit : `new Handler(new InMemoryXRepository(...), fixedClock)` — pas de `Test.createTestingModule`, pas de mock framework.
- Intégration/E2E : une base par worker Vitest (template database PostgreSQL clonée), schéma posé par les **vraies migrations TypeORM** (`migrationsRun` explicite dans le setup, jamais `synchronize`). Isolation par base ou par transaction annulée, jamais par ordre d'exécution.
- **Un test = une règle métier** (skill `tdd`), nommé en langage métier, jamais `XxxHandler.test.ts`.

### I.8. Base de données (migrations TypeORM)

- Entités TypeORM dans `modules/<module>/infrastructure/persistence/orm-entities/*.orm-entity.ts` ; `migration:generate` produit une migration dans `backend/src/database/migrations/`, **relue ligne à ligne** avant commit (TypeORM génère parfois des `DROP`/`ALTER` inattendus). Contraintes d'exclusion, index partiels, extensions (`btree_gist`) : migration écrite à la main (`migration:create`), TypeORM ne les génère pas.
- **Règle absolue** : tout changement de table/colonne/index/contrainte passe par une migration versionnée et commitée, avec une méthode `down` réelle. **Une migration commitée ne se modifie jamais** (hook de garde) : on en ajoute une nouvelle. `typeorm schema:sync`, `schema:drop` et `synchronize: true` sont interdits (hook de garde).
- Migration destructive (drop, rename, `NOT NULL` sur table remplie) : en deux temps (expand → migrate → contract), jamais dans la même release que le code qui en dépend.
- Historique : `docs/migrations-history.md`.

### I.9. Temps réel (SSE)

Canal standard pour garder planning et disponibilités à jour (PRD F02 : moins de 5 s pour les utilisateurs connectés). Pas de polling ; une relecture de secours espacée (20-30 s, bornée) quand le flux est coupé, et **une relecture complète des données affichées à chaque reconnexion** (PRD §12 Fiabilité). Ce qui doit être garanti passe par l'outbox, pas par ce canal.

- **Back** : port `RealtimePublisher.publishToUser(userId, …)` / `publishToSalon(salonId, …)` appelé depuis un handler ; l'envoi part **après le commit** ; panne loggée, jamais propagée. Charge minimale `{ type, payload }` : identifiants et statut, **aucune donnée personnelle** (ni nom ni téléphone de client).
- **Flux public** de disponibilités d'un salon publié : uniquement « disponibilités modifiées pour l'intervenant X », sans aucune information de réservation.
- **Front** : un seul `EventSource` (`withCredentials`) ouvert à la connexion ; routage par `type`, charge validée par schéma ; un événement invalide les tags RTK Query concernés ; un événement peut devancer la réponse HTTP.
- **Sécurité** : flux privés authentifiés par la session et l'origine ; le serveur choisit les destinataires (salon actif de la session vérifié par l'appartenance) ; aucun abonnement à un salon ou utilisateur choisi par le client.

---

## II. ARCHITECTURE FRONTEND (`frontend/`)

SPA Vite (pas de SSR), **mobile-first**. Trois espaces dans la même app : marketplace publique, back-office salon, administration plateforme (routes et layouts séparés, chargés paresseusement). Détail et idiomes : skill `front-stack`.

```
frontend/src/
  app/                 # router, providers, layouts (marketplace, salon, admin)
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
- Routes paresseuses (`lazy`) par espace et par module.
- Schémas de formulaire repris de `packages/contracts` : le front et l'API valident la même chose.
- Heures affichées dans le fuseau **du salon**, montants en FCFA sans décimales (`Intl.NumberFormat('fr-CM', { style: 'currency', currency: 'XAF' })`).

---

## III. ENVIRONNEMENT

- **API** : `AppConfigModule.forRoot(loadConfig())` + schéma Zod de toutes les variables (`shared/infrastructure/config/env.schema.ts`), validé avant la construction de l'app et injecté par le token `APP_CONFIG` (fail-fast : variable manquante, secret trop court ou recopié du modèle, cookie non sécurisé / base sans TLS / OpenAPI ou paiement `fake` en prod → refus de démarrer). En local, `backend/.env` est chargé par `process.loadEnvFile` sans écraser les variables déjà posées. `backend/.env.example` liste chaque variable avec un placeholder et est commité ; `backend/.env` contient les vraies valeurs locales, **n'est jamais commité ni lu par un agent** (hook de garde), et n'est jamais recopié dans un rapport. Secrets de prod/preprod : variables d'environnement du serveur, jamais un fichier du dépôt.
- **Web** : `VITE_API_BASE_URL` (défaut `http://localhost:10400`), `VITE_APP_NAME`. Toute variable `VITE_*` est **publique** (figée dans le bundle) : jamais de secret.
- Profils : `local`, `test`, `preprod`, `prod` (`NODE_ENV` + `APP_ENV`).

---

## IV. NOUVEAU MODULE

Checklists complètes (backend, frontend, socle) : `docs/checklists.md`.

---

## V. POINTS DE VIGILANCE

- **Tests obligatoires après tout changement** : après toute création ou modification d'un handler, d'une query ou d'un cas d'usage, lancer les tests du module avant de valider. Lire le **nombre** de tests exécutés : « 0 test » est un faux vert.
- **Seed obligatoire** : tout nouveau module ou nouvelle donnée affichée livre ses données de démo (`backend/src/database/seed/`), droits des rôles compris. Un écran vide au démarrage faute de seed n'est pas terminé.
- **Migrations** : jamais modifier une migration commitée, jamais `schema:sync` ni `synchronize: true`, toujours relire le SQL généré.
- **Lectures** : SQL pur dans `application/queries` (écrans) ou `application/read-repositories` (lecture utile à une commande, derrière un port `domain/repositories/read`), via `SqlReader` et le gabarit `sql` ; jamais l'ORM pour lire un écran.
- **`TransactionalCommandBus`** : seule porte d'entrée des écritures depuis HTTP, un webhook ou une tâche.
- **Domaine pur** : aucun import `@nestjs/*` / `typeorm` dans `domain/` (`pnpm arch` le vérifie).
- **Identité et salon actif** lus dans la session côté serveur, jamais dans le body, la query ou un en-tête client. Rôles système et rôles salon ne se mélangent jamais (PRD §2, §4).
- **Paiement** : un statut n'est cru que s'il est confirmé par le serveur auprès de l'agrégateur ; référence de transaction unique en base ; webhook idempotent ; aucun code secret Mobile Money stocké ni loggé ; paiement tardif sur créneau perdu → incident, jamais une réservation inventée (BR-06).
- **Gateways injectés** côté front : jamais importés dans un thunk, un slice ou un composant.
- **Redux Persist** : seuls les slices explicitement listés en `whitelist` sont persistés ; le cache RTK Query ne l'est jamais.
- **Contrats partagés** : un changement de schéma dans `packages/contracts` se répercute sur l'API, le web et l'OpenAPI dans le même commit.
- **ESM** : imports relatifs avec extension `.js` côté API, `import.meta.dirname` au lieu de `__dirname` (confirmé, D-009).
- **Nouvelle entité ou migration** : l'ajouter au registre (`src/database/entities.ts`, `src/database/migrations.ts`) ; sans cela, ni l'app ni les tests ne la voient.
- **Journal** : chaque évolution livrée a son entrée dans `docs/EVOLUTIONS.md` ; tout point relevé et non traité va dans `docs/BACKLOG.md`.

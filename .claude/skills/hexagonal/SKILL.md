---
name: hexagonal
description: Architecture hexagonale (ports & adapters) + CQRS de GoMeCoiffer, back NestJS/TypeORM et front React. À charger pour structurer un cas d'usage, ajouter un contrôleur/endpoint, câbler un handler ou un adapter dans un module Nest, ajouter un gateway front, ou décider où placer un fichier. Impose domain/application/infrastructure/tests, TransactionalCommandBus, écritures TypeORM derrière des ports, lectures en SQL pur dans application/ via SqlReader, migrations TypeORM.
---

# Architecture hexagonale (GoMeCoiffer)

> Réf : `CLAUDE.md` §I et §II, `docs/checklists.md`. Idiomes NestJS/TypeORM : skill [nest-stack].

## Back-end — couches par module (`backend/src/modules/<module>/`)

- **`domain/`** — agrégats, VO, ports (interfaces de repository et de passerelles externes + tokens), erreurs, événements. **Pur**. Voir skill [ddd].
- **`application/`** — CQRS :
  - `commands/<use-case>/` : `<use-case>.command.ts` (`extends Command<R>`) + `<use-case>.handler.ts` (`@CommandHandler`, dépendances par constructeur via tokens). Le handler **orchestre** ; les règles vivent dans le domaine et **c'est l'agrégat qui enregistre ses événements**.
  - `queries/<use-case>/` : `<use-case>.query.ts` (`extends Query<R>`) + `<use-case>.handler.ts` (`@QueryHandler`, **SQL pur** exécuté par le port `SqlReader`) + `<use-case>.read-model.ts` (types `readonly`). Skill [sql-query].
  - `subscribers/` : adaptateurs d'événement, **handler cible injecté**, sans logique (skill [ddd] §10).
- **`infrastructure/`** — adapters :
  - `persistence/` : `<x>.orm-entity.ts` (`@Entity`), `<x>.mapper.ts` (domaine ↔ entité), `typeorm-<x>.repository.ts` (implémente le port, passe par `TransactionHost`).
  - `http/` : `<x>.controller.ts` (contrôleur mince, schémas de `@gomecoiffer/contracts`).
  - `<passerelle>/` : adapters externes (ex. `payments/infrastructure/aggregator/`, `identity/infrastructure/sms/`), couche de traduction + adapter `fake` pour local et test.
  - `<module>.module.ts` : câblage Nest (`providers: [{ provide: BOOKING_REPOSITORY, useClass: TypeOrmBookingRepository }]`, handlers, contrôleurs).
- **`tests/`** — `unit/`, `integration/`, `e2e/`, `builders/`, `fakes/`. Voir skill [tdd].

### Flux d'une requête d'écriture
```
HTTP → Guards (Auth, CSRF, Permissions, salon actif) → Controller (validation Standard Schema)
  → new <UseCase>(actor.activeSalonId, actor.userId, …)
  → TransactionalCommandBus.execute(cmd)          // transaction CLS + événements + outbox
  → Handler → Aggregate → Repository TypeORM (tx) → DomainEventDispatcher
  → commit → afterCommit (OutboxRelay, SSE) → ApiResponse<T>
```

### Flux d'une requête de lecture
```
HTTP → Guards → Controller → QueryBus.execute(new <UseCase>Query(actor.activeSalonId, …))
  → QueryHandler (application/) : sql`…` → SqlReader (READ_DB) → read model readonly → ApiResponse<T>
```

### Règles
1. **Sens des dépendances** : infrastructure → application → domain. Jamais l'inverse. `application/` n'importe jamais `typeorm` (le port `SqlReader` et le gabarit `sql` viennent de `shared/application`).
2. **Transaction** : un contrôleur, un webhook ou une tâche planifiée passe **toujours** par `TransactionalCommandBus` ; jamais `CommandBus` brut, jamais un handler injecté, jamais `dataSource.transaction()`.
3. **Contrôleur mince** : extrait les entrées validées et l'acteur, construit la commande/query, appelle le bus. Aucune logique métier, aucun accès repository.
4. **Câblage** : chaque port est lié à son adapter dans le `<module>.module.ts` par un token (`Symbol`) déclaré dans `domain/`. Pas de `@Injectable()` dans `domain/`.
5. **Écritures** : repository TypeORM derrière un port ; entité TypeORM distincte de l'agrégat ; mapper aller-retour ; verrou optimiste explicite.
6. **Lectures** : SQL pur dans `application/queries`, paramètres liés par le gabarit `sql`, read models `readonly`, CTE filtrées à l'entrée, **testées en E2E uniquement**, rapport d'analyse avec index réels (skill [sql-query]).
7. **Migrations** : tout changement de schéma → migration TypeORM relue dans `backend/src/database/migrations/` + ligne dans `docs/migrations-history.md`. Jamais `synchronize`.
8. **Inter-modules** : **écrire** dans un autre module passe par un événement (`DomainEvent` synchrone seulement si un invariant exige la même transaction, sinon `IntegrationEvent` post-commit) ; **lire** un autre module est permis (query SQL).
9. **Préfixe `/api`** ; route publique → `@Public()` explicite, justifiée, sous `/api/public/*` ou `/api/webhooks/*`.

## Front-end — hexagonal par module (`frontend/src/modules/<module>/`)

- `models/` (entités + `gateway/<Module>Gateway.ts` = **port**)
- `usecases/<cas>/` (thunk `createAppAsyncThunk` + `Command` + `Response`)
- `slice/`, `listeners/`
- `infra/` (`repo/<Module>HttpGateway.ts` = **adapter** sur `HttpClient`, `api/<module>Api.ts` RTK Query, `validators/`, `ui/`)

**DI** : adapters instanciés dans `lib/store/dependencies/` et injectés en `extraArgument`. **Jamais** d'import d'un `*HttpGateway` dans un thunk, un slice ou un composant. Détail : skill [front-stack].

## Checklist avant de valider

- [ ] Chaque fichier est-il dans la bonne couche ?
- [ ] Sens des dépendances respecté (`pnpm arch` vert) ?
- [ ] Écriture via `TransactionalCommandBus` depuis le contrôleur / webhook / tâche ?
- [ ] Port lié à son adapter par token dans le module Nest ?
- [ ] Query = SQL pur dans `application/`, `SqlReader`, read models `readonly`, rapport d'index ?
- [ ] Changement de schéma → migration TypeORM relue + `docs/migrations-history.md` ?
- [ ] Se combine avec les skills [ddd], [nest-stack] et [tdd].

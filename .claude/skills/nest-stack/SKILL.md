---
name: nest-stack
description: Idiomes du backend GoMeCoiffer (NestJS 12 + @nestjs/cqrs + nestjs-cls transactional + TypeORM + PostgreSQL 17 + Zod 4 + Vitest/Testcontainers). À charger avant d'écrire ou modifier du code dans backend/ — entité TypeORM, mapper, repository transactionnel, SqlReader et gabarit sql, TransactionalCommandBus, guards et décorateurs de sécurité, config validée, migrations TypeORM, setup de test. Complète hexagonal (où placer) et ddd (quoi modéliser) par le comment.
---
# Nest-stack — NestJS + TypeORM (GoMeCoiffer)

> Réf : `CLAUDE.md` §Stack, §I, §III. Vérifier à l'init du socle la doc officielle des API récentes
> (`@Body({ schema })` NestJS 12, `@nestjs-cls/transactional-adapter-typeorm`, CLI TypeORM sous ESM).

## Écriture : entité, mapper, repository

```ts
// infrastructure/persistence/booking.orm-entity.ts — jamais importée hors de infrastructure/
@Entity('bookings')
export class BookingOrmEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') salonId!: string;
  @Column('uuid') staffId!: string;
  @Column('uuid') serviceId!: string;
  @Column('timestamptz') startsAt!: Date;
  @Column('timestamptz') endsAt!: Date;
  @Column('text') status!: BookingStatus;
  @Column('integer') priceXaf!: number;
  @Column('integer') version!: number;
}

// infrastructure/persistence/booking.mapper.ts
export const BookingMapper = {
  toDomain: (e: BookingOrmEntity): Booking => Booking.restore({ ...e, price: Money.xaf(e.priceXaf) }),
  toPersistence: (b: Booking): BookingOrmEntity => { /* snapshot → colonnes */ },
};

// infrastructure/persistence/typeorm-booking.repository.ts
@Injectable()
export class TypeOrmBookingRepository implements BookingRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly events: DomainEventDispatcher,
  ) {}

  private get repo() { return this.txHost.tx.getRepository(BookingOrmEntity); }

  async getOfSalon(salonId: string, id: string): Promise<Booking> {
    const row = await this.repo.findOneBy({ id, salonId });     // périmètre dans le WHERE
    if (!row) throw new BookingNotFoundError(id);                // 404, même si l'id existe ailleurs
    return BookingMapper.toDomain(row);
  }

  async save(booking: Booking): Promise<void> {
    const row = BookingMapper.toPersistence(booking);
    try {
      if (booking.isNew) await this.repo.insert({ ...row, version: 1 });
      else {
        const { affected } = await this.repo.createQueryBuilder().update()
          .set({ ...row, version: () => 'version + 1' })
          .where('id = :id AND version = :version', { id: row.id, version: row.version })
          .execute();
        if (affected === 0) throw new ConcurrencyConflictError('Booking', row.id);
      }
    } catch (e) {
      if (isPgError(e, '23P01')) throw new SlotNoLongerAvailableError();  // contrainte d'exclusion
      throw e;
    }
    await this.events.dispatch(booking.pullEvents());          // DomainEvent sync + outbox, même tx
  }
}
```

- `this.txHost.tx` donne l'`EntityManager` de la transaction ouverte par le bus ; **jamais** `@InjectRepository()` ni `dataSource.manager` dans un repository d'écriture (ils sortent de la transaction).
- Les `find*`/QueryBuilder TypeORM sont permis **dans les repositories d'écriture seulement** (charger un agrégat) ; jamais pour un écran.
- Relations TypeORM (`@OneToMany`, `eager`, `cascade`) : à éviter. Les enfants d'un agrégat se chargent et s'écrivent explicitement par le repository de la racine ; pas de lazy loading.

## Lecture : `SqlReader` et gabarit `sql`

```ts
// shared/application/sql.ts — pur TypeScript, aucune dépendance
export interface SqlStatement { readonly text: string; readonly values: readonly unknown[] }
export function sql(strings: TemplateStringsArray, ...values: unknown[]): SqlStatement; // ${v} → $n
export namespace sql {
  export function unsafe(constantFragment: string): SqlFragment;   // constantes du code UNIQUEMENT
  export function join(parts: readonly SqlFragment[], sep: string): SqlFragment; // fragments imbriqués
}

// shared/application/sql-reader.ts
export const READ_DB = Symbol('READ_DB');
export interface SqlReader {
  many<T>(q: SqlStatement): Promise<readonly T[]>;
  one<T>(q: SqlStatement): Promise<T>;              // 0 ligne → NotFoundError
  maybeOne<T>(q: SqlStatement): Promise<T | null>;
}

// shared/infrastructure/database/typeorm-sql-reader.ts
@Injectable()
export class TypeOrmSqlReader implements SqlReader {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}   // réplica : DataSource nommée plus tard
  async many<T>(q: SqlStatement) { return (await this.ds.query(q.text, [...q.values])) as T[]; }
  // …
}
```

- Tri ou colonne dynamique : `const ORDER = { date: sql.unsafe('b.starts_at'), staff: sql.unsafe('s.display_name') } as const` puis `ORDER[q.sortBy]` après validation du contrat. Jamais `sql.unsafe(entréeUtilisateur)`.
- Listes : `= ANY(${ids}::uuid[])` ; dates : passer des `Date` ou des chaînes ISO, caster côté SQL (`::timestamptz`).
- `bigint`/`numeric` reviennent en chaîne avec node-postgres : caster en SQL (`::int`) quand la valeur tient, ou convertir explicitement.

## `TransactionalCommandBus`

```ts
// shared/application/transactional-command-bus.ts (code réel du socle)
execute<R>(command: Command<R>): Promise<R> {
  return this.inTransaction(() => this.bus.execute(command));
}
inTransaction<R>(work: () => Promise<R>): Promise<R> {
  // AfterCommit ouvre une file dans le contexte CLS, la vide seulement si le commit a réussi
  return this.afterCommit.runInScope(() => this.txHost.withTransaction(work));
}
```

- Une action à faire **après** le commit (SSE, réveil du relais d'outbox) passe par `AfterCommit.register(fn)` ; hors transaction du bus, elle part tout de suite. `AfterCommit.registerDetached(fn)` : après le commit, sans que la réponse l'attende (SMS dont le délai ne doit rien révéler) ; erreurs journalisées (type et code seulement).
- **Refus enregistré** : `throw new RefuseAfterCommit(new XxxError())` (`shared/application/refuse-after-commit.ts`). Le bus intercepte cette exception dans `withTransaction`, **commite** (l'essai raté reste en base), exécute les actions post-commit, puis lève l'erreur métier (422 par le filtre). Toute autre exception annule la transaction. Test : `await expect(handler.execute(cmd)).rejects.toMatchObject({ refusal: expect.any(XxxError) })` en unitaire ; l'intégration vérifie aussi les lignes restées en base.

## HTTP : mapper de requête, répondeur, corps de route (D-034)

```ts
// infrastructure/http/mappers/sign-in.request-mapper.ts — fonction pure, seul import de la commande côté HTTP
export const toSignIn = (body: SignInBody, req: Request, config: AppConfig) =>
  new SignIn({ phone: body.phone, password: body.password,
    deviceTokens: readDeviceTokens(req, config), networkAddress: req.ip ?? 'unknown' });

// infrastructure/http/auth.controller.ts — corps de route sans logique
@Post('sign-in')
async signIn(@Body({ schema: SignInSchema }) body: SignInBody, @Req() req: Request,
             @Res({ passthrough: true }) res: Response): Promise<SignedIn> {
  const account = await this.commands.execute(toSignIn(body, req, this.config));
  return this.session.signedIn(req, res, account);   // AuthenticatedSessionResponder
}
```

- **Répondeur** (`<x>.responder.ts`, `@Injectable()`) : `openAuthenticatedSession` (régénère l'id), cookie d'appareil, `generateCsrfToken(req, res, { overwrite: true })`, lecture du résumé par `QueryBus`, `session.destroy` + `clearCookie` avec les mêmes attributs qu'à la pose. Ni `if` sur un état métier, ni repository, ni commande.
- Interdits dans un corps de route : `if`, `try`, `new`, `?:`, cast, `req.session`, `res.cookie`, `generateCsrfToken`. Les trackers `@Throttle` sont des fonctions nommées.
- `DomainEventDispatcher.dispatch(aggregate.pullEvents())` dans `save()` : `DomainEvent` → subscribers synchrones ; `IntegrationEvent` (classe avec `static type` et `integration = true`) → ligne d'outbox. Le relais livre chaque ligne dans sa propre transaction, `processed_events` rend chaque consommateur idempotent.

Isolation par défaut `READ COMMITTED` ; les invariants de concurrence reposent sur les contraintes de base (exclusion, unicité) et le verrou optimiste, pas sur un niveau d'isolation plus fort.

## Sécurité HTTP (socle)

- `AuthGuard` global **deny-by-default** ; `@Public()` pour l'exception. Session `express-session` stockée en PostgreSQL (table `sessions`), cookie `HttpOnly`, `SameSite=Lax`, `Secure` hors local, nom `__Host-gmc.sid` en prod ; régénération de l'id de session à la connexion et au changement de privilèges.
- CSRF : double-submit (`csrf-csrf`) sur toutes les méthodes d'écriture, y compris les routes publiques de réservation ; exception unique : `/api/webhooks/*` (signature HMAC à la place).
- `PermissionsGuard` + `@RequiresPermission('bookings:manage')` : évalué sur le **salon actif de la session** ; `@RequiresSystemRole('SUPER_ADMIN')` pour `/api/admin/*`. Les deux mondes ne se mélangent pas.
- `@CurrentActor()` lit le contexte CLS (`userId`, `activeSalonId`, `permissions`, `systemRoles`) posé par les guards, jamais la requête brute.
- `helmet`, CORS en **allowlist** (`WEB_ORIGIN`), `@nestjs/throttler` sur connexion, OTP, création de réservation publique, webhooks.

## Configuration

- `shared/infrastructure/config/env.schema.ts` : une entrée Zod par variable de `backend/.env.example` (secrets mesurés en octets base64, placeholders `<…>` refusés, règles prod dans `superRefine`). Nouvelle variable → schéma + `.env.example` dans le même commit.
- `main.ts` : `loadLocalEnvFile()` puis `AppModule.forRoot(loadConfig())` ; la config est injectée par `@Inject(APP_CONFIG) config: AppConfig`. Pas de `@nestjs/config` (D-011). Une variable manquante ou faible arrête l'app ; le message ne cite que le nom des variables. Les secrets ne sont jamais loggés (redaction `nestjs-pino` : `req.headers.cookie`, `*.password`, `*.otp`, `*.token`, `*.phone`).

## Migrations TypeORM

- Pas de glob (ESM, tests sous Vitest) : **registres** `src/database/entities.ts` et `src/database/migrations.ts`, lus par `dataSourceOptions(config)` (app, CLI, tests).
- `migration:create <Nom>` écrit la migration et l'ajoute au registre ; `migration:generate src/database/migrations/<Nom>` compile puis diffe les entités (ajouter ensuite la migration au registre) ; `migration:run|revert|show` passent par `dist/database/cli.js`.
- Générer, **relire** chaque instruction, compléter à la main ce que TypeORM ne sait pas faire (`CREATE EXTENSION btree_gist`, `EXCLUDE USING gist`, index partiels `WHERE deleted_at IS NULL`, index d'expression). `down()` réel.
- **Indexation systématique en base de données** : chaque nouvelle table ou nouvelle requête (repository d'écriture, `read-repository` ou `QueryHandler`) doit définir dans la migration TypeORM les **index couvrant toutes ses clauses `WHERE`, `JOIN`, `ORDER BY` et contraintes d'unicité** (index composites dans l'ordre du préfixe le plus sélectif, index uniques partiels `WHERE status = 'PENDING'` / `WHERE status = 'ACTIVE'`, index partiels pour les tâches planifiées de purge). Aucun scan séquentiel sur une colonne de filtre ou de jointure.
- Jamais `schema:sync`, `schema:drop`, `synchronize: true`, `dropSchema: true` (hook de garde).

## Tests

- `vitest.config.ts` avec `projects` : `unit` (`tests/unit/**/*.test.ts`), `integration` (`*.int.test.ts`), `e2e` (`*.e2e.test.ts`) ; plugin `unplugin-swc` (décorateurs + metadata).
- Intégration/E2E : `src/test-support/postgres.global-setup.ts` démarre `postgres:17` (Testcontainers) et migre une base modèle ; `startTestApp({ controllers?, providers?, overrides? })` clone une base par fichier et monte l'app complète (gardes, session, CSRF réels) ; `t.browser()` est un agent supertest qui garde les cookies et envoie le jeton CSRF sur `post()`. Droits fixés par le test : `overrides: [[ACTOR_RIGHTS, new GrantedRights({...})]]`. `Test.createTestingModule` n'apparaît que dans `test-support/`.
- Un test d'intégration qui passe du premier coup se vérifie par une mutation volontaire (casser la règle, voir rouge, rétablir).
- Adapters externes en test : `FakePaymentGateway`, `FakeSmsSender`, `InMemoryRealtimePublisher` qui **enregistrent** ce qui sort ; `FixedClock`, `SequentialIdGenerator`.

## Checklist avant de valider

- [X] Repository via `txHost.tx`, verrou optimiste explicite, `23P01` traduit, événements dispatchés dans `save()` ?
- [X] Aucune entité TypeORM hors `infrastructure/persistence/` ; aucun `typeorm` dans `application/` ?
- [X] Lecture = `sql\`…\``+`SqlReader`, aucun `sql.unsafe` sur une entrée ?
- [X] Écriture via `TransactionalCommandBus` ; route protégée par défaut ; `@Public()` justifié ?
- [X] Nouvelle variable d'env : schéma Zod + `backend/.env.example` (placeholder) ?
- [X] Migration générée **relue**, `down()` réel, `docs/migrations-history.md` à jour ?

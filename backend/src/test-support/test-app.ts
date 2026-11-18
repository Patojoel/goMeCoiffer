import type { INestApplication, Provider, Type } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module.js';
import { configureApp } from '../app.setup.js';
import { createTestDatabase, type TestDatabase } from './test-database.js';

export interface TestApp {
  readonly app: INestApplication;
  readonly moduleRef: TestingModule;
  readonly db: TestDatabase;
  /** Navigateur simulé : garde les cookies (session, CSRF) d'une requête à l'autre. */
  browser(): Browser;
  close(): Promise<void>;
}

export interface TestAppOptions {
  readonly controllers?: Type[];
  readonly providers?: Provider[];
  readonly overrides?: ReadonlyArray<readonly [token: unknown, value: unknown]>;
  /**
   * Variables de configuration propres au fichier. Sert à abaisser une limite pour l'atteindre en peu de requêtes :
   * sous Windows, un processus de test qui enchaîne des centaines de requêtes peut planter (0xC0000409).
   */
  readonly env?: Readonly<Record<string, string>>;
}

/** Application Nest complète (gardes, filtre, session, CSRF réels) sur une base de test dédiée. */
export async function startTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  const db = await createTestDatabase(options.env);
  let builder = Test.createTestingModule({
    imports: [AppModule.forRoot(db.config)],
    controllers: options.controllers ?? [],
    providers: options.providers ?? [],
  });
  for (const [token, value] of options.overrides ?? [])
    builder = builder.overrideProvider(token).useValue(value);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app, db.config);
  await app.init();

  return {
    app,
    moduleRef,
    db,
    browser: () => new Browser(app),
    close: async () => {
      await app.close();
      await db.drop();
    },
  };
}

export class Browser {
  readonly agent: ReturnType<typeof request.agent>;
  private csrf: string | null = null;

  constructor(app: INestApplication) {
    this.agent = request.agent(app.getHttpServer());
  }

  /** Comme le front : après une connexion ou une déconnexion, le jeton change (`null` : il faudra en redemander un). */
  useCsrfToken(token: string | null): void {
    this.csrf = token;
  }

  get(path: string) {
    return this.agent.get(path);
  }

  /** Écriture comme le ferait le front : jeton CSRF demandé une fois puis envoyé en en-tête. */
  async post(path: string, body?: object) {
    this.csrf ??= (await this.agent.get('/api/public/session/csrf')).body.data.csrfToken as string;
    return this.agent.post(path).set('x-csrf-token', this.csrf).send(body);
  }
}

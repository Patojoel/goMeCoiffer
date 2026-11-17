import connectPgSimple from 'connect-pg-simple';
import { doubleCsrf } from 'csrf-csrf';
import type { Request, RequestHandler } from 'express';
import session from 'express-session';
import pg from 'pg';
import type { AppConfig } from '../config/app-config.module.js';
import './session-types.js';

const cookieName = (config: AppConfig, base: string) => (config.COOKIE_SECURE ? `__Host-${base}` : base);

/** Session serveur stockée en PostgreSQL (table `sessions`) ; cookie HttpOnly, SameSite=Lax. */
export function sessionMiddleware(config: AppConfig): {
  middleware: RequestHandler;
  close: () => Promise<void>;
} {
  const pool = new pg.Pool({
    host: config.DB_HOST,
    port: config.DB_PORT,
    database: config.DB_NAME,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    ssl: config.DB_SSL ? { rejectUnauthorized: true } : false,
    max: 3,
  });
  const PgStore = connectPgSimple(session);
  const middleware = session({
    store: new PgStore({
      pool,
      tableName: 'sessions',
      createTableIfMissing: false,
      pruneSessionInterval: 15 * 60,
    }),
    name: cookieName(config, config.SESSION_COOKIE_NAME),
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    proxy: config.TRUST_PROXY,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.COOKIE_SECURE,
      path: '/',
      maxAge: config.SESSION_TTL_HOURS * 3_600_000,
    },
  });
  return { middleware, close: () => pool.end() };
}

/** CSRF « double submit » lié à l'id de session : jeton dans l'en-tête x-csrf-token. */
export function csrfProtection(config: AppConfig) {
  const { generateCsrfToken, validateRequest } = doubleCsrf({
    getSecret: () => config.CSRF_SECRET,
    getSessionIdentifier: (req: Request) => req.session.id,
    cookieName: cookieName(config, 'gmc.x-csrf'),
    cookieOptions: { httpOnly: true, sameSite: 'lax', secure: config.COOKIE_SECURE, path: '/' },
    getCsrfTokenFromRequest: (req: Request) => req.get('x-csrf-token'),
  });
  return { generateCsrfToken, validateRequest };
}

export type CsrfProtection = ReturnType<typeof csrfProtection>;
export const CSRF_PROTECTION = Symbol('CSRF_PROTECTION');

import { z } from 'zod';

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');
const int = z.coerce.number().int();
const optionalText = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));
const STRICT_BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
/** Base64 strict, assez long, et assez varié pour venir d'un générateur aléatoire (pas d'un mot répété). */
const secret = (minBytes: number) =>
  z
    .string()
    .refine(
      (v) => STRICT_BASE64.test(v) && Buffer.from(v, 'base64').length >= minBytes && new Set(v).size >= 20,
      { message: `secret absent, faible ou mal formé (${minBytes} octets aléatoires en base64 au minimum)` },
    );
const SECRETS = [
  'SESSION_SECRET',
  'CSRF_SECRET',
  'TOKEN_HASH_PEPPER',
  'PAYMENT_WEBHOOK_SECRET',
  'APP_ENCRYPTION_KEY',
] as const;

/** Toutes les variables de backend/.env.example. Une valeur absente ou faible arrête l'application. */
export const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_ENV: z.enum(['local', 'test', 'preprod', 'prod']),
    APP_NAME: z.string().default('GoMeCoiffer'),
    PORT: int.default(10400),
    API_PUBLIC_URL: z.url(),
    WEB_ORIGIN: z.string().transform((v) =>
      v
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    ),
    WEB_PUBLIC_URL: z.url(),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    DEFAULT_SALON_TIME_ZONE: z.string().default('Africa/Douala'),
    TRUST_PROXY: bool.default(false),
    OPENAPI_ENABLED: bool.default(false),

    DB_HOST: z.string().min(1),
    DB_PORT: int.default(5432),
    DB_NAME: z.string().min(1),
    DB_USER: z.string().min(1),
    DB_PASSWORD: z
      .string()
      .min(24, 'DB_PASSWORD trop court (24 caractères minimum)')
      .refine((v) => !v.startsWith('<'), 'DB_PASSWORD encore égal au modèle'),
    DB_SSL: bool.default(false),
    DB_POOL_MAX: int.default(10),
    DB_LOGGING: bool.default(false),
    DB_READ_HOST: optionalText,
    DB_READ_PORT: optionalText,

    SESSION_SECRET: secret(64),
    SESSION_COOKIE_NAME: z.string().default('gmc.sid'),
    SESSION_TTL_HOURS: int.positive().default(12),
    /** Durée absolue depuis la connexion, même pour une session utilisée sans interruption. */
    SESSION_MAX_AGE_HOURS: int.positive().default(72),
    COOKIE_SECURE: bool.default(false),
    CSRF_SECRET: secret(32),

    TOKEN_HASH_PEPPER: secret(32),

    BOOKING_PAYMENT_HOLD_MINUTES: int.positive().default(10),
    RESCHEDULE_PROPOSAL_TTL_HOURS: int.positive().default(24),
    SUBSCRIPTION_GRACE_DAYS: int.nonnegative().default(7),

    APP_ENCRYPTION_KEY: secret(32).refine(
      (v) => Buffer.from(v, 'base64').length === 32,
      'APP_ENCRYPTION_KEY : exactement 32 octets en base64',
    ),

    PAYMENT_PROVIDER: z.string().default('fake'),
    PAYMENT_API_BASE_URL: optionalText,
    PAYMENT_API_KEY: optionalText,
    PAYMENT_WEBHOOK_SECRET: secret(32),
    PAYMENT_WEBHOOK_TOLERANCE_SECONDS: int.positive().default(300),

    SMS_PROVIDER: z.string().default('fake'),
    SMS_API_KEY: optionalText,
    SMS_SENDER_ID: z.string().default('GoMeCoiffer'),

    SMTP_HOST: z.string().min(1),
    SMTP_PORT: int,
    SMTP_USER: optionalText,
    SMTP_PASSWORD: optionalText,
    SMTP_SECURE: bool.default(false),
    MAIL_FROM: z.string().min(3),

    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    STORAGE_LOCAL_DIR: z.string().default('./var/uploads'),
    UPLOAD_MAX_BYTES: int.positive().default(5_242_880),

    THROTTLE_TTL_SECONDS: int.positive().default(60),
    THROTTLE_LIMIT: int.positive().default(120),
  })
  .superRefine((env, ctx) => {
    const fail = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
    const deployed = env.APP_ENV === 'preprod' || env.APP_ENV === 'prod';
    const prod = env.APP_ENV === 'prod';

    SECRETS.forEach((name, i) => {
      const twin = SECRETS.slice(0, i).find((other) => env[other] === env[name]);
      if (twin) fail(name, `doit différer de ${twin} (un secret par usage)`);
    });
    if (deployed && env.NODE_ENV !== 'production') fail('NODE_ENV', 'doit valoir production hors local');
    if (deployed && !env.COOKIE_SECURE) fail('COOKIE_SECURE', 'obligatoire hors local');
    if (deployed && !env.DB_SSL) fail('DB_SSL', 'obligatoire hors local');
    if (deployed && env.DB_LOGGING)
      fail('DB_LOGGING', 'interdit hors local (les paramètres SQL contiennent des données personnelles)');
    if (prod && env.OPENAPI_ENABLED) fail('OPENAPI_ENABLED', 'jamais en prod');
    if (prod && env.PAYMENT_PROVIDER === 'fake') fail('PAYMENT_PROVIDER', 'adaptateur fake interdit en prod');
    if (prod && env.SMS_PROVIDER === 'fake') fail('SMS_PROVIDER', 'adaptateur fake interdit en prod');
    if (env.PAYMENT_PROVIDER !== 'fake' && !(env.PAYMENT_API_KEY && env.PAYMENT_API_BASE_URL))
      fail(
        'PAYMENT_API_KEY',
        'PAYMENT_API_KEY et PAYMENT_API_BASE_URL obligatoires pour un vrai fournisseur',
      );
    if (env.SMS_PROVIDER !== 'fake' && !env.SMS_API_KEY)
      fail('SMS_API_KEY', 'obligatoire pour un vrai fournisseur');
  });

export type Env = z.infer<typeof EnvSchema>;

/** Les messages ne citent que le nom des variables, jamais leur valeur. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuration invalide, démarrage refusé :\n${problems}`);
  }
  return result.data;
}

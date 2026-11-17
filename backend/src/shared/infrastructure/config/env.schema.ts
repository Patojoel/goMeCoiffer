import { z } from 'zod';

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');
const int = z.coerce.number().int();
const optionalText = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));
const secret = (minBytes: number) =>
  z.string().refine((v) => Buffer.from(v, 'base64').length >= minBytes && !v.startsWith('<'), {
    message: `secret absent ou trop court (au moins ${minBytes} octets aléatoires)`,
  });

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
    DB_PASSWORD: z.string().min(16, 'DB_PASSWORD trop court (16 caractères minimum)'),
    DB_SSL: bool.default(false),
    DB_POOL_MAX: int.default(10),
    DB_LOGGING: bool.default(false),
    DB_READ_HOST: optionalText,
    DB_READ_PORT: optionalText,

    SESSION_SECRET: secret(64),
    SESSION_COOKIE_NAME: z.string().default('gmc.sid'),
    SESSION_TTL_HOURS: int.positive().default(12),
    COOKIE_SECURE: bool.default(false),
    CSRF_SECRET: secret(32),

    TOKEN_HASH_PEPPER: secret(32),
    OTP_TTL_SECONDS: int.positive().default(300),
    OTP_MAX_ATTEMPTS: int.positive().default(5),

    BOOKING_PAYMENT_HOLD_MINUTES: int.positive().default(10),
    RESCHEDULE_PROPOSAL_TTL_HOURS: int.positive().default(24),
    SUBSCRIPTION_GRACE_DAYS: int.nonnegative().default(7),

    APP_ENCRYPTION_KEY: z
      .string()
      .refine((v) => Buffer.from(v, 'base64').length === 32, 'APP_ENCRYPTION_KEY : 32 octets en base64'),

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
    const deployed = env.APP_ENV === 'preprod' || env.APP_ENV === 'prod';
    if (deployed && !env.COOKIE_SECURE)
      ctx.addIssue({ code: 'custom', path: ['COOKIE_SECURE'], message: 'obligatoire hors local' });
    if (deployed && !env.DB_SSL)
      ctx.addIssue({ code: 'custom', path: ['DB_SSL'], message: 'obligatoire hors local' });
    if (env.APP_ENV === 'prod' && env.OPENAPI_ENABLED)
      ctx.addIssue({ code: 'custom', path: ['OPENAPI_ENABLED'], message: 'jamais en prod' });
    if (env.APP_ENV === 'prod' && env.PAYMENT_PROVIDER === 'fake')
      ctx.addIssue({
        code: 'custom',
        path: ['PAYMENT_PROVIDER'],
        message: 'adaptateur fake interdit en prod',
      });
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

import { z } from 'zod';

/** GET /api/public/session/csrf — jeton à renvoyer dans l'en-tête X-CSRF-Token sur toute écriture. */
export const CsrfTokenSchema = z.object({ csrfToken: z.string().min(1) });
export type CsrfToken = z.infer<typeof CsrfTokenSchema>;
export const CSRF_HEADER = 'x-csrf-token';

/** GET /api/public/health */
export const HealthSchema = z.object({ status: z.literal('ok'), database: z.enum(['up', 'down']) });
export type Health = z.infer<typeof HealthSchema>;

/** Événement temps réel (SSE) : identifiants et statut seulement, jamais de donnée personnelle. */
export const RealtimeEventSchema = z.object({
  type: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
});
export type RealtimeEvent = z.infer<typeof RealtimeEventSchema>;

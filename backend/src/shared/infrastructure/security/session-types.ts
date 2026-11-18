import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    activeSalonId?: string | null;
    /** Instant de la connexion (ms) : borne la durée absolue de la session. */
    authenticatedAt?: number;
    /** Dernière requête authentifiée (ms) : borne l'inactivité d'une session portant un rôle système. */
    lastActivityAt?: number;
    /** Posé à la délivrance du jeton CSRF : la session d'un visiteur est alors conservée. */
    visitor?: true;
  }
}

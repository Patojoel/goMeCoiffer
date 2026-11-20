import 'express-session';

declare module 'express-session' {
  interface SessionData {
    /** Type de session (D-054, D-055) : `CLIENT` (code SMS, limitée à `/api/client/*`) ou `STAFF` (défaut). */
    kind?: 'STAFF' | 'CLIENT';
    userId?: string;
    activeSalonId?: string | null;
    /** Version des identifiants du compte à l'ouverture de la session ; absente = version initiale (1). */
    credentialsVersion?: number;
    /** Instant de la connexion (ms) : borne la durée absolue de la session. */
    authenticatedAt?: number;
    /** Dernière requête authentifiée (ms) : borne l'inactivité d'une session portant un rôle système. */
    lastActivityAt?: number;
    /** Posé par le code qui émet une session authentifiée ; le magasin le retire (voir RotationSafePgStore). */
    freshlyIssued?: true;
    /** Posé à la délivrance du jeton CSRF : la session d'un visiteur est alors conservée. */
    visitor?: true;
  }
}

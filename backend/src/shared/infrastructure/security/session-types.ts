import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    activeSalonId?: string | null;
    /** Posé à la délivrance du jeton CSRF : la session d'un visiteur est alors conservée. */
    visitor?: true;
  }
}

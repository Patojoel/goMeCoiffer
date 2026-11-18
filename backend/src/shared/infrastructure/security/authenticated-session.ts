import type { Request } from 'express';
import './session-types.js';

const promisify = (run: (done: (err?: unknown) => void) => void) =>
  new Promise<void>((resolve, reject) => run((err) => (err ? reject(err) : resolve())));

/**
 * Ouvre une session authentifiée : nouvel identifiant de session (contre la fixation de session), instant de
 * connexion pour la durée absolue, aucun salon actif. Le jeton CSRF d'avant la connexion ne vaut plus.
 */
export async function openAuthenticatedSession(req: Request, userId: string, at: Date): Promise<void> {
  await promisify((done) => req.session.regenerate(done));
  req.session.userId = userId;
  req.session.authenticatedAt = at.getTime();
  req.session.activeSalonId = null;
  await promisify((done) => req.session.save(done));
}

import type { Request } from 'express';
import { RotationSafePgStore } from './rotation-safe-session-store.js';
import { UnauthenticatedError } from './security-errors.js';
import './session-types.js';

const promisify = (run: (done: (err?: unknown) => void) => void) =>
  new Promise<void>((resolve, reject) => run((err) => (err ? reject(err) : resolve())));

/**
 * Ouvre une session authentifiée : nouvel identifiant de session (contre la fixation de session), instant de
 * connexion pour la durée absolue, version des identifiants du compte (lue par la commande, pas relue ici : une
 * connexion qui se termine pendant une réinitialisation porte la version périmée et sera refusée), aucun salon actif
 * sauf si l'appelant en fixe un (acceptation d'une invitation). Le jeton CSRF d'avant la connexion ne vaut plus.
 */
export async function openAuthenticatedSession(
  req: Request,
  account: { userId: string; credentialsVersion: number },
  at: Date,
  activeSalonId: string | null = null,
): Promise<void> {
  await promisify((done) => req.session.regenerate(done));
  req.session.userId = account.userId;
  req.session.credentialsVersion = account.credentialsVersion;
  req.session.authenticatedAt = at.getTime();
  req.session.freshlyIssued = true;
  req.session.activeSalonId = activeSalonId;
  await promisify((done) => req.session.save(done));
  delete req.session.freshlyIssued;
}

/**
 * Changement de privilèges sans nouvelle connexion (devenir propriétaire, D-037) : nouvel identifiant de session,
 * mais l'utilisateur, l'instant de connexion, la version des identifiants et la dernière activité sont conservés —
 * la durée absolue n'est pas prolongée et une réinitialisation du mot de passe ferme toujours cette session.
 */
export async function regenerateSessionOnSalon(req: Request, activeSalonId: string): Promise<void> {
  const { userId, credentialsVersion, authenticatedAt, lastActivityAt } = req.session;
  const store = req.sessionStore;
  if (!(store instanceof RotationSafePgStore)) throw new Error('Magasin de sessions inattendu.');
  if (!(await store.consume(req.sessionID))) throw new UnauthenticatedError();
  await promisify((done) => req.session.regenerate(done));
  req.session.userId = userId;
  req.session.credentialsVersion = credentialsVersion;
  req.session.authenticatedAt = authenticatedAt;
  req.session.lastActivityAt = lastActivityAt;
  req.session.activeSalonId = activeSalonId;
  req.session.freshlyIssued = true;
  await promisify((done) => req.session.save(done));
  delete req.session.freshlyIssued;
}

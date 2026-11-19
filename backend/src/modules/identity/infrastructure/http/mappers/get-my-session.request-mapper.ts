import type { Actor } from '../../../../../shared/application/ports.js';
import { GetMySession } from '../../../application/queries/get-my-session/get-my-session.query.js';

export const toGetMySession = (actor: Pick<Actor, 'userId' | 'activeSalonId'>): GetMySession =>
  new GetMySession(actor.userId, actor.activeSalonId);

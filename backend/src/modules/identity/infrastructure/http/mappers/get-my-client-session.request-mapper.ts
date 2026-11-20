import type { Request } from 'express';
import type { Actor } from '../../../../../shared/application/ports.js';
import { GetMyClientSession } from '../../../application/queries/get-my-client-session/get-my-client-session.query.js';

export const toGetMyClientSession = (actor: Pick<Actor, 'userId'>, req: Request): GetMyClientSession =>
  new GetMyClientSession(actor.userId, req.session?.kind === 'CLIENT' ? 'CLIENT' : 'STAFF');

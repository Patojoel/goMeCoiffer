import { Query } from '@nestjs/cqrs';
import type { SessionSummaryReadModel } from './get-my-session.read-model.js';

/** `userId` et `activeSalonId` viennent de la session serveur. `null` : le compte n'existe plus. */
export class GetMySession extends Query<SessionSummaryReadModel | null> {
  constructor(
    readonly userId: string,
    readonly activeSalonId: string | null,
  ) {
    super();
  }
}

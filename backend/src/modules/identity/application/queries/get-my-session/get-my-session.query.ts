import { Query } from '@nestjs/cqrs';
import type { SessionSummaryReadModel } from './get-my-session.read-model.js';

/** `userId` et `activeSalonId` viennent de la session serveur ; l'`AuthGuard` a vérifié que le compte existe. */
export class GetMySession extends Query<SessionSummaryReadModel> {
  constructor(
    readonly userId: string,
    readonly activeSalonId: string | null,
  ) {
    super();
  }
}

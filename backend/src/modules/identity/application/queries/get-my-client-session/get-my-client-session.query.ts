import { Query } from '@nestjs/cqrs';
import type { ClientSessionSummaryReadModel } from './get-my-client-session.read-model.js';

/** `userId` et `kind` viennent de la session serveur ; l'`AuthGuard` a vérifié que le compte existe (RG-009-10). */
export class GetMyClientSession extends Query<ClientSessionSummaryReadModel> {
  constructor(
    readonly userId: string,
    readonly kind: 'CLIENT' | 'STAFF',
  ) {
    super();
  }
}

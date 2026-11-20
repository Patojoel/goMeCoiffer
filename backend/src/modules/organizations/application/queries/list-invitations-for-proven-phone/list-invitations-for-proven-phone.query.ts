import { Query } from '@nestjs/cqrs';
import type { InvitationsForProvenPhoneReadModel } from './list-invitations-for-proven-phone.read-model.js';

/** UC-007 : le numéro n'est jamais fourni par le client, il se retrouve par le jeton de preuve du cookie. */
export class ListInvitationsForProvenPhone extends Query<InvitationsForProvenPhoneReadModel> {
  constructor(readonly proofToken: string | null) {
    super();
  }

  /** Une query journalisée ou sérialisée ne montre pas le jeton de preuve. */
  toJSON() {
    return { proofToken: '***' };
  }
}

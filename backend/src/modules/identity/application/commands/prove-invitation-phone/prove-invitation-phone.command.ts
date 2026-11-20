import { Command } from '@nestjs/cqrs';
import type { ProveInvitationPhoneResponse } from './prove-invitation-phone.response.js';

/** UC-007, intention 2 : prouver le numéro avec le code reçu, pour voir et accepter ses invitations. */
export class ProveInvitationPhone extends Command<ProveInvitationPhoneResponse> {
  constructor(
    readonly phone: string,
    readonly code: string,
  ) {
    super();
  }

  toJSON() {
    return { phone: '***', code: '***' };
  }
}

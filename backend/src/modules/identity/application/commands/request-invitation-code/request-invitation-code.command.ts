import { Command } from '@nestjs/cqrs';
import type { RequestInvitationCodeResponse } from './request-invitation-code.response.js';

/** UC-007, intention 1 : recevoir par SMS un code pour rejoindre un salon qui a invité ce numéro. */
export class RequestInvitationCode extends Command<RequestInvitationCodeResponse> {
  constructor(readonly phone: string) {
    super();
  }

  /** Une commande journalisée ou sérialisée ne montre pas le numéro. */
  toJSON() {
    return { phone: '***' };
  }
}

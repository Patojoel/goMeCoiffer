import { Command } from '@nestjs/cqrs';
import type { RequestPasswordResetCodeResponse } from './request-password-reset-code.response.js';

/** UC-003, intention 1 : recevoir par SMS un code pour choisir un nouveau mot de passe. */
export class RequestPasswordResetCode extends Command<RequestPasswordResetCodeResponse> {
  constructor(readonly phone: string) {
    super();
  }

  /** Une commande journalisée ou sérialisée ne montre pas le numéro. */
  toJSON() {
    return { phone: '***' };
  }
}

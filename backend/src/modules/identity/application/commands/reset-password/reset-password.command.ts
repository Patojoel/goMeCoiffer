import { Command } from '@nestjs/cqrs';
import type { ResetPasswordResponse } from './reset-password.response.js';

/** UC-003, intention 2 : prouver le numéro avec le code et choisir un nouveau mot de passe ; la session est ouverte par la couche HTTP. */
export class ResetPassword extends Command<ResetPasswordResponse> {
  readonly phone: string;
  readonly code: string;
  readonly newPassword: string;
  /** Jetons du cookie d'appareil reconnu, déjà au format strict (lus par la couche HTTP). */
  readonly deviceTokens: readonly string[];

  constructor(input: { phone: string; code: string; newPassword: string; deviceTokens: readonly string[] }) {
    super();
    this.phone = input.phone;
    this.code = input.code;
    this.newPassword = input.newPassword;
    this.deviceTokens = input.deviceTokens;
  }

  /** Une commande journalisée ou sérialisée ne montre ni le mot de passe, ni le code, ni le numéro, ni les jetons. */
  toJSON() {
    return { phone: '***', code: '***', newPassword: '***', deviceTokens: '***' };
  }
}

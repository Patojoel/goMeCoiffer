import { Command } from '@nestjs/cqrs';
import type { BootstrapSuperAdminResponse } from './bootstrap-super-admin.response.js';

export class BootstrapSuperAdmin extends Command<BootstrapSuperAdminResponse> {
  constructor(
    readonly phone: string,
    /** Utilisateur du système qui lance la commande (lu par la CLI), tracé dans l'audit. */
    readonly systemUser: string,
    /** Mode secours : nommer un Super Administrateur alors qu'il en existe déjà. */
    readonly recovery: boolean,
  ) {
    super();
  }

  toJSON() {
    return { systemUser: this.systemUser, recovery: this.recovery };
  }
}

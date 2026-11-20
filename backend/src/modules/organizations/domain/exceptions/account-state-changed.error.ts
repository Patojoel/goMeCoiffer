import { ConflictError } from '../../../../shared/domain/errors.js';

/** Le compte du numéro n'est plus dans l'état que l'écran supposait (créé entre-temps, ou l'inverse). */
export class AccountStateChangedError extends ConflictError {
  override readonly code = 'ACCOUNT_STATE_CHANGED';
  constructor() {
    super('Votre compte vient de changer : rechargez la page.');
  }
}

import { BusinessRuleViolation } from '../../../../shared/domain/errors.js';

export class SuperAdminAlreadyExistsError extends BusinessRuleViolation {
  readonly code = 'SUPER_ADMIN_ALREADY_EXISTS';

  constructor() {
    super(
      'Un Super Administrateur existe déjà. Pour en nommer un autre depuis le serveur, relancez la commande avec --recovery.',
    );
  }
}

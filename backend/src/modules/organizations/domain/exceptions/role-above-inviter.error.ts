import { BusinessRuleViolation } from '../../../../shared/domain/errors.js';

export class RoleAboveInviterError extends BusinessRuleViolation {
  readonly code = 'ROLE_ABOVE_INVITER';
  constructor() {
    super(
      "Ce rôle donne des droits que vous n'avez pas dans ce salon : demandez au propriétaire d'envoyer l'invitation.",
    );
  }
}

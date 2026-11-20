import { ConflictError } from '../../../../shared/domain/errors.js';

export class RolePermissionsChangedMeanwhileError extends ConflictError {
  override readonly code = 'ROLE_PERMISSIONS_CHANGED_MEANWHILE';

  constructor() {
    super(
      "Les permissions de ce rôle viennent d'être modifiées sur un autre écran. Rechargez pour voir la version à jour, puis recommencez.",
    );
  }
}


import type { SystemRole } from '../../../domain/enums/system-role.enum.js';

export interface RevokeSystemRoleResponse {
  readonly userId: string;
  readonly role: SystemRole;
  readonly revokedAt: string;
}


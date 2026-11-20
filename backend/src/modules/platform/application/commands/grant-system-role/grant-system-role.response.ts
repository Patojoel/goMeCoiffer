import type { SystemRole } from '../../../domain/enums/system-role.enum.js';

export interface GrantSystemRoleResponse {
  readonly userId: string;
  readonly role: SystemRole;
  readonly grantedAt: string;
}


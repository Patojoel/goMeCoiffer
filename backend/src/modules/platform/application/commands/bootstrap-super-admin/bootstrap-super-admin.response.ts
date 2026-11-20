import type { SystemRole } from '../../../domain/enums/system-role.enum.js';

export interface BootstrapSuperAdminResponse {
  readonly userId: string;
  readonly role: typeof SystemRole.SUPER_ADMIN;
  readonly alreadyAssigned: boolean;
  /** Super Administrateurs présents avant la commande ; > 0 pour une nomination = mode secours. */
  readonly existingSuperAdmins: number;
  readonly grantedAt: string;
}


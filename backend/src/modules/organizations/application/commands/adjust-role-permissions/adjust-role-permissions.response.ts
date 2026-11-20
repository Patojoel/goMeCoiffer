import type { InvitableSalonRole } from '../../../domain/enums/invitable-salon-role.enum.js';
import type { AdjustablePermission } from '../../../domain/enums/permission.enum.js';

export interface AdjustRolePermissionsResponse {
  readonly role: InvitableSalonRole;
  readonly permissions: readonly AdjustablePermission[];
  readonly version: number;
}


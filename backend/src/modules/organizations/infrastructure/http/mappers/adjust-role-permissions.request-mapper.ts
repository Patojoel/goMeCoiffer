import type { AdjustableSalonRole, AdjustRolePermissions as AdjustRolePermissionsBody } from '@gomecoiffer/contracts';
import type { Actor } from '../../../../../shared/application/ports.js';
import { AdjustRolePermissions } from '../../../application/commands/adjust-role-permissions/adjust-role-permissions.command.js';
import { activeSalonOf } from './active-salon-of.js';

export const toAdjustRolePermissions = (
  role: AdjustableSalonRole,
  body: AdjustRolePermissionsBody,
  actor: Actor,
): AdjustRolePermissions =>
  new AdjustRolePermissions(
    activeSalonOf(actor),
    actor.userId,
    role,
    body.permissions,
    body.version,
    body.resetToDefault,
  );


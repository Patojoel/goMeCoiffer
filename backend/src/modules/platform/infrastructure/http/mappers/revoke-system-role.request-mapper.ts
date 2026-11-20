import type { SystemRole } from '@gomecoiffer/contracts';
import type { Actor } from '../../../../../shared/application/ports.js';
import { RevokeSystemRole } from '../../../application/commands/revoke-system-role/revoke-system-role.command.js';

export const toRevokeSystemRole = (userId: string, role: SystemRole, actor: Actor) =>
  new RevokeSystemRole(actor.userId, userId, role);


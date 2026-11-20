import type { GrantSystemRole as GrantSystemRoleBody } from '@gomecoiffer/contracts';
import type { Actor } from '../../../../../shared/application/ports.js';
import { GrantSystemRole } from '../../../application/commands/grant-system-role/grant-system-role.command.js';

export const toGrantSystemRole = (body: GrantSystemRoleBody, actor: Actor) =>
  new GrantSystemRole(actor.userId, body.phone, body.role);


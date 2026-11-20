import type { ChangeCollaboratorRole as ChangeCollaboratorRoleBody } from '@gomecoiffer/contracts';
import type { Actor } from '../../../../../shared/application/ports.js';
import { ChangeCollaboratorRole } from '../../../application/commands/change-collaborator-role/change-collaborator-role.command.js';
import { activeSalonOf } from './active-salon-of.js';

export const toChangeCollaboratorRole = (
  membershipId: string,
  body: ChangeCollaboratorRoleBody,
  actor: Actor,
): ChangeCollaboratorRole =>
  new ChangeCollaboratorRole(
    activeSalonOf(actor),
    actor.userId,
    [...actor.permissions],
    membershipId,
    body.role,
    body.version,
  );

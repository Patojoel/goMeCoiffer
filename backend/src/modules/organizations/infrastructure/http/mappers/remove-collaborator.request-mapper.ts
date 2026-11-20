import type { RemoveCollaborator as RemoveCollaboratorBody } from '@gomecoiffer/contracts';
import type { Actor } from '../../../../../shared/application/ports.js';
import { RemoveCollaborator } from '../../../application/commands/remove-collaborator/remove-collaborator.command.js';
import { activeSalonOf } from './active-salon-of.js';

export const toRemoveCollaborator = (
  membershipId: string,
  body: RemoveCollaboratorBody,
  actor: Actor,
): RemoveCollaborator =>
  new RemoveCollaborator(
    activeSalonOf(actor),
    actor.userId,
    [...actor.permissions],
    membershipId,
    body.version,
  );

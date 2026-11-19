import type { InviteCollaborator as InviteCollaboratorBody } from '@gomecoiffer/contracts';
import type { Actor } from '../../../../../shared/application/ports.js';
import { InviteCollaborator } from '../../../application/commands/invite-collaborator/invite-collaborator.command.js';
import { activeSalonOf } from './active-salon-of.js';

/** Salon, auteur et droits viennent de la session (acteur) ; la demande ne porte que nom, numéro et rôle. */
export const toInviteCollaborator = (body: InviteCollaboratorBody, actor: Actor): InviteCollaborator =>
  new InviteCollaborator(
    activeSalonOf(actor),
    actor.userId,
    [...actor.permissions],
    body.name,
    body.phone,
    body.role,
  );

import type { AddSalonToOrganization as AddSalonToOrganizationBody } from '@gomecoiffer/contracts';
import type { Actor } from '../../../../../shared/application/ports.js';
import { AddSalonToOrganization } from '../../../application/commands/add-salon-to-organization/add-salon-to-organization.command.js';

/** L'utilisateur vient de la session (acteur), jamais du corps de la demande. */
export const toAddSalonToOrganization = (
  body: AddSalonToOrganizationBody,
  actor: Pick<Actor, 'userId'>,
): AddSalonToOrganization => new AddSalonToOrganization(actor.userId, body);


import type { CreateOrganization as CreateOrganizationBody } from '@gomecoiffer/contracts';
import type { Actor } from '../../../../../shared/application/ports.js';
import { CreateOrganization } from '../../../application/commands/create-organization/create-organization.command.js';

/** L'utilisateur vient de la session (acteur), jamais du corps de la demande. */
export const toCreateOrganization = (
  body: CreateOrganizationBody,
  actor: Pick<Actor, 'userId'>,
): CreateOrganization => new CreateOrganization(actor.userId, body);

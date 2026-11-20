import type { Actor } from '../../../../../shared/application/ports.js';
import { GetSalonRoles } from '../../../application/queries/get-salon-roles/get-salon-roles.query.js';
import { activeSalonOf } from './active-salon-of.js';

export const toGetSalonRoles = (actor: Actor): GetSalonRoles =>
  new GetSalonRoles(activeSalonOf(actor));


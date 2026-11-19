import type { Actor } from '../../../../../shared/application/ports.js';
import { ListSalonInvitations } from '../../../application/queries/list-salon-invitations/list-salon-invitations.query.js';
import { activeSalonOf } from './active-salon-of.js';

export const toListSalonInvitations = (actor: Actor): ListSalonInvitations =>
  new ListSalonInvitations(activeSalonOf(actor));

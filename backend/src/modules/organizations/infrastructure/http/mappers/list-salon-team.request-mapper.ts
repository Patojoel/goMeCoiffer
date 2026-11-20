import type { Actor } from '../../../../../shared/application/ports.js';
import { ListSalonTeam } from '../../../application/queries/list-salon-team/list-salon-team.query.js';
import { activeSalonOf } from './active-salon-of.js';

export const toListSalonTeam = (actor: Actor): ListSalonTeam =>
  new ListSalonTeam(activeSalonOf(actor), actor.userId);

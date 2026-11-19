import type { SelectActiveSalon as SelectActiveSalonBody } from '@gomecoiffer/contracts';
import type { Actor } from '../../../../../shared/application/ports.js';
import { SelectActiveSalon } from '../../../application/commands/select-active-salon/select-active-salon.command.js';

/** L'utilisateur vient de la session (acteur) ; la demande ne porte que l'identifiant du salon. */
export const toSelectActiveSalon = (
  body: SelectActiveSalonBody,
  actor: Pick<Actor, 'userId'>,
): SelectActiveSalon => new SelectActiveSalon(actor.userId, body.salonId);

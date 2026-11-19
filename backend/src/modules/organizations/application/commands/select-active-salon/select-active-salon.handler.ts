import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ACTOR_RIGHTS, type ActorRights } from '../../../../../shared/application/ports.js';
import { SalonNotFoundError } from '../../../domain/exceptions/salon-not-found.error.js';
import { SelectActiveSalon } from './select-active-salon.command.js';
import type { SelectActiveSalonResponse } from './select-active-salon.response.js';

/**
 * Même décision « peut agir dans ce salon » qu'à chaque requête (`ActorRights`, RG-005-16) : le lot 7 l'enrichira
 * à cet unique endroit. Une seule lecture, donc le même temps de réponse pour inexistant et non-membre.
 */
@CommandHandler(SelectActiveSalon)
export class SelectActiveSalonHandler implements ICommandHandler<SelectActiveSalon> {
  constructor(@Inject(ACTOR_RIGHTS) private readonly rights: ActorRights) {}

  async execute(cmd: SelectActiveSalon): Promise<SelectActiveSalonResponse> {
    const { isMember } = await this.rights.resolve(cmd.userId, cmd.salonId);
    if (!isMember) throw new SalonNotFoundError();
    return { salonId: cmd.salonId };
  }
}

import { Query } from '@nestjs/cqrs';
import type { SalonTeamReadModel } from './list-salon-team.read-model.js';

export class ListSalonTeam extends Query<SalonTeamReadModel> {
  constructor(
    readonly salonId: string,
    readonly actorUserId: string,
  ) {
    super();
  }
}

import { Command } from '@nestjs/cqrs';
import type { SalonDraft } from '../../../domain/aggregates/organization.js';
import type { CreateOrganizationResponse } from './create-organization.response.js';

/** UC-004 : l'utilisateur de la session fonde son organisation et son premier salon. */
export class CreateOrganization extends Command<CreateOrganizationResponse> {
  constructor(
    readonly ownerUserId: string,
    readonly salon: SalonDraft,
  ) {
    super();
  }

  /** Une commande journalisée ne montre ni le téléphone commercial ni le point de repère. */
  toJSON() {
    return { ownerUserId: this.ownerUserId, type: this.salon.type, city: this.salon.city };
  }
}

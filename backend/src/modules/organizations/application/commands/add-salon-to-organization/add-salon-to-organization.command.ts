import { Command } from '@nestjs/cqrs';
import type { SalonDraft } from '../../../domain/aggregates/organization.js';
import type { AddSalonToOrganizationResponse } from './add-salon-to-organization.response.js';

/** UC-010 : le propriétaire de la session ajoute un salon à son organisation existante. */
export class AddSalonToOrganization extends Command<AddSalonToOrganizationResponse> {
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


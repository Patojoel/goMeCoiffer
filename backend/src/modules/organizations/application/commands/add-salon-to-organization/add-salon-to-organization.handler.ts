import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  AUDIT_TRAIL,
  type AuditTrail,
  CLOCK,
  type Clock,
  ID_GENERATOR,
  type IdGenerator,
} from '../../../../../shared/application/ports.js';
import { OrganizationRequiredError } from '../../../domain/exceptions/organization-required.error.js';
import { SalonNameAlreadyExistsError } from '../../../domain/exceptions/salon-name-already-exists.error.js';
import {
  ORGANIZATION_REPOSITORY,
  type OrganizationRepository,
} from '../../../domain/repositories/write/organization.repository.js';
import {
  SALON_MEMBERSHIP_REPOSITORY,
  type SalonMembershipRepository,
} from '../../../domain/repositories/write/salon-membership.repository.js';
import {
  SALON_REPOSITORY,
  type SalonRepository,
} from '../../../domain/repositories/write/salon.repository.js';
import { AddSalonToOrganization } from './add-salon-to-organization.command.js';
import type { AddSalonToOrganizationResponse } from './add-salon-to-organization.response.js';

/** Exception assumée à « un agrégat par transaction » : D-041 et RG-010-15 (jamais de salon sans propriétaire ni rôles). */
@CommandHandler(AddSalonToOrganization)
export class AddSalonToOrganizationHandler implements ICommandHandler<AddSalonToOrganization> {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY) private readonly organizations: OrganizationRepository,
    @Inject(SALON_REPOSITORY) private readonly salons: SalonRepository,
    @Inject(SALON_MEMBERSHIP_REPOSITORY) private readonly memberships: SalonMembershipRepository,
    @Inject(AUDIT_TRAIL) private readonly audit: AuditTrail,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(cmd: AddSalonToOrganization): Promise<AddSalonToOrganizationResponse> {
    const organization = await this.organizations.findByOwner(cmd.ownerUserId);
    if (!organization) throw new OrganizationRequiredError();

    const now = this.clock.now();
    const ids = { salon: this.ids.next(), membership: this.ids.next() };
    const { salon, membership } = organization.addSalon({ salon: cmd.salon, ids, now });

    if (await this.salons.existsWithNameInOrganization(organization.id, salon.name))
      throw new SalonNameAlreadyExistsError();

    await this.salons.add(salon);
    await this.memberships.add(membership);

    const { type, city } = salon.snapshot();
    await this.audit.record({
      action: 'SALON_ADDED',
      subjectType: 'salon',
      subjectId: ids.salon,
      actorUserId: cmd.ownerUserId,
      salonId: ids.salon,
      occurredAt: now,
      details: { organizationId: organization.id, type, city },
    });
    await this.audit.record({
      action: 'SALON_MEMBERSHIP_GRANTED',
      subjectType: 'salon_membership',
      subjectId: ids.membership,
      actorUserId: cmd.ownerUserId,
      salonId: ids.salon,
      occurredAt: now,
      details: { role: 'OWNER' },
    });

    return { organizationId: organization.id, salonId: ids.salon };
  }
}

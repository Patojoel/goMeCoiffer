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
import { Organization } from '../../../domain/aggregates/organization.js';
import {
  OWNER_CANDIDATES,
  type OwnerCandidates,
} from '../../../domain/repositories/read/owner-candidates.read-repository.js';
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
import { CreateOrganization } from './create-organization.command.js';
import type { CreateOrganizationResponse } from './create-organization.response.js';

/** Exception assumée à « un agrégat par transaction » : RG-004-03 et RG-004-16 (docs/domains.md). */
@CommandHandler(CreateOrganization)
export class CreateOrganizationHandler implements ICommandHandler<CreateOrganization> {
  constructor(
    @Inject(OWNER_CANDIDATES) private readonly candidates: OwnerCandidates,
    @Inject(ORGANIZATION_REPOSITORY) private readonly organizations: OrganizationRepository,
    @Inject(SALON_REPOSITORY) private readonly salons: SalonRepository,
    @Inject(SALON_MEMBERSHIP_REPOSITORY) private readonly memberships: SalonMembershipRepository,
    @Inject(AUDIT_TRAIL) private readonly audit: AuditTrail,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(cmd: CreateOrganization): Promise<CreateOrganizationResponse> {
    const now = this.clock.now();
    const ids = { organization: this.ids.next(), salon: this.ids.next(), membership: this.ids.next() };
    const { organization, salon, membership } = Organization.found({
      owner: await this.candidates.of(cmd.ownerUserId),
      salon: cmd.salon,
      ids,
      now,
    });
    await this.organizations.add(organization);
    await this.salons.add(salon);
    await this.memberships.add(membership);

    await this.audit.record({
      action: 'ORGANIZATION_FOUNDED',
      subjectType: 'organization',
      subjectId: ids.organization,
      actorUserId: cmd.ownerUserId,
      salonId: ids.salon,
      occurredAt: now,
      details: { type: cmd.salon.type },
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
    return { organizationId: ids.organization, salonId: ids.salon };
  }
}

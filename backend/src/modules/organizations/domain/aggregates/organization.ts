import { AggregateRoot } from '../../../../shared/domain/aggregate-root.js';
import { OrganizationFounded } from '../events/organization-founded.js';
import { OrganizationAlreadyExistsError } from '../exceptions/organization-already-exists.error.js';
import { OwnerAccountRequiredError } from '../exceptions/owner-account-required.error.js';
import type { OwnerCandidate } from '../value-objects/owner-candidate.js';
import { boundedText } from '../value-objects/bounded-text.js';
import { Salon, type SalonDetails } from './salon.js';
import { SalonMembership } from './salon-membership.js';

interface OrganizationState {
  id: string;
  ownerUserId: string;
  name: string;
  createdAt: Date;
  version: number;
}

export type SalonDraft = SalonDetails;

export interface FoundingIds {
  readonly organization: string;
  readonly salon: string;
  readonly membership: string;
}

export interface FoundedOrganization {
  readonly organization: Organization;
  readonly salon: Salon;
  readonly membership: SalonMembership;
}

export interface AddedSalonIds {
  readonly salon: string;
  readonly membership: string;
}

export interface AddedSalon {
  readonly salon: Salon;
  readonly membership: SalonMembership;
}

/** Propriétaire de salons. Un utilisateur n'en possède qu'une (D-035) ; elle ne naît jamais sans son premier salon. */
export class Organization extends AggregateRoot {
  private constructor(private readonly state: OrganizationState) {
    super();
  }

  /**
   * Les trois agrégats se créent d'un bloc (RG-004-03, RG-004-16) : jamais d'organisation sans salon ni de salon sans
   * propriétaire. Sans nom distinct, l’organisation reprend le nom commercial du premier salon.
   */
  static found(input: {
    owner: OwnerCandidate;
    organizationName?: string;
    salon: SalonDraft;
    ids: FoundingIds;
    now: Date;
  }): FoundedOrganization {
    const { owner, ids, now } = input;
    if (!owner.hasPassword) throw new OwnerAccountRequiredError();
    if (owner.ownsOrganization) throw new OrganizationAlreadyExistsError();

    const salon = Salon.register({
      id: ids.salon,
      organizationId: ids.organization,
      details: input.salon,
      now,
    });
    const organization = new Organization({
      id: ids.organization,
      ownerUserId: owner.userId,
      name: input.organizationName === undefined ? salon.name : boundedText(
        input.organizationName, 2, 60, 'Le nom de l’organisation doit compter de 2 à 60 caractères.',
      ),
      createdAt: now,
      version: 0,
    });
    organization.record(new OrganizationFounded(ids.organization, owner.userId, now));
    const membership = SalonMembership.grantOwnership({
      id: ids.membership,
      salonId: ids.salon,
      userId: owner.userId,
      now,
    });
    return { organization, salon, membership };
  }

  static restore(state: Readonly<OrganizationState>): Organization {
    return new Organization({ ...state });
  }

  /** Ajoute un salon vide non publié à l'organisation avec son appartenance Propriétaire (D-041, D-056). */
  addSalon(input: { salon: SalonDraft; ids: AddedSalonIds; now: Date }): AddedSalon {
    const salon = Salon.register({
      id: input.ids.salon,
      organizationId: this.state.id,
      details: input.salon,
      now: input.now,
    });
    const membership = SalonMembership.grantOwnership({
      id: input.ids.membership,
      salonId: input.ids.salon,
      userId: this.state.ownerUserId,
      now: input.now,
    });
    return { salon, membership };
  }

  get id(): string {
    return this.state.id;
  }

  snapshot(): Readonly<OrganizationState> {
    return { ...this.state };
  }
}

import { AggregateRoot } from '../../../../shared/domain/aggregate-root.js';
import { MembershipStatus } from '../enums/membership-status.enum.js';
import { SalonRole } from '../enums/salon-role.enum.js';
import { OwnerRoleReservedError } from '../exceptions/owner-role-reserved.error.js';

interface SalonMembershipState {
  id: string;
  salonId: string;
  userId: string;
  role: SalonRole;
  status: MembershipStatus;
  grantedAt: Date;
  version: number;
}

/** Appartenance d'un utilisateur à un salon avec un rôle ; les droits se lisent par salon, jamais par organisation. */
export class SalonMembership extends AggregateRoot {
  private constructor(private readonly state: SalonMembershipState) {
    super();
  }

  static grantOwnership(input: { id: string; salonId: string; userId: string; now: Date }): SalonMembership {
    return new SalonMembership({
      id: input.id,
      salonId: input.salonId,
      userId: input.userId,
      role: SalonRole.OWNER,
      status: MembershipStatus.ACTIVE,
      grantedAt: input.now,
      version: 0,
    });
  }

  /** Collaborateur d'un salon : tout rôle prédéfini sauf Owner, réservé à la fondation (droits protégés). */
  static grantCollaboratorRole(input: {
    id: string;
    salonId: string;
    userId: string;
    role: SalonRole;
    now: Date;
  }): SalonMembership {
    if (input.role === SalonRole.OWNER) throw new OwnerRoleReservedError();
    return new SalonMembership({
      id: input.id,
      salonId: input.salonId,
      userId: input.userId,
      role: input.role,
      status: MembershipStatus.ACTIVE,
      grantedAt: input.now,
      version: 0,
    });
  }

  static restore(state: Readonly<SalonMembershipState>): SalonMembership {
    return new SalonMembership({ ...state });
  }

  snapshot(): Readonly<SalonMembershipState> {
    return { ...this.state };
  }
}

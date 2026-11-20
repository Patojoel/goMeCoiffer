import { AggregateRoot } from '../../../../shared/domain/aggregate-root.js';
import { MembershipStatus } from '../enums/membership-status.enum.js';
import { SalonRole } from '../enums/salon-role.enum.js';
import { CollaboratorReinstated } from '../events/collaborator-reinstated.js';
import { CollaboratorRemoved } from '../events/collaborator-removed.js';
import { CollaboratorRoleChanged } from '../events/collaborator-role-changed.js';
import { AlreadySalonMemberError } from '../exceptions/already-salon-member.error.js';
import { MembershipAlreadyRevokedError } from '../exceptions/membership-already-revoked.error.js';
import { OwnerMembershipProtectedError } from '../exceptions/owner-membership-protected.error.js';
import { OwnerRoleReservedError } from '../exceptions/owner-role-reserved.error.js';
import { TeamMemberChangedMeanwhileError } from '../exceptions/team-member-changed-meanwhile.error.js';

export type SalonMembershipStatus = MembershipStatus | 'REVOKED';

interface SalonMembershipState {
  id: string;
  salonId: string;
  userId: string;
  role: SalonRole;
  status: SalonMembershipStatus;
  grantedAt: Date;
  revokedAt?: Date | null;
  revokedByUserId?: string | null;
  reinstatedAt?: Date | null;
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
      revokedAt: null,
      revokedByUserId: null,
      reinstatedAt: null,
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
      revokedAt: null,
      revokedByUserId: null,
      reinstatedAt: null,
      version: 0,
    });
  }

  static restore(state: Readonly<SalonMembershipState>): SalonMembership {
    return new SalonMembership({
      ...state,
      revokedAt: state.revokedAt ?? null,
      revokedByUserId: state.revokedByUserId ?? null,
      reinstatedAt: state.reinstatedAt ?? null,
    });
  }

  get id(): string {
    return this.state.id;
  }

  get salonId(): string {
    return this.state.salonId;
  }

  get userId(): string {
    return this.state.userId;
  }

  get role(): SalonRole {
    return this.state.role;
  }

  get status(): SalonMembershipStatus {
    return this.state.status;
  }

  get version(): number {
    return this.state.version;
  }

  get isOwner(): boolean {
    return this.state.role === SalonRole.OWNER;
  }

  get isRevoked(): boolean {
    return this.state.status === 'REVOKED';
  }

  changeRole(input: {
    newRole: SalonRole;
    expectedVersion: number;
    actorUserId: string;
    now: Date;
  }): { changed: boolean; previousRole: SalonRole; newRole: SalonRole } {
    if (this.state.status === 'REVOKED') throw new MembershipAlreadyRevokedError();
    if (this.state.role === SalonRole.OWNER) throw new OwnerMembershipProtectedError();
    if (input.newRole === SalonRole.OWNER) throw new OwnerRoleReservedError();
    if (input.expectedVersion !== this.state.version) throw new TeamMemberChangedMeanwhileError();

    const previousRole = this.state.role;
    if (input.newRole === previousRole) {
      return { changed: false, previousRole, newRole: input.newRole };
    }

    this.state.role = input.newRole;
    this.record(
      new CollaboratorRoleChanged(
        this.state.id,
        this.state.salonId,
        this.state.userId,
        previousRole,
        input.newRole,
        input.actorUserId,
        input.now,
      ),
    );
    return { changed: true, previousRole, newRole: input.newRole };
  }

  revoke(input: { expectedVersion: number; actorUserId: string; now: Date }): void {
    if (this.state.role === SalonRole.OWNER) throw new OwnerMembershipProtectedError();
    if (this.state.status === 'REVOKED') throw new MembershipAlreadyRevokedError();
    if (input.expectedVersion !== this.state.version) throw new TeamMemberChangedMeanwhileError();

    this.state.status = 'REVOKED';
    this.state.revokedAt = input.now;
    this.state.revokedByUserId = input.actorUserId;
    this.record(
      new CollaboratorRemoved(
        this.state.id,
        this.state.salonId,
        this.state.userId,
        this.state.role,
        input.actorUserId,
        input.now,
      ),
    );
  }

  reinstate(input: { role: SalonRole; now: Date }): void {
    if (this.state.status === MembershipStatus.ACTIVE) throw AlreadySalonMemberError.ofInvitee();
    if (input.role === SalonRole.OWNER) throw new OwnerRoleReservedError();

    this.state.status = MembershipStatus.ACTIVE;
    this.state.role = input.role;
    this.state.revokedAt = null;
    this.state.revokedByUserId = null;
    this.state.reinstatedAt = input.now;
    this.record(
      new CollaboratorReinstated(
        this.state.id,
        this.state.salonId,
        this.state.userId,
        input.role,
        input.now,
      ),
    );
  }

  markPersisted(): void {
    this.state.version += 1;
  }

  snapshot(): Readonly<SalonMembershipState> {
    return { ...this.state };
  }
}

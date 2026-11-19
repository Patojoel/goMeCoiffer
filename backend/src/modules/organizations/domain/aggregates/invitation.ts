import { AggregateRoot } from '../../../../shared/domain/aggregate-root.js';
import { InvalidValueError } from '../../../../shared/domain/errors.js';
import { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import { INVITABLE_SALON_ROLES } from '../enums/invitable-salon-role.enum.js';
import { InvitationStatus } from '../enums/invitation-status.enum.js';
import { SalonRole } from '../enums/salon-role.enum.js';
import { CollaboratorInvited } from '../events/collaborator-invited.js';
import { InvitationCancelled } from '../events/invitation-cancelled.js';
import { InvitationNoLongerPendingError } from '../exceptions/invitation-no-longer-pending.error.js';
import { OwnerRoleNotInvitableError } from '../exceptions/owner-role-not-invitable.error.js';
import { InviteeName } from '../value-objects/invitee-name.js';

export const INVITATION_VALIDITY_DAYS = 7;
const DAY_MS = 86_400_000;

interface InvitationState {
  id: string;
  salonId: string;
  /** Effacés après la conservation prévue pour une invitation non acceptée (RG-006-17). */
  name: string | null;
  phone: string | null;
  role: SalonRole;
  invitedByUserId: string;
  sentAt: Date;
  expiresAt: Date;
  status: InvitationStatus;
  endedAt: Date | null;
  /** Un SMS d'information a été décidé à l'envoi : sert à limiter les SMS par numéro. */
  notifiedBySms: boolean;
  version: number;
}

interface InvitationStatusBehavior {
  isPendingAt(state: Readonly<InvitationState>, now: Date): boolean;
  expireIfDue(state: InvitationState, now: Date): boolean;
  cancel(state: InvitationState, now: Date): void;
}

const terminalInvitationStatus: InvitationStatusBehavior = {
  isPendingAt: () => false,
  expireIfDue: () => false,
  cancel: () => {
    throw new InvitationNoLongerPendingError();
  },
};

const INVITATION_STATUS_BEHAVIORS: Record<InvitationStatus, InvitationStatusBehavior> = {
  PENDING: {
    isPendingAt: (state, now) => now < state.expiresAt,
    expireIfDue(state, now) {
      if (now < state.expiresAt) return false;
      state.status = InvitationStatus.EXPIRED;
      state.endedAt = state.expiresAt;
      return true;
    },
    cancel(state, now) {
      if (now >= state.expiresAt) throw new InvitationNoLongerPendingError();
      state.status = InvitationStatus.CANCELLED;
      state.endedAt = now;
    },
  },
  ACCEPTED: terminalInvitationStatus,
  CANCELLED: terminalInvitationStatus,
  EXPIRED: terminalInvitationStatus,
};

/** Invitation d'une personne à rejoindre un salon avec un rôle ; elle ne donne aucun accès (l'acceptation est UC-007). */
export class Invitation extends AggregateRoot {
  private constructor(private readonly state: InvitationState) {
    super();
  }

  private get behavior(): InvitationStatusBehavior {
    return INVITATION_STATUS_BEHAVIORS[this.state.status];
  }

  static issue(input: {
    id: string;
    salonId: string;
    invitedByUserId: string;
    name: string;
    phone: string;
    role: string;
    notifyBySms: boolean;
    now: Date;
  }): Invitation {
    const role = Invitation.collaboratorRole(input.role);
    const invitation = new Invitation({
      id: input.id,
      salonId: input.salonId,
      name: InviteeName.create(input.name).value,
      phone: PhoneNumber.parse(input.phone).value,
      role,
      invitedByUserId: input.invitedByUserId,
      sentAt: input.now,
      expiresAt: new Date(input.now.getTime() + INVITATION_VALIDITY_DAYS * DAY_MS),
      status: InvitationStatus.PENDING,
      endedAt: null,
      notifiedBySms: input.notifyBySms,
      version: 0,
    });
    invitation.record(
      new CollaboratorInvited(input.id, input.salonId, role, input.invitedByUserId, input.now),
    );
    return invitation;
  }

  private static collaboratorRole(raw: string): SalonRole {
    if (raw === SalonRole.OWNER) throw new OwnerRoleNotInvitableError();
    const role = INVITABLE_SALON_ROLES.find((allowed) => allowed === raw);
    if (!role)
      throw new InvalidValueError("Ce rôle n'existe pas : choisissez l'un des quatre rôles proposés.");
    return role;
  }

  static restore(state: Readonly<InvitationState>): Invitation {
    return new Invitation({ ...state });
  }

  get id(): string {
    return this.state.id;
  }

  get role(): SalonRole {
    return this.state.role;
  }

  /** En attente tant que l'échéance n'est pas atteinte : à l'instant exact de l'échéance, elle est expirée. */
  isPendingAt(now: Date): boolean {
    return this.behavior.isPendingAt(this.state, now);
  }

  /** Constate l'expiration d'une invitation échue ; `true` si l'état a changé. */
  expireIfDue(now: Date): boolean {
    return this.behavior.expireIfDue(this.state, now);
  }

  cancel(cancelledByUserId: string, now: Date): void {
    this.behavior.cancel(this.state, now);
    this.record(new InvitationCancelled(this.state.id, this.state.salonId, cancelledByUserId, now));
  }

  snapshot(): Readonly<InvitationState> {
    return { ...this.state };
  }
}

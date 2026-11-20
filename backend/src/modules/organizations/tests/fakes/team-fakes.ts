import type {
  AuditEntry,
  AuditTrail,
  RealtimeMessage,
  RealtimePublisher,
} from '../../../../shared/application/ports.js';
import type { DomainEvent } from '../../../../shared/domain/domain-event.js';
import { SalonMembership } from '../../domain/aggregates/salon-membership.js';
import type { InvitableSalonRole } from '../../domain/enums/invitable-salon-role.enum.js';
import { ADJUSTABLE_SALON_ROLES, type AdjustablePermission } from '../../domain/enums/permission.enum.js';
import { AlreadySalonMemberError } from '../../domain/exceptions/already-salon-member.error.js';
import { TeamMemberChangedMeanwhileError } from '../../domain/exceptions/team-member-changed-meanwhile.error.js';
import type { SalonRolePermissions } from '../../domain/repositories/read/salon-role-permissions.read-repository.js';
import type { SalonMembershipRepository } from '../../domain/repositories/write/salon-membership.repository.js';
import { defaultPermissionsOf } from '../../domain/value-objects/role-permission-set.js';
import type { FakeAfterCommit } from './invitation-fakes.js';

type MembershipRow = ReturnType<SalonMembership['snapshot']>;

export class InMemoryTeamMembershipRepository implements Required<SalonMembershipRepository> {
  readonly rows = new Map<string, MembershipRow>();
  readonly dispatchedEvents: DomainEvent[] = [];
  saveFailure: Error | null = null;

  seed(membership: SalonMembership): this {
    const row = membership.snapshot();
    this.rows.set(row.id, { ...row });
    return this;
  }

  async add(membership: SalonMembership): Promise<void> {
    const row = membership.snapshot();
    for (const existing of this.rows.values()) {
      if (existing.salonId === row.salonId && existing.userId === row.userId) {
        throw AlreadySalonMemberError.ofInvitee();
      }
    }
    this.rows.set(row.id, { ...row, version: 1 });
    this.dispatchedEvents.push(...membership.pullEvents());
  }

  async findByIdInSalon(salonId: string, membershipId: string): Promise<SalonMembership | null> {
    const row = this.rows.get(membershipId);
    if (!row || row.salonId !== salonId) return null;
    return SalonMembership.restore(row);
  }

  async findBySalonAndUser(salonId: string, userId: string): Promise<SalonMembership | null> {
    for (const row of this.rows.values()) {
      if (row.salonId === salonId && row.userId === userId) {
        return SalonMembership.restore(row);
      }
    }
    return null;
  }

  async save(membership: SalonMembership): Promise<void> {
    if (this.saveFailure) {
      const error = this.saveFailure;
      this.saveFailure = null;
      throw error;
    }
    const row = membership.snapshot();
    const current = this.rows.get(row.id);
    if (!current || current.salonId !== row.salonId || current.version !== row.version) {
      throw new TeamMemberChangedMeanwhileError();
    }
    this.rows.set(row.id, { ...row, version: row.version + 1 });
    membership.markPersisted();
    this.dispatchedEvents.push(...membership.pullEvents());
  }
}

export class InMemoryTeamRolePermissions implements SalonRolePermissions {
  private readonly rows = new Map<string, readonly string[]>();

  withDefaultsForSalon(salonId: string): this {
    for (const role of ADJUSTABLE_SALON_ROLES) {
      this.rows.set(`${salonId}:${role}`, [...defaultPermissionsOf(role)]);
    }
    return this;
  }

  withRolePermissions(
    salonId: string,
    role: InvitableSalonRole,
    permissions: readonly AdjustablePermission[],
  ): this {
    this.rows.set(`${salonId}:${role}`, [...permissions]);
    return this;
  }

  withoutRole(salonId: string, role: InvitableSalonRole): this {
    this.rows.delete(`${salonId}:${role}`);
    return this;
  }

  async permissionsOfRoleInSalon(
    salonId: string,
    role: InvitableSalonRole,
  ): Promise<readonly string[] | null> {
    const found = this.rows.get(`${salonId}:${role}`);
    return found ? [...found] : null;
  }
}

export class InMemoryTeamAuditTrail implements AuditTrail {
  readonly entries: AuditEntry[] = [];

  async record(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);
  }
}

export class InMemoryTeamRealtimePublisher implements RealtimePublisher {
  readonly salonMessages: Array<{ salonId: string; message: RealtimeMessage }> = [];
  readonly closedUserSalonStreams: Array<{ userId: string; salonId: string }> = [];
  outage = false;

  constructor(private readonly afterCommit?: FakeAfterCommit) {}

  publishToUser(_userId: string, _message: RealtimeMessage): void {}

  publishToSalon(salonId: string, message: RealtimeMessage): void {
    const send = () => {
      if (this.outage) throw new Error('Realtime stream unavailable');
      this.salonMessages.push({ salonId, message });
    };
    if (this.afterCommit) this.afterCommit.register(send);
    else send();
  }

  closeStreamsOfUser(_userId: string): void {}
  closeStreamsOfSession(_sessionId: string): void {}

  closeUserStreamsInSalon(userId: string, salonId: string): void {
    const close = () => {
      if (this.outage) throw new Error('Realtime stream unavailable');
      this.closedUserSalonStreams.push({ userId, salonId });
    };
    if (this.afterCommit) this.afterCommit.register(close);
    else close();
  }
}

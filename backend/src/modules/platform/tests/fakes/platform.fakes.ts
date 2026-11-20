import type { AuditEntry, AuditTrail, RealtimeMessage, RealtimePublisher } from '../../../../shared/application/ports.js';
import type { DomainEvent } from '../../../../shared/domain/domain-event.js';
import type { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import { type AssignedSystemRole, PlatformAdmin } from '../../domain/aggregates/platform-admin.js';
import { SystemRole } from '../../domain/enums/system-role.enum.js';
import { SystemRoleAlreadyGrantedError } from '../../domain/exceptions/system-role-already-granted.error.js';
import type { StaffAccountLookup, StaffAccountMatch } from '../../domain/ports/staff-account-lookup.port.js';
import type { UserSessionsRevoker } from '../../domain/ports/user-sessions-revoker.port.js';
import type { PlatformAdminRepository } from '../../domain/repositories/write/platform-admin.repository.js';

export class InMemoryPlatformAdminRepository implements PlatformAdminRepository {
  private readonly rows = new Map<string, Map<SystemRole, AssignedSystemRole>>();
  readonly dispatchedEvents: DomainEvent[] = [];
  superAdminLockCount = 0;

  seed(userId: string, role: SystemRole, grantedAt: Date, grantedByUserId: string | null = null): void {
    const userRoles = this.rows.get(userId) ?? new Map<SystemRole, AssignedSystemRole>();
    userRoles.set(role, { role, grantedAt, grantedByUserId });
    this.rows.set(userId, userRoles);
  }

  /** Simule le retrait d'un rôle entre le garde HTTP et la transaction de la commande. */
  revokeAll(userId: string, role: SystemRole): void {
    this.rows.get(userId)?.delete(role);
  }

  rolesOf(userId: string): readonly AssignedSystemRole[] {
    return [...(this.rows.get(userId)?.values() ?? [])];
  }

  async loadForUser(userId: string): Promise<PlatformAdmin> {
    return PlatformAdmin.restore({
      userId,
      roles: this.rolesOf(userId),
    });
  }

  async lockSuperAdminChanges(): Promise<void> {
    this.superAdminLockCount += 1;
  }

  async countSuperAdmins(): Promise<number> {
    let count = 0;
    for (const roles of this.rows.values()) {
      if (roles.has(SystemRole.SUPER_ADMIN)) count += 1;
    }
    return count;
  }

  async save(admin: PlatformAdmin): Promise<void> {
    const { userId, addedRoles, removedRoles } = admin.snapshot();
    const userRoles = this.rows.get(userId) ?? new Map<SystemRole, AssignedSystemRole>();
    for (const added of addedRoles) {
      if (userRoles.has(added.role)) throw new SystemRoleAlreadyGrantedError();
      userRoles.set(added.role, added);
    }
    for (const removed of removedRoles) {
      userRoles.delete(removed);
    }
    if (userRoles.size === 0) this.rows.delete(userId);
    else this.rows.set(userId, userRoles);
    admin.markPersisted();
    this.dispatchedEvents.push(...admin.pullEvents());
  }
}

export class InMemoryStaffAccountLookup implements StaffAccountLookup {
  private readonly byPhone = new Map<string, StaffAccountMatch>();

  register(phone: PhoneNumber, account: StaffAccountMatch): void {
    this.byPhone.set(phone.value, account);
  }

  async findByPhone(phone: PhoneNumber): Promise<StaffAccountMatch | null> {
    return this.byPhone.get(phone.value) ?? null;
  }
}

export class InMemoryUserSessionsRevoker implements UserSessionsRevoker {
  readonly revokedUserIds: string[] = [];

  async revokeAllSessionsOf(userId: string): Promise<void> {
    this.revokedUserIds.push(userId);
  }
}

export class InMemoryAuditTrail implements AuditTrail {
  readonly entries: AuditEntry[] = [];

  async record(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);
  }
}

export class InMemoryRealtimePublisher implements RealtimePublisher {
  readonly closedUsers: string[] = [];
  failOnClose = false;

  publishToUser(_userId: string, _message: RealtimeMessage): void {}
  publishToSalon(_salonId: string, _message: RealtimeMessage): void {}
  closeStreamsOfSession(_sessionId: string): void {}
  closeUserStreamsInSalon(_userId: string, _salonId: string): void {}

  closeStreamsOfUser(userId: string): void {
    if (this.failOnClose) throw new Error('realtime down');
    this.closedUsers.push(userId);
  }
}


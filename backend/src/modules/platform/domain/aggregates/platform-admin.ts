import { AggregateRoot } from '../../../../shared/domain/aggregate-root.js';
import type { SystemRole } from '../enums/system-role.enum.js';
import { SystemRoleGranted } from '../events/system-role-granted.js';
import { SystemRoleRevoked } from '../events/system-role-revoked.js';
import { SystemRoleAlreadyGrantedError } from '../exceptions/system-role-already-granted.error.js';
import { SystemRoleNotAssignedError } from '../exceptions/system-role-not-assigned.error.js';

export interface AssignedSystemRole {
  readonly role: SystemRole;
  readonly grantedAt: Date;
  readonly grantedByUserId: string | null;
}

export interface PlatformAdminSnapshot {
  readonly userId: string;
  readonly roles: readonly AssignedSystemRole[];
  readonly addedRoles: readonly AssignedSystemRole[];
  readonly removedRoles: readonly SystemRole[];
}

/**
 * Rôles système portés par un utilisateur sur la plateforme GoMeCoiffer (PRD §4, D-058).
 * Strictement séparé des appartenances et permissions salon.
 */
export class PlatformAdmin extends AggregateRoot {
  private readonly assigned: Map<SystemRole, AssignedSystemRole>;
  private readonly added: Map<SystemRole, AssignedSystemRole> = new Map();
  private readonly removed: Set<SystemRole> = new Set();

  private constructor(
    readonly userId: string,
    roles: readonly AssignedSystemRole[],
  ) {
    super();
    this.assigned = new Map(roles.map((entry) => [entry.role, entry]));
  }

  static restore(input: { userId: string; roles: readonly AssignedSystemRole[] }): PlatformAdmin {
    return new PlatformAdmin(input.userId, input.roles);
  }

  get roles(): readonly AssignedSystemRole[] {
    return [...this.assigned.values()];
  }

  hasRole(role: SystemRole): boolean {
    return this.assigned.has(role);
  }

  grantRole(input: { role: SystemRole; actorUserId: string | null; now: Date }): void {
    if (this.assigned.has(input.role)) throw new SystemRoleAlreadyGrantedError();
    const entry: AssignedSystemRole = {
      role: input.role,
      grantedAt: input.now,
      grantedByUserId: input.actorUserId,
    };
    this.assigned.set(input.role, entry);
    this.removed.delete(input.role);
    this.added.set(input.role, entry);
    this.record(new SystemRoleGranted(this.userId, input.role, input.actorUserId, input.now));
  }

  revokeRole(input: { role: SystemRole; actorUserId: string; now: Date }): void {
    if (!this.assigned.has(input.role)) throw new SystemRoleNotAssignedError();
    this.assigned.delete(input.role);
    this.added.delete(input.role);
    this.removed.add(input.role);
    this.record(new SystemRoleRevoked(this.userId, input.role, input.actorUserId, input.now));
  }

  markPersisted(): void {
    this.added.clear();
    this.removed.clear();
  }

  snapshot(): PlatformAdminSnapshot {
    return {
      userId: this.userId,
      roles: [...this.assigned.values()],
      addedRoles: [...this.added.values()],
      removedRoles: [...this.removed.values()],
    };
  }
}


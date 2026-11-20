import type {
  AuditEntry,
  AuditTrail,
  RealtimeMessage,
  RealtimePublisher,
} from '../../../../shared/application/ports.js';
import type { DomainEvent } from '../../../../shared/domain/domain-event.js';
import { NotFoundError } from '../../../../shared/domain/errors.js';
import { Organization } from '../../domain/aggregates/organization.js';
import { RolePermissions, type RolePermissionsState } from '../../domain/aggregates/role-permissions.js';
import type { SalonMembership } from '../../domain/aggregates/salon-membership.js';
import type { Salon } from '../../domain/aggregates/salon.js';
import type { InvitableSalonRole } from '../../domain/enums/invitable-salon-role.enum.js';
import { ADJUSTABLE_SALON_ROLES, type AdjustablePermission } from '../../domain/enums/permission.enum.js';
import { AlreadySalonMemberError } from '../../domain/exceptions/already-salon-member.error.js';
import { OrganizationAlreadyExistsError } from '../../domain/exceptions/organization-already-exists.error.js';
import { RolePermissionsChangedMeanwhileError } from '../../domain/exceptions/role-permissions-changed-meanwhile.error.js';
import { SalonNameAlreadyExistsError } from '../../domain/exceptions/salon-name-already-exists.error.js';
import type { OwnerCandidates } from '../../domain/repositories/read/owner-candidates.read-repository.js';
import type { SalonRolePermissions } from '../../domain/repositories/read/salon-role-permissions.read-repository.js';
import type { OrganizationRepository } from '../../domain/repositories/write/organization.repository.js';
import type { RolePermissionsRepository } from '../../domain/repositories/write/role-permissions.repository.js';
import type { SalonMembershipRepository } from '../../domain/repositories/write/salon-membership.repository.js';
import type { SalonRepository } from '../../domain/repositories/write/salon.repository.js';
import type { OwnerCandidate } from '../../domain/value-objects/owner-candidate.js';
import type { FakeAfterCommit } from './invitation-fakes.js';

type OrganizationRow = ReturnType<Organization['snapshot']>;
type SalonRow = ReturnType<Salon['snapshot']>;
type MembershipRow = ReturnType<SalonMembership['snapshot']>;

/** Comme la base : un seul propriétaire par organisation. */
export class InMemoryOrganizationRepository implements OrganizationRepository {
  readonly rows: OrganizationRow[] = [];

  async add(organization: Organization): Promise<void> {
    const row = organization.snapshot();
    if (this.rows.some((r) => r.ownerUserId === row.ownerUserId)) throw new OrganizationAlreadyExistsError();
    this.rows.push(row);
  }

  async findByOwner(ownerUserId: string): Promise<Organization | null> {
    const row = this.rows.find((r) => r.ownerUserId === ownerUserId);
    return row ? Organization.restore(row) : null;
  }
}

export class InMemorySalonRepository implements SalonRepository {
  readonly rows: SalonRow[] = [];
  readonly events: DomainEvent[] = [];

  async add(salon: Salon): Promise<void> {
    const row = salon.snapshot();
    if (await this.existsWithNameInOrganization(row.organizationId, row.name))
      throw new SalonNameAlreadyExistsError();
    this.rows.push(row);
    this.events.push(...salon.pullEvents());
  }

  async existsWithNameInOrganization(organizationId: string, name: string): Promise<boolean> {
    const lower = name.toLowerCase();
    return this.rows.some((r) => r.organizationId === organizationId && r.name.toLowerCase() === lower);
  }
}

export class InMemorySalonMembershipRepository implements SalonMembershipRepository {
  readonly rows: MembershipRow[] = [];

  /** Comme la base : une seule appartenance par couple (salon, compte). */
  async add(membership: SalonMembership): Promise<void> {
    const row = membership.snapshot();
    if (this.rows.some((r) => r.salonId === row.salonId && r.userId === row.userId))
      throw new AlreadySalonMemberError();
    this.rows.push(row);
  }

  ofUser(userId: string): MembershipRow[] {
    return this.rows.filter((r) => r.userId === userId);
  }
}

/** Les comptes connus du test ; la possession d'une organisation se lit dans le repository d'organisations. */
export class InMemoryOwnerCandidates implements OwnerCandidates {
  private readonly accounts = new Map<string, { hasPassword: boolean }>();

  constructor(private readonly organizations: InMemoryOrganizationRepository) {}

  withAccount(userId: string, hasPassword = true): this {
    this.accounts.set(userId, { hasPassword });
    return this;
  }

  async of(userId: string): Promise<OwnerCandidate> {
    const account = this.accounts.get(userId);
    if (!account) throw new NotFoundError('Compte introuvable.');
    return {
      userId,
      hasPassword: account.hasPassword,
      ownsOrganization: this.organizations.rows.some((r) => r.ownerUserId === userId),
    };
  }
}

export class InMemoryAuditTrail implements AuditTrail {
  readonly entries: AuditEntry[] = [];

  async record(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);
  }
}

export class InMemoryRolePermissionsRepository implements RolePermissionsRepository {
  readonly rows = new Map<string, RolePermissionsState>();

  private key(salonId: string, role: string): string {
    return `${salonId}:${role}`;
  }

  withDefaultsForSalon(salonId: string, now = new Date('2026-11-20T09:00:00.000Z')): this {
    for (const role of ADJUSTABLE_SALON_ROLES) {
      const setting = RolePermissions.initializeDefaultForSalon({ salonId, role, now });
      this.rows.set(this.key(salonId, role), { ...setting.snapshot(), version: 1 });
    }
    return this;
  }

  withRolePermissions(
    salonId: string,
    role: InvitableSalonRole,
    permissions: readonly AdjustablePermission[],
    version = 1,
    now = new Date('2026-11-20T09:00:00.000Z'),
  ): this {
    this.rows.set(this.key(salonId, role), {
      salonId,
      role,
      permissions: [...permissions],
      version,
      updatedAt: now,
      updatedBy: null,
    });
    return this;
  }

  async getOfSalon(salonId: string, role: InvitableSalonRole): Promise<RolePermissions> {
    const row = this.rows.get(this.key(salonId, role));
    if (!row) throw new NotFoundError('Réglage de permissions introuvable.');
    return RolePermissions.restore(row);
  }

  async initializeDefaultsIfAbsent(defaults: readonly RolePermissions[]): Promise<void> {
    for (const setting of defaults) {
      const row = setting.snapshot();
      const key = this.key(row.salonId, row.role);
      if (!this.rows.has(key)) {
        this.rows.set(key, { ...row, version: 1 });
      }
      setting.pullEvents();
    }
  }

  async save(rolePermissions: RolePermissions): Promise<void> {
    const row = rolePermissions.snapshot();
    const key = this.key(row.salonId, row.role);
    if (rolePermissions.isNew) {
      this.rows.set(key, { ...row, version: 1 });
    } else {
      const current = this.rows.get(key);
      if (!current || current.version !== row.version) {
        throw new RolePermissionsChangedMeanwhileError();
      }
      this.rows.set(key, { ...row, version: row.version + 1 });
    }
    rolePermissions.markPersisted();
    rolePermissions.pullEvents();
  }

  ofSalon(salonId: string): RolePermissionsState[] {
    return [...this.rows.values()].filter((r) => r.salonId === salonId);
  }
}

export class InMemorySalonRolePermissions implements SalonRolePermissions {
  constructor(
    private readonly repository: InMemoryRolePermissionsRepository = new InMemoryRolePermissionsRepository(),
  ) {}

  withDefaultsForSalon(salonId: string, now?: Date): this {
    this.repository.withDefaultsForSalon(salonId, now);
    return this;
  }

  withRolePermissions(
    salonId: string,
    role: InvitableSalonRole,
    permissions: readonly AdjustablePermission[],
    version = 1,
    now?: Date,
  ): this {
    this.repository.withRolePermissions(salonId, role, permissions, version, now);
    return this;
  }

  async permissionsOfRoleInSalon(
    salonId: string,
    role: InvitableSalonRole,
  ): Promise<readonly string[] | null> {
    const row = this.repository.rows.get(`${salonId}:${role}`);
    return row ? [...row.permissions] : null;
  }
}

export class InMemoryRealtimePublisher implements RealtimePublisher {
  readonly salonMessages: Array<{ salonId: string; message: RealtimeMessage }> = [];
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

  readonly closedUserSalonStreams: Array<{ userId: string; salonId: string }> = [];

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

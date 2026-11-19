import type { AuditEntry, AuditTrail } from '../../../../shared/application/ports.js';
import { NotFoundError } from '../../../../shared/domain/errors.js';
import type { Organization } from '../../domain/aggregates/organization.js';
import type { SalonMembership } from '../../domain/aggregates/salon-membership.js';
import type { Salon } from '../../domain/aggregates/salon.js';
import { OrganizationAlreadyExistsError } from '../../domain/exceptions/organization-already-exists.error.js';
import type { OwnerCandidates } from '../../domain/repositories/read/owner-candidates.read-repository.js';
import type { OrganizationRepository } from '../../domain/repositories/write/organization.repository.js';
import type { SalonMembershipRepository } from '../../domain/repositories/write/salon-membership.repository.js';
import type { SalonRepository } from '../../domain/repositories/write/salon.repository.js';
import type { OwnerCandidate } from '../../domain/value-objects/owner-candidate.js';

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
}

export class InMemorySalonRepository implements SalonRepository {
  readonly rows: SalonRow[] = [];

  async add(salon: Salon): Promise<void> {
    this.rows.push(salon.snapshot());
  }
}

export class InMemorySalonMembershipRepository implements SalonMembershipRepository {
  readonly rows: MembershipRow[] = [];

  async add(membership: SalonMembership): Promise<void> {
    this.rows.push(membership.snapshot());
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

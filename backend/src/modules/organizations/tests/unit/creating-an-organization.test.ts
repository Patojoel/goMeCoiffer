import { beforeEach, describe, expect, it } from 'vitest';
import { NotFoundError } from '../../../../shared/domain/errors.js';
import { FixedClock, SequentialIdGenerator } from '../../../../test-support/fakes.js';
import { CreateOrganization } from '../../application/commands/create-organization/create-organization.command.js';
import { CreateOrganizationHandler } from '../../application/commands/create-organization/create-organization.handler.js';
import { OrganizationAlreadyExistsError } from '../../domain/exceptions/organization-already-exists.error.js';
import { OwnerAccountRequiredError } from '../../domain/exceptions/owner-account-required.error.js';
import { aSalonDraft, CLARISSE_ID, MIREILLE_ID, PAUL_ID } from '../builders/organization-builders.js';
import {
  InMemoryAuditTrail,
  InMemoryOrganizationRepository,
  InMemoryOwnerCandidates,
  InMemorySalonMembershipRepository,
  InMemorySalonRepository,
} from '../fakes/organization-fakes.js';

const NOW = new Date('2026-11-19T10:00:00+01:00');
const LIGHT_CLIENT_ID = '0195f000-0000-7000-8000-00000000b004';

describe('Creating an organization and its first salon', () => {
  let organizations: InMemoryOrganizationRepository;
  let salons: InMemorySalonRepository;
  let memberships: InMemorySalonMembershipRepository;
  let audit: InMemoryAuditTrail;
  let candidates: InMemoryOwnerCandidates;
  let handler: CreateOrganizationHandler;

  beforeEach(() => {
    organizations = new InMemoryOrganizationRepository();
    salons = new InMemorySalonRepository();
    memberships = new InMemorySalonMembershipRepository();
    audit = new InMemoryAuditTrail();
    candidates = new InMemoryOwnerCandidates(organizations)
      .withAccount(MIREILLE_ID)
      .withAccount(PAUL_ID)
      .withAccount(LIGHT_CLIENT_ID, false);
    handler = new CreateOrganizationHandler(
      candidates,
      organizations,
      salons,
      memberships,
      audit,
      new FixedClock(NOW),
      new SequentialIdGenerator(),
    );
  });

  const create = (userId: string, name = 'Go Beauty Akwa') =>
    handler.execute(new CreateOrganization(userId, aSalonDraft({ name })));
  const nothingIsStored = () => {
    expect(organizations.rows).toHaveLength(0);
    expect(salons.rows).toHaveLength(0);
    expect(memberships.rows).toHaveLength(0);
    expect(audit.entries).toHaveLength(0);
  };

  it('keeps the organization name separate from the first salon name', async () => {
    await handler.execute(new CreateOrganization(MIREILLE_ID, aSalonDraft({ name: 'Awa Bastos' }), 'Maison Awa'));
    expect(organizations.rows[0]).toMatchObject({ name: 'Maison Awa' });
    expect(salons.rows[0]).toMatchObject({ name: 'Awa Bastos' });
  });

  it('refuses a light client account and stores nothing', async () => {
    await expect(create(LIGHT_CLIENT_ID)).rejects.toThrow(OwnerAccountRequiredError);

    nothingIsStored();
  });

  it('refuses an invalid salon and stores nothing', async () => {
    await expect(create(MIREILLE_ID, 'G')).rejects.toThrow();

    nothingIsStored();
  });

  it('refuses a second organization for the same owner and changes nothing', async () => {
    await create(MIREILLE_ID);

    await expect(create(MIREILLE_ID, 'Go Beauty Bastos')).rejects.toThrow(OrganizationAlreadyExistsError);

    expect(organizations.rows).toHaveLength(1);
    expect(salons.rows.map((s) => s.name)).toEqual(['Go Beauty Akwa']);
    expect(memberships.rows).toHaveLength(1);
  });

  it('refuses an unknown account', async () => {
    await expect(create('0195f000-0000-7000-8000-00000000ffff')).rejects.toThrow(NotFoundError);

    nothingIsStored();
  });

  it('creates one organization, one salon and one owner membership and answers their ids', async () => {
    const response = await create(MIREILLE_ID);

    expect(organizations.rows).toHaveLength(1);
    expect(salons.rows).toHaveLength(1);
    expect(memberships.rows).toHaveLength(1);
    expect(response).toEqual({
      organizationId: organizations.rows[0]?.id,
      salonId: salons.rows[0]?.id,
    });
    expect(memberships.rows[0]).toMatchObject({
      salonId: response.salonId,
      userId: MIREILLE_ID,
      role: 'OWNER',
    });
  });

  it('keeps the memberships a collaborator already has elsewhere and gives nothing to the other owner', async () => {
    memberships.rows.push({
      id: 'membership-elegance',
      salonId: 'salon-elegance',
      userId: PAUL_ID,
      role: 'OWNER',
      status: 'ACTIVE',
      grantedAt: NOW,
      version: 1,
    });

    const { salonId } = await create(PAUL_ID, 'Paul Barber Deïdo');

    expect(memberships.ofUser(PAUL_ID).map((m) => m.salonId)).toEqual(['salon-elegance', salonId]);
    expect(memberships.ofUser(CLARISSE_ID)).toEqual([]);
  });

  it('traces the creation and the ownership without any personal data', async () => {
    await create(MIREILLE_ID);

    expect(audit.entries.map((e) => [e.action, e.details])).toEqual([
      ['ORGANIZATION_FOUNDED', { type: 'MIXED' }],
      ['SALON_MEMBERSHIP_GRANTED', { role: 'OWNER' }],
    ]);
    expect(audit.entries.every((e) => e.actorUserId === MIREILLE_ID && e.occurredAt === NOW)).toBe(true);
    expect(JSON.stringify(audit.entries)).not.toMatch(/699887766|Joffre|677123456/);
  });
});

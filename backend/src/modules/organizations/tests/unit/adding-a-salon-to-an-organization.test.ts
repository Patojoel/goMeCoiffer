import { beforeEach, describe, expect, it } from 'vitest';
import { InvalidValueError } from '../../../../shared/domain/errors.js';
import { FixedClock, SequentialIdGenerator } from '../../../../test-support/fakes.js';
import { AddSalonToOrganization } from '../../application/commands/add-salon-to-organization/add-salon-to-organization.command.js';
import { AddSalonToOrganizationHandler } from '../../application/commands/add-salon-to-organization/add-salon-to-organization.handler.js';
import { Organization } from '../../domain/aggregates/organization.js';
import { SalonRegistered } from '../../domain/events/salon-registered.js';
import { OrganizationRequiredError } from '../../domain/exceptions/organization-required.error.js';
import { SalonNameAlreadyExistsError } from '../../domain/exceptions/salon-name-already-exists.error.js';
import {
  aSalonDraft,
  anOwnerCandidate,
  CLARISSE_ID,
  MIREILLE_ID,
} from '../builders/organization-builders.js';
import {
  InMemoryAuditTrail,
  InMemoryOrganizationRepository,
  InMemorySalonMembershipRepository,
  InMemorySalonRepository,
} from '../fakes/organization-fakes.js';

const FOUNDED_AT = new Date('2026-11-19T10:00:00+01:00');
const NOW = new Date('2026-11-20T10:00:00+01:00');
const NADEGE_ID = '0195f000-0000-7000-8000-00000000b010';
const MIREILLE_ORG_ID = '0195f000-0000-7000-8000-00000000c001';
const AKWA_SALON_ID = '0195f000-0000-7000-8000-00000000d001';
const AKWA_MEMBERSHIP_ID = '0195f000-0000-7000-8000-00000000e001';
const CLARISSE_ORG_ID = '0195f000-0000-7000-8000-00000000c002';
const ELEGANCE_SALON_ID = '0195f000-0000-7000-8000-00000000d002';
const ELEGANCE_MEMBERSHIP_ID = '0195f000-0000-7000-8000-00000000e002';

const BASTOS = aSalonDraft({
  name: 'Go Beauty Bastos',
  type: 'MIXED',
  city: 'Yaoundé',
  district: 'Bastos',
  landmark: "Avenue Jean-Paul II, face à l'ambassade de Chine",
  phone: '6 91 22 33 44',
});

describe('Adding a salon to an existing organization', () => {
  let organizations: InMemoryOrganizationRepository;
  let salons: InMemorySalonRepository;
  let memberships: InMemorySalonMembershipRepository;
  let audit: InMemoryAuditTrail;
  let handler: AddSalonToOrganizationHandler;

  const seedOwnerWithSalon = async (
    ownerId: string,
    ids: { organization: string; salon: string; membership: string },
    salonName: string,
  ) => {
    const founded = Organization.found({
      owner: anOwnerCandidate({ userId: ownerId }),
      salon: aSalonDraft({ name: salonName }),
      ids,
      now: FOUNDED_AT,
    });
    await organizations.add(founded.organization);
    await salons.add(founded.salon);
    await memberships.add(founded.membership);
    salons.events.length = 0;
  };

  beforeEach(async () => {
    organizations = new InMemoryOrganizationRepository();
    salons = new InMemorySalonRepository();
    memberships = new InMemorySalonMembershipRepository();
    audit = new InMemoryAuditTrail();
    handler = new AddSalonToOrganizationHandler(
      organizations,
      salons,
      memberships,
      audit,
      new FixedClock(NOW),
      new SequentialIdGenerator(),
    );
    await seedOwnerWithSalon(
      MIREILLE_ID,
      { organization: MIREILLE_ORG_ID, salon: AKWA_SALON_ID, membership: AKWA_MEMBERSHIP_ID },
      'Go Beauty Akwa',
    );
    await seedOwnerWithSalon(
      CLARISSE_ID,
      { organization: CLARISSE_ORG_ID, salon: ELEGANCE_SALON_ID, membership: ELEGANCE_MEMBERSHIP_ID },
      'Élégance Bonamoussadi',
    );
  });

  // T1 — RG-010-01
  it('refuses a user without an organization and stores nothing', async () => {
    const beforeSalons = salons.rows.length;
    const beforeMemberships = memberships.rows.length;

    await expect(handler.execute(new AddSalonToOrganization(NADEGE_ID, BASTOS))).rejects.toMatchObject({
      code: 'ORGANIZATION_REQUIRED',
      message: "Créez d'abord votre organisation et votre premier salon.",
    });
    await expect(handler.execute(new AddSalonToOrganization(NADEGE_ID, BASTOS))).rejects.toThrow(
      OrganizationRequiredError,
    );

    expect(salons.rows).toHaveLength(beforeSalons);
    expect(memberships.rows).toHaveLength(beforeMemberships);
    expect(audit.entries).toHaveLength(0);
  });

  // T2 — RG-010-02
  it.each(['Go Beauty Akwa', 'go beauty akwa', '  Go   Beauty  Akwa  '])(
    'refuses a duplicate salon name in the same organization (%s) and stores nothing',
    async (duplicateName) => {
      await expect(
        handler.execute(new AddSalonToOrganization(MIREILLE_ID, { ...BASTOS, name: duplicateName })),
      ).rejects.toMatchObject({
        code: 'SALON_NAME_ALREADY_EXISTS',
        message: 'Votre organisation possède déjà un salon portant ce nom.',
      });
      await expect(
        handler.execute(new AddSalonToOrganization(MIREILLE_ID, { ...BASTOS, name: duplicateName })),
      ).rejects.toThrow(SalonNameAlreadyExistsError);

      expect(salons.rows.filter((s) => s.organizationId === MIREILLE_ORG_ID)).toHaveLength(1);
      expect(audit.entries).toHaveLength(0);
      expect(salons.events).toHaveLength(0);
    },
  );

  it('refuses invalid salon details and stores nothing', async () => {
    await expect(
      handler.execute(new AddSalonToOrganization(MIREILLE_ID, { ...BASTOS, name: 'G' })),
    ).rejects.toThrow(InvalidValueError);

    expect(salons.rows.filter((s) => s.organizationId === MIREILLE_ORG_ID)).toHaveLength(1);
    expect(audit.entries).toHaveLength(0);
  });

  // T3 — RG-010-02 (autre organisation)
  it('accepts the same salon name in a different organization', async () => {
    await handler.execute(new AddSalonToOrganization(MIREILLE_ID, BASTOS));

    const clarisseResult = await handler.execute(new AddSalonToOrganization(CLARISSE_ID, BASTOS));

    expect(clarisseResult.organizationId).toBe(CLARISSE_ORG_ID);
    const clarisseSalon = salons.rows.find((s) => s.id === clarisseResult.salonId);
    expect(clarisseSalon).toMatchObject({
      organizationId: CLARISSE_ORG_ID,
      name: 'Go Beauty Bastos',
    });
  });

  // T4 — RG-010-03, RG-010-08
  it('adds an unpublished salon on Douala time with an active OWNER membership, emits SalonRegistered and keeps organization name unchanged', async () => {
    const result = await handler.execute(
      new AddSalonToOrganization(MIREILLE_ID, { ...BASTOS, name: '  Go   Beauty  Bastos  ' }),
    );

    expect(result.organizationId).toBe(MIREILLE_ORG_ID);
    const addedSalon = salons.rows.find((s) => s.id === result.salonId);
    expect(addedSalon).toMatchObject({
      id: result.salonId,
      organizationId: MIREILLE_ORG_ID,
      name: 'Go Beauty Bastos',
      type: 'MIXED',
      city: 'Yaoundé',
      district: 'Bastos',
      landmark: "Avenue Jean-Paul II, face à l'ambassade de Chine",
      phone: '+237691223344',
      timezone: 'Africa/Douala',
      publicationStatus: 'NOT_PUBLISHED',
      createdAt: NOW,
    });
    expect(memberships.ofUser(MIREILLE_ID)).toContainEqual(
      expect.objectContaining({
        salonId: result.salonId,
        userId: MIREILLE_ID,
        role: 'OWNER',
        status: 'ACTIVE',
        grantedAt: NOW,
      }),
    );
    expect(organizations.rows.find((o) => o.id === MIREILLE_ORG_ID)?.name).toBe('Go Beauty Akwa');
    expect(salons.events).toEqual([new SalonRegistered(result.salonId, MIREILLE_ORG_ID, NOW)]);
  });

  // T5 — RG-010-03
  it('allows adding a third salon to the same organization', async () => {
    await handler.execute(new AddSalonToOrganization(MIREILLE_ID, BASTOS));
    const third = await handler.execute(
      new AddSalonToOrganization(
        MIREILLE_ID,
        aSalonDraft({
          name: 'Go Beauty Biyem-Assi',
          type: 'HAIR_SALON',
          city: 'Yaoundé',
          district: 'Biyem-Assi',
          landmark: 'Carrefour Biyem-Assi, à côté de la boulangerie Select',
          phone: '6 78 55 44 33',
        }),
      ),
    );

    const mireilleSalons = salons.rows.filter((s) => s.organizationId === MIREILLE_ORG_ID);
    expect(mireilleSalons.map((s) => s.name)).toEqual([
      'Go Beauty Akwa',
      'Go Beauty Bastos',
      'Go Beauty Biyem-Assi',
    ]);
    expect(memberships.ofUser(MIREILLE_ID)).toHaveLength(3);
    expect(memberships.ofUser(MIREILLE_ID).every((m) => m.role === 'OWNER' && m.status === 'ACTIVE')).toBe(
      true,
    );
    expect(third.organizationId).toBe(MIREILLE_ORG_ID);
  });

  // T6 — RG-010-14
  it('records SALON_ADDED and SALON_MEMBERSHIP_GRANTED in the audit trail without personal data', async () => {
    const result = await handler.execute(new AddSalonToOrganization(MIREILLE_ID, BASTOS));

    expect(audit.entries).toHaveLength(2);
    expect(audit.entries[0]).toMatchObject({
      action: 'SALON_ADDED',
      subjectType: 'salon',
      subjectId: result.salonId,
      actorUserId: MIREILLE_ID,
      salonId: result.salonId,
      occurredAt: NOW,
      details: { organizationId: MIREILLE_ORG_ID, type: 'MIXED', city: 'Yaoundé' },
    });
    expect(audit.entries[1]).toMatchObject({
      action: 'SALON_MEMBERSHIP_GRANTED',
      subjectType: 'salon_membership',
      actorUserId: MIREILLE_ID,
      salonId: result.salonId,
      occurredAt: NOW,
      details: { role: 'OWNER' },
    });
    expect(JSON.stringify(audit.entries)).not.toMatch(/691223344|Jean-Paul|ambassade|677123456|\+237/);
  });
});

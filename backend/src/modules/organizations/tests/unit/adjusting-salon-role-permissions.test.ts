import { describe, expect, it } from 'vitest';
import { FixedClock } from '../../../../test-support/fakes.js';
import { AdjustRolePermissions } from '../../application/commands/adjust-role-permissions/adjust-role-permissions.command.js';
import { AdjustRolePermissionsHandler } from '../../application/commands/adjust-role-permissions/adjust-role-permissions.handler.js';
import { InitializeSalonRolesHandler } from '../../application/commands/initialize-salon-roles/initialize-salon-roles.handler.js';
import { WhenSalonRegistered } from '../../application/subscribers/when-salon-registered.js';
import { RolePermissions } from '../../domain/aggregates/role-permissions.js';
import type { InvitableSalonRole } from '../../domain/enums/invitable-salon-role.enum.js';
import {
  ADJUSTABLE_PERMISSIONS,
  ADJUSTABLE_SALON_ROLES,
  Permission,
  ProtectedOwnerRight,
  RESERVED_OWNER_RIGHTS,
  SALON_PERMISSIONS,
} from '../../domain/enums/permission.enum.js';
import { RolePermissionsAdjusted } from '../../domain/events/role-permissions-adjusted.js';
import { SalonRegistered } from '../../domain/events/salon-registered.js';
import { OwnerRoleNotAdjustableError } from '../../domain/exceptions/owner-role-not-adjustable.error.js';
import { PermissionNotAdjustableError } from '../../domain/exceptions/permission-not-adjustable.error.js';
import { PermissionRequiresViewError } from '../../domain/exceptions/permission-requires-view.error.js';
import { RoleAboveInviterError } from '../../domain/exceptions/role-above-inviter.error.js';
import { RolePermissionsChangedMeanwhileError } from '../../domain/exceptions/role-permissions-changed-meanwhile.error.js';
import { permissionsOfMember } from '../../domain/services/permissions-of-role.js';
import { RoleGrantPolicy } from '../../domain/services/role-grant-policy.js';
import { defaultPermissionsOf, RolePermissionSet } from '../../domain/value-objects/role-permission-set.js';
import { FakeAfterCommit } from '../fakes/invitation-fakes.js';
import {
  InMemoryAuditTrail,
  InMemoryRealtimePublisher,
  InMemoryRolePermissionsRepository,
  InMemorySalonRolePermissions,
} from '../fakes/organization-fakes.js';

describe('Adjusting the permissions of the roles of a salon', () => {
  describe('T1 — The salon permission catalogue and reserved owner rights', () => {
    it('lists 17 salon permissions, 16 adjustable permissions, and 4 reserved owner rights that are never adjustable', () => {
      expect(Object.values(Permission)).toHaveLength(17);
      expect(SALON_PERMISSIONS).toHaveLength(17);
      expect(ADJUSTABLE_PERMISSIONS).toHaveLength(16);
      expect(ADJUSTABLE_PERMISSIONS).not.toContain('roles:administer');
      expect(RESERVED_OWNER_RIGHTS).toEqual([
        'roles:administer',
        ProtectedOwnerRight.MANAGE_SALONS,
        ProtectedOwnerRight.MANAGE_SUBSCRIPTION,
        ProtectedOwnerRight.MANAGE_PAYOUT_ACCOUNTS,
      ]);
      for (const reserved of RESERVED_OWNER_RIGHTS) {
        expect(ADJUSTABLE_PERMISSIONS).not.toContain(reserved);
      }
      expect(ADJUSTABLE_SALON_ROLES).toEqual([
        'SALON_ADMIN',
        'HAIRDRESSER',
        'FINANCE_MANAGER',
        'PRACTITIONER',
      ]);
    });
  });

  describe('T2 — Default permissions of the four collaborator roles', () => {
    it('defines the exact default permissions for each collaborator role and refuses OWNER', () => {
      expect(defaultPermissionsOf('SALON_ADMIN')).toEqual([
        'dashboard:view',
        'bookings:view-own',
        'bookings:view-all',
        'bookings:manage',
        'availability:edit-own',
        'availability:manage-team',
        'services:view',
        'services:manage',
        'staff:view',
        'staff:invite',
        'staff:manage',
        'salon-settings:view',
      ]);
      expect(defaultPermissionsOf('HAIRDRESSER')).toEqual([
        'bookings:view-own',
        'availability:edit-own',
      ]);
      expect(defaultPermissionsOf('FINANCE_MANAGER')).toEqual([
        'dashboard:view',
        'bookings:view-all',
        'finances:view',
        'finances:record-payment',
        'finances:export',
      ]);
      expect(defaultPermissionsOf('PRACTITIONER')).toEqual([
        'bookings:view-own',
        'availability:edit-own',
      ]);
      expect(() => defaultPermissionsOf('OWNER' as InvitableSalonRole)).toThrow(
        OwnerRoleNotAdjustableError,
      );
      expect(RolePermissionSet.defaultFor('SALON_ADMIN').matchesDefaultOf('SALON_ADMIN')).toBe(true);
    });
  });

  describe('T3 — RolePermissionSet accepts empty list and refuses unknown, reserved or duplicate permissions', () => {
    it('accepts an empty list and keeps permissions in the canonical catalogue order', () => {
      expect(RolePermissionSet.create([]).toArray()).toEqual([]);
      expect(
        RolePermissionSet.create(['availability:edit-own', 'bookings:view-own']).toArray(),
      ).toEqual(['bookings:view-own', 'availability:edit-own']);
    });

    it.each([
      ['an unknown permission', ['bookings:delete']],
      ['reserved right roles:administer', ['roles:administer']],
      ['reserved right organization:manage-salons', ['organization:manage-salons']],
      ['reserved right subscription:manage', ['subscription:manage']],
      ['reserved right payout-accounts:manage', ['payout-accounts:manage']],
      ['a duplicate permission', ['bookings:view-own', 'bookings:view-own']],
    ])('refuses %s with PermissionNotAdjustableError', (_caseName, codes) => {
      expect(() => RolePermissionSet.create(codes)).toThrow(PermissionNotAdjustableError);
    });
  });

  describe('T4 — Every action permission requires the view permission of its module', () => {
    it.each([
      ['finances:export', 'finances:view', 'Finances : exporter', 'Finances : consulter'],
      [
        'finances:record-payment',
        'finances:view',
        'Finances : déclarer un encaissement',
        'Finances : consulter',
      ],
      ['bookings:manage', 'bookings:view-all', 'Réservations : gérer', 'Réservations : voir toutes'],
      ['services:manage', 'services:view', 'Prestations : gérer', 'Prestations : consulter'],
      ['staff:invite', 'staff:view', 'Personnel : inviter', 'Personnel : consulter'],
      ['staff:manage', 'staff:view', 'Personnel : gérer', 'Personnel : consulter'],
      [
        'salon-settings:edit',
        'salon-settings:view',
        'Paramètres salon : modifier',
        'Paramètres salon : consulter',
      ],
    ])(
      'refuses %s without %s and accepts both together',
      (action, requiredView, actionLabel, viewLabel) => {
        expect(() => RolePermissionSet.create([action])).toThrowError(
          new PermissionRequiresViewError(action, requiredView),
        );
        try {
          RolePermissionSet.create([action]);
        } catch (error) {
          expect(error).toBeInstanceOf(PermissionRequiresViewError);
          expect((error as PermissionRequiresViewError).code).toBe('PERMISSION_REQUIRES_VIEW');
          expect((error as PermissionRequiresViewError).message).toBe(
            `Pour donner « ${actionLabel} », donnez aussi « ${viewLabel} ».`,
          );
        }
        expect(RolePermissionSet.create([action, requiredView]).toArray()).toEqual([
          requiredView,
          action,
        ]);
      },
    );

    it.each(ADJUSTABLE_SALON_ROLES)(
      'validates the default permission set of %s without any dependency error',
      (role) => {
        expect(RolePermissionSet.create(defaultPermissionsOf(role)).toArray()).toEqual(
          defaultPermissionsOf(role),
        );
      },
    );
  });

  describe('T5 — Initializing default role permissions for a salon', () => {
    const now = new Date('2026-11-20T09:00:00.000Z');
    const salonId = '0195f000-0000-7000-8000-000000000b02';

    it.each(ADJUSTABLE_SALON_ROLES)(
      'initializes %s with its default permissions, version 0 and isNew true',
      (role) => {
        const setting = RolePermissions.initializeDefaultForSalon({ salonId, role, now });

        expect(setting.isNew).toBe(true);
        expect(setting.snapshot()).toEqual({
          salonId,
          role,
          permissions: defaultPermissionsOf(role),
          version: 0,
          updatedAt: now,
          updatedBy: null,
        });
      },
    );

    it.each(['OWNER', 'SUPER_ADMIN', 'ESTHETICIAN'])(
      'refuses to initialize %s with OwnerRoleNotAdjustableError',
      (role) => {
        expect(() => RolePermissions.initializeDefaultForSalon({ salonId, role, now })).toThrow(
          OwnerRoleNotAdjustableError,
        );
      },
    );
  });

  describe('T7 — Refusing an adjustment when the expected version is stale', () => {
    const salonId = '0195f000-0000-7000-8000-000000000b02';
    const actorUserId = '0195f000-0000-7000-8000-000000000a01';
    const earlier = new Date('2026-11-19T09:00:00.000Z');
    const now = new Date('2026-11-20T09:00:00.000Z');

    it('refuses a stale version with RolePermissionsChangedMeanwhileError and leaves the setting untouched', () => {
      const setting = RolePermissions.restore({
        salonId,
        role: 'HAIRDRESSER',
        permissions: ['bookings:view-own', 'availability:edit-own'],
        version: 4,
        updatedAt: earlier,
        updatedBy: null,
      });

      expect(() =>
        setting.adjustPermissions({
          permissions: RolePermissionSet.create(['bookings:view-own']),
          expectedVersion: 3,
          actorUserId,
          now,
        }),
      ).toThrowError(new RolePermissionsChangedMeanwhileError());

      expect(setting.permissions).toEqual(['bookings:view-own', 'availability:edit-own']);
      expect(setting.version).toBe(4);
      expect(setting.pullEvents()).toEqual([]);
    });
  });

  describe('T6 — Adjusting role permissions and handling no-op adjustments', () => {
    const salonId = '0195f000-0000-7000-8000-000000000b02';
    const actorUserId = '0195f000-0000-7000-8000-000000000a01';
    const earlier = new Date('2026-11-19T09:00:00.000Z');
    const now = new Date('2026-11-20T09:00:00.000Z');

    it('replaces the permissions, records RolePermissionsAdjusted with added and removed permissions, and updates author and timestamp', () => {
      const setting = RolePermissions.restore({
        salonId,
        role: 'SALON_ADMIN',
        permissions: defaultPermissionsOf('SALON_ADMIN'),
        version: 3,
        updatedAt: earlier,
        updatedBy: null,
      });
      const next = defaultPermissionsOf('SALON_ADMIN')
        .filter((p) => p !== 'staff:invite')
        .concat('finances:view');

      const result = setting.adjustPermissions({
        permissions: RolePermissionSet.create(next),
        expectedVersion: 3,
        resetToDefault: false,
        actorUserId,
        now,
      });

      expect(result).toEqual({
        changed: true,
        added: ['finances:view'],
        removed: ['staff:invite'],
        resetToDefault: false,
      });
      expect(setting.permissions).toContain('finances:view');
      expect(setting.permissions).not.toContain('staff:invite');
      expect(setting.snapshot().updatedAt).toBe(now);
      expect(setting.snapshot().updatedBy).toBe(actorUserId);
      expect(setting.pullEvents()).toEqual([
        new RolePermissionsAdjusted(
          salonId,
          'SALON_ADMIN',
          ['finances:view'],
          ['staff:invite'],
          false,
          actorUserId,
          now,
        ),
      ]);
    });

    it('changes nothing and emits no event when the new permission set is identical to the current one', () => {
      const setting = RolePermissions.restore({
        salonId,
        role: 'HAIRDRESSER',
        permissions: ['bookings:view-own', 'availability:edit-own'],
        version: 3,
        updatedAt: earlier,
        updatedBy: null,
      });

      const result = setting.adjustPermissions({
        permissions: RolePermissionSet.create(['availability:edit-own', 'bookings:view-own']),
        expectedVersion: 3,
        actorUserId,
        now,
      });

      expect(result).toEqual({ changed: false, added: [], removed: [], resetToDefault: false });
      expect(setting.snapshot()).toEqual({
        salonId,
        role: 'HAIRDRESSER',
        permissions: ['bookings:view-own', 'availability:edit-own'],
        version: 3,
        updatedAt: earlier,
        updatedBy: null,
      });
      expect(setting.pullEvents()).toEqual([]);
    });

    it('ignores a falsified resetToDefault=true flag when the new permissions do not match the role defaults', () => {
      const setting = RolePermissions.restore({
        salonId,
        role: 'HAIRDRESSER',
        permissions: ['bookings:view-own', 'availability:edit-own'],
        version: 1,
        updatedAt: earlier,
        updatedBy: null,
      });

      const result = setting.adjustPermissions({
        permissions: RolePermissionSet.create(['bookings:view-own', 'availability:edit-own', 'finances:view']),
        expectedVersion: 1,
        resetToDefault: true,
        actorUserId,
        now,
      });

      expect(result.resetToDefault).toBe(false);
      expect(setting.pullEvents()[0]).toMatchObject({ resetToDefault: false });
    });
  });

  describe('T9 — Resolving the permissions of a member in a salon', () => {
    it('gives the real owner the 17 salon permissions plus the 3 protected rights, and an unowned OWNER only the 17 salon permissions', () => {
      const realOwner = permissionsOfMember('OWNER', true, ['bookings:view-own']);
      const impostorOwner = permissionsOfMember('OWNER', false, ['bookings:view-own']);

      expect(realOwner).toHaveLength(20);
      expect(realOwner).toEqual(
        expect.arrayContaining([...SALON_PERMISSIONS, ...RESERVED_OWNER_RIGHTS]),
      );
      expect(impostorOwner).toEqual(SALON_PERMISSIONS);
    });

    it('gives a collaborator role the permissions configured for that role in the salon, filtering out any non-adjustable right, and none when the configuration is missing', () => {
      expect(
        permissionsOfMember('HAIRDRESSER', false, [
          'bookings:view-own',
          'availability:edit-own',
          'roles:administer',
          'payout-accounts:manage',
        ]),
      ).toEqual(['bookings:view-own', 'availability:edit-own']);
      expect(permissionsOfMember('HAIRDRESSER', false, null)).toEqual([]);
      expect(permissionsOfMember('HAIRDRESSER', false, undefined)).toEqual([]);
    });

    it('gives no permission when the role is unknown or null', () => {
      expect(permissionsOfMember(null, false, ['bookings:view-own'])).toEqual([]);
      expect(permissionsOfMember('SUPER_ADMIN', false, ['bookings:view-own'])).toEqual([]);
    });
  });

  describe('T10 — RoleGrantPolicy checks the permissions configured for the role in the salon', () => {
    const salonId = '0195f000-0000-7000-8000-000000000b02';
    const policy = new RoleGrantPolicy();

    it('lets a default salon administrator invite a hairdresser, refuses a finance manager, accepts once the 3 finance permissions are added, refuses hairdresser if hairdresser receives finances:view, and fails closed when a role configuration is missing', async () => {
      const store = new InMemorySalonRolePermissions().withDefaultsForSalon(salonId);
      const adminDefault = (await store.permissionsOfRoleInSalon(salonId, 'SALON_ADMIN'))!;

      expect(() =>
        policy.assertCanGrant(
          adminDefault,
          defaultPermissionsOf('HAIRDRESSER'),
        ),
      ).not.toThrow();

      expect(() =>
        policy.assertCanGrant(
          adminDefault,
          defaultPermissionsOf('FINANCE_MANAGER'),
        ),
      ).toThrow(RoleAboveInviterError);

      expect(() => policy.assertCanGrant(adminDefault, null)).toThrow(RoleAboveInviterError);

      const adminWithFinances = [
        ...adminDefault,
        'finances:view',
        'finances:record-payment',
        'finances:export',
      ];
      expect(() =>
        policy.assertCanGrant(
          adminWithFinances,
          defaultPermissionsOf('FINANCE_MANAGER'),
        ),
      ).not.toThrow();

      store.withRolePermissions(salonId, 'HAIRDRESSER', [
        'bookings:view-own',
        'availability:edit-own',
        'finances:view',
      ]);
      const hairdresserWithFinances = await store.permissionsOfRoleInSalon(salonId, 'HAIRDRESSER');
      expect(() => policy.assertCanGrant(adminDefault, hairdresserWithFinances)).toThrow(
        RoleAboveInviterError,
      );
    });
  });

  describe('T8 — AdjustRolePermissionsHandler orchestrates persistence, audit and post-commit live signal', () => {
    const akwaId = '0195f000-0000-7000-8000-000000000b02';
    const bastosId = '0195f000-0000-7000-8000-000000000b12';
    const mireilleId = '0195f000-0000-7000-8000-000000000a01';
    const now = new Date('2026-11-20T09:00:00.000Z');

    const setup = () => {
      const repository = new InMemoryRolePermissionsRepository()
        .withDefaultsForSalon(akwaId, now)
        .withDefaultsForSalon(bastosId, now);
      const audit = new InMemoryAuditTrail();
      const afterCommit = new FakeAfterCommit();
      const realtime = new InMemoryRealtimePublisher(afterCommit);
      const clock = new FixedClock(now);
      const handler = new AdjustRolePermissionsHandler(repository, audit, realtime, clock);
      return { repository, audit, afterCommit, realtime, handler };
    };

    it('updates the role of the active salon only, increments its version, records an audit entry without personal data, and publishes the live signal after commit', async () => {
      const { repository, audit, afterCommit, realtime, handler } = setup();
      const nextPermissions = defaultPermissionsOf('SALON_ADMIN')
        .filter((p) => p !== 'staff:invite')
        .concat('finances:view');

      const response = await handler.execute(
        new AdjustRolePermissions(
          akwaId,
          mireilleId,
          'SALON_ADMIN',
          nextPermissions,
          1,
          false,
        ),
      );

      expect(response).toEqual({
        role: 'SALON_ADMIN',
        permissions: RolePermissionSet.create(nextPermissions).toArray(),
        version: 2,
      });
      expect((await repository.getOfSalon(bastosId, 'SALON_ADMIN')).permissions).toEqual(
        defaultPermissionsOf('SALON_ADMIN'),
      );
      expect((await repository.getOfSalon(akwaId, 'HAIRDRESSER')).permissions).toEqual(
        defaultPermissionsOf('HAIRDRESSER'),
      );
      expect(audit.entries).toEqual([
        {
          action: 'ROLE_PERMISSIONS_ADJUSTED',
          subjectType: 'salon_role_permissions',
          subjectId: akwaId,
          actorUserId: mireilleId,
          salonId: akwaId,
          occurredAt: now,
          details: {
            role: 'SALON_ADMIN',
            added: 'finances:view',
            removed: 'staff:invite',
            resetToDefault: false,
          },
        },
      ]);
      expect(realtime.salonMessages).toHaveLength(0);

      await afterCommit.commit();

      expect(realtime.salonMessages).toEqual([
        {
          salonId: akwaId,
          message: {
            type: 'salon.role_permissions_changed',
            payload: { role: 'SALON_ADMIN' },
          },
        },
      ]);
    });

    it('writes nothing, records no audit and sends no live signal when the permission list is unchanged (no-op)', async () => {
      const { repository, audit, afterCommit, realtime, handler } = setup();

      const response = await handler.execute(
        new AdjustRolePermissions(
          akwaId,
          mireilleId,
          'HAIRDRESSER',
          ['availability:edit-own', 'bookings:view-own'],
          1,
        ),
      );
      await afterCommit.commit();

      expect(response).toEqual({
        role: 'HAIRDRESSER',
        permissions: ['bookings:view-own', 'availability:edit-own'],
        version: 1,
      });
      expect((await repository.getOfSalon(akwaId, 'HAIRDRESSER')).version).toBe(1);
      expect(audit.entries).toHaveLength(0);
      expect(realtime.salonMessages).toHaveLength(0);
    });

    it('records no audit and sends no live signal when the adjustment is refused, and keeps the adjustment when the live publisher fails', async () => {
      const { repository, audit, afterCommit, realtime, handler } = setup();

      await expect(
        handler.execute(
          new AdjustRolePermissions(akwaId, mireilleId, 'HAIRDRESSER', ['finances:export'], 1),
        ),
      ).rejects.toThrow(PermissionRequiresViewError);
      await expect(
        handler.execute(
          new AdjustRolePermissions(akwaId, mireilleId, 'HAIRDRESSER', ['bookings:view-own'], 99),
        ),
      ).rejects.toThrow(RolePermissionsChangedMeanwhileError);
      await afterCommit.commit();
      expect(audit.entries).toHaveLength(0);
      expect(realtime.salonMessages).toHaveLength(0);

      realtime.outage = true;
      const saved = await handler.execute(
        new AdjustRolePermissions(akwaId, mireilleId, 'PRACTITIONER', [], 1, false),
      );
      await expect(afterCommit.commit()).resolves.toBeUndefined();

      expect(saved).toEqual({ role: 'PRACTITIONER', permissions: [], version: 2 });
      expect((await repository.getOfSalon(akwaId, 'PRACTITIONER')).permissions).toEqual([]);
      expect(audit.entries).toHaveLength(1);
    });
  });

  describe('T11 — WhenSalonRegistered initializes the 4 default role permission settings idempotently', () => {
    const salonId = '0195f000-0000-7000-8000-000000000b22';
    const organizationId = '0195f000-0000-7000-8000-000000000b21';
    const occurredAt = new Date('2026-11-20T09:00:00.000Z');

    it('creates the four default collaborator role settings when a salon is registered and does not overwrite an existing customized setting when replayed', async () => {
      const repository = new InMemoryRolePermissionsRepository();
      const subscriber = new WhenSalonRegistered(new InitializeSalonRolesHandler(repository));

      await subscriber.handle(new SalonRegistered(salonId, organizationId, occurredAt));

      expect(repository.ofSalon(salonId)).toHaveLength(4);
      for (const role of ADJUSTABLE_SALON_ROLES) {
        const setting = await repository.getOfSalon(salonId, role);
        expect(setting.permissions).toEqual(defaultPermissionsOf(role));
        expect(setting.version).toBe(1);
      }

      repository.withRolePermissions(salonId, 'HAIRDRESSER', ['bookings:view-own'], 2, occurredAt);
      await subscriber.handle(new SalonRegistered(salonId, organizationId, occurredAt));

      expect(repository.ofSalon(salonId)).toHaveLength(4);
      const hairdresser = await repository.getOfSalon(salonId, 'HAIRDRESSER');
      expect(hairdresser.permissions).toEqual(['bookings:view-own']);
      expect(hairdresser.version).toBe(2);
    });
  });
});


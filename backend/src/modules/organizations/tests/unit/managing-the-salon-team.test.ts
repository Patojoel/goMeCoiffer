import { beforeEach, describe, expect, it } from 'vitest';
import { FixedClock, SequentialIdGenerator } from '../../../../test-support/fakes.js';
import { AcceptInvitation } from '../../application/commands/accept-invitation/accept-invitation.command.js';
import { AcceptInvitationHandler } from '../../application/commands/accept-invitation/accept-invitation.handler.js';
import { ChangeCollaboratorRole } from '../../application/commands/change-collaborator-role/change-collaborator-role.command.js';
import { ChangeCollaboratorRoleHandler } from '../../application/commands/change-collaborator-role/change-collaborator-role.handler.js';
import { RemoveCollaborator } from '../../application/commands/remove-collaborator/remove-collaborator.command.js';
import { RemoveCollaboratorHandler } from '../../application/commands/remove-collaborator/remove-collaborator.handler.js';
import { SalonMembership } from '../../domain/aggregates/salon-membership.js';
import { SALON_PERMISSIONS } from '../../domain/enums/permission.enum.js';
import { SalonRole } from '../../domain/enums/salon-role.enum.js';
import { CollaboratorReinstated } from '../../domain/events/collaborator-reinstated.js';
import { CollaboratorRemoved } from '../../domain/events/collaborator-removed.js';
import { CollaboratorRoleChanged } from '../../domain/events/collaborator-role-changed.js';
import { AlreadySalonMemberError } from '../../domain/exceptions/already-salon-member.error.js';
import { CannotManageOwnMembershipError } from '../../domain/exceptions/cannot-manage-own-membership.error.js';
import { MembershipAlreadyRevokedError } from '../../domain/exceptions/membership-already-revoked.error.js';
import { OwnerMembershipProtectedError } from '../../domain/exceptions/owner-membership-protected.error.js';
import { OwnerRoleReservedError } from '../../domain/exceptions/owner-role-reserved.error.js';
import { RoleAboveManagerError } from '../../domain/exceptions/role-above-manager.error.js';
import { TeamMemberChangedMeanwhileError } from '../../domain/exceptions/team-member-changed-meanwhile.error.js';
import { TeamMemberNotFoundError } from '../../domain/exceptions/team-member-not-found.error.js';
import { TeamManagementPolicy } from '../../domain/services/team-management-policy.js';
import { defaultPermissionsOf } from '../../domain/value-objects/role-permission-set.js';
import { AKWA_ID, anInvitation, DAY_MS, ELEGANCE_ID, NOW } from '../builders/invitation-builders.js';
import {
  FakeAfterCommit,
  InMemoryInvitationChecks,
  InMemoryInvitationRepository,
  InMemoryInviteeAccounts,
  InMemoryPhoneProofs,
} from '../fakes/invitation-fakes.js';
import {
  InMemoryTeamAuditTrail,
  InMemoryTeamMembershipRepository,
  InMemoryTeamRealtimePublisher,
  InMemoryTeamRolePermissions,
} from '../fakes/team-fakes.js';

const MIREILLE_ID = '0195f000-0000-7000-8000-00000000b001';
const RODRIGUE_ID = '0195f000-0000-7000-8000-00000000b002';
const AWA_ID = '0195f000-0000-7000-8000-00000000b003';
const HORTENSE_ID = '0195f000-0000-7000-8000-00000000b004';
const GRACE_ID = '0195f000-0000-7000-8000-00000000b005';
const PAUL_ID = '0195f000-0000-7000-8000-00000000b006';

const MIREILLE_MEM_ID = '0195f000-0000-7000-8000-00000000c001';
const RODRIGUE_MEM_ID = '0195f000-0000-7000-8000-00000000c002';
const AWA_MEM_ID = '0195f000-0000-7000-8000-00000000c003';
const HORTENSE_MEM_ID = '0195f000-0000-7000-8000-00000000c004';
const GRACE_MEM_ID = '0195f000-0000-7000-8000-00000000c005';
const PAUL_MEM_ID = '0195f000-0000-7000-8000-00000000c006';

const GRANTED_AT = new Date('2026-11-19T08:00:00.000Z');
const AT_CHANGE = new Date('2026-11-20T09:00:00.000Z');

const activeMembership = (
  over: Partial<Parameters<typeof SalonMembership.restore>[0]> = {},
): SalonMembership =>
  SalonMembership.restore({
    id: AWA_MEM_ID,
    salonId: AKWA_ID,
    userId: AWA_ID,
    role: SalonRole.HAIRDRESSER,
    status: 'ACTIVE',
    grantedAt: GRANTED_AT,
    revokedAt: null,
    revokedByUserId: null,
    reinstatedAt: null,
    version: 1,
    ...over,
  });

const revokedMembership = (
  over: Partial<Parameters<typeof SalonMembership.restore>[0]> = {},
): SalonMembership =>
  activeMembership({
    id: GRACE_MEM_ID,
    userId: GRACE_ID,
    role: SalonRole.PRACTITIONER,
    status: 'REVOKED',
    revokedAt: new Date('2026-11-19T12:00:00.000Z'),
    revokedByUserId: MIREILLE_ID,
    version: 2,
    ...over,
  });

describe('Managing the salon team (T1–T8)', () => {
  describe('T1 & T2 — SalonMembership.changeRole', () => {
    it('refuses to change the role of the salon owner', () => {
      const owner = activeMembership({ id: MIREILLE_MEM_ID, userId: MIREILLE_ID, role: SalonRole.OWNER });

      expect(() =>
        owner.changeRole({
          newRole: SalonRole.SALON_ADMIN,
          expectedVersion: 1,
          actorUserId: RODRIGUE_ID,
          now: AT_CHANGE,
        }),
      ).toThrow(OwnerMembershipProtectedError);
      expect(owner.role).toBe(SalonRole.OWNER);
      expect(owner.pullEvents()).toEqual([]);
    });

    it('refuses to assign the OWNER role to a collaborator', () => {
      const awa = activeMembership();

      expect(() =>
        awa.changeRole({
          newRole: SalonRole.OWNER,
          expectedVersion: 1,
          actorUserId: MIREILLE_ID,
          now: AT_CHANGE,
        }),
      ).toThrow(OwnerRoleReservedError);
      expect(awa.role).toBe(SalonRole.HAIRDRESSER);
      expect(awa.pullEvents()).toEqual([]);
    });

    it('refuses to change the role of a revoked membership', () => {
      const grace = revokedMembership();

      expect(() =>
        grace.changeRole({
          newRole: SalonRole.HAIRDRESSER,
          expectedVersion: 2,
          actorUserId: MIREILLE_ID,
          now: AT_CHANGE,
        }),
      ).toThrow(MembershipAlreadyRevokedError);
      expect(grace.pullEvents()).toEqual([]);
    });

    it('refuses a stale version with TeamMemberChangedMeanwhileError', () => {
      const awa = activeMembership({ version: 3 });

      expect(() =>
        awa.changeRole({
          newRole: SalonRole.SALON_ADMIN,
          expectedVersion: 2,
          actorUserId: MIREILLE_ID,
          now: AT_CHANGE,
        }),
      ).toThrow(TeamMemberChangedMeanwhileError);
      expect(awa.role).toBe(SalonRole.HAIRDRESSER);
    });

    it('treats changing to the same role as a no-op with 0 events and unchanged version', () => {
      const awa = activeMembership({ role: SalonRole.HAIRDRESSER, version: 1 });

      const result = awa.changeRole({
        newRole: SalonRole.HAIRDRESSER,
        expectedVersion: 1,
        actorUserId: MIREILLE_ID,
        now: AT_CHANGE,
      });

      expect(result).toEqual({
        changed: false,
        previousRole: SalonRole.HAIRDRESSER,
        newRole: SalonRole.HAIRDRESSER,
      });
      expect(awa.version).toBe(1);
      expect(awa.pullEvents()).toEqual([]);
    });

    it('replaces the role and records CollaboratorRoleChanged without personal data', () => {
      const awa = activeMembership({ role: SalonRole.HAIRDRESSER, version: 1 });

      const result = awa.changeRole({
        newRole: SalonRole.SALON_ADMIN,
        expectedVersion: 1,
        actorUserId: MIREILLE_ID,
        now: AT_CHANGE,
      });

      expect(result).toEqual({
        changed: true,
        previousRole: SalonRole.HAIRDRESSER,
        newRole: SalonRole.SALON_ADMIN,
      });
      expect(awa.role).toBe(SalonRole.SALON_ADMIN);
      expect(awa.pullEvents()).toEqual([
        new CollaboratorRoleChanged(
          AWA_MEM_ID,
          AKWA_ID,
          AWA_ID,
          SalonRole.HAIRDRESSER,
          SalonRole.SALON_ADMIN,
          MIREILLE_ID,
          AT_CHANGE,
        ),
      ]);
      awa.markPersisted();
      expect(awa.version).toBe(2);
    });
  });

  describe('T3 — SalonMembership.revoke', () => {
    it('refuses to revoke the salon owner', () => {
      const owner = activeMembership({ id: MIREILLE_MEM_ID, userId: MIREILLE_ID, role: SalonRole.OWNER });

      expect(() =>
        owner.revoke({ expectedVersion: 1, actorUserId: RODRIGUE_ID, now: AT_CHANGE }),
      ).toThrow(OwnerMembershipProtectedError);
      expect(owner.status).toBe('ACTIVE');
    });

    it('refuses to revoke a membership that is already revoked', () => {
      const grace = revokedMembership();

      expect(() =>
        grace.revoke({ expectedVersion: 2, actorUserId: MIREILLE_ID, now: AT_CHANGE }),
      ).toThrow(MembershipAlreadyRevokedError);
    });

    it('refuses a stale version with TeamMemberChangedMeanwhileError', () => {
      const grace = activeMembership({ id: GRACE_MEM_ID, userId: GRACE_ID, version: 2 });

      expect(() =>
        grace.revoke({ expectedVersion: 1, actorUserId: MIREILLE_ID, now: AT_CHANGE }),
      ).toThrow(TeamMemberChangedMeanwhileError);
      expect(grace.status).toBe('ACTIVE');
    });

    it('transitions to REVOKED, records revokedAt/revokedByUserId and emits CollaboratorRemoved without PII', () => {
      const grace = activeMembership({
        id: GRACE_MEM_ID,
        userId: GRACE_ID,
        role: SalonRole.PRACTITIONER,
        version: 1,
      });

      grace.revoke({ expectedVersion: 1, actorUserId: MIREILLE_ID, now: AT_CHANGE });

      expect(grace.snapshot()).toMatchObject({
        status: 'REVOKED',
        revokedAt: AT_CHANGE,
        revokedByUserId: MIREILLE_ID,
      });
      expect(grace.pullEvents()).toEqual([
        new CollaboratorRemoved(
          GRACE_MEM_ID,
          AKWA_ID,
          GRACE_ID,
          SalonRole.PRACTITIONER,
          MIREILLE_ID,
          AT_CHANGE,
        ),
      ]);
      grace.markPersisted();
      expect(grace.version).toBe(2);
    });
  });

  describe('T4 — SalonMembership.reinstate', () => {
    it('refuses to reinstate an already ACTIVE membership', () => {
      const awa = activeMembership();

      expect(() => awa.reinstate({ role: SalonRole.SALON_ADMIN, now: AT_CHANGE })).toThrow(
        AlreadySalonMemberError,
      );
    });

    it('refuses to reinstate with the OWNER role', () => {
      const grace = revokedMembership();

      expect(() => grace.reinstate({ role: SalonRole.OWNER, now: AT_CHANGE })).toThrow(
        OwnerRoleReservedError,
      );
    });

    it('reactivates a REVOKED membership with the new role, clears revocation fields, and emits CollaboratorReinstated', () => {
      const grace = revokedMembership({ version: 2 });

      grace.reinstate({ role: SalonRole.SALON_ADMIN, now: AT_CHANGE });

      expect(grace.snapshot()).toMatchObject({
        status: 'ACTIVE',
        role: SalonRole.SALON_ADMIN,
        revokedAt: null,
        revokedByUserId: null,
        reinstatedAt: AT_CHANGE,
      });
      expect(grace.pullEvents()).toEqual([
        new CollaboratorReinstated(GRACE_MEM_ID, AKWA_ID, GRACE_ID, SalonRole.SALON_ADMIN, AT_CHANGE),
      ]);
      grace.markPersisted();
      expect(grace.version).toBe(3);
    });
  });

  describe('T5 — TeamManagementPolicy', () => {
    const policy = new TeamManagementPolicy();
    const adminPerms = defaultPermissionsOf('SALON_ADMIN');
    const hairdresserPerms = defaultPermissionsOf('HAIRDRESSER');
    const practitionerPerms = defaultPermissionsOf('PRACTITIONER');
    const financePerms = defaultPermissionsOf('FINANCE_MANAGER');

    it('refuses when actor targets their own membership', () => {
      expect(() =>
        policy.assertCanChangeRole({
          actorUserId: RODRIGUE_ID,
          targetUserId: RODRIGUE_ID,
          actorPermissions: adminPerms,
          currentRolePermissions: adminPerms,
          newRolePermissions: hairdresserPerms,
        }),
      ).toThrow(CannotManageOwnMembershipError);

      expect(() =>
        policy.assertCanRevoke({
          actorUserId: RODRIGUE_ID,
          targetUserId: RODRIGUE_ID,
          actorPermissions: adminPerms,
          currentRolePermissions: adminPerms,
        }),
      ).toThrow(CannotManageOwnMembershipError);
    });

    it('fails closed when current or new role permissions are null', () => {
      expect(() =>
        policy.assertCanChangeRole({
          actorUserId: RODRIGUE_ID,
          targetUserId: AWA_ID,
          actorPermissions: adminPerms,
          currentRolePermissions: null,
          newRolePermissions: practitionerPerms,
        }),
      ).toThrow(RoleAboveManagerError);

      expect(() =>
        policy.assertCanChangeRole({
          actorUserId: RODRIGUE_ID,
          targetUserId: AWA_ID,
          actorPermissions: adminPerms,
          currentRolePermissions: hairdresserPerms,
          newRolePermissions: null,
        }),
      ).toThrow(RoleAboveManagerError);

      expect(() =>
        policy.assertCanRevoke({
          actorUserId: RODRIGUE_ID,
          targetUserId: AWA_ID,
          actorPermissions: adminPerms,
          currentRolePermissions: null,
        }),
      ).toThrow(RoleAboveManagerError);
    });

    it('refuses when current role OR new role has any permission missing from actorPermissions', () => {
      // Rodrigue (sans finances) → passer Awa en FINANCE_MANAGER
      expect(() =>
        policy.assertCanChangeRole({
          actorUserId: RODRIGUE_ID,
          targetUserId: AWA_ID,
          actorPermissions: adminPerms,
          currentRolePermissions: hairdresserPerms,
          newRolePermissions: financePerms,
        }),
      ).toThrow(RoleAboveManagerError);

      // Rodrigue (sans finances) → passer Hortense (FINANCE_MANAGER) en HAIRDRESSER
      expect(() =>
        policy.assertCanChangeRole({
          actorUserId: RODRIGUE_ID,
          targetUserId: HORTENSE_ID,
          actorPermissions: adminPerms,
          currentRolePermissions: financePerms,
          newRolePermissions: hairdresserPerms,
        }),
      ).toThrow(RoleAboveManagerError);

      // Rodrigue (sans finances) → retirer Hortense
      expect(() =>
        policy.assertCanRevoke({
          actorUserId: RODRIGUE_ID,
          targetUserId: HORTENSE_ID,
          actorPermissions: adminPerms,
          currentRolePermissions: financePerms,
        }),
      ).toThrow(RoleAboveManagerError);
    });

    it('allows owner and salon admin within their permissions (including after permission adjustments)', () => {
      expect(() =>
        policy.assertCanChangeRole({
          actorUserId: MIREILLE_ID,
          targetUserId: HORTENSE_ID,
          actorPermissions: SALON_PERMISSIONS,
          currentRolePermissions: financePerms,
          newRolePermissions: hairdresserPerms,
        }),
      ).not.toThrow();

      expect(() =>
        policy.assertCanChangeRole({
          actorUserId: RODRIGUE_ID,
          targetUserId: AWA_ID,
          actorPermissions: adminPerms,
          currentRolePermissions: hairdresserPerms,
          newRolePermissions: practitionerPerms,
        }),
      ).not.toThrow();

      expect(() =>
        policy.assertCanRevoke({
          actorUserId: RODRIGUE_ID,
          targetUserId: HORTENSE_ID,
          actorPermissions: [...adminPerms, 'finances:view', 'finances:record-payment', 'finances:export'],
          currentRolePermissions: financePerms,
        }),
      ).not.toThrow();
    });
  });

  describe('T6 — ChangeCollaboratorRoleHandler', () => {
    let memberships: InMemoryTeamMembershipRepository;
    let rolePermissions: InMemoryTeamRolePermissions;
    let audit: InMemoryTeamAuditTrail;
    let afterCommit: FakeAfterCommit;
    let realtime: InMemoryTeamRealtimePublisher;
    let clock: FixedClock;
    let handler: ChangeCollaboratorRoleHandler;

    beforeEach(() => {
      memberships = new InMemoryTeamMembershipRepository()
        .seed(activeMembership({ id: MIREILLE_MEM_ID, userId: MIREILLE_ID, role: SalonRole.OWNER }))
        .seed(activeMembership({ id: RODRIGUE_MEM_ID, userId: RODRIGUE_ID, role: SalonRole.SALON_ADMIN }))
        .seed(activeMembership({ id: AWA_MEM_ID, userId: AWA_ID, role: SalonRole.HAIRDRESSER }))
        .seed(activeMembership({ id: HORTENSE_MEM_ID, userId: HORTENSE_ID, role: SalonRole.FINANCE_MANAGER }))
        .seed(activeMembership({ id: PAUL_MEM_ID, salonId: ELEGANCE_ID, userId: PAUL_ID, role: SalonRole.HAIRDRESSER }));
      rolePermissions = new InMemoryTeamRolePermissions().withDefaultsForSalon(AKWA_ID);
      audit = new InMemoryTeamAuditTrail();
      afterCommit = new FakeAfterCommit();
      realtime = new InMemoryTeamRealtimePublisher(afterCommit);
      clock = new FixedClock(AT_CHANGE);
      handler = new ChangeCollaboratorRoleHandler(
        memberships,
        rolePermissions,
        new TeamManagementPolicy(),
        audit,
        realtime,
        clock,
      );
    });

    it('throws TeamMemberNotFoundError for unknown id or membership of another salon', async () => {
      await expect(
        handler.execute(
          new ChangeCollaboratorRole(
            AKWA_ID,
            MIREILLE_ID,
            SALON_PERMISSIONS,
            '0195f000-0000-7000-8000-00000000dead',
            'SALON_ADMIN',
            1,
          ),
        ),
      ).rejects.toThrow(TeamMemberNotFoundError);

      await expect(
        handler.execute(
          new ChangeCollaboratorRole(
            AKWA_ID,
            MIREILLE_ID,
            SALON_PERMISSIONS,
            PAUL_MEM_ID,
            'SALON_ADMIN',
            1,
          ),
        ),
      ).rejects.toThrow(TeamMemberNotFoundError);

      expect(audit.entries).toEqual([]);
      expect(realtime.salonMessages).toEqual([]);
    });

    it('protects the owner even when the owner targets themselves', async () => {
      await expect(
        handler.execute(
          new ChangeCollaboratorRole(
            AKWA_ID,
            MIREILLE_ID,
            SALON_PERMISSIONS,
            MIREILLE_MEM_ID,
            'SALON_ADMIN',
            1,
          ),
        ),
      ).rejects.toThrow(OwnerMembershipProtectedError);
    });

    it('saves, records audit without PII and schedules SSE signal after commit on effective change', async () => {
      const res = await handler.execute(
        new ChangeCollaboratorRole(AKWA_ID, MIREILLE_ID, SALON_PERMISSIONS, AWA_MEM_ID, 'SALON_ADMIN', 1),
      );

      expect(res).toEqual({ membershipId: AWA_MEM_ID, role: 'SALON_ADMIN', version: 2 });
      expect(memberships.rows.get(AWA_MEM_ID)).toMatchObject({ role: 'SALON_ADMIN', version: 2 });
      expect(audit.entries).toEqual([
        {
          action: 'COLLABORATOR_ROLE_CHANGED',
          subjectType: 'salon_membership',
          subjectId: AWA_MEM_ID,
          actorUserId: MIREILLE_ID,
          salonId: AKWA_ID,
          occurredAt: AT_CHANGE,
          details: { userId: AWA_ID, previousRole: 'HAIRDRESSER', newRole: 'SALON_ADMIN' },
        },
      ]);
      expect(realtime.salonMessages).toEqual([]);
      await afterCommit.commit();
      expect(realtime.salonMessages).toEqual([
        {
          salonId: AKWA_ID,
          message: {
            type: 'salon.member_role_changed',
            payload: { membershipId: AWA_MEM_ID, role: 'SALON_ADMIN' },
          },
        },
      ]);
    });

    it('does nothing on no-op (same role): no save, no audit, no SSE signal', async () => {
      const res = await handler.execute(
        new ChangeCollaboratorRole(AKWA_ID, MIREILLE_ID, SALON_PERMISSIONS, AWA_MEM_ID, 'HAIRDRESSER', 1),
      );

      expect(res).toEqual({ membershipId: AWA_MEM_ID, role: 'HAIRDRESSER', version: 1 });
      expect(audit.entries).toEqual([]);
      await afterCommit.commit();
      expect(realtime.salonMessages).toEqual([]);
    });

    it('keeps the change when realtime publisher throws synchronously', async () => {
      const syncFailingRealtime = new InMemoryTeamRealtimePublisher();
      syncFailingRealtime.outage = true;
      const tolerantHandler = new ChangeCollaboratorRoleHandler(
        memberships,
        rolePermissions,
        new TeamManagementPolicy(),
        audit,
        syncFailingRealtime,
        clock,
      );

      const res = await tolerantHandler.execute(
        new ChangeCollaboratorRole(AKWA_ID, MIREILLE_ID, SALON_PERMISSIONS, AWA_MEM_ID, 'SALON_ADMIN', 1),
      );

      expect(res.version).toBe(2);
      expect(audit.entries).toHaveLength(1);
    });
  });

  describe('T7 — RemoveCollaboratorHandler', () => {
    let memberships: InMemoryTeamMembershipRepository;
    let rolePermissions: InMemoryTeamRolePermissions;
    let audit: InMemoryTeamAuditTrail;
    let afterCommit: FakeAfterCommit;
    let realtime: InMemoryTeamRealtimePublisher;
    let clock: FixedClock;
    let handler: RemoveCollaboratorHandler;

    beforeEach(() => {
      memberships = new InMemoryTeamMembershipRepository()
        .seed(activeMembership({ id: MIREILLE_MEM_ID, userId: MIREILLE_ID, role: SalonRole.OWNER }))
        .seed(activeMembership({ id: GRACE_MEM_ID, userId: GRACE_ID, role: SalonRole.PRACTITIONER }))
        .seed(activeMembership({ id: PAUL_MEM_ID, salonId: ELEGANCE_ID, userId: PAUL_ID, role: SalonRole.HAIRDRESSER }));
      rolePermissions = new InMemoryTeamRolePermissions().withDefaultsForSalon(AKWA_ID);
      audit = new InMemoryTeamAuditTrail();
      afterCommit = new FakeAfterCommit();
      realtime = new InMemoryTeamRealtimePublisher(afterCommit);
      clock = new FixedClock(AT_CHANGE);
      handler = new RemoveCollaboratorHandler(
        memberships,
        rolePermissions,
        new TeamManagementPolicy(),
        audit,
        realtime,
        clock,
      );
    });

    it('throws TeamMemberNotFoundError for unknown id or membership of another salon', async () => {
      await expect(
        handler.execute(new RemoveCollaborator(AKWA_ID, MIREILLE_ID, SALON_PERMISSIONS, PAUL_MEM_ID, 1)),
      ).rejects.toThrow(TeamMemberNotFoundError);

      expect(audit.entries).toEqual([]);
      await afterCommit.commit();
      expect(realtime.closedUserSalonStreams).toEqual([]);
    });

    it('revokes, saves, records audit without PII and schedules closeUserStreamsInSalon after commit', async () => {
      const res = await handler.execute(
        new RemoveCollaborator(AKWA_ID, MIREILLE_ID, SALON_PERMISSIONS, GRACE_MEM_ID, 1),
      );

      expect(res).toEqual({ membershipId: GRACE_MEM_ID, status: 'REVOKED', version: 2 });
      expect(memberships.rows.get(GRACE_MEM_ID)).toMatchObject({
        status: 'REVOKED',
        revokedAt: AT_CHANGE,
        revokedByUserId: MIREILLE_ID,
        version: 2,
      });
      expect(audit.entries).toEqual([
        {
          action: 'COLLABORATOR_REMOVED',
          subjectType: 'salon_membership',
          subjectId: GRACE_MEM_ID,
          actorUserId: MIREILLE_ID,
          salonId: AKWA_ID,
          occurredAt: AT_CHANGE,
          details: { userId: GRACE_ID, role: 'PRACTITIONER' },
        },
      ]);
      expect(realtime.closedUserSalonStreams).toEqual([]);
      await afterCommit.commit();
      expect(realtime.closedUserSalonStreams).toEqual([{ userId: GRACE_ID, salonId: AKWA_ID }]);
    });

    it('keeps the removal when realtime publisher throws synchronously', async () => {
      const syncFailingRealtime = new InMemoryTeamRealtimePublisher();
      syncFailingRealtime.outage = true;
      const tolerantHandler = new RemoveCollaboratorHandler(
        memberships,
        rolePermissions,
        new TeamManagementPolicy(),
        audit,
        syncFailingRealtime,
        clock,
      );

      const res = await tolerantHandler.execute(
        new RemoveCollaborator(AKWA_ID, MIREILLE_ID, SALON_PERMISSIONS, GRACE_MEM_ID, 1),
      );

      expect(res).toEqual({ membershipId: GRACE_MEM_ID, status: 'REVOKED', version: 2 });
      expect(audit.entries).toHaveLength(1);
    });
  });

  describe('T8 — AcceptInvitationHandler reinstates a REVOKED membership', () => {
    const GRACE_PHONE = '+237670112233';
    const GRACE_INV_ID = '0195f000-0000-7000-8000-00000000d100';

    it('reinstates an existing REVOKED membership instead of inserting a duplicate, and audits COLLABORATOR_REINSTATED', async () => {
      const clock = new FixedClock(new Date(NOW.getTime() + DAY_MS));
      const invitations = new InMemoryInvitationRepository();
      const checks = new InMemoryInvitationChecks(invitations).withSalon(AKWA_ID, 'Go Beauty Akwa');
      const proofs = new InMemoryPhoneProofs().prove('grace-proof', GRACE_PHONE, new Date(NOW.getTime() + DAY_MS - 60_000));
      const accounts = new InMemoryInviteeAccounts().withStaffAccount(GRACE_PHONE, GRACE_ID);
      const memberships = new InMemoryTeamMembershipRepository().seed(revokedMembership({ version: 2 }));
      const audit = new InMemoryTeamAuditTrail();

      await invitations.add(
        anInvitation({
          id: GRACE_INV_ID,
          salonId: AKWA_ID,
          name: 'Grâce Mbarga',
          phone: GRACE_PHONE,
          role: 'SALON_ADMIN',
        }),
      );

      const handler = new AcceptInvitationHandler(
        proofs,
        invitations,
        checks,
        accounts,
        memberships,
        audit,
        clock,
        new SequentialIdGenerator(),
      );

      await handler.execute(
        new AcceptInvitation({
          invitationId: GRACE_INV_ID,
          proofToken: 'grace-proof',
          details: null,
          session: null,
          sessionMaxAgeHours: 12,
        }),
      );

      expect(memberships.rows.size).toBe(1);
      expect(memberships.rows.get(GRACE_MEM_ID)).toMatchObject({
        id: GRACE_MEM_ID,
        salonId: AKWA_ID,
        userId: GRACE_ID,
        role: 'SALON_ADMIN',
        status: 'ACTIVE',
        revokedAt: null,
        revokedByUserId: null,
        reinstatedAt: clock.now(),
        version: 3,
      });
      expect(audit.entries.map((e) => e.action)).toEqual(['COLLABORATOR_REINSTATED', 'INVITATION_ACCEPTED']);
      expect(audit.entries[0]).toEqual({
        action: 'COLLABORATOR_REINSTATED',
        subjectType: 'salon_membership',
        subjectId: GRACE_MEM_ID,
        actorUserId: GRACE_ID,
        salonId: AKWA_ID,
        occurredAt: clock.now(),
        details: { userId: GRACE_ID, role: 'SALON_ADMIN', invitationId: GRACE_INV_ID },
      });
      expect(JSON.stringify(audit.entries)).not.toMatch(/Grâce|670112233/);
    });
  });
});

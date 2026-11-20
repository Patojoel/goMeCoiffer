import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  AUDIT_TRAIL,
  type AuditTrail,
  CLOCK,
  type Clock,
  REALTIME_PUBLISHER,
  type RealtimePublisher,
} from '../../../../../shared/application/ports.js';
import type { InvitableSalonRole } from '../../../domain/enums/invitable-salon-role.enum.js';
import { MembershipAlreadyRevokedError } from '../../../domain/exceptions/membership-already-revoked.error.js';
import { OwnerMembershipProtectedError } from '../../../domain/exceptions/owner-membership-protected.error.js';
import { TeamMemberNotFoundError } from '../../../domain/exceptions/team-member-not-found.error.js';
import {
  SALON_ROLE_PERMISSIONS,
  type SalonRolePermissions,
} from '../../../domain/repositories/read/salon-role-permissions.read-repository.js';
import {
  SALON_MEMBERSHIP_REPOSITORY,
  type SalonMembershipRepository,
} from '../../../domain/repositories/write/salon-membership.repository.js';
import { TeamManagementPolicy } from '../../../domain/services/team-management-policy.js';
import { ChangeCollaboratorRole } from './change-collaborator-role.command.js';
import type { ChangeCollaboratorRoleResponse } from './change-collaborator-role.response.js';

@CommandHandler(ChangeCollaboratorRole)
export class ChangeCollaboratorRoleHandler implements ICommandHandler<ChangeCollaboratorRole> {
  private readonly logger = new Logger(ChangeCollaboratorRoleHandler.name);

  constructor(
    @Inject(SALON_MEMBERSHIP_REPOSITORY)
    private readonly memberships: Required<SalonMembershipRepository>,
    @Inject(SALON_ROLE_PERMISSIONS) private readonly rolePermissions: SalonRolePermissions,
    private readonly policy: TeamManagementPolicy,
    @Inject(AUDIT_TRAIL) private readonly audit: AuditTrail,
    @Inject(REALTIME_PUBLISHER) private readonly realtime: RealtimePublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(cmd: ChangeCollaboratorRole): Promise<ChangeCollaboratorRoleResponse> {
    const now = this.clock.now();
    const membership = await this.memberships.findByIdInSalon(cmd.salonId, cmd.membershipId);
    if (!membership) throw new TeamMemberNotFoundError();
    if (membership.isRevoked) throw new MembershipAlreadyRevokedError();
    if (membership.isOwner) throw new OwnerMembershipProtectedError();

    const currentRole = membership.role as InvitableSalonRole;
    const [currentRolePermissions, newRolePermissions] = await Promise.all([
      this.rolePermissions.permissionsOfRoleInSalon(cmd.salonId, currentRole),
      this.rolePermissions.permissionsOfRoleInSalon(cmd.salonId, cmd.newRole),
    ]);

    this.policy.assertCanChangeRole({
      actorUserId: cmd.actorUserId,
      targetUserId: membership.userId,
      actorPermissions: cmd.actorPermissions,
      currentRolePermissions,
      newRolePermissions,
    });

    const { changed, previousRole } = membership.changeRole({
      newRole: cmd.newRole,
      expectedVersion: cmd.expectedVersion,
      actorUserId: cmd.actorUserId,
      now,
    });

    if (changed) {
      await this.memberships.save(membership);
      await this.audit.record({
        action: 'COLLABORATOR_ROLE_CHANGED',
        subjectType: 'salon_membership',
        subjectId: membership.id,
        actorUserId: cmd.actorUserId,
        salonId: cmd.salonId,
        occurredAt: now,
        details: {
          userId: membership.userId,
          previousRole,
          newRole: cmd.newRole,
        },
      });
      try {
        this.realtime.publishToSalon(cmd.salonId, {
          type: 'salon.member_role_changed',
          payload: { membershipId: membership.id, role: cmd.newRole },
        });
      } catch (error) {
        const type = error instanceof Error ? error.name : typeof error;
        this.logger.warn(`Signal de changement de rôle non publié (${type})`);
      }
    }

    return {
      membershipId: membership.id,
      role: membership.role as InvitableSalonRole,
      version: membership.version,
    };
  }
}

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
import { RemoveCollaborator } from './remove-collaborator.command.js';
import type { RemoveCollaboratorResponse } from './remove-collaborator.response.js';

@CommandHandler(RemoveCollaborator)
export class RemoveCollaboratorHandler implements ICommandHandler<RemoveCollaborator> {
  private readonly logger = new Logger(RemoveCollaboratorHandler.name);

  constructor(
    @Inject(SALON_MEMBERSHIP_REPOSITORY)
    private readonly memberships: Required<SalonMembershipRepository>,
    @Inject(SALON_ROLE_PERMISSIONS) private readonly rolePermissions: SalonRolePermissions,
    private readonly policy: TeamManagementPolicy,
    @Inject(AUDIT_TRAIL) private readonly audit: AuditTrail,
    @Inject(REALTIME_PUBLISHER) private readonly realtime: RealtimePublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(cmd: RemoveCollaborator): Promise<RemoveCollaboratorResponse> {
    const now = this.clock.now();
    const membership = await this.memberships.findByIdInSalon(cmd.salonId, cmd.membershipId);
    if (!membership) throw new TeamMemberNotFoundError();
    if (membership.isRevoked) throw new MembershipAlreadyRevokedError();
    if (membership.isOwner) throw new OwnerMembershipProtectedError();

    const roleAtRemoval = membership.role as InvitableSalonRole;
    const currentRolePermissions = await this.rolePermissions.permissionsOfRoleInSalon(
      cmd.salonId,
      roleAtRemoval,
    );

    this.policy.assertCanRevoke({
      actorUserId: cmd.actorUserId,
      targetUserId: membership.userId,
      actorPermissions: cmd.actorPermissions,
      currentRolePermissions,
    });

    membership.revoke({
      expectedVersion: cmd.expectedVersion,
      actorUserId: cmd.actorUserId,
      now,
    });

    await this.memberships.save(membership);
    await this.audit.record({
      action: 'COLLABORATOR_REMOVED',
      subjectType: 'salon_membership',
      subjectId: membership.id,
      actorUserId: cmd.actorUserId,
      salonId: cmd.salonId,
      occurredAt: now,
      details: {
        userId: membership.userId,
        role: roleAtRemoval,
      },
    });
    try {
      this.realtime.closeUserStreamsInSalon(membership.userId, cmd.salonId);
    } catch (error) {
      const type = error instanceof Error ? error.name : typeof error;
      this.logger.warn(`Fermeture des flux temps réel impossible (${type})`);
    }

    return {
      membershipId: membership.id,
      status: 'REVOKED',
      version: membership.version,
    };
  }
}

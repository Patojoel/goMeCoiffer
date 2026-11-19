import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AUDIT_TRAIL, type AuditTrail, CLOCK, type Clock } from '../../../../../shared/application/ports.js';
import {
  INVITATION_REPOSITORY,
  type InvitationRepository,
} from '../../../domain/repositories/write/invitation.repository.js';
import { RoleGrantPolicy } from '../../../domain/services/role-grant-policy.js';
import { CancelInvitation } from './cancel-invitation.command.js';
import type { CancelInvitationResponse } from './cancel-invitation.response.js';

/** L'invitation est chargée par (salon actif, identifiant) : une invitation d'un autre salon répond « introuvable ». */
@CommandHandler(CancelInvitation)
export class CancelInvitationHandler implements ICommandHandler<CancelInvitation> {
  constructor(
    @Inject(INVITATION_REPOSITORY) private readonly invitations: InvitationRepository,
    @Inject(RoleGrantPolicy) private readonly grants: RoleGrantPolicy,
    @Inject(AUDIT_TRAIL) private readonly audit: AuditTrail,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(cmd: CancelInvitation): Promise<CancelInvitationResponse> {
    const now = this.clock.now();
    const invitation = await this.invitations.getOfSalon(cmd.salonId, cmd.invitationId);
    this.grants.assertCanGrant(cmd.authorPermissions, invitation.role);
    invitation.cancel(cmd.authorUserId, now);
    await this.invitations.save(invitation);
    await this.audit.record({
      action: 'INVITATION_CANCELLED',
      subjectType: 'salon_invitation',
      subjectId: invitation.id,
      actorUserId: cmd.authorUserId,
      salonId: cmd.salonId,
      occurredAt: now,
      details: { role: invitation.role },
    });
    return { invitationId: invitation.id, status: 'CANCELLED' };
  }
}

import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AfterCommit } from '../../../../../shared/application/after-commit.js';
import {
  AUDIT_TRAIL,
  type AuditTrail,
  CLOCK,
  type Clock,
  ID_GENERATOR,
  type IdGenerator,
} from '../../../../../shared/application/ports.js';
import { PhoneNumber } from '../../../../../shared/domain/phone-number.js';
import { Invitation } from '../../../domain/aggregates/invitation.js';
import { InvitationMessages } from '../../../domain/messages/invitation-messages.js';
import {
  INVITATION_NOTIFIER,
  type InvitationNotifier,
} from '../../../domain/ports/invitation-notifier.port.js';
import {
  INVITATION_CHECKS,
  type InvitationChecks,
} from '../../../domain/repositories/read/invitation-checks.read-repository.js';
import {
  INVITATION_REPOSITORY,
  type InvitationRepository,
} from '../../../domain/repositories/write/invitation.repository.js';
import { dailyWindowStart, InvitationAdmission } from '../../../domain/services/invitation-admission.js';
import { RoleGrantPolicy } from '../../../domain/services/role-grant-policy.js';
import { InviteCollaborator } from './invite-collaborator.command.js';
import type { InviteCollaboratorResponse } from './invite-collaborator.response.js';

@CommandHandler(InviteCollaborator)
export class InviteCollaboratorHandler implements ICommandHandler<InviteCollaborator> {
  private readonly logger = new Logger(InviteCollaboratorHandler.name);

  constructor(
    @Inject(INVITATION_REPOSITORY) private readonly invitations: InvitationRepository,
    @Inject(INVITATION_CHECKS) private readonly checks: InvitationChecks,
    @Inject(RoleGrantPolicy) private readonly grants: RoleGrantPolicy,
    @Inject(INVITATION_NOTIFIER) private readonly notifier: InvitationNotifier,
    @Inject(AUDIT_TRAIL) private readonly audit: AuditTrail,
    private readonly afterCommit: AfterCommit,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  /**
   * La commande ne lit « ce numéro a-t-il un compte » que pour son appartenance au salon (RG-006-09) : rien d'autre
   * dans la réponse, la durée ou le SMS ne dépend du compte (D-019). Le SMS part après le commit, jamais dans la
   * transaction ; seule la limite du numéro décide s'il part (D-044).
   */
  async execute(cmd: InviteCollaborator): Promise<InviteCollaboratorResponse> {
    const now = this.clock.now();
    const phone = PhoneNumber.parse(cmd.phone);
    const window = dailyWindowStart(now);

    await this.checks.lockSalon(cmd.salonId);
    const previous = await this.invitations.findPendingOfPhone(cmd.salonId, phone);
    if (previous?.expireIfDue(now)) await this.invitations.save(previous);
    this.grants.assertCanGrant(cmd.authorPermissions, cmd.role);
    InvitationAdmission.assertAdmissible({
      isActiveMember: await this.checks.isActiveMember(cmd.salonId, phone),
      hasPendingInvitation: previous?.isPendingAt(now) ?? false,
      sentInLastDay: await this.checks.invitationsSentSince(cmd.salonId, window),
      pendingCount: await this.checks.pendingCount(cmd.salonId, now),
    });
    await this.checks.lockPhone(phone);
    const [smsCount, salon] = await Promise.all([
      this.checks.textMessagesSentSince(phone, window),
      this.checks.salonOf(cmd.salonId),
    ]);
    const notifyBySms = InvitationAdmission.mayTextMessage(smsCount);

    const invitation = Invitation.issue({
      id: this.ids.next(),
      salonId: cmd.salonId,
      invitedByUserId: cmd.authorUserId,
      name: cmd.name,
      phone: phone.value,
      role: cmd.role,
      notifyBySms,
      now,
    });
    await this.invitations.add(invitation);
    const saved = invitation.snapshot();
    await this.audit.record({
      action: 'COLLABORATOR_INVITED',
      subjectType: 'salon_invitation',
      subjectId: saved.id,
      actorUserId: cmd.authorUserId,
      salonId: cmd.salonId,
      occurredAt: now,
      details: { role: saved.role },
    });

    if (notifyBySms) {
      const text = InvitationMessages.invitation({
        role: saved.role,
        deadline: saved.expiresAt,
        timezone: salon.timezone,
      });
      this.afterCommit.registerDetached(() => this.deliver(phone, text));
    }
    return {
      invitationId: saved.id,
      name: saved.name ?? cmd.name,
      phone: phone.value,
      role: saved.role,
      expiresAt: saved.expiresAt.toISOString(),
    };
  }

  /** Une panne du fournisseur laisse l'invitation en attente ; seuls le type et le code de l'erreur sont journalisés. */
  private async deliver(to: PhoneNumber, text: string): Promise<void> {
    try {
      await this.notifier.send(to, text);
    } catch (error) {
      const type = error instanceof Error ? error.name : typeof error;
      const code = (error as { code?: unknown } | null)?.code;
      this.logger.warn(`SMS d'invitation non envoyé (${type}${typeof code === 'string' ? ` ${code}` : ''})`);
    }
  }
}

import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  AUDIT_TRAIL,
  type AuditTrail,
  CLOCK,
  type Clock,
  ID_GENERATOR,
  type IdGenerator,
} from '../../../../../shared/application/ports.js';
import { SalonMembership } from '../../../domain/aggregates/salon-membership.js';
import { AlreadySalonMemberError } from '../../../domain/exceptions/already-salon-member.error.js';
import { PhoneProofRequiredError } from '../../../domain/exceptions/phone-proof-required.error.js';
import { INVITEE_ACCOUNTS, type InviteeAccounts } from '../../../domain/ports/invitee-accounts.port.js';
import { PHONE_PROOFS, type PhoneProofs } from '../../../domain/ports/phone-proofs.port.js';
import {
  INVITATION_CHECKS,
  type InvitationChecks,
} from '../../../domain/repositories/read/invitation-checks.read-repository.js';
import {
  INVITATION_REPOSITORY,
  type InvitationRepository,
} from '../../../domain/repositories/write/invitation.repository.js';
import {
  SALON_MEMBERSHIP_REPOSITORY,
  type SalonMembershipRepository,
} from '../../../domain/repositories/write/salon-membership.repository.js';
import { sessionAfterAcceptance } from '../../../domain/services/session-after-acceptance.js';
import { AcceptInvitation } from './accept-invitation.command.js';
import type { AcceptInvitationResponse } from './accept-invitation.response.js';

/**
 * Exception assumée à « un agrégat par transaction » (docs/domains.md) : l'invitation, l'appartenance et le compte
 * (fourni par `identity`) changent ensemble ou pas du tout, sinon la personne resterait sans salon (RG-007-12).
 */
@CommandHandler(AcceptInvitation)
export class AcceptInvitationHandler implements ICommandHandler<AcceptInvitation> {
  constructor(
    @Inject(PHONE_PROOFS) private readonly proofs: PhoneProofs,
    @Inject(INVITATION_REPOSITORY) private readonly invitations: InvitationRepository,
    @Inject(INVITATION_CHECKS) private readonly checks: InvitationChecks,
    @Inject(INVITEE_ACCOUNTS) private readonly accounts: InviteeAccounts,
    @Inject(SALON_MEMBERSHIP_REPOSITORY) private readonly memberships: SalonMembershipRepository,
    @Inject(AUDIT_TRAIL) private readonly audit: AuditTrail,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  /**
   * Le numéro vient de la preuve, jamais de la requête ni de la session. Seul le verrou du numéro est pris : le salon
   * n'est connu qu'une fois l'invitation lue, et il suffit à sérialiser deux acceptations de la même personne
   * (un compte à créer une seule fois) ; acceptation et annulation simultanées sont départagées par la version de
   * l'invitation.
   */
  async execute(cmd: AcceptInvitation): Promise<AcceptInvitationResponse> {
    const now = this.clock.now();
    const proof = await this.proofs.phoneProvenBy(cmd.proofToken, now);
    if (!proof) throw new PhoneProofRequiredError();
    const { phone } = proof;

    await this.checks.lockPhone(phone);
    const invitation = await this.invitations.getOfInvitee(phone, cmd.invitationId);
    invitation.assertPendingAt(now);
    if (await this.checks.isActiveMember(invitation.salonId, phone))
      throw AlreadySalonMemberError.ofInvitee();

    const account = await this.accounts.provide({ proven: proof, details: cmd.details, now });
    invitation.accept(account.userId, now);
    await this.invitations.save(invitation);
    await this.memberships.add(
      SalonMembership.grantCollaboratorRole({
        id: this.ids.next(),
        salonId: invitation.salonId,
        userId: account.userId,
        role: invitation.role,
        now,
      }),
    );
    await this.audit.record({
      action: 'INVITATION_ACCEPTED',
      subjectType: 'salon_invitation',
      subjectId: invitation.id,
      actorUserId: account.userId,
      salonId: invitation.salonId,
      occurredAt: now,
      details: { role: invitation.role },
    });

    const proofEnded = !(await this.checks.hasPendingInvitation(phone, now));
    if (proofEnded) await this.proofs.forgetProofsOf(proof);

    const salon = await this.checks.salonOf(invitation.salonId);
    return {
      userId: account.userId,
      credentialsVersion: account.credentialsVersion,
      salonId: invitation.salonId,
      salonName: salon.name,
      session: sessionAfterAcceptance({
        accountCreated: account.created,
        account,
        current: cmd.session,
        now,
        sessionMaxAgeHours: cmd.sessionMaxAgeHours,
      }),
      proofEnded,
    };
  }
}

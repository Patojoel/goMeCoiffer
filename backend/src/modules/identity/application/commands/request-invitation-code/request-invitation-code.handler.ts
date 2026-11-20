import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AfterCommit } from '../../../../../shared/application/after-commit.js';
import {
  CLOCK,
  type Clock,
  ID_GENERATOR,
  type IdGenerator,
} from '../../../../../shared/application/ports.js';
import { PhoneNumber } from '../../../../../shared/domain/phone-number.js';
import { OTP_LIFETIME_SECONDS, OtpChallenge } from '../../../domain/aggregates/otp-challenge.js';
import { OtpPurpose } from '../../../domain/enums/otp-purpose.enum.js';
import { SmsMessages } from '../../../domain/messages/sms-messages.js';
import { OTP_CODE_GENERATOR, type OtpCodeGenerator } from '../../../domain/ports/otp-code-generator.port.js';
import { SECRET_HASHER, type SecretHasher } from '../../../domain/ports/secret-hasher.port.js';
import { SMS_SENDER, type SmsSender } from '../../../domain/ports/sms-sender.port.js';
import {
  OTP_SEND_HISTORY,
  type OtpSendHistory,
} from '../../../domain/repositories/read/otp-send-history.read-repository.js';
import {
  PENDING_INVITATIONS_OF_PHONE,
  type PendingInvitationsOfPhone,
} from '../../../domain/repositories/read/pending-invitations-of-phone.read-repository.js';
import {
  OTP_CHALLENGE_REPOSITORY,
  type OtpChallengeRepository,
} from '../../../domain/repositories/write/otp-challenge.repository.js';
import {
  assertCanSendCode,
  RESEND_DELAY_SECONDS,
  sendingWindowStart,
} from '../../../domain/services/otp-sending-policy.js';
import { RequestInvitationCode } from './request-invitation-code.command.js';
import type { RequestInvitationCodeResponse } from './request-invitation-code.response.js';

@CommandHandler(RequestInvitationCode)
export class RequestInvitationCodeHandler implements ICommandHandler<RequestInvitationCode> {
  private readonly logger = new Logger(RequestInvitationCodeHandler.name);

  constructor(
    @Inject(OTP_CHALLENGE_REPOSITORY) private readonly challenges: OtpChallengeRepository,
    @Inject(OTP_SEND_HISTORY) private readonly sendHistory: OtpSendHistory,
    @Inject(PENDING_INVITATIONS_OF_PHONE) private readonly pending: PendingInvitationsOfPhone,
    @Inject(OTP_CODE_GENERATOR) private readonly codes: OtpCodeGenerator,
    @Inject(SECRET_HASHER) private readonly hasher: SecretHasher,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
    private readonly afterCommit: AfterCommit,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  /**
   * Un défi est enregistré pour tout numéro (D-019, D-049), avec les mêmes limites ; seul un numéro qui a une
   * invitation en attente reçoit un vrai code. Sans invitation, le défi porte l'empreinte d'un secret qui n'est pas
   * un code à 6 chiffres : aucun code saisi ne l'accepte. Le SMS part après la réponse (D-033).
   */
  async execute({ phone: rawPhone }: RequestInvitationCode): Promise<RequestInvitationCodeResponse> {
    const phone = PhoneNumber.parse(rawPhone);
    await this.challenges.lockSendingFor(phone);
    const now = this.clock.now();
    assertCanSendCode(
      await this.sendHistory.recentSends(phone, OtpPurpose.INVITATION, sendingWindowStart(now)),
      now,
    );

    const code = (await this.pending.existsFor(phone, now)) ? this.codes.next() : null;
    const secret = code ?? `no-code:${this.ids.next()}`;

    const previous = await this.challenges.findActive(phone, OtpPurpose.INVITATION);
    if (previous) {
      previous.supersede();
      await this.challenges.save(previous);
    }
    await this.challenges.save(
      OtpChallenge.issue({
        id: this.ids.next(),
        phone,
        purpose: OtpPurpose.INVITATION,
        codeHash: this.hasher.hash(secret),
        now,
      }),
    );
    if (code) this.afterCommit.registerDetached(() => this.deliver(phone, code));

    return {
      maskedPhone: phone.masked(),
      expiresInSeconds: OTP_LIFETIME_SECONDS,
      resendInSeconds: RESEND_DELAY_SECONDS,
    };
  }

  /** Une panne du fournisseur n'est ni annoncée ni compensée ; seuls le type et le code de l'erreur sont journalisés. */
  private async deliver(phone: PhoneNumber, code: string): Promise<void> {
    try {
      await this.sms.send(phone, SmsMessages.invitationCode(code));
    } catch (error) {
      const type = error instanceof Error ? error.name : typeof error;
      const errorCode = (error as { code?: unknown } | null)?.code;
      this.logger.warn(
        `SMS de code d'invitation non envoyé (${type}${typeof errorCode === 'string' ? ` ${errorCode}` : ''})`,
      );
    }
  }
}

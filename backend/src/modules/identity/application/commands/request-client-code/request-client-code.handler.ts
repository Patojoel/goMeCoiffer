import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  CLOCK,
  type Clock,
  ID_GENERATOR,
  type IdGenerator,
} from '../../../../../shared/application/ports.js';
import { PhoneNumber } from '../../../../../shared/domain/phone-number.js';
import { OTP_LIFETIME_SECONDS, OtpChallenge } from '../../../domain/aggregates/otp-challenge.js';
import { OtpPurpose } from '../../../domain/enums/otp-purpose.enum.js';
import { TermsNotAcceptedError } from '../../../domain/exceptions/terms-not-accepted.error.js';
import { SmsMessages } from '../../../domain/messages/sms-messages.js';
import { OTP_CODE_GENERATOR, type OtpCodeGenerator } from '../../../domain/ports/otp-code-generator.port.js';
import { SECRET_HASHER, type SecretHasher } from '../../../domain/ports/secret-hasher.port.js';
import { SMS_SENDER, type SmsSender } from '../../../domain/ports/sms-sender.port.js';
import {
  OTP_SEND_HISTORY,
  type OtpSendHistory,
} from '../../../domain/repositories/read/otp-send-history.read-repository.js';
import {
  OTP_CHALLENGE_REPOSITORY,
  type OtpChallengeRepository,
} from '../../../domain/repositories/write/otp-challenge.repository.js';
import {
  assertCanSendCode,
  RESEND_DELAY_SECONDS,
  sendingWindowStart,
} from '../../../domain/services/otp-sending-policy.js';
import { RequestClientCode } from './request-client-code.command.js';
import type { RequestClientCodeResponse } from './request-client-code.response.js';

@CommandHandler(RequestClientCode)
export class RequestClientCodeHandler implements ICommandHandler<RequestClientCode> {
  constructor(
    @Inject(OTP_CHALLENGE_REPOSITORY) private readonly challenges: OtpChallengeRepository,
    @Inject(OTP_SEND_HISTORY) private readonly sendHistory: OtpSendHistory,
    @Inject(OTP_CODE_GENERATOR) private readonly codes: OtpCodeGenerator,
    @Inject(SECRET_HASHER) private readonly hasher: SecretHasher,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  /**
   * Tout numéro valide reçoit un vrai code avec la même réponse, qu'il ait un compte ou non (RG-009-01, D-019).
   * Le SMS part avant l'enregistrement du défi : en cas de panne, aucun défi n'est actif et rien n'est compté (RG-009-04).
   */
  async execute(cmd: RequestClientCode): Promise<RequestClientCodeResponse> {
    if (!cmd.termsAccepted) throw new TermsNotAcceptedError();
    const phone = PhoneNumber.parse(cmd.phone);
    await this.challenges.lockSendingFor(phone);
    const now = this.clock.now();
    assertCanSendCode(
      await this.sendHistory.recentSends(phone, OtpPurpose.CLIENT_LOGIN, sendingWindowStart(now)),
      now,
    );

    const code = this.codes.next();
    await this.sms.send(phone, SmsMessages.clientLoginCode(code));

    const previous = await this.challenges.findActive(phone, OtpPurpose.CLIENT_LOGIN);
    if (previous) {
      previous.supersede();
      await this.challenges.save(previous);
    }
    await this.challenges.save(
      OtpChallenge.issue({
        id: this.ids.next(),
        phone,
        purpose: OtpPurpose.CLIENT_LOGIN,
        codeHash: this.hasher.hash(code),
        now,
      }),
    );

    return {
      maskedPhone: phone.masked(),
      expiresInSeconds: OTP_LIFETIME_SECONDS,
      resendInSeconds: RESEND_DELAY_SECONDS,
    };
  }
}

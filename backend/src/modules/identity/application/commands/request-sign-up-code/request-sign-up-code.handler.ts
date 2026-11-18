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
import { SmsMessages } from '../../../domain/messages/sms-messages.js';
import { OTP_CODE_GENERATOR, type OtpCodeGenerator } from '../../../domain/ports/otp-code-generator.port.js';
import { SECRET_HASHER, type SecretHasher } from '../../../domain/ports/secret-hasher.port.js';
import { SMS_SENDER, type SmsSender } from '../../../domain/ports/sms-sender.port.js';
import {
  OTP_CHALLENGE_REPOSITORY,
  type OtpChallengeRepository,
} from '../../../domain/repositories/write/otp-challenge.repository.js';
import { USER_REPOSITORY, type UserRepository } from '../../../domain/repositories/write/user.repository.js';
import {
  assertCanSendCode,
  RESEND_DELAY_SECONDS,
  sendingWindowStart,
} from '../../../domain/services/otp-sending-policy.js';
import { RequestSignUpCode } from './request-sign-up-code.command.js';
import type { RequestSignUpCodeResponse } from './request-sign-up-code.response.js';

@CommandHandler(RequestSignUpCode)
export class RequestSignUpCodeHandler implements ICommandHandler<RequestSignUpCode> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(OTP_CHALLENGE_REPOSITORY) private readonly challenges: OtpChallengeRepository,
    @Inject(OTP_CODE_GENERATOR) private readonly codes: OtpCodeGenerator,
    @Inject(SECRET_HASHER) private readonly hasher: SecretHasher,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  /**
   * Un défi est créé dans tous les cas, même pour un numéro déjà inscrit (D-019) : la réponse et le quota
   * sont les mêmes, seul le SMS diffère. Les demandes d'un même numéro passent une à une (verrou), et le SMS
   * part avant l'enregistrement : s'il échoue, rien n'est compté.
   */
  async execute({ phone: rawPhone }: RequestSignUpCode): Promise<RequestSignUpCodeResponse> {
    const phone = PhoneNumber.parse(rawPhone);
    await this.challenges.lockSendingFor(phone);
    const now = this.clock.now();
    assertCanSendCode(
      await this.challenges.recentSends(phone, OtpPurpose.SIGN_UP, sendingWindowStart(now)),
      now,
    );

    const existing = await this.users.findByPhone(phone);
    const code = this.codes.next();
    const canRegister = existing?.acceptsOwnerRegistration ?? true;
    await this.sms.send(
      phone,
      canRegister ? SmsMessages.signUpCode(code) : SmsMessages.accountAlreadyExists(),
    );

    const previous = await this.challenges.findActive(phone, OtpPurpose.SIGN_UP);
    if (previous) {
      previous.supersede();
      await this.challenges.save(previous);
    }
    const codeHash = this.hasher.hash(code);
    await this.challenges.save(
      OtpChallenge.issue({ id: this.ids.next(), phone, purpose: OtpPurpose.SIGN_UP, codeHash, now }),
    );

    return {
      maskedPhone: phone.masked(),
      expiresInSeconds: OTP_LIFETIME_SECONDS,
      resendInSeconds: RESEND_DELAY_SECONDS,
    };
  }
}

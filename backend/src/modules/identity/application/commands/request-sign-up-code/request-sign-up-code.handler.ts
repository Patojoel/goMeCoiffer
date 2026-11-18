import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { SignUpCodeSent } from '@gomecoiffer/contracts';
import {
  CLOCK,
  type Clock,
  ID_GENERATOR,
  type IdGenerator,
} from '../../../../../shared/application/ports.js';
import { PhoneNumber } from '../../../../../shared/domain/phone-number.js';
import { OTP_LIFETIME_SECONDS, OtpChallenge } from '../../../domain/otp-challenge.js';
import {
  assertCanSendCode,
  RESEND_DELAY_SECONDS,
  sendingWindowStart,
} from '../../../domain/otp-sending-policy.js';
import {
  OTP_CHALLENGE_REPOSITORY,
  OTP_CODE_GENERATOR,
  type OtpChallengeRepository,
  type OtpCodeGenerator,
  SECRET_HASHER,
  type SecretHasher,
  SMS_SENDER,
  type SmsSender,
  USER_REPOSITORY,
  type UserRepository,
} from '../../../domain/ports.js';
import { SmsMessages } from '../../sms-messages.js';
import { RequestSignUpCode } from './request-sign-up-code.command.js';

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
   * sont les mêmes, seul le SMS diffère. Le SMS part avant l'enregistrement : s'il échoue, rien n'est compté.
   */
  async execute({ phone: rawPhone }: RequestSignUpCode): Promise<SignUpCodeSent> {
    const phone = PhoneNumber.parse(rawPhone);
    const now = this.clock.now();
    assertCanSendCode(await this.challenges.sendTimesSince(phone, sendingWindowStart(now)), now);

    const existing = await this.users.findByPhone(phone);
    const code = this.codes.next();
    const canRegister = existing?.acceptsOwnerRegistration ?? true;
    await this.sms.send(
      phone,
      canRegister ? SmsMessages.signUpCode(code) : SmsMessages.accountAlreadyExists(),
    );

    const previous = await this.challenges.findActive(phone, 'SIGN_UP');
    if (previous) {
      previous.supersede();
      await this.challenges.save(previous);
    }
    const codeHash = this.hasher.hash(code);
    await this.challenges.save(
      OtpChallenge.issue({ id: this.ids.next(), phone, purpose: 'SIGN_UP', codeHash, now }),
    );

    return {
      maskedPhone: phone.masked(),
      expiresInSeconds: OTP_LIFETIME_SECONDS,
      resendInSeconds: RESEND_DELAY_SECONDS,
    };
  }
}

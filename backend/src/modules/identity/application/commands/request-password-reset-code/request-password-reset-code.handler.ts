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
  OTP_CHALLENGE_REPOSITORY,
  type OtpChallengeRepository,
} from '../../../domain/repositories/write/otp-challenge.repository.js';
import { USER_REPOSITORY, type UserRepository } from '../../../domain/repositories/write/user.repository.js';
import {
  assertCanSendCode,
  RESEND_DELAY_SECONDS,
  sendingWindowStart,
} from '../../../domain/services/otp-sending-policy.js';
import { RequestPasswordResetCode } from './request-password-reset-code.command.js';
import type { RequestPasswordResetCodeResponse } from './request-password-reset-code.response.js';

@CommandHandler(RequestPasswordResetCode)
export class RequestPasswordResetCodeHandler implements ICommandHandler<RequestPasswordResetCode> {
  private readonly logger = new Logger(RequestPasswordResetCodeHandler.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(OTP_CHALLENGE_REPOSITORY) private readonly challenges: OtpChallengeRepository,
    @Inject(OTP_SEND_HISTORY) private readonly sendHistory: OtpSendHistory,
    @Inject(OTP_CODE_GENERATOR) private readonly codes: OtpCodeGenerator,
    @Inject(SECRET_HASHER) private readonly hasher: SecretHasher,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
    private readonly afterCommit: AfterCommit,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  /**
   * Un défi est enregistré pour tout numéro (D-019), avec les mêmes limites ; seul un compte avec mot de passe
   * reçoit un vrai code (D-030). Sans compte, le défi porte l'empreinte d'un secret qui n'est pas un code à
   * 6 chiffres : aucun code saisi ne l'accepte. Le SMS part après la réponse : sa durée et une éventuelle panne
   * ne se lisent pas dans la réponse. Le code en clair ne vit que dans la fermeture de l'envoi, jamais en base.
   */
  async execute({ phone: rawPhone }: RequestPasswordResetCode): Promise<RequestPasswordResetCodeResponse> {
    const phone = PhoneNumber.parse(rawPhone);
    await this.challenges.lockSendingFor(phone);
    const now = this.clock.now();
    assertCanSendCode(
      await this.sendHistory.recentSends(phone, OtpPurpose.PASSWORD_RESET, sendingWindowStart(now)),
      now,
    );

    const user = await this.users.findByPhone(phone);
    const code = user?.canResetPassword ? this.codes.next() : null;
    const secret = code ?? `no-code:${this.ids.next()}`;

    const previous = await this.challenges.findActive(phone, OtpPurpose.PASSWORD_RESET);
    if (previous) {
      previous.supersede();
      await this.challenges.save(previous);
    }
    const challenge = OtpChallenge.issue({
      id: this.ids.next(),
      phone,
      purpose: OtpPurpose.PASSWORD_RESET,
      codeHash: this.hasher.hash(secret),
      now,
    });
    await this.challenges.save(challenge);
    if (code) this.afterCommit.registerDetached(() => this.deliver(phone, code));

    return {
      maskedPhone: phone.masked(),
      expiresInSeconds: OTP_LIFETIME_SECONDS,
      resendInSeconds: RESEND_DELAY_SECONDS,
    };
  }

  /**
   * Une panne du fournisseur n'est ni annoncée ni compensée : la demande reste comptée (D-033), comme celle d'un
   * numéro sans compte. On ne journalise que le type et le code de l'erreur : son message ou sa pile pourraient
   * citer le numéro et le texte du SMS, donc le code.
   */
  private async deliver(phone: PhoneNumber, code: string): Promise<void> {
    try {
      await this.sms.send(phone, SmsMessages.passwordResetCode(code));
    } catch (error) {
      const type = error instanceof Error ? error.name : typeof error;
      const errorCode = (error as { code?: unknown } | null)?.code;
      this.logger.warn(`SMS de réinitialisation non envoyé (${type}${typeof errorCode === 'string' ? ` ${errorCode}` : ''})`);
    }
  }
}

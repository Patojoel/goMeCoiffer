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
import { RefuseAfterCommit } from '../../../../../shared/application/refuse-after-commit.js';
import { PhoneNumber } from '../../../../../shared/domain/phone-number.js';
import { User } from '../../../domain/aggregates/user.js';
import { OtpPurpose } from '../../../domain/enums/otp-purpose.enum.js';
import { OtpNoLongerValidError } from '../../../domain/exceptions/otp-no-longer-valid.error.js';
import { SECRET_HASHER, type SecretHasher } from '../../../domain/ports/secret-hasher.port.js';
import {
  OTP_CHALLENGE_REPOSITORY,
  type OtpChallengeRepository,
} from '../../../domain/repositories/write/otp-challenge.repository.js';
import { USER_REPOSITORY, type UserRepository } from '../../../domain/repositories/write/user.repository.js';
import { VerifyClientCode } from './verify-client-code.command.js';
import type { VerifyClientCodeResponse } from './verify-client-code.response.js';

@CommandHandler(VerifyClientCode)
export class VerifyClientCodeHandler implements ICommandHandler<VerifyClientCode> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(OTP_CHALLENGE_REPOSITORY) private readonly challenges: OtpChallengeRepository,
    @Inject(SECRET_HASHER) private readonly hasher: SecretHasher,
    @Inject(AUDIT_TRAIL) private readonly audit: AuditTrail,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  /**
   * Les vérifications d'un même numéro passent une à une (même verrou que l'envoi, RG-009-14). Le compte n'est lu ou
   * créé qu'après un code juste, et la réponse ne distingue jamais un compte créé d'un compte retrouvé (RG-009-10).
   */
  async execute(cmd: VerifyClientCode): Promise<VerifyClientCodeResponse> {
    const phone = PhoneNumber.parse(cmd.phone);
    await this.challenges.lockSendingFor(phone);
    const challenge = await this.challenges.findActive(phone, OtpPurpose.CLIENT_LOGIN);
    if (!challenge) throw new OtpNoLongerValidError();

    const now = this.clock.now();
    const verification = challenge.verify(cmd.code, now, this.hasher);
    await this.challenges.save(challenge);
    if (!verification.accepted) throw new RefuseAfterCommit(verification.refusal);

    const existing = await this.users.findByPhone(phone);
    if (!existing) {
      const created = User.registerClient({ id: this.ids.next(), phone, now });
      await this.users.save(created);
      await this.audit.record({
        action: 'CLIENT_ACCOUNT_CREATED',
        subjectType: 'user',
        subjectId: created.id,
        actorUserId: created.id,
        occurredAt: now,
      });
      await this.audit.record({
        action: 'CLIENT_SIGNED_IN',
        subjectType: 'user',
        subjectId: created.id,
        actorUserId: created.id,
        occurredAt: now,
      });
      return {
        userId: created.id,
        credentialsVersion: created.credentialsVersion,
        maskedPhone: phone.masked(),
      };
    }

    existing.recordPhoneProof(now, cmd.holderGapDays);
    await this.users.save(existing);
    await this.audit.record({
      action: 'CLIENT_SIGNED_IN',
      subjectType: 'user',
      subjectId: existing.id,
      actorUserId: existing.id,
      occurredAt: now,
    });
    return {
      userId: existing.id,
      credentialsVersion: existing.credentialsVersion,
      maskedPhone: phone.masked(),
    };
  }
}

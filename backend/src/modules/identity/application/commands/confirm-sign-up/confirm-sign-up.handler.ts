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
import { COMMON_PASSWORDS, type CommonPasswords } from '../../../domain/ports/common-passwords.port.js';
import { PASSWORD_HASHER, type PasswordHasher } from '../../../domain/ports/password-hasher.port.js';
import { SECRET_HASHER, type SecretHasher } from '../../../domain/ports/secret-hasher.port.js';
import {
  OTP_CHALLENGE_REPOSITORY,
  type OtpChallengeRepository,
} from '../../../domain/repositories/write/otp-challenge.repository.js';
import { USER_REPOSITORY, type UserRepository } from '../../../domain/repositories/write/user.repository.js';
import { NewPassword } from '../../../domain/value-objects/new-password.js';
import { ConfirmSignUp } from './confirm-sign-up.command.js';
import type { ConfirmSignUpResponse } from './confirm-sign-up.response.js';

@CommandHandler(ConfirmSignUp)
export class ConfirmSignUpHandler implements ICommandHandler<ConfirmSignUp> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(OTP_CHALLENGE_REPOSITORY) private readonly challenges: OtpChallengeRepository,
    @Inject(SECRET_HASHER) private readonly hasher: SecretHasher,
    @Inject(PASSWORD_HASHER) private readonly passwords: PasswordHasher,
    @Inject(COMMON_PASSWORDS) private readonly commonPasswords: CommonPasswords,
    @Inject(AUDIT_TRAIL) private readonly audit: AuditTrail,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(cmd: ConfirmSignUp): Promise<ConfirmSignUpResponse> {
    const phone = PhoneNumber.parse(cmd.phone);
    // Mot de passe vérifié avant le code : un refus ici ne consomme ni essai ni code (E8).
    const password = NewPassword.create(cmd.password, phone, this.commonPasswords);
    const now = this.clock.now();

    const challenge = await this.challenges.findActive(phone, OtpPurpose.SIGN_UP);
    if (!challenge) throw new RefuseAfterCommit(new OtpNoLongerValidError());
    const verification = challenge.verify(cmd.code, now, this.hasher);
    await this.challenges.save(challenge);
    if (!verification.accepted) throw new RefuseAfterCommit(verification.refusal);

    const details = {
      name: cmd.name,
      email: cmd.email,
      passwordHash: await this.passwords.hash(password),
      now,
    };
    const existing = await this.users.findByPhone(phone);
    existing?.completeAsOwner(details);
    const user = existing ?? User.registerOwner({ id: this.ids.next(), phone, ...details });
    await this.users.save(user);

    await this.audit.record({
      action: existing ? 'CLIENT_ACCOUNT_COMPLETED_AS_OWNER' : 'OWNER_ACCOUNT_CREATED',
      subjectType: 'user',
      subjectId: user.id,
      actorUserId: user.id,
      occurredAt: now,
    });
    return {
      userId: user.id,
      credentialsVersion: user.credentialsVersion,
      outcome: existing ? 'COMPLETED' : 'CREATED',
      nextStep: 'CREATE_ORGANIZATION',
    };
  }
}

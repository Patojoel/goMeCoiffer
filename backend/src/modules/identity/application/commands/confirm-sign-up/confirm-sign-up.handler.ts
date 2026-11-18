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
import { PhoneNumber } from '../../../../../shared/domain/phone-number.js';
import { OtpNoLongerValidError } from '../../../domain/errors.js';
import { type CommonPasswords, NewPassword } from '../../../domain/new-password.js';
import {
  COMMON_PASSWORDS,
  OTP_CHALLENGE_REPOSITORY,
  type OtpChallengeRepository,
  PASSWORD_HASHER,
  type PasswordHasher,
  SECRET_HASHER,
  type SecretHasher,
  USER_REPOSITORY,
  type UserRepository,
} from '../../../domain/ports.js';
import { User } from '../../../domain/user.js';
import { ConfirmSignUp, type SignUpResult } from './confirm-sign-up.command.js';

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

  async execute(cmd: ConfirmSignUp): Promise<SignUpResult> {
    const phone = PhoneNumber.parse(cmd.phone);
    // Mot de passe vérifié avant le code : un refus ici ne consomme ni essai ni code (E8).
    const password = NewPassword.create(cmd.password, phone, this.commonPasswords);
    const now = this.clock.now();

    const challenge = await this.challenges.findActive(phone, 'SIGN_UP');
    if (!challenge) return { status: 'REFUSED', refusal: new OtpNoLongerValidError() };
    const verification = challenge.verify(cmd.code, now, this.hasher);
    await this.challenges.save(challenge);
    if (!verification.accepted) return { status: 'REFUSED', refusal: verification.refusal };

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
    return { status: 'SIGNED_UP', userId: user.id, outcome: existing ? 'COMPLETED' : 'CREATED' };
  }
}

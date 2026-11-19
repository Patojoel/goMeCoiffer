import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  AUDIT_TRAIL,
  type AuditTrail,
  CLOCK,
  type Clock,
  REALTIME_PUBLISHER,
  type RealtimePublisher,
} from '../../../../../shared/application/ports.js';
import { RefuseAfterCommit } from '../../../../../shared/application/refuse-after-commit.js';
import { PhoneNumber } from '../../../../../shared/domain/phone-number.js';
import { OtpPurpose } from '../../../domain/enums/otp-purpose.enum.js';
import { OtpNoLongerValidError } from '../../../domain/exceptions/otp-no-longer-valid.error.js';
import { COMMON_PASSWORDS, type CommonPasswords } from '../../../domain/ports/common-passwords.port.js';
import { PASSWORD_HASHER, type PasswordHasher } from '../../../domain/ports/password-hasher.port.js';
import { SECRET_HASHER, type SecretHasher } from '../../../domain/ports/secret-hasher.port.js';
import { USER_SESSIONS, type UserSessions } from '../../../domain/ports/user-sessions.port.js';
import {
  OTP_CHALLENGE_REPOSITORY,
  type OtpChallengeRepository,
} from '../../../domain/repositories/write/otp-challenge.repository.js';
import {
  SIGN_IN_ATTEMPT_REPOSITORY,
  type SignInAttemptRepository,
} from '../../../domain/repositories/write/sign-in-attempt.repository.js';
import { USER_REPOSITORY, type UserRepository } from '../../../domain/repositories/write/user.repository.js';
import { NewPassword } from '../../../domain/value-objects/new-password.js';
import { passwordResetMark } from '../../../domain/value-objects/sign-in-attempt.js';
import { KnownDeviceRegistry } from '../../services/known-device-registry.js';
import { ResetPassword } from './reset-password.command.js';
import type { ResetPasswordResponse } from './reset-password.response.js';

@CommandHandler(ResetPassword)
export class ResetPasswordHandler implements ICommandHandler<ResetPassword> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(OTP_CHALLENGE_REPOSITORY) private readonly challenges: OtpChallengeRepository,
    @Inject(SIGN_IN_ATTEMPT_REPOSITORY) private readonly attempts: SignInAttemptRepository,
    private readonly devices: KnownDeviceRegistry,
    @Inject(USER_SESSIONS) private readonly sessions: UserSessions,
    @Inject(REALTIME_PUBLISHER) private readonly realtime: RealtimePublisher,
    @Inject(SECRET_HASHER) private readonly hasher: SecretHasher,
    @Inject(PASSWORD_HASHER) private readonly passwords: PasswordHasher,
    @Inject(COMMON_PASSWORDS) private readonly commonPasswords: CommonPasswords,
    @Inject(AUDIT_TRAIL) private readonly audit: AuditTrail,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Le mot de passe est vérifié avant le code : un refus ne consomme ni code ni essai. Les confirmations d'un même
   * numéro passent une à une (verrou d'envoi, puis verrou des connexions : le même ordre partout, pas d'interblocage).
   * Tout ce qui suit un code accepté, y compris la fermeture des sessions, est dans la transaction de la commande.
   */
  async execute(cmd: ResetPassword): Promise<ResetPasswordResponse> {
    const phone = PhoneNumber.parse(cmd.phone);
    const password = NewPassword.create(cmd.newPassword, phone, this.commonPasswords);
    await this.challenges.lockSendingFor(phone);
    await this.attempts.lockSignInsFor(phone);
    const now = this.clock.now();

    const challenge = await this.challenges.findActive(phone, OtpPurpose.PASSWORD_RESET);
    if (!challenge) throw new RefuseAfterCommit(new OtpNoLongerValidError());
    const verification = challenge.verify(cmd.code, now, this.hasher);
    await this.challenges.save(challenge);
    if (!verification.accepted) throw new RefuseAfterCommit(verification.refusal);

    const user = await this.users.findByPhone(phone);
    if (!user) throw new RefuseAfterCommit(new OtpNoLongerValidError());
    user.resetPassword(await this.passwords.hash(password), now);
    await this.users.save(user);

    const sessionsClosed = await this.sessions.closeAllOf(user.id);
    this.realtime.closeStreamsOfUser(user.id);
    await this.attempts.add(passwordResetMark(phone.value, now));
    await this.devices.revokeAllOf(user.id, now);
    const found = await this.devices.find(cmd.deviceTokens, user.id);
    const deviceTokens = await this.devices.recognizeAfterSuccess(found, cmd.deviceTokens, user.id, now);

    const trace = { subjectType: 'user', subjectId: user.id, actorUserId: user.id, occurredAt: now };
    await this.audit.record({ ...trace, action: 'PASSWORD_RESET', details: { sessionsClosed } });
    await this.audit.record({ ...trace, action: 'USER_SIGNED_IN', details: { knownDevice: false } });
    return { userId: user.id, credentialsVersion: user.credentialsVersion, deviceTokens };
  }
}

import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../../shared/infrastructure/config/app-config.module.js';
import { INVITEE_ACCOUNTS } from '../../organizations/domain/ports/invitee-accounts.port.js';
import { PHONE_PROOFS } from '../../organizations/domain/ports/phone-proofs.port.js';
import { ConfirmSignUpHandler } from '../application/commands/confirm-sign-up/confirm-sign-up.handler.js';
import { ProveInvitationPhoneHandler } from '../application/commands/prove-invitation-phone/prove-invitation-phone.handler.js';
import { PurgePhoneProofsHandler } from '../application/commands/purge-phone-proofs/purge-phone-proofs.handler.js';
import { PurgeSignInAttemptsHandler } from '../application/commands/purge-sign-in-attempts/purge-sign-in-attempts.handler.js';
import { RequestInvitationCodeHandler } from '../application/commands/request-invitation-code/request-invitation-code.handler.js';
import { RequestSignUpCodeHandler } from '../application/commands/request-sign-up-code/request-sign-up-code.handler.js';
import { RequestPasswordResetCodeHandler } from '../application/commands/request-password-reset-code/request-password-reset-code.handler.js';
import { ResetPasswordHandler } from '../application/commands/reset-password/reset-password.handler.js';
import { SignInHandler } from '../application/commands/sign-in/sign-in.handler.js';
import { SignOutHandler } from '../application/commands/sign-out/sign-out.handler.js';
import { GetMySessionHandler } from '../application/queries/get-my-session/get-my-session.handler.js';
import { SqlPendingInvitationsOfPhone } from '../application/read-repositories/sql-pending-invitations-of-phone.js';
import { SqlOtpSendHistory } from '../application/read-repositories/sql-otp-send-history.js';
import { SqlSignInAttemptHistory } from '../application/read-repositories/sql-sign-in-attempt-history.js';
import { InviteeAccountProvider } from '../application/services/invitee-account-provider.js';
import { PhoneProofReader } from '../application/services/phone-proof-reader.js';
import { KnownDeviceRegistry } from '../application/services/known-device-registry.js';
import { COMMON_PASSWORDS } from '../domain/ports/common-passwords.port.js';
import { DEVICE_TOKEN_GENERATOR } from '../domain/ports/device-token-generator.port.js';
import { OTP_CODE_GENERATOR } from '../domain/ports/otp-code-generator.port.js';
import { PHONE_PROOF_TOKEN_GENERATOR } from '../domain/ports/proof-token-generator.port.js';
import { PASSWORD_HASHER } from '../domain/ports/password-hasher.port.js';
import { PASSWORD_VERIFIER } from '../domain/ports/password-verifier.port.js';
import { SECRET_HASHER } from '../domain/ports/secret-hasher.port.js';
import { SMS_SENDER } from '../domain/ports/sms-sender.port.js';
import { USER_SESSIONS } from '../domain/ports/user-sessions.port.js';
import { OTP_SEND_HISTORY } from '../domain/repositories/read/otp-send-history.read-repository.js';
import { PENDING_INVITATIONS_OF_PHONE } from '../domain/repositories/read/pending-invitations-of-phone.read-repository.js';
import { SIGN_IN_ATTEMPT_HISTORY } from '../domain/repositories/read/sign-in-attempt-history.read-repository.js';
import { KNOWN_DEVICE_REPOSITORY } from '../domain/repositories/write/known-device.repository.js';
import { OTP_CHALLENGE_REPOSITORY } from '../domain/repositories/write/otp-challenge.repository.js';
import { PHONE_PROOF_REPOSITORY } from '../domain/repositories/write/phone-proof.repository.js';
import { SIGN_IN_ATTEMPT_REPOSITORY } from '../domain/repositories/write/sign-in-attempt.repository.js';
import { USER_REPOSITORY } from '../domain/repositories/write/user.repository.js';
import { CommonPasswordList } from './crypto/common-passwords.js';
import {
  Argon2PasswordHasher,
  Argon2PasswordVerifier,
  CryptoDeviceTokenGenerator,
  CryptoOtpCodeGenerator,
  CryptoProofTokenGenerator,
  HmacSecretHasher,
} from './crypto/secrets.js';
import { AuthController } from './http/auth.controller.js';
import { AuthenticatedSessionResponder } from './http/authenticated-session.responder.js';
import { InvitationAccessController } from './http/invitation-access.controller.js';
import { PasswordResetController } from './http/password-reset.controller.js';
import { PhoneProofResponder } from './http/phone-proof.responder.js';
import { SessionController } from './http/session.controller.js';
import { SignUpController } from './http/sign-up.controller.js';
import { TypeOrmKnownDeviceRepository } from './persistence/typeorm-repositories/typeorm-known-device.repository.js';
import { TypeOrmOtpChallengeRepository } from './persistence/typeorm-repositories/typeorm-otp-challenge.repository.js';
import { TypeOrmPhoneProofRepository } from './persistence/typeorm-repositories/typeorm-phone-proof.repository.js';
import { TypeOrmSignInAttemptRepository } from './persistence/typeorm-repositories/typeorm-sign-in-attempt.repository.js';
import { TypeOrmUserSessions } from './persistence/typeorm-repositories/typeorm-user-sessions.js';
import { TypeOrmUserRepository } from './persistence/typeorm-repositories/typeorm-user.repository.js';
import { PurgePhoneProofsTask } from './scheduling/purge-phone-proofs.task.js';
import { PurgeSignInAttemptsTask } from './scheduling/purge-sign-in-attempts.task.js';
import { LoggingSmsSender } from './sms/logging-sms-sender.js';

/**
 * Comptes, connexion, défis SMS et preuve de numéro. Global : il fournit à `organizations` le compte et la preuve de la
 * personne invitée par des tokens de ports (UC-007), sans que l'infrastructure d'un module importe celle de l'autre.
 */
@Global()
@Module({
  controllers: [
    SignUpController,
    AuthController,
    PasswordResetController,
    SessionController,
    InvitationAccessController,
  ],
  providers: [
    RequestSignUpCodeHandler,
    ConfirmSignUpHandler,
    RequestPasswordResetCodeHandler,
    ResetPasswordHandler,
    SignInHandler,
    SignOutHandler,
    PurgeSignInAttemptsHandler,
    RequestInvitationCodeHandler,
    ProveInvitationPhoneHandler,
    PurgePhoneProofsHandler,
    PurgePhoneProofsTask,
    PhoneProofResponder,
    InviteeAccountProvider,
    PhoneProofReader,
    GetMySessionHandler,
    KnownDeviceRegistry,
    AuthenticatedSessionResponder,
    PurgeSignInAttemptsTask,
    { provide: USER_REPOSITORY, useClass: TypeOrmUserRepository },
    { provide: USER_SESSIONS, useClass: TypeOrmUserSessions },
    { provide: OTP_CHALLENGE_REPOSITORY, useClass: TypeOrmOtpChallengeRepository },
    { provide: SIGN_IN_ATTEMPT_REPOSITORY, useClass: TypeOrmSignInAttemptRepository },
    { provide: KNOWN_DEVICE_REPOSITORY, useClass: TypeOrmKnownDeviceRepository },
    { provide: PHONE_PROOF_REPOSITORY, useClass: TypeOrmPhoneProofRepository },
    { provide: PHONE_PROOF_TOKEN_GENERATOR, useClass: CryptoProofTokenGenerator },
    { provide: PENDING_INVITATIONS_OF_PHONE, useClass: SqlPendingInvitationsOfPhone },
    { provide: INVITEE_ACCOUNTS, useExisting: InviteeAccountProvider },
    { provide: PHONE_PROOFS, useExisting: PhoneProofReader },
    { provide: OTP_SEND_HISTORY, useClass: SqlOtpSendHistory },
    { provide: SIGN_IN_ATTEMPT_HISTORY, useClass: SqlSignInAttemptHistory },
    { provide: SECRET_HASHER, useClass: HmacSecretHasher },
    { provide: OTP_CODE_GENERATOR, useClass: CryptoOtpCodeGenerator },
    { provide: DEVICE_TOKEN_GENERATOR, useClass: CryptoDeviceTokenGenerator },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: PASSWORD_VERIFIER, useClass: Argon2PasswordVerifier },
    { provide: COMMON_PASSWORDS, useClass: CommonPasswordList },
    {
      provide: SMS_SENDER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => {
        if (config.SMS_PROVIDER === 'fake')
          return new LoggingSmsSender(['local', 'test'].includes(config.APP_ENV));
        throw new Error(
          `Fournisseur SMS « ${config.SMS_PROVIDER} » non encore branché : voir docs/BACKLOG.md.`,
        );
      },
    },
  ],
  exports: [INVITEE_ACCOUNTS, PHONE_PROOFS],
})
export class IdentityModule {}

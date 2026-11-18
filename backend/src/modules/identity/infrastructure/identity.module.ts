import { Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../../shared/infrastructure/config/app-config.module.js';
import { ConfirmSignUpHandler } from '../application/commands/confirm-sign-up/confirm-sign-up.handler.js';
import { RequestSignUpCodeHandler } from '../application/commands/request-sign-up-code/request-sign-up-code.handler.js';
import { COMMON_PASSWORDS } from '../domain/ports/common-passwords.port.js';
import { OTP_CODE_GENERATOR } from '../domain/ports/otp-code-generator.port.js';
import { PASSWORD_HASHER } from '../domain/ports/password-hasher.port.js';
import { SECRET_HASHER } from '../domain/ports/secret-hasher.port.js';
import { SMS_SENDER } from '../domain/ports/sms-sender.port.js';
import { OTP_CHALLENGE_REPOSITORY } from '../domain/repositories/write/otp-challenge.repository.js';
import { USER_REPOSITORY } from '../domain/repositories/write/user.repository.js';
import { CommonPasswordList } from './crypto/common-passwords.js';
import { Argon2PasswordHasher, CryptoOtpCodeGenerator, HmacSecretHasher } from './crypto/secrets.js';
import { SignUpController } from './http/sign-up.controller.js';
import { TypeOrmOtpChallengeRepository } from './persistence/typeorm-repositories/typeorm-otp-challenge.repository.js';
import { TypeOrmUserRepository } from './persistence/typeorm-repositories/typeorm-user.repository.js';
import { LoggingSmsSender } from './sms/logging-sms-sender.js';

/** Comptes, connexion et défis SMS. */
@Module({
  controllers: [SignUpController],
  providers: [
    RequestSignUpCodeHandler,
    ConfirmSignUpHandler,
    { provide: USER_REPOSITORY, useClass: TypeOrmUserRepository },
    { provide: OTP_CHALLENGE_REPOSITORY, useClass: TypeOrmOtpChallengeRepository },
    { provide: SECRET_HASHER, useClass: HmacSecretHasher },
    { provide: OTP_CODE_GENERATOR, useClass: CryptoOtpCodeGenerator },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
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
})
export class IdentityModule {}

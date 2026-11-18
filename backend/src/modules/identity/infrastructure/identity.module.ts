import { Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../../shared/infrastructure/config/app-config.module.js';
import { ConfirmSignUpHandler } from '../application/commands/confirm-sign-up/confirm-sign-up.handler.js';
import { RequestSignUpCodeHandler } from '../application/commands/request-sign-up-code/request-sign-up-code.handler.js';
import {
  COMMON_PASSWORDS,
  OTP_CHALLENGE_REPOSITORY,
  OTP_CODE_GENERATOR,
  PASSWORD_HASHER,
  SECRET_HASHER,
  SMS_SENDER,
  USER_REPOSITORY,
} from '../domain/ports.js';
import { CommonPasswordList } from './crypto/common-passwords.js';
import { Argon2PasswordHasher, CryptoOtpCodeGenerator, HmacSecretHasher } from './crypto/secrets.js';
import { SignUpController } from './http/sign-up.controller.js';
import { TypeOrmOtpChallengeRepository } from './persistence/typeorm-otp-challenge.repository.js';
import { TypeOrmUserRepository } from './persistence/typeorm-user.repository.js';
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
        if (config.SMS_PROVIDER === 'fake') return new LoggingSmsSender(['local', 'test'].includes(config.APP_ENV));
        throw new Error(
          `Fournisseur SMS « ${config.SMS_PROVIDER} » non encore branché : voir docs/BACKLOG.md.`,
        );
      },
    },
  ],
})
export class IdentityModule {}

import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { getDataSourceToken, TypeOrmModule } from '@nestjs/typeorm';
import { ClsModule } from 'nestjs-cls';
import { LoggerModule } from 'nestjs-pino';
import { AppConfigModule, type AppConfig } from './shared/infrastructure/config/app-config.module.js';
import { dataSourceOptions } from './shared/infrastructure/database/typeorm-options.js';
import {
  onlyWhereDeclared,
  PER_ADDRESS_THROTTLER,
  SIGN_IN_THROTTLER,
} from './shared/infrastructure/http/per-address-throttler.js';
import { ApiResponseInterceptor } from './shared/infrastructure/http/api-response.interceptor.js';
import { DomainExceptionFilter } from './shared/infrastructure/http/domain-exception.filter.js';
import { contractValidationPipe } from './shared/infrastructure/http/validation.pipe.js';
import { safeError } from './shared/infrastructure/logging/safe-error.js';
import { AuthGuard, CsrfGuard, PermissionsGuard } from './shared/infrastructure/security/guards.js';
import { IdentityModule } from './modules/identity/infrastructure/identity.module.js';
import { OrganizationsModule } from './modules/organizations/infrastructure/organizations.module.js';
import { PlatformModule } from './modules/platform/infrastructure/platform.module.js';
import { SharedModule } from './shared/infrastructure/shared.module.js';

const REDACTED = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.otp',
  '*.code',
  '*.token',
  '*.phone',
];

@Module({})
export class AppModule {
  /** La configuration est validée avant la construction du module : les tests E2E passent la leur. */
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        AppConfigModule.forRoot(config),
        LoggerModule.forRoot({
          pinoHttp: {
            level: config.LOG_LEVEL,
            redact: { paths: REDACTED, censor: '[masqué]' },
            serializers: { err: safeError },
            transport:
              config.APP_ENV === 'local'
                ? { target: 'pino-pretty', options: { singleLine: true } }
                : undefined,
            autoLogging: { ignore: (req) => req.url?.startsWith('/api/public/health') ?? false },
          },
        }),
        TypeOrmModule.forRoot(dataSourceOptions(config)),
        ClsModule.forRoot({
          global: true,
          middleware: { mount: true },
          plugins: [
            new ClsPluginTransactional({
              imports: [TypeOrmModule],
              adapter: new TransactionalAdapterTypeOrm({ dataSourceToken: getDataSourceToken() }),
            }),
          ],
        }),
        CqrsModule.forRoot(),
        ScheduleModule.forRoot(),
        ThrottlerModule.forRoot([
          { ttl: config.THROTTLE_TTL_SECONDS * 1000, limit: config.THROTTLE_LIMIT },
          // Limiteurs de la connexion (UC-002), actifs seulement sur les routes qui les déclarent.
          {
            name: SIGN_IN_THROTTLER,
            ttl: 3_600_000,
            limit: config.SIGN_IN_RATE_LIMIT_PER_HOUR,
            skipIf: onlyWhereDeclared(SIGN_IN_THROTTLER),
          },
          {
            name: PER_ADDRESS_THROTTLER,
            ttl: 3_600_000,
            limit: config.SIGN_IN_ADDRESS_RATE_LIMIT_PER_HOUR,
            skipIf: onlyWhereDeclared(PER_ADDRESS_THROTTLER),
          },
        ]),
        SharedModule,
        IdentityModule,
        OrganizationsModule,
        PlatformModule,
      ],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: CsrfGuard },
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
        { provide: APP_PIPE, useFactory: contractValidationPipe },
        { provide: APP_INTERCEPTOR, useClass: ApiResponseInterceptor },
        { provide: APP_FILTER, useClass: DomainExceptionFilter },
      ],
    };
  }
}

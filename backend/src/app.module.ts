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
import { ApiResponseInterceptor } from './shared/infrastructure/http/api-response.interceptor.js';
import { DomainExceptionFilter } from './shared/infrastructure/http/domain-exception.filter.js';
import { contractValidationPipe } from './shared/infrastructure/http/validation.pipe.js';
import { safeError } from './shared/infrastructure/logging/safe-error.js';
import { AuthGuard, CsrfGuard, PermissionsGuard } from './shared/infrastructure/security/guards.js';
import { IdentityModule } from './modules/identity/infrastructure/identity.module.js';
import { SharedModule } from './shared/infrastructure/shared.module.js';

const REDACTED = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.otp',
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
        ThrottlerModule.forRoot([{ ttl: config.THROTTLE_TTL_SECONDS * 1000, limit: config.THROTTLE_LIMIT }]),
        SharedModule,
        IdentityModule,
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

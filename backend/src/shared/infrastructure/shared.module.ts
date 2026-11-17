import { Global, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { AfterCommit } from '../application/after-commit.js';
import { ACTOR_RIGHTS, CLOCK, ID_GENERATOR, READ_DB, REALTIME_PUBLISHER } from '../application/ports.js';
import { TransactionalCommandBus } from '../application/transactional-command-bus.js';
import { APP_CONFIG, type AppConfig } from './config/app-config.module.js';
import { PendingMigrationsCheck } from './database/pending-migrations.guard.js';
import { SystemClock, UuidV7Generator } from './database/system-clock.js';
import { TypeOrmSqlReader } from './database/typeorm-sql-reader.js';
import { DomainEventDispatcher } from './events/domain-event-dispatcher.js';
import { EventSubscriberRegistry } from './events/event-subscriber.registry.js';
import { OutboxRelay } from './events/outbox-relay.js';
import { PublicController } from './http/public.controller.js';
import { RealtimeController } from './realtime/realtime.controller.js';
import { SseRealtimePublisher } from './realtime/sse-realtime.publisher.js';
import { NoRightsYet } from './security/guards.js';
import { RouteProtectionCheck } from './security/route-protection.check.js';
import { CSRF_PROTECTION, csrfProtection } from './security/http-security.js';

/** Socle transverse injectable partout : ports techniques, bus transactionnel, événements, temps réel. */
@Global()
@Module({
  imports: [DiscoveryModule],
  controllers: [PublicController, RealtimeController],
  providers: [
    AfterCommit,
    TransactionalCommandBus,
    EventSubscriberRegistry,
    DomainEventDispatcher,
    OutboxRelay,
    PendingMigrationsCheck,
    RouteProtectionCheck,
    SseRealtimePublisher,
    { provide: REALTIME_PUBLISHER, useExisting: SseRealtimePublisher },
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: UuidV7Generator },
    { provide: READ_DB, useClass: TypeOrmSqlReader },
    { provide: ACTOR_RIGHTS, useClass: NoRightsYet },
    {
      provide: CSRF_PROTECTION,
      useFactory: (config: AppConfig) => csrfProtection(config),
      inject: [APP_CONFIG],
    },
  ],
  exports: [
    AfterCommit,
    TransactionalCommandBus,
    DomainEventDispatcher,
    REALTIME_PUBLISHER,
    CLOCK,
    ID_GENERATOR,
    READ_DB,
    ACTOR_RIGHTS,
    CSRF_PROTECTION,
  ],
})
export class SharedModule {}

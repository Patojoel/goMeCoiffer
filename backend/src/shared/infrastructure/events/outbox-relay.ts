import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { TransactionalCommandBus } from '../../application/transactional-command-bus.js';
import type { IntegrationEvent } from '../../domain/domain-event.js';
import { EventSubscriberRegistry } from './event-subscriber.registry.js';

const MAX_ATTEMPTS = 10;

interface OutboxRow {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  occurred_at: Date;
}

/**
 * Livre les IntegrationEvent de l'outbox à leurs subscribers sur le bus local, une ligne par transaction.
 * Chaque consommateur est idempotent : processed_events (consumer, event_id) empêche un double effet.
 */
@Injectable()
export class OutboxRelay {
  private readonly logger = new Logger(OutboxRelay.name);
  private draining: Promise<void> | null = null;

  constructor(
    private readonly bus: TransactionalCommandBus,
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly registry: EventSubscriberRegistry,
  ) {}

  wake(): void {
    void this.drain();
  }

  @Interval('outbox-relay', 5_000)
  async poll(): Promise<void> {
    await this.drain();
  }

  /** Une seule vidange à la fois par processus ; les autres instances sont exclues par SKIP LOCKED. */
  drain(): Promise<void> {
    this.draining ??= this.drainAll().finally(() => (this.draining = null));
    return this.draining;
  }

  private async drainAll(): Promise<void> {
    while (await this.deliverNext()) {
      /* ligne suivante */
    }
  }

  private async deliverNext(): Promise<boolean> {
    let failed: { id: string; error: unknown } | null = null;
    let found = false;
    try {
      await this.bus.inTransaction(async () => {
        const [row] = (await this.txHost.tx.query(
          `SELECT id, type, payload, occurred_at FROM outbox
            WHERE processed_at IS NULL AND attempts < $1
            ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED`,
          [MAX_ATTEMPTS],
        )) as OutboxRow[];
        if (!row) return;
        found = true;
        try {
          await this.deliver(row);
        } catch (error) {
          failed = { id: row.id, error };
          throw error;
        }
        await this.txHost.tx.query(`UPDATE outbox SET processed_at = now() WHERE id = $1`, [row.id]);
      });
    } catch (error) {
      if (!failed) throw error;
      await this.recordFailure(failed);
    }
    return found && !failed;
  }

  private async deliver(row: OutboxRow): Promise<void> {
    const target = this.registry.integrationSubscribers(row.type);
    if (!target) return;
    const event = Object.assign(Object.create(target.eventClass.prototype) as IntegrationEvent, row.payload, {
      occurredAt: new Date(row.occurred_at),
    });
    for (const subscriber of target.subscribers) {
      const [first] = (await this.txHost.tx.query(
        `INSERT INTO processed_events (consumer, event_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING 1`,
        [subscriber.constructor.name, row.id],
      )) as unknown[];
      if (first) await subscriber.handle(event);
    }
  }

  private async recordFailure({ id, error }: { id: string; error: unknown }): Promise<void> {
    this.logger.error({ err: error, outboxId: id }, 'Livraison d’un événement d’intégration en échec');
    await this.bus.inTransaction(() =>
      this.txHost.tx.query(`UPDATE outbox SET attempts = attempts + 1, last_error = $2 WHERE id = $1`, [
        id,
        error instanceof Error ? error.message.slice(0, 500) : 'erreur inconnue',
      ]),
    );
  }
}

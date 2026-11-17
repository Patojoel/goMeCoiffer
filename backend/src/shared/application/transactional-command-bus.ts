import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';
import { Command, CommandBus } from '@nestjs/cqrs';
import { AfterCommit } from './after-commit.js';

/**
 * Seule porte d'entrée des écritures (HTTP, webhook, tâche) : une transaction par commande,
 * événements de domaine dans la transaction, actions post-commit (outbox, SSE) après le commit.
 */
@Injectable()
export class TransactionalCommandBus {
  constructor(
    private readonly bus: CommandBus,
    private readonly txHost: TransactionHost,
    private readonly afterCommit: AfterCommit,
  ) {}

  execute<R>(command: Command<R>): Promise<R> {
    return this.inTransaction(() => this.bus.execute(command));
  }

  /** Pour le relais d'outbox : même garanties qu'une commande, sans passer par le CommandBus. */
  inTransaction<R>(work: () => Promise<R>): Promise<R> {
    return this.afterCommit.runInScope(() => this.txHost.withTransaction(work));
  }
}

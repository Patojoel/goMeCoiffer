import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';
import { Command, CommandBus } from '@nestjs/cqrs';
import type { BusinessRuleViolation } from '../domain/errors.js';
import { AfterCommit } from './after-commit.js';
import { RefuseAfterCommit } from './refuse-after-commit.js';

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

  /**
   * Pour le relais d'outbox : même garanties qu'une commande, sans passer par le CommandBus.
   * Un `RefuseAfterCommit` commite le travail déjà fait, puis lève l'erreur métier une fois le post-commit joué.
   */
  async inTransaction<R>(work: () => Promise<R>): Promise<R> {
    const outcome = await this.afterCommit.runInScope(() =>
      this.txHost.withTransaction(async (): Promise<Outcome<R>> => {
        try {
          return { done: await work() };
        } catch (error) {
          if (error instanceof RefuseAfterCommit) return { refusal: error.refusal };
          throw error;
        }
      }),
    );
    if ('refusal' in outcome) throw outcome.refusal;
    return outcome.done;
  }
}

type Outcome<R> = { readonly done: R } | { readonly refusal: BusinessRuleViolation };

import { Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

const QUEUE = Symbol('after-commit-queue');
type Callback = () => unknown;
interface Queued {
  readonly callback: Callback;
  /** Lancée sans que la réponse l'attende. */
  readonly detached: boolean;
}

/** File d'actions à exécuter après le commit de la transaction ouverte par le TransactionalCommandBus. */
@Injectable()
export class AfterCommit {
  private readonly logger = new Logger(AfterCommit.name);

  constructor(private readonly cls: ClsService) {}

  /** Hors transaction du bus, l'action part tout de suite. */
  register(callback: Callback): void {
    this.enqueue({ callback, detached: false });
  }

  /**
   * Comme `register`, mais la réponse n'attend pas l'action (envoi d'un SMS : sa durée ne doit pas se lire dans
   * le temps de réponse). Les erreurs sont loggées, jamais propagées.
   */
  registerDetached(callback: Callback): void {
    this.enqueue({ callback, detached: true });
  }

  async runInScope<R>(work: () => Promise<R>): Promise<R> {
    return this.cls.run({ ifNested: 'inherit' }, async () => {
      const queue: Queued[] = [];
      this.cls.set(QUEUE, queue);
      const result = await work();
      this.cls.set(QUEUE, undefined);
      for (const { callback, detached } of queue) {
        if (detached) void this.safely(callback);
        else await this.safely(callback);
      }
      return result;
    });
  }

  private enqueue(item: Queued): void {
    const queue = this.cls.isActive() ? this.cls.get<Queued[] | undefined>(QUEUE) : undefined;
    if (queue) queue.push(item);
    else void this.safely(item.callback);
  }

  private async safely(callback: Callback): Promise<void> {
    try {
      await callback();
    } catch (error) {
      this.logger.error({ err: error }, 'Action post-commit en échec (ignorée)');
    }
  }
}

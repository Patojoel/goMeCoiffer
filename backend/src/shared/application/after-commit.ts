import { Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

const QUEUE = Symbol('after-commit-queue');
type Callback = () => unknown;

/** File d'actions à exécuter après le commit de la transaction ouverte par le TransactionalCommandBus. */
@Injectable()
export class AfterCommit {
  private readonly logger = new Logger(AfterCommit.name);

  constructor(private readonly cls: ClsService) {}

  /** Hors transaction du bus, l'action part tout de suite. */
  register(callback: Callback): void {
    const queue = this.cls.isActive() ? this.cls.get<Callback[] | undefined>(QUEUE) : undefined;
    if (queue) queue.push(callback);
    else void this.safely(callback);
  }

  async runInScope<R>(work: () => Promise<R>): Promise<R> {
    return this.cls.run({ ifNested: 'inherit' }, async () => {
      const queue: Callback[] = [];
      this.cls.set(QUEUE, queue);
      const result = await work();
      this.cls.set(QUEUE, undefined);
      for (const callback of queue) await this.safely(callback);
      return result;
    });
  }

  private async safely(callback: Callback): Promise<void> {
    try {
      await callback();
    } catch (error) {
      this.logger.error({ err: error }, 'Action post-commit en échec (ignorée)');
    }
  }
}

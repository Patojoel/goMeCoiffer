import type { Health } from '@gomecoiffer/contracts';
import type { HealthGateway } from '../../models/gateway/HealthGateway.js';

export class InMemoryHealthGateway implements HealthGateway {
  constructor(private result: Health | Error = { status: 'ok', database: 'up' }) {}

  setResult(result: Health | Error): void {
    this.result = result;
  }

  async check(): Promise<Health> {
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }
}

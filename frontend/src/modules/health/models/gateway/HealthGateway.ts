import type { Health } from '@gomecoiffer/contracts';

export interface HealthGateway {
  check(): Promise<Health>;
}

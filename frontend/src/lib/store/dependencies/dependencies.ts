import type { HttpClient } from '@/lib/http/HttpClient';
import { HealthHttpGateway } from '@/modules/health/infra/repo/HealthHttpGateway';
import type { AppDependencies } from './AppDependencies';

/** Seul endroit qui connaît les adapters HTTP : un nouveau gateway se câble ici. */
export const createDependencies = (http: HttpClient): AppDependencies => ({
  health: new HealthHttpGateway(http),
});

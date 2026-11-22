import { HealthSchema, type Health } from '@gomecoiffer/contracts';
import type { HttpClient } from '../../../../http/HttpClient.js';
import type { HealthGateway } from '../../models/gateway/HealthGateway.js';
import { HEALTH_API_ROUTES } from '../api-routes/HealthApiRoutes.js';

export class HealthHttpGateway implements HealthGateway {
  constructor(private readonly http: HttpClient) {}

  check(): Promise<Health> {
    return this.http.get(HEALTH_API_ROUTES.check, HealthSchema);
  }
}

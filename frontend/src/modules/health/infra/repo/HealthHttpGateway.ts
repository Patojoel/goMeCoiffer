import { HealthSchema, type Health } from '@gomecoiffer/contracts';
import type { HttpClient } from '@/lib/http/HttpClient';
import type { HealthGateway } from '../../models/gateway/HealthGateway';

export class HealthHttpGateway implements HealthGateway {
  constructor(private readonly http: HttpClient) {}

  check(): Promise<Health> {
    return this.http.get('/api/public/health', HealthSchema);
  }
}

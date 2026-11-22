import { describe, expect, it } from 'vitest';
import { HttpError } from '../../../http/HttpError.js';
import { createTestStore } from '../../../store/testing/createTestStore.js';
import { healthApi } from '../infra/api/healthApi.js';
import { InMemoryHealthGateway } from './fakes/InMemoryHealthGateway.js';

describe('Checking service health via RTK Query', () => {
  it('returns API and database status from the injected HealthGateway', async () => {
    const gateway = new InMemoryHealthGateway({ status: 'ok', database: 'down' });
    const store = createTestStore({ health: gateway });

    const result = await store.dispatch(healthApi.endpoints.getHealth.initiate());

    expect(result.data).toEqual({ status: 'ok', database: 'down' });
  });

  it('exposes a serializable ApiFailure when the gateway rejects', async () => {
    const gateway = new InMemoryHealthGateway(
      new HttpError(0, 'NETWORK_ERROR', 'Le serveur est injoignable.'),
    );
    const store = createTestStore({ health: gateway });

    const result = await store.dispatch(healthApi.endpoints.getHealth.initiate());

    expect(result.error).toEqual({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Le serveur est injoignable.',
    });
  });
});

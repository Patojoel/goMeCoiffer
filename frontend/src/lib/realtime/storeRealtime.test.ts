import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { healthApi } from '@/modules/health/infra/api/healthApi';
import { createTestStore } from '@/lib/store/testing/createTestStore';
import { createStoreRealtime } from './storeRealtime';

describe('flux temps réel branché sur le store', () => {
  it('relit les lectures affichées quand le flux revient après une coupure', async () => {
    let calls = 0;
    const store = createTestStore({
      health: {
        check: () => {
          calls++;
          return Promise.resolve({ status: 'ok', database: 'up' });
        },
      },
    });
    const source = {
      onopen: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onmessage: null,
      close: () => undefined,
    };
    const realtime = createStoreRealtime('/api/salon/events', store.dispatch, () => source);
    const subscription = store.dispatch(healthApi.endpoints.getHealth.initiate());
    await subscription;
    realtime.connect();
    source.onopen?.();
    expect(calls).toBe(1);

    source.onerror?.();
    source.onopen?.();

    await waitFor(() => expect(calls).toBe(2));
    subscription.unsubscribe();
  });
});

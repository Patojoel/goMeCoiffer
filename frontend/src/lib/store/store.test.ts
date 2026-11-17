import { describe, expect, it } from 'vitest';
import { activeSalonChanged, sessionCleared, sessionStarted } from '@/lib/rbac/sessionSlice';
import { healthApi } from '@/modules/health/infra/api/healthApi';
import { createTestStore } from './testing/createTestStore';

async function storeWithCachedRead() {
  const store = createTestStore({
    health: { check: () => Promise.resolve({ status: 'ok', database: 'up' }) },
  });
  store.dispatch(sessionStarted({ userId: 'u1', activeSalonId: 's1', permissions: [], systemRoles: [] }));
  await store.dispatch(healthApi.endpoints.getHealth.initiate());
  expect(Object.keys(store.getState().api.queries)).toHaveLength(1);
  return store;
}

describe('cache de lecture', () => {
  it('est vidé quand le salon actif change', async () => {
    const store = await storeWithCachedRead();

    store.dispatch(activeSalonChanged({ salonId: 's2', permissions: [] }));

    expect(store.getState().api.queries).toEqual({});
    expect(store.getState().session.activeSalonId).toBe('s2');
  });

  it('est vidé à la déconnexion', async () => {
    const store = await storeWithCachedRead();

    store.dispatch(sessionCleared());

    expect(store.getState().api.queries).toEqual({});
    expect(store.getState().session.userId).toBeNull();
  });
});

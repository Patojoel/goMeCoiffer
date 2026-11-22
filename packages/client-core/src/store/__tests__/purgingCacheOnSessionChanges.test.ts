import { describe, expect, it } from 'vitest';
import { InMemoryHealthGateway } from '../../modules/health/__tests__/fakes/InMemoryHealthGateway.js';
import { healthApi } from '../../modules/health/infra/api/healthApi.js';
import {
  activeSalonChanged,
  sessionCleared,
  sessionExpired,
  sessionStarted,
} from '../../rbac/sessionSlice.js';
import { createTestStore } from '../testing/createTestStore.js';

async function storeWithCachedRead() {
  const store = createTestStore({ health: new InMemoryHealthGateway() });
  store.dispatch(
    sessionStarted({
      userId: 'u1',
      kind: 'STAFF',
      activeSalonId: 's1',
      permissions: [],
      systemRoles: [],
      maskedPhone: null,
    }),
  );
  await store.dispatch(healthApi.endpoints.getHealth.initiate());
  expect(Object.keys(store.getState().api.queries)).toHaveLength(1);
  return store;
}

describe('Purging cached reads on session changes', () => {
  it('clears cached queries when the active salon changes', async () => {
    const store = await storeWithCachedRead();

    store.dispatch(activeSalonChanged({ salonId: 's2', permissions: ['bookings:manage'] }));

    expect(store.getState().api.queries).toEqual({});
    expect(store.getState().session.activeSalonId).toBe('s2');
    expect(store.getState().session.permissions).toEqual(['bookings:manage']);
  });

  it('clears cached queries and resets session state on sign-out', async () => {
    const store = await storeWithCachedRead();

    store.dispatch(sessionCleared());

    expect(store.getState().api.queries).toEqual({});
    expect(store.getState().session.userId).toBeNull();
  });

  it('clears cached queries when another user signs in on a shared device', async () => {
    const store = await storeWithCachedRead();

    store.dispatch(
      sessionStarted({
        userId: 'u2',
        kind: 'CLIENT',
        activeSalonId: null,
        permissions: [],
        systemRoles: [],
        maskedPhone: '6 55 •• •• 22',
      }),
    );

    expect(store.getState().api.queries).toEqual({});
    expect(store.getState().session.userId).toBe('u2');
  });

  it('clears cached queries on sessionExpired while preserving expiredKind', async () => {
    const store = await storeWithCachedRead();

    store.dispatch(sessionExpired());

    expect(store.getState().api.queries).toEqual({});
    expect(store.getState().session.userId).toBeNull();
    expect(store.getState().session.expiredKind).toBe('STAFF');
  });

  it('keeps cached queries when sessionStarted refreshes the same user, kind and activeSalonId', async () => {
    const store = await storeWithCachedRead();

    store.dispatch(
      sessionStarted({
        userId: 'u1',
        kind: 'STAFF',
        activeSalonId: 's1',
        permissions: ['team:view'],
        systemRoles: [],
        maskedPhone: null,
      }),
    );

    expect(Object.keys(store.getState().api.queries)).toHaveLength(1);
    expect(store.getState().session.permissions).toEqual(['team:view']);
  });

  it('clears cached queries when sessionStarted switches activeSalonId or kind for the same user', async () => {
    const store = await storeWithCachedRead();

    store.dispatch(
      sessionStarted({
        userId: 'u1',
        kind: 'STAFF',
        activeSalonId: 's2',
        permissions: [],
        systemRoles: [],
        maskedPhone: null,
      }),
    );
    expect(store.getState().api.queries).toEqual({});

    await store.dispatch(healthApi.endpoints.getHealth.initiate(undefined, { forceRefetch: true }));
    expect(Object.keys(store.getState().api.queries)).toHaveLength(1);

    store.dispatch(
      sessionStarted({
        userId: 'u1',
        kind: 'CLIENT',
        activeSalonId: null,
        permissions: [],
        systemRoles: [],
        maskedPhone: '6 55 •• •• 22',
      }),
    );
    expect(store.getState().api.queries).toEqual({});

    await store.dispatch(healthApi.endpoints.getHealth.initiate(undefined, { forceRefetch: true }));
    expect(Object.keys(store.getState().api.queries)).toHaveLength(1);

    store.dispatch(
      sessionStarted({
        userId: 'u1',
        kind: 'CLIENT',
        activeSalonId: null,
        permissions: [],
        systemRoles: [],
        maskedPhone: '6 99 •• •• 88',
      }),
    );
    expect(store.getState().api.queries).toEqual({});
  });
});

import {
  clientSessionStateFrom,
  healthApi,
  purgeApiCache,
  selectExpiredSessionKind,
  sessionStarted,
  sessionStateFromSummary,
  type CoreStore,
  type HttpClient,
} from '@gomecoiffer/client-core';
import type { SessionSummary } from '@gomecoiffer/contracts';
import { InMemoryTokenStorage } from '../../storage/InMemoryTokenStorage';
import { createMobileStore } from '../createMobileStore';

const createdStores: CoreStore[] = [];

afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (const store of createdStores.splice(0)) {
    store.dispatch(purgeApiCache());
  }
});

class FakeHttpClient implements HttpClient {
  private readonly unauthorizedListeners = new Set<() => void>();

  async get<T>(): Promise<T> {
    return { status: 'ok', database: 'up' } as T;
  }

  async post<T>(): Promise<T> {
    return {} as T;
  }

  async put<T>(): Promise<T> {
    return {} as T;
  }

  async patch<T>(): Promise<T> {
    return {} as T;
  }

  async delete<T>(): Promise<T> {
    return {} as T;
  }

  onUnauthorized(listener: () => void): () => void {
    this.unauthorizedListeners.add(listener);
    return () => {
      this.unauthorizedListeners.delete(listener);
    };
  }

  emitUnauthorized(): void {
    for (const listener of this.unauthorizedListeners) {
      listener();
    }
  }
}

const staffSummary: SessionSummary = {
  user: { id: '0195f000-0000-7000-8000-000000000a01', name: 'Mireille Ngono' },
  activeSalonId: '0195f000-0000-7000-8000-000000000b01',
  salons: [
    {
      id: '0195f000-0000-7000-8000-000000000b01',
      name: 'Go Beauty Bastos',
      role: 'OWNER',
      city: 'Yaoundé',
      district: 'Bastos',
    },
  ],
  permissions: ['dashboard:view'],
  systemRoles: [],
  nextStep: 'OPEN_SALON',
};

describe('createMobileStore unauthorized handling (M-6, RG-013-17)', () => {
  it('dispatches sessionExpired with expiredKind STAFF or CLIENT and purges API cache on 401', async () => {
    const http = new FakeHttpClient();
    const store = createMobileStore({
      baseUrl: 'https://api.gomecoiffer.test',
      storage: new InMemoryTokenStorage(),
      http,
    });
    createdStores.push(store);

    store.dispatch(sessionStarted(sessionStateFromSummary(staffSummary)));
    await store.dispatch(healthApi.endpoints.getHealth.initiate());
    expect(Object.keys(store.getState().api.queries)).toHaveLength(1);

    http.emitUnauthorized();

    expect(store.getState().session.userId).toBeNull();
    expect(selectExpiredSessionKind(store.getState())).toBe('STAFF');
    expect(store.getState().api.queries).toEqual({});

    store.dispatch(sessionStarted(clientSessionStateFrom('6 55 •• •• 22')));
    expect(selectExpiredSessionKind(store.getState())).toBeNull();

    http.emitUnauthorized();
    expect(selectExpiredSessionKind(store.getState())).toBe('CLIENT');
  });
});

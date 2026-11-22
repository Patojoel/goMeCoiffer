import { describe, expect, it } from 'vitest';
import { createTestStore } from '../../../store/testing/createTestStore.js';
import { clientSpaceApi } from '../infra/api/clientSpaceApi.js';
import { InMemoryClientSpaceGateway } from './fakes/InMemoryClientSpaceGateway.js';

describe('Client SMS access and session isolation (UC-009)', () => {
  it('sends verification SMS and opens a CLIENT session isolated from salon staff permissions', async () => {
    const clientSpace = new InMemoryClientSpaceGateway();
    const store = createTestStore({ clientSpace });

    const codeRes = await store.dispatch(
      clientSpaceApi.endpoints.requestClientCode.initiate({ phone: '6 55 44 33 22', termsAccepted: true }),
    );
    expect(codeRes.data?.maskedPhone).toBe('6 55 •• •• 22');

    const verifyRes = await store.dispatch(
      clientSpaceApi.endpoints.verifyClientCode.initiate({ phone: '6 55 44 33 22', code: '123456' }),
    );
    expect(verifyRes.data?.session.kind).toBe('CLIENT');
    expect(store.getState().session.kind).toBe('CLIENT');
    expect(store.getState().session.maskedPhone).toBe('6 55 •• •• 22');
    expect(store.getState().session.activeSalonId).toBeNull();
  });
});

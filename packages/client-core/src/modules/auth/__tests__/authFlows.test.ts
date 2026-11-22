import { ErrorCode } from '@gomecoiffer/contracts';
import { describe, expect, it } from 'vitest';
import { HttpError } from '../../../http/HttpError.js';
import { createTestStore } from '../../../store/testing/createTestStore.js';
import { InMemoryHealthGateway } from '../../health/__tests__/fakes/InMemoryHealthGateway.js';
import { healthApi } from '../../health/infra/api/healthApi.js';
import { authApi } from '../infra/api/authApi.js';
import { InMemoryAuthGateway } from './fakes/InMemoryAuthGateway.js';

describe('Authentication and owner registration flows (UC-001, UC-002, UC-003)', () => {
  it('opens a STAFF session cleanly on sign-in and clears it on sign-out', async () => {
    const auth = new InMemoryAuthGateway();
    const store = createTestStore({ auth });

    const signInRes = await store.dispatch(
      authApi.endpoints.signIn.initiate({ phone: '6 77 12 34 56', password: 'correct-password' }),
    );
    expect('data' in signInRes).toBe(true);
    expect(store.getState().session.kind).toBe('STAFF');
    expect(store.getState().session.userName).toBe('Mireille Ngono');
    expect(store.getState().session.activeSalonId).toBe('0195f000-0000-7000-8000-000000000b01');
    expect(store.getState().session.salons).toHaveLength(1);

    await store.dispatch(authApi.endpoints.signOut.initiate());
    expect(store.getState().session.userId).toBeNull();
    expect(store.getState().session.kind).toBeNull();
  });

  it('requests SMS verification and opens an empty organization-creation session on sign-up confirmation', async () => {
    const auth = new InMemoryAuthGateway();
    const store = createTestStore({ auth });

    const codeRes = await store.dispatch(
      authApi.endpoints.requestSignUpCode.initiate({ phone: '6 77 12 34 56', acceptedTerms: true }),
    );
    expect(codeRes.data?.maskedPhone).toBe('6 77 •• •• 56');

    const confirmRes = await store.dispatch(
      authApi.endpoints.confirmSignUp.initiate({
        phone: '6 77 12 34 56',
        code: '123456',
        name: 'Mireille Ngono',
        password: 'MotDePasseSolide2026!',
        acceptedTerms: true,
      }),
    );
    expect(confirmRes.data?.nextStep).toBe('CREATE_ORGANIZATION');
    expect(store.getState().session.kind).toBe('STAFF');
    expect(store.getState().session.nextStep).toBe('CREATE_ORGANIZATION');
    expect(store.getState().session.activeSalonId).toBeNull();
  });

  it('returns an actionable ApiFailure on wrong credentials without mutating session', async () => {
    const store = createTestStore({ auth: new InMemoryAuthGateway() });

    const res = await store.dispatch(
      authApi.endpoints.signIn.initiate({ phone: '6 77 12 34 56', password: 'wrong-password' }),
    );
    expect(res.error?.code).toBe('INVALID_CREDENTIALS');
    expect(store.getState().session.userId).toBeNull();
  });

  it('resets password with SMS code and automatically starts the authenticated staff session (UC-003)', async () => {
    const store = createTestStore({ auth: new InMemoryAuthGateway() });

    const res = await store.dispatch(
      authApi.endpoints.resetPassword.initiate({
        phone: '6 77 12 34 56',
        code: '123456',
        newPassword: 'NouveauMotDePasse2026!',
      }),
    );
    expect(res.data?.session.user.name).toBe('Mireille Ngono');
    expect(store.getState().session.kind).toBe('STAFF');
    expect(store.getState().session.nextStep).toBe('OPEN_SALON');
  });

  it.each([
    ['401 UNAUTHENTICATED', new HttpError(401, ErrorCode.UNAUTHENTICATED, 'Session expirée.')],
    ['403 FORBIDDEN', new HttpError(403, ErrorCode.FORBIDDEN, 'Accès refusé.')],
    ['NETWORK_ERROR', new HttpError(0, 'NETWORK_ERROR', 'Le serveur est injoignable.')],
  ])('clears local session and RTK Query cache even when sign-out fails with %s (RG-013-12)', async (_label, failure) => {
    const auth = new InMemoryAuthGateway();
    const health = new InMemoryHealthGateway();
    const store = createTestStore({ auth, health });

    await store.dispatch(
      authApi.endpoints.signIn.initiate({ phone: '6 77 12 34 56', password: 'correct-password' }),
    );
    await store.dispatch(healthApi.endpoints.getHealth.initiate());
    expect(store.getState().session.userId).not.toBeNull();
    expect(Object.keys(store.getState().api.queries)).not.toHaveLength(0);

    auth.nextError = failure;
    const signOutRes = await store.dispatch(authApi.endpoints.signOut.initiate());

    expect('error' in signOutRes).toBe(true);
    expect(store.getState().session.userId).toBeNull();
    expect(store.getState().session.kind).toBeNull();
    expect(store.getState().api.queries).toEqual({});
  });
});

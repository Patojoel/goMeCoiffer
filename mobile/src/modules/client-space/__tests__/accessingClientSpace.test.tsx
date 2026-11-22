import {
  HttpError,
  clientSessionStateFrom,
  purgeApiCache,
  sessionExpired,
  sessionStarted,
  sessionStateFromSummary,
  t,
  type CoreStore,
} from '@gomecoiffer/client-core';
import {
  InMemoryAuthGateway,
  InMemoryClientSpaceGateway,
  createTestStore,
} from '@gomecoiffer/client-core/testing';
import type { SessionSummary } from '@gomecoiffer/contracts';
import { act, render, screen, userEvent } from '@testing-library/react-native';
import { StoreProvider } from '@/lib/store/StoreProvider';
import { ClientSpaceView } from '../ui/client-space-view';

const createdStores: CoreStore[] = [];

afterEach(async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  for (const store of createdStores.splice(0)) {
    store.dispatch(purgeApiCache());
  }
});

function buildStaffSession(systemRoles: string[] = []): SessionSummary {
  return {
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
    systemRoles,
    nextStep: 'OPEN_SALON',
  };
}

async function renderClientSpace(options: {
  mode?: 'bookings' | 'profile';
  clientSpace?: InMemoryClientSpaceGateway;
  auth?: InMemoryAuthGateway;
  isOnline?: boolean;
  store?: CoreStore;
} = {}) {
  const clientSpace = options.clientSpace ?? new InMemoryClientSpaceGateway();
  const auth = options.auth ?? new InMemoryAuthGateway();
  const store = options.store ?? createTestStore({ clientSpace, auth });
  createdStores.push(store);
  const navigated: string[] = [];

  await render(
    <StoreProvider store={store}>
      <ClientSpaceView
        mode={options.mode ?? 'profile'}
        onNavigate={(path) => navigated.push(path)}
        isOnline={options.isOnline ?? true}
      />
    </StoreProvider>,
  );

  return { store, clientSpace, auth, navigated };
}

describe('Accessing client space by SMS on mobile (UC-009)', () => {
  it('blocks SMS code request when offline', async () => {
    await renderClientSpace({ isOnline: false });

    expect(screen.getByText(t('common.offlineActionHint'))).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: t('client.access.sendCode') })).toBeDisabled();
  });

  it('requires terms acceptance before requesting a client SMS code (RG-009-01)', async () => {
    await renderClientSpace();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(t('auth.signIn.phoneLabel')), '6 55 44 33 22');
    await user.press(screen.getByRole('button', { name: t('client.access.sendCode') }));

    expect(
      await screen.findByText("Acceptez les conditions d'utilisation pour continuer."),
    ).toBeOnTheScreen();
  });

  it('completes 2-step SMS access, displays masked phone and bookings empty state, then resets on sign-out', async () => {
    const auth = new InMemoryAuthGateway();
    const { store, navigated } = await renderClientSpace({ mode: 'bookings', auth });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(t('auth.signIn.phoneLabel')), '6 55 44 33 22');
    await user.press(screen.getByRole('checkbox', { name: t('client.access.termsLabel') }));
    await user.press(screen.getByRole('button', { name: t('client.access.sendCode') }));

    expect(
      await screen.findByText(t('auth.signUp.codeSentHint', { maskedPhone: '6 55 •• •• 22', minutes: 5 })),
    ).toBeOnTheScreen();

    await user.type(screen.getByLabelText(t('auth.signUp.codeLabel')), '999999');
    await user.press(screen.getByRole('button', { name: t('client.access.verifySubmit') }));
    expect(await screen.findByText('Code SMS incorrect ou expiré.')).toBeOnTheScreen();
    expect(store.getState().session.kind).toBeNull();

    await user.clear(screen.getByLabelText(t('auth.signUp.codeLabel')));
    await user.type(screen.getByLabelText(t('auth.signUp.codeLabel')), '123456');
    await user.press(screen.getByRole('button', { name: t('client.access.verifySubmit') }));

    expect(
      await screen.findByText(t('client.access.connectedAs', { maskedPhone: '6 55 •• •• 22' })),
    ).toBeOnTheScreen();
    expect(store.getState().session.kind).toBe('CLIENT');
    expect(screen.getByText(t('client.bookings.emptyTitle'))).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: t('client.bookings.exploreAction') }));
    expect(navigated).toEqual(['/(client)/(tabs)']);

    auth.nextError = new HttpError(0, 'NETWORK_ERROR', 'Le serveur est injoignable.');
    await user.press(screen.getByRole('button', { name: t('client.access.signOut') }));

    expect(await screen.findByRole('button', { name: t('client.access.sendCode') })).toBeOnTheScreen();
    expect(store.getState().session.kind).toBeNull();
  });

  it('guides an active STAFF session with salon and admin navigation without asking for SMS', async () => {
    const store = createTestStore({
      clientSpace: new InMemoryClientSpaceGateway(),
      auth: new InMemoryAuthGateway(),
    });
    store.dispatch(sessionStarted(sessionStateFromSummary(buildStaffSession(['SUPER_ADMIN']))));

    const { navigated } = await renderClientSpace({ mode: 'bookings', store });

    expect(screen.getByText(t('client.access.staffActiveHint'))).toBeOnTheScreen();
    expect(screen.getByText(t('client.bookings.emptyTitle'))).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: t('client.access.sendCode') })).not.toBeOnTheScreen();

    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: t('marketplace.openSalonSpace') }));
    await user.press(screen.getByRole('button', { name: t('salons.more.platformAdmin') }));

    expect(navigated).toEqual(['/(salon)/(tabs)', '/(admin)']);
  });

  it('exposes staff sign-in and join-salon links in profile mode when unauthenticated', async () => {
    const { navigated } = await renderClientSpace({ mode: 'profile' });
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: t('common.signIn') }));
    await user.press(screen.getByRole('button', { name: t('auth.signIn.joinWithInvite') }));

    expect(navigated).toEqual(['/connexion', '/rejoindre']);
  });

  it('supports resend code, change phone and profile staff sign-in link when CLIENT is signed in', async () => {
    const clientSpace = new InMemoryClientSpaceGateway();
    let requestCalls = 0;
    const origRequestCode = clientSpace.requestCode.bind(clientSpace);
    clientSpace.requestCode = async (input) => {
      requestCalls += 1;
      return origRequestCode(input);
    };

    const { navigated } = await renderClientSpace({ mode: 'profile', clientSpace });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(t('auth.signIn.phoneLabel')), '6 55 44 33 22');
    await user.press(screen.getByRole('checkbox', { name: t('client.access.termsLabel') }));
    await user.press(screen.getByRole('button', { name: t('client.access.sendCode') }));
    expect(
      await screen.findByText(t('auth.signUp.codeSentHint', { maskedPhone: '6 55 •• •• 22', minutes: 5 })),
    ).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: t('auth.signUp.resendCode') }));
    expect(requestCalls).toBe(2);

    await user.press(screen.getByRole('button', { name: t('auth.signUp.changePhone') }));
    expect(screen.getByRole('button', { name: t('client.access.sendCode') })).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: t('client.access.sendCode') }));
    await user.type(screen.getByLabelText(t('auth.signUp.codeLabel')), '123456');
    await user.press(screen.getByRole('button', { name: t('client.access.verifySubmit') }));

    expect(
      await screen.findByText(t('client.access.connectedAs', { maskedPhone: '6 55 •• •• 22' })),
    ).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: t('common.signIn') }));
    expect(navigated).toEqual(['/connexion']);
  });

  it('displays client expiration warning only when expired session was CLIENT (RG-013-17)', async () => {
    const store = createTestStore({
      clientSpace: new InMemoryClientSpaceGateway(),
      auth: new InMemoryAuthGateway(),
    });
    store.dispatch(sessionStarted(clientSessionStateFrom('6 55 •• •• 22')));
    store.dispatch(sessionExpired());

    await renderClientSpace({ mode: 'bookings', store });

    expect(screen.getByText(t('errors.unauthenticated.client'))).toBeOnTheScreen();

    await act(async () => {
      store.dispatch(sessionStarted(sessionStateFromSummary(buildStaffSession())));
      store.dispatch(sessionExpired());
    });

    expect(screen.queryByText(t('errors.unauthenticated.client'))).not.toBeOnTheScreen();
  });
});

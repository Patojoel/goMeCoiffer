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
  InMemorySalonsGateway,
  createTestStore,
} from '@gomecoiffer/client-core/testing';
import type { NextStep, SessionSummary, SignedIn } from '@gomecoiffer/contracts';
import { act, render, screen, userEvent } from '@testing-library/react-native';
import { Button } from '@/components/ui/button';
import { StoreProvider } from '@/lib/store/StoreProvider';
import { SignInView } from '../ui/sign-in/sign-in-view';
import { useSignOut } from '../ui/sign-out/use-sign-out';

const createdStores: CoreStore[] = [];

afterEach(async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  for (const store of createdStores.splice(0)) {
    store.dispatch(purgeApiCache());
  }
});

function buildSession(overrides: Partial<SessionSummary> = {}): SessionSummary {
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
    systemRoles: [],
    nextStep: 'OPEN_SALON',
    ...overrides,
  };
}

function SignOutProbe({ onNavigate }: { readonly onNavigate: (path: string) => void }) {
  const { signOut, isSigningOut } = useSignOut({ onNavigate });
  return <Button title={t('auth.signOut.action')} onPress={() => void signOut()} loading={isSigningOut} />;
}

async function renderSignIn(options: {
  auth?: InMemoryAuthGateway;
  salons?: InMemorySalonsGateway;
  isOnline?: boolean;
} = {}) {
  const auth = options.auth ?? new InMemoryAuthGateway();
  const salons = options.salons ?? new InMemorySalonsGateway();
  const store = createTestStore({ auth, salons });
  createdStores.push(store);
  const navigated: string[] = [];

  await render(
    <StoreProvider store={store}>
      <SignInView onNavigate={(path) => navigated.push(path)} isOnline={options.isOnline ?? true} />
    </StoreProvider>,
  );

  return { store, auth, salons, navigated };
}

describe('Signing in and signing out on mobile (UC-002, D-040, RG-013-12)', () => {
  it('blocks sign-in submission and displays guidance when offline', async () => {
    const auth = new InMemoryAuthGateway();
    await renderSignIn({ auth, isOnline: false });

    expect(screen.getByText(t('common.offlineActionHint'))).toBeOnTheScreen();
    const submitButton = screen.getByRole('button', { name: t('auth.signIn.submit') });
    expect(submitButton).toBeDisabled();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(t('auth.signIn.phoneLabel')), '6 77 12 34 56');
    await user.type(screen.getByLabelText(t('auth.signIn.passwordLabel')), 'MotDePasse2026!');
    await user.press(submitButton);

    expect(auth.signInCalls).toBe(0);
  });

  it('validates required password before calling the gateway', async () => {
    const { auth, navigated } = await renderSignIn();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(t('auth.signIn.phoneLabel')), '6 77 12 34 56');
    await user.press(screen.getByRole('button', { name: t('auth.signIn.submit') }));

    expect(await screen.findByText('Saisissez votre mot de passe.')).toBeOnTheScreen();
    expect(auth.signInCalls).toBe(0);
    expect(navigated).toEqual([]);
  });

  it('refuses wrong credentials without opening a session or navigating', async () => {
    const { store, navigated } = await renderSignIn();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(t('auth.signIn.phoneLabel')), '6 77 12 34 56');
    await user.type(screen.getByLabelText(t('auth.signIn.passwordLabel')), 'wrong-password');
    await user.press(screen.getByRole('button', { name: t('auth.signIn.submit') }));

    expect(await screen.findByText('Numéro ou mot de passe incorrect.')).toBeOnTheScreen();
    expect(store.getState().session.userId).toBeNull();
    expect(navigated).toEqual([]);
  });

  it('auto-selects the only salon when OPEN_SALON has no activeSalonId (D-040)', async () => {
    const pendingSalonSession = buildSession({ activeSalonId: null, nextStep: 'OPEN_SALON' });
    const auth = new InMemoryAuthGateway(pendingSalonSession);
    const salons = new InMemorySalonsGateway(pendingSalonSession);
    const { store, navigated } = await renderSignIn({ auth, salons });

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(t('auth.signIn.phoneLabel')), '6 77 12 34 56');
    await user.type(screen.getByLabelText(t('auth.signIn.passwordLabel')), 'MotDePasse2026!');
    await user.press(screen.getByRole('button', { name: t('auth.signIn.submit') }));

    expect(navigated).toEqual(['/(salon)/(tabs)']);
    expect(store.getState().session.activeSalonId).toBe('0195f000-0000-7000-8000-000000000b01');
  });

  for (const [nextStep, expectedRoute, patch] of [
    ['OPEN_SALON', '/(salon)/(tabs)', { activeSalonId: '0195f000-0000-7000-8000-000000000b01' }],
    [
      'CHOOSE_SALON',
      '/(salon)/choisir-salon',
      {
        activeSalonId: null,
        salons: [
          {
            id: '0195f000-0000-7000-8000-000000000b01',
            name: 'Go Beauty Bastos',
            role: 'OWNER',
            city: 'Yaoundé',
            district: 'Bastos',
          },
          {
            id: '0195f000-0000-7000-8000-000000000b02',
            name: 'Go Beauty Akwa',
            role: 'OWNER',
            city: 'Douala',
            district: 'Akwa',
          },
        ],
      },
    ],
    ['CREATE_ORGANIZATION', '/(salon)/creer-organisation', { activeSalonId: null, salons: [] }],
    ['PLATFORM_ADMIN', '/(admin)', { activeSalonId: null, salons: [], systemRoles: ['SUPER_ADMIN'] }],
  ] as const satisfies ReadonlyArray<readonly [NextStep, string, Partial<SessionSummary>]>) {
    it(`redirects nextStep ${nextStep} after sign-in to ${expectedRoute}`, async () => {
      const auth = new InMemoryAuthGateway(buildSession({ nextStep, ...patch }));
      const { store, navigated } = await renderSignIn({ auth });

      const user = userEvent.setup();
      await user.type(screen.getByLabelText(t('auth.signIn.phoneLabel')), '6 77 12 34 56');
      await user.type(screen.getByLabelText(t('auth.signIn.passwordLabel')), 'MotDePasse2026!');
      await user.press(screen.getByRole('button', { name: t('auth.signIn.submit') }));

      expect(store.getState().session.kind).toBe('STAFF');
      expect(navigated).toEqual([expectedRoute]);
    });
  }

  it('prevents double submission while sign-in request is pending', async () => {
    let resolveSignIn!: (value: SignedIn) => void;
    const auth = new InMemoryAuthGateway();
    auth.signIn = async () => {
      auth.signInCalls += 1;
      return new Promise<SignedIn>((resolve) => {
        resolveSignIn = resolve;
      });
    };
    const { navigated } = await renderSignIn({ auth });

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(t('auth.signIn.phoneLabel')), '6 77 12 34 56');
    await user.type(screen.getByLabelText(t('auth.signIn.passwordLabel')), 'MotDePasse2026!');

    const submitButton = screen.getByRole('button', { name: t('auth.signIn.submit') });
    await user.press(submitButton);

    expect(submitButton).toBeDisabled();
    await user.press(submitButton);
    expect(auth.signInCalls).toBe(1);

    await act(async () => {
      resolveSignIn({ csrfToken: 'csrf-1', session: buildSession() });
    });

    expect(navigated).toEqual(['/(salon)/(tabs)']);
  });

  it('displays staff guidance and routes to sign-up, password reset and join-salon', async () => {
    const { navigated } = await renderSignIn();

    expect(screen.getByText(t('auth.signIn.createAccountHint'))).toBeOnTheScreen();
    expect(screen.getByText(t('auth.signIn.staffOnlyFoot'))).toBeOnTheScreen();

    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: t('auth.signIn.createAccount') }));
    await user.press(screen.getByRole('button', { name: t('auth.signIn.forgotPasswordLink') }));
    await user.press(screen.getByRole('button', { name: t('auth.signIn.joinWithInvite') }));

    expect(navigated).toEqual(['/inscription', '/mot-de-passe-oublie', '/rejoindre']);
  });

  for (const [label, failure] of [
    ['network error', new HttpError(0, 'NETWORK_ERROR', 'Le serveur est injoignable.')],
    ['401 unauthorized', new HttpError(401, 'UNAUTHENTICATED', 'Session expirée.')],
  ] as const) {
    it(`clears local session and redirects to /connexion on sign-out even on ${label} (RG-013-12)`, async () => {
      const auth = new InMemoryAuthGateway(buildSession());
      const store = createTestStore({ auth });
      createdStores.push(store);
      store.dispatch(sessionStarted(sessionStateFromSummary(buildSession())));
      expect(store.getState().session.userId).not.toBeNull();

      auth.nextError = failure;
      const navigated: string[] = [];

      await render(
        <StoreProvider store={store}>
          <SignOutProbe onNavigate={(path) => navigated.push(path)} />
        </StoreProvider>,
      );
      const user = userEvent.setup();
      await user.press(screen.getByRole('button', { name: t('auth.signOut.action') }));

      expect(store.getState().session.userId).toBeNull();
      expect(store.getState().session.kind).toBeNull();
      expect(navigated).toEqual(['/connexion']);
    });
  }

  it('displays staff expiration warning only when expired session was STAFF (RG-013-17)', async () => {
    const store = createTestStore();
    createdStores.push(store);
    store.dispatch(sessionStarted(sessionStateFromSummary(buildSession())));
    store.dispatch(sessionExpired());

    await render(
      <StoreProvider store={store}>
        <SignInView onNavigate={() => undefined} isOnline={true} />
      </StoreProvider>,
    );

    expect(screen.getByText(t('errors.unauthenticated.staff'))).toBeOnTheScreen();

    await act(async () => {
      store.dispatch(sessionStarted(clientSessionStateFrom('6 55 •• •• 22')));
      store.dispatch(sessionExpired());
    });

    expect(screen.queryByText(t('errors.unauthenticated.staff'))).not.toBeOnTheScreen();
  });
});

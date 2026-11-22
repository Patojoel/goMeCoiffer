import { purgeApiCache, t, type CoreStore } from '@gomecoiffer/client-core';
import {
  InMemoryAuthGateway,
  InMemorySalonsGateway,
  createTestStore,
} from '@gomecoiffer/client-core/testing';
import type { SessionSummary } from '@gomecoiffer/contracts';
import { act, render, screen, userEvent } from '@testing-library/react-native';
import { StoreProvider } from '@/lib/store/StoreProvider';
import { ForgotPasswordView } from '../ui/forgot-password/forgot-password-view';

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

async function renderForgotPassword(options: {
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
      <ForgotPasswordView
        onNavigate={(path) => navigated.push(path)}
        isOnline={options.isOnline ?? true}
      />
    </StoreProvider>,
  );

  return { store, auth, salons, navigated };
}

async function advanceToResetStep(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(t('auth.signIn.phoneLabel')), '6 77 12 34 56');
  await user.press(screen.getByRole('button', { name: t('auth.reset.sendCode') }));
  expect(
    await screen.findByText(t('auth.signUp.codeSentHint', { maskedPhone: '6 77 •• •• 56', minutes: 5 })),
  ).toBeOnTheScreen();
}

describe('Resetting password on mobile (UC-003, D-033, D-040)', () => {
  it('blocks reset code request when offline', async () => {
    await renderForgotPassword({ isOnline: false });

    expect(screen.getByText(t('common.offlineActionHint'))).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: t('auth.reset.sendCode') })).toBeDisabled();
  });

  it('shows D-033 SMS guidance on step 2 and blocks mismatched passwords', async () => {
    const { store, navigated } = await renderForgotPassword();
    const user = userEvent.setup();
    await advanceToResetStep(user);

    expect(screen.getByText(t('auth.reset.noSmsHint'))).toBeOnTheScreen();

    await user.type(screen.getByLabelText(t('auth.signUp.codeLabel')), '123456');
    await user.type(screen.getByLabelText(t('auth.reset.newPasswordLabel')), 'NouveauMotDePasse2027!');
    await user.type(screen.getByLabelText(t('auth.signUp.confirmPasswordLabel')), 'AutreMotDePasse2027!');
    await user.press(screen.getByRole('button', { name: t('auth.reset.submit') }));

    expect(await screen.findByText(t('auth.signUp.passwordMismatch'))).toBeOnTheScreen();
    expect(store.getState().session.userId).toBeNull();
    expect(navigated).toEqual([]);
  });

  it('shows server error when verification code is invalid', async () => {
    const { store, navigated } = await renderForgotPassword();
    const user = userEvent.setup();
    await advanceToResetStep(user);

    await user.type(screen.getByLabelText(t('auth.signUp.codeLabel')), '999999');
    await user.type(screen.getByLabelText(t('auth.reset.newPasswordLabel')), 'NouveauMotDePasse2027!');
    await user.type(screen.getByLabelText(t('auth.signUp.confirmPasswordLabel')), 'NouveauMotDePasse2027!');
    await user.press(screen.getByRole('button', { name: t('auth.reset.submit') }));

    expect(await screen.findByText('Code incorrect ou expiré.')).toBeOnTheScreen();
    expect(store.getState().session.userId).toBeNull();
    expect(navigated).toEqual([]);
  });

  it('resets password, auto-selects single salon (D-040) and redirects to salon space', async () => {
    const pendingSalonSession = buildSession({ activeSalonId: null, nextStep: 'OPEN_SALON' });
    const auth = new InMemoryAuthGateway(pendingSalonSession);
    const salons = new InMemorySalonsGateway(pendingSalonSession);
    const { store, navigated } = await renderForgotPassword({ auth, salons });

    const user = userEvent.setup();
    await advanceToResetStep(user);

    await user.type(screen.getByLabelText(t('auth.signUp.codeLabel')), '123456');
    await user.type(screen.getByLabelText(t('auth.reset.newPasswordLabel')), 'NouveauMotDePasse2027!');
    await user.type(screen.getByLabelText(t('auth.signUp.confirmPasswordLabel')), 'NouveauMotDePasse2027!');
    await user.press(screen.getByRole('button', { name: t('auth.reset.submit') }));

    expect(navigated).toEqual(['/(salon)/(tabs)']);
    expect(store.getState().session.kind).toBe('STAFF');
    expect(store.getState().session.activeSalonId).toBe('0195f000-0000-7000-8000-000000000b01');
  });

  it('supports changing phone and resending reset code', async () => {
    const auth = new InMemoryAuthGateway();
    const { navigated } = await renderForgotPassword({ auth });
    const user = userEvent.setup();
    await advanceToResetStep(user);

    await user.press(screen.getByRole('button', { name: t('auth.signUp.resendCode') }));
    expect(auth.lastRequestedPhone).toBe('6 77 12 34 56');

    await user.press(screen.getByRole('button', { name: t('auth.signUp.changePhone') }));
    expect(screen.getByRole('button', { name: t('auth.reset.sendCode') })).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: t('common.signIn') }));
    expect(navigated).toEqual(['/connexion']);
  });

  it('clears step 2 OTP and passwords when returning to phone step via changePhone (Durcissement 5)', async () => {
    await renderForgotPassword();
    const user = userEvent.setup();
    await advanceToResetStep(user);

    await user.type(screen.getByLabelText(t('auth.signUp.codeLabel')), '123456');
    await user.type(screen.getByLabelText(t('auth.reset.newPasswordLabel')), 'NouveauMotDePasse2027!');
    await user.type(screen.getByLabelText(t('auth.signUp.confirmPasswordLabel')), 'NouveauMotDePasse2027!');

    await user.press(screen.getByRole('button', { name: t('auth.signUp.changePhone') }));
    await user.press(screen.getByRole('button', { name: t('auth.reset.sendCode') }));

    expect(
      await screen.findByText(t('auth.signUp.codeSentHint', { maskedPhone: '6 77 •• •• 56', minutes: 5 })),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText(t('auth.signUp.codeLabel')).props.value).toBe('');
    expect(screen.getByLabelText(t('auth.reset.newPasswordLabel')).props.value).toBe('');
    expect(screen.getByLabelText(t('auth.signUp.confirmPasswordLabel')).props.value).toBe('');
  });
});

import { purgeApiCache, t, type CoreStore } from '@gomecoiffer/client-core';
import { InMemoryAuthGateway, createTestStore } from '@gomecoiffer/client-core/testing';
import type { ConfirmSignUp, SignedUp } from '@gomecoiffer/contracts';
import { act, render, screen, userEvent } from '@testing-library/react-native';
import { StoreProvider } from '@/lib/store/StoreProvider';
import { SignUpView } from '../ui/sign-up/sign-up-view';

const createdStores: CoreStore[] = [];

afterEach(async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  for (const store of createdStores.splice(0)) {
    store.dispatch(purgeApiCache());
  }
});

class SpyAuthGateway extends InMemoryAuthGateway {
  public confirmInputs: ConfirmSignUp[] = [];
  public requestCodeCalls = 0;

  override async requestSignUpCode(input: Parameters<InMemoryAuthGateway['requestSignUpCode']>[0]) {
    this.requestCodeCalls += 1;
    return super.requestSignUpCode(input);
  }

  override async confirmSignUp(input: ConfirmSignUp): Promise<SignedUp> {
    this.confirmInputs.push(input);
    return super.confirmSignUp(input);
  }
}

async function renderSignUp(options: { auth?: SpyAuthGateway; isOnline?: boolean } = {}) {
  const auth = options.auth ?? new SpyAuthGateway();
  const store = createTestStore({ auth });
  createdStores.push(store);
  const navigated: string[] = [];

  await render(
    <StoreProvider store={store}>
      <SignUpView onNavigate={(path) => navigated.push(path)} isOnline={options.isOnline ?? true} />
    </StoreProvider>,
  );

  return { store, auth, navigated };
}

async function advanceToStep2(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(t('auth.signIn.phoneLabel')), '6 77 12 34 56');
  await user.press(screen.getByRole('checkbox', { name: t('auth.signUp.termsLabel') }));
  await user.press(screen.getByRole('button', { name: t('auth.signUp.sendCode') }));
  expect(
    await screen.findByText(t('auth.signUp.codeSentHint', { maskedPhone: '6 77 •• •• 56', minutes: 5 })),
  ).toBeOnTheScreen();
}

describe('Creating owner account on mobile (UC-001)', () => {
  it('disables sign-up code request and explains offline status when disconnected', async () => {
    const auth = new SpyAuthGateway();
    await renderSignUp({ auth, isOnline: false });

    expect(screen.getByText(t('common.offlineActionHint'))).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: t('auth.signUp.sendCode') })).toBeDisabled();
    expect(auth.requestCodeCalls).toBe(0);
  });

  it('requires terms acceptance before requesting SMS verification code (RG-001-16)', async () => {
    const { auth } = await renderSignUp();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(t('auth.signIn.phoneLabel')), '6 77 12 34 56');
    await user.press(screen.getByRole('button', { name: t('auth.signUp.sendCode') }));

    expect(
      await screen.findByText("Acceptez les conditions d'utilisation pour continuer."),
    ).toBeOnTheScreen();
    expect(auth.requestCodeCalls).toBe(0);
  });

  it('validates password confirmation mismatch before calling confirmSignUp', async () => {
    const { auth, navigated } = await renderSignUp();
    const user = userEvent.setup();
    await advanceToStep2(user);

    await user.type(screen.getByLabelText(t('auth.signUp.codeLabel')), '123456');
    await user.type(screen.getByLabelText(t('auth.signUp.nameLabel')), 'Mireille Ngono');
    await user.type(screen.getByLabelText(t('auth.signIn.passwordLabel')), 'MotDePasseSolide2026!');
    await user.type(screen.getByLabelText(t('auth.signUp.confirmPasswordLabel')), 'AutreMotDePasse2026!');
    await user.press(screen.getByRole('button', { name: t('auth.signUp.confirmSubmit') }));

    expect(await screen.findByText(t('auth.signUp.passwordMismatch'))).toBeOnTheScreen();
    expect(auth.confirmInputs).toHaveLength(0);
    expect(navigated).toEqual([]);
  });

  it('displays server error on invalid SMS verification code without navigating', async () => {
    const { store, navigated } = await renderSignUp();
    const user = userEvent.setup();
    await advanceToStep2(user);

    await user.type(screen.getByLabelText(t('auth.signUp.codeLabel')), '999999');
    await user.type(screen.getByLabelText(t('auth.signUp.nameLabel')), 'Mireille Ngono');
    await user.type(screen.getByLabelText(t('auth.signIn.passwordLabel')), 'MotDePasseSolide2026!');
    await user.type(screen.getByLabelText(t('auth.signUp.confirmPasswordLabel')), 'MotDePasseSolide2026!');
    await user.press(screen.getByRole('button', { name: t('auth.signUp.confirmSubmit') }));

    expect(await screen.findByText('Code incorrect ou expiré.')).toBeOnTheScreen();
    expect(store.getState().session.userId).toBeNull();
    expect(navigated).toEqual([]);
  });

  it('completes 2-step sign-up, omits empty email key and redirects to organization creation', async () => {
    const { store, auth, navigated } = await renderSignUp();
    const user = userEvent.setup();
    await advanceToStep2(user);

    await user.type(screen.getByLabelText(t('auth.signUp.codeLabel')), '123456');
    await user.type(screen.getByLabelText(t('auth.signUp.nameLabel')), 'Mireille Ngono');
    await user.type(screen.getByLabelText(t('auth.signIn.passwordLabel')), 'MotDePasseSolide2026!');
    await user.type(screen.getByLabelText(t('auth.signUp.confirmPasswordLabel')), 'MotDePasseSolide2026!');
    await user.press(screen.getByRole('button', { name: t('auth.signUp.confirmSubmit') }));

    expect(navigated).toEqual(['/(salon)/creer-organisation']);
    expect(store.getState().session.kind).toBe('STAFF');
    expect(store.getState().session.nextStep).toBe('CREATE_ORGANIZATION');
    expect(auth.confirmInputs).toHaveLength(1);
    expect(Object.hasOwn(auth.confirmInputs[0] ?? {}, 'email')).toBe(false);
  });

  it('includes optional email when provided and supports resend/change-phone actions', async () => {
    const { auth, navigated } = await renderSignUp();
    const user = userEvent.setup();
    await advanceToStep2(user);

    await user.press(screen.getByRole('button', { name: t('auth.signUp.resendCode') }));
    expect(auth.requestCodeCalls).toBe(2);

    await user.press(screen.getByRole('button', { name: t('auth.signUp.changePhone') }));
    expect(screen.getByRole('button', { name: t('auth.signUp.sendCode') })).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: t('auth.signUp.sendCode') }));
    expect(
      await screen.findByText(t('auth.signUp.codeSentHint', { maskedPhone: '6 77 •• •• 56', minutes: 5 })),
    ).toBeOnTheScreen();

    await user.type(screen.getByLabelText(t('auth.signUp.codeLabel')), '123456');
    await user.type(screen.getByLabelText(t('auth.signUp.nameLabel')), 'Mireille Ngono');
    await user.type(screen.getByLabelText(t('auth.signUp.emailLabel')), 'mireille@gobeauty.cm');
    await user.type(screen.getByLabelText(t('auth.signIn.passwordLabel')), 'MotDePasseSolide2026!');
    await user.type(screen.getByLabelText(t('auth.signUp.confirmPasswordLabel')), 'MotDePasseSolide2026!');
    await user.press(screen.getByRole('button', { name: t('auth.signUp.confirmSubmit') }));

    expect(navigated).toEqual(['/(salon)/creer-organisation']);
    expect(auth.confirmInputs[0]?.email).toBe('mireille@gobeauty.cm');
  });

  it('clears step 2 OTP and credentials when returning to phone step via changePhone (Durcissement 5)', async () => {
    await renderSignUp();
    const user = userEvent.setup();
    await advanceToStep2(user);

    await user.type(screen.getByLabelText(t('auth.signUp.codeLabel')), '123456');
    await user.type(screen.getByLabelText(t('auth.signUp.nameLabel')), 'Mireille Ngono');
    await user.type(screen.getByLabelText(t('auth.signUp.emailLabel')), 'mireille@gobeauty.cm');
    await user.type(screen.getByLabelText(t('auth.signIn.passwordLabel')), 'MotDePasseSolide2026!');
    await user.type(screen.getByLabelText(t('auth.signUp.confirmPasswordLabel')), 'MotDePasseSolide2026!');

    await user.press(screen.getByRole('button', { name: t('auth.signUp.changePhone') }));
    await user.press(screen.getByRole('button', { name: t('auth.signUp.sendCode') }));

    expect(
      await screen.findByText(t('auth.signUp.codeSentHint', { maskedPhone: '6 77 •• •• 56', minutes: 5 })),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText(t('auth.signUp.codeLabel')).props.value).toBe('');
    expect(screen.getByLabelText(t('auth.signUp.nameLabel')).props.value).toBe('');
    expect(screen.getByLabelText(t('auth.signUp.emailLabel')).props.value).toBe('');
    expect(screen.getByLabelText(t('auth.signIn.passwordLabel')).props.value).toBe('');
    expect(screen.getByLabelText(t('auth.signUp.confirmPasswordLabel')).props.value).toBe('');
  });
});

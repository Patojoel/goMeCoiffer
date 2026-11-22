import {
  HttpError,
  formatDateFr,
  purgeApiCache,
  t,
  type AcceptInvitationWire,
  type CoreStore,
} from '@gomecoiffer/client-core';
import { InMemoryJoinSalonGateway, createTestStore } from '@gomecoiffer/client-core/testing';
import type { InvitationAccepted, InvitationsForProvenPhone } from '@gomecoiffer/contracts';
import { act, render, screen, userEvent } from '@testing-library/react-native';
import { StoreProvider } from '@/lib/store/StoreProvider';
import { JoinSalonView } from '../ui/join-salon-view';

const createdStores: CoreStore[] = [];

afterEach(async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  for (const store of createdStores.splice(0)) {
    store.dispatch(purgeApiCache());
  }
});

class SpyJoinSalonGateway extends InMemoryJoinSalonGateway {
  public acceptCalls: Array<{ readonly invitationId: string; readonly input: AcceptInvitationWire }> = [];

  override async acceptInvitation(
    invitationId: string,
    input: AcceptInvitationWire,
  ): Promise<InvitationAccepted> {
    this.acceptCalls.push({ invitationId, input });
    return super.acceptInvitation(invitationId, input);
  }
}

async function renderJoinSalon(options: {
  joinSalon?: SpyJoinSalonGateway;
  isOnline?: boolean;
} = {}) {
  const joinSalon = options.joinSalon ?? new SpyJoinSalonGateway();
  const store = createTestStore({ joinSalon });
  createdStores.push(store);
  const navigated: string[] = [];

  await render(
    <StoreProvider store={store}>
      <JoinSalonView onNavigate={(path) => navigated.push(path)} isOnline={options.isOnline ?? true} />
    </StoreProvider>,
  );

  return { store, joinSalon, navigated };
}

async function provePhoneInView(user: ReturnType<typeof userEvent.setup>, code = '123456') {
  await user.type(screen.getByLabelText(t('auth.signIn.phoneLabel')), '6 70 00 00 02');
  await user.press(screen.getByRole('button', { name: t('auth.join.sendCode') }));
  expect(
    await screen.findByText(t('auth.signUp.codeSentHint', { maskedPhone: '6 70 •• •• 02', minutes: 5 })),
  ).toBeOnTheScreen();

  await user.type(screen.getByLabelText(t('auth.signUp.codeLabel')), code);
  await user.press(screen.getByRole('button', { name: t('auth.join.verifyPhone') }));
}

describe('Joining a salon with invitation on mobile (UC-007)', () => {
  it('blocks code request when offline', async () => {
    await renderJoinSalon({ isOnline: false });

    expect(screen.getByText(t('common.offlineActionHint'))).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: t('auth.join.sendCode') })).toBeDisabled();
  });

  it('shows server error on invalid SMS proof code without loading invitations', async () => {
    const { joinSalon } = await renderJoinSalon();
    const user = userEvent.setup();

    await provePhoneInView(user, '999999');

    expect(await screen.findByText('Code incorrect ou expiré.')).toBeOnTheScreen();
    expect(joinSalon.proven).toBe(false);
  });

  it('shows EmptyState when proven phone has no pending invitations', async () => {
    const joinSalon = new SpyJoinSalonGateway({ account: 'NEW', invitations: [] });
    await renderJoinSalon({ joinSalon });
    const user = userEvent.setup();

    await provePhoneInView(user);

    expect(await screen.findByText(t('auth.join.emptyTitle'))).toBeOnTheScreen();
    expect(screen.getByText(t('auth.join.emptyHint'))).toBeOnTheScreen();
  });

  it('shows ErrorState and retries loading invitations after failure', async () => {
    const joinSalon = new SpyJoinSalonGateway();
    const originalList = joinSalon.listProvenInvitations.bind(joinSalon);
    let shouldFail = true;
    joinSalon.listProvenInvitations = async () => {
      if (shouldFail) {
        shouldFail = false;
        throw new HttpError(0, 'NETWORK_ERROR', 'Le serveur est injoignable.');
      }
      return originalList();
    };

    await renderJoinSalon({ joinSalon });
    const user = userEvent.setup();

    await provePhoneInView(user);

    expect(await screen.findByText(t('errors.network'))).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: t('common.retry') }));

    expect(await screen.findByText('Go Beauty Bastos')).toBeOnTheScreen();
  });

  it('prefills suggestedName for NEW account, creates staff account and navigates to salon (SIGNED_IN)', async () => {
    const joinSalon = new SpyJoinSalonGateway({
      account: 'NEW',
      invitations: [
        {
          invitationId: '0195f000-0000-7000-8000-000000000d10',
          salonName: 'Go Beauty Bastos',
          city: 'Yaoundé',
          district: 'Bastos',
          role: 'HAIRDRESSER',
          expiresAt: '2026-11-27T10:00:00.000Z',
          suggestedName: 'Paul Mbarga',
        },
      ],
    });
    const { store, navigated } = await renderJoinSalon({ joinSalon });
    const user = userEvent.setup();

    await provePhoneInView(user);

    expect(await screen.findByText('Go Beauty Bastos')).toBeOnTheScreen();
    expect(screen.getByText('Yaoundé — Bastos')).toBeOnTheScreen();
    expect(screen.getByText(t('team.role.HAIRDRESSER'))).toBeOnTheScreen();
    expect(
      screen.getByText(t('auth.join.expiresAtLabel', { date: formatDateFr('2026-11-27T10:00:00.000Z') })),
    ).toBeOnTheScreen();
    expect(screen.getByText(t('auth.join.accountNewHint'))).toBeOnTheScreen();

    const nameField = screen.getByLabelText(t('auth.signUp.nameLabel'));
    expect(nameField.props.value).toBe('Paul Mbarga');

    await user.type(screen.getByLabelText(t('auth.signIn.passwordLabel')), 'Wouri-Barber-2027');
    await user.type(screen.getByLabelText(t('auth.signUp.confirmPasswordLabel')), 'Wouri-Barber-2027');
    await user.press(screen.getByRole('checkbox', { name: t('auth.signUp.termsLabel') }));
    await user.press(screen.getByRole('button', { name: t('auth.join.acceptAction') }));

    expect(navigated).toEqual(['/(salon)/(tabs)']);
    expect(store.getState().session.kind).toBe('STAFF');
    expect(joinSalon.acceptCalls[0]).toEqual({
      invitationId: '0195f000-0000-7000-8000-000000000d10',
      input: {
        name: 'Paul Mbarga',
        password: 'Wouri-Barber-2027',
        termsAccepted: true,
      },
    });
  });

  it('accepts invitation in 1 tap for EXISTING account and shows SIGN_IN_REQUIRED guidance', async () => {
    const invitations: InvitationsForProvenPhone['invitations'] = [
      {
        invitationId: '0195f000-0000-7000-8000-000000000d10',
        salonName: 'Go Beauty Bastos',
        city: 'Yaoundé',
        district: 'Bastos',
        role: 'HAIRDRESSER',
        expiresAt: '2026-11-27T10:00:00.000Z',
        suggestedName: 'Paul Mbarga',
      },
      {
        invitationId: '0195f000-0000-7000-8000-000000000d20',
        salonName: 'Élégance Akwa',
        city: 'Douala',
        district: 'Akwa',
        role: 'SALON_ADMIN',
        expiresAt: '2026-11-28T10:00:00.000Z',
        suggestedName: 'Paul Mbarga',
      },
    ];
    const joinSalon = new SpyJoinSalonGateway({ account: 'EXISTING', invitations });
    const { store, navigated } = await renderJoinSalon({ joinSalon });
    const user = userEvent.setup();

    await provePhoneInView(user);

    expect(await screen.findByText('Élégance Akwa')).toBeOnTheScreen();
    expect(screen.getByText(t('auth.join.accountExistingHint'))).toBeOnTheScreen();
    expect(screen.queryByLabelText(t('auth.signIn.passwordLabel'))).not.toBeOnTheScreen();

    await user.press(screen.getByText('Élégance Akwa'));
    await user.press(screen.getByRole('button', { name: t('auth.join.acceptAction') }));

    expect(await screen.findByText(t('auth.join.signInRequiredTitle'))).toBeOnTheScreen();
    expect(
      screen.getByText(t('auth.join.signInRequiredHint', { salonName: 'Élégance Akwa' })),
    ).toBeOnTheScreen();
    expect(joinSalon.acceptCalls[0]).toEqual({
      invitationId: '0195f000-0000-7000-8000-000000000d20',
      input: {},
    });
    expect(store.getState().session.userId).toBeNull();

    await user.press(screen.getByRole('button', { name: t('common.signIn') }));
    expect(navigated).toEqual(['/connexion']);
  });

  it('allows TO_COMPLETE account to edit suggestedName and validates password mismatch', async () => {
    const joinSalon = new SpyJoinSalonGateway({ account: 'TO_COMPLETE' });
    const { navigated } = await renderJoinSalon({ joinSalon });
    const user = userEvent.setup();

    await provePhoneInView(user);
    expect(await screen.findByText(t('auth.join.accountNewHint'))).toBeOnTheScreen();

    const nameField = screen.getByLabelText(t('auth.signUp.nameLabel'));
    await user.clear(nameField);
    await user.type(nameField, 'Pauline Nkodo');
    await user.type(screen.getByLabelText(t('auth.signIn.passwordLabel')), 'Wouri-Barber-2027');
    await user.type(screen.getByLabelText(t('auth.signUp.confirmPasswordLabel')), 'Mismatch-2027');
    await user.press(screen.getByRole('checkbox', { name: t('auth.signUp.termsLabel') }));
    await user.press(screen.getByRole('button', { name: t('auth.join.acceptAction') }));

    expect(await screen.findByText(t('auth.signUp.passwordMismatch'))).toBeOnTheScreen();
    expect(joinSalon.acceptCalls).toHaveLength(0);

    await user.clear(screen.getByLabelText(t('auth.signUp.confirmPasswordLabel')));
    await user.type(screen.getByLabelText(t('auth.signUp.confirmPasswordLabel')), 'Wouri-Barber-2027');
    await user.press(screen.getByRole('button', { name: t('auth.join.acceptAction') }));

    expect(navigated).toEqual(['/(salon)/(tabs)']);
    expect(joinSalon.acceptCalls[0]?.input).toEqual({
      name: 'Pauline Nkodo',
      password: 'Wouri-Barber-2027',
      termsAccepted: true,
    });
  });

  it('clears form drafts, shows loading skeleton while refetching and refreshes invitations after changePhone (Durcissements 4 & 5)', async () => {
    const phoneAInvitations: InvitationsForProvenPhone = {
      account: 'NEW',
      invitations: [
        {
          invitationId: '0195f000-0000-7000-8000-000000000d10',
          salonName: 'Salon Téléphone A',
          city: 'Yaoundé',
          district: 'Bastos',
          role: 'HAIRDRESSER',
          expiresAt: '2026-11-27T10:00:00.000Z',
          suggestedName: 'Alice A',
        },
      ],
    };
    const phoneBInvitations: InvitationsForProvenPhone = {
      account: 'NEW',
      invitations: [
        {
          invitationId: '0195f000-0000-7000-8000-000000000d20',
          salonName: 'Salon Téléphone B',
          city: 'Douala',
          district: 'Akwa',
          role: 'PRACTITIONER',
          expiresAt: '2026-11-28T10:00:00.000Z',
          suggestedName: 'Béatrice B',
        },
      ],
    };

    let fetchCount = 0;
    let releaseSecondFetch!: () => void;
    const secondFetchGate = new Promise<void>((resolve) => {
      releaseSecondFetch = resolve;
    });
    const joinSalon = new SpyJoinSalonGateway(phoneAInvitations);
    joinSalon.listProvenInvitations = async () => {
      fetchCount += 1;
      if (fetchCount === 1) {
        return phoneAInvitations;
      }
      await secondFetchGate;
      return phoneBInvitations;
    };

    await renderJoinSalon({ joinSalon });
    const user = userEvent.setup();

    await provePhoneInView(user);
    expect(await screen.findByText('Salon Téléphone A')).toBeOnTheScreen();

    await user.type(screen.getByLabelText(t('auth.signIn.passwordLabel')), 'TempSecret2027!');
    await user.type(screen.getByLabelText(t('auth.signUp.confirmPasswordLabel')), 'TempSecret2027!');
    await user.press(screen.getByRole('checkbox', { name: t('auth.signUp.termsLabel') }));

    await user.press(screen.getByRole('button', { name: t('auth.signUp.changePhone') }));
    expect(screen.getByRole('button', { name: t('auth.join.sendCode') })).toBeOnTheScreen();

    await user.clear(screen.getByLabelText(t('auth.signIn.phoneLabel')));
    await user.type(screen.getByLabelText(t('auth.signIn.phoneLabel')), '6 71 11 22 33');
    await user.press(screen.getByRole('button', { name: t('auth.join.sendCode') }));
    expect(
      await screen.findByText(t('auth.signUp.codeSentHint', { maskedPhone: '6 70 •• •• 02', minutes: 5 })),
    ).toBeOnTheScreen();

    // OTP code must be reset when returning to phone step.
    expect(screen.getByLabelText(t('auth.signUp.codeLabel')).props.value).toBe('');

    await user.type(screen.getByLabelText(t('auth.signUp.codeLabel')), '123456');
    await user.press(screen.getByRole('button', { name: t('auth.join.verifyPhone') }));

    // While refetching phone B, skeleton is displayed and stale phone A salon is NOT shown.
    expect(await screen.findByRole('status', { busy: true })).toBeOnTheScreen();
    expect(screen.queryByText('Salon Téléphone A')).not.toBeOnTheScreen();

    await act(async () => {
      releaseSecondFetch();
    });

    expect(await screen.findByText('Salon Téléphone B')).toBeOnTheScreen();
    expect(screen.getByLabelText(t('auth.signUp.nameLabel')).props.value).toBe('Béatrice B');
    expect(screen.getByLabelText(t('auth.signIn.passwordLabel')).props.value).toBe('');
    expect(screen.getByLabelText(t('auth.signUp.confirmPasswordLabel')).props.value).toBe('');
    expect(screen.getByRole('checkbox', { name: t('auth.signUp.termsLabel') })).not.toBeChecked();
  });
});

import {
  HttpError,
  purgeApiCache,
  sessionStarted,
  t,
  type CoreStore,
  type SessionState,
} from '@gomecoiffer/client-core';
import { InMemoryTeamGateway, createTestStore } from '@gomecoiffer/client-core/testing';
import type { SalonInvitations, SalonTeam } from '@gomecoiffer/contracts';
import { act, render, screen, userEvent } from '@testing-library/react-native';
import { StoreProvider } from '@/lib/store/StoreProvider';
import { InvitationsListView } from '../ui/invitations/invitations-list-view';
import { SalonTeamWorkspace } from '../ui/salon-team-workspace';

const createdStores: CoreStore[] = [];

afterEach(() => {
  for (const store of createdStores.splice(0)) {
    store.dispatch(purgeApiCache());
  }
});

function buildStaffSession(overrides: Partial<SessionState> = {}): SessionState {
  return {
    userId: '0195f000-0000-7000-8000-000000000a01',
    userName: 'Mireille Ngono',
    kind: 'STAFF',
    activeSalonId: '0195f000-0000-7000-8000-000000000b01',
    salons: [
      {
        id: '0195f000-0000-7000-8000-000000000b01',
        name: 'Go Beauty Akwa',
        role: 'OWNER',
        city: 'Douala',
        district: 'Akwa',
      },
    ],
    permissions: ['staff:view', 'staff:invite', 'staff:manage'],
    systemRoles: [],
    maskedPhone: null,
    nextStep: 'OPEN_SALON',
    ...overrides,
  };
}

async function renderWorkspace(
  options: {
    team?: InMemoryTeamGateway;
    session?: SessionState;
    isOnline?: boolean;
    onOpenExternalUrl?: (url: string) => Promise<void> | void;
  } = {},
) {
  const team = options.team ?? new InMemoryTeamGateway();
  const store = createTestStore({ team });
  createdStores.push(store);
  if (options.session) {
    store.dispatch(sessionStarted(options.session));
  }

  await render(
    <StoreProvider store={store}>
      <SalonTeamWorkspace isOnline={options.isOnline ?? true} onOpenExternalUrl={options.onOpenExternalUrl} />
    </StoreProvider>,
  );

  return { store, team };
}

async function openMember(name: string) {
  const user = userEvent.setup();
  await user.press(await screen.findByRole('button', { name: new RegExp('^' + name + ',') }));
}

function buildManyInvitations(count: number): SalonInvitations {
  return Array.from({ length: count }, (_, index) => ({
    id: `0195f000-0000-7000-8000-${String(index + 1).padStart(12, '0')}`,
    name: `Collaborateur ${index + 1}`,
    phone: `+23767000${String(index).padStart(4, '0')}`,
    role: 'HAIRDRESSER' as const,
    sentAt: '2026-11-19T09:00:00.000Z',
    expiresAt: '2026-11-26T09:00:00.000Z',
    status: 'PENDING' as const,
  }));
}

describe('Salon team and invitations workspace on mobile (UC-006, UC-011)', () => {
  for (const [label, session] of [
    ['staff without staff:view', buildStaffSession({ permissions: ['bookings:view-own'] })],
    [
      'client session even if permissions array were populated',
      buildStaffSession({ kind: 'CLIENT', permissions: ['staff:view'] }),
    ],
  ] as const) {
    it(`refuses access when session is ${label}`, async () => {
      await renderWorkspace({ session });

      expect(screen.getByText(t('errors.forbidden.title'))).toBeOnTheScreen();
      expect(screen.getByText(t('errors.forbidden.permission'))).toBeOnTheScreen();
      expect(screen.queryByText(t('team.section.title'))).not.toBeOnTheScreen();
    });
  }

  it('shows loading state then error state with retry recovery on team load failure', async () => {
    let resolveTeam!: (value: SalonTeam) => void;
    const base = new InMemoryTeamGateway();
    base.listTeam = () =>
      new Promise<SalonTeam>((resolve) => {
        resolveTeam = resolve;
      });
    await renderWorkspace({ team: base, session: buildStaffSession() });

    expect(screen.getByRole('status', { busy: true })).toBeOnTheScreen();
    await act(async () => {
      resolveTeam({ members: [] });
    });
    expect(await screen.findByText(t('team.members.empty'))).toBeOnTheScreen();

    const failingTeam = new InMemoryTeamGateway();
    failingTeam.nextError = new HttpError(0, 'NETWORK_ERROR', 'Le serveur est injoignable.');
    await renderWorkspace({ team: failingTeam, session: buildStaffSession() });

    expect(await screen.findByText(t('errors.network'))).toBeOnTheScreen();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: t('common.retry') }));

    expect(await screen.findByText('Mireille Ngono')).toBeOnTheScreen();
  });

  it('renders active members without any phone number and protects owner and current user rows', async () => {
    const team = new InMemoryTeamGateway({
      members: [
        {
          membershipId: '0195f000-0000-7000-8000-000000000e01',
          name: 'Mireille Ngono',
          role: 'OWNER',
          joinedAt: '2026-11-01T08:00:00.000Z',
          isCurrentUser: false,
          version: 1,
        },
        {
          membershipId: '0195f000-0000-7000-8000-000000000e02',
          name: 'Rodrigue Etoa',
          role: 'SALON_ADMIN',
          joinedAt: '2026-11-05T08:00:00.000Z',
          isCurrentUser: true,
          version: 3,
        },
      ],
    });
    await renderWorkspace({
      team,
      session: buildStaffSession({
        userId: '0195f000-0000-7000-8000-000000000a02',
        userName: 'Rodrigue Etoa',
      }),
    });

    expect(await screen.findByText('Mireille Ngono')).toBeOnTheScreen();
    const user = userEvent.setup();
    await openMember('Mireille Ngono');
    expect(screen.getByText(t('team.directory.joined', { date: '1 nov. 2026' }))).toBeOnTheScreen();
    expect(screen.getByText(t('team.members.ownerProtectedHint'))).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: t('team.members.removeAction') })).not.toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: t('team.directory.back') }));
    expect(screen.getByText(t('team.members.currentUserBadge'))).toBeOnTheScreen();
    await openMember('Rodrigue Etoa');
    expect(screen.getByText(t('team.directory.joined', { date: '5 nov. 2026' }))).toBeOnTheScreen();

    // Neither owner nor current user can be edited or removed
    expect(screen.queryByRole('button', { name: t('team.members.changeRole') })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: t('team.members.removeAction') })).not.toBeOnTheScreen();
    // D-057: never expose any phone number in team roster view
    expect(screen.queryByText(/\+237|6\s?\d{2}/)).not.toBeOnTheScreen();
  });

  it('hides team management actions when session lacks staff:manage', async () => {
    const team = new InMemoryTeamGateway();
    await renderWorkspace({
      team,
      session: buildStaffSession({ permissions: ['staff:view'] }),
    });

    expect(await screen.findByText('Paul Mbarga')).toBeOnTheScreen();
    expect(screen.queryByRole('tablist')).not.toBeOnTheScreen();
    expect(screen.queryByRole('tab', { name: /^Invitations/ })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: t('team.members.changeRole') })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: t('team.members.removeAction') })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: t('team.invite.openAction') })).not.toBeOnTheScreen();
  });

  it('filters members by name and role and preserves search on return from a member', async () => {
    await renderWorkspace({ session: buildStaffSession() });
    const user = userEvent.setup();
    expect(await screen.findByText('Paul Mbarga')).toBeOnTheScreen();
    await user.type(screen.getByLabelText(t('team.directory.search')), 'MBÁRGA');
    expect(screen.queryByText('Mireille Ngono')).not.toBeOnTheScreen();
    await openMember('Paul Mbarga');
    await user.press(screen.getByRole('button', { name: t('team.directory.back') }));
    expect(screen.getByLabelText(t('team.directory.search')).props.value).toBe('MBÁRGA');
    await user.press(screen.getByRole('button', { name: t('team.directory.filter') }));
    await user.press(screen.getByText(t('team.role.OWNER')));
    expect(screen.getByText(t('team.directory.noMatch'))).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: t('team.directory.clear') }));
    expect(screen.getByText('Mireille Ngono')).toBeOnTheScreen();
    expect(screen.getByText('Paul Mbarga')).toBeOnTheScreen();
  });

  it('keeps the member detail usable when the join date cannot be formatted', async () => {
    const member = new InMemoryTeamGateway().members[1]!;
    const team = new InMemoryTeamGateway({ members: [{ ...member, joinedAt: 'invalid' }] });
    await renderWorkspace({ team, session: buildStaffSession() });
    await openMember(member.name);
    expect(screen.getByRole('button', { name: t('team.members.changeRole') })).toBeOnTheScreen();
    expect(screen.queryByText(/Membre depuis/)).not.toBeOnTheScreen();
    await userEvent.setup().press(screen.getByRole('button', { name: t('team.directory.back') }));
    expect(screen.getByLabelText(t('team.directory.search'))).toBeOnTheScreen();
  });

  it('changes collaborator role with optimistic version and updates role description hint', async () => {
    const team = new InMemoryTeamGateway();
    await renderWorkspace({ team, session: buildStaffSession() });

    await openMember('Paul Mbarga');
    expect(screen.getByText(t('team.roleDesc.HAIRDRESSER'))).toBeOnTheScreen();

    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: t('team.members.changeRole') }));
    expect(screen.getByText(t('team.roleDesc.SALON_ADMIN'))).toBeOnTheScreen();
    await user.press(screen.getByText(t('team.role.SALON_ADMIN')));

    expect(await screen.findByText(t('team.roleDesc.SALON_ADMIN'))).toBeOnTheScreen();
    expect(team.members.find((m) => m.name === 'Paul Mbarga')).toMatchObject({
      role: 'SALON_ADMIN',
      version: 3,
    });
  });

  it('shows API error on role change concurrency conflict without losing member row', async () => {
    const team = new InMemoryTeamGateway();
    await renderWorkspace({ team, session: buildStaffSession() });
    await openMember('Paul Mbarga');

    team.nextError = new HttpError(409, 'CONCURRENCY_CONFLICT', 'Le rôle a été modifié entre-temps.');
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: t('team.members.changeRole') }));
    await user.press(screen.getByText(t('team.role.FINANCE_MANAGER')));

    expect(await screen.findByRole('alert')).toHaveTextContent('Le rôle a été modifié entre-temps.');
    expect(team.members.find((m) => m.name === 'Paul Mbarga')?.role).toBe('HAIRDRESSER');
  });

  it('requires inline confirmation before removing a collaborator with version', async () => {
    const team = new InMemoryTeamGateway();
    await renderWorkspace({ team, session: buildStaffSession() });
    await openMember('Paul Mbarga');

    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: t('team.members.removeAction') }));

    expect(screen.getByText(t('team.members.removeConfirmTitle'))).toBeOnTheScreen();
    expect(screen.getByText(t('team.members.removeConfirmHint', { name: 'Paul Mbarga' }))).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: t('team.members.cancelAction') }));
    expect(screen.queryByText(t('team.members.removeConfirmTitle'))).not.toBeOnTheScreen();
    expect(team.members).toHaveLength(2);

    await user.press(screen.getByRole('button', { name: t('team.members.removeAction') }));
    await user.press(screen.getByRole('button', { name: t('team.members.confirmRemove') }));

    expect(await screen.findByText(t('team.members.title', { count: 1 }))).toBeOnTheScreen();
    expect(screen.queryByText('Paul Mbarga')).not.toBeOnTheScreen();
    expect(team.members).toHaveLength(1);
  });

  it('disables team management actions and shows offline guidance when offline', async () => {
    const team = new InMemoryTeamGateway();
    await renderWorkspace({ team, session: buildStaffSession(), isOnline: false });

    await openMember('Paul Mbarga');
    expect(screen.getByText(t('common.offlineActionHint'))).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: t('team.members.changeRole') })).toBeDisabled();
    expect(screen.getByRole('button', { name: t('team.members.removeAction') })).toBeDisabled();
  });

  it('invites a collaborator with dynamic role guidance and shares a safe WhatsApp link without salon name or phone', async () => {
    const team = new InMemoryTeamGateway();
    const openedUrls: string[] = [];
    await renderWorkspace({
      team,
      session: buildStaffSession(),
      onOpenExternalUrl: (url) => {
        openedUrls.push(url);
      },
    });

    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: t('team.invite.openAction') }));

    expect(screen.getByRole('header', { name: t('team.invite.title') })).toBeOnTheScreen();
    expect(screen.getByText(t('team.invite.subtitle'))).toBeOnTheScreen();
    expect(screen.queryByText(t('team.roleDesc.FINANCE_MANAGER'))).not.toBeOnTheScreen();

    await user.type(screen.getByLabelText(t('team.invite.nameLabel')), 'Brice Nana');
    await user.type(screen.getByLabelText(t('team.invite.phoneLabel')), '6 55 44 33 22');
    await user.press(screen.getByRole('button', { name: t('team.invite.roleLabel') }));
    await user.press(screen.getByText(t('team.role.FINANCE_MANAGER')));

    expect(screen.getByText(t('team.roleDesc.FINANCE_MANAGER'))).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: t('team.invite.submit') }));

    expect(await screen.findByText(t('team.invite.successHint', { date: '27 nov. 2026' }))).toBeOnTheScreen();
    expect(team.invitations.some((item) => item.name === 'Brice Nana')).toBe(true);

    await user.press(screen.getByRole('button', { name: t('team.invite.shareWhatsApp') }));
    expect(openedUrls).toHaveLength(1);
    expect(openedUrls[0]).toMatch(/^https:\/\/wa\.me\/\?text=/);
    const decodedText = decodeURIComponent(openedUrls[0]!.replace('https://wa.me/?text=', ''));
    expect(decodedText).toContain('/rejoindre');
    expect(decodedText).not.toContain('Go Beauty Akwa');
    expect(decodedText).not.toContain('6 55 44 33 22');
    expect(decodedText).not.toContain('655443322');
  });

  it('preserves invite draft and disables submission when offline or on API error', async () => {
    const team = new InMemoryTeamGateway();
    await renderWorkspace({ team, session: buildStaffSession() });
    expect(await screen.findByText('Mireille Ngono')).toBeOnTheScreen();

    team.nextError = new HttpError(
      409,
      'ALREADY_SALON_MEMBER',
      'Cette personne travaille déjà dans ce salon.',
    );

    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: t('team.invite.openAction') }));
    await user.type(screen.getByLabelText(t('team.invite.nameLabel')), 'Paul Mbarga');
    await user.type(screen.getByLabelText(t('team.invite.phoneLabel')), '6 77 11 22 33');
    await user.press(screen.getByRole('button', { name: t('team.invite.roleLabel') }));
    await user.press(screen.getByText(t('team.role.PRACTITIONER')));
    await user.press(screen.getByRole('button', { name: t('team.invite.submit') }));

    expect(await screen.findByText('Cette personne travaille déjà dans ce salon.')).toBeOnTheScreen();
    expect(screen.getByLabelText(t('team.invite.nameLabel')).props.value).toBe('Paul Mbarga');

    await renderWorkspace({ team, session: buildStaffSession(), isOnline: false });
    await user.press(screen.getByRole('button', { name: t('team.invite.openAction') }));
    expect(screen.getByRole('button', { name: t('team.invite.submit') })).toBeDisabled();
  });

  it('validates invite fields locally and returns to the directory after closing the invitation screen', async () => {
    const team = new InMemoryTeamGateway();
    await renderWorkspace({ team, session: buildStaffSession() });

    const user = userEvent.setup();
    const toggleButton = screen.getByRole('button', { name: t('team.invite.openAction') });
    await user.press(toggleButton);
    expect(screen.getByRole('header', { name: t('team.invite.title') })).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: t('team.invite.submit') }));
    expect(await screen.findAllByRole('alert')).not.toHaveLength(0);
    expect(team.invitations).toHaveLength(1);

    await user.press(screen.getByRole('button', { name: t('team.directory.back') }));
    expect(screen.queryByRole('header', { name: t('team.invite.title') })).not.toBeOnTheScreen();
  });

  it('handles invitations load error retry and disables cancel when offline', async () => {
    const team = new InMemoryTeamGateway();
    await renderWorkspace({ team, session: buildStaffSession(), isOnline: false });

    const user = userEvent.setup();
    await user.press(screen.getByRole('tab', { name: /^Invitations/ }));
    expect(await screen.findByText('Sandra Kouam')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: t('team.invitations.cancelAction') })).toBeDisabled();

    const failingTeam = new InMemoryTeamGateway();
    failingTeam.listInvitations = async () => {
      throw new HttpError(0, 'NETWORK_ERROR', 'Le serveur est injoignable.');
    };
    await renderWorkspace({ team: failingTeam, session: buildStaffSession() });
    await user.press(screen.getByRole('tab', { name: /^Invitations/ }));
    expect(await screen.findByText(t('errors.network'))).toBeOnTheScreen();

    failingTeam.listInvitations = InMemoryTeamGateway.prototype.listInvitations.bind(failingTeam);
    await user.press(screen.getByRole('button', { name: t('common.retry') }));
    expect(await screen.findByText('Sandra Kouam')).toBeOnTheScreen();
  });

  it('lists invitations, cancels only PENDING when allowed, and shows empty and limit warnings', async () => {
    const team = new InMemoryTeamGateway({
      invitations: [
        {
          id: '0195f000-0000-7000-8000-000000000d01',
          name: 'Sandra Kouam',
          phone: '+237670000002',
          role: 'PRACTITIONER',
          sentAt: '2026-11-19T09:00:00.000Z',
          expiresAt: '2026-11-26T09:00:00.000Z',
          status: 'PENDING',
        },
        {
          id: '0195f000-0000-7000-8000-000000000d02',
          name: null,
          phone: null,
          role: 'HAIRDRESSER',
          sentAt: '2026-10-01T09:00:00.000Z',
          expiresAt: '2026-10-08T09:00:00.000Z',
          status: 'EXPIRED',
        },
      ],
    });
    await renderWorkspace({ team, session: buildStaffSession() });

    const user = userEvent.setup();
    await user.press(screen.getByRole('tab', { name: /^Invitations/ }));

    expect(await screen.findByText('Sandra Kouam')).toBeOnTheScreen();
    expect(screen.getByText('+237670000002')).toBeOnTheScreen();
    expect(screen.getByText(t('team.invitations.status.PENDING'))).toBeOnTheScreen();
    expect(screen.getByText(t('team.invitations.unknownRecipient'))).toBeOnTheScreen();
    expect(screen.getByText(t('team.invitations.status.EXPIRED'))).toBeOnTheScreen();

    expect(screen.getByText(t('team.invitations.expiration', { date: '26 nov. 2026' }))).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: t('team.invite.openAction') }));
    await user.press(screen.getByRole('button', { name: t('team.invitations.back') }));
    expect(screen.getByRole('tab', { name: /^Invitations/ }).props.accessibilityState.selected).toBe(true);

    // Only PENDING invitation shows Cancel button
    const cancelButtons = screen.getAllByRole('button', { name: t('team.invitations.cancelAction') });
    expect(cancelButtons).toHaveLength(1);

    await user.press(cancelButtons[0]!);
    expect(await screen.findByText(t('team.invitations.title', { count: 1 }))).toBeOnTheScreen();
    expect(screen.queryByText('Sandra Kouam')).not.toBeOnTheScreen();

    // Empty state when no invitations
    const emptyTeam = new InMemoryTeamGateway({ invitations: [] });
    await renderWorkspace({ team: emptyTeam, session: buildStaffSession() });
    await user.press(screen.getByRole('tab', { name: /^Invitations/ }));
    expect(await screen.findByText(t('team.invitations.empty'))).toBeOnTheScreen();

    // Limit hint when >= 100 invitations (with staff:invite) and InvitationsListView hides cancel without staff:invite
    const cappedTeam = new InMemoryTeamGateway({ invitations: buildManyInvitations(100) });
    await renderWorkspace({
      team: cappedTeam,
      session: buildStaffSession(),
    });
    await user.press(screen.getByRole('tab', { name: /^Invitations/ }));
    expect(await screen.findByText(t('team.invitations.limitHint'))).toBeOnTheScreen();

    const readOnlyStore = createTestStore({ team: cappedTeam });
    createdStores.push(readOnlyStore);
    readOnlyStore.dispatch(sessionStarted(buildStaffSession({ permissions: ['staff:view'] })));
    await render(
      <StoreProvider store={readOnlyStore}>
        <InvitationsListView isOnline={true} />
      </StoreProvider>,
    );
    expect(await screen.findByText(t('team.invitations.limitHint'))).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: t('team.invitations.cancelAction') })).not.toBeOnTheScreen();
  });

  it('switches back to active members and hides tabs if staff:invite is revoked via SSE demotion (Durcissement 3)', async () => {
    const team = new InMemoryTeamGateway();
    const { store } = await renderWorkspace({ team, session: buildStaffSession() });

    const user = userEvent.setup();
    await user.press(screen.getByRole('tab', { name: /^Invitations/ }));
    expect(await screen.findByText('Sandra Kouam')).toBeOnTheScreen();

    await act(async () => {
      store.dispatch(sessionStarted(buildStaffSession({ permissions: ['staff:view'] })));
    });

    expect(screen.queryByRole('tablist')).not.toBeOnTheScreen();
    expect(screen.queryByText('Sandra Kouam')).not.toBeOnTheScreen();
    expect(await screen.findByText('Paul Mbarga')).toBeOnTheScreen();

    // If staff:invite is later restored, workspace stays on members tab rather than reverting to invitations.
    await act(async () => {
      store.dispatch(sessionStarted(buildStaffSession()));
    });
    expect(screen.getByRole('tab', { name: t('team.tabs.members') }).props.accessibilityState.selected).toBe(
      true,
    );
    expect(screen.getByText('Paul Mbarga')).toBeOnTheScreen();
    expect(screen.queryByText('Sandra Kouam')).not.toBeOnTheScreen();
  });
});

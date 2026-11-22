import {
  HttpError,
  purgeApiCache,
  sessionStarted,
  t,
  type CoreStore,
  type SessionState,
} from '@gomecoiffer/client-core';
import { InMemoryPlatformGateway, createTestStore } from '@gomecoiffer/client-core/testing';
import type { PlatformAdmins } from '@gomecoiffer/contracts';
import { act, render, screen, userEvent } from '@testing-library/react-native';
import { StoreProvider } from '@/lib/store/StoreProvider';
import { PlatformAdminsView } from '../ui/platform-admins-view';

const createdStores: CoreStore[] = [];

afterEach(() => {
  for (const store of createdStores.splice(0)) {
    store.dispatch(purgeApiCache());
  }
});

const SUPER_ADMIN_ID = '0195f000-0000-7000-8000-000000000f01';

function buildAdminSession(overrides: Partial<SessionState> = {}): SessionState {
  return {
    userId: SUPER_ADMIN_ID,
    userName: 'Jean-Paul Kouam',
    kind: 'STAFF',
    activeSalonId: null,
    salons: [],
    permissions: [],
    systemRoles: ['SUPER_ADMIN'],
    maskedPhone: null,
    nextStep: 'PLATFORM_ADMIN',
    ...overrides,
  };
}

async function renderPlatformAdmins(options: {
  platform?: InMemoryPlatformGateway;
  session?: SessionState;
  isOnline?: boolean;
} = {}) {
  const platform = options.platform ?? new InMemoryPlatformGateway();
  const store = createTestStore({ platform });
  createdStores.push(store);
  if (options.session) {
    store.dispatch(sessionStarted(options.session));
  }

  await render(
    <StoreProvider store={store}>
      <PlatformAdminsView isOnline={options.isOnline ?? true} />
    </StoreProvider>,
  );

  return { store, platform };
}

describe('Platform system roles management on mobile (UC-012)', () => {
  for (const [label, session] of [
    ['unauthenticated session', buildAdminSession({ userId: null, kind: null, systemRoles: [] })],
    ['salon owner without SUPER_ADMIN', buildAdminSession({ systemRoles: [] })],
    ['OPERATIONS_ADMIN without SUPER_ADMIN', buildAdminSession({ systemRoles: ['OPERATIONS_ADMIN'] })],
    [
      'CLIENT session even if systemRoles were populated',
      buildAdminSession({ kind: 'CLIENT', systemRoles: ['SUPER_ADMIN'] }),
    ],
  ] as const) {
    it(`refuses access when session is ${label}`, async () => {
      await renderPlatformAdmins({ session });

      expect(screen.getByText(t('errors.forbidden.title'))).toBeOnTheScreen();
      expect(screen.getByText(t('errors.forbidden.systemRole'))).toBeOnTheScreen();
      expect(screen.queryByText(t('platform.title'))).not.toBeOnTheScreen();
    });
  }

  it('shows loading state, error recovery and empty admins state', async () => {
    let resolveAdmins!: (value: PlatformAdmins) => void;
    const pendingPlatform = new InMemoryPlatformGateway([]);
    pendingPlatform.listAdmins = () =>
      new Promise<PlatformAdmins>((resolve) => {
        resolveAdmins = resolve;
      });
    await renderPlatformAdmins({ platform: pendingPlatform, session: buildAdminSession() });

    expect(screen.getByRole('status', { busy: true })).toBeOnTheScreen();
    await act(async () => {
      resolveAdmins({ superAdminCount: 0, admins: [] });
    });

    expect(await screen.findByText(t('platform.emptyAdmins'))).toBeOnTheScreen();
    expect(screen.getByText(t('platform.subtitle', { count: 0 }))).toBeOnTheScreen();

    const failingPlatform = new InMemoryPlatformGateway();
    failingPlatform.nextError = new HttpError(0, 'NETWORK_ERROR', 'Le serveur est injoignable.');
    await renderPlatformAdmins({ platform: failingPlatform, session: buildAdminSession() });

    expect(await screen.findByText(t('errors.network'))).toBeOnTheScreen();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: t('common.retry') }));

    expect(await screen.findByText('Jean-Paul Kouam')).toBeOnTheScreen();
  });

  it('renders platform admins with maskedPhone only and blocks self-revocation and last SUPER_ADMIN revocation', async () => {
    const platform = new InMemoryPlatformGateway([
      {
        userId: SUPER_ADMIN_ID,
        name: 'Jean-Paul Kouam',
        maskedPhone: '6 99 •• •• 01',
        roles: [
          { role: 'SUPER_ADMIN', grantedAt: '2026-11-01T08:00:00.000Z' },
          { role: 'FINANCE_ADMIN', grantedAt: '2026-11-02T08:00:00.000Z' },
        ],
      },
      {
        userId: '0195f000-0000-7000-8000-000000000f02',
        name: 'Serge Kamga',
        maskedPhone: '6 92 •• •• 55',
        roles: [{ role: 'OPERATIONS_ADMIN', grantedAt: '2026-11-03T08:00:00.000Z' }],
      },
    ]);

    await renderPlatformAdmins({ platform, session: buildAdminSession() });

    expect(await screen.findByText('Jean-Paul Kouam')).toBeOnTheScreen();
    expect(screen.getByText(t('platform.subtitle', { count: 1 }))).toBeOnTheScreen();
    expect(screen.getByText('6 99 •• •• 01')).toBeOnTheScreen();
    expect(screen.getByText('6 92 •• •• 55')).toBeOnTheScreen();
    expect(screen.getByText(t('platform.role.SUPER_ADMIN'))).toBeOnTheScreen();
    expect(screen.getByText(t('platform.role.FINANCE_ADMIN'))).toBeOnTheScreen();
    expect(screen.getByText(t('platform.role.OPERATIONS_ADMIN'))).toBeOnTheScreen();

    // Self-revocation is disabled on both of Jean-Paul's roles
    expect(screen.getAllByText(t('platform.revokeSelfDisabled'))).toHaveLength(2);

    const revokeButtons = screen.getAllByRole('button', { name: t('platform.revokeAction') });
    expect(revokeButtons).toHaveLength(3);
    expect(revokeButtons[0]).toBeDisabled();
    expect(revokeButtons[1]).toBeDisabled();
    expect(revokeButtons[2]).toBeEnabled();

    // When another user is the sole SUPER_ADMIN, show revokeLastSuperAdminDisabled
    await renderPlatformAdmins({
      platform: new InMemoryPlatformGateway([
        {
          userId: SUPER_ADMIN_ID,
          name: 'Jean-Paul Kouam',
          maskedPhone: '6 99 •• •• 01',
          roles: [{ role: 'SUPER_ADMIN', grantedAt: '2026-11-01T08:00:00.000Z' }],
        },
      ]),
      session: buildAdminSession({ userId: '0195f000-0000-7000-8000-000000000f99' }),
    });

    expect(
      await screen.findByText(t('platform.revokeLastSuperAdminDisabled')),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: t('platform.revokeAction') })).toBeDisabled();
  });

  it('grants a system role, updates the list, and shows API errors via resolveApiErrorMessage', async () => {
    const platform = new InMemoryPlatformGateway();
    await renderPlatformAdmins({ platform, session: buildAdminSession() });
    expect(await screen.findByText('Jean-Paul Kouam')).toBeOnTheScreen();
    expect(screen.getByText(t('platform.grantHint'))).toBeOnTheScreen();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(t('platform.phoneLabel')), '6 55 44 33 22');
    await user.press(screen.getByRole('button', { name: t('platform.roleLabel') }));
    await user.press(screen.getByRole('button', { name: t('platform.role.SUPER_ADMIN') }));
    await user.press(screen.getByRole('button', { name: t('platform.grantSubmit') }));

    expect(await screen.findByText('Clarisse Fotso')).toBeOnTheScreen();
    expect(screen.getByText(t('platform.subtitle', { count: 2 }))).toBeOnTheScreen();

    // Conflict error on duplicate grant
    platform.nextError = new HttpError(
      409,
      'SYSTEM_ROLE_ALREADY_GRANTED',
      'Cet utilisateur détient déjà ce rôle.',
    );
    await user.type(screen.getByLabelText(t('platform.phoneLabel')), '6 55 44 33 22');
    await user.press(screen.getByRole('button', { name: t('platform.roleLabel') }));
    await user.press(screen.getByRole('button', { name: t('platform.role.SUPER_ADMIN') }));
    await user.press(screen.getByRole('button', { name: t('platform.grantSubmit') }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cet utilisateur détient déjà ce rôle.',
    );
  });

  it('requires inline confirmation before revoking another admin role', async () => {
    const platform = new InMemoryPlatformGateway([
      {
        userId: SUPER_ADMIN_ID,
        name: 'Jean-Paul Kouam',
        maskedPhone: '6 99 •• •• 01',
        roles: [{ role: 'SUPER_ADMIN', grantedAt: '2026-11-01T08:00:00.000Z' }],
      },
      {
        userId: '0195f000-0000-7000-8000-000000000f02',
        name: 'Serge Kamga',
        maskedPhone: '6 92 •• •• 55',
        roles: [{ role: 'OPERATIONS_ADMIN', grantedAt: '2026-11-03T08:00:00.000Z' }],
      },
    ]);
    await renderPlatformAdmins({ platform, session: buildAdminSession() });
    expect(await screen.findByText('Serge Kamga')).toBeOnTheScreen();

    const user = userEvent.setup();
    const revokeButtons = screen.getAllByRole('button', { name: t('platform.revokeAction') });
    await user.press(revokeButtons[1]!);

    expect(screen.getByText(t('platform.revokeConfirmTitle'))).toBeOnTheScreen();
    expect(
      screen.getByText(t('platform.revokeConfirmHint', { name: 'Serge Kamga' })),
    ).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: t('common.cancel') }));
    expect(screen.queryByText(t('platform.revokeConfirmTitle'))).not.toBeOnTheScreen();
    expect(platform.admins).toHaveLength(2);

    const updatedRevokeButtons = screen.getAllByRole('button', { name: t('platform.revokeAction') });
    await user.press(updatedRevokeButtons[1]!);
    await user.press(screen.getByRole('button', { name: t('common.confirm') }));

    expect(await screen.findByText(t('platform.adminsTitle', { count: 1 }))).toBeOnTheScreen();
    expect(screen.queryByText('Serge Kamga')).not.toBeOnTheScreen();
  });

  it('disables grant and revoke actions with guidance when offline', async () => {
    const platform = new InMemoryPlatformGateway([
      {
        userId: SUPER_ADMIN_ID,
        name: 'Jean-Paul Kouam',
        maskedPhone: '6 99 •• •• 01',
        roles: [{ role: 'SUPER_ADMIN', grantedAt: '2026-11-01T08:00:00.000Z' }],
      },
      {
        userId: '0195f000-0000-7000-8000-000000000f02',
        name: 'Serge Kamga',
        maskedPhone: '6 92 •• •• 55',
        roles: [{ role: 'OPERATIONS_ADMIN', grantedAt: '2026-11-03T08:00:00.000Z' }],
      },
    ]);
    await renderPlatformAdmins({ platform, session: buildAdminSession(), isOnline: false });

    expect(await screen.findByText('Serge Kamga')).toBeOnTheScreen();
    expect(screen.getByText(t('common.offlineActionHint'))).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: t('platform.grantSubmit') })).toBeDisabled();
    const revokeButtons = screen.getAllByRole('button', { name: t('platform.revokeAction') });
    expect(revokeButtons[1]).toBeDisabled();
  });

  it('validates grant form locally before calling the gateway', async () => {
    const platform = new InMemoryPlatformGateway();
    await renderPlatformAdmins({ platform, session: buildAdminSession() });
    expect(await screen.findByText('Jean-Paul Kouam')).toBeOnTheScreen();

    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: t('platform.grantSubmit') }));

    expect(await screen.findAllByRole('alert')).not.toHaveLength(0);
    expect(platform.admins).toHaveLength(1);
  });
});

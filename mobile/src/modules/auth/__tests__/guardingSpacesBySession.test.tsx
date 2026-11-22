import {
  HttpError,
  activeSalonChanged,
  clientSessionStateFrom,
  healthApi,
  purgeApiCache,
  rolesApi,
  selectExpiredSessionKind,
  sessionCleared,
  sessionStarted,
  sessionStateFromSummary,
  t,
  teamApi,
  type CoreStore,
  type RealtimeSource,
  type RealtimeSourceCallbacks,
} from '@gomecoiffer/client-core';
import {
  InMemoryAuthGateway,
  InMemoryClientSpaceGateway,
  InMemoryHealthGateway,
  InMemoryRolesGateway,
  InMemoryTeamGateway,
  createTestStore,
} from '@gomecoiffer/client-core/testing';
import type { SessionSummary } from '@gomecoiffer/contracts';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';
import type { AppStateStatus } from 'react-native';
import type { EventSourceOptions, SseMessageEvent } from 'react-native-sse';
import AdminGuardLayout from '@/app/(admin)/_layout';
import SalonSpaceGuardLayout from '@/app/(salon)/_layout';
import AddSalonScreen from '@/app/(salon)/ajouter-salon';
import SalonHoursScreen from '@/app/(salon)/horaires';
import SalonTabsLayout from '@/app/(salon)/(tabs)/_layout';
import SalonTodayScreen from '@/app/(salon)/(tabs)/index';
import SalonMoreScreen from '@/app/(salon)/(tabs)/plus';
import {
  createRealtimeSource,
  type AppStateAdapter,
  type CreateRealtimeSourceOptions,
  type NativeEventSourceLike,
  type NativeSseErrorEvent,
} from '@/lib/realtime/createRealtimeSource';
import { InMemoryTokenStorage } from '@/lib/storage/InMemoryTokenStorage';
import { SessionLifecycle } from '@/lib/store/SessionLifecycle';
import { StoreProvider } from '@/lib/store/StoreProvider';
import { RequireActiveSalonNotice } from '@/modules/salons/ui/require-active-salon';

const createdStores: CoreStore[] = [];

afterEach(async () => {
  jest.useRealTimers();
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  for (const store of createdStores.splice(0)) {
    store.dispatch(purgeApiCache());
  }
});

function buildStaffSession(overrides: Partial<SessionSummary> = {}): SessionSummary {
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

class FakeRealtimeSource implements RealtimeSource {
  callbacks: RealtimeSourceCallbacks | null = null;
  connectCount = 0;
  disconnectCount = 0;
  isConnected = false;

  constructor(readonly options: CreateRealtimeSourceOptions) {}

  connect(callbacks: RealtimeSourceCallbacks): () => void {
    this.connectCount += 1;
    this.isConnected = true;
    this.callbacks = callbacks;
    return () => {
      this.disconnectCount += 1;
      this.isConnected = false;
    };
  }

  emitOpen(): void {
    this.callbacks?.onOpen();
  }

  emitError(): void {
    this.callbacks?.onError();
  }

  emitEvent(type: string, payload: Record<string, unknown> = {}): void {
    this.callbacks?.onMessage(JSON.stringify({ type, payload }));
  }
}

class FakeNativeEventSource implements NativeEventSourceLike {
  private openListeners: (() => void)[] = [];
  private errorListeners: ((event: NativeSseErrorEvent) => void)[] = [];
  private messageListeners: ((event: SseMessageEvent) => void)[] = [];
  closed = false;

  constructor(
    readonly url: string,
    readonly options: EventSourceOptions,
  ) {}

  addEventListener(type: 'open' | 'close' | 'heartbeat', listener: () => void): void;
  addEventListener(type: 'error', listener: (event?: NativeSseErrorEvent) => void): void;
  addEventListener(type: 'message', listener: (event: SseMessageEvent) => void): void;
  addEventListener(type: string, listener: (...args: never[]) => void): void {
    if (type === 'open') this.openListeners.push(listener as () => void);
    if (type === 'error') this.errorListeners.push(listener as (event: NativeSseErrorEvent) => void);
    if (type === 'message') this.messageListeners.push(listener as (event: SseMessageEvent) => void);
  }

  close(): void {
    this.closed = true;
  }

  emitOpen(): void {
    for (const listener of this.openListeners) listener();
  }

  emitError(event: NativeSseErrorEvent = {}): void {
    for (const listener of this.errorListeners) listener(event);
  }
}

class FakeAppState implements AppStateAdapter {
  currentState: AppStateStatus = 'active';
  addEventListener() {
    return { remove: () => {} };
  }
}

describe('Guarding spaces by session and active salon (D-055, UC-004, UC-005, UC-008, UC-013)', () => {
  describe('SalonSpaceGuardLayout', () => {
    it('blocks anonymous sessions with unauthenticated guidance and sign-in link', async () => {
      const store = createTestStore();
      createdStores.push(store);

      await render(
        <StoreProvider store={store}>
          <SalonSpaceGuardLayout />
        </StoreProvider>,
      );

      expect(screen.getByText(t('salon.guard.unauthenticatedHint'))).toBeOnTheScreen();
      const signInLink = screen.getByRole('link', { name: t('common.signIn') });
      expect(signInLink).toBeOnTheScreen();
      expect(signInLink.props.href).toBe('/connexion');
    });

    it('blocks CLIENT sessions with staff-only guidance and sign-in link (D-055)', async () => {
      const store = createTestStore();
      createdStores.push(store);
      store.dispatch(sessionStarted(clientSessionStateFrom('6 55 •• •• 22')));

      await render(
        <StoreProvider store={store}>
          <SalonSpaceGuardLayout />
        </StoreProvider>,
      );

      expect(screen.getByText(t('salon.guard.clientSessionHint'))).toBeOnTheScreen();
      const signInLink = screen.getByRole('link', { name: t('common.signIn') });
      expect(signInLink).toBeOnTheScreen();
      expect(signInLink.props.href).toBe('/connexion');
    });

    it('allows STAFF sessions to render the salon Stack navigator', async () => {
      const store = createTestStore();
      createdStores.push(store);
      store.dispatch(sessionStarted(sessionStateFromSummary(buildStaffSession())));

      await renderRouter(
        {
          '(salon)/_layout': () => (
            <StoreProvider store={store}>
              <SalonSpaceGuardLayout />
            </StoreProvider>
          ),
          '(salon)/(tabs)/index': () => <Text>Contenu salon autorisé</Text>,
          '(salon)/creer-organisation': () => <Text>Créer organisation</Text>,
          '(salon)/choisir-salon': () => <Text>Choisir salon</Text>,
          '(salon)/ajouter-salon': () => <Text>Ajouter salon</Text>,
          '(salon)/roles': () => <Text>Rôles</Text>,
          '(salon)/horaires': () => <Text>Horaires</Text>,
        },
        { initialUrl: '/(salon)/(tabs)' },
      );

      expect(screen.getByText('Contenu salon autorisé')).toBeOnTheScreen();
    });
  });

  describe('RequireActiveSalonNotice', () => {
    it('guides toward organization creation when staff has 0 salons (UC-004)', async () => {
      const store = createTestStore();
      createdStores.push(store);
      store.dispatch(
        sessionStarted(
          sessionStateFromSummary(
            buildStaffSession({
              activeSalonId: null,
              salons: [],
              permissions: [],
              nextStep: 'CREATE_ORGANIZATION',
            }),
          ),
        ),
      );

      await render(
        <StoreProvider store={store}>
          <RequireActiveSalonNotice />
        </StoreProvider>,
      );

      expect(screen.getByText(t('salons.guard.selectTitle'))).toBeOnTheScreen();
      expect(screen.getByText(t('salons.guard.selectHint'))).toBeOnTheScreen();
      const createLink = screen.getByRole('link', { name: t('salons.guard.createAction') });
      expect(createLink).toBeOnTheScreen();
      expect(createLink.props.href).toBe('/creer-organisation');
      const homeLink = screen.getByRole('link', { name: t('common.backHome') });
      expect(homeLink).toBeOnTheScreen();
      expect(homeLink.props.href).toBe('/');
    });

    it('guides toward salon selection when staff has at least 1 salon without activeSalonId (UC-005)', async () => {
      const store = createTestStore();
      createdStores.push(store);
      store.dispatch(
        sessionStarted(
          sessionStateFromSummary(
            buildStaffSession({
              activeSalonId: null,
              permissions: [],
              nextStep: 'CHOOSE_SALON',
            }),
          ),
        ),
      );

      await render(
        <StoreProvider store={store}>
          <RequireActiveSalonNotice />
        </StoreProvider>,
      );

      const chooseLink = screen.getByRole('link', { name: t('salons.guard.chooseAction') });
      expect(chooseLink).toBeOnTheScreen();
      expect(chooseLink.props.href).toBe('/choisir-salon');
      expect(screen.getByRole('link', { name: t('common.backHome') })).toBeOnTheScreen();
    });

    it('renders RequireActiveSalonNotice inside SalonTabsLayout when activeSalonId is null', async () => {
      const store = createTestStore();
      createdStores.push(store);
      store.dispatch(
        sessionStarted(
          sessionStateFromSummary(
            buildStaffSession({
              activeSalonId: null,
              permissions: [],
              nextStep: 'CHOOSE_SALON',
            }),
          ),
        ),
      );

      await render(
        <StoreProvider store={store}>
          <SalonTabsLayout />
        </StoreProvider>,
      );

      expect(screen.getByText(t('salons.guard.selectTitle'))).toBeOnTheScreen();
      expect(screen.getByRole('link', { name: t('salons.guard.chooseAction') })).toBeOnTheScreen();
    });
  });

  describe('SalonMoreScreen permissions and actions (UC-008, UC-010, UC-012)', () => {
    it('hides admin, roles, add-salon and hours links for a hairdresser without those permissions', async () => {
      const store = createTestStore();
      createdStores.push(store);
      store.dispatch(
        sessionStarted(
          sessionStateFromSummary(
            buildStaffSession({
              salons: [
                {
                  id: '0195f000-0000-7000-8000-000000000b01',
                  name: 'Go Beauty Bastos',
                  role: 'HAIRDRESSER',
                  city: 'Yaoundé',
                  district: 'Bastos',
                },
              ],
              permissions: ['bookings:view-own', 'availability:edit-own'],
              systemRoles: [],
            }),
          ),
        ),
      );

      await render(
        <StoreProvider store={store}>
          <SalonMoreScreen />
        </StoreProvider>,
      );

      expect(screen.getByText('Go Beauty Bastos')).toBeOnTheScreen();
      expect(screen.getByRole('link', { name: t('salons.more.switchSalon') })).toBeOnTheScreen();
      expect(screen.getByRole('link', { name: t('common.backHome') })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: t('auth.signOut.action') })).toBeOnTheScreen();

      expect(screen.queryByRole('link', { name: t('salons.more.roles') })).not.toBeOnTheScreen();
      expect(screen.queryByRole('link', { name: t('salons.more.addSalon') })).not.toBeOnTheScreen();
      expect(screen.queryByRole('link', { name: t('salons.more.hours') })).not.toBeOnTheScreen();
      expect(screen.queryByRole('link', { name: t('salons.more.platformAdmin') })).not.toBeOnTheScreen();
    });

    it('shows roles, add-salon and hours links for an owner with those permissions', async () => {
      const store = createTestStore();
      createdStores.push(store);
      store.dispatch(
        sessionStarted(
          sessionStateFromSummary(
            buildStaffSession({
              permissions: ['roles:administer', 'organization:manage-salons', 'salon-settings:edit'],
              systemRoles: [],
            }),
          ),
        ),
      );

      await render(
        <StoreProvider store={store}>
          <SalonMoreScreen />
        </StoreProvider>,
      );

      expect(screen.getByRole('link', { name: t('salons.more.roles') })).toBeOnTheScreen();
      expect(screen.getByRole('link', { name: t('salons.more.addSalon') })).toBeOnTheScreen();
      expect(screen.getByRole('link', { name: t('salons.more.hours') })).toBeOnTheScreen();
      expect(screen.queryByRole('link', { name: t('salons.more.platformAdmin') })).not.toBeOnTheScreen();
    });

    it('shows platform admin link when the staff user has a system role (UC-012)', async () => {
      const store = createTestStore();
      createdStores.push(store);
      store.dispatch(
        sessionStarted(
          sessionStateFromSummary(
            buildStaffSession({
              permissions: ['dashboard:view'],
              systemRoles: ['SUPER_ADMIN'],
            }),
          ),
        ),
      );

      await render(
        <StoreProvider store={store}>
          <SalonMoreScreen />
        </StoreProvider>,
      );

      expect(screen.getByRole('link', { name: t('salons.more.platformAdmin') })).toBeOnTheScreen();
    });

    it('renders active salon card and switch link on SalonTodayScreen', async () => {
      const store = createTestStore();
      createdStores.push(store);
      store.dispatch(sessionStarted(sessionStateFromSummary(buildStaffSession())));

      await render(
        <StoreProvider store={store}>
          <SalonTodayScreen />
        </StoreProvider>,
      );

      expect(screen.getByText('Go Beauty Bastos')).toBeOnTheScreen();
      expect(screen.getByText('Yaoundé — Bastos')).toBeOnTheScreen();
      expect(screen.getByText(t('team.role.OWNER'))).toBeOnTheScreen();
      const switchLink = screen.getByRole('link', { name: t('salons.more.switchSalon') });
      expect(switchLink).toBeOnTheScreen();
      expect(switchLink.props.href).toBe('/choisir-salon');
    });

    it('guards AddSalonScreen and SalonHoursScreen by salon permissions', async () => {
      const deniedStore = createTestStore();
      createdStores.push(deniedStore);
      deniedStore.dispatch(
        sessionStarted(
          sessionStateFromSummary(buildStaffSession({ permissions: ['bookings:view-own'] })),
        ),
      );

      await render(
        <StoreProvider store={deniedStore}>
          <AddSalonScreen />
        </StoreProvider>,
      );
      expect(screen.getByText(t('errors.forbidden.permission'))).toBeOnTheScreen();

      await render(
        <StoreProvider store={deniedStore}>
          <SalonHoursScreen />
        </StoreProvider>,
      );
      expect(screen.getByText(t('errors.forbidden.permission'))).toBeOnTheScreen();

      const allowedStore = createTestStore();
      createdStores.push(allowedStore);
      allowedStore.dispatch(
        sessionStarted(
          sessionStateFromSummary(buildStaffSession({ permissions: ['salon-settings:edit'] })),
        ),
      );

      await render(
        <StoreProvider store={allowedStore}>
          <SalonHoursScreen />
        </StoreProvider>,
      );
      expect(screen.getByText(t('salons.hours.title'))).toBeOnTheScreen();
    });
  });

  describe('AdminGuardLayout (UC-012)', () => {
    it('blocks staff without system roles and CLIENT sessions with forbidden system-role guidance', async () => {
      const staffStore = createTestStore();
      createdStores.push(staffStore);
      staffStore.dispatch(sessionStarted(sessionStateFromSummary(buildStaffSession({ systemRoles: [] }))));

      await render(
        <StoreProvider store={staffStore}>
          <AdminGuardLayout />
        </StoreProvider>,
      );
      expect(screen.getByText(t('errors.forbidden.systemRole'))).toBeOnTheScreen();

      const clientStore = createTestStore();
      createdStores.push(clientStore);
      clientStore.dispatch(sessionStarted(clientSessionStateFrom('6 55 •• •• 22')));

      await render(
        <StoreProvider store={clientStore}>
          <AdminGuardLayout />
        </StoreProvider>,
      );
      expect(screen.getByText(t('errors.forbidden.systemRole'))).toBeOnTheScreen();
    });

    it('allows STAFF sessions with system roles to render the admin Stack navigator', async () => {
      const adminStore = createTestStore();
      createdStores.push(adminStore);
      adminStore.dispatch(
        sessionStarted(
          sessionStateFromSummary(
            buildStaffSession({
              activeSalonId: null,
              salons: [],
              permissions: [],
              systemRoles: ['SUPER_ADMIN'],
              nextStep: 'PLATFORM_ADMIN',
            }),
          ),
        ),
      );

      await renderRouter(
        {
          '(admin)/_layout': () => (
            <StoreProvider store={adminStore}>
              <AdminGuardLayout />
            </StoreProvider>
          ),
          '(admin)/index': () => <Text>Console admin autorisée</Text>,
        },
        { initialUrl: '/(admin)' },
      );

      expect(screen.getByText('Console admin autorisée')).toBeOnTheScreen();
    });
  });

  describe('SessionLifecycle bootstrap (UC-013 A5, D-055, RG-013-17)', () => {
    it('makes no unnecessary network calls on cold iOS start when secure storage is empty', async () => {
      const storage = new InMemoryTokenStorage();
      const auth = new InMemoryAuthGateway(buildStaffSession());
      let getSessionCalls = 0;
      const origGetSession = auth.getSession.bind(auth);
      auth.getSession = async () => {
        getSessionCalls += 1;
        return origGetSession();
      };
      const clientSpace = new InMemoryClientSpaceGateway();
      let getClientSessionCalls = 0;
      const origGetClientSession = clientSpace.getSession.bind(clientSpace);
      clientSpace.getSession = async () => {
        getClientSessionCalls += 1;
        return origGetClientSession();
      };

      const store = createTestStore({ auth, clientSpace });
      createdStores.push(store);

      await render(
        <StoreProvider store={store} storage={storage}>
          <SessionLifecycle platformOs="ios" />
        </StoreProvider>,
      );

      await act(async () => {
        await Promise.resolve();
      });

      expect(getSessionCalls).toBe(0);
      expect(getClientSessionCalls).toBe(0);
      expect(store.getState().session.kind).toBeNull();
    });

    it('restores STAFF session on iOS when a valid token is stored', async () => {
      const storage = new InMemoryTokenStorage({ sessionToken: 'tok-staff' });
      const auth = new InMemoryAuthGateway(buildStaffSession());
      const store = createTestStore({ auth });
      createdStores.push(store);

      await render(
        <StoreProvider store={store} storage={storage}>
          <SessionLifecycle platformOs="ios" />
        </StoreProvider>,
      );

      await waitFor(() => {
        expect(store.getState().session.kind).toBe('STAFF');
      });
      expect(store.getState().session.activeSalonId).toBe('0195f000-0000-7000-8000-000000000b01');
    });

    it('falls back cleanly to CLIENT session when getStaffSession rejects with STAFF_SIGN_IN_REQUIRED (D-055)', async () => {
      const storage = new InMemoryTokenStorage({ sessionToken: 'tok-client' });
      const auth = new InMemoryAuthGateway();
      auth.nextError = new HttpError(
        403,
        'STAFF_SIGN_IN_REQUIRED',
        'Cet espace est réservé aux salons.',
      );
      const clientSpace = new InMemoryClientSpaceGateway({
        kind: 'CLIENT',
        maskedPhone: '6 55 •• •• 22',
      });
      const store = createTestStore({ auth, clientSpace });
      createdStores.push(store);

      await render(
        <StoreProvider store={store} storage={storage}>
          <SessionLifecycle platformOs="ios" />
        </StoreProvider>,
      );

      await waitFor(() => {
        expect(store.getState().session.kind).toBe('CLIENT');
      });
      expect(store.getState().session.maskedPhone).toBe('6 55 •• •• 22');
      expect(await storage.getSessionToken()).toBe('tok-client');
    });

    it('preserves stored token when bootstrap fails with NETWORK_ERROR (RG-013-17)', async () => {
      const storage = new InMemoryTokenStorage({ sessionToken: 'tok-offline' });
      const auth = new InMemoryAuthGateway();
      let getSessionCalls = 0;
      const origGetSession = auth.getSession.bind(auth);
      auth.getSession = async () => {
        getSessionCalls += 1;
        return origGetSession();
      };
      auth.nextError = new HttpError(0, 'NETWORK_ERROR', 'Le serveur est injoignable.');
      const store = createTestStore({ auth });
      createdStores.push(store);

      await render(
        <StoreProvider store={store} storage={storage}>
          <SessionLifecycle platformOs="ios" />
        </StoreProvider>,
      );

      await waitFor(() => {
        expect(getSessionCalls).toBe(1);
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(await storage.getSessionToken()).toBe('tok-offline');
      expect(store.getState().session.kind).toBeNull();
    });
  });

  describe('SessionLifecycle SSE realtime bridge (RG-013-08, RG-013-10, RG-013-11)', () => {
    it('opens SSE only when STAFF has an activeSalonId, invalidates targeted tags per event, and invalidates all reads on reconnect', async () => {
      const storage = new InMemoryTokenStorage();
      const auth = new InMemoryAuthGateway(buildStaffSession());
      const roles = new InMemoryRolesGateway();
      const team = new InMemoryTeamGateway();
      const health = new InMemoryHealthGateway({ status: 'ok', database: 'up' });

      let sessionCalls = 0;
      const origGetSession = auth.getSession.bind(auth);
      auth.getSession = async () => {
        sessionCalls += 1;
        return origGetSession();
      };

      let rolesCalls = 0;
      const origGetRoles = roles.getRoles.bind(roles);
      roles.getRoles = async () => {
        rolesCalls += 1;
        return origGetRoles();
      };

      let teamCalls = 0;
      const origListTeam = team.listTeam.bind(team);
      team.listTeam = async () => {
        teamCalls += 1;
        return origListTeam();
      };

      let invitationsCalls = 0;
      const origListInvitations = team.listInvitations.bind(team);
      team.listInvitations = async () => {
        invitationsCalls += 1;
        return origListInvitations();
      };

      let healthCalls = 0;
      const origCheckHealth = health.check.bind(health);
      health.check = async () => {
        healthCalls += 1;
        return origCheckHealth();
      };

      const store = createTestStore({ auth, roles, team, health });
      createdStores.push(store);
      const dispatchedActions: unknown[] = [];
      const origDispatch = store.dispatch.bind(store);
      store.dispatch = ((action: unknown) => {
        dispatchedActions.push(action);
        return origDispatch(action as Parameters<typeof origDispatch>[0]);
      }) as typeof store.dispatch;

      const sources: FakeRealtimeSource[] = [];
      await render(
        <StoreProvider store={store} storage={storage}>
          <SessionLifecycle
            platformOs="ios"
            apiBaseUrl="https://api.gomecoiffer.cm/"
            realtimeSourceFactory={(opts) => {
              const source = new FakeRealtimeSource(opts);
              sources.push(source);
              return source;
            }}
          />
        </StoreProvider>,
      );

      // Anonymous, CLIENT or STAFF without activeSalonId must not open SSE.
      expect(sources).toHaveLength(0);

      await act(async () => {
        store.dispatch(sessionStarted(clientSessionStateFrom('6 55 •• •• 22')));
      });
      expect(sources).toHaveLength(0);

      await act(async () => {
        store.dispatch(
          sessionStarted(
            sessionStateFromSummary(buildStaffSession({ activeSalonId: null, nextStep: 'CHOOSE_SALON' })),
          ),
        );
      });
      expect(sources).toHaveLength(0);

      // Selecting an active salon opens the stream.
      await act(async () => {
        store.dispatch(
          activeSalonChanged({
            salonId: '0195f000-0000-7000-8000-000000000b01',
            permissions: ['dashboard:view', 'roles:administer', 'staff:view'],
          }),
        );
      });

      expect(sources).toHaveLength(1);
      expect(sources[0]!.options.url).toBe('https://api.gomecoiffer.cm/api/salon/realtime/stream');
      expect(sources[0]!.options.storage).toBe(storage);
      expect(sources[0]!.isConnected).toBe(true);

      await act(async () => {
        await store.dispatch(rolesApi.endpoints.getSalonRoles.initiate()).unwrap();
        await store.dispatch(teamApi.endpoints.listSalonTeam.initiate()).unwrap();
        await store.dispatch(teamApi.endpoints.listSalonInvitations.initiate()).unwrap();
        await store.dispatch(healthApi.endpoints.getHealth.initiate()).unwrap();
      });

      expect(rolesCalls).toBe(1);
      expect(teamCalls).toBe(1);
      expect(invitationsCalls).toBe(1);
      expect(healthCalls).toBe(1);
      expect(sessionCalls).toBe(0);

      const invalidationPayloads = () =>
        dispatchedActions
          .filter(
            (action): action is { readonly type: string; readonly payload: readonly string[] } =>
              typeof action === 'object' &&
              action !== null &&
              'type' in action &&
              action.type === 'api/invalidateTags' &&
              'payload' in action,
          )
          .map((action) => action.payload);

      // salon.role_permissions_changed invalidates SalonRoles and Session only.
      await act(async () => {
        sources[0]!.emitEvent('salon.role_permissions_changed', { salonId: 's1' });
      });
      await waitFor(() => {
        expect(rolesCalls).toBe(2);
        expect(sessionCalls).toBe(1);
      });
      expect(teamCalls).toBe(1);
      expect(invitationsCalls).toBe(1);
      expect(healthCalls).toBe(1);
      expect(invalidationPayloads().at(-1)).toEqual(['SalonRoles', 'Session']);

      // salon.team_changed invalidates Team, Invitations and Session only.
      await act(async () => {
        sources[0]!.emitEvent('salon.team_changed', { salonId: 's1' });
      });
      await waitFor(() => {
        expect(teamCalls).toBe(2);
        expect(invitationsCalls).toBe(2);
        expect(sessionCalls).toBe(2);
      });
      expect(rolesCalls).toBe(2);
      expect(healthCalls).toBe(1);
      expect(invalidationPayloads().at(-1)).toEqual(['Team', 'Invitations', 'Session']);

      // salon.invitation_changed also invalidates Team, Invitations and Session.
      await act(async () => {
        sources[0]!.emitEvent('salon.invitation_changed', { salonId: 's1' });
      });
      await waitFor(() => {
        expect(teamCalls).toBe(3);
        expect(invitationsCalls).toBe(3);
        expect(sessionCalls).toBe(3);
      });
      expect(rolesCalls).toBe(2);

      // salon.member_role_changed refreshes team, invitations and staff session.
      await act(async () => {
        sources[0]!.emitEvent('salon.member_role_changed', { salonId: 's1' });
      });
      await waitFor(() => {
        expect(teamCalls).toBe(4);
        expect(invitationsCalls).toBe(4);
        expect(sessionCalls).toBe(4);
      });
      expect(invalidationPayloads().at(-1)).toEqual(['Team', 'Invitations', 'Session']);

      // onStreamClosed refreshes staff session without wiping queries.
      await act(async () => {
        sources[0]!.options.onStreamClosed?.();
      });
      await waitFor(() => {
        expect(sessionCalls).toBe(5);
      });

      // Reconnect invalidates all reads (including Health) and refreshes staff session.
      await act(async () => {
        sources[0]!.emitError();
        sources[0]!.emitOpen();
      });
      await waitFor(() => {
        expect(healthCalls).toBe(2);
        expect(rolesCalls).toBe(3);
        expect(teamCalls).toBe(5);
        expect(invitationsCalls).toBe(5);
        expect(sessionCalls).toBe(6);
      });
    });

    it('reopens SSE stream when userId changes on the same activeSalonId and redirects on STAFF session expiration (M-6)', async () => {
      const storage = new InMemoryTokenStorage({ sessionToken: 'tok-user-1' });
      const store = createTestStore();
      createdStores.push(store);
      store.dispatch(sessionStarted(sessionStateFromSummary(buildStaffSession())));

      const sources: FakeRealtimeSource[] = [];
      let expiredRedirectCalls = 0;

      await render(
        <StoreProvider store={store} storage={storage}>
          <SessionLifecycle
            platformOs="ios"
            apiBaseUrl="https://api.gomecoiffer.cm"
            onStaffSessionExpired={() => {
              expiredRedirectCalls += 1;
            }}
            realtimeSourceFactory={(opts) => {
              const source = new FakeRealtimeSource(opts);
              sources.push(source);
              return source;
            }}
          />
        </StoreProvider>,
      );

      expect(sources).toHaveLength(1);
      expect(sources[0]!.isConnected).toBe(true);

      await act(async () => {
        store.dispatch(
          sessionStarted(
            sessionStateFromSummary(
              buildStaffSession({
                user: { id: '0195f000-0000-7000-8000-000000000a99', name: 'Autre Utilisateur' },
              }),
            ),
          ),
        );
      });

      expect(sources).toHaveLength(2);
      expect(sources[0]!.disconnectCount).toBe(1);
      expect(sources[1]!.isConnected).toBe(true);

      await act(async () => {
        sources[1]!.options.onUnauthorized?.();
      });

      expect(selectExpiredSessionKind(store.getState())).toBe('STAFF');
      expect(expiredRedirectCalls).toBe(1);
    });

    it('closes old stream on activeSalonId switch and closes + purges on sign-out and 401 SSE', async () => {
      const storage = new InMemoryTokenStorage({ sessionToken: 'tok-salon-1', deviceToken: 'dev-1' });
      const auth = new InMemoryAuthGateway(buildStaffSession());
      const store = createTestStore({ auth });
      createdStores.push(store);

      const nativeSources: FakeNativeEventSource[] = [];
      const appState = new FakeAppState();
      let staffExpiredCount = 0;

      await render(
        <StoreProvider store={store} storage={storage}>
          <SessionLifecycle
            platformOs="ios"
            apiBaseUrl="https://api.gomecoiffer.cm"
            onStaffSessionExpired={() => {
              staffExpiredCount += 1;
            }}
            realtimeSourceFactory={(opts) =>
              createRealtimeSource({
                ...opts,
                appState,
                eventSourceFactory: (url, esOpts) => {
                  const es = new FakeNativeEventSource(url, esOpts);
                  nativeSources.push(es);
                  return es;
                },
              })
            }
          />
        </StoreProvider>,
      );

      await waitFor(() => {
        expect(nativeSources).toHaveLength(1);
      });
      expect(nativeSources[0]!.closed).toBe(false);

      // Switching activeSalonId closes the previous stream and opens a new one.
      await act(async () => {
        await storage.setSessionToken('tok-salon-2');
        store.dispatch(
          activeSalonChanged({
            salonId: '0195f000-0000-7000-8000-000000000b02',
            permissions: ['bookings:view-own'],
          }),
        );
      });

      await waitFor(() => {
        expect(nativeSources).toHaveLength(2);
      });
      expect(nativeSources[0]!.closed).toBe(true);
      expect(nativeSources[1]!.closed).toBe(false);
      expect(nativeSources[1]!.options.headers?.Authorization).toBe('Bearer tok-salon-2');

      // 401 on current SSE token closes stream, clears token, purges session & RTK cache.
      await act(async () => {
        nativeSources[1]!.emitError({ xhrStatus: 401 });
        await Promise.resolve();
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(store.getState().session.kind).toBeNull();
      });
      expect(staffExpiredCount).toBe(1);
      expect(nativeSources[1]!.closed).toBe(true);
      expect(await storage.getSessionToken()).toBeNull();
      expect(await storage.getDeviceToken()).toBe('dev-1');
      expect(store.getState().api.queries).toEqual({});

      // Re-opening session then signing out closes stream cleanly.
      await act(async () => {
        await storage.setSessionToken('tok-salon-3');
        store.dispatch(sessionStarted(sessionStateFromSummary(buildStaffSession())));
      });
      await waitFor(() => {
        expect(nativeSources).toHaveLength(3);
      });
      expect(nativeSources[2]!.closed).toBe(false);

      await act(async () => {
        store.dispatch(sessionCleared());
      });
      expect(nativeSources[2]!.closed).toBe(true);
    });

    it('bootstraps and opens SSE on web using HttpOnly cookies without native TokenStorage', async () => {
      const auth = new InMemoryAuthGateway(buildStaffSession());
      const store = createTestStore({ auth });
      createdStores.push(store);
      const sources: FakeRealtimeSource[] = [];

      await render(
        <StoreProvider store={store}>
          <SessionLifecycle
            platformOs="web"
            apiBaseUrl="https://api.gomecoiffer.cm"
            realtimeSourceFactory={(opts) => {
              const source = new FakeRealtimeSource(opts);
              sources.push(source);
              return source;
            }}
          />
        </StoreProvider>,
      );

      await waitFor(() => {
        expect(store.getState().session.kind).toBe('STAFF');
        expect(sources).toHaveLength(1);
      });
      expect(sources[0]!.isConnected).toBe(true);
    });

    it('routes via Expo Router to /connexion by default when STAFF session expires', async () => {
      const storage = new InMemoryTokenStorage({ sessionToken: 'tok-staff' });
      const store = createTestStore();
      createdStores.push(store);
      store.dispatch(sessionStarted(sessionStateFromSummary(buildStaffSession())));
      const sources: FakeRealtimeSource[] = [];

      await renderRouter(
        {
          '(salon)/(tabs)/index': () => (
            <StoreProvider store={store} storage={storage}>
              <SessionLifecycle
                platformOs="ios"
                apiBaseUrl="https://api.gomecoiffer.cm"
                realtimeSourceFactory={(opts) => {
                  const source = new FakeRealtimeSource(opts);
                  sources.push(source);
                  return source;
                }}
              />
              <Text>Écran salon actif</Text>
            </StoreProvider>
          ),
          connexion: () => <Text>Écran connexion affiché</Text>,
        },
        { initialUrl: '/(salon)/(tabs)' },
      );

      expect(screen.getByText('Écran salon actif')).toBeOnTheScreen();

      await act(async () => {
        sources[0]!.options.onUnauthorized?.();
      });

      expect(await screen.findByText('Écran connexion affiché')).toBeOnTheScreen();
    });
  });
});

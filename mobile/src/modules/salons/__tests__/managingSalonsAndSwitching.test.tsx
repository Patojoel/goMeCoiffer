import {
  HttpError,
  purgeApiCache,
  sessionStarted,
  t,
  type CoreStore,
} from '@gomecoiffer/client-core';
import {
  InMemoryAuthGateway,
  InMemorySalonsGateway,
  createTestStore,
} from '@gomecoiffer/client-core/testing';
import { act, cleanup, fireEvent, render, renderHook, screen, userEvent, waitFor, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import type { WeeklySchedule } from '@gomecoiffer/client-core';
import { StoreProvider } from '@/lib/store/StoreProvider';
import { AddSalonView } from '../ui/add-salon/add-salon-view';
import { useAddSalon } from '../ui/add-salon/use-add-salon';
import { ChooseSalonView } from '../ui/choose-salon/choose-salon-view';
import { useChooseSalon } from '../ui/choose-salon/use-choose-salon';
import { CreateOrganizationView } from '../ui/create-organization/create-organization-view';
import { useCreateOrganization } from '../ui/create-organization/use-create-organization';
import { WeeklyScheduleEditor } from '../ui/hours/weekly-schedule-editor';

const createdStores: CoreStore[] = [];

afterEach(async () => {
  cleanup();
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 60));
  });
  for (const store of createdStores.splice(0)) {
    store.dispatch(purgeApiCache());
  }
});

async function fillSalonForm(user: ReturnType<typeof userEvent.setup>, overrides?: { name?: string }) {
  await user.type(
    screen.getByLabelText(t('salons.form.nameLabel')),
    overrides?.name ?? 'Go Beauty Bastos',
  );
  await user.press(screen.getByRole('button', { name: t('salons.form.typeLabel') }));
  await user.press(screen.getByText(t('salons.type.HAIR_SALON')));
  await user.press(screen.getByRole('button', { name: t('salons.form.cityLabel') }));
  await user.press(screen.getByText('Yaoundé'));
  await user.type(screen.getByLabelText(t('salons.form.districtLabel')), 'Bastos');
  await user.type(
    screen.getByLabelText(t('salons.form.landmarkLabel')),
    'Face à la pharmacie du carrefour',
  );
  await user.type(screen.getByLabelText(t('salons.form.phoneLabel')), '6 70 00 00 00');
}

describe('Managing salons and switching active salon (UC-004, UC-005, UC-010)', () => {
  it('shows field guidance, validates locally and disables submission when offline (UC-004)', async () => {
    const salons = new InMemorySalonsGateway();
    const store = createTestStore({ salons });
    createdStores.push(store);

    const { rerender } = await render(
      <StoreProvider store={store}>
        <CreateOrganizationView isOnline={false} onNavigate={() => undefined} />
      </StoreProvider>,
    );

    expect(screen.getByText(t('salons.form.landmarkHint'))).toBeOnTheScreen();
    expect(screen.getByText(t('common.offlineActionHint'))).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: t('salons.form.submitCreate') })).toBeDisabled();

    await rerender(
      <StoreProvider store={store}>
        <CreateOrganizationView isOnline={true} onNavigate={() => undefined} />
      </StoreProvider>,
    );

    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: t('salons.form.submitCreate') }));

    expect(screen.getByText('Le nom du salon compte au moins 2 caractères.')).toBeOnTheScreen();
    expect(store.getState().session.salons).toHaveLength(0);
  });

  it('creates an organization with the first salon and navigates to salon home (UC-004)', async () => {
    const salons = new InMemorySalonsGateway();
    const store = createTestStore({ salons });
    createdStores.push(store);
    const navigatedTo: string[] = [];

    await render(
      <StoreProvider store={store}>
        <CreateOrganizationView
          isOnline={true}
          onNavigate={(path) => navigatedTo.push(path)}
        />
      </StoreProvider>,
    );

    const user = userEvent.setup();
    await fillSalonForm(user);
    await user.press(screen.getByRole('button', { name: t('salons.form.submitCreate') }));

    expect(navigatedTo).toEqual(['/(salon)/(tabs)']);
    expect(store.getState().session.salons).toHaveLength(1);
    expect(store.getState().session.activeSalonId).toBe(salons.currentSession.activeSalonId);
  });

  it('recovers automatically by refreshing staff session when ORGANIZATION_ALREADY_EXISTS is returned (UC-004)', async () => {
    const salons = new InMemorySalonsGateway();
    salons.nextError = new HttpError(
      409,
      'ORGANIZATION_ALREADY_EXISTS',
      'Vous avez déjà une organisation.',
    );
    const auth = new InMemoryAuthGateway({
      user: { id: '0195f000-0000-7000-8000-000000000a01', name: 'Mireille Ngono' },
      activeSalonId: null,
      salons: [
        {
          id: '0195f000-0000-7000-8000-000000000b01',
          name: 'Go Beauty Akwa',
          role: 'OWNER',
          city: 'Douala',
          district: 'Akwa',
        },
        {
          id: '0195f000-0000-7000-8000-000000000b02',
          name: 'Go Beauty Bastos',
          role: 'OWNER',
          city: 'Yaoundé',
          district: 'Bastos',
        },
      ],
      permissions: [],
      systemRoles: [],
      nextStep: 'CHOOSE_SALON',
    });
    const store = createTestStore({ salons, auth });
    createdStores.push(store);
    const navigatedTo: string[] = [];

    await render(
      <StoreProvider store={store}>
        <CreateOrganizationView
          isOnline={true}
          onNavigate={(path) => navigatedTo.push(path)}
        />
      </StoreProvider>,
    );

    const user = userEvent.setup();
    await fillSalonForm(user);
    await user.press(screen.getByRole('button', { name: t('salons.form.submitCreate') }));

    expect(screen.getByText(t('salons.create.alreadyExistsHint'))).toBeOnTheScreen();
    expect(navigatedTo).toEqual(['/(salon)/choisir-salon']);
    expect(store.getState().session.salons).toHaveLength(2);
  });

  it('adds a second salon to the organization and switches to it on success (UC-010)', async () => {
    const salons = new InMemorySalonsGateway({
      user: { id: '0195f000-0000-7000-8000-000000000a01', name: 'Mireille Ngono' },
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
      permissions: ['dashboard:view', 'roles:administer'],
      systemRoles: [],
      nextStep: 'OPEN_SALON',
    });
    const store = createTestStore({ salons });
    createdStores.push(store);
    const navigatedTo: string[] = [];

    await render(
      <StoreProvider store={store}>
        <AddSalonView isOnline={true} onNavigate={(path) => navigatedTo.push(path)} />
      </StoreProvider>,
    );

    const user = userEvent.setup();
    await fillSalonForm(user, { name: 'Go Beauty Bastos' });
    await user.press(screen.getByRole('button', { name: t('salons.form.submitAdd') }));

    expect(navigatedTo).toEqual(['/(salon)/(tabs)']);
    expect(store.getState().session.salons).toHaveLength(2);
    expect(store.getState().session.activeSalonId).toBe(salons.currentSession.activeSalonId);
  });

  it('displays conflict error and stays on screen when salon name is already used (UC-010)', async () => {
    const salons = new InMemorySalonsGateway({
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
      permissions: ['dashboard:view', 'roles:administer'],
      systemRoles: [],
      nextStep: 'OPEN_SALON',
    });
    const store = createTestStore({ salons });
    createdStores.push(store);
    const navigatedTo: string[] = [];

    await render(
      <StoreProvider store={store}>
        <AddSalonView isOnline={true} onNavigate={(path) => navigatedTo.push(path)} />
      </StoreProvider>,
    );

    const user = userEvent.setup();
    await fillSalonForm(user, { name: 'go beauty bastos' });
    await user.press(screen.getByRole('button', { name: t('salons.form.submitAdd') }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Un salon de ce nom existe déjà dans votre organisation.',
    );
    expect(navigatedTo).toEqual([]);
    expect(screen.getByLabelText(t('salons.form.nameLabel')).props.value).toBe('go beauty bastos');
  });

  it('shows empty state guiding to organization creation when the user has no salons (UC-005)', async () => {
    const store = createTestStore({ salons: new InMemorySalonsGateway() });
    createdStores.push(store);
    store.dispatch(
      sessionStarted({
        userId: '0195f000-0000-7000-8000-000000000a01',
        kind: 'STAFF',
        activeSalonId: null,
        salons: [],
        permissions: [],
        systemRoles: [],
        maskedPhone: null,
        nextStep: 'CREATE_ORGANIZATION',
      }),
    );
    const navigatedTo: string[] = [];

    await render(
      <StoreProvider store={store}>
        <ChooseSalonView isOnline={true} onNavigate={(path) => navigatedTo.push(path)} />
      </StoreProvider>,
    );

    expect(screen.getByText(t('salons.guard.selectTitle'))).toBeOnTheScreen();
    expect(screen.getByText(t('salons.guard.selectHint'))).toBeOnTheScreen();

    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: t('salons.guard.createAction') }));
    expect(navigatedTo).toEqual(['/(salon)/creer-organisation']);
  });

  it('lists salons with roles, marks active salon, locks cards while switching and updates active salon (UC-005)', async () => {
    const salonAkwaId = '0195f000-0000-7000-8000-000000000b01';
    const salonBastosId = '0195f000-0000-7000-8000-000000000b02';
    let resolveSwitch!: () => void;
    const baseGateway = new InMemorySalonsGateway({
      user: { id: '0195f000-0000-7000-8000-000000000a01', name: 'Paul Ebode' },
      activeSalonId: salonAkwaId,
      salons: [
        {
          id: salonAkwaId,
          name: 'Élégance Akwa',
          role: 'HAIRDRESSER',
          city: 'Douala',
          district: 'Akwa',
        },
        {
          id: salonBastosId,
          name: 'Paul Barber Bastos',
          role: 'OWNER',
          city: 'Yaoundé',
          district: 'Bastos',
        },
      ],
      permissions: ['bookings:view-own'],
      systemRoles: [],
      nextStep: 'CHOOSE_SALON',
    });
    const pendingGateway = {
      createOrganization: baseGateway.createOrganization.bind(baseGateway),
      addSalon: baseGateway.addSalon.bind(baseGateway),
      selectActiveSalon: async (input: { salonId: string }) => {
        await new Promise<void>((resolve) => {
          resolveSwitch = resolve;
        });
        return baseGateway.selectActiveSalon(input);
      },
    };
    const store = createTestStore({ salons: pendingGateway });
    createdStores.push(store);
    store.dispatch(
      sessionStarted({
        userId: '0195f000-0000-7000-8000-000000000a01',
        kind: 'STAFF',
        activeSalonId: salonAkwaId,
        salons: [...baseGateway.currentSession.salons],
        permissions: ['bookings:view-own'],
        systemRoles: [],
        maskedPhone: null,
        nextStep: 'CHOOSE_SALON',
      }),
    );
    const navigatedTo: string[] = [];

    await render(
      <StoreProvider store={store}>
        <ChooseSalonView isOnline={true} onNavigate={(path) => navigatedTo.push(path)} />
      </StoreProvider>,
    );

    expect(screen.getByText('Élégance Akwa')).toBeOnTheScreen();
    expect(screen.getByText('Douala · Akwa')).toBeOnTheScreen();
    expect(screen.getByText(t('team.role.HAIRDRESSER'))).toBeOnTheScreen();
    expect(screen.getByText(t('salons.switch.activeBadge'))).toBeOnTheScreen();
    expect(screen.getByText('Paul Barber Bastos')).toBeOnTheScreen();
    expect(screen.getByText('Yaoundé · Bastos')).toBeOnTheScreen();
    expect(screen.getByText(t('team.role.OWNER'))).toBeOnTheScreen();

    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Paul Barber Bastos' }));

    expect(screen.getByText(t('salons.switch.switching'))).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Élégance Akwa' })).toBeDisabled();

    await act(async () => {
      resolveSwitch();
    });

    expect(store.getState().session.activeSalonId).toBe(salonBastosId);
    expect(navigatedTo).toEqual(['/(salon)/(tabs)']);
  });

  it('auto-opens single salon once when online and nextStep is OPEN_SALON (D-040), skipping while offline', async () => {
    const salonId = '0195f000-0000-7000-8000-000000000b10';
    const baseGateway = new InMemorySalonsGateway({
      user: { id: '0195f000-0000-7000-8000-000000000a01', name: 'Mireille Ngono' },
      activeSalonId: null,
      salons: [
        {
          id: salonId,
          name: 'Go Beauty Akwa',
          role: 'OWNER',
          city: 'Douala',
          district: 'Akwa',
        },
      ],
      permissions: [],
      systemRoles: [],
      nextStep: 'OPEN_SALON',
    });
    let selectCalls = 0;
    const countedGateway = {
      createOrganization: baseGateway.createOrganization.bind(baseGateway),
      addSalon: baseGateway.addSalon.bind(baseGateway),
      selectActiveSalon: async (input: { salonId: string }) => {
        selectCalls += 1;
        return baseGateway.selectActiveSalon(input);
      },
    };
    const store = createTestStore({ salons: countedGateway });
    createdStores.push(store);
    store.dispatch(
      sessionStarted({
        userId: '0195f000-0000-7000-8000-000000000a01',
        kind: 'STAFF',
        activeSalonId: null,
        salons: [...baseGateway.currentSession.salons],
        permissions: [],
        systemRoles: [],
        maskedPhone: null,
        nextStep: 'OPEN_SALON',
      }),
    );
    const navigatedTo: string[] = [];

    const { rerender } = await render(
      <StoreProvider store={store}>
        <ChooseSalonView isOnline={false} onNavigate={(path) => navigatedTo.push(path)} />
      </StoreProvider>,
    );

    expect(selectCalls).toBe(0);
    expect(navigatedTo).toEqual([]);
    expect(screen.getByText(t('common.offlineActionHint'))).toBeOnTheScreen();

    await rerender(
      <StoreProvider store={store}>
        <ChooseSalonView isOnline={true} onNavigate={(path) => navigatedTo.push(path)} />
      </StoreProvider>,
    );

    await waitFor(() => {
      expect(navigatedTo).toEqual(['/(salon)/(tabs)']);
    });
    expect(selectCalls).toBe(1);
    expect(store.getState().session.activeSalonId).toBe(salonId);
  });

  it('displays draft notice, default summary and applies Mon-Fri / Mon-Sat presets on weekly schedule', async () => {
    await render(<WeeklyScheduleEditor />);

    expect(screen.getByText(t('salons.hours.draftNotice'))).toBeOnTheScreen();
    expect(screen.getByText('Lun. – Sam. : 08:00 – 18:00 · Dim. : Fermé')).toBeOnTheScreen();

    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: t('salons.hours.presetMonFri') }));
    expect(screen.getByText('Lun. – Ven. : 08:00 – 18:00 · Sam. – Dim. : Fermé')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: t('salons.hours.presetMonSat') }));
    expect(screen.getByText('Lun. – Sam. : 08:00 – 18:00 · Dim. : Fermé')).toBeOnTheScreen();
  });

  it('shows validation error when closing time is before opening time and confirms local validity once fixed', async () => {
    const applied: WeeklySchedule[] = [];
    await render(<WeeklyScheduleEditor onApply={(schedule) => applied.push(schedule)} />);

    const mondayCard = screen.getByTestId('schedule-day-MON');
    const user = userEvent.setup();

    await user.press(within(mondayCard).getByRole('button', { name: t('salons.hours.endLabel') }));
    await user.press(screen.getByText('07:30'));

    expect(
      within(mondayCard).getByText("L'heure de fermeture doit être après l'ouverture."),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: t('salons.hours.saveAction') })).toBeDisabled();
    expect(applied).toHaveLength(0);

    await user.press(within(mondayCard).getByRole('button', { name: t('salons.hours.endLabel') }));
    await user.type(screen.getByLabelText(t('ui.select.searchPlaceholder')), '19:00');
    await user.press(screen.getByText('19:00'));

    await fireEvent(
      within(mondayCard).getByRole('switch', { name: t('salons.hours.breakToggle') }),
      'valueChange',
      true,
    );

    const saveButton = screen.getByRole('button', { name: t('salons.hours.saveAction') });
    expect(saveButton).toBeEnabled();
    await user.press(saveButton);

    expect(applied).toHaveLength(1);
    expect(applied[0]?.[0]).toMatchObject({
      day: 'MON',
      isOpen: true,
      openTime: '08:00',
      closeTime: '19:00',
      breakStart: '12:00',
      breakEnd: '13:00',
    });
    expect(
      screen.getByText(
        'Lun. : 08:00 – 19:00 (pause 12:00–13:00) · Mar. – Sam. : 08:00 – 18:00 · Dim. : Fermé',
      ),
    ).toBeOnTheScreen();
  });

  it('prevents synchronous double submission in useChooseSalon, useCreateOrganization and useAddSalon (M-2)', async () => {
    const salonAkwaId = '0195f000-0000-7000-8000-000000000b01';
    const salonBastosId = '0195f000-0000-7000-8000-000000000b02';
    const base = new InMemorySalonsGateway({
      user: { id: '0195f000-0000-7000-8000-000000000a01', name: 'Mireille Ngono' },
      activeSalonId: salonAkwaId,
      salons: [
        { id: salonAkwaId, name: 'Go Beauty Akwa', role: 'OWNER', city: 'Douala', district: 'Akwa' },
        { id: salonBastosId, name: 'Go Beauty Bastos', role: 'OWNER', city: 'Yaoundé', district: 'Bastos' },
      ],
      permissions: ['dashboard:view'],
      systemRoles: [],
      nextStep: 'CHOOSE_SALON',
    });

    let switchCalls = 0;
    let createCalls = 0;
    let addCalls = 0;
    let releaseSwitch!: () => void;
    let releaseCreate!: () => void;
    let releaseAdd!: () => void;

    const gateway = {
      selectActiveSalon: async (input: { salonId: string }) => {
        switchCalls += 1;
        await new Promise<void>((resolve) => {
          releaseSwitch = resolve;
        });
        return base.selectActiveSalon(input);
      },
      createOrganization: async (input: Parameters<InMemorySalonsGateway['createOrganization']>[0]) => {
        createCalls += 1;
        await new Promise<void>((resolve) => {
          releaseCreate = resolve;
        });
        return base.createOrganization(input);
      },
      addSalon: async (input: Parameters<InMemorySalonsGateway['addSalon']>[0]) => {
        addCalls += 1;
        await new Promise<void>((resolve) => {
          releaseAdd = resolve;
        });
        return base.addSalon(input);
      },
    };

    const store = createTestStore({ salons: gateway });
    createdStores.push(store);
    store.dispatch(
      sessionStarted({
        userId: '0195f000-0000-7000-8000-000000000a01',
        kind: 'STAFF',
        activeSalonId: salonAkwaId,
        salons: [...base.currentSession.salons],
        permissions: ['dashboard:view'],
        systemRoles: [],
        maskedPhone: null,
        nextStep: 'CHOOSE_SALON',
      }),
    );

    const wrapper = ({ children }: { readonly children: ReactNode }) => (
      <StoreProvider store={store}>{children}</StoreProvider>
    );

    const chooseHook = await renderHook(
      () => useChooseSalon({ onNavigate: () => undefined, isOnline: true }),
      { wrapper },
    );
    await act(async () => {
      const p1 = chooseHook.result.current.selectSalon(salonBastosId);
      const p2 = chooseHook.result.current.selectSalon(salonBastosId);
      expect(switchCalls).toBe(1);
      releaseSwitch();
      await Promise.all([p1, p2]);
    });
    expect(switchCalls).toBe(1);

    const createHook = await renderHook(
      () => useCreateOrganization({ onNavigate: () => undefined, isOnline: true }),
      { wrapper },
    );
    const salonPayload = {
      name: 'Go Beauty Bonanjo',
      type: 'HAIR_SALON' as const,
      city: 'Douala' as const,
      district: 'Bonanjo',
      landmark: 'Face port autonome',
      phone: '6 70 00 00 00',
    };
    await act(async () => {
      const p1 = createHook.result.current.submit(salonPayload);
      const p2 = createHook.result.current.submit(salonPayload);
      expect(createCalls).toBe(1);
      releaseCreate();
      await Promise.all([p1, p2]);
    });
    expect(createCalls).toBe(1);

    const addHook = await renderHook(
      () => useAddSalon({ onNavigate: () => undefined, isOnline: true }),
      { wrapper },
    );
    await act(async () => {
      const p1 = addHook.result.current.submit(salonPayload);
      const p2 = addHook.result.current.submit(salonPayload);
      expect(addCalls).toBe(1);
      releaseAdd();
      await Promise.all([p1, p2]);
    });
    expect(addCalls).toBe(1);
  });
});

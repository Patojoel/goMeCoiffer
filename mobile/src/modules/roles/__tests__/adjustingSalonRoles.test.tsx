import { purgeApiCache, sessionStarted, t, type CoreStore } from '@gomecoiffer/client-core';
import { ADJUSTABLE_PERMISSIONS } from '@gomecoiffer/contracts';
import { InMemoryRolesGateway, createTestStore } from '@gomecoiffer/client-core/testing';
import { act, cleanup, fireEvent, render, renderHook, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { StoreProvider } from '@/lib/store/StoreProvider';
import { SalonRolesView } from '../ui/salon-roles-view';
import { useSalonRoles } from '../ui/use-salon-roles';

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

function startOwnerSession(store: CoreStore, permissions: readonly string[] = ['roles:administer']) {
  store.dispatch(
    sessionStarted({
      userId: '0195f000-0000-7000-8000-000000000a01',
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
      permissions,
      systemRoles: [],
      maskedPhone: null,
      nextStep: 'OPEN_SALON',
    }),
  );
}

describe('Adjusting salon role permissions on mobile (UC-008)', () => {
  it('refuses access when the active session lacks roles:administer permission', async () => {
    const store = createTestStore();
    createdStores.push(store);
    startOwnerSession(store, ['bookings:view-all', 'staff:view']);

    await render(
      <StoreProvider store={store}>
        <SalonRolesView isOnline={true} />
      </StoreProvider>,
    );

    expect(screen.getByText(t('errors.forbidden.title'))).toBeOnTheScreen();
    expect(screen.getByText(t('errors.forbidden.permission'))).toBeOnTheScreen();
    expect(screen.queryByRole('switch')).not.toBeOnTheScreen();
  });

  it('displays the Owner section as read-only with reserved rights note and 16 adjustable switches', async () => {
    const roles = new InMemoryRolesGateway();
    const store = createTestStore({ roles });
    createdStores.push(store);
    startOwnerSession(store);

    await render(
      <StoreProvider store={store}>
        <SalonRolesView isOnline={true} />
      </StoreProvider>,
    );

    expect(await screen.findByText(t('roles.ownerNote', { count: 1 }))).toBeOnTheScreen();
    expect(screen.getByText(t('team.members.ownerProtectedHint'))).toBeOnTheScreen();
    expect(screen.getByText(t('perm.roles:administer'))).toBeOnTheScreen();
    expect(screen.queryByRole('switch', { name: t('perm.roles:administer') })).not.toBeOnTheScreen();
    expect(screen.getAllByRole('switch')).toHaveLength(ADJUSTABLE_PERMISSIONS.length);
  });

  it('auto-enables view permission when enabling an action and auto-drops dependent actions when disabling view', async () => {
    const roles = new InMemoryRolesGateway();
    const store = createTestStore({ roles });
    createdStores.push(store);
    startOwnerSession(store);

    await render(
      <StoreProvider store={store}>
        <SalonRolesView isOnline={true} />
      </StoreProvider>,
    );

    const user = userEvent.setup();
    await user.press(await screen.findByRole('tab', { name: t('team.role.HAIRDRESSER') }));

    expect(screen.getByText(t('team.roleDesc.HAIRDRESSER'))).toBeOnTheScreen();

    const viewAllSwitch = screen.getByRole('switch', { name: t('perm.bookings:view-all') });
    const manageSwitch = screen.getByRole('switch', { name: t('perm.bookings:manage') });
    expect(viewAllSwitch.props.value).toBe(false);
    expect(manageSwitch.props.value).toBe(false);

    await fireEvent(manageSwitch, 'valueChange', true);

    expect(screen.getByText(t('roles.dependencyHint'))).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: t('perm.bookings:manage') }).props.value).toBe(true);
    expect(screen.getByRole('switch', { name: t('perm.bookings:view-all') }).props.value).toBe(true);

    await fireEvent(
      screen.getByRole('switch', { name: t('perm.bookings:view-all') }),
      'valueChange',
      false,
    );

    expect(screen.getByRole('switch', { name: t('perm.bookings:view-all') }).props.value).toBe(false);
    expect(screen.getByRole('switch', { name: t('perm.bookings:manage') }).props.value).toBe(false);
    expect(screen.getByText(t('roles.dependencyHint'))).toBeOnTheScreen();
  });

  it('saves permissions with version bump, resets to default and disables actions when offline', async () => {
    const roles = new InMemoryRolesGateway();
    const store = createTestStore({ roles });
    createdStores.push(store);
    startOwnerSession(store);

    const { rerender } = await render(
      <StoreProvider store={store}>
        <SalonRolesView isOnline={false} />
      </StoreProvider>,
    );

    expect(await screen.findByText(t('common.offlineActionHint'))).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: t('roles.saveAction') })).toBeDisabled();
    expect(screen.getByRole('button', { name: t('roles.resetDefault') })).toBeDisabled();

    await rerender(
      <StoreProvider store={store}>
        <SalonRolesView isOnline={true} />
      </StoreProvider>,
    );

    const user = userEvent.setup();
    await user.press(screen.getByRole('tab', { name: t('team.role.HAIRDRESSER') }));

    await fireEvent(
      screen.getByRole('switch', { name: t('perm.services:view') }),
      'valueChange',
      true,
    );
    expect(screen.getByRole('switch', { name: t('perm.services:view') }).props.value).toBe(true);
    await user.press(screen.getByRole('button', { name: t('roles.saveAction') }));

    expect(await screen.findByText(t('roles.savedHint'))).toBeOnTheScreen();
    const updatedHairdresser = roles.rolesData.roles.find((r) => r.role === 'HAIRDRESSER')!;
    expect(updatedHairdresser.version).toBe(2);
    expect(updatedHairdresser.permissions).toContain('services:view');
    expect(updatedHairdresser.isDefault).toBe(false);

    await user.press(screen.getByRole('button', { name: t('roles.resetDefault') }));

    await waitFor(() => {
      const resetHairdresser = roles.rolesData.roles.find((r) => r.role === 'HAIRDRESSER')!;
      expect(resetHairdresser.version).toBe(3);
      expect(resetHairdresser.isDefault).toBe(true);
    });
    expect(screen.getByRole('switch', { name: t('perm.services:view') }).props.value).toBe(false);
    expect(screen.getByText(t('roles.savedHint'))).toBeOnTheScreen();
  });

  it('handles 409 version conflict by showing retry alert and refreshing to latest version', async () => {
    const roles = new InMemoryRolesGateway();
    const store = createTestStore({ roles });
    createdStores.push(store);
    startOwnerSession(store);

    await render(
      <StoreProvider store={store}>
        <SalonRolesView isOnline={true} />
      </StoreProvider>,
    );

    const user = userEvent.setup();
    await user.press(await screen.findByRole('tab', { name: t('team.role.PRACTITIONER') }));

    // Simulate concurrent modification on another device bumping server version from 1 -> 2.
    await roles.adjustRolePermissions('PRACTITIONER', {
      permissions: ['bookings:view-own', 'availability:edit-own', 'services:view'],
      version: 1,
    });

    await fireEvent(
      screen.getByRole('switch', { name: t('perm.dashboard:view') }),
      'valueChange',
      true,
    );
    await user.press(screen.getByRole('button', { name: t('roles.saveAction') }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Les permissions ont changé\./);
    expect(screen.getByText('Les permissions ont changé.')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: t('common.retry') }));

    await waitFor(() => {
      expect(screen.queryByText('Les permissions ont changé.')).not.toBeOnTheScreen();
    });
    expect(screen.getByRole('switch', { name: t('perm.services:view') }).props.value).toBe(true);
    expect(screen.getByRole('switch', { name: t('perm.dashboard:view') }).props.value).toBe(false);

    await fireEvent(
      screen.getByRole('switch', { name: t('perm.dashboard:view') }),
      'valueChange',
      true,
    );
    await user.press(screen.getByRole('button', { name: t('roles.saveAction') }));

    expect(await screen.findByText(t('roles.savedHint'))).toBeOnTheScreen();
    const savedPractitioner = roles.rolesData.roles.find((r) => r.role === 'PRACTITIONER')!;
    expect(savedPractitioner.version).toBe(3);
    expect(savedPractitioner.permissions).toContain('dashboard:view');
  });

  it('prevents synchronous double submission on save and resetToDefault in useSalonRoles (M-2)', async () => {
    const base = new InMemoryRolesGateway();
    let adjustCalls = 0;
    let releaseAdjust!: () => void;
    const roles = {
      getRoles: base.getRoles.bind(base),
      adjustRolePermissions: async (
        role: Parameters<InMemoryRolesGateway['adjustRolePermissions']>[0],
        body: Parameters<InMemoryRolesGateway['adjustRolePermissions']>[1],
      ) => {
        adjustCalls += 1;
        await new Promise<void>((resolve) => {
          releaseAdjust = resolve;
        });
        return base.adjustRolePermissions(role, body);
      },
    };
    const store = createTestStore({ roles });
    createdStores.push(store);
    startOwnerSession(store);

    const wrapper = ({ children }: { readonly children: ReactNode }) => (
      <StoreProvider store={store}>{children}</StoreProvider>
    );

    const { result } = await renderHook(() => useSalonRoles({ isOnline: true }), { wrapper });
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    await act(async () => {
      if (result.current.status !== 'ready') throw new Error('Expected ready');
      result.current.save();
      result.current.save();
      result.current.resetToDefault();
      expect(adjustCalls).toBe(1);
      releaseAdjust();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(adjustCalls).toBe(1);

    await waitFor(() => {
      expect(result.current.status === 'ready' && !result.current.isBusy).toBe(true);
    });

    await act(async () => {
      if (result.current.status !== 'ready') throw new Error('Expected ready');
      result.current.resetToDefault();
      result.current.resetToDefault();
      expect(adjustCalls).toBe(2);
      releaseAdjust();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(adjustCalls).toBe(2);
  });
});

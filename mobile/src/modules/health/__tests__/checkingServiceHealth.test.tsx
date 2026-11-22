import { HttpError, invalidateAllReads, purgeApiCache, t, type CoreStore } from '@gomecoiffer/client-core';
import { InMemoryHealthGateway, createTestStore } from '@gomecoiffer/client-core/testing';
import { act, render, screen, userEvent } from '@testing-library/react-native';
import type { Health } from '@gomecoiffer/contracts';
import { StoreProvider } from '@/lib/store/StoreProvider';
import { HealthStatusCard } from '../ui/health-status-card';

const createdStores: CoreStore[] = [];

afterEach(() => {
  for (const store of createdStores.splice(0)) {
    store.dispatch(purgeApiCache());
  }
});

async function renderHealthCard(gateway: InMemoryHealthGateway) {
  const store = createTestStore({ health: gateway });
  createdStores.push(store);
  await render(
    <StoreProvider store={store}>
      <HealthStatusCard />
    </StoreProvider>,
  );
  return store;
}

describe('Checking service health on mobile', () => {
  it('shows a loading indicator during the initial health fetch', async () => {
    let resolveHealth!: (value: Health) => void;
    const pendingGateway = {
      check: () =>
        new Promise<Health>((resolve) => {
          resolveHealth = resolve;
        }),
    };
    const store = createTestStore({ health: pendingGateway });
    createdStores.push(store);

    await render(
      <StoreProvider store={store}>
        <HealthStatusCard />
      </StoreProvider>,
    );

    expect(screen.getByRole('status', { busy: true })).toBeOnTheScreen();

    await act(async () => {
      resolveHealth({ status: 'ok', database: 'up' });
    });
  });

  it('shows API available and guidance when service and database are up', async () => {
    const gateway = new InMemoryHealthGateway({ status: 'ok', database: 'up' });
    await renderHealthCard(gateway);

    expect(await screen.findByText(t('health.ok'))).toBeOnTheScreen();
    expect(screen.getByText(t('health.okHint'))).toBeOnTheScreen();
  });

  it('explains what to do when the database is unavailable', async () => {
    const gateway = new InMemoryHealthGateway({ status: 'ok', database: 'down' });
    await renderHealthCard(gateway);

    expect(await screen.findByText(t('health.databaseDown'))).toBeOnTheScreen();
    expect(screen.getByText(t('health.databaseDownHint'))).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: t('common.retry') })).toBeOnTheScreen();
  });

  it('shows error guidance and recovers when pressing retry', async () => {
    const gateway = new InMemoryHealthGateway(
      new HttpError(0, 'NETWORK_ERROR', 'Le serveur est injoignable.'),
    );
    await renderHealthCard(gateway);

    expect(await screen.findByText(t('health.error'))).toBeOnTheScreen();
    expect(screen.getByText(t('health.errorHint'))).toBeOnTheScreen();

    gateway.setResult({ status: 'ok', database: 'up' });
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: t('common.retry') }));

    expect(await screen.findByText(t('health.ok'))).toBeOnTheScreen();
  });

  it('refetches health status when reads are invalidated after reconnection', async () => {
    const gateway = new InMemoryHealthGateway({ status: 'ok', database: 'up' });
    const store = await renderHealthCard(gateway);
    expect(await screen.findByText(t('health.ok'))).toBeOnTheScreen();

    gateway.setResult({ status: 'ok', database: 'down' });
    await act(async () => {
      store.dispatch(invalidateAllReads());
    });

    expect(await screen.findByText(t('health.databaseDown'))).toBeOnTheScreen();
  });
});

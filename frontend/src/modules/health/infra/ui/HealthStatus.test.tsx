import type { Health } from '@gomecoiffer/contracts';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';
import { HttpError } from '@/lib/http/HttpClient';
import { invalidateAllReads } from '@/lib/store/api/appApi';
import { createTestStore } from '@/lib/store/testing/createTestStore';
import type { HealthGateway } from '../../models/gateway/HealthGateway';
import { HealthStatus } from './HealthStatus';

/** Gateway fake : rejoue une file de réponses et compte les appels. */
class FakeHealthGateway implements HealthGateway {
  calls = 0;
  constructor(private readonly responses: (Health | Error)[]) {}
  check() {
    const response = this.responses[Math.min(this.calls++, this.responses.length - 1)]!;
    return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
  }
}

const up: Health = { status: 'ok', database: 'up' };

function renderWith(gateway: HealthGateway) {
  const store = createTestStore({ health: gateway });
  render(
    <Provider store={store}>
      <HealthStatus />
    </Provider>,
  );
  return store;
}

describe('HealthStatus', () => {
  it('affiche un squelette pendant le premier chargement', () => {
    renderWith(new FakeHealthGateway([up]));

    screen.getByRole('status', { busy: true });
  });

  it('affiche « API disponible » quand le service répond', async () => {
    renderWith(new FakeHealthGateway([up]));

    await screen.findByText('API disponible');
  });

  it('explique quoi faire quand la base de données est indisponible', async () => {
    renderWith(new FakeHealthGateway([{ status: 'ok', database: 'down' }]));

    await screen.findByText('Base de données indisponible');
    screen.getByText(/Patientez quelques minutes/);
  });

  it('affiche l erreur puis relit au clic sur « Réessayer »', async () => {
    const gateway = new FakeHealthGateway([new HttpError(0, 'NETWORK_ERROR', 'injoignable'), up]);
    renderWith(gateway);

    await screen.findByText('Impossible de joindre le service');
    screen.getByText(/Vérifiez votre connexion/);

    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    await screen.findByText('API disponible');
    expect(gateway.calls).toBe(2);
  });

  it('relit la lecture quand le flux temps réel invalide les lectures après une reconnexion', async () => {
    const gateway = new FakeHealthGateway([up]);
    const store = renderWith(gateway);
    await screen.findByText('API disponible');

    store.dispatch(invalidateAllReads());

    await waitFor(() => expect(gateway.calls).toBe(2));
  });
});

import { describe, expect, it } from 'vitest';
import { createTestStore } from '../../../store/testing/createTestStore.js';
import { salonsApi } from '../infra/api/salonsApi.js';
import { InMemorySalonsGateway } from './fakes/InMemorySalonsGateway.js';

describe('Organization creation and active salon switching (UC-004, UC-005, UC-010)', () => {
  it('creates an organization with first salon and activates it immediately in session state', async () => {
    const salons = new InMemorySalonsGateway();
    const store = createTestStore({ salons });

    const res = await store.dispatch(
      salonsApi.endpoints.createOrganization.initiate({
        name: 'Go Beauty Bastos',
        type: 'HAIR_SALON',
        city: 'Yaoundé',
        district: 'Bastos',
        landmark: 'Face à la pharmacie du carrefour',
        phone: '6 70 00 00 00',
      }),
    );

    expect(res.data?.salonId).toBeDefined();
    expect(store.getState().session.activeSalonId).toBe(res.data?.salonId);
    expect(store.getState().session.salons).toHaveLength(1);
    expect(store.getState().session.permissions).toContain('roles:administer');
  });

  it('adds another salon and switches active salon cleanly (UC-010, UC-005)', async () => {
    const salons = new InMemorySalonsGateway();
    const store = createTestStore({ salons });

    const first = await store.dispatch(
      salonsApi.endpoints.createOrganization.initiate({
        name: 'Go Beauty Bastos',
        type: 'HAIR_SALON',
        city: 'Yaoundé',
        district: 'Bastos',
        landmark: 'Face à la pharmacie',
        phone: '6 70 00 00 00',
      }),
    );

    const second = await store.dispatch(
      salonsApi.endpoints.addSalon.initiate({
        name: 'Go Beauty Akwa',
        type: 'BARBER_SHOP',
        city: 'Douala',
        district: 'Akwa',
        landmark: 'Boulevard de la Liberté',
        phone: '6 90 11 22 33',
      }),
    );

    expect(store.getState().session.salons).toHaveLength(2);
    expect(store.getState().session.activeSalonId).toBe(second.data?.salonId);

    await store.dispatch(
      salonsApi.endpoints.selectActiveSalon.initiate({ salonId: first.data!.salonId }),
    );
    expect(store.getState().session.activeSalonId).toBe(first.data?.salonId);
  });
});

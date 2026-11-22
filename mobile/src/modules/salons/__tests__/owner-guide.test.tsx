import { sessionStarted } from '@gomecoiffer/client-core';
import { createTestStore } from '@gomecoiffer/client-core/testing';
import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { StoreProvider } from '@/lib/store/StoreProvider';
import { OwnerGuide } from '../ui/owner-guide';

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn() }) }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
}));

it('previews a priced service and lets a solo owner review the salon without an invitation', async () => {
  const store = createTestStore({});
  store.dispatch(sessionStarted({
    userId: 'owner', userName: 'Awa', maskedPhone: null, kind: 'STAFF', activeSalonId: 'salon',
    salons: [{ id: 'salon', name: 'Maison Awa', role: 'OWNER', city: 'Yaoundé', district: 'Bastos' }],
    permissions: [], systemRoles: [], nextStep: 'OPEN_SALON',
  }));
  await render(<StoreProvider store={store}><OwnerGuide /></StoreProvider>);
  const user = userEvent.setup();
  await user.press(await screen.findByRole('button', { name: 'Valider l’aperçu et ajouter une prestation' }));
  expect(screen.getByRole('button', { name: 'Configurer mon équipe' })).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Nom de la prestation'), 'Tresses');
  await fireEvent.changeText(screen.getByLabelText('Prix en FCFA'), '3000');
  await fireEvent.changeText(screen.getByLabelText('Durée en minutes'), '45');
  expect(screen.getByText('Aperçu de votre vitrine')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Configurer mon équipe' }));
  await user.press(screen.getByRole('button', { name: 'Je travaille seul · vérifier ma fiche' }));
  expect(screen.getByText('Vérifiez votre fiche')).toBeOnTheScreen();
  expect(screen.getByText('Maison Awa')).toBeOnTheScreen();
});

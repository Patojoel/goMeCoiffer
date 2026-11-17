import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';
import { createTestStore } from '@/lib/store/testing/createTestStore';
import { RequirePermission, RequireSystemRole } from './RequirePermission';
import { sessionStarted } from './sessionSlice';

function renderGuarded(ui: React.ReactNode, session?: Parameters<typeof sessionStarted>[0]) {
  const store = createTestStore();
  if (session) store.dispatch(sessionStarted(session));
  render(<Provider store={store}>{ui}</Provider>);
  return store;
}

const session = { userId: 'u1', activeSalonId: 's1', permissions: ['bookings:manage'], systemRoles: [] };

describe('RequirePermission', () => {
  it('affiche le contenu quand le rôle du salon actif donne le droit', () => {
    renderGuarded(<RequirePermission code="bookings:manage">Planning</RequirePermission>, session);

    screen.getByText('Planning');
  });

  it('explique le refus et quoi faire quand le droit manque', () => {
    renderGuarded(<RequirePermission code="staff:manage">Équipe</RequirePermission>, session);

    expect(screen.queryByText('Équipe')).toBeNull();
    screen.getByText('Accès refusé');
    screen.getByText(/Demandez au propriétaire du salon/);
  });
});

describe('RequireSystemRole', () => {
  it('réserve l espace aux rôles système', () => {
    renderGuarded(<RequireSystemRole role="platform_admin">Admin</RequireSystemRole>, {
      ...session,
      systemRoles: ['platform_admin'],
    });

    screen.getByText('Admin');
  });

  it('refuse un utilisateur sans rôle système', () => {
    renderGuarded(<RequireSystemRole role="platform_admin">Admin</RequireSystemRole>, session);

    expect(screen.queryByText('Admin')).toBeNull();
    screen.getByText(/réservé à l’équipe GoMeCoiffer/);
  });
});

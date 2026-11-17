import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { RouterProvider } from 'react-router';
import { describe, it } from 'vitest';
import { createTestStore } from '@/lib/store/testing/createTestStore';
import { createTestRouter } from './router';

function renderAt(path: string) {
  render(
    <Provider
      store={createTestStore({ health: { check: () => Promise.resolve({ status: 'ok', database: 'up' }) } })}
    >
      <RouterProvider router={createTestRouter([path])} />
    </Provider>,
  );
}

describe('routage des trois espaces', () => {
  it('affiche la marketplace et l état de l API sur /', async () => {
    renderAt('/');

    await screen.findByText('API disponible');
  });

  it('affiche l espace salon sur /salon', async () => {
    renderAt('/salon');

    await screen.findByRole('heading', { name: 'Espace salon' });
  });

  it('affiche l administration sur /admin', async () => {
    renderAt('/admin');

    await screen.findByRole('heading', { name: 'Administration GoMeCoiffer' });
  });

  it('dit quoi faire sur une adresse inconnue', async () => {
    renderAt('/nimporte-quoi');

    await screen.findByRole('heading', { name: 'Page introuvable' });
    screen.getByRole('link', { name: "Retour à l'accueil" });
  });
});

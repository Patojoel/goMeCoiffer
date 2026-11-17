import { createBrowserRouter, createMemoryRouter, type RouteObject } from 'react-router';

/** Trois espaces, chacun chargé paresseusement : la marketplace ne télécharge jamais le back-office ni l'admin. */
export const routes: RouteObject[] = [
  {
    path: '/',
    lazy: async () => ({ Component: (await import('./layouts/MarketplaceLayout')).MarketplaceLayout }),
    children: [
      {
        index: true,
        lazy: async () => ({ Component: (await import('./pages/MarketplaceHome')).MarketplaceHome }),
      },
    ],
  },
  {
    path: '/salon',
    lazy: async () => ({ Component: (await import('./layouts/SalonLayout')).SalonLayout }),
    children: [
      { index: true, lazy: async () => ({ Component: (await import('./pages/SalonHome')).SalonHome }) },
    ],
  },
  {
    path: '/admin',
    lazy: async () => ({ Component: (await import('./layouts/AdminLayout')).AdminLayout }),
    children: [
      { index: true, lazy: async () => ({ Component: (await import('./pages/AdminHome')).AdminHome }) },
    ],
  },
  {
    path: '*',
    lazy: async () => ({ Component: (await import('./layouts/MarketplaceLayout')).MarketplaceLayout }),
    children: [{ path: '*', lazy: async () => ({ Component: (await import('./pages/NotFound')).NotFound }) }],
  },
];

export const createAppRouter = () => createBrowserRouter(routes);
export const createTestRouter = (initialEntries: string[]) => createMemoryRouter(routes, { initialEntries });

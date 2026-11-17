import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { RouterProvider } from 'react-router';
import { createAppRouter } from '@/app/router';
import { HttpClient } from '@/lib/http/HttpClient';
import { sessionCleared } from '@/lib/rbac/sessionSlice';
import { createDependencies } from '@/lib/store/dependencies/dependencies';
import { createStore } from '@/lib/store/store';
import './index.css';

const LOGIN_PATH = '/connexion';

const httpClient = new HttpClient({ baseUrl: import.meta.env.VITE_API_BASE_URL ?? '' });
const store = createStore(createDependencies(httpClient));

// Session expirée : purge de l'état (cache de lecture compris) puis retour à la connexion.
httpClient.onUnauthorized(() => {
  store.dispatch(sessionCleared());
  if (window.location.pathname !== LOGIN_PATH) window.location.assign(LOGIN_PATH);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <RouterProvider router={createAppRouter()} />
    </Provider>
  </StrictMode>,
);

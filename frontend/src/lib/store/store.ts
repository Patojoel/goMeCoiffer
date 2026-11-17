import { configureStore, createListenerMiddleware } from '@reduxjs/toolkit';
import { activeSalonChanged, sessionCleared } from '@/lib/rbac/sessionSlice';
import { appApi, purgeApiCache } from './api/appApi';
import type { AppDependencies } from './dependencies/AppDependencies';
import { reducer } from './reducer';

/** Pas de redux-persist : le cache RTK Query n'est jamais persisté. */
export function createStore(dependencies: AppDependencies) {
  const listeners = createListenerMiddleware();
  listeners.startListening({
    predicate: (action) => activeSalonChanged.match(action) || sessionCleared.match(action),
    effect: (_, { dispatch }) => {
      dispatch(purgeApiCache());
    },
  });

  return configureStore({
    reducer,
    middleware: (getDefault) =>
      getDefault({ thunk: { extraArgument: dependencies } })
        .prepend(listeners.middleware)
        .concat(appApi.middleware),
  });
}

export type AppStore = ReturnType<typeof createStore>;
export type AppDispatch = AppStore['dispatch'];

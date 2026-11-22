import { configureStore, createListenerMiddleware } from '@reduxjs/toolkit';
import {
  activeSalonChanged,
  sessionCleared,
  sessionExpired,
  sessionStarted,
} from '../rbac/sessionSlice.js';
import { appApi, purgeApiCache } from './api/appApi.js';
import type { AppDependencies } from './dependencies/AppDependencies.js';
import { reducer, type RootState } from './reducer.js';

export { setupListeners } from '@reduxjs/toolkit/query';

/** Pas de persistance globale : le cache RTK Query est purgé sur fermeture/expiration, changement de salon ou changement d'identité. */
export function createCoreStore(dependencies: AppDependencies) {
  const listeners = createListenerMiddleware();
  listeners.startListening({
    predicate: (action) =>
      sessionCleared.match(action) ||
      sessionExpired.match(action) ||
      activeSalonChanged.match(action),
    effect: (_, { dispatch }) => {
      dispatch(purgeApiCache());
    },
  });
  listeners.startListening({
    predicate: (action) => sessionStarted.match(action),
    effect: (_, listenerApi) => {
      const prev = (listenerApi.getOriginalState() as RootState).session;
      const next = (listenerApi.getState() as RootState).session;
      if (
        prev.userId !== next.userId ||
        prev.kind !== next.kind ||
        prev.activeSalonId !== next.activeSalonId ||
        prev.maskedPhone !== next.maskedPhone
      ) {
        listenerApi.dispatch(purgeApiCache());
      }
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

export type CoreStore = ReturnType<typeof createCoreStore>;
export type CoreDispatch = CoreStore['dispatch'];

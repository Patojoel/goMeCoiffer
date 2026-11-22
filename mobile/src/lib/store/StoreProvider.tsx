import type { CoreStore, TokenStorage } from '@gomecoiffer/client-core';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { setupPlatformListeners } from '../platform/setupPlatformListeners';
import { createTokenStorage } from '../storage/createTokenStorage';
import { createMobileStore } from './createMobileStore';

const TokenStorageContext = createContext<TokenStorage | null>(null);

export function useTokenStorage(): TokenStorage | null {
  return useContext(TokenStorageContext);
}

export type StoreProviderProps = {
  readonly children: ReactNode;
  readonly store?: CoreStore;
  readonly storage?: TokenStorage;
};

export function StoreProvider({ children, store, storage }: StoreProviderProps) {
  const [defaultState] = useState<{
    readonly store: CoreStore;
    readonly storage: TokenStorage;
  } | null>(() => {
    if (store) return null;
    const defaultStorage = storage ?? createTokenStorage();
    return {
      store: createMobileStore({ storage: defaultStorage }),
      storage: defaultStorage,
    };
  });

  const activeStore = store ?? defaultState!.store;
  const activeStorage = storage ?? defaultState?.storage ?? null;

  useEffect(() => setupPlatformListeners(activeStore.dispatch), [activeStore]);

  return (
    <TokenStorageContext.Provider value={activeStorage}>
      <Provider store={activeStore}>{children}</Provider>
    </TokenStorageContext.Provider>
  );
}

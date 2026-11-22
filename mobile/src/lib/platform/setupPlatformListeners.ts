import { setupListeners, type CoreDispatch } from '@gomecoiffer/client-core';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

function isNetworkOnline(state: NetInfoState): boolean {
  const connected = state.isConnected ?? true;
  const reachable = state.isInternetReachable ?? true;
  return connected && reachable;
}

export function setupPlatformListeners(dispatch: CoreDispatch): () => void {
  return setupListeners(dispatch, (d, { onFocus, onFocusLost, onOnline, onOffline }) => {
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') d(onFocus());
      else if (nextState === 'background') d(onFocusLost());
    });

    const netUnsub = NetInfo.addEventListener((state) => {
      d(isNetworkOnline(state) ? onOnline() : onOffline());
    });

    return () => {
      appStateSub.remove();
      netUnsub();
    };
  });
}

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    let active = true;
    void NetInfo.fetch().then((state) => {
      if (active) setIsOnline(isNetworkOnline(state));
    });
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(isNetworkOnline(state));
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return isOnline;
}

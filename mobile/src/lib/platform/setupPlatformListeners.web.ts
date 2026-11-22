import { setupListeners, type CoreDispatch } from '@gomecoiffer/client-core';
import { useEffect, useState } from 'react';

export function setupPlatformListeners(dispatch: CoreDispatch): () => void {
  return setupListeners(dispatch);
}

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.addEventListener) return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

import { useSignOutMutation } from '@gomecoiffer/client-core';
import { router, type Href } from 'expo-router';
import { useRef } from 'react';

const defaultNavigate = (path: string) => {
  router.replace(path as Href);
};

export type UseSignOutOptions = {
  readonly onNavigate?: (path: string) => void;
};

export function useSignOut({ onNavigate = defaultNavigate }: UseSignOutOptions = {}) {
  const [signOutMutation, { isLoading }] = useSignOutMutation();
  const pendingRef = useRef(false);

  const signOut = async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    try {
      await signOutMutation().unwrap();
    } catch {
      // Session is cleared locally by authApi.signOut even on network/401 failure (RG-013-12).
    } finally {
      pendingRef.current = false;
      onNavigate('/connexion');
    }
  };

  return { signOut, isSigningOut: isLoading };
}

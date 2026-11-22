import { resolveApiErrorMessage, useAddSalonMutation } from '@gomecoiffer/client-core';
import type { AddSalonToOrganization } from '@gomecoiffer/contracts';
import { useRef, useState } from 'react';

export type UseAddSalonOptions = {
  readonly onNavigate: (path: string) => void;
  readonly isOnline: boolean;
};

export function useAddSalon({ onNavigate, isOnline }: UseAddSalonOptions) {
  const [addSalon, { isLoading }] = useAddSalonMutation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pendingRef = useRef(false);

  const submit = async (values: AddSalonToOrganization) => {
    if (!isOnline || pendingRef.current || isLoading) return;
    pendingRef.current = true;
    setErrorMessage(null);
    try {
      await addSalon(values).unwrap();
      onNavigate('/(salon)/(tabs)');
    } catch (error) {
      setErrorMessage(resolveApiErrorMessage(error));
    } finally {
      pendingRef.current = false;
    }
  };

  return {
    isSubmitting: isLoading,
    errorMessage,
    submit,
  };
}

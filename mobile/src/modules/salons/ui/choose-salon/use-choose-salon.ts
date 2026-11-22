import {
  resolveApiErrorMessage,
  selectActiveSalonId,
  selectNextStep,
  selectSalons,
  useSelectActiveSalonMutation,
} from '@gomecoiffer/client-core';
import { useEffect, useRef, useState } from 'react';
import { useAppSelector } from '@/lib/store/hooks';

export type UseChooseSalonOptions = {
  readonly onNavigate: (path: string) => void;
  readonly isOnline: boolean;
};

export function useChooseSalon({ onNavigate, isOnline }: UseChooseSalonOptions) {
  const salons = useAppSelector(selectSalons);
  const activeSalonId = useAppSelector(selectActiveSalonId);
  const nextStep = useAppSelector(selectNextStep);

  const [selectActiveSalon, { isLoading }] = useSelectActiveSalonMutation();
  const [switchingSalonId, setSwitchingSalonId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const autoOpenedRef = useRef(false);
  const pendingRef = useRef(false);

  const isSwitching = isLoading || switchingSalonId !== null;

  const openSalon = async (salonId: string) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setErrorMessage(null);
    setSwitchingSalonId(salonId);
    try {
      await selectActiveSalon({ salonId }).unwrap();
      onNavigate('/(salon)/(tabs)');
    } catch (error) {
      setErrorMessage(resolveApiErrorMessage(error));
    } finally {
      pendingRef.current = false;
      setSwitchingSalonId(null);
    }
  };

  const selectSalon = async (salonId: string) => {
    if (!isOnline || pendingRef.current || isSwitching) return;
    await openSalon(salonId);
  };

  useEffect(() => {
    if (autoOpenedRef.current || pendingRef.current || !isOnline) return;
    if (nextStep !== 'OPEN_SALON' || salons.length !== 1 || activeSalonId !== null) return;
    const onlySalon = salons[0];
    if (!onlySalon) return;
    autoOpenedRef.current = true;
    void openSalon(onlySalon.id);
  });

  return {
    salons,
    activeSalonId,
    switchingSalonId,
    isSwitching,
    errorMessage,
    selectSalon,
  };
}

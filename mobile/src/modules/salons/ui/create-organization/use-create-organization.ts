import {
  authApi,
  resolveApiErrorMessage,
  selectNextStep,
  t,
  useCreateOrganizationMutation,
  type RootState,
} from '@gomecoiffer/client-core';
import type { CreateOrganization } from '@gomecoiffer/contracts';
import { useRef, useState } from 'react';
import { useStore } from 'react-redux';
import { resolveHomeHref } from '@/lib/navigation/home-route';
import { useAppDispatch } from '@/lib/store/hooks';

export type UseCreateOrganizationOptions = {
  readonly onNavigate: (path: string) => void;
  readonly isOnline: boolean;
};

function isOrganizationAlreadyExistsError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ORGANIZATION_ALREADY_EXISTS'
  );
}

export function useCreateOrganization({ onNavigate, isOnline }: UseCreateOrganizationOptions) {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const [createOrganization, { isLoading }] = useCreateOrganizationMutation();
  const [isRecoveringSession, setIsRecoveringSession] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const pendingRef = useRef(false);

  const isSubmitting = isLoading || isRecoveringSession;

  const submit = async (values: CreateOrganization) => {
    if (!isOnline || pendingRef.current || isSubmitting) return;
    pendingRef.current = true;
    setErrorMessage(null);
    setInfoMessage(null);
    try {
      const res = await createOrganization(values).unwrap();
      onNavigate(res.session.nextStep === 'OPEN_SALON' && res.session.activeSalonId
        ? '/(salon)/horaires?guide=1'
        : resolveHomeHref(res.session.nextStep));
    } catch (error) {
      if (isOrganizationAlreadyExistsError(error)) {
        setInfoMessage(t('salons.create.alreadyExistsHint'));
        setIsRecoveringSession(true);
        try {
          const summary = await dispatch(
            authApi.endpoints.getStaffSession.initiate(undefined, { forceRefetch: true }),
          ).unwrap();
          const nextStep = summary?.nextStep ?? selectNextStep(store.getState());
          if (nextStep) {
            onNavigate(resolveHomeHref(nextStep));
          }
        } catch (sessionError) {
          setInfoMessage(null);
          setErrorMessage(resolveApiErrorMessage(sessionError));
        } finally {
          setIsRecoveringSession(false);
        }
        return;
      }
      setErrorMessage(resolveApiErrorMessage(error));
    } finally {
      pendingRef.current = false;
    }
  };

  return {
    isSubmitting,
    errorMessage,
    infoMessage,
    submit,
  };
}

import {
  resolveApiErrorMessage,
  useSelectActiveSalonMutation,
  useSignInMutation,
} from '@gomecoiffer/client-core';
import { SignInSchema, type SignIn } from '@gomecoiffer/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { router, type Href } from 'expo-router';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { navigateAfterStaffSession } from '../complete-staff-navigation';

const defaultNavigate = (path: string) => {
  router.replace(path as Href);
};

export type UseSignInOptions = {
  readonly onNavigate?: (path: string) => void;
  readonly isOnline?: boolean;
};

export function useSignIn({ onNavigate = defaultNavigate, isOnline = true }: UseSignInOptions = {}) {
  const [signInMutation] = useSignInMutation();
  const [selectActiveSalonMutation] = useSelectActiveSalonMutation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignIn>({
    resolver: zodResolver(SignInSchema),
    defaultValues: { phone: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    if (!isOnline || submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setFormError(null);
    try {
      const res = await signInMutation(values).unwrap();
      await navigateAfterStaffSession(res.session, selectActiveSalonMutation, onNavigate);
    } catch (error) {
      setFormError(resolveApiErrorMessage(error));
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  });

  return {
    control,
    errors,
    formError,
    isSubmitting,
    isOnline,
    onSubmit,
    navigateTo: onNavigate,
  };
}

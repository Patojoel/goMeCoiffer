import {
  resolveApiErrorMessage,
  t,
  useRequestPasswordResetCodeMutation,
  useResetPasswordMutation,
  useSelectActiveSalonMutation,
} from '@gomecoiffer/client-core';
import {
  RequestPasswordResetCodeSchema,
  ResetPasswordSchema,
  type RequestPasswordResetCode,
} from '@gomecoiffer/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { router, type Href } from 'expo-router';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { navigateAfterStaffSession } from '../complete-staff-navigation';

const defaultNavigate = (path: string) => {
  router.replace(path as Href);
};

function buildResetStep2Schema(phone: string) {
  return z
    .object({
      code: z.string(),
      newPassword: z.string(),
      confirmPassword: z.string(),
    })
    .superRefine((data, ctx) => {
      const parsed = ResetPasswordSchema.safeParse({
        phone,
        code: data.code.trim(),
        newPassword: data.newPassword,
      });
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
        }
      }
      if (data.confirmPassword !== data.newPassword) {
        ctx.addIssue({
          code: 'custom',
          path: ['confirmPassword'],
          message: t('auth.signUp.passwordMismatch'),
        });
      }
    });
}

type ResetStep2Values = {
  code: string;
  newPassword: string;
  confirmPassword: string;
};

export type ResetCodeSentInfo = {
  readonly phone: string;
  readonly maskedPhone: string;
  readonly minutes: number;
};

export type UseForgotPasswordOptions = {
  readonly onNavigate?: (path: string) => void;
  readonly isOnline?: boolean;
};

export function useForgotPassword({
  onNavigate = defaultNavigate,
  isOnline = true,
}: UseForgotPasswordOptions = {}) {
  const [requestResetCodeMutation] = useRequestPasswordResetCodeMutation();
  const [resetPasswordMutation] = useResetPasswordMutation();
  const [selectActiveSalonMutation] = useSelectActiveSalonMutation();
  const [sentInfo, setSentInfo] = useState<ResetCodeSentInfo | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const pendingRef = useRef(false);

  const step1Form = useForm<RequestPasswordResetCode>({
    resolver: zodResolver(RequestPasswordResetCodeSchema),
    defaultValues: { phone: '' },
  });

  const step2Form = useForm<ResetStep2Values>({
    resolver: zodResolver(buildResetStep2Schema(sentInfo?.phone ?? '')),
    defaultValues: { code: '', newPassword: '', confirmPassword: '' },
  });

  const submitStep1 = step1Form.handleSubmit(async (values) => {
    if (!isOnline || pendingRef.current) return;
    pendingRef.current = true;
    setIsSubmitting(true);
    setFormError(null);
    try {
      const res = await requestResetCodeMutation(values).unwrap();
      setSentInfo({
        phone: values.phone,
        maskedPhone: res.maskedPhone,
        minutes: Math.max(1, Math.round(res.expiresInSeconds / 60)),
      });
    } catch (error) {
      setFormError(resolveApiErrorMessage(error));
    } finally {
      pendingRef.current = false;
      setIsSubmitting(false);
    }
  });

  const submitStep2 = step2Form.handleSubmit(async (values) => {
    if (!sentInfo || !isOnline || pendingRef.current) return;
    pendingRef.current = true;
    setIsSubmitting(true);
    setFormError(null);
    try {
      const res = await resetPasswordMutation({
        phone: sentInfo.phone,
        code: values.code.trim(),
        newPassword: values.newPassword,
      }).unwrap();
      await navigateAfterStaffSession(res.session, selectActiveSalonMutation, onNavigate);
    } catch (error) {
      setFormError(resolveApiErrorMessage(error));
    } finally {
      pendingRef.current = false;
      setIsSubmitting(false);
    }
  });

  const resendCode = async () => {
    if (!sentInfo || !isOnline || pendingRef.current) return;
    pendingRef.current = true;
    setIsResending(true);
    setFormError(null);
    try {
      const res = await requestResetCodeMutation({ phone: sentInfo.phone }).unwrap();
      setSentInfo({
        phone: sentInfo.phone,
        maskedPhone: res.maskedPhone,
        minutes: Math.max(1, Math.round(res.expiresInSeconds / 60)),
      });
    } catch (error) {
      setFormError(resolveApiErrorMessage(error));
    } finally {
      pendingRef.current = false;
      setIsResending(false);
    }
  };

  const goToPhoneStep = () => {
    setFormError(null);
    setSentInfo(null);
    step2Form.reset({ code: '', newPassword: '', confirmPassword: '' });
  };

  return {
    step: sentInfo ? ('reset' as const) : ('phone' as const),
    sentInfo,
    step1Form,
    step2Form,
    formError,
    isSubmitting,
    isResending,
    isOnline,
    submitStep1,
    submitStep2,
    resendCode,
    goToPhoneStep,
    navigateTo: onNavigate,
  };
}

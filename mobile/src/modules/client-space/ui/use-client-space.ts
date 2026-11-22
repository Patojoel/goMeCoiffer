import {
  resolveApiErrorMessage,
  selectSession,
  useRequestClientCodeMutation,
  useSignOutMutation,
  useVerifyClientCodeMutation,
} from '@gomecoiffer/client-core';
import { RequestClientCodeSchema, VerifyClientCodeSchema } from '@gomecoiffer/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { router, type Href } from 'expo-router';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAppSelector } from '@/lib/store/hooks';

const defaultNavigate = (path: string) => {
  router.replace(path as Href);
};

const ClientStep1FormSchema = z
  .object({
    phone: z.string(),
    termsAccepted: z.boolean(),
  })
  .superRefine((data, ctx) => {
    const parsed = RequestClientCodeSchema.safeParse(data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
      }
    }
  });

type ClientStep1Values = z.infer<typeof ClientStep1FormSchema>;

function buildClientStep2Schema(phone: string) {
  return z
    .object({ code: z.string() })
    .superRefine((data, ctx) => {
      const parsed = VerifyClientCodeSchema.safeParse({
        phone,
        code: data.code.trim(),
      });
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
        }
      }
    });
}

export type ClientSpaceMode = 'bookings' | 'profile';

export type ClientCodeSentInfo = {
  readonly phone: string;
  readonly maskedPhone: string;
  readonly minutes: number;
};

export type UseClientSpaceOptions = {
  readonly mode?: ClientSpaceMode;
  readonly onNavigate?: (path: string) => void;
  readonly isOnline?: boolean;
};

export function useClientSpace({
  mode = 'profile',
  onNavigate = defaultNavigate,
  isOnline = true,
}: UseClientSpaceOptions = {}) {
  const session = useAppSelector(selectSession);
  const [requestClientCodeMutation] = useRequestClientCodeMutation();
  const [verifyClientCodeMutation] = useVerifyClientCodeMutation();
  const [signOutMutation] = useSignOutMutation();

  const [sentInfo, setSentInfo] = useState<ClientCodeSentInfo | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const pendingRef = useRef(false);

  const step1Form = useForm<ClientStep1Values>({
    resolver: zodResolver(ClientStep1FormSchema),
    defaultValues: { phone: '', termsAccepted: false },
  });

  const step2Form = useForm<{ code: string }>({
    resolver: zodResolver(buildClientStep2Schema(sentInfo?.phone ?? '')),
    defaultValues: { code: '' },
  });

  const submitStep1 = step1Form.handleSubmit(async (values) => {
    if (!isOnline || pendingRef.current) return;
    pendingRef.current = true;
    setIsSubmitting(true);
    setFormError(null);
    try {
      const res = await requestClientCodeMutation({
        phone: values.phone,
        termsAccepted: true,
      }).unwrap();
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
      await verifyClientCodeMutation({
        phone: sentInfo.phone,
        code: values.code.trim(),
      }).unwrap();
      setSentInfo(null);
      step2Form.reset({ code: '' });
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
      const res = await requestClientCodeMutation({
        phone: sentInfo.phone,
        termsAccepted: true,
      }).unwrap();
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
    step2Form.reset({ code: '' });
  };

  const signOutClient = async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setIsSigningOut(true);
    try {
      await signOutMutation().unwrap();
    } catch {
      // Session is cleared locally by authApi.signOut even on failure (RG-013-12).
    } finally {
      pendingRef.current = false;
      setIsSigningOut(false);
      setFormError(null);
      setSentInfo(null);
      step2Form.reset({ code: '' });
    }
  };

  return {
    mode,
    session,
    step: sentInfo ? ('verify' as const) : ('phone' as const),
    sentInfo,
    step1Form,
    step2Form,
    formError,
    isSubmitting,
    isResending,
    isSigningOut,
    isOnline,
    submitStep1,
    submitStep2,
    resendCode,
    goToPhoneStep,
    signOutClient,
    navigateTo: onNavigate,
  };
}

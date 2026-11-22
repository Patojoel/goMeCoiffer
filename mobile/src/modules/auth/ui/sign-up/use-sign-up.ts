import {
  resolveApiErrorMessage,
  t,
  useConfirmSignUpMutation,
  useRequestSignUpCodeMutation,
} from '@gomecoiffer/client-core';
import {
  ConfirmSignUpSchema,
  RequestSignUpCodeSchema,
  type ConfirmSignUp,
} from '@gomecoiffer/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { router, type Href } from 'expo-router';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { resolveHomeHref } from '@/lib/navigation/home-route';

const defaultNavigate = (path: string) => {
  router.replace(path as Href);
};

const SignUpStep1FormSchema = z
  .object({
    phone: z.string(),
    acceptedTerms: z.boolean(),
  })
  .superRefine((data, ctx) => {
    const parsed = RequestSignUpCodeSchema.safeParse(data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
      }
    }
  });

type SignUpStep1Values = z.infer<typeof SignUpStep1FormSchema>;

function buildStep2Schema(phone: string) {
  return z
    .object({
      code: z.string(),
      name: z.string(),
      email: z.string(),
      password: z.string(),
      confirmPassword: z.string(),
      acceptedTerms: z.boolean(),
    })
    .superRefine((data, ctx) => {
      const trimmedEmail = data.email.trim();
      const parsed = ConfirmSignUpSchema.safeParse({
        phone,
        code: data.code.trim(),
        name: data.name,
        ...(trimmedEmail.length > 0 ? { email: trimmedEmail } : {}),
        password: data.password,
        acceptedTerms: data.acceptedTerms,
      });
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
        }
      }
      if (data.confirmPassword !== data.password) {
        ctx.addIssue({
          code: 'custom',
          path: ['confirmPassword'],
          message: t('auth.signUp.passwordMismatch'),
        });
      }
    });
}

type SignUpStep2Values = {
  code: string;
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
};

export type SentCodeInfo = {
  readonly phone: string;
  readonly maskedPhone: string;
  readonly minutes: number;
};

export type UseSignUpOptions = {
  readonly onNavigate?: (path: string) => void;
  readonly isOnline?: boolean;
};

export function useSignUp({ onNavigate = defaultNavigate, isOnline = true }: UseSignUpOptions = {}) {
  const [requestSignUpCodeMutation] = useRequestSignUpCodeMutation();
  const [confirmSignUpMutation] = useConfirmSignUpMutation();
  const [sentInfo, setSentInfo] = useState<SentCodeInfo | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const pendingRef = useRef(false);

  const step1Form = useForm<SignUpStep1Values>({
    resolver: zodResolver(SignUpStep1FormSchema),
    defaultValues: { phone: '', acceptedTerms: false },
  });

  const step2Form = useForm<SignUpStep2Values>({
    resolver: zodResolver(buildStep2Schema(sentInfo?.phone ?? '')),
    defaultValues: {
      code: '',
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptedTerms: true,
    },
  });

  const submitStep1 = step1Form.handleSubmit(async (values) => {
    if (!isOnline || pendingRef.current) return;
    pendingRef.current = true;
    setIsSubmitting(true);
    setFormError(null);
    try {
      const res = await requestSignUpCodeMutation({
        phone: values.phone,
        acceptedTerms: true,
      }).unwrap();
      setSentInfo({
        phone: values.phone,
        maskedPhone: res.maskedPhone,
        minutes: Math.max(1, Math.round(res.expiresInSeconds / 60)),
      });
      step2Form.setValue('acceptedTerms', true);
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
      const trimmedEmail = values.email.trim();
      const command: ConfirmSignUp = {
        phone: sentInfo.phone,
        code: values.code.trim(),
        name: values.name.trim(),
        password: values.password,
        acceptedTerms: true,
        ...(trimmedEmail.length > 0 ? { email: trimmedEmail } : {}),
      };
      const res = await confirmSignUpMutation(command).unwrap();
      onNavigate(resolveHomeHref(res.nextStep));
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
      const res = await requestSignUpCodeMutation({
        phone: sentInfo.phone,
        acceptedTerms: true,
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
    step2Form.reset({
      code: '',
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptedTerms: true,
    });
  };

  return {
    step: sentInfo ? ('confirm' as const) : ('phone' as const),
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

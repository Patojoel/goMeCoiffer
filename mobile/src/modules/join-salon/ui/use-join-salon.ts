import {
  appApi,
  resolveApiErrorMessage,
  t,
  useAcceptInvitationMutation,
  useListProvenInvitationsQuery,
  useProveInvitationPhoneMutation,
  useRequestInvitationCodeMutation,
} from '@gomecoiffer/client-core';
import {
  AcceptInvitationSchema,
  ProveInvitationPhoneSchema,
  RequestInvitationCodeSchema,
  RequestSignUpCodeSchema,
  SignInSchema,
  type InvitationAccepted,
  type RequestInvitationCode,
} from '@gomecoiffer/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { resolveHomeHref } from '@/lib/navigation/home-route';
import { useAppDispatch } from '@/lib/store/hooks';

const defaultNavigate = (path: string) => {
  router.replace(path as Href);
};

function buildProveSchema(phone: string) {
  return z
    .object({ code: z.string() })
    .superRefine((data, ctx) => {
      const parsed = ProveInvitationPhoneSchema.safeParse({
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

const JoinNewAccountFormSchema = z
  .object({
    name: z.string(),
    password: z.string(),
    confirmPassword: z.string(),
    termsAccepted: z.boolean(),
  })
  .superRefine((data, ctx) => {
    const passwordCheck = SignInSchema.shape.password.safeParse(data.password);
    if (!passwordCheck.success) {
      for (const issue of passwordCheck.error.issues) {
        ctx.addIssue({ code: 'custom', path: ['password'], message: issue.message });
      }
    }

    const termsCheck = RequestSignUpCodeSchema.shape.acceptedTerms.safeParse(data.termsAccepted);
    if (!termsCheck.success) {
      for (const issue of termsCheck.error.issues) {
        ctx.addIssue({ code: 'custom', path: ['termsAccepted'], message: issue.message });
      }
    }

    const parsed = AcceptInvitationSchema.safeParse({
      name: data.name,
      password: passwordCheck.success ? data.password : 'placeholder-valid-length',
      termsAccepted: true,
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

type JoinNewAccountValues = z.infer<typeof JoinNewAccountFormSchema>;

export type SentJoinCodeInfo = {
  readonly phone: string;
  readonly maskedPhone: string;
  readonly minutes: number;
};

export type UseJoinSalonOptions = {
  readonly onNavigate?: (path: string) => void;
  readonly isOnline?: boolean;
};

export function useJoinSalon({
  onNavigate = defaultNavigate,
  isOnline = true,
}: UseJoinSalonOptions = {}) {
  const dispatch = useAppDispatch();
  const [requestCodeMutation] = useRequestInvitationCodeMutation();
  const [provePhoneMutation] = useProveInvitationPhoneMutation();
  const [acceptInvitationMutation] = useAcceptInvitationMutation();

  const [sentInfo, setSentInfo] = useState<SentJoinCodeInfo | null>(null);
  const [isProven, setIsProven] = useState(false);
  const [selectedInvitationId, setSelectedInvitationId] = useState<string | null>(null);
  const [signInRequiredSalonName, setSignInRequiredSalonName] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const pendingRef = useRef(false);
  const syncedInvitationIdRef = useRef<string | null>(null);
  const nameModifiedRef = useRef(false);

  const invitationsQuery = useListProvenInvitationsQuery(undefined, { skip: !isProven });
  const invitations = invitationsQuery.data?.invitations ?? [];
  const account = invitationsQuery.data?.account ?? null;
  const selectedInvitation =
    invitations.find((inv) => inv.invitationId === selectedInvitationId) ?? invitations[0] ?? null;

  const step1Form = useForm<RequestInvitationCode>({
    resolver: zodResolver(RequestInvitationCodeSchema),
    defaultValues: { phone: '' },
  });

  const step2Form = useForm<{ code: string }>({
    resolver: zodResolver(buildProveSchema(sentInfo?.phone ?? '')),
    defaultValues: { code: '' },
  });

  const step3Form = useForm<JoinNewAccountValues>({
    resolver: zodResolver(JoinNewAccountFormSchema),
    defaultValues: {
      name: '',
      password: '',
      confirmPassword: '',
      termsAccepted: false,
    },
  });

  const setStep3NameValue = step3Form.setValue;
  useEffect(() => {
    if (!selectedInvitation || account === 'EXISTING') return;
    if (syncedInvitationIdRef.current !== selectedInvitation.invitationId) {
      syncedInvitationIdRef.current = selectedInvitation.invitationId;
      if (!nameModifiedRef.current) {
        setStep3NameValue('name', selectedInvitation.suggestedName);
      }
    }
  }, [selectedInvitation, account, setStep3NameValue]);

  const handleAcceptedOutcome = (res: InvitationAccepted) => {
    if (res.outcome === 'SIGNED_IN') {
      onNavigate(resolveHomeHref(res.session.nextStep));
      return;
    }
    setSignInRequiredSalonName(res.salonName);
  };

  const submitStep1 = step1Form.handleSubmit(async (values) => {
    if (!isOnline || pendingRef.current) return;
    pendingRef.current = true;
    setIsSubmitting(true);
    setFormError(null);
    try {
      const res = await requestCodeMutation(values).unwrap();
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
      await provePhoneMutation({
        phone: sentInfo.phone,
        code: values.code.trim(),
      }).unwrap();
      setIsProven(true);
    } catch (error) {
      setFormError(resolveApiErrorMessage(error));
    } finally {
      pendingRef.current = false;
      setIsSubmitting(false);
    }
  });

  const submitNewAccountAcceptance = step3Form.handleSubmit(async (values) => {
    if (!selectedInvitation || !isOnline || pendingRef.current) return;
    pendingRef.current = true;
    setIsSubmitting(true);
    setFormError(null);
    try {
      const res = await acceptInvitationMutation({
        invitationId: selectedInvitation.invitationId,
        body: {
          name: values.name.trim(),
          password: values.password,
          termsAccepted: true,
        },
      }).unwrap();
      handleAcceptedOutcome(res);
    } catch (error) {
      setFormError(resolveApiErrorMessage(error));
    } finally {
      pendingRef.current = false;
      setIsSubmitting(false);
    }
  });

  const acceptExistingAccount = async () => {
    if (!selectedInvitation || !isOnline || pendingRef.current) return;
    pendingRef.current = true;
    setIsSubmitting(true);
    setFormError(null);
    try {
      const res = await acceptInvitationMutation({
        invitationId: selectedInvitation.invitationId,
        body: {},
      }).unwrap();
      handleAcceptedOutcome(res);
    } catch (error) {
      setFormError(resolveApiErrorMessage(error));
    } finally {
      pendingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const resendCode = async () => {
    if (!sentInfo || !isOnline || pendingRef.current) return;
    pendingRef.current = true;
    setIsResending(true);
    setFormError(null);
    try {
      const res = await requestCodeMutation({ phone: sentInfo.phone }).unwrap();
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
    setIsProven(false);
    setSentInfo(null);
    setSelectedInvitationId(null);
    setSignInRequiredSalonName(null);
    syncedInvitationIdRef.current = null;
    nameModifiedRef.current = false;
    step2Form.reset({ code: '' });
    step3Form.reset({
      name: '',
      password: '',
      confirmPassword: '',
      termsAccepted: false,
    });
    dispatch(appApi.util.invalidateTags(['ProvenInvitations']));
  };

  const markNameModified = () => {
    nameModifiedRef.current = true;
  };

  const step = isProven ? ('invitations' as const) : sentInfo ? ('prove' as const) : ('phone' as const);

  return {
    step,
    sentInfo,
    step1Form,
    step2Form,
    step3Form,
    invitationsQuery,
    invitations,
    account,
    selectedInvitation,
    selectInvitation: setSelectedInvitationId,
    signInRequiredSalonName,
    formError,
    isSubmitting,
    isResending,
    isOnline,
    submitStep1,
    submitStep2,
    submitNewAccountAcceptance,
    acceptExistingAccount,
    resendCode,
    goToPhoneStep,
    markNameModified,
    navigateTo: onNavigate,
  };
}

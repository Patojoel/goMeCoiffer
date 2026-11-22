import {
  formatDateFr,
  resolveApiErrorMessage,
  t,
  useInviteCollaboratorMutation,
} from '@gomecoiffer/client-core';
import {
  InviteCollaboratorSchema,
  type CollaboratorInvited,
  type InviteCollaborator,
} from '@gomecoiffer/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Linking } from 'react-native';

export type UseInviteCollaboratorOptions = {
  readonly isOnline?: boolean;
  readonly onOpenExternalUrl?: (url: string) => Promise<void> | void;
};

const defaultOpenExternalUrl = (url: string) => Linking.openURL(url);

export function buildWhatsAppInviteUrl(): string {
  const joinUrl =
    typeof window !== 'undefined' && window.location?.origin
      ? `${window.location.origin}/rejoindre`
      : 'https://gomecoiffer.cm/rejoindre';
  const message = t('team.invite.whatsappMessage', { url: joinUrl });
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function useInviteCollaborator({
  isOnline = true,
  onOpenExternalUrl = defaultOpenExternalUrl,
}: UseInviteCollaboratorOptions = {}) {
  const [inviteCollaborator] = useInviteCollaboratorMutation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [lastInvited, setLastInvited] = useState<CollaboratorInvited | null>(null);
  const submittingRef = useRef(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteCollaborator>({
    resolver: zodResolver(InviteCollaboratorSchema),
    defaultValues: { name: '', phone: '' },
  });

  const selectedRole = useWatch({ control, name: 'role' });

  const onSubmit = handleSubmit(async (values) => {
    if (!isOnline || submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setFormError(null);
    try {
      const invited = await inviteCollaborator(values).unwrap();
      setLastInvited(invited);
      reset({ name: '', phone: '' });
    } catch (err) {
      setFormError(resolveApiErrorMessage(err));
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  });

  const shareOnWhatsApp = async () => {
    setFormError(null);
    try {
      await onOpenExternalUrl(buildWhatsAppInviteUrl());
    } catch (err) {
      setFormError(resolveApiErrorMessage(err));
    }
  };

  return {
    control,
    errors,
    selectedRole,
    formError,
    lastInvited,
    successMessage: lastInvited
      ? t('team.invite.successHint', { date: formatDateFr(lastInvited.expiresAt) })
      : null,
    isSubmitting,
    isOnline,
    onSubmit,
    shareOnWhatsApp,
  };
}

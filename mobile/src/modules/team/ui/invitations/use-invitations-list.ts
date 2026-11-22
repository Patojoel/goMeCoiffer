import {
  can,
  resolveApiErrorMessage,
  selectSession,
  useCancelInvitationMutation,
  useListSalonInvitationsQuery,
} from '@gomecoiffer/client-core';
import { useRef, useState } from 'react';
import { useAppSelector } from '@/lib/store/hooks';

export type UseInvitationsListOptions = {
  readonly isOnline?: boolean;
};

export function useInvitationsList({ isOnline = true }: UseInvitationsListOptions = {}) {
  const session = useAppSelector(selectSession);
  const { data, error, isError, isLoading, isFetching, refetch } = useListSalonInvitationsQuery();
  const [cancelInvitationMutation] = useCancelInvitationMutation();

  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const cancellingRef = useRef(false);

  const viewState = isError
    ? ('error' as const)
    : isLoading || !data
      ? ('loading' as const)
      : ('ready' as const);

  const cancelInvitation = async (invitationId: string) => {
    if (!isOnline || cancellingRef.current) return;
    cancellingRef.current = true;
    setCancellingId(invitationId);
    setCancelError(null);
    try {
      await cancelInvitationMutation(invitationId).unwrap();
    } catch (err) {
      setCancelError(resolveApiErrorMessage(err));
    } finally {
      cancellingRef.current = false;
      setCancellingId(null);
    }
  };

  const invitations = data ?? [];

  return {
    viewState,
    invitations,
    isLimitReached: invitations.length >= 100,
    errorMessage: isError ? resolveApiErrorMessage(error) : null,
    isRetrying: isFetching,
    retry: () => {
      void refetch();
    },
    canInvite: can(session, 'staff:invite'),
    isOnline,
    cancellingId,
    cancelError,
    cancelInvitation,
  };
}

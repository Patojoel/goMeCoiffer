import {
  can,
  resolveApiErrorMessage,
  selectSession,
  t,
  useChangeCollaboratorRoleMutation,
  useListSalonTeamQuery,
  useRemoveCollaboratorMutation,
} from '@gomecoiffer/client-core';
import {
  InvitableSalonRoleSchema,
  type InvitableSalonRole,
  type SalonTeamMember,
} from '@gomecoiffer/contracts';
import { useRef, useState } from 'react';
import type { SelectOption } from '@/components/ui/select-field';
import { useAppSelector } from '@/lib/store/hooks';

export type UseTeamListOptions = {
  readonly isOnline?: boolean;
};

export type MemberActionError = {
  readonly membershipId: string;
  readonly message: string;
};

export const TEAM_ROLE_OPTIONS: ReadonlyArray<SelectOption<InvitableSalonRole>> =
  InvitableSalonRoleSchema.options.map((role) => ({
    value: role,
    label: t(`team.role.${role}`),
    description: t(`team.roleDesc.${role}`),
  }));

export function useTeamList({ isOnline = true }: UseTeamListOptions = {}) {
  const session = useAppSelector(selectSession);
  const { data, error, isError, isLoading, isFetching, refetch } = useListSalonTeamQuery();
  const [changeCollaboratorRole] = useChangeCollaboratorRoleMutation();
  const [removeCollaborator] = useRemoveCollaboratorMutation();

  const [pendingMembershipId, setPendingMembershipId] = useState<string | null>(null);
  const [removingMembershipId, setRemovingMembershipId] = useState<string | null>(null);
  const [confirmingRemovalId, setConfirmingRemovalId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<MemberActionError | null>(null);
  const busyRef = useRef(false);

  const viewState = isError
    ? ('error' as const)
    : isLoading || !data
      ? ('loading' as const)
      : ('ready' as const);

  const changeRole = async (member: SalonTeamMember, nextRole: InvitableSalonRole) => {
    if (!isOnline || busyRef.current || nextRole === member.role) return;
    busyRef.current = true;
    setPendingMembershipId(member.membershipId);
    setActionError(null);
    try {
      await changeCollaboratorRole({
        membershipId: member.membershipId,
        body: { role: nextRole, version: member.version },
      }).unwrap();
    } catch (err) {
      setActionError({ membershipId: member.membershipId, message: resolveApiErrorMessage(err) });
    } finally {
      busyRef.current = false;
      setPendingMembershipId(null);
    }
  };

  const requestRemove = (membershipId: string) => {
    if (!isOnline || busyRef.current) return;
    setActionError(null);
    setConfirmingRemovalId(membershipId);
  };

  const cancelRemove = () => {
    if (busyRef.current) return;
    setConfirmingRemovalId(null);
  };

  const confirmRemove = async (member: SalonTeamMember) => {
    if (!isOnline || busyRef.current) return;
    busyRef.current = true;
    setPendingMembershipId(member.membershipId);
    setRemovingMembershipId(member.membershipId);
    setActionError(null);
    try {
      await removeCollaborator({
        membershipId: member.membershipId,
        body: { version: member.version },
      }).unwrap();
      setConfirmingRemovalId(null);
    } catch (err) {
      setActionError({ membershipId: member.membershipId, message: resolveApiErrorMessage(err) });
    } finally {
      busyRef.current = false;
      setPendingMembershipId(null);
      setRemovingMembershipId(null);
    }
  };

  return {
    viewState,
    members: data?.members ?? [],
    errorMessage: isError ? resolveApiErrorMessage(error) : null,
    isRetrying: isFetching,
    retry: () => {
      void refetch();
    },
    canManageStaff: can(session, 'staff:manage'),
    isOnline,
    pendingMembershipId,
    removingMembershipId,
    confirmingRemovalId,
    actionError,
    changeRole,
    requestRemove,
    cancelRemove,
    confirmRemove,
  };
}

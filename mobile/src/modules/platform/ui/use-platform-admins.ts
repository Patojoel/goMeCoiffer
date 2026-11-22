import {
  resolveApiErrorMessage,
  selectSession,
  t,
  useGrantSystemRoleMutation,
  useListPlatformAdminsQuery,
  useRevokeSystemRoleMutation,
} from '@gomecoiffer/client-core';
import {
  GrantSystemRoleSchema,
  SYSTEM_ROLES,
  type GrantSystemRole,
  type SystemRole,
} from '@gomecoiffer/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { SelectOption } from '@/components/ui/select-field';
import { useAppSelector } from '@/lib/store/hooks';

export type UsePlatformAdminsOptions = {
  readonly isOnline?: boolean;
};

export type RevokeTarget = {
  readonly userId: string;
  readonly role: SystemRole;
};

export type RevokeActionError = RevokeTarget & {
  readonly message: string;
};

export const SYSTEM_ROLE_OPTIONS: ReadonlyArray<SelectOption<SystemRole>> = SYSTEM_ROLES.map(
  (role) => ({
    value: role,
    label: t(`platform.role.${role}`),
  }),
);

export function usePlatformAdmins({ isOnline = true }: UsePlatformAdminsOptions = {}) {
  const session = useAppSelector(selectSession);
  const { data, error, isError, isLoading, isFetching, refetch } = useListPlatformAdminsQuery();
  const [grantSystemRole] = useGrantSystemRoleMutation();
  const [revokeSystemRole] = useRevokeSystemRoleMutation();

  const [isGranting, setIsGranting] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);
  const grantingRef = useRef(false);

  const [confirmingTarget, setConfirmingTarget] = useState<RevokeTarget | null>(null);
  const [revokingTarget, setRevokingTarget] = useState<RevokeTarget | null>(null);
  const [revokeError, setRevokeError] = useState<RevokeActionError | null>(null);
  const revokingRef = useRef(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<GrantSystemRole>({
    resolver: zodResolver(GrantSystemRoleSchema),
    defaultValues: { phone: '' },
  });

  const viewState = isError
    ? ('error' as const)
    : isLoading || !data
      ? ('loading' as const)
      : ('ready' as const);

  const superAdminCount = data?.superAdminCount ?? 0;

  const onGrantSubmit = handleSubmit(async (values) => {
    if (!isOnline || grantingRef.current) return;
    grantingRef.current = true;
    setIsGranting(true);
    setGrantError(null);
    try {
      await grantSystemRole(values).unwrap();
      reset({ phone: '' });
    } catch (err) {
      setGrantError(resolveApiErrorMessage(err));
    } finally {
      grantingRef.current = false;
      setIsGranting(false);
    }
  });

  const getRevokeDisabledReason = (userId: string, role: SystemRole): string | null => {
    if (userId === session.userId) {
      return t('platform.revokeSelfDisabled');
    }
    if (role === 'SUPER_ADMIN' && superAdminCount <= 1) {
      return t('platform.revokeLastSuperAdminDisabled');
    }
    return null;
  };

  const requestRevoke = (target: RevokeTarget) => {
    if (!isOnline || revokingRef.current) return;
    if (getRevokeDisabledReason(target.userId, target.role) !== null) return;
    setRevokeError(null);
    setConfirmingTarget(target);
  };

  const cancelRevoke = () => {
    if (revokingRef.current) return;
    setConfirmingTarget(null);
  };

  const confirmRevoke = async (target: RevokeTarget) => {
    if (!isOnline || revokingRef.current) return;
    if (getRevokeDisabledReason(target.userId, target.role) !== null) return;
    revokingRef.current = true;
    setRevokingTarget(target);
    setRevokeError(null);
    try {
      await revokeSystemRole(target).unwrap();
      setConfirmingTarget(null);
    } catch (err) {
      setRevokeError({ ...target, message: resolveApiErrorMessage(err) });
    } finally {
      revokingRef.current = false;
      setRevokingTarget(null);
    }
  };

  return {
    viewState,
    admins: data?.admins ?? [],
    superAdminCount,
    errorMessage: isError ? resolveApiErrorMessage(error) : null,
    isRetrying: isFetching,
    retry: () => {
      void refetch();
    },
    isOnline,
    control,
    errors,
    isGranting,
    grantError,
    onGrantSubmit,
    confirmingTarget,
    revokingTarget,
    revokeError,
    getRevokeDisabledReason,
    requestRevoke,
    cancelRevoke,
    confirmRevoke,
  };
}

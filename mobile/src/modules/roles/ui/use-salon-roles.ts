import {
  applyPermissionToggleWithDependencies,
  resolveApiErrorMessage,
  t,
  useAdjustRolePermissionsMutation,
  useGetSalonRolesQuery,
} from '@gomecoiffer/client-core';
import type { AdjustablePermission, AdjustableSalonRole, SalonRoles } from '@gomecoiffer/contracts';
import { useRef, useState } from 'react';

export type UseSalonRolesOptions = {
  readonly isOnline: boolean;
};

type RoleEntry = SalonRoles['roles'][number];

function isConflictFailure(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const status = 'status' in error ? error.status : undefined;
  const code = 'code' in error ? error.code : undefined;
  return (
    status === 409 ||
    code === 'ROLE_PERMISSIONS_CHANGED_MEANWHILE' ||
    code === 'CONFLICT' ||
    code === 'CONCURRENCY_CONFLICT'
  );
}

export function useSalonRoles({ isOnline }: UseSalonRolesOptions) {
  const { data, isError, error, isLoading, isFetching, refetch } = useGetSalonRolesQuery();
  const [adjustRolePermissions, { isLoading: isAdjusting }] = useAdjustRolePermissionsMutation();

  const [selectedRole, setSelectedRole] = useState<AdjustableSalonRole>('SALON_ADMIN');
  const [draftState, setDraftState] = useState<{
    readonly syncKey: string;
    readonly permissions: readonly AdjustablePermission[];
  } | null>(null);
  const [confirmedState, setConfirmedState] = useState<{
    readonly role: AdjustableSalonRole;
    readonly version: number;
    readonly permissions: readonly AdjustablePermission[];
  } | null>(null);
  const [autoChanged, setAutoChanged] = useState<readonly AdjustablePermission[]>([]);
  const [savedNotice, setSavedNotice] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<'save' | 'reset' | null>(null);
  const pendingRef = useRef(false);

  if (isError && !data) {
    return {
      status: 'error' as const,
      errorMessage: resolveApiErrorMessage(error),
      isRetrying: isFetching,
      retry: () => void refetch(),
    };
  }

  if (isLoading || !data) {
    return {
      status: 'loading' as const,
    };
  }

  const selectedRoleEntry: RoleEntry | undefined =
    data.roles.find((entry) => entry.role === selectedRole) ?? data.roles[0];

  if (!selectedRoleEntry) {
    return {
      status: 'error' as const,
      errorMessage: t('errors.generic'),
      isRetrying: isFetching,
      retry: () => void refetch(),
    };
  }

  const confirmedMatchesRole =
    confirmedState !== null &&
    confirmedState.role === selectedRoleEntry.role &&
    confirmedState.version > selectedRoleEntry.version;

  const effectiveVersion = confirmedMatchesRole
    ? confirmedState.version
    : selectedRoleEntry.version;

  const serverPermissions = confirmedMatchesRole
    ? confirmedState.permissions
    : selectedRoleEntry.permissions;

  const syncKey = `${selectedRoleEntry.role}:${effectiveVersion}`;
  const draftPermissions =
    draftState && draftState.syncKey === syncKey ? draftState.permissions : serverPermissions;

  const isBusy = isAdjusting || pendingAction !== null;

  const selectRole = (role: AdjustableSalonRole) => {
    const target = data.roles.find((entry) => entry.role === role);
    setSelectedRole(role);
    setDraftState(
      target
        ? { syncKey: `${target.role}:${target.version}`, permissions: [...target.permissions] }
        : null,
    );
    setConfirmedState(null);
    setAutoChanged([]);
    setSavedNotice(false);
    setConflictError(null);
    setMutationError(null);
  };

  const togglePermission = (permission: AdjustablePermission, enabled: boolean) => {
    const result = applyPermissionToggleWithDependencies(draftPermissions, permission, enabled);
    setDraftState({ syncKey, permissions: result.permissions });
    setAutoChanged(result.autoChanged);
    setSavedNotice(false);
    setMutationError(null);
  };

  const submitAdjustment = async (action: 'save' | 'reset') => {
    if (!isOnline || pendingRef.current || isBusy) return;
    pendingRef.current = true;
    setSavedNotice(false);
    setConflictError(null);
    setMutationError(null);
    setAutoChanged([]);
    setPendingAction(action);

    const body =
      action === 'reset'
        ? {
            permissions: [...selectedRoleEntry.defaultPermissions],
            version: effectiveVersion,
            resetToDefault: true,
          }
        : {
            permissions: [...draftPermissions],
            version: effectiveVersion,
          };

    try {
      const adjusted = await adjustRolePermissions({
        role: selectedRoleEntry.role,
        body,
      }).unwrap();
      setConfirmedState({
        role: adjusted.role,
        version: adjusted.version,
        permissions: adjusted.permissions,
      });
      setDraftState({
        syncKey: `${adjusted.role}:${adjusted.version}`,
        permissions: adjusted.permissions,
      });
      setSavedNotice(true);
    } catch (err) {
      if (isConflictFailure(err)) {
        setConflictError(resolveApiErrorMessage(err));
      } else {
        setMutationError(resolveApiErrorMessage(err));
      }
    } finally {
      pendingRef.current = false;
      setPendingAction(null);
    }
  };

  const refreshAfterConflict = async () => {
    setConflictError(null);
    setMutationError(null);
    setAutoChanged([]);
    setSavedNotice(false);
    const result = await refetch();
    if (result.data) {
      const refreshed =
        result.data.roles.find((entry) => entry.role === selectedRoleEntry.role) ??
        result.data.roles[0];
      if (refreshed) {
        setConfirmedState(null);
        setDraftState({
          syncKey: `${refreshed.role}:${refreshed.version}`,
          permissions: [...refreshed.permissions],
        });
      }
    }
  };

  return {
    status: 'ready' as const,
    owner: data.owner,
    roles: data.roles,
    selectedRoleEntry,
    draftPermissions,
    autoChanged,
    savedNotice,
    conflictError,
    mutationError,
    isSaving: pendingAction === 'save',
    isResetting: pendingAction === 'reset',
    isBusy,
    isRefreshingConflict: isFetching,
    selectRole,
    togglePermission,
    save: () => void submitAdjustment('save'),
    resetToDefault: () => void submitAdjustment('reset'),
    refreshAfterConflict: () => void refreshAfterConflict(),
  };
}

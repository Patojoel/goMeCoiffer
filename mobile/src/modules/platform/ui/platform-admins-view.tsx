import { t } from '@gomecoiffer/client-core';
import type { GrantSystemRole, PlatformAdminSummary, SystemRole } from '@gomecoiffer/contracts';
import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import { FlatList, View } from 'react-native';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { FieldHint } from '@/components/forms/field-hint';
import { PhoneField } from '@/components/forms/phone-field';
import { RequireSystemRole } from '@/components/navigation/require-system-role';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { InlineAlert } from '@/components/ui/inline-alert';
import { SelectField } from '@/components/ui/select-field';
import { Skeleton } from '@/components/ui/skeleton';
import { ThemedText } from '@/components/ui/themed-text';
import { useOnlineStatus } from '@/lib/platform/setupPlatformListeners';
import {
  SYSTEM_ROLE_OPTIONS,
  usePlatformAdmins,
  type RevokeActionError,
  type RevokeTarget,
} from './use-platform-admins';

export type PlatformAdminsViewProps = {
  readonly isOnline?: boolean;
};

function isSameTarget(a: RevokeTarget | null, userId: string, role: SystemRole): boolean {
  return a !== null && a.userId === userId && a.role === role;
}

function PlatformAdminsHeader({
  superAdminCount,
  adminCount,
  isOnline,
  control,
  errors,
  isGranting,
  grantError,
  orphanRevokeError,
  onGrantSubmit,
}: {
  readonly superAdminCount: number;
  readonly adminCount: number;
  readonly isOnline: boolean;
  readonly control: Control<GrantSystemRole>;
  readonly errors: FieldErrors<GrantSystemRole>;
  readonly isGranting: boolean;
  readonly grantError: string | null;
  readonly orphanRevokeError: RevokeActionError | null;
  readonly onGrantSubmit: () => void;
}) {
  return (
    <View className="gap-4">
      <View className="gap-1">
        <ThemedText variant="title">{t('platform.title')}</ThemedText>
        <ThemedText variant="muted">{t('platform.subtitle', { count: superAdminCount })}</ThemedText>
      </View>

      {!isOnline ? <InlineAlert variant="warning" message={t('common.offlineActionHint')} /> : null}

      <Card>
        <CardTitle>{t('platform.grantTitle')}</CardTitle>
        {grantError ? <InlineAlert variant="error" message={grantError} /> : null}

        <Controller
          control={control}
          name="phone"
          render={({ field: { onChange, onBlur, value } }) => (
            <PhoneField
              label={t('platform.phoneLabel')}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.phone?.message}
              editable={!isGranting}
            />
          )}
        />

        <Controller
          control={control}
          name="role"
          render={({ field: { onChange, value } }) => (
            <SelectField
              label={t('platform.roleLabel')}
              value={value}
              options={SYSTEM_ROLE_OPTIONS}
              hint={t('platform.grantHint')}
              error={errors.role?.message}
              disabled={isGranting}
              onChange={onChange}
            />
          )}
        />

        <Button
          title={t('platform.grantSubmit')}
          onPress={onGrantSubmit}
          loading={isGranting}
          disabled={!isOnline}
        />
      </Card>

      {orphanRevokeError ? <InlineAlert variant="error" message={orphanRevokeError.message} /> : null}

      <ThemedText variant="muted" className="font-semibold">
        {t('platform.adminsTitle', { count: adminCount })}
      </ThemedText>
    </View>
  );
}

function PlatformAdminRow({
  admin,
  isOnline,
  confirmingTarget,
  revokingTarget,
  revokeError,
  getRevokeDisabledReason,
  onRequestRevoke,
  onCancelRevoke,
  onConfirmRevoke,
}: {
  readonly admin: PlatformAdminSummary;
  readonly isOnline: boolean;
  readonly confirmingTarget: RevokeTarget | null;
  readonly revokingTarget: RevokeTarget | null;
  readonly revokeError: RevokeActionError | null;
  readonly getRevokeDisabledReason: (userId: string, role: SystemRole) => string | null;
  readonly onRequestRevoke: (target: RevokeTarget) => void;
  readonly onCancelRevoke: () => void;
  readonly onConfirmRevoke: (target: RevokeTarget) => void;
}) {
  const isRevokeBusy = revokingTarget !== null;

  return (
    <Card>
      <View className="gap-0.5">
        <ThemedText variant="headline">{admin.name}</ThemedText>
        <ThemedText selectable variant="muted">
          {admin.maskedPhone}
        </ThemedText>
      </View>

      <View className="gap-3">
        {admin.roles.map((entry) => {
          const disabledReason = getRevokeDisabledReason(admin.userId, entry.role);
          const isConfirming = isSameTarget(confirmingTarget, admin.userId, entry.role);
          const isRevokingThis = isSameTarget(revokingTarget, admin.userId, entry.role);
          const hasEntryError = isSameTarget(revokeError, admin.userId, entry.role);

          return (
            <View
              key={entry.role}
              className="gap-2 rounded-xl border border-border bg-background p-3"
              style={{ borderCurve: 'continuous' }}
            >
              <View className="flex-row flex-wrap items-center justify-between gap-2">
                <Badge
                  variant={entry.role === 'SUPER_ADMIN' ? 'default' : 'secondary'}
                  label={t(`platform.role.${entry.role}`)}
                />

                {!isConfirming ? (
                  <Button
                    variant="outline"
                    size="sm"
                    title={t('platform.revokeAction')}
                    disabled={disabledReason !== null || !isOnline || isRevokeBusy}
                    onPress={() => onRequestRevoke({ userId: admin.userId, role: entry.role })}
                  />
                ) : null}
              </View>

              {disabledReason ? <FieldHint message={disabledReason} /> : null}
              {hasEntryError && revokeError ? (
                <InlineAlert variant="error" message={revokeError.message} />
              ) : null}

              {isConfirming ? (
                <View
                  className="gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3"
                  style={{ borderCurve: 'continuous' }}
                >
                  <ThemedText variant="headline" className="text-sm text-destructive">
                    {t('platform.revokeConfirmTitle')}
                  </ThemedText>
                  <FieldHint message={t('platform.revokeConfirmHint', { name: admin.name })} />
                  <View className="flex-row flex-wrap gap-2 pt-1">
                    <Button
                      variant="accent"
                      size="sm"
                      title={t('common.confirm')}
                      loading={isRevokingThis}
                      disabled={!isOnline || isRevokeBusy}
                      onPress={() => onConfirmRevoke({ userId: admin.userId, role: entry.role })}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      title={t('common.cancel')}
                      disabled={isRevokingThis}
                      onPress={onCancelRevoke}
                    />
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </Card>
  );
}

function PlatformAdminsContent({ isOnline }: { readonly isOnline: boolean }) {
  const {
    viewState,
    admins,
    superAdminCount,
    errorMessage,
    isRetrying,
    retry,
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
  } = usePlatformAdmins({ isOnline });

  if (viewState === 'error') {
    return (
      <View className="flex-1 bg-background p-4">
        <ErrorState
          title={t('platform.title')}
          description={errorMessage ?? t('errors.generic')}
          onRetry={retry}
          isRetrying={isRetrying}
        />
      </View>
    );
  }

  if (viewState === 'loading') {
    return (
      <View className="flex-1 gap-3 bg-background p-4">
        <Card accessible role="status" aria-busy aria-label={t('common.loading')}>
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-24 w-full" />
        </Card>
      </View>
    );
  }

  const orphanRevokeError =
    revokeError &&
    !admins.some(
      (admin) =>
        admin.userId === revokeError.userId &&
        admin.roles.some((entry) => entry.role === revokeError.role),
    )
      ? revokeError
      : null;

  return (
    <FlatList
      data={[...admins]}
      keyExtractor={(item) => item.userId}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      className="flex-1 bg-background"
      contentContainerClassName="gap-3 p-4 pb-8"
      ListHeaderComponent={
        <PlatformAdminsHeader
          superAdminCount={superAdminCount}
          adminCount={admins.length}
          isOnline={isOnline}
          control={control}
          errors={errors}
          isGranting={isGranting}
          grantError={grantError}
          orphanRevokeError={orphanRevokeError}
          onGrantSubmit={() => void onGrantSubmit()}
        />
      }
      ListEmptyComponent={
        <EmptyState
          title={t('platform.adminsTitle', { count: 0 })}
          description={t('platform.emptyAdmins')}
        />
      }
      renderItem={({ item }) => (
        <PlatformAdminRow
          admin={item}
          isOnline={isOnline}
          confirmingTarget={confirmingTarget}
          revokingTarget={revokingTarget}
          revokeError={revokeError}
          getRevokeDisabledReason={getRevokeDisabledReason}
          onRequestRevoke={requestRevoke}
          onCancelRevoke={cancelRevoke}
          onConfirmRevoke={(target) => void confirmRevoke(target)}
        />
      )}
    />
  );
}

function LivePlatformAdminsView() {
  const isOnline = useOnlineStatus();
  return <PlatformAdminsContent isOnline={isOnline} />;
}

export function PlatformAdminsView({ isOnline }: PlatformAdminsViewProps) {
  return (
    <RequireSystemRole role="SUPER_ADMIN">
      {isOnline !== undefined ? <PlatformAdminsContent isOnline={isOnline} /> : <LivePlatformAdminsView />}
    </RequireSystemRole>
  );
}

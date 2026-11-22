import { t } from '@gomecoiffer/client-core';
import { ADJUSTABLE_PERMISSIONS, type AdjustablePermission } from '@gomecoiffer/contracts';
import { FlatList, ScrollView, View } from 'react-native';
import { ErrorState } from '@/components/feedback/error-state';
import { FieldHint } from '@/components/forms/field-hint';
import { RequirePermission } from '@/components/navigation/require-permission';
import { Badge } from '@/components/ui/badge';
import {
  BrandBackdrop,
  BrandTopBar,
  IconTile,
  PageHero,
  type BrandIconName,
  type BrandTone,
} from '@/components/ui/brand';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { InlineAlert } from '@/components/ui/inline-alert';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { SwitchRow } from '@/components/ui/switch-row';
import { useOnlineStatus } from '@/lib/platform/setupPlatformListeners';
import { useSalonRoles } from './use-salon-roles';

export type SalonRolesViewProps = {
  readonly isOnline?: boolean;
};

function getPermissionVisual(perm: AdjustablePermission): {
  readonly icon: BrandIconName;
  readonly tone: BrandTone;
} {
  if (perm.startsWith('dashboard:')) return { icon: 'grid', tone: 'navy' };
  if (perm.startsWith('bookings:')) return { icon: 'calendar', tone: 'terra' };
  if (perm.startsWith('availability:')) return { icon: 'clock', tone: 'violet' };
  if (perm.startsWith('services:')) return { icon: 'scissors', tone: 'terra' };
  if (perm.startsWith('staff:')) return { icon: 'users', tone: 'navy' };
  if (perm.startsWith('finances:')) return { icon: 'coins', tone: 'green' };
  if (perm.startsWith('salon-settings:')) return { icon: 'settings', tone: 'violet' };
  return { icon: 'shop', tone: 'terra' };
}

function LiveOnlineRoles() {
  const liveOnline = useOnlineStatus();
  return <SalonRolesGuarded isOnline={liveOnline} />;
}

function SalonRolesLoading() {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      className="flex-1"
      contentContainerClassName="mx-auto w-full max-w-2xl gap-4 px-5 pt-4 pb-12"
    >
      <BrandTopBar logoWidth={160} />
      <Card accessible role="status" aria-busy aria-label={t('common.loading')}>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </Card>
    </ScrollView>
  );
}

function SalonRolesContent({ isOnline }: { readonly isOnline: boolean }) {
  const state = useSalonRoles({ isOnline });

  if (state.status === 'loading') {
    return <SalonRolesLoading />;
  }

  if (state.status === 'error') {
    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        className="flex-1"
        contentContainerClassName="mx-auto w-full max-w-2xl gap-4 px-5 pt-4 pb-12"
      >
        <BrandTopBar logoWidth={160} />
        <ErrorState
          title={t('roles.title')}
          description={state.errorMessage}
          onRetry={state.retry}
          isRetrying={state.isRetrying}
        />
      </ScrollView>
    );
  }

  const {
    owner,
    roles,
    selectedRoleEntry,
    draftPermissions,
    autoChanged,
    savedNotice,
    conflictError,
    mutationError,
    isSaving,
    isResetting,
    isBusy,
    isRefreshingConflict,
    selectRole,
    togglePermission,
    save,
    resetToDefault,
    refreshAfterConflict,
  } = state;

  const autoChangedNames = autoChanged.map((perm) => t(`perm.${perm}`)).join(', ');

  return (
    <FlatList<AdjustablePermission>
      data={[...ADJUSTABLE_PERMISSIONS]}
      extraData={{ draftPermissions, isBusy }}
      keyExtractor={(perm) => perm}
      initialNumToRender={ADJUSTABLE_PERMISSIONS.length}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="mx-auto w-full max-w-2xl gap-3 px-5 pt-4 pb-12"
      ListHeaderComponent={
        <View className="gap-4 pb-1">
          <BrandTopBar logoWidth={160} />

          <PageHero
            icon="shield"
            tone="terra"
            title={t('roles.title')}
            subtitle={t('roles.subtitle')}
          />

          <Card>
            <View className="flex-row items-center gap-3">
              <IconTile name="crown" tone="navy" size={40} />
              <View className="flex-1 flex-row flex-wrap items-center justify-between gap-2">
                <CardTitle>{t('team.role.OWNER')}</CardTitle>
                <Badge variant="outline" label={t('perm.roles:administer')} />
              </View>
            </View>
            <CardDescription>{t('roles.ownerNote', { count: owner.members })}</CardDescription>
            <FieldHint message={t('team.members.ownerProtectedHint')} />
          </Card>

          <Card className="gap-2.5 p-4">
            <SegmentedTabs
              accessibilityLabel={t('roles.title')}
              value={selectedRoleEntry.role}
              onChange={selectRole}
              items={roles.map((entry) => ({
                value: entry.role,
                label: t(`team.role.${entry.role}`),
              }))}
            />
            <View className="flex-row flex-wrap items-center justify-between gap-2 pt-0.5">
              <View className="flex-1">
                <FieldHint message={t(`team.roleDesc.${selectedRoleEntry.role}`)} />
              </View>
              <Badge
                variant="secondary"
                label={t('team.members.title', { count: selectedRoleEntry.members })}
              />
            </View>
          </Card>

          {autoChanged.length > 0 ? (
            <InlineAlert
              variant="info"
              title={autoChangedNames}
              message={t('roles.dependencyHint')}
            />
          ) : null}

          {conflictError ? (
            <InlineAlert
              variant="error"
              message={conflictError}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  title={t('common.retry')}
                  loading={isRefreshingConflict}
                  onPress={refreshAfterConflict}
                  className="self-start"
                />
              }
            />
          ) : null}

          {mutationError ? <InlineAlert variant="error" message={mutationError} /> : null}
          {savedNotice ? <InlineAlert variant="success" message={t('roles.savedHint')} /> : null}
          {!isOnline ? <InlineAlert variant="warning" message={t('common.offlineActionHint')} /> : null}
        </View>
      }
      renderItem={({ item: perm }) => {
        const visual = getPermissionVisual(perm);
        return (
          <SwitchRow
            label={t(`perm.${perm}`)}
            icon={visual.icon}
            iconTone={visual.tone}
            value={draftPermissions.includes(perm)}
            disabled={isBusy}
            onValueChange={(enabled) => togglePermission(perm, enabled)}
          />
        );
      }}
      ListFooterComponent={
        <View className="gap-3 pt-2">
          <Button
            icon="shield"
            title={t('roles.saveAction')}
            loading={isSaving}
            disabled={!isOnline || isBusy}
            onPress={save}
          />
          <Button
            variant="outline"
            title={t('roles.resetDefault')}
            loading={isResetting}
            disabled={!isOnline || isBusy}
            onPress={resetToDefault}
          />
        </View>
      }
    />
  );
}

function SalonRolesGuarded({ isOnline }: { readonly isOnline: boolean }) {
  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background">
      <BrandBackdrop />
      <RequirePermission permission="roles:administer">
        <SalonRolesContent isOnline={isOnline} />
      </RequirePermission>
    </SafeAreaView>
  );
}

export function SalonRolesView({ isOnline }: SalonRolesViewProps) {
  if (isOnline === undefined) {
    return <LiveOnlineRoles />;
  }
  return <SalonRolesGuarded isOnline={isOnline} />;
}

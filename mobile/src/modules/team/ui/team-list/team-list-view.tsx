import { formatDateFr, t } from '@gomecoiffer/client-core';
import type { InvitableSalonRole, SalonTeamMember } from '@gomecoiffer/contracts';
import { FlatList, View } from 'react-native';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { FieldHint } from '@/components/forms/field-hint';
import { Badge } from '@/components/ui/badge';
import { AvatarInitials } from '@/components/ui/brand';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { InlineAlert } from '@/components/ui/inline-alert';
import { SelectField } from '@/components/ui/select-field';
import { Skeleton } from '@/components/ui/skeleton';
import { ThemedText } from '@/components/ui/themed-text';
import { useOnlineStatus } from '@/lib/platform/setupPlatformListeners';
import { TEAM_ROLE_OPTIONS, useTeamList, type MemberActionError } from './use-team-list';

export type TeamListViewProps = {
  readonly isOnline?: boolean;
};

function TeamMemberRow({
  member,
  canManageStaff,
  isOnline,
  isBusy,
  isConfirmingRemoval,
  isRemoving,
  rowError,
  onChangeRole,
  onRequestRemove,
  onCancelRemove,
  onConfirmRemove,
}: {
  readonly member: SalonTeamMember;
  readonly canManageStaff: boolean;
  readonly isOnline: boolean;
  readonly isBusy: boolean;
  readonly isConfirmingRemoval: boolean;
  readonly isRemoving: boolean;
  readonly rowError: string | null;
  readonly onChangeRole: (member: SalonTeamMember, role: InvitableSalonRole) => void;
  readonly onRequestRemove: (membershipId: string) => void;
  readonly onCancelRemove: () => void;
  readonly onConfirmRemove: (member: SalonTeamMember) => void;
}) {
  const isManageable = member.role !== 'OWNER' && !member.isCurrentUser && canManageStaff;
  const avatarTone =
    member.role === 'OWNER'
      ? 'terra'
      : member.role === 'SALON_ADMIN'
        ? 'navy'
        : member.role === 'PRACTITIONER'
          ? 'violet'
          : 'green';

  return (
    <Card className="p-4">
      <View className="flex-row items-center gap-3">
        <AvatarInitials name={member.name} tone={avatarTone} size={42} />
        <View className="flex-1 gap-0.5">
          <ThemedText variant="headline" className="text-sm font-bold">
            {member.name}
          </ThemedText>
          <ThemedText variant="muted" className="text-xs">
            {formatDateFr(member.joinedAt)}
          </ThemedText>
        </View>

        <View className="flex-row flex-wrap items-center gap-1.5">
          <Badge
            variant={member.role === 'OWNER' ? 'default' : 'outline'}
            label={t(`team.role.${member.role}`)}
          />
          {member.isCurrentUser ? (
            <Badge variant="secondary" label={t('team.members.currentUserBadge')} />
          ) : null}
        </View>
      </View>

      {member.role === 'OWNER' ? <FieldHint message={t('team.members.ownerProtectedHint')} /> : null}

      {rowError ? <InlineAlert variant="error" message={rowError} /> : null}

      {isManageable && member.role !== 'OWNER' ? (
        <View className="gap-3 pt-1">
          <SelectField
            label={t('team.members.changeRole')}
            leadingIcon="users"
            value={member.role}
            options={TEAM_ROLE_OPTIONS}
            hint={t(`team.roleDesc.${member.role}`)}
            disabled={!isOnline || isBusy}
            onChange={(nextRole) => onChangeRole(member, nextRole)}
          />

          {isConfirmingRemoval ? (
            <View
              className="gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5"
              style={{ borderCurve: 'continuous' }}
            >
              <ThemedText variant="headline" className="text-xs font-bold text-destructive">
                {t('team.members.removeConfirmTitle')}
              </ThemedText>
              <FieldHint message={t('team.members.removeConfirmHint', { name: member.name })} />
              <View className="flex-row flex-wrap gap-2 pt-1">
                <Button
                  variant="accent"
                  size="sm"
                  title={t('team.members.confirmRemove')}
                  loading={isRemoving}
                  disabled={!isOnline || isBusy}
                  onPress={() => onConfirmRemove(member)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  title={t('team.members.cancelAction')}
                  disabled={isRemoving}
                  onPress={onCancelRemove}
                />
              </View>
            </View>
          ) : (
            <Button
              variant="outline"
              size="sm"
              title={t('team.members.removeAction')}
              disabled={!isOnline || isBusy}
              onPress={() => onRequestRemove(member.membershipId)}
              className="self-start"
            />
          )}
        </View>
      ) : null}
    </Card>
  );
}

function TeamListHeader({
  count,
  showOfflineHint,
  orphanError,
}: {
  readonly count: number;
  readonly showOfflineHint: boolean;
  readonly orphanError: MemberActionError | null;
}) {
  return (
    <View className="gap-2">
      {showOfflineHint ? <InlineAlert variant="warning" message={t('common.offlineActionHint')} /> : null}
      {orphanError ? <InlineAlert variant="error" message={orphanError.message} /> : null}
      <ThemedText variant="muted" className="text-xs font-bold">
        {t('team.members.title', { count })}
      </ThemedText>
    </View>
  );
}

function TeamListContent({ isOnline }: { readonly isOnline: boolean }) {
  const {
    viewState,
    members,
    errorMessage,
    isRetrying,
    retry,
    canManageStaff,
    pendingMembershipId,
    removingMembershipId,
    confirmingRemovalId,
    actionError,
    changeRole,
    requestRemove,
    cancelRemove,
    confirmRemove,
  } = useTeamList({ isOnline });

  if (viewState === 'error') {
    return (
      <View className="flex-1 px-5 py-2">
        <ErrorState
          title={t('team.section.title')}
          description={errorMessage ?? t('errors.generic')}
          onRetry={retry}
          isRetrying={isRetrying}
        />
      </View>
    );
  }

  if (viewState === 'loading') {
    return (
      <View className="flex-1 gap-3 px-5 py-2">
        <Card accessible role="status" aria-busy aria-label={t('common.loading')}>
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-full" />
        </Card>
      </View>
    );
  }

  const orphanError =
    actionError && !members.some((member) => member.membershipId === actionError.membershipId)
      ? actionError
      : null;

  return (
    <FlatList
      data={[...members]}
      keyExtractor={(item) => item.membershipId}
      contentInsetAdjustmentBehavior="automatic"
      className="flex-1"
      contentContainerClassName="gap-3 px-5 pt-2 pb-10"
      ListHeaderComponent={
        <TeamListHeader
          count={members.length}
          showOfflineHint={!isOnline && canManageStaff}
          orphanError={orphanError}
        />
      }
      ListEmptyComponent={
        <EmptyState
          icon="users"
          title={t('team.members.title', { count: 0 })}
          description={t('team.members.empty')}
        />
      }
      renderItem={({ item }) => (
        <TeamMemberRow
          member={item}
          canManageStaff={canManageStaff}
          isOnline={isOnline}
          isBusy={pendingMembershipId !== null}
          isConfirmingRemoval={confirmingRemovalId === item.membershipId}
          isRemoving={removingMembershipId === item.membershipId}
          rowError={actionError?.membershipId === item.membershipId ? actionError.message : null}
          onChangeRole={(member, nextRole) => void changeRole(member, nextRole)}
          onRequestRemove={requestRemove}
          onCancelRemove={cancelRemove}
          onConfirmRemove={(member) => void confirmRemove(member)}
        />
      )}
    />
  );
}

function LiveTeamListView() {
  const isOnline = useOnlineStatus();
  return <TeamListContent isOnline={isOnline} />;
}

export function TeamListView({ isOnline }: TeamListViewProps) {
  if (isOnline !== undefined) {
    return <TeamListContent isOnline={isOnline} />;
  }
  return <LiveTeamListView />;
}

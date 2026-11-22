import { formatDateFr, t } from '@gomecoiffer/client-core';
import type { InvitableSalonRole, SalonTeamMember } from '@gomecoiffer/contracts';
import { useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { TeamPanel } from '../team-panel';
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

function memberTone(member: SalonTeamMember) {
  return member.role === 'OWNER'
    ? 'terra'
    : member.role === 'SALON_ADMIN'
      ? 'navy'
      : member.role === 'PRACTITIONER'
        ? 'violet'
        : 'green';
}

function normalizeName(value: string) {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

type DirectoryRole = SalonTeamMember['role'] | 'ALL';

function TeamMemberDetail({
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

  return (
    <Card className="p-4">
      <View className="flex-row items-center gap-3">
        <AvatarInitials name={member.name} tone={memberTone(member)} size={42} />
        <View className="flex-1 gap-0.5">
          <ThemedText variant="headline" className="text-lg font-bold">
            {member.name}
          </ThemedText>
          <ThemedText variant="muted" className="text-xs">
            {t('team.directory.joined', { date: formatDateFr(member.joinedAt) })}
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

  const [query, setQuery] = useState('');
  const [role, setRole] = useState<DirectoryRole>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const current = members.find((member) => member.membershipId === selectedId);
  const search = normalizeName(query);
  const results = members.filter(
    (member) => (role === 'ALL' || role === member.role) && normalizeName(member.name).includes(search),
  );
  const roles = [
    { value: 'ALL' as const, label: t('team.directory.allRoles') },
    ...Array.from(new Set(members.map((member) => member.role))).map((value) => ({
      value,
      label: t(`team.role.${value}`),
    })),
  ];
  const closeDetail = () => {
    cancelRemove();
    setSelectedId(null);
  };

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
    <>
      <FlatList
        keyboardShouldPersistTaps="handled"
        data={results}
        keyExtractor={(item) => item.membershipId}
        contentInsetAdjustmentBehavior="automatic"
        className="flex-1"
        contentContainerClassName="gap-3 px-5 pt-2 pb-10"
        ListHeaderComponent={
          <View className="gap-3">
            <TextInput
              accessibilityLabel={t('team.directory.search')}
              placeholder={t('team.directory.search')}
              autoCorrect={false}
              returnKeyType="search"
              value={query}
              onChangeText={setQuery}
              className="min-h-12 rounded-2xl border border-border bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground"
            />
            <SelectField<DirectoryRole>
              label={t('team.directory.filter')}
              value={role}
              onChange={setRole}
              options={roles}
            />
            <TeamListHeader
              count={results.length}
              showOfflineHint={!isOnline && canManageStaff}
              orphanError={orphanError}
            />
          </View>
        }
        ListEmptyComponent={
          <View className="gap-2">
            <EmptyState
              icon="users"
              title={members.length ? t('team.directory.noMatch') : t('team.members.title', { count: 0 })}
              description={members.length ? t('team.directory.noMatchHint') : t('team.members.empty')}
            />
            {members.length > 0 && (
              <Button
                title={t('team.directory.clear')}
                variant="outline"
                onPress={() => {
                  setQuery('');
                  setRole('ALL');
                }}
              />
            )}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, ${t(`team.role.${item.role}`)}`}
            onPress={() => setSelectedId(item.membershipId)}
          >
            <Card className="min-h-[72px] flex-row items-center gap-3 bg-card px-4 py-3">
              <AvatarInitials name={item.name} tone={memberTone(item)} size={44} />
              <View className="flex-1">
                <ThemedText variant="headline" className="text-lg font-bold">
                  {item.name}
                </ThemedText>
                <ThemedText variant="muted">{t(`team.role.${item.role}`)}</ThemedText>
              </View>
              {item.isCurrentUser && <Badge variant="secondary" label={t('team.members.currentUserBadge')} />}
              <ThemedText accessible={false} className="text-xl text-muted-foreground">
                ›
              </ThemedText>
            </Card>
          </Pressable>
        )}
      />
      {current && (
        <TeamPanel onClose={closeDetail}>
          <TeamMemberDetail
            member={current}
            canManageStaff={canManageStaff}
            isOnline={isOnline}
            isBusy={pendingMembershipId !== null}
            isConfirmingRemoval={confirmingRemovalId === current.membershipId}
            isRemoving={removingMembershipId === current.membershipId}
            rowError={actionError?.membershipId === current.membershipId ? actionError.message : null}
            onChangeRole={(member, nextRole) => void changeRole(member, nextRole)}
            onRequestRemove={requestRemove}
            onCancelRemove={cancelRemove}
            onConfirmRemove={(member) => void confirmRemove(member)}
          />
        </TeamPanel>
      )}
    </>
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

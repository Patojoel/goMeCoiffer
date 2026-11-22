import { formatDateFr, t } from '@gomecoiffer/client-core';
import type { SalonInvitation } from '@gomecoiffer/contracts';
import { FlatList, View } from 'react-native';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { Badge } from '@/components/ui/badge';
import { AvatarInitials } from '@/components/ui/brand';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { InlineAlert } from '@/components/ui/inline-alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ThemedText } from '@/components/ui/themed-text';
import { useOnlineStatus } from '@/lib/platform/setupPlatformListeners';
import { useInvitationsList } from './use-invitations-list';

export type InvitationsListViewProps = {
  readonly isOnline?: boolean;
};

function InvitationRow({
  invitation,
  canInvite,
  isOnline,
  isCancelling,
  isBusy,
  onCancel,
}: {
  readonly invitation: SalonInvitation;
  readonly canInvite: boolean;
  readonly isOnline: boolean;
  readonly isCancelling: boolean;
  readonly isBusy: boolean;
  readonly onCancel: (invitationId: string) => void;
}) {
  const canCancel = invitation.status === 'PENDING' && canInvite;
  const phone = invitation.phone ?? '';

  return (
    <Card className="p-4">
      <View className="flex-row items-center gap-3">
        <AvatarInitials
          name={invitation.name ?? 'GM'}
          tone={invitation.status === 'PENDING' ? 'terra' : 'navy'}
          size={40}
        />
        <View className="flex-1 gap-0.5">
          <ThemedText variant="headline" className="text-sm font-bold">
            {invitation.name ?? '—'}
          </ThemedText>
          {phone.length > 0 ? (
            <ThemedText selectable variant="muted" className="text-xs">
              {phone}
            </ThemedText>
          ) : null}
          <ThemedText variant="caption">{formatDateFr(invitation.expiresAt)}</ThemedText>
        </View>

        <View className="flex-row flex-wrap items-center gap-1.5">
          <Badge variant="outline" label={t(`team.role.${invitation.role}`)} />
          <Badge
            variant={invitation.status === 'PENDING' ? 'accent' : 'secondary'}
            label={t(`team.invitations.status.${invitation.status}`)}
          />
        </View>
      </View>

      {canCancel ? (
        <Button
          variant="outline"
          size="sm"
          title={t('team.invitations.cancelAction')}
          loading={isCancelling}
          disabled={!isOnline || isBusy}
          onPress={() => onCancel(invitation.id)}
          className="self-start"
        />
      ) : null}
    </Card>
  );
}

function InvitationsListHeader({
  count,
  isLimitReached,
  showOfflineHint,
  cancelError,
}: {
  readonly count: number;
  readonly isLimitReached: boolean;
  readonly showOfflineHint: boolean;
  readonly cancelError: string | null;
}) {
  return (
    <View className="gap-2">
      {showOfflineHint ? <InlineAlert variant="warning" message={t('common.offlineActionHint')} /> : null}
      {isLimitReached ? <InlineAlert variant="warning" message={t('team.invitations.limitHint')} /> : null}
      {cancelError ? <InlineAlert variant="error" message={cancelError} /> : null}
      <ThemedText variant="muted" className="text-xs font-bold">
        {t('team.invitations.title', { count })}
      </ThemedText>
    </View>
  );
}

function InvitationsListContent({ isOnline }: { readonly isOnline: boolean }) {
  const {
    viewState,
    invitations,
    isLimitReached,
    errorMessage,
    isRetrying,
    retry,
    canInvite,
    cancellingId,
    cancelError,
    cancelInvitation,
  } = useInvitationsList({ isOnline });

  if (viewState === 'error') {
    return (
      <View className="flex-1 px-5 py-2">
        <ErrorState
          title={t('team.tabs.invitations')}
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

  return (
    <FlatList
      data={[...invitations]}
      keyExtractor={(item) => item.id}
      contentInsetAdjustmentBehavior="automatic"
      className="flex-1"
      contentContainerClassName="gap-3 px-5 pt-2 pb-10"
      ListHeaderComponent={
        <InvitationsListHeader
          count={invitations.length}
          isLimitReached={isLimitReached}
          showOfflineHint={!isOnline && canInvite}
          cancelError={cancelError}
        />
      }
      ListEmptyComponent={
        <EmptyState
          icon="userplus"
          title={t('team.invitations.title', { count: 0 })}
          description={t('team.invitations.empty')}
        />
      }
      renderItem={({ item }) => (
        <InvitationRow
          invitation={item}
          canInvite={canInvite}
          isOnline={isOnline}
          isCancelling={cancellingId === item.id}
          isBusy={cancellingId !== null}
          onCancel={(invitationId) => void cancelInvitation(invitationId)}
        />
      )}
    />
  );
}

function LiveInvitationsListView() {
  const isOnline = useOnlineStatus();
  return <InvitationsListContent isOnline={isOnline} />;
}

export function InvitationsListView({ isOnline }: InvitationsListViewProps) {
  if (isOnline !== undefined) {
    return <InvitationsListContent isOnline={isOnline} />;
  }
  return <LiveInvitationsListView />;
}

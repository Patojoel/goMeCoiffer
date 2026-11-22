import { can, selectSession, t } from '@gomecoiffer/client-core';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { RequirePermission } from '@/components/navigation/require-permission';
import { Button } from '@/components/ui/button';
import { SegmentedTabs, type SegmentedTabItem } from '@/components/ui/segmented-tabs';
import { ThemedText } from '@/components/ui/themed-text';
import { useOnlineStatus } from '@/lib/platform/setupPlatformListeners';
import { useAppSelector } from '@/lib/store/hooks';
import { InviteCollaboratorView } from './invite/invite-collaborator-view';
import { InvitationsListView } from './invitations/invitations-list-view';
import { TeamListView } from './team-list/team-list-view';

export type TeamWorkspaceTab = 'members' | 'invitations';

export type SalonTeamWorkspaceProps = {
  readonly isOnline?: boolean;
  readonly onOpenExternalUrl?: (url: string) => Promise<void> | void;
};

const TAB_ITEMS: ReadonlyArray<SegmentedTabItem<TeamWorkspaceTab>> = [
  { value: 'members', label: t('team.tabs.members') },
  { value: 'invitations', label: t('team.tabs.invitations') },
];

function SalonTeamWorkspaceContent({
  isOnline,
  onOpenExternalUrl,
}: {
  readonly isOnline: boolean;
  readonly onOpenExternalUrl?: (url: string) => Promise<void> | void;
}) {
  const session = useAppSelector(selectSession);
  const [activeTab, setActiveTab] = useState<TeamWorkspaceTab>('members');
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const canInvite = can(session, 'staff:invite');
  const effectiveTab: TeamWorkspaceTab = canInvite ? activeTab : 'members';

  useEffect(() => {
    if (!canInvite && activeTab === 'invitations') {
      setActiveTab('members');
    }
    if (!canInvite && isInviteOpen) {
      setIsInviteOpen(false);
    }
  }, [canInvite, activeTab, isInviteOpen]);

  return (
    <View className="flex-1 bg-background">
      <View className="gap-3 px-4 pt-4 pb-2">
        <View className="gap-1">
          <ThemedText variant="title">{t('team.section.title')}</ThemedText>
          <ThemedText variant="muted">{t('team.section.subtitle')}</ThemedText>
        </View>

        {canInvite ? (
          <>
            <SegmentedTabs
              value={effectiveTab}
              items={TAB_ITEMS}
              onChange={setActiveTab}
              accessibilityLabel={t('team.section.title')}
            />
            <Button
              variant={isInviteOpen ? 'outline' : 'accent'}
              title={t('team.invite.openAction')}
              accessibilityState={{ expanded: isInviteOpen }}
              onPress={() => setIsInviteOpen((open) => !open)}
              className="self-start"
            />
          </>
        ) : null}
      </View>

      {canInvite && isInviteOpen ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          className="shrink-0 px-4 pb-2"
          style={{ maxHeight: '55%' }}
        >
          <InviteCollaboratorView isOnline={isOnline} onOpenExternalUrl={onOpenExternalUrl} />
        </ScrollView>
      ) : null}

      <View className="flex-1">
        {effectiveTab === 'members' ? (
          <TeamListView isOnline={isOnline} />
        ) : (
          <InvitationsListView isOnline={isOnline} />
        )}
      </View>
    </View>
  );
}

function LiveSalonTeamWorkspace({
  onOpenExternalUrl,
}: {
  readonly onOpenExternalUrl?: (url: string) => Promise<void> | void;
}) {
  const isOnline = useOnlineStatus();
  return <SalonTeamWorkspaceContent isOnline={isOnline} onOpenExternalUrl={onOpenExternalUrl} />;
}

export function SalonTeamWorkspace({ isOnline, onOpenExternalUrl }: SalonTeamWorkspaceProps) {
  return (
    <RequirePermission permission="staff:view">
      {isOnline !== undefined ? (
        <SalonTeamWorkspaceContent isOnline={isOnline} onOpenExternalUrl={onOpenExternalUrl} />
      ) : (
        <LiveSalonTeamWorkspace onOpenExternalUrl={onOpenExternalUrl} />
      )}
    </RequirePermission>
  );
}

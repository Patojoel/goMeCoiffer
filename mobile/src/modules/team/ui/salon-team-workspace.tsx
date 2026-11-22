import {
  can,
  selectActiveSalon,
  selectSession,
  t,
  useListSalonInvitationsQuery,
} from '@gomecoiffer/client-core';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { RequirePermission } from '@/components/navigation/require-permission';
import { BrandBackdrop, BrandTopBar, PageHero } from '@/components/ui/brand';
import { Button } from '@/components/ui/button';
import { SegmentedTabs, type SegmentedTabItem } from '@/components/ui/segmented-tabs';
import { useOnlineStatus } from '@/lib/platform/setupPlatformListeners';
import { useAppSelector } from '@/lib/store/hooks';
import { InviteCollaboratorView } from './invite/invite-collaborator-view';
import { InvitationsListView } from './invitations/invitations-list-view';
import { TeamPanel } from './team-panel';
import { TeamListView } from './team-list/team-list-view';

export type TeamWorkspaceTab = 'members' | 'invitations';

export type SalonTeamWorkspaceProps = {
  readonly isOnline?: boolean;
  readonly onOpenExternalUrl?: (url: string) => Promise<void> | void;
};

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
  const activeSalon = useAppSelector(selectActiveSalon);
  const { currentData: invitations } = useListSalonInvitationsQuery(undefined, { skip: !canInvite });
  const pending = invitations?.filter((invite) => invite.status === 'PENDING').length;
  const tabs: ReadonlyArray<SegmentedTabItem<TeamWorkspaceTab>> = [
    { value: 'members', label: t('team.tabs.members') },
    {
      value: 'invitations',
      label: pending ? `${t('team.tabs.invitations')} (${pending})` : t('team.tabs.invitations'),
    },
  ];
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
      <BrandBackdrop />
      <View className="mx-auto w-full max-w-2xl flex-1">
        <View className="gap-3 px-5 pt-4 pb-2">
          {Platform.OS !== 'web' ? <BrandTopBar logoWidth={154} /> : null}

          <PageHero
            icon="users"
            tone="terra"
            title={t('nav.salon.team')}
            eyebrow={activeSalon?.name}
            right={
              canInvite ? (
                <Button
                  variant="accent"
                  size="sm"
                  icon="userplus"
                  title={t('team.directory.invite')}
                  accessibilityLabel={t('team.invite.openAction')}
                  accessibilityState={{ expanded: isInviteOpen }}
                  onPress={() => setIsInviteOpen(true)}
                />
              ) : null
            }
          />

          {canInvite ? (
            <SegmentedTabs
              value={effectiveTab}
              items={tabs}
              onChange={setActiveTab}
              accessibilityLabel={t('team.section.title')}
            />
          ) : null}
        </View>

        {canInvite && isInviteOpen ? (
          <TeamPanel
            backLabel={effectiveTab === 'invitations' ? t('team.invitations.back') : t('team.directory.back')}
            onClose={() => setIsInviteOpen(false)}
          >
            <InviteCollaboratorView isOnline={isOnline} onOpenExternalUrl={onOpenExternalUrl} />
          </TeamPanel>
        ) : null}

        <View className="flex-1">
          {effectiveTab === 'members' ? (
            <TeamListView isOnline={isOnline} />
          ) : (
            <InvitationsListView isOnline={isOnline} />
          )}
        </View>
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

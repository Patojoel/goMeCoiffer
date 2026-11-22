import { selectActiveSalonId, t } from '@gomecoiffer/client-core';
import { ScrollView } from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { WebTabNav } from '@/components/navigation/web-tab-nav';
import { useAppSelector } from '@/lib/store/hooks';
import { RequireActiveSalonNotice } from '@/modules/salons/ui/require-active-salon';

export default function SalonTabsWebLayout() {
  const activeSalonId = useAppSelector(selectActiveSalonId);

  if (activeSalonId === null) {
    return (
      <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background">
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          className="flex-1"
          contentContainerClassName="gap-4 p-4"
        >
          <RequireActiveSalonNotice />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <WebTabNav
      spaceLabel={t('app.name')}
      items={[
        { label: t('nav.salon.today'), href: '/(salon)/(tabs)', matchPath: '/' },
        {
          label: t('nav.salon.appointments'),
          href: '/(salon)/(tabs)/rendez-vous',
          matchPath: '/rendez-vous',
        },
        { label: t('nav.salon.team'), href: '/(salon)/(tabs)/equipe', matchPath: '/equipe' },
        { label: t('nav.salon.more'), href: '/(salon)/(tabs)/plus', matchPath: '/plus' },
      ]}
    />
  );
}

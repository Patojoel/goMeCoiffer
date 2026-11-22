import { selectActiveSalonId, t } from '@gomecoiffer/client-core';
import { NativeTabs } from 'expo-router/native-tabs';
import { ScrollView } from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { useAppSelector } from '@/lib/store/hooks';
import { RequireActiveSalonNotice } from '@/modules/salons/ui/require-active-salon';

export default function SalonTabsLayout() {
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
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="sun.max.fill" md="today" />
        <NativeTabs.Trigger.Label>{t('nav.salon.today')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="rendez-vous">
        <NativeTabs.Trigger.Icon sf="calendar" md="event_note" />
        <NativeTabs.Trigger.Label>{t('nav.salon.appointments')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="equipe">
        <NativeTabs.Trigger.Icon sf="person.2.fill" md="group" />
        <NativeTabs.Trigger.Label>{t('nav.salon.team')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="plus">
        <NativeTabs.Trigger.Icon sf="ellipsis.circle.fill" md="more_horiz" />
        <NativeTabs.Trigger.Label>{t('nav.salon.more')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

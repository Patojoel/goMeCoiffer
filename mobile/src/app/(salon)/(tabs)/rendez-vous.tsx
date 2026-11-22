import { t } from '@gomecoiffer/client-core';
import { ScrollView } from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { EmptyState } from '@/components/feedback/empty-state';

export default function SalonAppointmentsScreen() {
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        className="flex-1"
        contentContainerClassName="gap-4 p-4"
      >
        <EmptyState title={t('salon.appointments.title')} description={t('salon.appointments.emptyHint')} />
      </ScrollView>
    </SafeAreaView>
  );
}

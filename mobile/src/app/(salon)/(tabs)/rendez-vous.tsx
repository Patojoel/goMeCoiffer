import { t } from '@gomecoiffer/client-core';
import { ScrollView } from 'react-native';
import { EmptyState } from '@/components/feedback/empty-state';
import { BrandBackdrop, BrandTopBar } from '@/components/ui/brand';
import { SafeAreaView } from '@/components/ui/safe-area-view';

export default function SalonAppointmentsScreen() {
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <BrandBackdrop />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        className="flex-1"
        contentContainerClassName="mx-auto w-full max-w-2xl gap-4 px-5 pt-4 pb-12"
      >
        <BrandTopBar logoWidth={154} />
        <EmptyState
          icon="calendar"
          tone="terra"
          title={t('salon.appointments.title')}
          description={t('salon.appointments.emptyHint')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

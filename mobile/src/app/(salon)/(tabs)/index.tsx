import { t } from '@gomecoiffer/client-core';
import { Link } from 'expo-router';
import { ScrollView } from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { EmptyState } from '@/components/feedback/empty-state';
import { Button } from '@/components/ui/button';
import { ActiveSalonCard } from '@/modules/salons/ui/active-salon-card';

export default function SalonTodayScreen() {
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        className="flex-1"
        contentContainerClassName="gap-4 p-4"
      >
        <ActiveSalonCard
          action={
            <Link href="/(salon)/choisir-salon" asChild>
              <Button variant="outline" title={t('salons.more.switchSalon')} />
            </Link>
          }
        />
        <EmptyState title={t('salon.today.title')} description={t('salon.today.emptyHint')} />
      </ScrollView>
    </SafeAreaView>
  );
}

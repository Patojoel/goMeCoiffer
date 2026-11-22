import { t } from '@gomecoiffer/client-core';
import { Link } from 'expo-router';
import { ScrollView } from 'react-native';
import { EmptyState } from '@/components/feedback/empty-state';
import { Button } from '@/components/ui/button';

export default function NotFoundScreen() {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      className="flex-1 bg-background"
      contentContainerClassName="gap-4 p-4"
    >
      <EmptyState
        title={t('nav.notFound.title')}
        description={t('nav.notFound.hint')}
        action={
          <Link href="/(client)/(tabs)" asChild>
            <Button title={t('common.backHome')} className="self-start" />
          </Link>
        }
      />
    </ScrollView>
  );
}

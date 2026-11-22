import { t } from '@gomecoiffer/client-core';
import { Link, useLocalSearchParams } from 'expo-router';
import { ScrollView } from 'react-native';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { ThemedText } from '@/components/ui/themed-text';

export default function SalonDetailsScreen() {
  const { salonId } = useLocalSearchParams<{ salonId: string }>();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      className="flex-1 bg-background"
      contentContainerClassName="gap-4 p-4"
    >
      <Card>
        <CardTitle>{t('marketplace.title')}</CardTitle>
        <CardDescription>{t('marketplace.intro')}</CardDescription>
        {salonId ? (
          <ThemedText variant="caption" selectable>
            {salonId}
          </ThemedText>
        ) : null}
        <Link href="/(client)/(tabs)" asChild>
          <Button variant="outline" title={t('common.backHome')} className="self-start" />
        </Link>
      </Card>
    </ScrollView>
  );
}

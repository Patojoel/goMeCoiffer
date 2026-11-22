import { t } from '@gomecoiffer/client-core';
import { Link } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { ThemedText } from '@/components/ui/themed-text';
import { HealthStatusCard } from '@/modules/health/ui/health-status-card';

export default function MarketplaceExploreScreen() {
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        className="flex-1"
        contentContainerClassName="gap-4 p-4"
      >
        <View className="gap-1">
          <ThemedText variant="title">{t('marketplace.title')}</ThemedText>
          <ThemedText variant="muted">{t('marketplace.intro')}</ThemedText>
        </View>

        <HealthStatusCard />

        <Card>
          <CardTitle>{t('common.signIn')}</CardTitle>
          <CardDescription>{t('auth.signIn.hint')}</CardDescription>
          <View className="gap-3">
            <Link href="/connexion" asChild>
              <Button variant="default" title={t('common.signIn')} />
            </Link>
            <Link href="/(salon)/(tabs)" asChild>
              <Button variant="outline" title={t('marketplace.openSalonSpace')} />
            </Link>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

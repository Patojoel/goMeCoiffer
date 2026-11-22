import { t } from '@gomecoiffer/client-core';
import { Link } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { Badge } from '@/components/ui/badge';
import { BrandBackdrop, BrandTopBar, IconTile } from '@/components/ui/brand';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { ThemedText } from '@/components/ui/themed-text';
import { HealthStatusCard } from '@/modules/health/ui/health-status-card';

const EXPLORE_PILLARS = [
  { icon: 'calendar', tone: 'navy', title: 'Disponibilités', subtitle: 'Créneaux en direct' },
  { icon: 'scissors', tone: 'terra', title: 'Prestations', subtitle: 'Coiffure, barber & soins' },
  { icon: 'coins', tone: 'green', title: 'Paiement', subtitle: 'Sur place ou mobile' },
] as const;

export default function MarketplaceExploreScreen() {
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <BrandBackdrop />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        className="flex-1"
        contentContainerClassName="mx-auto w-full max-w-2xl gap-4 px-5 pt-4 pb-12"
      >
        <BrandTopBar
          logoWidth={168}
          right={<Badge variant="accent" label={t('nav.client.explore')} />}
        />

        <Card>
          <View className="flex-row items-center gap-3.5">
            <IconTile name="sparkle" tone="terra" size={48} />
            <View className="flex-1 gap-1">
              <ThemedText variant="title" className="text-2xl font-extrabold">
                {t('marketplace.title')}
              </ThemedText>
              <ThemedText variant="muted" className="text-xs leading-5">
                {t('marketplace.intro')}
              </ThemedText>
            </View>
          </View>

          <View className="gap-2.5 pt-1 sm:flex-row">
            {EXPLORE_PILLARS.map((pillar) => (
              <View
                key={pillar.title}
                className="gap-1.5 rounded-2xl sm:flex-1 border border-white/95 bg-secondary/50 p-3"
              >
                <IconTile name={pillar.icon} tone={pillar.tone} size={32} />
                <ThemedText className="text-xs font-bold">{pillar.title}</ThemedText>
                <ThemedText variant="caption" className="text-xs leading-5">
                  {pillar.subtitle}
                </ThemedText>
              </View>
            ))}
          </View>
        </Card>

        <HealthStatusCard />

        <Card>
          <View className="flex-row items-center gap-3">
            <IconTile name="shop" tone="navy" size={42} />
            <View className="flex-1 gap-0.5">
              <CardTitle>{t('common.signIn')}</CardTitle>
              <CardDescription>{t('auth.signIn.hint')}</CardDescription>
            </View>
          </View>
          <View className="gap-2.5">
            <Link href="/connexion" asChild>
              <Button variant="default" icon="lock" title={t('common.signIn')} />
            </Link>
            <Link href="/(salon)/(tabs)" asChild>
              <Button variant="outline" icon="shop" title={t('marketplace.openSalonSpace')} />
            </Link>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

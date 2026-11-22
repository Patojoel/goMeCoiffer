import { selectActiveSalon, selectSession, t } from '@gomecoiffer/client-core';
import { Link } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { EmptyState } from '@/components/feedback/empty-state';
import { AvatarInitials, BrandBackdrop, BrandTopBar, IconTile } from '@/components/ui/brand';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { ThemedText } from '@/components/ui/themed-text';
import { useAppSelector } from '@/lib/store/hooks';
import { ActiveSalonCard } from '@/modules/salons/ui/active-salon-card';

const DASHBOARD_KPIS = [
  { icon: 'calendar', tone: 'navy', label: 'Réservations du jour', value: '—' },
  { icon: 'scissors', tone: 'terra', label: 'En cours', value: '—' },
  { icon: 'users', tone: 'navy', label: 'Équipe active', value: 'En ligne' },
  { icon: 'coins', tone: 'green', label: 'Encaissements', value: 'FCFA' },
] as const;

export default function SalonTodayScreen() {
  const session = useAppSelector(selectSession);
  const salon = useAppSelector(selectActiveSalon);
  const firstName = session.userName?.trim().split(/\s+/)[0] || '';

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <BrandBackdrop />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        className="flex-1"
        contentContainerClassName="mx-auto w-full max-w-2xl gap-4 px-5 pt-4 pb-12"
      >
        <BrandTopBar
          logoWidth={154}
          right={<AvatarInitials name={session.userName ?? 'GM'} tone="terra" size={36} />}
        />

        <View className="gap-1">
          <ThemedText variant="title" className="text-2xl font-extrabold">
            {firstName ? `Bonjour ${firstName} 👋` : 'Tableau de bord 👋'}
          </ThemedText>
          <ThemedText variant="muted" className="text-xs">
            Espace de pilotage de votre salon en temps réel.
          </ThemedText>
        </View>

        {salon?.role === 'OWNER' && <Link href="/(salon)/horaires?guide=1" asChild>
          <Button variant="outline" title="Revoir la configuration du salon" />
        </Link>}
        <ActiveSalonCard
          action={
            <Link href="/(salon)/choisir-salon" asChild>
              <Button variant="outline" size="sm" icon="shop" title={t('salons.more.switchSalon')} />
            </Link>
          }
        />

        <View className="flex-row flex-wrap gap-2.5">
          {DASHBOARD_KPIS.map((kpi) => (
            <Card key={kpi.label} className="min-w-[140px] flex-1 gap-2 p-3.5">
              <IconTile name={kpi.icon} tone={kpi.tone} size={34} />
              <View className="gap-0.5">
                <ThemedText variant="caption" className="text-xs">
                  {kpi.label}
                </ThemedText>
                <ThemedText className="text-lg font-extrabold tracking-tight">
                  {kpi.value}
                </ThemedText>
              </View>
            </Card>
          ))}
        </View>

        <EmptyState
          icon="calendar"
          tone="terra"
          title={t('salon.today.title')}
          description={t('salon.today.emptyHint')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

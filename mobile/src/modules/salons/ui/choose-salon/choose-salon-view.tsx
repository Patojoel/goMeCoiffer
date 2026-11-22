import { t, type SessionSalon } from '@gomecoiffer/client-core';
import { SalonRoleSchema } from '@gomecoiffer/contracts';
import * as Haptics from 'expo-haptics';
import { ActivityIndicator, FlatList, Platform, Pressable, ScrollView, View } from 'react-native';
import { EmptyState } from '@/components/feedback/empty-state';
import { Badge } from '@/components/ui/badge';
import { BrandBackdrop, BrandTopBar, IconTile, PageHero } from '@/components/ui/brand';
import { Button } from '@/components/ui/button';
import { InlineAlert } from '@/components/ui/inline-alert';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { ThemedText } from '@/components/ui/themed-text';
import { cn } from '@/lib/ui/cn';
import { WithScreenContext } from '../shared/screen-bridge';
import { useChooseSalon } from './use-choose-salon';

export type ChooseSalonViewProps = {
  readonly onNavigate?: (path: string) => void;
  readonly isOnline?: boolean;
};

type SalonOptionCardProps = {
  readonly item: SessionSalon;
  readonly isActive: boolean;
  readonly isSwitchingThis: boolean;
  readonly isDisabled: boolean;
  readonly onSelect: (salonId: string) => void;
};

function SalonOptionCard({
  item,
  isActive,
  isSwitchingThis,
  isDisabled,
  onSelect,
}: SalonOptionCardProps) {
  const parsedRole = SalonRoleSchema.safeParse(item.role);
  const roleLabel = parsedRole.success ? t(`team.role.${parsedRole.data}`) : null;

  const handlePress = () => {
    if (isDisabled) return;
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      void Haptics.selectionAsync().catch(() => undefined);
    }
    onSelect(item.id);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.name}
      accessibilityState={{
        disabled: isDisabled,
        busy: isSwitchingThis,
        selected: isActive,
      }}
      disabled={isDisabled}
      onPress={handlePress}
      className={cn(
        'min-h-14 flex-row items-center gap-3.5 rounded-[22px] border p-4',
        isActive ? 'border-accent/60 bg-accent/10' : 'border-white/95 bg-card/90',
      )}
      style={({ pressed }) => ({
        borderCurve: 'continuous',
        boxShadow: '0 10px 26px rgba(32, 38, 73, 0.075)',
        opacity: isDisabled ? 0.55 : pressed ? 0.8 : 1,
      })}
    >
      <IconTile name="shop" tone={isActive ? 'terra' : 'navy'} size={44} />

      <View className="flex-1 gap-1">
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <ThemedText variant="headline" className="flex-1 font-bold">
            {item.name}
          </ThemedText>
          <View className="flex-row flex-wrap items-center gap-1.5">
            {roleLabel ? <Badge variant="outline" label={roleLabel} /> : null}
            {isActive ? <Badge variant="success" label={t('salons.switch.activeBadge')} /> : null}
          </View>
        </View>

        <ThemedText variant="muted" className="text-xs">
          {`${item.city} · ${item.district}`}
        </ThemedText>

        {isSwitchingThis ? (
          <View className="flex-row items-center gap-2 pt-1">
            <ActivityIndicator size="small" />
            <ThemedText variant="caption">{t('salons.switch.switching')}</ThemedText>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function ChooseSalonContent({
  onNavigate,
  isOnline,
}: {
  readonly onNavigate: (path: string) => void;
  readonly isOnline: boolean;
}) {
  const { salons, activeSalonId, switchingSalonId, isSwitching, errorMessage, selectSalon } =
    useChooseSalon({ onNavigate, isOnline });

  if (salons.length === 0) {
    return (
      <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background">
        <BrandBackdrop />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          className="flex-1"
          contentContainerClassName="mx-auto w-full max-w-2xl gap-4 px-5 pt-4 pb-12"
        >
          <BrandTopBar logoWidth={160} />
          <EmptyState
            icon="shop"
            tone="terra"
            title={t('salons.guard.selectTitle')}
            description={t('salons.guard.selectHint')}
            action={
              <Button
                icon="shop"
                title={t('salons.guard.createAction')}
                onPress={() => onNavigate('/(salon)/creer-organisation')}
                className="self-start"
              />
            }
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background">
      <BrandBackdrop />
      <FlatList
        data={[...salons]}
        extraData={{ activeSalonId, switchingSalonId, isSwitching, isOnline }}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="mx-auto w-full max-w-2xl gap-3.5 px-5 pt-4 pb-12"
        ListHeaderComponent={
          <View className="gap-3.5 pb-1">
            <BrandTopBar logoWidth={160} />
            <PageHero
              icon="shop"
              tone="terra"
              title={t('salons.switch.title')}
              subtitle={t('salons.switch.subtitle')}
            />
            {!isOnline ? <InlineAlert variant="warning" message={t('common.offlineActionHint')} /> : null}
            {errorMessage ? <InlineAlert variant="error" message={errorMessage} /> : null}
          </View>
        }
        renderItem={({ item }) => (
          <SalonOptionCard
            item={item}
            isActive={item.id === activeSalonId}
            isSwitchingThis={switchingSalonId === item.id}
            isDisabled={!isOnline || isSwitching}
            onSelect={(salonId) => void selectSalon(salonId)}
          />
        )}
      />
    </SafeAreaView>
  );
}

export function ChooseSalonView({ onNavigate, isOnline }: ChooseSalonViewProps) {
  return (
    <WithScreenContext onNavigate={onNavigate} isOnline={isOnline}>
      {(ctx) => <ChooseSalonContent onNavigate={ctx.onNavigate} isOnline={ctx.isOnline} />}
    </WithScreenContext>
  );
}

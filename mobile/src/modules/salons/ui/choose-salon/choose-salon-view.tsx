import { t, type SessionSalon } from '@gomecoiffer/client-core';
import { SalonRoleSchema } from '@gomecoiffer/contracts';
import * as Haptics from 'expo-haptics';
import { ActivityIndicator, FlatList, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { EmptyState } from '@/components/feedback/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InlineAlert } from '@/components/ui/inline-alert';
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
        'min-h-11 gap-2 rounded-2xl border p-5',
        isActive ? 'border-primary bg-secondary' : 'border-border bg-card',
      )}
      style={({ pressed }) => ({
        borderCurve: 'continuous',
        opacity: isDisabled ? 0.55 : pressed ? 0.8 : 1,
      })}
    >
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <ThemedText variant="headline" className="flex-1">
          {item.name}
        </ThemedText>
        <View className="flex-row flex-wrap items-center gap-1.5">
          {roleLabel ? <Badge variant="outline" label={roleLabel} /> : null}
          {isActive ? <Badge variant="success" label={t('salons.switch.activeBadge')} /> : null}
        </View>
      </View>

      <ThemedText variant="muted">{`${item.city} · ${item.district}`}</ThemedText>

      {isSwitchingThis ? (
        <View className="flex-row items-center gap-2 pt-1">
          <ActivityIndicator size="small" />
          <ThemedText variant="caption">{t('salons.switch.switching')}</ThemedText>
        </View>
      ) : null}
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
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          className="flex-1"
          contentContainerClassName="gap-4 p-4"
        >
          <EmptyState
            title={t('salons.guard.selectTitle')}
            description={t('salons.guard.selectHint')}
            action={
              <Button
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
      <FlatList
        data={[...salons]}
        extraData={{ activeSalonId, switchingSalonId, isSwitching, isOnline }}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-3 p-4"
        ListHeaderComponent={
          <View className="gap-3 pb-1">
            <View className="gap-1">
              <ThemedText accessibilityRole="header" variant="title">
                {t('salons.switch.title')}
              </ThemedText>
              <ThemedText variant="muted">{t('salons.switch.subtitle')}</ThemedText>
            </View>
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

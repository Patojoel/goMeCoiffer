import { selectActiveSalon, t } from '@gomecoiffer/client-core';
import { SalonRoleSchema } from '@gomecoiffer/contracts';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Badge } from '@/components/ui/badge';
import { IconTile } from '@/components/ui/brand';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { ThemedText } from '@/components/ui/themed-text';
import { useAppSelector } from '@/lib/store/hooks';

export type ActiveSalonCardProps = {
  readonly action?: ReactNode;
};

export function ActiveSalonCard({ action }: ActiveSalonCardProps) {
  const activeSalon = useAppSelector(selectActiveSalon);
  if (!activeSalon) return null;

  const parsedRole = SalonRoleSchema.safeParse(activeSalon.role);
  const roleLabel = parsedRole.success ? t(`team.role.${parsedRole.data}`) : null;

  return (
    <Card className="p-4">
      <View className="flex-row items-center gap-3.5">
        <IconTile name="shop" tone="terra" size={42} />
        <View className="flex-1 gap-0.5">
          <ThemedText variant="caption" className="text-xs font-bold uppercase tracking-wider">
            {t('salons.more.activeSalonLabel')}
          </ThemedText>
          <CardTitle className="text-base">{activeSalon.name}</CardTitle>
          <CardDescription>{`${activeSalon.city} — ${activeSalon.district}`}</CardDescription>
        </View>
        {roleLabel ? <Badge variant="secondary" label={roleLabel} /> : null}
      </View>
      {action}
    </Card>
  );
}

import { selectActiveSalon, t } from '@gomecoiffer/client-core';
import { SalonRoleSchema } from '@gomecoiffer/contracts';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Badge } from '@/components/ui/badge';
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
    <Card>
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <ThemedText variant="caption" className="font-semibold uppercase tracking-wide">
          {t('salons.more.activeSalonLabel')}
        </ThemedText>
        {roleLabel ? <Badge variant="secondary" label={roleLabel} /> : null}
      </View>
      <CardTitle>{activeSalon.name}</CardTitle>
      <CardDescription>{`${activeSalon.city} — ${activeSalon.district}`}</CardDescription>
      {action}
    </Card>
  );
}
